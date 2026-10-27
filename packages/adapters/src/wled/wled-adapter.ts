import type {
  ILedDevice,
  ILedAdapter,
  DeviceFamily,
  DeviceCapabilities,
  LedState,
  LedColor,
  ConnectionInfo,
  SegmentConfig,
  DeviceStateChangeEvent,
  DeviceErrorEvent,
  TransportType,
} from '../../../core/src/types.ts';
import {
  WledCodec,
  type WledJsonState,
  type WledJsonInfo,
  type WledJsonSegment,
} from './wled-codec.ts';
import type { Preset } from '../../../core/src/presets.ts';

export class WledDevice implements ILedDevice {
  readonly id: string;
  readonly name: string;
  readonly family: DeviceFamily = 'wled';
  readonly connectionInfo: ConnectionInfo;
  capabilities: DeviceCapabilities;
  state: LedState;

  readonly host: string;
  readonly port: number;

  private ws: any = null;
  private wsReconnectTimer: NodeJS.Timeout | null = null;
  private wsHeartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 6;
  private isExplicitDisconnect = false;

  private effectsCache: string[] = [];
  private palettesCache: string[] = [];
  private presetsCache: Preset[] = [];

  private stateListeners = new Set<(event: DeviceStateChangeEvent) => void>();
  private errorListeners = new Set<(event: DeviceErrorEvent) => void>();

  constructor(host: string, port = 80, initialName = 'QuinLED dig2go (WLED)') {
    this.host = host;
    this.port = port;
    this.id = `wled-${host.replace(/\./g, '-')}`;
    this.name = initialName;

    this.connectionInfo = {
      transport: 'wifi-http',
      address: `http://${host}:${port}`,
      name: initialName,
      state: 'disconnected',
    };

    // Default baseline capabilities before metadata handshake
    this.capabilities = {
      family: 'wled',
      supportsPower: true,
      supportsBrightness: true,
      brightnessRange: { min: 0, max: 100, safetyLimit: 100 },
      colorModes: ['rgb', 'rgbw'],
      supportsWhiteChannel: true,
      supportsColorTemperature: true,
      supportsSegments: true,
      maxSegments: 16,
      maxTotalPixels: 1200,
      supportsBuiltInEffects: true,
      effectsList: [
        { id: 0, name: 'Solid' },
        { id: 1, name: 'Blink' },
        { id: 2, name: 'Breathe' },
        { id: 9, name: 'Rainbow' },
        { id: 38, name: 'Fire 2012' },
      ],
      supportsSpeedControl: true,
      supportsMusicReactive: true,
      supportsTelemetry: true,
    };

    this.state = {
      power: true,
      brightness: 20,
      color: { r: 255, g: 160, b: 50, hex: '#FFA032' },
      mode: 'solid',
      effectId: 0,
      effectSpeed: 50,
      activeSegments: 1,
    };
  }

  get isWebSocketConnected(): boolean {
    return this.ws !== null && this.ws.readyState === 1; // 1 = OPEN
  }

  get effects(): string[] {
    return [...this.effectsCache];
  }

  get palettes(): string[] {
    return [...this.palettesCache];
  }

  get presets(): Preset[] {
    return [...this.presetsCache];
  }

