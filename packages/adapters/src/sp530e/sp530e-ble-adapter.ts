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

export interface BleDeviceOptions {
  name?: string;
  dryRun?: boolean;
  rssi?: number;
}

export class SP530EBleDevice implements ILedDevice {
  readonly id: string;
  readonly name: string;
  readonly family: DeviceFamily = 'sp530e';
  readonly connectionInfo: ConnectionInfo;
  readonly capabilities: DeviceCapabilities;
  state: LedState;

  public dryRun: boolean;
  public lastEncodedFrame: Uint8Array | null = null;

  private stateListeners = new Set<(event: DeviceStateChangeEvent) => void>();
  private errorListeners = new Set<(event: DeviceErrorEvent) => void>();
  private sequenceNumber: number = 0;

  constructor(address: string, options: BleDeviceOptions = {}) {
    const cleanAddress = address.replace(/[:-]/g, '').toLowerCase();
    this.id = `sp530e-ble-${cleanAddress}`;
    this.name = options.name ?? `SP530E (${address})`;
    this.dryRun = options.dryRun ?? true;

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

  async connect(): Promise<boolean> {
    this.connectionInfo.state = 'connected';
    this.connectionInfo.connected = true;
    this.connectionInfo.lastConnectedAt = Date.now();
    return true;
  }

  async disconnect(): Promise<void> {
    this.connectionInfo.state = 'disconnected';
    this.connectionInfo.connected = false;
  }

  async setPower(on: boolean): Promise<boolean> {
    if (this.connectionInfo.state !== 'connected') {
      this.emitError('ERR_NOT_CONNECTED', `Device ${this.name} is not connected`);
      throw new Error(`Device ${this.name} is not connected`);
    }

    const frame = Sp530eBleCodec.encodePower(on, this.nextSequence());
    this.lastEncodedFrame = frame;

    const prev = { ...this.state };
    this.state.power = on;
    this.emitStateChange(prev);
    return true;
  }

  async setBrightness(brightness: number): Promise<boolean> {
    if (this.connectionInfo.state !== 'connected') {
      this.emitError('ERR_NOT_CONNECTED', `Device ${this.name} is not connected`);
      throw new Error(`Device ${this.name} is not connected`);
    }

    const min = this.capabilities.brightnessRange.min;
    const max = this.capabilities.brightnessRange.max;
    const clamped = Math.max(min, Math.min(max, Math.round(brightness)));

    // Scale 0-100% to 0-255 for protocol frame
    const rawVal = Math.round((clamped / 100) * 255);
    const frame = Sp530eBleCodec.encodeBrightness(rawVal, this.nextSequence());
    this.lastEncodedFrame = frame;

    const prev = { ...this.state };
    this.state.brightness = clamped;
    this.emitStateChange(prev);
    return true;
  }

  async setColor(color: LedColor): Promise<boolean> {
    if (this.connectionInfo.state !== 'connected') {
      this.emitError('ERR_NOT_CONNECTED', `Device ${this.name} is not connected`);
      throw new Error(`Device ${this.name} is not connected`);
    }

    const frame = Sp530eBleCodec.encodeColor(color.r, color.g, color.b, this.nextSequence());
    this.lastEncodedFrame = frame;

    const prev = { ...this.state };
    this.state.color = { ...color };
    this.state.mode = 'solid';
    this.emitStateChange(prev);
    return true;
  }

  async setEffect(effectId: number, speed?: number): Promise<boolean> {
    if (this.connectionInfo.state !== 'connected') {
      this.emitError('ERR_NOT_CONNECTED', `Device ${this.name} is not connected`);
      throw new Error(`Device ${this.name} is not connected`);
    }

    const frame = Sp530eBleCodec.encodeEffectMode(effectId, this.nextSequence());
    this.lastEncodedFrame = frame;

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
    if (this.connectionInfo.state !== 'connected') {
      this.emitError('ERR_NOT_CONNECTED', `Device ${this.name} is not connected`);
      throw new Error(`Device ${this.name} is not connected`);
    }

    const frame = Sp530eBleCodec.encodeMusicMode(modeId, this.nextSequence());
    this.lastEncodedFrame = frame;

    const prev = { ...this.state };
    this.state.mode = 'music';
    this.state.effectId = modeId;
    this.emitStateChange(prev);
    return true;
  }

  async setSegments(segments: SegmentConfig[]): Promise<boolean> {
    if (this.connectionInfo.state !== 'connected') {
      this.emitError('ERR_NOT_CONNECTED', `Device ${this.name} is not connected`);
      throw new Error(`Device ${this.name} is not connected`);
    }

    const prev = { ...this.state };
    this.state.segments = [...segments];
    this.state.activeSegments = segments.length;
    this.emitStateChange(prev);
    return true;
  }

  async refreshState(): Promise<LedState> {
    return { ...this.state };
  }

  /**
   * Ingests a raw BLE notification packet from the controller (characteristic 0xFFE1).
   */
  public handleNotification(rawBytes: Uint8Array): void {
    const parsed = Sp530eBleCodec.decodeNotification(rawBytes);
    if (parsed) {
      const prev = { ...this.state };
      if (parsed.power !== undefined) this.state.power = parsed.power;
      if (parsed.brightness !== undefined) this.state.brightness = parsed.brightness;
      if (parsed.color !== undefined) this.state.color = { ...parsed.color };
      if (parsed.mode !== undefined) this.state.mode = parsed.mode;
      if (parsed.effectId !== undefined) this.state.effectId = parsed.effectId;
      if (parsed.effectSpeed !== undefined) this.state.effectSpeed = parsed.effectSpeed;
      this.emitStateChange(prev);
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

  private devices = new Map<string, SP530EBleDevice>();
  private discovering: boolean = false;

  constructor(initialDevices?: SP530EBleDevice[]) {
    if (initialDevices) {
      for (const d of initialDevices) {
        this.devices.set(d.id, d);
      }
    }
  }

  async startDiscovery(onDeviceFound: (device: ILedDevice) => void): Promise<void> {
    this.discovering = true;
    for (const dev of this.devices.values()) {
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

  addDiscoveredDevice(device: SP530EBleDevice): void {
    this.devices.set(device.id, device);
  }

  getDeviceById(id: string): SP530EBleDevice | undefined {
    return this.devices.get(id);
  }
}
