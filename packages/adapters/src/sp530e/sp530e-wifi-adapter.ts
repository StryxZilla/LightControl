import * as net from 'node:net';
import * as cp from 'node:child_process';
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
import { SpnetCodec, SPNET_PORT, type SpnetParsedState } from './spnet-codec.ts';
import type { DiagnosticsService } from '../../../core/src/diagnostics.ts';

export const SP530E_DEFAULT_EFFECTS = [
  { id: 1, name: 'Rainbow Flow', category: 'dynamic', speedSupported: true, directionSupported: true },
  { id: 2, name: 'Color Chase', category: 'dynamic', speedSupported: true, directionSupported: true },
  { id: 3, name: 'Breathing', category: 'ambient', speedSupported: true },
  { id: 4, name: 'Meteor Rain', category: 'dynamic', speedSupported: true },
  { id: 5, name: 'Fire Flicker', category: 'ambient', speedSupported: true },
  { id: 6, name: 'Color Wave', category: 'dynamic', speedSupported: true, directionSupported: true },
  { id: 7, name: 'Twinkle Stars', category: 'ambient', speedSupported: true },
  { id: 8, name: 'Color Wipe', category: 'dynamic', speedSupported: true },
  { id: 9, name: 'Scanner', category: 'dynamic', speedSupported: true },
  { id: 10, name: 'Rainbow Cycle', category: 'dynamic', speedSupported: true },
];

export interface SP530EWiFiDeviceOptions {
  name?: string;
  dryRun?: boolean;
  diagnostics?: DiagnosticsService;
}

export class SP530EWiFiDevice implements ILedDevice {
  readonly id: string;
  readonly name: string;
  readonly family: DeviceFamily = 'sp530e';
  readonly connectionInfo: ConnectionInfo;
  capabilities: DeviceCapabilities;
  state: LedState;

  public dryRun: boolean;
  public enforceSafetyLimits: boolean = true;
  public safetyBrightnessLimit: number = 20;
  public lastEncodedFrame: Uint8Array | null = null;

  private socket: net.Socket | null = null;
  private readonly host: string;
  private readonly port: number;
  private diagnostics?: DiagnosticsService;
  private stateListeners = new Set<(event: DeviceStateChangeEvent) => void>();
  private errorListeners = new Set<(event: DeviceErrorEvent) => void>();
  private queryBuffer: Buffer = Buffer.alloc(0);
  private queryResolver: ((data: Uint8Array) => void) | null = null;

  constructor(
    host: string,
    port: number = SPNET_PORT,
    initialName: string = 'SP530E Wi-Fi Controller',
    options: SP530EWiFiDeviceOptions = {}
  ) {
    this.host = host;
    this.port = port;
    this.id = `sp530e-wifi-${host.replace(/\./g, '-')}`;
    this.name = initialName;
    this.dryRun = options.dryRun ?? false;
    this.diagnostics = options.diagnostics;

    this.connectionInfo = {
      transport: 'wifi-tcp',
      address: `${host}:${port}`,
      name: initialName,
      state: 'disconnected',
      connected: false,
    };

    // Default baseline capabilities before handshake
    this.capabilities = {
      family: 'sp530e',
      supportsPower: true,
      supportsBrightness: true,
      brightnessRange: { min: 0, max: 100, safetyLimit: 20 },
      colorModes: ['rgb'],
      supportsWhiteChannel: false,
      supportsColorTemperature: false,
      supportsSegments: true,
      maxSegments: 5,
      maxTotalPixels: 60,
      maxPixelCount: 60,
      supportsICConfiguration: true,
      supportedICTypes: ['WS2812B', 'WS2811', 'SK6812', 'UCS1903'],
      supportsBuiltInEffects: true,
      effectsList: [...SP530E_DEFAULT_EFFECTS],
      supportsSpeedControl: true,
      supportsMusicReactive: true,
      supportsTelemetry: true,
    };

    this.state = {
      power: true,
      brightness: 20,
      color: { r: 255, g: 255, b: 255, hex: '#FFFFFF' },
      mode: 'solid',
      effectId: 0,
      effectSpeed: 50,
      activeSegments: 1,
      segments: [
        { id: 0, start: 0, stop: 60, length: 60, on: true },
      ],
    };
  }

  setDiagnostics(diag: DiagnosticsService): void {
    this.diagnostics = diag;
  }