  async connect(): Promise<boolean> {
    this.isExplicitDisconnect = false;
    this.connectionInfo.state = 'connecting';

    try {
      // 1. HTTP handshake to fetch full state, info, effects and palettes
      await this.refreshState();

      // 2. Establish real-time WebSocket connection
      this.initWebSocket();

      this.connectionInfo.state = 'connected';
      this.connectionInfo.lastConnectedAt = Date.now();
      return true;
    } catch (err: any) {
      this.connectionInfo.state = 'error';
      this.connectionInfo.disconnectReason = err.message;
      this.emitError('ERR_WLED_CONNECT', `Failed to connect to WLED at ${this.host}:${this.port}: ${err.message}`);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.isExplicitDisconnect = true;
    this.cleanupWebSocket();
    this.connectionInfo.state = 'disconnected';
  }

  async setPower(on: boolean): Promise<boolean> {
    return this.postStateUpdate({ power: on });
  }

  async setBrightness(brightness: number): Promise<boolean> {
    return this.postStateUpdate({ brightness });
  }

  async setColor(color: LedColor): Promise<boolean> {
    return this.postStateUpdate({ color, mode: 'solid' });
  }

  async setEffect(
    effectId: number,
    speed?: number,
    intensity?: number,
    paletteId?: number
  ): Promise<boolean> {
    const customPayload: WledJsonState = {
      seg: [
        {
          id: 0,
          fx: effectId,
          sx: speed !== undefined ? Math.round((speed / 100) * 255) : undefined,
          ix: intensity !== undefined ? Math.round((intensity / 100) * 255) : undefined,
          pal: paletteId,
        },
      ],
    };

    return this.postStateUpdate(
      { mode: effectId === 0 ? 'solid' : 'effect', effectId, effectSpeed: speed },
      customPayload
    );
  }

  async setPalette(paletteId: number): Promise<boolean> {
    const customPayload: WledJsonState = {
      seg: [{ id: 0, pal: paletteId }],
    };
    return this.postStateUpdate({}, customPayload);
  }

  async setSegments(segments: SegmentConfig[]): Promise<boolean> {
    return this.postStateUpdate({ segments, activeSegments: segments.length });
  }

  async setSegment(
    segmentIndex: number,
    config: Partial<SegmentConfig> & { intensity?: number; paletteId?: number }
  ): Promise<boolean> {
    const segItem: WledJsonSegment = {
      id: segmentIndex,
      start: config.start,
      stop: config.stop,
      on: config.on,
    };

    if (config.effectId !== undefined) segItem.fx = config.effectId;
    if (config.speed !== undefined) segItem.sx = Math.round((config.speed / 100) * 255);
    if (config.intensity !== undefined) segItem.ix = Math.round((config.intensity / 100) * 255);
    if (config.paletteId !== undefined) segItem.pal = config.paletteId;
    if (config.color) {
      const colEntry: number[] = [config.color.r, config.color.g, config.color.b];
      if (config.color.w !== undefined) colEntry.push(config.color.w);
      segItem.col = [colEntry];
    }

    return this.postStateUpdate({}, { seg: [segItem] });
  }

  async applyPreset(presetId: number): Promise<boolean> {
    return this.postStateUpdate({}, { ps: presetId });
  }

  async savePreset(presetId: number, name?: string): Promise<boolean> {
    const payload = WledCodec.buildPresetSavePayload(presetId, name || `Preset ${presetId}`, this.state);
    return this.postStateUpdate({}, payload);
  }

  async deletePreset(presetId: number): Promise<boolean> {
    return this.postStateUpdate({}, { pdel: presetId });
  }

  async applyPlaylist(
    presetIds: number[],
    durationsSec: number[] = [10],
    repeat = 0,
    endPresetId?: number
  ): Promise<boolean> {
    const payload = WledCodec.buildPlaylistPayload(presetIds, durationsSec, repeat, endPresetId);
    return this.postStateUpdate({}, payload);
  }

  async fetchPresets(): Promise<Preset[]> {
    try {
      const url = `http://${this.host}:${this.port}/presets.json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json() as Record<string, any>;
      this.presetsCache = WledCodec.parsePresetsJson(raw);
      return [...this.presetsCache];
    } catch (err: any) {
      this.emitError('ERR_PRESETS', `Failed to fetch presets: ${err.message}`);
      return [];
    }
  }

  async fetchEffects(): Promise<string[]> {
    try {
      const url = `http://${this.host}:${this.port}/json/eff`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const effects = await res.json() as string[];
      this.effectsCache = effects;
      return effects;
    } catch {
      return this.effectsCache;
    }
  }

  async fetchPalettes(): Promise<string[]> {
    try {
      const url = `http://${this.host}:${this.port}/json/pal`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const palettes = await res.json() as string[];
      this.palettesCache = palettes;
      return palettes;
    } catch {
      return this.palettesCache;
    }
  }

  async refreshState(): Promise<LedState> {
    try {
      const url = `http://${this.host}:${this.port}/json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const json = await res.json() as {
        state?: WledJsonState;
        info?: WledJsonInfo;
        effects?: string[];
        palettes?: string[];
      };
      const prev = { ...this.state };

      if (json.effects && Array.isArray(json.effects)) {
        this.effectsCache = json.effects;
      }

      if (json.palettes && Array.isArray(json.palettes)) {
        this.palettesCache = json.palettes;
      }

      if (json.info) {
        this.capabilities = WledCodec.parseWledInfoToCapabilities(
          json.info,
          this.effectsCache,
          this.palettesCache
        );
      }

      if (json.state) {
        this.state = WledCodec.wledJsonToState(json.state, this.state);
        this.emitStateChange(prev);
      }

      return { ...this.state };
    } catch (err: any) {
      this.emitError('ERR_REFRESH', `Failed to refresh WLED state: ${err.message}`);
      throw err;
    }
  }

  private async postStateUpdate(
    partial: Partial<LedState>,
    customPayload?: Record<string, any>
  ): Promise<boolean> {
    const prev = { ...this.state };
    const wledJson = customPayload
      ? { ...WledCodec.stateToWledJson(partial), ...customPayload }
      : WledCodec.stateToWledJson(partial);

    try {
      // Send command via HTTP POST to /json/state for reliable confirmation
      const url = `http://${this.host}:${this.port}/json/state`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wledJson),
        signal: AbortSignal.timeout(3000),
      });

      if (!res.ok) {
        throw new Error(`WLED rejected command: HTTP ${res.status}`);
      }

      // Optimistically update local state
      this.state = {
        ...this.state,
        ...partial,
        color: partial.color ? { ...this.state.color, ...partial.color } : this.state.color,
      };

      this.emitStateChange(prev);
      return true;
    } catch (err: any) {
      this.emitError('ERR_WRITE_FAILED', `Failed to send WLED state update: ${err.message}`);
      throw err;
    }
  }

  // --- WebSocket Handling ---

  private initWebSocket(): void {
    if (typeof WebSocket === 'undefined') return;

    this.cleanupWebSocket();

    const wsUrl = `ws://${this.host}:${this.port}/ws`;
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        // Request verbose state
        try {
          this.ws?.send(JSON.stringify({ v: true }));
        } catch {}
      };

      this.ws.onmessage = (event: any) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : event.data?.toString();
          if (!raw) return;
          if (raw === 'pong') return; // Heartbeat response

          const parsed = JSON.parse(raw);
          const prev = { ...this.state };

          if (parsed.state) {
            this.state = WledCodec.wledJsonToState(parsed.state, this.state);
            this.emitStateChange(prev);
          } else if (parsed.on !== undefined || parsed.bri !== undefined || parsed.seg) {
            this.state = WledCodec.wledJsonToState(parsed, this.state);
            this.emitStateChange(prev);
          }

          if (parsed.info) {
            this.capabilities = WledCodec.parseWledInfoToCapabilities(
              parsed.info,
              this.effectsCache,
              this.palettesCache
            );
          }
        } catch {}
      };

      this.ws.onerror = () => {
        // WebSocket error, handled via onclose
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        if (!this.isExplicitDisconnect) {
          this.scheduleWebSocketReconnect();
        }
      };
    } catch (err: any) {
      this.scheduleWebSocketReconnect();
    }
  }

  async sendWsCommand(command: Record<string, any>): Promise<boolean> {
    if (!this.isWebSocketConnected) return false;
    this.ws.send(JSON.stringify(command));
    return true;
  }

  private scheduleWebSocketReconnect(): void {
    if (this.isExplicitDisconnect || this.wsReconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 16000);
    this.reconnectAttempts++;

    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = null;
      if (!this.isExplicitDisconnect) {
        this.initWebSocket();
      }
    }, delay);
    this.wsReconnectTimer.unref();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.wsHeartbeatTimer = setInterval(() => {
      if (this.isWebSocketConnected) {
        try {
          this.ws.send('p');
        } catch {}
      }
    }, 15000);
    this.wsHeartbeatTimer.unref();
  }

  private stopHeartbeat(): void {
    if (this.wsHeartbeatTimer) {
      clearInterval(this.wsHeartbeatTimer);
      this.wsHeartbeatTimer = null;
    }
  }

  private cleanupWebSocket(): void {
    this.stopHeartbeat();
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }

  onStateChange(listener: (event: DeviceStateChangeEvent) => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  onError(listener: (event: DeviceErrorEvent) => void): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  private emitStateChange(previousState: Partial<LedState>): void {
    const event: DeviceStateChangeEvent = {
      deviceId: this.id,
      state: { ...this.state },
      previousState,
      timestamp: Date.now(),
    };
    for (const l of this.stateListeners) l(event);
  }

  private emitError(code: string, message: string): void {
    const event: DeviceErrorEvent = {
      deviceId: this.id,
      code,
      message,
      timestamp: Date.now(),
      recoverable: true,
    };
    for (const l of this.errorListeners) l(event);
  }
}

