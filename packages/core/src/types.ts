/**
 * Universal LED Hardware Abstraction Layer & Core Types
 * 
 * Provides unified, capability-driven interfaces for all LED controller adapters
 * (SP530E BLE, SP530E Wi-Fi, WLED / dig2go, and Mock / Simulator).
 */

export type DeviceFamily = 'sp530e' | 'wled' | 'mock';

export type TransportType = 'ble' | 'wifi-tcp' | 'wifi-http' | 'websocket' | 'mock';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'reconnecting' | 'error';

export type LedColorMode = 'rgb' | 'rgbw' | 'rgbcct' | 'cct' | 'white';

export interface LedColor {
  r: number; // 0 - 255
  g: number; // 0 - 255
  b: number; // 0 - 255
  w?: number; // 0 - 255 (for RGBW / White channels)
  cct?: number; // Color temperature in Kelvin (e.g. 2700-6500) or 0-255 warm/cool ratio
  hex?: string; // Standard formatted uppercase hex string (e.g. '#FF5500')
}

export interface EffectDescriptor {
  id: number;
  name: string;
  category?: string;
  speedSupported?: boolean;
  intensitySupported?: boolean;
  directionSupported?: boolean;
}

export interface SegmentConfig {
  id: number;
  start: number;
  stop: number;
  length: number;
  color?: LedColor;
  effectId?: number;
  speed?: number;
  on?: boolean;
}

export interface FirmwareInfo {
  version: string;
  build?: string;
  model: string;
  targetChip?: string;
  ip?: string;
  mac?: string;
}

export interface DeviceCapabilities {
  family: DeviceFamily;
  supportsPower: boolean;
  supportsBrightness: boolean;
  brightnessRange: {
    min: number;
    max: number;
    safetyLimit: number; // Software safety limit (e.g. 20% on test setups)
  };
  colorModes: LedColorMode[];
  supportsWhiteChannel: boolean;
  supportsColorTemperature: boolean;
  colorTempRange?: {
    minKelvin: number;
    maxKelvin: number;
  };
  supportsSegments: boolean;
  maxSegments: number;
  maxTotalPixels: number;
  maxPixelCount?: number; // Legacy alias for maxTotalPixels
  supportsICConfiguration?: boolean;
  supportedICTypes?: string[];
  supportsBuiltInEffects: boolean;
  effectsList: EffectDescriptor[];
  supportsSpeedControl: boolean;
  supportsMusicReactive: boolean;
  musicReactiveSources?: ('device_mic' | 'system_audio' | 'player')[];
  supportsTelemetry: boolean;
  firmwareInfo?: FirmwareInfo;
}

export interface LedState {
  power: boolean;
  brightness: number; // 0 - 100 (%)
  color: LedColor;
  mode: 'solid' | 'effect' | 'music';
  effectId?: number;
  effectSpeed?: number; // 1 - 100 (%)
  activeSegments?: number;
  segments?: SegmentConfig[];
}

export interface ConnectionInfo {
  transport: TransportType;
  address: string; // MAC address, IP:Port, or virtual identifier
  name: string;
  state: ConnectionState;
  connected?: boolean; // Legacy/convenience boolean
  signalStrength?: number; // RSSI in dBm
  lastConnectedAt?: number;
  disconnectReason?: string;
}

export interface DeviceStateChangeEvent {
  deviceId: string;
  state: LedState;
  previousState?: Partial<LedState>;
  timestamp: number;
}

export interface DeviceErrorEvent {
  deviceId: string;
  code: string;
  message: string;
  timestamp: number;
  recoverable: boolean;
}

export interface ILedDevice {
  readonly id: string;
  readonly name: string;
  readonly family: DeviceFamily;
  readonly connectionInfo: ConnectionInfo;
  readonly capabilities: DeviceCapabilities;
  readonly state: LedState;

  connect(): Promise<boolean>;
  disconnect(): Promise<void>;

  setPower(on: boolean): Promise<boolean>;
  setBrightness(brightness: number): Promise<boolean>;
  setColor(color: LedColor): Promise<boolean>;
  setEffect(effectId: number, speed?: number): Promise<boolean>;
  setSegments?(segments: SegmentConfig[]): Promise<boolean>;
  setMusicMode?(modeId: number, sensitivity?: number): Promise<boolean>;

  refreshState(): Promise<LedState>;

  onStateChange(listener: (event: DeviceStateChangeEvent) => void): () => void;
  onError(listener: (event: DeviceErrorEvent) => void): () => void;
}

export interface ILedAdapter {
  readonly transportName: TransportType;
  startDiscovery(onDeviceFound: (device: ILedDevice) => void): Promise<void>;
  stopDiscovery(): Promise<void>;
  getConnectedDevices(): ILedDevice[];
  getDiscoveredDevices(): ILedDevice[];
}
