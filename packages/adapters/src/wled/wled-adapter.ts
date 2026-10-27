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
import { WledCodec, type WledJsonState, type WledJsonInfo } from './wled-codec.ts';

export class WledDevice implements ILedDevice {
  readonly id: string;
  readonly name: string;
  readonly family: DeviceFamily = 'wled';
  readonly connectionInfo: ConnectionInfo;
  capabilities: DeviceCapabilities;
  state: LedState;

  private readonly host: string;
  private readonly port: number;
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

  async connect(): Promise<boolean> {
    try {
      this.connectionInfo.state = 'connecting';
      await this.refreshState();
      this.connectionInfo.state = 'connected';
      this.connectionInfo.lastConnectedAt = Date.now();
      return true;
    } catch (err: any) {
      this.connectionInfo.state = 'error';
      this.connectionInfo.disconnectReason = err.message;
      this.emitError('ERR_WLED_CONNECT', `Failed to connect to WLED at ${this.host}: ${err.message}`);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
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

  async setEffect(effectId: number, speed?: number): Promise<boolean> {
    return this.postStateUpdate({ mode: 'effect', effectId, effectSpeed: speed });
  }

  async setSegments(segments: SegmentConfig[]): Promise<boolean> {
    return this.postStateUpdate({ segments, activeSegments: segments.length });
  }

  async refreshState(): Promise<LedState> {
    try {
      const url = `http://${this.host}:${this.port}/json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const json = await res.json() as { state?: WledJsonState; info?: WledJsonInfo; effects?: string[] };
      const prev = { ...this.state };

      if (json.info) {
        this.capabilities = WledCodec.parseWledInfoToCapabilities(json.info, json.effects || []);
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

  private async postStateUpdate(partial: Partial<LedState>): Promise<boolean> {
    const prev = { ...this.state };
    const wledJson = WledCodec.stateToWledJson(partial);

    try {
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

  async startDiscovery(onDeviceFound: (device: ILedDevice) => void): Promise<void> {
    this.discovering = true;
    // Broadcast discovered devices
    for (const dev of this.devices.values()) {
      onDeviceFound(dev);
    }
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
    let device = this.devices.get(`wled-${host.replace(/\./g, '-')}`);
    if (!device) {
      device = new WledDevice(host, port, name);
      this.devices.set(device.id, device);
    }
    return device;
  }
}