export class WledAdapter implements ILedAdapter {
  readonly transportName: TransportType = 'wifi-http';
  private devices = new Map<string, WledDevice>();
  private discovering = false;

  constructor(defaultDevices?: WledDevice[]) {
    if (defaultDevices) {
      for (const d of defaultDevices) {
        this.devices.set(d.id, d);
      }
    }
  }

  async startDiscovery(
    onDeviceFound: (device: ILedDevice) => void,
    options?: { candidateHosts?: string[]; timeoutMs?: number }
  ): Promise<void> {
    this.discovering = true;

    // 1. Emit currently registered devices
    for (const dev of this.devices.values()) {
      onDeviceFound(dev);
    }

    // 2. Active network probe for candidate IP addresses
    const candidates = options?.candidateHosts || [];
    const timeout = options?.timeoutMs || 800;

    await Promise.allSettled(
      candidates.map(async (host) => {
        if (!this.discovering) return;
        const devId = `wled-${host.replace(/\./g, '-')}`;
        if (this.devices.has(devId)) return;

        try {
          const res = await fetch(`http://${host}:80/json/info`, {
            signal: AbortSignal.timeout(timeout),
          });
          if (res.ok) {
            const info = await res.json() as WledJsonInfo;
            if (info && info.ver && info.leds) {
              const dev = this.addDevice(host, 80, info.name || 'WLED Controller');
              onDeviceFound(dev);
            }
          }
        } catch {
          // Host did not respond or is not WLED
        }
      })
    );
  }

  async stopDiscovery(): Promise<void> {
    this.discovering = false;
  }

  getConnectedDevices(): ILedDevice[] {
    return Array.from(this.devices.values()).filter((d) => d.connectionInfo.state === 'connected');
  }

  getDiscoveredDevices(): ILedDevice[] {
    return Array.from(this.devices.values());
  }

  addDevice(host: string, port = 80, name?: string): WledDevice {
    const id = `wled-${host.replace(/\./g, '-')}`;
    let device = this.devices.get(id);
    if (!device) {
      device = new WledDevice(host, port, name);
      this.devices.set(device.id, device);
    }
    return device;
  }

  removeDevice(deviceId: string): void {
    const dev = this.devices.get(deviceId);
    if (dev) {
      dev.disconnect();
      this.devices.delete(deviceId);
    }
  }

  getDevice(deviceId: string): WledDevice | undefined {
    return this.devices.get(deviceId);
  }
}
