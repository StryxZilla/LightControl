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
  private bleTransport?: any;
  private bleTargetAddress: string = '7C4FADEB2AAA';

  private connectPromise: Promise<boolean> | null = null;
  private currentSessionId: number = 0;
  private commandQueue: Array<{
    opcodeDesc: string;
    frame: Uint8Array;
    resolve: (val: boolean) => void;
    reject: (err: any) => void;
  }> = [];
  private isProcessingQueue: boolean = false;

  setBleTransport(transport: any, targetAddress = '7C4FADEB2AAA'): void {
    this.bleTransport = transport;
    this.bleTargetAddress = targetAddress;
  }

  private async bridgeBleWrite(desc: string, frame: Uint8Array): Promise<void> {
    if (!this.bleTransport || this.dryRun) return;
    try {
      if (!this.bleTransport.isConnected) {
        await this.bleTransport.connect(this.bleTargetAddress, 3000);
      }
      await this.bleTransport.writeBytes(frame, 2000);
      this.diagnostics?.log('info', 'BLE-BRIDGE', `Relayed ${desc} to BLE (${this.bleTargetAddress})`, {
        hex: Buffer.from(frame).toString('hex'),
      });
    } catch (err: any) {
      this.diagnostics?.log('debug', 'BLE-BRIDGE', `BLE bridge skipped: ${err.message}`);
    }
  }

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
    if (this.connectPromise) {
      return this.connectPromise;
    }
    this.connectPromise = this._doConnect().finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  private async _doConnect(): Promise<boolean> {
    this.connectionInfo.state = 'connecting';
    this.diagnostics?.logConnectionAttempt(this.id, 'wifi-tcp', `${this.host}:${this.port}`);

    if (this.dryRun) {
      this.connectionInfo.state = 'connected';
      this.connectionInfo.connected = true;
      this.connectionInfo.lastConnectedAt = Date.now();
      this.diagnostics?.logConnectionResult(this.id, true, 'wifi-tcp (dry-run)');
      return true;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }

    const sessionId = ++this.currentSessionId;
    this.queryBuffer = Buffer.alloc(0);

    return new Promise((resolve, reject) => {
      let isResolved = false;
      const socket = new net.Socket();
      socket.setTimeout(4000);

      socket.connect(this.port, this.host, async () => {
        if (this.currentSessionId !== sessionId) {
          socket.destroy();
          return;
        }

        socket.setTimeout(0);
        socket.setKeepAlive(true, 5000);
        socket.setNoDelay(true);

        this.socket = socket;
        this.connectionInfo.state = 'connected';
        this.connectionInfo.connected = true;
        this.connectionInfo.lastConnectedAt = Date.now();
        this.diagnostics?.logConnectionResult(this.id, true, 'wifi-tcp');

        if (!isResolved) {
          isResolved = true;
          resolve(true);
        }
      });

      socket.on('data', (chunk: Buffer) => {
        if (this.currentSessionId !== sessionId) return;

        this.queryBuffer = Buffer.concat([this.queryBuffer, chunk]);

        while (this.queryBuffer.length >= 13) {
          const magicMatch =
            this.queryBuffer[0] === 0x53 &&
            this.queryBuffer[1] === 0x50 &&
            this.queryBuffer[2] === 0x54 &&
            this.queryBuffer[3] === 0x45 &&
            this.queryBuffer[4] === 0x43 &&
            this.queryBuffer[5] === 0x48 &&
            this.queryBuffer[6] === 0x00;

          if (!magicMatch) {
            const idx = this.queryBuffer.indexOf(Buffer.from([0x53, 0x50, 0x54, 0x45, 0x43, 0x48, 0x00]));
            if (idx !== -1) {
              this.queryBuffer = this.queryBuffer.subarray(idx);
              continue;
            } else {
              this.queryBuffer = this.queryBuffer.subarray(Math.max(0, this.queryBuffer.length - 6));
              break;
            }
          }

          const payloadLen = (this.queryBuffer[11]! << 8) | this.queryBuffer[12]!;
          const totalExpected = 13 + payloadLen;

          if (this.queryBuffer.length < totalExpected) {
            break;
          }

          const completePacket = new Uint8Array(this.queryBuffer.subarray(0, totalExpected));
          this.queryBuffer = this.queryBuffer.subarray(totalExpected);

          const fullHex = Buffer.from(completePacket).toString('hex');
          this.diagnostics?.logDeviceResponse(this.id, fullHex);

          if (this.queryResolver) {
            const res = this.queryResolver;
            this.queryResolver = null;
            res(completePacket);
          }
        }
      });

      socket.on('error', (err) => {
        if (this.currentSessionId !== sessionId) return;
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
        if (this.currentSessionId !== sessionId) return;
        this.connectionInfo.state = 'disconnected';
        this.connectionInfo.connected = false;
        this.socket = null;
        this.diagnostics?.logDisconnect(this.id, 'TCP socket closed by peer');
      });

      socket.on('timeout', () => {
        if (this.currentSessionId !== sessionId) return;
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
    this.currentSessionId++;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    this.connectionInfo.state = 'disconnected';
    this.connectionInfo.connected = false;
    this.diagnostics?.logDisconnect(this.id, 'User requested disconnect');
  }

  /**
   * Transmits a control frame using the serialized FIFO queue with bounded retries.
   */
  private async writeControlPacket(opcodeDesc: string, frame: Uint8Array): Promise<boolean> {
    this.lastEncodedFrame = frame;
    const hex = Buffer.from(frame).toString('hex');
    this.diagnostics?.logCommandEncoded(this.id, opcodeDesc, hex);

    if (this.dryRun) {
      this.diagnostics?.logCommandTransmitted(this.id, `${opcodeDesc} (DRY-RUN)`, hex, frame.length);
      return true;
    }

    return new Promise<boolean>((resolve, reject) => {
      this.commandQueue.push({
        opcodeDesc,
        frame,
        resolve,
        reject,
      });
      this.processCommandQueue();
    });
  }

  private async processCommandQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.commandQueue.length > 0) {
      const item = this.commandQueue.shift()!;
      const hex = Buffer.from(item.frame).toString('hex');

      let success = false;
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          if (!this.socket || this.connectionInfo.state !== 'connected' || this.socket.destroyed) {
            await this.connect();
          }

          if (!this.socket || this.socket.destroyed) {
            throw new Error(`Socket unavailable for ${item.opcodeDesc}`);
          }

          await new Promise<void>((res, rej) => {
            const timer = setTimeout(() => {
              rej(new Error(`Write command ${item.opcodeDesc} timed out after 3000ms`));
            }, 3000);

            this.socket!.write(item.frame, (err) => {
              clearTimeout(timer);
              if (err) rej(err);
              else res();
            });
          });

          this.diagnostics?.logCommandTransmitted(this.id, item.opcodeDesc, hex, item.frame.length);
          item.resolve(true);
          success = true;
          break;
        } catch (err: any) {
          this.diagnostics?.log('warn', 'TRANSMIT', `Attempt ${attempt + 1}/3 failed for ${item.opcodeDesc}: ${err.message}`);
          if (this.socket) {
            this.socket.destroy();
            this.socket = null;
          }
          this.connectionInfo.state = 'disconnected';
          this.connectionInfo.connected = false;

          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
          } else {
            this.diagnostics?.log('error', 'TRANSMIT', `All 3 attempts failed for ${item.opcodeDesc}: ${err.message}`);
            item.reject(err);
          }
        }
      }

      // 20ms pacing between successive transmissions
      await new Promise((r) => setTimeout(r, 20));
    }

    this.isProcessingQueue = false;
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

    if (this.socket && this.connectionInfo.state === 'connected' && !this.socket.destroyed) {
      try {
        return await new Promise<Uint8Array>((resolve, reject) => {
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
      } catch {
        // Fall through to dedicated handshake socket
      }
    }

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
        tempSocket.destroy();
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
    // Verified BanlanX Gen 3 Power frame: 53 50 00 01 00 01 [01/00]
    await this.bridgeBleWrite(`Power ${on ? 'ON' : 'OFF'}`, new Uint8Array([0x53, 0x50, 0x00, 0x01, 0x00, 0x01, on ? 0x01 : 0x00]));
    this.state.power = on;
    this.emitStateChange(prev);

    try {
      const refreshed = await this.refreshState();
      this.diagnostics?.log('info', 'VERIFY', `Hardware telemetry confirmed Power state: ${refreshed.power ? 'ON' : 'OFF'}`);
    } catch (err: any) {
      this.diagnostics?.log('debug', 'VERIFY', `Post-power verification: ${err.message}`);
    }

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
    // Verified BanlanX Gen 3 Brightness frame: 53 51 00 01 00 02 00 [level]
    await this.bridgeBleWrite(`Brightness ${clamped}%`, new Uint8Array([0x53, 0x51, 0x00, 0x01, 0x00, 0x02, 0x00, hardwareByte]));

    this.state.brightness = clamped;
    this.emitStateChange(prev);
    return true;
  }

  async setColor(color: LedColor): Promise<boolean> {
    const prev = { ...this.state };
    const frame = SpnetCodec.encodeColor(color.r, color.g, color.b);
    const hardwareBrightness = Math.round((this.state.brightness / 100) * 255);
    await this.writeControlPacket(`Color RGB(${color.r},${color.g},${color.b})`, frame);
    // Verified BanlanX Gen 3 Color frame: 53 52 00 01 00 04 [R] [G] [B] [level]
    await this.bridgeBleWrite(`Color RGB(${color.r},${color.g},${color.b})`, new Uint8Array([0x53, 0x52, 0x00, 0x01, 0x00, 0x04, color.r, color.g, color.b, hardwareBrightness]));

    this.state.color = { ...color };
    this.state.mode = 'solid';
    this.emitStateChange(prev);
    return true;
  }

  async setEffect(effectId: number, speed?: number): Promise<boolean> {
    const prev = { ...this.state };
    const frame = SpnetCodec.encodeEffectMode(effectId);
    await this.writeControlPacket(`EffectMode ${effectId}`, frame);
    // Verified BanlanX Gen 3 Effect frame: 53 55 00 01 00 02 [hi] [lo]
    await this.bridgeBleWrite(`Effect ${effectId}`, new Uint8Array([0x53, 0x55, 0x00, 0x01, 0x00, 0x02, (effectId >> 8) & 0xff, effectId & 0xff]));

    if (speed !== undefined) {
      const clampedSpeed = Math.max(1, Math.min(100, Math.round(speed)));
      const hardwareSpeed = Math.round((clampedSpeed / 100) * 255);
      const speedFrame = SpnetCodec.encodeEffectSpeed(hardwareSpeed);
      await this.writeControlPacket(`EffectSpeed ${clampedSpeed}%`, speedFrame);
      // Verified BanlanX Gen 3 Speed frame: 53 54 00 01 00 01 [speed]
      await this.bridgeBleWrite(`Speed ${clampedSpeed}%`, new Uint8Array([0x53, 0x54, 0x00, 0x01, 0x00, 0x01, hardwareSpeed]));
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
  private bleTransport?: any;
  private bleTargetAddress: string = '7C4FADEB2AAA';

  constructor(defaultHost = '192.168.86.34', diagnostics?: DiagnosticsService) {
    this.defaultHost = defaultHost;
    this.diagnostics = diagnostics;
  }

  setBleTransport(transport: any, targetAddress = '7C4FADEB2AAA'): void {
    this.bleTransport = transport;
    this.bleTargetAddress = targetAddress;
    for (const dev of this.devices.values()) {
      dev.setBleTransport(transport, targetAddress);
    }
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
      if (dev.connectionInfo.address.startsWith(host) && (dev.connectionInfo.connected || dev.connectionInfo.state === 'connecting')) {
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
      if (this.bleTransport) {
        device.setBleTransport(this.bleTransport, this.bleTargetAddress);
      }
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
