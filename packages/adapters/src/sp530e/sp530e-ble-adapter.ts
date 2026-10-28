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
  Sp530eBleCodec,
  SP530E_BLE_SERVICE_UUID,
  SP530E_BLE_CHARACTERISTIC_UUID,
  SP530E_MODEL_ID,
} from './sp530e-ble-codec.ts';
import { SP530E_DEFAULT_EFFECTS } from './sp530e-wifi-adapter.ts';
import type { Sp530eWindowsBleTransport } from './sp530e-windows-ble-transport.ts';
import type { DiagnosticsService } from '../../../core/src/diagnostics.ts';

export interface BleDeviceOptions {
  name?: string;
  dryRun?: boolean;
  rssi?: number;
  transport?: Sp530eWindowsBleTransport;
  diagnostics?: DiagnosticsService;
}

export class SP530EBleDevice implements ILedDevice {
  readonly id: string;
  readonly name: string;
  readonly family: DeviceFamily = 'sp530e';
  readonly connectionInfo: ConnectionInfo;
  readonly capabilities: DeviceCapabilities;
  state: LedState;

  public dryRun: boolean;
  public enforceSafetyLimits: boolean = true;
  public safetyBrightnessLimit: number = 20;
  public lastEncodedFrame: Uint8Array | null = null;

  private transport?: Sp530eWindowsBleTransport;
  private diagnostics?: DiagnosticsService;
  private stateListeners = new Set<(event: DeviceStateChangeEvent) => void>();
  private errorListeners = new Set<(event: DeviceErrorEvent) => void>();
  private sequenceNumber: number = 0;

  constructor(address: string, options: BleDeviceOptions = {}) {
    const cleanAddress = address.replace(/[:-]/g, '').toLowerCase();
    this.id = `sp530e-ble-${cleanAddress}`;
    this.name = options.name ?? `SP530E (${address})`;
    this.dryRun = options.dryRun ?? true;
    this.transport = options.transport;
    this.diagnostics = options.diagnostics;

    this.connectionInfo = {
      transport: 'ble',
      address,
      name: this.name,
      state: 'disconnected',
      connected: false,
      signalStrength: options.rssi ?? -65,
    };

    this.capabilities = {
      family: 'sp530e',
      supportsPower: true,
      supportsBrightness: true,
      brightnessRange: { min: 0, max: 100, safetyLimit: 20 },
      colorModes: ['rgb', 'rgbw'],
      supportsWhiteChannel: true,
      supportsColorTemperature: true,
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
      musicReactiveSources: ['device_mic', 'player'],
      supportsTelemetry: true,
      firmwareInfo: {
        version: 'BLE-GATT',
        model: `SP530E (ID: 0x${SP530E_MODEL_ID.toString(16)})`,
        mac: address,
      },
    };

    this.state = {
      power: true,
      brightness: 20,
      color: { r: 255, g: 0, b: 0, hex: '#FF0000' },
      mode: 'solid',
      effectId: 0,
      effectSpeed: 50,
      activeSegments: 1,
      segments: [
        { id: 0, start: 0, stop: 60, length: 60, on: true },
      ],
    };
  }

  setTransport(transport: Sp530eWindowsBleTransport): void {
    this.transport = transport;
  }

  setDiagnostics(diag: DiagnosticsService): void {
    this.diagnostics = diag;
  }

  setSafetyLimits(enforce: boolean, limit = 20): void {
    for (const dev of this.devices.values()) {
      dev.enforceSafetyLimits = enforce;
      dev.safetyBrightnessLimit = limit;
      dev.capabilities.brightnessRange.safetyLimit = enforce ? limit : 100;
    }
  }

