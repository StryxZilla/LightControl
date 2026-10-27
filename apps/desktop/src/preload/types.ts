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
  safetyBrightnessLimit: number;
  autoConnectLastDevice: boolean;
  theme: 'dark' | 'light' | 'system';
  wifiHost: string;
  wifiPort: number;
}

export interface ElectronApi {
  getDevices(): Promise<SerializedDevice[]>;
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  addWledDevice?(host: string, port?: number, name?: string): Promise<SerializedDevice>;
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
    logs: Array<{ level: string; message: string; timestamp: number }>;
  }>;
  getSettings(): Promise<AppSettings>;
  updateSettings(settings: Partial<AppSettings>): Promise<AppSettings>;
  onStateChange(callback: (event: DeviceStateChangeEvent) => void): () => void;
  onError(callback: (event: DeviceErrorEvent) => void): () => void;
}

declare global {
  interface Window {
    api?: ElectronApi;
  }
}
