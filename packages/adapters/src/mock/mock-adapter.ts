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

export class MockLedDevice implements ILedDevice {
  readonly id: string;
  readonly name: string;
  readonly family: DeviceFamily;
  readonly connectionInfo: ConnectionInfo;
  readonly capabilities: DeviceCapabilities;
  state: LedState;

  private stateListeners = new Set<(event: DeviceStateChangeEvent) => void>();
  private errorListeners = new Set<(event: DeviceErrorEvent) => void>();

  constructor(
    id: string,
    name: string,
    capabilities: Partial<DeviceCapabilities> = {},
    initialState?: Partial<LedState>,
    family: DeviceFamily = 'mock'
  ) {
    this.id = id;
    this.name = name;
    this.family = capabilities.family ?? family;

    this.capabilities = {
      family,
      supportsPower: capabilities.supportsPower ?? true,
      supportsBrightness: capabilities.supportsBrightness ?? true,
      brightnessRange: capabilities.brightnessRange ?? { min: 0, max: 100, safetyLimit: 20 },
      colorModes: capabilities.colorModes ?? ['rgb', 'rgbw'],
      supportsWhiteChannel: capabilities.supportsWhiteChannel ?? true,
      supportsColorTemperature: capabilities.supportsColorTemperature ?? true,
      supportsSegments: capabilities.supportsSegments ?? true,
      maxSegments: capabilities.maxSegments ?? 10,
      maxTotalPixels: capabilities.maxTotalPixels ?? 300,
      maxPixelCount: capabilities.maxPixelCount ?? capabilities.maxTotalPixels ?? 300,
      supportsICConfiguration: capabilities.supportsICConfiguration ?? false,
      supportsBuiltInEffects: capabilities.supportsBuiltInEffects ?? true,
      effectsList: capabilities.effectsList ?? [
        { id: 1, name: 'Rainbow Flow', category: 'dynamic', speedSupported: true },
        { id: 2, name: 'Breathe', category: 'ambient', speedSupported: true },
        { id: 3, name: 'Chase', category: 'dynamic', speedSupported: true },
        { id: 4, name: 'Fireplace', category: 'ambient', speedSupported: true },
      ],
      supportsSpeedControl: capabilities.supportsSpeedControl ?? true,
      supportsMusicReactive: capabilities.supportsMusicReactive ?? true,
      supportsTelemetry: true,
      ...capabilities,
    };

    this.connectionInfo = {
      transport: 'mock',
      address: `mock://${id}`,
      name,
      state: 'disconnected',
      connected: false,
      signalStrength: -45,
    };

    this.state = {
      power: initialState?.power ?? true,
      brightness: initialState?.brightness ?? 20,
      color: initialState?.color ?? { r: 255, g: 0, b: 128, hex: '#FF0080' },
      mode: initialState?.mode ?? 'solid',
      effectId: initialState?.effectId,
      effectSpeed: initialState?.effectSpeed ?? 50,
      activeSegments: initialState?.activeSegments ?? 1,
      segments: initialState?.segments ?? [
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
    const prev = { ...this.state };
    const min = this.capabilities.brightnessRange.min;
    const max = this.capabilities.brightnessRange.max;
    this.state.brightness = Math.max(min, Math.min(max, Math.round(brightness)));
    this.emitStateChange(prev);
    return true;
  }

  async setColor(color: LedColor): Promise<boolean> {
    if (this.connectionInfo.state !== 'connected') {
      this.emitError('ERR_NOT_CONNECTED', `Device ${this.name} is not connected`);
      throw new Error(`Device ${this.name} is not connected`);
    }
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
    const prev = { ...this.state };
    this.state.mode = 'effect';
    this.state.effectId = effectId;
    if (speed !== undefined) {
      this.state.effectSpeed = Math.max(1, Math.min(100, Math.round(speed)));
    }
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

  async setMusicMode(modeId: number, sensitivity?: number): Promise<boolean> {
    if (this.connectionInfo.state !== 'connected') {
      this.emitError('ERR_NOT_CONNECTED', `Device ${this.name} is not connected`);
      throw new Error(`Device ${this.name} is not connected`);
    }
    const prev = { ...this.state };
    this.state.mode = 'music';
    this.state.effectId = modeId;
    this.emitStateChange(prev);
    return true;
  }

  async refreshState(): Promise<LedState> {
    return { ...this.state };
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

export class MockAdapter implements ILedAdapter {
  readonly transportName: TransportType = 'mock';
  private devices = new Map<string, MockLedDevice>();
  private discovering: boolean = false;

  constructor(defaultDevices?: MockLedDevice[]) {
    const initial = defaultDevices ?? [
      new MockLedDevice('mock-sp530e', 'Simulated SP530E Controller', {
        family: 'sp530e',
        supportsICConfiguration: true,
        maxPixelCount: 1200,
        maxTotalPixels: 1200,
      }),
      new MockLedDevice('mock-dig2go-wled', 'Simulated QuinLED dig2go (WLED)', {
        family: 'wled',
        supportsICConfiguration: false,
        maxPixelCount: 300,
        maxTotalPixels: 300,
        maxSegments: 16,
      }),
    ];

    for (const d of initial) {
      this.devices.set(d.id, d);
    }
  }

  getDeviceById(id: string): MockLedDevice | undefined {
    return this.devices.get(id);
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
    return Array.from(this.devices.values()).filter((d) => d.connectionInfo.state === 'connected');
  }

  getDiscoveredDevices(): ILedDevice[] {
    return Array.from(this.devices.values());
  }

  addMockDevice(device: MockLedDevice): void {
    this.devices.set(device.id, device);
  }
}