  async connect(): Promise<boolean> {
    this.connectionInfo.state = 'connecting';
    this.diagnostics?.logConnectionAttempt(this.id, 'ble', this.connectionInfo.address);

    if (this.dryRun) {
      this.connectionInfo.state = 'connected';
      this.connectionInfo.connected = true;
      this.connectionInfo.lastConnectedAt = Date.now();
      this.diagnostics?.logConnectionResult(this.id, true, 'ble (dry-run)');
      return true;
    }

    if (this.transport) {
      try {
        const ok = await this.transport.connect(this.connectionInfo.address, 5000);
        this.connectionInfo.state = ok ? 'connected' : 'error';
        this.connectionInfo.connected = ok;
        if (ok) this.connectionInfo.lastConnectedAt = Date.now();
        this.diagnostics?.logConnectionResult(this.id, ok, 'ble');
        return ok;
      } catch (err: any) {
        this.connectionInfo.state = 'error';
        this.connectionInfo.connected = false;
        const msg = err.message.includes('not found') || err.message.includes('FAILED')
          ? `${err.message} (Note: If BanlanX is open on your mobile phone, please force-close BanlanX to release the controller's single-client BLE lock).`
          : err.message;
        this.diagnostics?.logConnectionResult(this.id, false, 'ble', msg);
        this.emitError('ERR_BLE_CONNECT', msg);
        throw new Error(msg);
      }
    }

    this.connectionInfo.state = 'connected';
    this.connectionInfo.connected = true;
    this.connectionInfo.lastConnectedAt = Date.now();
    return true;
  }

  async disconnect(): Promise<void> {
    if (this.transport && !this.dryRun) {
      try {
        await this.transport.disconnect();
      } catch {}
    }
    this.connectionInfo.state = 'disconnected';
    this.connectionInfo.connected = false;
    this.diagnostics?.logDisconnect(this.id, 'BLE disconnect requested');
  }

  private async writeBleFrame(opcodeDesc: string, frame: Uint8Array, altFrame?: Uint8Array): Promise<boolean> {
    this.lastEncodedFrame = frame;
    const hex = Buffer.from(frame).toString('hex');
    this.diagnostics?.logCommandEncoded(this.id, opcodeDesc, hex);

    if (this.dryRun) {
      this.diagnostics?.logCommandTransmitted(this.id, `${opcodeDesc} (DRY-RUN)`, hex, frame.length);
      return true;
    }

    if (this.transport) {
      await this.transport.writeBytes(frame, 3000);
      if (altFrame) {
        await this.transport.writeBytes(altFrame, 2000);
      }
      this.diagnostics?.logCommandTransmitted(this.id, opcodeDesc, hex, frame.length);
      return true;
    }

    return true;
  }

  async setPower(on: boolean): Promise<boolean> {
    if (this.connectionInfo.state !== 'connected' && !this.dryRun) {
      await this.connect();
    }

    const frame = Sp530eBleCodec.encodePower(on, this.nextSequence());
    // Verified BanlanX Gen 3 Power frame: 53 50 00 01 00 01 [01/00]
    const gen3Frame = new Uint8Array([0x53, 0x50, 0x00, 0x01, 0x00, 0x01, on ? 0x01 : 0x00]);
    await this.writeBleFrame(`BLE Power ${on ? 'ON' : 'OFF'}`, frame, gen3Frame);

    const prev = { ...this.state };
    this.state.power = on;
    this.emitStateChange(prev);
    return true;
  }

  async setBrightness(brightness: number): Promise<boolean> {
    if (this.connectionInfo.state !== 'connected' && !this.dryRun) {
      await this.connect();
    }

    const prev = { ...this.state };
    const min = this.capabilities.brightnessRange.min;
    const max = this.enforceSafetyLimits
      ? (this.safetyBrightnessLimit || this.capabilities.brightnessRange.safetyLimit || 20)
      : this.capabilities.brightnessRange.max;
    const clamped = Math.max(min, Math.min(max, Math.round(brightness)));
    const hardwareByte = Math.round((clamped / 100) * 255);

    const frame = Sp530eBleCodec.encodeBrightness(hardwareByte, this.nextSequence());
    // Verified BanlanX Gen 3 Brightness frame: 53 51 00 01 00 02 00 [level]
    const gen3Frame = new Uint8Array([0x53, 0x51, 0x00, 0x01, 0x00, 0x02, 0x00, hardwareByte]);
    await this.writeBleFrame(`BLE Brightness ${clamped}% (0x${hardwareByte.toString(16)})`, frame, gen3Frame);

    this.state.brightness = clamped;
    this.emitStateChange(prev);
    return true;
  }

