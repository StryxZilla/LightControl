import type {
  ILedDevice,
  LedState,
  LedColor,
  SegmentConfig,
  DeviceCapabilities,
  DeviceStateChangeEvent,
  DeviceErrorEvent,
  DeviceFamily,
  ConnectionInfo,
} from '../../../../packages/core/src/types.ts';
import type { Preset } from '../../../../packages/core/src/presets.ts';

export interface SerializedDevice {
  id: string;
  name: string;
  family: DeviceFamily;
  connectionInfo: ConnectionInfo;
  capabilities: DeviceCapabilities;
  state: LedState;
}

export interface AppSettings {
  dryRun: boolean;
  enforceSafetyBrightness: boolean;
  safetyBrightnessLimit: number;
  enforceRateLimiting: boolean;
  autoConnectLastDevice: boolean;
  theme: 'dark' | 'light' | 'system';
  wifiHost: string;
  wifiPort: number;
}

export interface DiagnosticLogItem {
  timestamp: number;
  isoTime?: string;
  level: string;
  category: string;
  action?: string;
  deviceId?: string;
  transport?: string;
  message: string;
  data?: any;
}

export interface ElectronApi {
  getDevices(): Promise<SerializedDevice[]>;
  startDiscovery(): Promise<SerializedDevice[]>;
  rescanDevices?(): Promise<SerializedDevice[]>;
  stopDiscovery(): Promise<void>;
  addWledDevice?(host: string, port?: number, name?: string): Promise<SerializedDevice>;
  testConnection?(host: string, port?: number): Promise<{ success: boolean; latencyMs?: number; message: string; firmware?: string; pixels?: number }>;
  updateDeviceConfig?(deviceId: string, config: { name?: string; host?: string; port?: number; icType?: string; pixelCount?: number; channelOrder?: string }): Promise<SerializedDevice>;
  connectDevice(deviceId: string): Promise<boolean>;
  disconnectDevice(deviceId: string): Promise<void>;
  setPower(deviceId: string, on: boolean): Promise<boolean>;
  setBrightness(deviceId: string, brightness: number): Promise<boolean>;
  setColor(deviceId: string, color: LedColor): Promise<boolean>;
  setEffect(deviceId: string, effectId: number, speed?: number): Promise<boolean>;
  setMusicMode(deviceId: string, modeId: number, sensitivity?: number): Promise<boolean>;
  setSegments(deviceId: string, segments: SegmentConfig[]): Promise<boolean>;
  getPresets(family?: DeviceFamily): Promise<Preset[]>;
  savePreset(preset: Preset): Promise<void>;
  deletePreset(presetId: string): Promise<boolean>;
  applyPreset(deviceId: string, presetId: string): Promise<boolean>;
  getDiagnostics(): Promise<{
    version: string;
    platform: string;
    uptimeSec: number;
    logFilePath?: string | null;
    logs: DiagnosticLogItem[];
  }>;
  copyToClipboard?(text: string): Promise<boolean>;
  exportLogsTxt?(content: string): Promise<{ success: boolean; filePath?: string }>;
  onDiagnosticLog?(callback: (log: DiagnosticLogItem) => void): () => void;
  getSettings(): Promise<AppSettings>;
  updateSettings(settings: Partial<AppSettings>): Promise<AppSettings>;
  onStateChange(callback: (event: DeviceStateChangeEvent) => void): () => void;
  onError(callback: (event: DeviceErrorEvent) => void): () => void;
  onDiscoveredAll?(callback: (devices: SerializedDevice[]) => void): () => void;
}

declare global {
  interface Window {
    api?: ElectronApi;
  }
}
