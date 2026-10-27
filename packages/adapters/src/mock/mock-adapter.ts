import type {
  ILedDevice,
  ILedAdapter,
  DeviceCapabilities,
  LedState,
  LedColor,
  ConnectionInfo,
} from '../../../packages/core/src/types.ts';

export class MockLedDevice implements ILedDevice {
  readonly id: string;
  readonly name: string;
  readonly connectionInfo: ConnectionInfo;
  readonly capabilities: DeviceCapabilities;
  state: LedState;

  private connected: boolean = false;

  constructor(
    id: string,
    name: string,
    capabilities: DeviceCapabilities,
    initialState?: Partial<LedState>,
    transport: 'mock' = 'mock'
  ) {
    this.id = id;
    this.name = name;
    this.capabilities = capabilities;
    this.connectionInfo = {
      transport,
      address: `mock://${id}`,
      name,
      connected: false,
      signalStrength: -45,
    };
    this.state = {
      power: initialState?.power ?? true,
      brightness: initialState?.brightness ?? 80,
      color: initialState?.color ?? { r: 255, g: 0, b: 128 },
      mode: initialState?.mode ?? 'solid',
      effectId: initialState?.effectId,
      effectSpeed: initialState?.effectSpeed ?? 50,
      activeSegments: initialState?.activeSegments ?? 1,
    };
  }

  async connect(): Promise<boolean> {
    this.connected = true;
    this.connectionInfo.connected = true;
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.connectionInfo.connected = false;
  }

  async setPower(on: boolean): Promise<boolean> {
    if (!this.connected) throw new Error(`Device ${this.name} is not connected`);
    this.state.power = on;
    return true;
  }

  async setBrightness(brightness: number): Promise<boolean> {
    if (!this.connected) throw new Error(`Device ${this.name} is not connected`);
    this.state.brightness = Math.max(0, Math.min(100, brightness));
    return true;
  }

  async setColor(color: LedColor): Promise<boolean> {
    if (!this.connected) throw new Error(`Device ${this.name} is not connected`);
    this.state.color = { ...color };
    this.state.mode = 'solid';
    return true;
  }

  async setEffect(effectId: number, speed?: number): Promise<boolean> {
    if (!this.connected) throw new Error(`Device ${this.name} is not connected`);
    this.state.mode = 'effect';
    this.state.effectId = effectId;
    if (speed !== undefined) {
      this.state.effectSpeed = Math.max(1, Math.min(100, speed));
    }
    return true;
  }

  async setMusicMode(modeId: number, sensitivity?: number): Promise<boolean> {
    if (!this.connected) throw new Error(`Device ${this.name} is not connected`);
    this.state.mode = 'music';
    this.state.effectId = modeId;
    return true;
  }

  async refreshState(): Promise<LedState> {
    return { ...this.state };
  }
}

export class MockAdapter implements ILedAdapter {
  readonly transportName = 'mock';
  private devices: MockLedDevice[] = [];
  private discovering: boolean = false;

  constructor() {
    this.initializeDefaultMockDevices();
  }

  private initializeDefaultMockDevices() {
    // 1. Mock SP530E with WS2812B (matching user's actual hardware)
    const sp530e = new MockLedDevice(
      'mock-sp530e',
      'SP530E Virtual Controller',
      {
        supportsPower: true,
        colorModes: ['rgb'],
        supportsBrightness: true,
        supportsICConfiguration: true,
        supportedICTypes: ['WS2812B', 'WS2811', 'SK6812', 'UCS1903'],
        supportsSegments: true,
        maxSegments: 5,
        supportsBuiltInEffects: true,
        effectsList: [
          { id: 1, name: 'Rainbow Flow', category: 'Dynamic' },
          { id: 2, name: 'Color Chase', category: 'Dynamic' },
          { id: 3, name: 'Breathing', category: 'Static' },
        ],
        supportsSpeedControl: true,
        supportsMusicReactive: true,
        supportsTelemetry: true,
        maxPixelCount: 1200,
      },
      {
        power: true,
        brightness: 100,
        color: { r: 255, g: 255, b: 255 },
        mode: 'solid',
      }
    );

    // 2. Mock QuinLED dig2go running WLED
    const dig2go = new MockLedDevice(
      'mock-dig2go-wled',
      'QuinLED dig2go WLED Virtual',
      {
        supportsPower: true,
        colorModes: ['rgb', 'rgbw'],
        supportsBrightness: true,
        supportsICConfiguration: false,
        supportsSegments: true,
        maxSegments: 16,
        supportsBuiltInEffects: true,
        effectsList: [
          { id: 0, name: 'Solid', category: 'Basic' },
          { id: 1, name: 'Blink', category: 'Basic' },
          { id: 2, name: 'Breathe', category: 'Basic' },
          { id: 3, name: 'Wipe', category: 'Dynamic' },
          { id: 9, name: 'Rainbow', category: 'Dynamic' },
          { id: 15, name: 'Fire 2012', category: 'Complex' },
        ],
        supportsSpeedControl: true,
        supportsMusicReactive: true,
        supportsTelemetry: true,
        maxPixelCount: 300,
      },
      {
        power: true,
        brightness: 75,
        color: { r: 0, g: 150, b: 255 },
        mode: 'solid',
      }
    );

    this.devices = [sp530e, dig2go];
  }

  async startDiscovery(onDeviceFound: (device: ILedDevice) => void): Promise<void> {
    this.discovering = true;
    for (const dev of this.devices) {
      if (!this.discovering) break;
      onDeviceFound(dev);
    }
  }

  async stopDiscovery(): Promise<void> {
    this.discovering = false;
  }

  getConnectedDevices(): ILedDevice[] {
    return this.devices.filter(d => d.connectionInfo.connected);
  }

  getDeviceById(id: string): MockLedDevice | undefined {
    return this.devices.find(d => d.id === id);
  }
}