  async setColor(color: LedColor): Promise<boolean> {
    if (this.connectionInfo.state !== 'connected' && !this.dryRun) {
      await this.connect();
    }

    const prev = { ...this.state };
    const frame = Sp530eBleCodec.encodeColor(color.r, color.g, color.b, this.nextSequence());
    const hardwareBrightness = Math.round((this.state.brightness / 100) * 255);
    // Verified BanlanX Gen 3 Color frame: 53 52 00 01 00 04 [R] [G] [B] [level]
    const gen3Frame = new Uint8Array([0x53, 0x52, 0x00, 0x01, 0x00, 0x04, color.r, color.g, color.b, hardwareBrightness]);
    await this.writeBleFrame(`BLE Color RGB(${color.r},${color.g},${color.b})`, frame, gen3Frame);

    this.state.color = { ...color };
    this.state.mode = 'solid';
    this.emitStateChange(prev);
    return true;
  }

  async setEffect(effectId: number, speed?: number): Promise<boolean> {
    if (this.connectionInfo.state !== 'connected' && !this.dryRun) {
      await this.connect();
    }

    const prev = { ...this.state };
    if (speed !== undefined) {
      const speedFrame = Sp530eBleCodec.encodeEffectSpeed(speed, this.nextSequence());
      const gen3Speed = new Uint8Array([0x53, 0x54, 0x00, 0x01, 0x00, 0x01, Math.round(speed)]);
      await this.writeBleFrame(`BLE EffectSpeed ${speed}%`, speedFrame, gen3Speed);
      this.state.effectSpeed = speed;
    }

    const frame = Sp530eBleCodec.encodeEffectMode(effectId, this.nextSequence());
    const gen3Mode = new Uint8Array([0x53, 0x55, 0x00, 0x01, 0x00, 0x02, (effectId >> 8) & 0xff, effectId & 0xff]);
    await this.writeBleFrame(`BLE Effect ${effectId}`, frame, gen3Mode);

    this.state.mode = 'effect';
    this.state.effectId = effectId;
    this.emitStateChange(prev);
    return true;
  }

