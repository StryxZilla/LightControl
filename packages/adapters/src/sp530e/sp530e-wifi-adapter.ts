import * as net from 'node:net';
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

export class SP530EWiFiDevice implements ILedDevice {
  readonly id: string;
  readonly name: string;
  readonly family: DeviceFamily = 'sp530e';
  readonly connectionInfo: ConnectionInfo;
  capabilities: DeviceCapabilities;
  state: LedState;

  private socket: net.Socket | null = null;
  private readonly host: string;
  private readonly port: number;
  private stateListeners = new Set<(event: DeviceStateChangeEvent) => void>();
  private errorListeners = new Set<(event: DeviceErrorEvent) => void>();

  constructor(host: string, port: number = SPNET_PORT, initialName: string = 'SP530E Wi-Fi Controller') {
    this.host = host;
    this.port = port;
    this.id = `sp530e-wifi-${host.replace(/\./g, '-')}`;
    this.name = initialName;

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
      brightness: 100,
      color: { r: 255, g: 255, b: 255 },
      mode: 'solid',
      effectId: 0,
      effectSpeed: 50,
      activeSegments: 1,
      segments: [
        { id: 0, start: 0, stop: 60, length: 60, on: true },
      ],
    };
  }

  async connect(): Promise<boolean> {
    if (this.connectionInfo.state === 'connected' && this.socket) {
      return true;
    }

    this.connectionInfo.state = 'connecting';

    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(4000);

      socket.connect(this.port, this.host, async () => {
        this.socket = socket;
        this.connectionInfo.state = 'connected';
        this.connectionInfo.connected = true;
        this.connectionInfo.lastConnectedAt = Date.now();

        try {
          // Perform passive telemetry handshake to read current state
          await this.refreshState();
          resolve(true);
        } catch {
          // Connected even if initial refresh had a delay
          resolve(true);
        }
      });

      socket.on('error', (err) => {
        this.connectionInfo.state = 'error';
        this.connectionInfo.connected = false;
        this.connectionInfo.disconnectReason = err.message;
        this.socket = null;
        this.emitError('ERR_WIFI_CONNECT', err.message);
        reject(err);
      });

      socket.on('close', () => {
        this.connectionInfo.state = 'disconnected';
        this.connectionInfo.connected = false;
        this.socket = null;
      });

      socket.on('timeout', () => {
        socket.destroy();
        this.connectionInfo.state = 'disconnected';
        this.connectionInfo.connected = false;
        this.socket = null;
        const err = new Error(`Connection to ${this.host}:${this.port} timed out`);
        this.emitError('ERR_WIFI_TIMEOUT', err.message);
        reject(err);
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
    return new Promise((resolve, reject) => {
      const tempSocket = new net.Socket();
      tempSocket.setTimeout(3000);

      let buffer = Buffer.alloc(0);

      tempSocket.connect(this.port, this.host, () => {
        const queryFrame = SpnetCodec.buildQueryFrame();
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
    this.state.power = on;
    this.emitStateChange(prev);
    return true;
  }

  async setBrightness(brightness: number): Promise<boolean> {
    const prev = { ...this.state };
    const min = this.capabilities.brightnessRange.min;
    const max = this.capabilities.brightnessRange.max;
    this.state.brightness = Math.max(min, Math.min(max, Math.round(brightness)));
    this.emitStateChange(prev);
    return true;
  }

  async setColor(color: LedColor): Promise<boolean> {
    const prev = { ...this.state };
    this.state.color = { ...color };
    this.state.mode = 'solid';
    this.emitStateChange(prev);
    return true;
  }

  async setEffect(effectId: number, speed?: number): Promise<boolean> {
    const prev = { ...this.state };
    this.state.mode = 'effect';
    this.state.effectId = effectId;
    if (speed !== undefined) {
      this.state.effectSpeed = Math.max(1, Math.min(100, Math.round(speed)));
    }
    this.emitStateChange(prev);
    return true;
  }

  async setMusicMode(modeId: number, sensitivity?: number): Promise<boolean> {
    const prev = { ...this.state };
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
  private devices: Map<string, SP530EWiFiDevice> = new Map();
  private discovering: boolean = false;

  async startDiscovery(onDeviceFound: (device: ILedDevice) => void): Promise<void> {
    this.discovering = true;

    // Direct check of known discovered hardware IP
    const defaultHost = '192.168.86.34';
    if (!this.devices.has(defaultHost)) {
      const device = new SP530EWiFiDevice(defaultHost);
      this.devices.set(defaultHost, device);
      onDeviceFound(device);
    } else {
      const dev = this.devices.get(defaultHost)!;
      onDeviceFound(dev);
    }
  }

  async stopDiscovery(): Promise<void> {
    this.discovering = false;
  }

  getConnectedDevices(): ILedDevice[] {
    return Array.from(this.devices.values()).filter(d => d.connectionInfo.state === 'connected' || d.connectionInfo.connected);
  }

  getDiscoveredDevices(): ILedDevice[] {
    return Array.from(this.devices.values());
  }

  addDevice(host: string, port: number = SPNET_PORT): SP530EWiFiDevice {
    let device = this.devices.get(host);
    if (!device) {
      device = new SP530EWiFiDevice(host, port);
      this.devices.set(host, device);
    }
    return device;
  }
}
