/**
 * Universal LED Device Interface & Capability Schema
 * 
 * Defines the contract for all hardware adapters (SP530E BLE, SP530E Wi-Fi, WLED, Mock).
 */

export type LedColorMode = 'rgb' | 'rgbw' | 'rgbcct' | 'cct' | 'white';

export interface DeviceCapabilities {
  supportsPower: boolean;
  colorModes: LedColorMode[];
  supportsBrightness: boolean;
  supportsICConfiguration: boolean;
  supportedICTypes?: string[];
  supportsSegments: boolean;
  maxSegments?: number;
  supportsBuiltInEffects: boolean;
  effectsList?: Array<{ id: number; name: string; category?: string }>;
  supportsSpeedControl: boolean;
  supportsMusicReactive: boolean;
  supportsTelemetry: boolean;
  maxPixelCount?: number;
}

export interface LedColor {
  r: number; // 0 - 255
  g: number; // 0 - 255
  b: number; // 0 - 255
  w?: number; // 0 - 255 (for RGBW / White)
  cct?: number; // Color temperature in Kelvin or 0-255 scale
}

export interface LedState {
  power: boolean;
  brightness: number; // 0 - 100 (%)
  color: LedColor;
  mode: 'solid' | 'effect' | 'music';
  effectId?: number;
  effectSpeed?: number; // 1 - 100 (%)
  activeSegments?: number;
}

export interface ConnectionInfo {
  transport: 'ble' | 'wifi-tcp' | 'wifi-http' | 'mock';
  address: string; // MAC address or IP address or virtual identifier
  name: string;
  connected: boolean;
  signalStrength?: number; // RSSI in dBm
}

export interface ILedDevice {
  readonly id: string;
  readonly name: string;
  readonly connectionInfo: ConnectionInfo;
  readonly capabilities: DeviceCapabilities;
  readonly state: LedState;

  connect(): Promise<boolean>;
  disconnect(): Promise<void>;

  setPower(on: boolean): Promise<boolean>;
  setBrightness(brightness: number): Promise<boolean>;
  setColor(color: LedColor): Promise<boolean>;
  setEffect(effectId: number, speed?: number): Promise<boolean>;
  setMusicMode(modeId: number, sensitivity?: number): Promise<boolean>;
  refreshState(): Promise<LedState>;
}

export interface ILedAdapter {
  readonly transportName: string;
  startDiscovery(onDeviceFound: (device: ILedDevice) => void): Promise<void>;
  stopDiscovery(): Promise<void>;
  getConnectedDevices(): ILedDevice[];
}
