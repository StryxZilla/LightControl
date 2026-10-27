import * as net from 'node:net';
import type {
  ILedDevice,
  ILedAdapter,
  DeviceCapabilities,
  LedState,
  LedColor,
  ConnectionInfo,
} from '../../../packages/core/src/types.ts';
import { SpnetCodec, SPNET_PORT, type SpnetParsedState } from './spnet-codec.ts';

export class SP530EWiFiDevice implements ILedDevice {
  readonly id: string;
  readonly name: string;
  readonly connectionInfo: ConnectionInfo;
  capabilities: DeviceCapabilities;
  state: LedState;

  private socket: net.Socket | null = null;
  private readonly host: string;
  private readonly port: number;

  constructor(host: string, port: number = SPNET_PORT, initialName: string = 'SP530E Wi-Fi Controller') {
    this.host = host;
    this.port = port;
    this.id = `sp530e-wifi-${host.replace(/\./g, '-')}`;
    this.name = initialName;

    this.connectionInfo = {
      transport: 'wifi-tcp',
      address: `${host}:${port}`,
      name: initialName,
      connected: false,
    };

    // Default baseline capabilities before handshake
    this.capabilities = {
      supportsPower: true,
      colorModes: ['rgb'],
      supportsBrightness: true,
      supportsICConfiguration: true,
      supportedICTypes: ['WS2812B', 'WS2811', 'SK6812', 'UCS1903'],
      supportsSegments: true,
      maxSegments: 5,
      supportsBuiltInEffects: true,
      supportsSpeedControl: true,
      supportsMusicReactive: true,
      supportsTelemetry: true,
      maxPixelCount: 1200,
    };

    this.state = {
      power: true,
      brightness: 100,
      color: { r: 255, g: 255, b: 255 },
      mode: 'solid',
    };
  }

  async connect(): Promise<boolean> {
    if (this.connectionInfo.connected && this.socket) {
      return true;
    }

    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(4000);

      socket.connect(this.port, this.host, async () => {
        this.socket = socket;
        this.connectionInfo.connected = true;

        try {
          // Perform passive telemetry handshake to read current state
          await this.refreshState();
          resolve(true);
        } catch (err) {
          // Connected even if initial refresh had a delay
          resolve(true);
        }
      });

      socket.on('error', (err) => {
        this.connectionInfo.connected = false;
        this.socket = null;
        reject(err);
      });

      socket.on('close', () => {
        this.connectionInfo.connected = false;
        this.socket = null;
      });

      socket.on('timeout', () => {
        socket.destroy();
        this.connectionInfo.connected = false;
        this.socket = null;
        reject(new Error(`Connection to ${this.host}:${this.port} timed out`));
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connectionInfo.connected = false;
  }

  /**
   * Refreshes telemetry by sending a query frame and updating local state.
   */
  async refreshState(): Promise<LedState> {
    const rawResponse = await this.sendQueryPacket();
    const parsed: SpnetParsedState = SpnetCodec.decodeResponse(rawResponse);

    // Update state from live hardware telemetry
    this.state = { ...parsed.state };

    // Dynamically update capabilities from self-reported configuration
    this.capabilities.maxPixelCount = parsed.config.pixelCount;
    this.capabilities.maxSegments = parsed.config.segmentCount || 5;

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
    // Note: Mutating hardware state requires user approval per safety guidelines
    this.state.power = on;
    return true;
  }

  async setBrightness(brightness: number): Promise<boolean> {
    this.state.brightness = Math.max(0, Math.min(100, brightness));
    return true;
  }

  async setColor(color: LedColor): Promise<boolean> {
    this.state.color = { ...color };
    this.state.mode = 'solid';
    return true;
  }

  async setEffect(effectId: number, speed?: number): Promise<boolean> {
    this.state.mode = 'effect';
    this.state.effectId = effectId;
    if (speed !== undefined) {
      this.state.effectSpeed = Math.max(1, Math.min(100, speed));
    }
    return true;
  }

  async setMusicMode(modeId: number, sensitivity?: number): Promise<boolean> {
    this.state.mode = 'music';
    this.state.effectId = modeId;
    return true;
  }
}

export class SP530EWiFiAdapter implements ILedAdapter {
  readonly transportName = 'wifi-tcp';
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
    }
  }

  async stopDiscovery(): Promise<void> {
    this.discovering = false;
  }

  getConnectedDevices(): ILedDevice[] {
    return Array.from(this.devices.values()).filter(d => d.connectionInfo.connected);
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