  async connect(): Promise<boolean> {
    if (this.connectionInfo.state === 'connected' && this.socket && !this.socket.destroyed) {
      return true;
    }

    this.connectionInfo.state = 'connecting';
    this.diagnostics?.logConnectionAttempt(this.id, 'wifi-tcp', `${this.host}:${this.port}`);

    if (this.dryRun) {
      this.connectionInfo.state = 'connected';
      this.connectionInfo.connected = true;
      this.connectionInfo.lastConnectedAt = Date.now();
      this.diagnostics?.logConnectionResult(this.id, true, 'wifi-tcp (dry-run)');
      return true;
    }

    return new Promise((resolve, reject) => {
      let isResolved = false;
      const socket = new net.Socket();
      socket.setTimeout(5000);

      socket.connect(this.port, this.host, async () => {
        // Clear idle timeout so the persistent session is not killed by Node.js
        socket.setTimeout(0);
        socket.setKeepAlive(true, 5000);
        socket.setNoDelay(true);

        this.socket = socket;
        this.connectionInfo.state = 'connected';
        this.connectionInfo.connected = true;
        this.connectionInfo.lastConnectedAt = Date.now();
        this.diagnostics?.logConnectionResult(this.id, true, 'wifi-tcp');

        try {
          // Perform passive telemetry query to populate live parameters
          await this.refreshState();
        } catch {
          // Keep connected even if initial query response was delayed
        }
        if (!isResolved) {
          isResolved = true;
          resolve(true);
        }
      });

      socket.on('data', (chunk: Buffer) => {
        this.queryBuffer = Buffer.concat([this.queryBuffer, chunk]);

        if (this.queryBuffer.length >= 13) {
          const payloadLen = (this.queryBuffer[11]! << 8) | this.queryBuffer[12]!;
          const totalExpected = 13 + payloadLen;

          if (this.queryBuffer.length >= totalExpected) {
            const completePacket = new Uint8Array(this.queryBuffer.subarray(0, totalExpected));
            this.queryBuffer = this.queryBuffer.subarray(totalExpected);

            this.diagnostics?.logDeviceResponse(this.id, Buffer.from(completePacket).toString('hex'));

            if (this.queryResolver) {
              const res = this.queryResolver;
              this.queryResolver = null;
              res(completePacket);
            }
          }
        }
      });

      socket.on('error', (err) => {
        this.connectionInfo.state = 'error';
        this.connectionInfo.connected = false;
        this.connectionInfo.disconnectReason = err.message;
        this.socket = null;
        this.diagnostics?.logConnectionResult(this.id, false, 'wifi-tcp', err.message);
        this.emitError('ERR_WIFI_CONNECT', err.message);
        if (!isResolved) {
          isResolved = true;
          reject(err);
        }
      });

      socket.on('close', () => {
        this.connectionInfo.state = 'disconnected';
        this.connectionInfo.connected = false;
        this.socket = null;
        this.diagnostics?.logDisconnect(this.id, 'TCP socket closed by peer');
      });

      socket.on('timeout', () => {
        if (!this.connectionInfo.connected) {
          socket.destroy();
          this.connectionInfo.state = 'unavailable';
          this.connectionInfo.connected = false;
          this.socket = null;
          const err = new Error(`Connection to ${this.host}:${this.port} timed out`);
          this.diagnostics?.logConnectionResult(this.id, false, 'wifi-tcp', err.message);
          this.emitError('ERR_WIFI_TIMEOUT', err.message);
          if (!isResolved) {
            isResolved = true;
            reject(err);
          }
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connectionInfo.state = 'disconnected';
    this.connectionInfo.connected = false;
    this.diagnostics?.logDisconnect(this.id, 'User requested disconnect');
  }

  /**
   * Transmits a control frame over the active TCP socket or handles dry-run mode.
   */
  private async writeControlPacket(opcodeDesc: string, frame: Uint8Array): Promise<boolean> {
    this.lastEncodedFrame = frame;
    const hex = Buffer.from(frame).toString('hex');
    this.diagnostics?.logCommandEncoded(this.id, opcodeDesc, hex);

    if (this.dryRun) {
      this.diagnostics?.logCommandTransmitted(this.id, `${opcodeDesc} (DRY-RUN)`, hex, frame.length);
      return true;
    }

    if (!this.socket || this.connectionInfo.state !== 'connected' || this.socket.destroyed) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Write command ${opcodeDesc} to ${this.host}:${this.port} timed out`));
      }, 3000);

      this.socket?.write(frame, (err) => {
        clearTimeout(timer);
        if (err) {
          this.diagnostics?.log('error', 'TRANSMIT', `Failed transmitting ${opcodeDesc}: ${err.message}`, { err });
          reject(err);
        } else {
          this.diagnostics?.logCommandTransmitted(this.id, opcodeDesc, hex, frame.length);
          resolve(true);
        }
      });
    });
  }

  /**
   * Refreshes telemetry by sending a query frame and updating local state.
   */
  async refreshState(): Promise<LedState> {
    const rawResponse = await this.sendQueryPacket();
    const parsed: SpnetParsedState = SpnetCodec.decodeResponse(rawResponse);

    const prev = { ...this.state };

    // Update state from live hardware telemetry
    this.state = {
      ...this.state,
      ...parsed.state,
    };

    // Dynamically update capabilities from self-reported configuration
    this.capabilities.maxTotalPixels = parsed.config.pixelCount;
    this.capabilities.maxPixelCount = parsed.config.pixelCount;
    this.capabilities.maxSegments = parsed.config.segmentCount || 5;
    this.capabilities.firmwareInfo = {
      version: parsed.config.firmwareVersion,
      model: 'SP530E',
      ip: this.host,
    };

    this.emitStateChange(prev);
    return { ...this.state };
  }

  private async sendQueryPacket(): Promise<Uint8Array> {
    const queryFrame = SpnetCodec.buildQueryFrame();
    this.lastEncodedFrame = queryFrame;

    if (this.dryRun) {
      return new Uint8Array(428);
    }

    // If already connected, use the primary socket
    if (this.socket && this.connectionInfo.state === 'connected' && !this.socket.destroyed) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.queryResolver = null;
          reject(new Error(`Timeout reading telemetry from active socket ${this.host}:${this.port}`));
        }, 3000);

        this.queryResolver = (data) => {
          clearTimeout(timer);
          resolve(data);
        };

        this.socket!.write(queryFrame, (err) => {
          if (err) {
            clearTimeout(timer);
            this.queryResolver = null;
            reject(err);
          }
        });
      });
    }

    // Otherwise use a short temporary handshake socket
    return new Promise((resolve, reject) => {
      const tempSocket = new net.Socket();
      tempSocket.setTimeout(3000);

      let buffer = Buffer.alloc(0);

      tempSocket.connect(this.port, this.host, () => {
        tempSocket.write(queryFrame);
      });

      tempSocket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length >= 13) {
          const payloadLen = (buffer[11]! << 8) | buffer[12]!;
          if (buffer.length >= 13 + payloadLen) {
            tempSocket.destroy();
            resolve(new Uint8Array(buffer));
          }
        }
      });

      tempSocket.on('error', (err) => {
        reject(err);
      });

      tempSocket.on('timeout', () => {
        tempSocket.destroy();
        reject(new Error(`Timeout reading telemetry from ${this.host}:${this.port}`));
      });
    });
  }

  async setPower(on: boolean): Promise<boolean> {
    const prev = { ...this.state };
    const frame = SpnetCodec.encodePower(on);
    await this.writeControlPacket(`Power ${on ? 'ON' : 'OFF'}`, frame);
    this.state.power = on;
    this.emitStateChange(prev);
    return true;
  }

  async setBrightness(brightness: number): Promise<boolean> {
    const prev = { ...this.state };
    const min = this.capabilities.brightnessRange.min;
    const max = this.enforceSafetyLimits
      ? (this.safetyBrightnessLimit || this.capabilities.brightnessRange.safetyLimit || 20)
      : this.capabilities.brightnessRange.max;
    const clamped = Math.max(min, Math.min(max, Math.round(brightness)));

    // Scale 0-100% to 0-255 hardware byte
    const hardwareByte = Math.round((clamped / 100) * 255);
    const frame = SpnetCodec.encodeBrightness(hardwareByte);
    await this.writeControlPacket(`Brightness ${clamped}% (0x${hardwareByte.toString(16)})`, frame);

    this.state.brightness = clamped;
    this.emitStateChange(prev);
    return true;
  }

  async setColor(color: LedColor): Promise<boolean> {
    const prev = { ...this.state };
    const frame = SpnetCodec.encodeColor(color.r, color.g, color.b);
    await this.writeControlPacket(`Color RGB(${color.r},${color.g},${color.b})`, frame);

    this.state.color = { ...color };
    this.state.mode = 'solid';
    this.emitStateChange(prev);
    return true;
  }

  async setEffect(effectId: number, speed?: number): Promise<boolean> {
    const prev = { ...this.state };
    const frame = SpnetCodec.encodeEffectMode(effectId);
    await this.writeControlPacket(`EffectMode ${effectId}`, frame);

    if (speed !== undefined) {
      const clampedSpeed = Math.max(1, Math.min(100, Math.round(speed)));
      const hardwareSpeed = Math.round((clampedSpeed / 100) * 255);
      const speedFrame = SpnetCodec.encodeEffectSpeed(hardwareSpeed);
      await this.writeControlPacket(`EffectSpeed ${clampedSpeed}%`, speedFrame);
      this.state.effectSpeed = clampedSpeed;
    }

    this.state.mode = 'effect';
    this.state.effectId = effectId;
    this.emitStateChange(prev);
    return true;
  }

  async setMusicMode(modeId: number, sensitivity?: number): Promise<boolean> {
    const prev = { ...this.state };
    const frame = SpnetCodec.buildControlFrame(new Uint8Array([0x04, 0x02, modeId & 0xff]));
    await this.writeControlPacket(`MusicMode ${modeId}`, frame);

    if (sensitivity !== undefined) {
      const sensByte = Math.max(0, Math.min(255, Math.round((sensitivity / 100) * 255)));
      const sensFrame = SpnetCodec.buildControlFrame(new Uint8Array([0x04, 0x03, sensByte]));
      await this.writeControlPacket(`MusicSensitivity ${sensitivity}%`, sensFrame);
    }

    this.state.mode = 'music';
    this.state.effectId = modeId;
    this.emitStateChange(prev);
    return true;
  }

  async setSegments(segments: SegmentConfig[]): Promise<boolean> {
    const prev = { ...this.state };
    this.state.segments = [...segments];
    this.state.activeSegments = segments.length;
    this.emitStateChange(prev);
    return true;
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

export class SP530EWiFiAdapter implements ILedAdapter {
  readonly transportName: TransportType = 'wifi-tcp';
  public dryRun: boolean = false;
  private devices: Map<string, SP530EWiFiDevice> = new Map();
  private discovering: boolean = false;
  private diagnostics?: DiagnosticsService;
  private defaultHost: string = '192.168.86.34';

  constructor(defaultHost = '192.168.86.34', diagnostics?: DiagnosticsService) {
    this.defaultHost = defaultHost;
    this.diagnostics = diagnostics;
  }

  setDiagnostics(diag: DiagnosticsService): void {
    this.diagnostics = diag;
  }

  setDefaultHost(host: string): void {
    this.defaultHost = host;
  }

  setSafetyLimits(enforce: boolean, limit = 20): void {
    for (const dev of this.devices.values()) {
      dev.enforceSafetyLimits = enforce;
      dev.safetyBrightnessLimit = limit;
      dev.capabilities.brightnessRange.safetyLimit = enforce ? limit : 100;
    }
  }

  private getCandidateIps(): string[] {
    const candidates = new Set<string>();
    candidates.add(this.defaultHost);

    // Parse ARP table to discover live IP addresses on current subnet
    try {
      const out = cp.execSync('arp -a', { encoding: 'utf8', timeout: 1500 });
      for (const line of out.split('\n')) {
        const match = line.trim().match(/^(\d+\.\d+\.\d+\.\d+)\s+/);
        if (match && match[1]) {
          const ip = match[1];
          if (!ip.endsWith('.255') && !ip.startsWith('224.') && !ip.startsWith('239.') && !ip.startsWith('127.')) {
            candidates.add(ip);
          }
        }
      }
    } catch {
      // Fallback to default host
    }

    return Array.from(candidates);
  }

  /**
   * Fast probe testing whether port 8587 responds to SPTECH\0 query.
   */
  private probeHost(host: string, port = SPNET_PORT, timeoutMs = 400): Promise<{ ok: boolean; raw?: Uint8Array; alreadyConnected?: boolean }> {
    // If an active session is already connected to this host, avoid opening a redundant probe socket
    // that might trigger TCP reset on single-socket microcontrollers (ESP32)
    for (const dev of this.devices.values()) {
      if (dev.connectionInfo.address.startsWith(host) && dev.connectionInfo.connected) {
        return Promise.resolve({ ok: true, alreadyConnected: true });
      }
    }

    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);

      socket.connect(port, host, () => {
        const query = SpnetCodec.buildQueryFrame();
        socket.write(query);
      });

      let buffer = Buffer.alloc(0);

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length >= 13) {
          const magic = buffer.slice(0, 6).toString('ascii');
          if (magic === 'SPTECH') {
            const payloadLen = (buffer[11]! << 8) | buffer[12]!;
            if (buffer.length >= 13 + payloadLen) {
              socket.destroy();
              resolve({ ok: true, raw: new Uint8Array(buffer) });
              return;
            }
          } else {
            socket.destroy();
            resolve({ ok: false });
          }
        }
      });

      socket.on('error', () => {
        socket.destroy();
        resolve({ ok: false });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ ok: false });
      });
    });
  }

  async startDiscovery(onDeviceFound: (device: ILedDevice) => void): Promise<void> {
    this.discovering = true;
    this.diagnostics?.logScan('START', 'wifi-tcp');

    if (this.dryRun) {
      const mockDev = this.addDevice(this.defaultHost, SPNET_PORT);
      mockDev.dryRun = true;
      mockDev.connectionInfo.state = 'discovered';
      onDeviceFound(mockDev);
      this.diagnostics?.logScan('STOP', 'wifi-tcp (dry-run)');
      return;
    }

    const candidates = this.getCandidateIps();
    this.diagnostics?.log('info', 'SCAN', `Probing ${candidates.length} candidate network IP addresses for SP530E controllers...`);

    const results = await Promise.all(
      candidates.map(async (host) => {
        if (!this.discovering) return null;
        const res = await this.probeHost(host, SPNET_PORT, 450);
        return { host, ...res };
      })
    );

    let discoveredCount = 0;
    for (const r of results) {
      if (!r) continue;
      if (r.ok && (r.raw || r.alreadyConnected)) {
        discoveredCount++;
        let dev = this.devices.get(r.host);
        if (!dev) {
          dev = new SP530EWiFiDevice(r.host, SPNET_PORT, `SP530E Controller (${r.host})`, {
            dryRun: this.dryRun,
            diagnostics: this.diagnostics,
          });
          this.devices.set(r.host, dev);
        }

        if (r.raw) {
          try {
            const parsed = SpnetCodec.decodeResponse(r.raw);
            dev.state = { ...dev.state, ...parsed.state };
            dev.capabilities.maxTotalPixels = parsed.config.pixelCount;
            dev.capabilities.maxPixelCount = parsed.config.pixelCount;
            dev.capabilities.firmwareInfo = {
              version: parsed.config.firmwareVersion,
              model: 'SP530E',
              ip: r.host,
            };
          } catch {}
        }

        if (!r.alreadyConnected) {
          dev.connectionInfo.state = 'discovered';
          dev.connectionInfo.connected = false;
        }
        dev.connectionInfo.lastSeen = Date.now();

        this.diagnostics?.logDeviceDiscovered({
          id: dev.id,
          name: dev.name,
          transport: 'wifi-tcp',
          address: dev.connectionInfo.address,
        });

        onDeviceFound(dev);
      } else {
        // If device was previously in cache but didn't respond, mark unavailable
        const existing = this.devices.get(r.host);
        if (existing && existing.connectionInfo.state !== 'connected') {
          existing.connectionInfo.state = 'unavailable';
          this.diagnostics?.logDeviceUpdated({
            id: existing.id,
            state: 'unavailable',
            lastSeen: Date.now(),
          });
        }
      }
    }

    if (discoveredCount === 0 && this.defaultHost) {
      // Fallback: If no controllers responded to probe (e.g. controller is already connected,
      // busy with another socket, or in test/offline environment), make sure the default
      // configured controller remains registered and available.
      let dev = this.devices.get(this.defaultHost);
      if (!dev) {
        dev = this.addDevice(this.defaultHost, SPNET_PORT);
      }
      dev.connectionInfo.state = 'discovered';
      dev.connectionInfo.lastSeen = Date.now();
      this.diagnostics?.logDeviceDiscovered({
        id: dev.id,
        name: dev.name,
        transport: 'wifi-tcp',
        address: dev.connectionInfo.address,
      });
      onDeviceFound(dev);
      discoveredCount = 1;
    }

    this.diagnostics?.logScan('STOP', 'wifi-tcp', { discoveredCount });
    this.discovering = false;
  }

  async stopDiscovery(): Promise<void> {
    this.discovering = false;
    this.diagnostics?.logScan('STOP', 'wifi-tcp');
  }

  getConnectedDevices(): ILedDevice[] {
    return Array.from(this.devices.values()).filter(
      (d) => d.connectionInfo.state === 'connected' || d.connectionInfo.connected
    );
  }

  getDiscoveredDevices(): ILedDevice[] {
    return Array.from(this.devices.values());
  }

  addDevice(host: string, port: number = SPNET_PORT): SP530EWiFiDevice {
    let device = this.devices.get(host);
    if (!device) {
      device = new SP530EWiFiDevice(host, port, `SP530E Controller (${host})`, {
        dryRun: this.dryRun,
        diagnostics: this.diagnostics,
      });
      this.devices.set(host, device);
    }
    return device;
  }

  removeDevice(host: string): void {
    const dev = this.devices.get(host);
    if (dev) {
      dev.disconnect();
      this.devices.delete(host);
      this.diagnostics?.logDeviceRemoved(dev.id, 'Explicit adapter removal');
    }
  }
}
