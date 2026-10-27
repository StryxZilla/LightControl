import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { ElectronApi, SerializedDevice, AppSettings } from './types.ts';
import type {
  LedColor,
  SegmentConfig,
  DeviceFamily,
  DeviceStateChangeEvent,
  DeviceErrorEvent,
} from '../../../../packages/core/src/types.ts';
import type { Preset } from '../../../../packages/core/src/presets.ts';

const api: ElectronApi = {
  getDevices: () => ipcRenderer.invoke('devices:get-all'),
  startDiscovery: () => ipcRenderer.invoke('discovery:start'),
  stopDiscovery: () => ipcRenderer.invoke('discovery:stop'),
  connectDevice: (deviceId: string) => ipcRenderer.invoke('device:connect', deviceId),
  disconnectDevice: (deviceId: string) => ipcRenderer.invoke('device:disconnect', deviceId),
  setPower: (deviceId: string, on: boolean) => ipcRenderer.invoke('device:set-power', deviceId, on),
  setBrightness: (deviceId: string, brightness: number) =>
    ipcRenderer.invoke('device:set-brightness', deviceId, brightness),
  setColor: (deviceId: string, color: LedColor) =>
    ipcRenderer.invoke('device:set-color', deviceId, color),
  setEffect: (deviceId: string, effectId: number, speed?: number) =>
    ipcRenderer.invoke('device:set-effect', deviceId, effectId, speed),
  setMusicMode: (deviceId: string, modeId: number, sensitivity?: number) =>
    ipcRenderer.invoke('device:set-music-mode', deviceId, modeId, sensitivity),
  setSegments: (deviceId: string, segments: SegmentConfig[]) =>
    ipcRenderer.invoke('device:set-segments', deviceId, segments),

  getPresets: (family?: DeviceFamily) => ipcRenderer.invoke('presets:get-all', family),
  savePreset: (preset: Preset) => ipcRenderer.invoke('presets:save', preset),
  deletePreset: (presetId: string) => ipcRenderer.invoke('presets:delete', presetId),
  applyPreset: (deviceId: string, presetId: string) =>
    ipcRenderer.invoke('presets:apply', deviceId, presetId),

  getDiagnostics: () => ipcRenderer.invoke('diagnostics:get'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: Partial<AppSettings>) =>
    ipcRenderer.invoke('settings:update', settings),

  onStateChange: (callback: (event: DeviceStateChangeEvent) => void) => {
    const handler = (_: IpcRendererEvent, event: DeviceStateChangeEvent) => callback(event);
    ipcRenderer.on('device:state-changed', handler);
    return () => ipcRenderer.removeListener('device:state-changed', handler);
  },

  onError: (callback: (event: DeviceErrorEvent) => void) => {
    const handler = (_: IpcRendererEvent, event: DeviceErrorEvent) => callback(event);
    ipcRenderer.on('device:error', handler);
    return () => ipcRenderer.removeListener('device:error', handler);
  },
};

contextBridge.exposeInMainWorld('api', api);
