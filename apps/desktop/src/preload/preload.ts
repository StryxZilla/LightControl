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
  rescanDevices: () => ipcRenderer.invoke('devices:rescan'),
  stopDiscovery: () => ipcRenderer.invoke('discovery:stop'),
  addWledDevice: (host: string, port = 80, name?: string) =>
    ipcRenderer.invoke('device:add-wled', host, port, name),
  testConnection: (host: string, port = 8587) =>
    ipcRenderer.invoke('device:test-connection', host, port),
  updateDeviceConfig: (deviceId: string, config: any) =>
    ipcRenderer.invoke('device:update-config', deviceId, config),
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
  copyToClipboard: (text: string) => ipcRenderer.invoke('system:copy-clipboard', text),
  exportLogsTxt: (content: string) => ipcRenderer.invoke('diagnostics:export-txt', content),
  onDiagnosticLog: (callback) => {
    const handler = (_: IpcRendererEvent, log: any) => callback(log);
    ipcRenderer.on('diagnostics:new-log', handler);
    return () => ipcRenderer.removeListener('diagnostics:new-log', handler);
  },
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

  onDiscoveredAll: (callback: (devices: SerializedDevice[]) => void) => {
    const handler = (_: IpcRendererEvent, devices: SerializedDevice[]) => callback(devices);
    ipcRenderer.on('device:discovered-all', handler);
    return () => ipcRenderer.removeListener('device:discovered-all', handler);
  },
};

contextBridge.exposeInMainWorld('api', api);