  async setMusicMode(modeId: number, sensitivity?: number): Promise<boolean> {
    if (this.connectionInfo.state !== 'connected' && !this.dryRun) {
      await this.connect();
    }

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

  handleNotification(frame: Uint8Array): void {
    try {
      const decoded = Sp530eBleCodec.decodeNotification(frame);
      if (decoded) {
        const prev = { ...this.state };
        if (decoded.power !== undefined) this.state.power = decoded.power;
        if (decoded.brightness !== undefined) this.state.brightness = decoded.brightness;
        if (decoded.color !== undefined) this.state.color = { ...decoded.color };
        if (decoded.mode !== undefined) this.state.mode = decoded.mode;
        if (decoded.effectId !== undefined) this.state.effectId = decoded.effectId;
        if (decoded.effectSpeed !== undefined) this.state.effectSpeed = decoded.effectSpeed;
        this.emitStateChange(prev);
      }
    } catch (err: any) {
      this.emitError('ERR_BLE_DECODE', err.message);
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

  private nextSequence(): number {
    this.sequenceNumber = (this.sequenceNumber + 1) & 0xff;
    return this.sequenceNumber;
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

export class SP530EBleAdapter implements ILedAdapter {
  readonly transportName: TransportType = 'ble';
  public readonly serviceUuid = SP530E_BLE_SERVICE_UUID;
  public readonly characteristicUuid = SP530E_BLE_CHARACTERISTIC_UUID;

  public dryRun: boolean = true;
  private transport?: Sp530eWindowsBleTransport;
  private diagnostics?: DiagnosticsService;
  private devices = new Map<string, SP530EBleDevice>();
  private discovering: boolean = false;

  constructor(initialDevices?: SP530EBleDevice[], transport?: Sp530eWindowsBleTransport, diagnostics?: DiagnosticsService) {
    this.transport = transport;
    this.diagnostics = diagnostics;

    if (initialDevices) {
      for (const d of initialDevices) {
        this.devices.set(d.id, d);
      }
    } else {
      // Default pre-registered target controller so it is ALWAYS available in device selector
      const defaultDev = new SP530EBleDevice('7C4FADEB2AAA', {
        name: 'SP530E Controller (BLE - 7C4FADEB2AAA)',
        transport: this.transport,
        diagnostics: this.diagnostics,
        dryRun: this.dryRun,
      });
      this.devices.set(defaultDev.id, defaultDev);
    }
  }

  setTransport(t: Sp530eWindowsBleTransport): void {
    this.transport = t;
    for (const dev of this.devices.values()) {
      dev.setTransport(t);
    }
  }

  setDiagnostics(diag: DiagnosticsService): void {
    this.diagnostics = diag;
    for (const dev of this.devices.values()) {
      dev.setDiagnostics(diag);
    }
  }

  setSafetyLimits(enforce: boolean, limit = 20): void {
    for (const dev of this.devices.values()) {
      dev.enforceSafetyLimits = enforce;
      dev.safetyBrightnessLimit = limit;
      dev.capabilities.brightnessRange.safetyLimit = enforce ? limit : 100;
    }
  }

  async startDiscovery(onDeviceFound: (device: ILedDevice) => void): Promise<void> {
    this.discovering = true;
    this.diagnostics?.logScan('START', 'ble');

    // First yield any registered devices
    for (const dev of this.devices.values()) {
      onDeviceFound(dev);
    }

    if (this.dryRun || !this.transport) {
      this.diagnostics?.logScan('STOP', 'ble (dry-run/mock)');
      return;
    }

    try {
      const discovered = await this.transport.discover(5000);
      for (const d of discovered) {
        if (!this.discovering) break;
        let dev = this.devices.get(d.id);
        if (!dev) {
          dev = new SP530EBleDevice(d.address, {
            name: d.name,
            rssi: d.rssi,
            dryRun: this.dryRun,
            transport: this.transport,
            diagnostics: this.diagnostics,
          });
          this.devices.set(d.id, dev);
        }
        dev.connectionInfo.state = 'discovered';
        dev.connectionInfo.lastSeen = Date.now();
        this.diagnostics?.logDeviceDiscovered({
          id: dev.id,
          name: dev.name,
          transport: 'ble',
          address: dev.connectionInfo.address,
          rssi: dev.connectionInfo.signalStrength,
        });
        onDeviceFound(dev);
      }
    } catch (err: any) {
      this.diagnostics?.log('warn', 'SCAN', `BLE discovery scan failed: ${err.message}`);
    }

    this.diagnostics?.logScan('STOP', 'ble');
    this.discovering = false;
  }

  async stopDiscovery(): Promise<void> {
    this.discovering = false;
    this.diagnostics?.logScan('STOP', 'ble');
  }

  getConnectedDevices(): ILedDevice[] {
    return Array.from(this.devices.values()).filter(
      (d) => d.connectionInfo.state === 'connected' || d.connectionInfo.connected
    );
  }

  getDiscoveredDevices(): ILedDevice[] {
    return Array.from(this.devices.values());
  }

  addDiscoveredDevice(device: SP530EBleDevice): void {
    this.devices.set(device.id, device);
  }

  getDeviceById(id: string): SP530EBleDevice | undefined {
    return this.devices.get(id);
  }
}
