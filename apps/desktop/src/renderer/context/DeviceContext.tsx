import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { SerializedDevice, AppSettings } from '../../preload/types.ts';
import type { LedColor, SegmentConfig, DeviceFamily } from '../../../../../packages/core/src/types.ts';
import type { Preset } from '../../../../../packages/core/src/presets.ts';

interface DeviceContextType {
  devices: SerializedDevice[];
  selectedDevice: SerializedDevice | null;
  selectedDeviceId: string | null;
  setSelectedDeviceId: (id: string | null) => void;
  activeScreen: string;
  setActiveScreen: (screen: string) => void;
  presets: Preset[];
  settings: AppSettings;
  isScanning: boolean;
  statusMessage: string | null;
  startDiscovery: () => Promise<void>;
  rescanDevices: () => Promise<void>;
  stopDiscovery: () => Promise<void>;
  addWledDevice: (host: string, port?: number, name?: string) => Promise<void>;
  testConnection: (host: string, port?: number) => Promise<{ success: boolean; latencyMs?: number; message: string; firmware?: string; pixels?: number }>;
  updateDeviceConfig: (deviceId: string, config: { name?: string; host?: string; port?: number; icType?: string; pixelCount?: number; channelOrder?: string }) => Promise<void>;
  connectDevice: (deviceId: string) => Promise<boolean>;
  disconnectDevice: (deviceId: string) => Promise<void>;
  setPower: (on: boolean) => Promise<boolean>;
  setBrightness: (brightness: number) => Promise<boolean>;
  setColor: (color: LedColor) => Promise<boolean>;
  setEffect: (effectId: number, speed?: number) => Promise<boolean>;
  setMusicMode: (modeId: number, sensitivity?: number) => Promise<boolean>;
  setSegments: (segments: SegmentConfig[]) => Promise<boolean>;
  savePreset: (preset: Preset) => Promise<void>;
  deletePreset: (presetId: string) => Promise<boolean>;
  applyPreset: (presetId: string) => Promise<boolean>;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  dryRun: true,
  enforceSafetyBrightness: true,
  safetyBrightnessLimit: 20,
  enforceRateLimiting: true,
  autoConnectLastDevice: true,
  theme: 'dark',
  wifiHost: '192.168.86.34',
  wifiPort: 8587,
};

const INITIAL_FALLBACK_DEVICES: SerializedDevice[] = [
  {
    id: 'sp530e-ble-7c4fadeb2aaa',
    name: 'SP530E Controller (BLE - 7C4FADEB2AAA)',
    family: 'sp530e',
    connectionInfo: {
      transport: 'ble',
      address: '7C4FADEB2AAA',
      name: 'SP530E Controller (BLE - 7C4FADEB2AAA)',
      state: 'disconnected',
      connected: false,
      signalStrength: -65,
    },
    capabilities: {
      family: 'sp530e',
      supportsPower: true,
      supportsBrightness: true,
      brightnessRange: { min: 0, max: 100, safetyLimit: 20 },
      colorModes: ['rgb'],
      supportsWhiteChannel: false,
      supportsColorTemperature: false,
      supportsSegments: false,
      maxSegments: 1,
      maxTotalPixels: 60,
      supportsICConfiguration: false,
      supportsBuiltInEffects: true,
      effectsList: [
        { id: 1, name: 'Rainbow Flow', speedSupported: true },
        { id: 2, name: 'Color Chase', speedSupported: true },
        { id: 3, name: 'Breathing', speedSupported: true },
      ],
      supportsSpeedControl: true,
      supportsMusicReactive: true,
      supportsTelemetry: false,
    },
    state: {
      power: true,
      brightness: 20,
      color: { r: 255, g: 0, b: 128, hex: '#FF0080' },
      mode: 'solid',
      effectId: 1,
      effectSpeed: 50,
      activeSegments: 1,
    },
  },
  {
    id: 'sp530e-wifi-192-168-86-34',
    name: 'SP530E Controller (Living Room)',
    family: 'sp530e',
    connectionInfo: {
      transport: 'wifi-tcp',
      address: '192.168.86.34:8587',
      name: 'SP530E Controller (Living Room)',
      state: 'disconnected',
      connected: false,
      signalStrength: -52,
    },
    capabilities: {
      family: 'sp530e',
      supportsPower: true,
      supportsBrightness: true,
      brightnessRange: { min: 0, max: 100, safetyLimit: 20 },
      colorModes: ['rgb'],
      supportsWhiteChannel: false,
      supportsColorTemperature: false,
      supportsSegments: true,
      maxSegments: 5,
      maxTotalPixels: 60,
      supportsICConfiguration: true,
      supportedICTypes: ['WS2812B', 'WS2811', 'SK6812', 'UCS1903'],
      supportsBuiltInEffects: true,
      effectsList: [
        { id: 1, name: 'Rainbow Flow', speedSupported: true },
        { id: 2, name: 'Color Chase', speedSupported: true },
        { id: 3, name: 'Breathing', speedSupported: true },
        { id: 4, name: 'Meteor Rain', speedSupported: true },
        { id: 5, name: 'Fire Flicker', speedSupported: true },
        { id: 6, name: 'Color Wave', speedSupported: true },
      ],
      supportsSpeedControl: true,
      supportsMusicReactive: true,
      supportsTelemetry: true,
      firmwareInfo: { version: 'V2.0.13', model: 'SP530E', ip: '192.168.86.34' },
    },
    state: {
      power: true,
      brightness: 20,
      color: { r: 255, g: 0, b: 128, hex: '#FF0080' },
      mode: 'solid',
      effectId: 1,
      effectSpeed: 50,
      activeSegments: 1,
      segments: [{ id: 0, start: 0, stop: 60, length: 60, on: true }],
    },
  },
  {
    id: 'mock-dig2go-wled',
    name: 'QuinLED dig2go (Office Desk)',
    family: 'wled',
    connectionInfo: {
      transport: 'wifi-http',
      address: 'http://192.168.86.50:80',
      name: 'QuinLED dig2go (Office Desk)',
      state: 'disconnected',
      connected: false,
      signalStrength: -48,
    },
    capabilities: {
      family: 'wled',
      supportsPower: true,
      supportsBrightness: true,
      brightnessRange: { min: 0, max: 100, safetyLimit: 100 },
      colorModes: ['rgb', 'rgbw'],
      supportsWhiteChannel: true,
      supportsColorTemperature: true,
      supportsSegments: true,
      maxSegments: 16,
      maxTotalPixels: 300,
      supportsBuiltInEffects: true,
      effectsList: [
        { id: 0, name: 'Solid' },
        { id: 1, name: 'Blink' },
        { id: 2, name: 'Breathe' },
        { id: 9, name: 'Rainbow' },
        { id: 38, name: 'Fire 2012' },
      ],
      supportsSpeedControl: true,
      supportsMusicReactive: true,
      supportsTelemetry: true,
    },
    state: {
      power: false,
      brightness: 20,
      color: { r: 0, g: 255, b: 200, hex: '#00FFC8' },
      mode: 'solid',
      effectId: 0,
      effectSpeed: 50,
      activeSegments: 1,
    },
  },
];

const INITIAL_FALLBACK_PRESETS: Preset[] = [
  {
    id: 'preset-warm-white-safe',
    name: 'Warm White (20% Safe)',
    tags: ['reading', 'cozy', 'safe'],
    state: {
      power: true,
      brightness: 20,
      color: { r: 255, g: 180, b: 60, cct: 2700, hex: '#FFB43C' },
      mode: 'solid',
    },
    createdAt: 1700000000000,
  },
  {
    id: 'preset-cool-white',
    name: 'Daylight Cool White (20%)',
    tags: ['work', 'focus'],
    state: {
      power: true,
      brightness: 20,
      color: { r: 255, g: 255, b: 255, cct: 6500, hex: '#FFFFFF' },
      mode: 'solid',
    },
    createdAt: 1700000000000,
  },
  {
    id: 'preset-cyberpunk-cyan',
    name: 'Cyberpunk Cyan',
    tags: ['ambient', 'gaming'],
    state: {
      power: true,
      brightness: 20,
      color: { r: 0, g: 255, b: 200, hex: '#00FFC8' },
      mode: 'solid',
    },
    createdAt: 1700000000000,
  },
  {
    id: 'preset-rainbow-flow',
    name: 'Rainbow Wave Effect',
    tags: ['dynamic', 'party'],
    state: {
      power: true,
      brightness: 20,
      mode: 'effect',
      effectId: 1,
      effectSpeed: 50,
    },
    createdAt: 1700000000000,
  },
];

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<SerializedDevice[]>(INITIAL_FALLBACK_DEVICES);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(INITIAL_FALLBACK_DEVICES[0]!.id);
  const [activeScreen, setActiveScreen] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      return window.location.hash.replace('#', '') || 'dashboard';
    }
    return 'dashboard';
  });

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) setActiveScreen(hash);
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);
  const [presets, setPresets] = useState<Preset[]>(INITIAL_FALLBACK_PRESETS);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) ?? devices[0] ?? null;

  // Sync with Electron IPC if running in Electron
  useEffect(() => {
    if (window.api) {
      window.api.getDevices().then((devs) => {
        if (devs && devs.length > 0) {
          setDevices(devs);
          const target = devs.find((d) => d.connectionInfo.transport === 'ble') || devs[0]!;
          setSelectedDeviceId(target.id);
          window.api.getSettings().then((s) => {
            if (s?.autoConnectLastDevice !== false) {
              connectDevice(target.id).catch(() => {});
            }
          });
        }
      });

      window.api.getPresets().then((p) => {
        if (p && p.length > 0) setPresets(p);
      });

      window.api.getSettings().then((s) => {
        if (s) setSettings(s);
      });

      const unsubState = window.api.onStateChange((event) => {
        setDevices((prev) =>
          prev.map((d) => (d.id === event.deviceId ? { ...d, state: { ...event.state } } : d))
        );
      });

      const unsubErr = window.api.onError((err) => {
        setStatusMessage(`Error: ${err.message}`);
        setTimeout(() => setStatusMessage(null), 5000);
      });

      const unsubDiscoveredAll = window.api.onDiscoveredAll?.((devs) => {
        if (devs && devs.length > 0) {
          setDevices(devs);
        }
      });

      return () => {
        unsubState();
        unsubErr();
        unsubDiscoveredAll?.();
      };
    }
  }, []);

  const startDiscovery = useCallback(async () => {
    setIsScanning(true);
    setStatusMessage('Scanning for controllers...');
    if (window.api) {
      try {
        await window.api.startDiscovery();
        const devs = await window.api.getDevices();
        setDevices(devs);
        setStatusMessage(`Discovered ${devs.length} device(s)`);
      } catch (err: any) {
        setStatusMessage(`Discovery error: ${err.message}`);
      } finally {
        setIsScanning(false);
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } else {
      setTimeout(() => {
        setIsScanning(false);
        setStatusMessage(null);
      }, 1000);
    }
  }, []);

  const rescanDevices = useCallback(async () => {
    setIsScanning(true);
    setStatusMessage('Performing fresh controller rescan...');
    if (window.api) {
      try {
        if (window.api.rescanDevices) {
          const devs = await window.api.rescanDevices();
          setDevices(devs);
          setStatusMessage(`Rescan complete: ${devs.length} controller(s) found`);
        } else {
          await window.api.startDiscovery();
          const devs = await window.api.getDevices();
          setDevices(devs);
          setStatusMessage(`Discovered ${devs.length} controller(s)`);
        }
      } catch (err: any) {
        setStatusMessage(`Rescan error: ${err.message}`);
      } finally {
        setIsScanning(false);
        setTimeout(() => setStatusMessage(null), 4000);
      }
    } else {
      setTimeout(() => {
        setIsScanning(false);
        setStatusMessage(null);
      }, 1000);
    }
  }, []);

  const stopDiscovery = useCallback(async () => {
    setIsScanning(false);
    if (window.api) {
      await window.api.stopDiscovery();
    }
  }, []);

  const addWledDevice = useCallback(async (host: string, port = 80, name?: string) => {
    if (window.api && window.api.addWledDevice) {
      const dev = await window.api.addWledDevice(host, port, name);
      const all = await window.api.getDevices();
      setDevices(all);
      setSelectedDeviceId(dev.id);
      return;
    }
    const id = `wled-${host.replace(/\./g, '-')}`;
    const newDev: SerializedDevice = {
      id,
      name: name || `QuinLED dig2go (${host})`,
      family: 'wled',
      connectionInfo: {
        transport: 'wifi-http',
        address: `http://${host}:${port}`,
        name: name || `QuinLED dig2go (${host})`,
        state: 'disconnected',
      },
      capabilities: {
        family: 'wled',
        supportsPower: true,
        supportsBrightness: true,
        brightnessRange: { min: 0, max: 100, safetyLimit: 100 },
        colorModes: ['rgb', 'rgbw'],
        supportsWhiteChannel: true,
        supportsColorTemperature: true,
        supportsSegments: true,
        maxSegments: 16,
        maxTotalPixels: 300,
        supportsBuiltInEffects: true,
        effectsList: [
          { id: 0, name: 'Solid' },
          { id: 1, name: 'Blink' },
          { id: 9, name: 'Rainbow' },
        ],
        supportsSpeedControl: true,
        supportsMusicReactive: true,
        supportsTelemetry: true,
      },
      state: {
        power: true,
        brightness: 20,
        color: { r: 255, g: 160, b: 50, hex: '#FFA032' },
        mode: 'solid',
        effectId: 0,
        effectSpeed: 50,
      },
    };
    setDevices((prev) => (prev.some((d) => d.id === id) ? prev : [...prev, newDev]));
    setSelectedDeviceId(id);
  }, []);

  const testConnection = useCallback(async (host: string, port = 8587) => {
    if (window.api && window.api.testConnection) {
      return await window.api.testConnection(host, port);
    }
    return { success: true, latencyMs: 45, message: `Simulated connection to ${host}:${port} OK` };
  }, []);

  const updateDeviceConfig = useCallback(async (deviceId: string, config: { name?: string; host?: string; port?: number; icType?: string; pixelCount?: number; channelOrder?: string }) => {
    if (window.api && window.api.updateDeviceConfig) {
      await window.api.updateDeviceConfig(deviceId, config);
      const devs = await window.api.getDevices();
      setDevices(devs);
      return;
    }
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId
          ? {
              ...d,
              name: config.name || d.name,
              capabilities: {
                ...d.capabilities,
                maxTotalPixels: config.pixelCount || d.capabilities.maxTotalPixels,
                maxPixelCount: config.pixelCount || d.capabilities.maxPixelCount,
              },
            }
          : d
      )
    );
  }, []);

  const connectDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    if (window.api) {
      const ok = await window.api.connectDevice(deviceId);
      const devs = await window.api.getDevices();
      setDevices(devs);
      return ok;
    }
    // Browser fallback
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId
          ? { ...d, connectionInfo: { ...d.connectionInfo, state: 'connected', connected: true } }
          : d
      )
    );
    return true;
  }, []);

  const disconnectDevice = useCallback(async (deviceId: string) => {
    if (window.api) {
      await window.api.disconnectDevice(deviceId);
      const devs = await window.api.getDevices();
      setDevices(devs);
      return;
    }
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId
          ? { ...d, connectionInfo: { ...d.connectionInfo, state: 'disconnected', connected: false } }
          : d
      )
    );
  }, []);

  const setPower = useCallback(async (on: boolean): Promise<boolean> => {
    if (!selectedDevice) return false;
    if (window.api) {
      return await window.api.setPower(selectedDevice.id, on);
    }
    // Optimistic fallback
    setDevices((prev) =>
      prev.map((d) => (d.id === selectedDevice.id ? { ...d, state: { ...d.state, power: on } } : d))
    );
    return true;
  }, [selectedDevice]);

  const setBrightness = useCallback(async (brightness: number): Promise<boolean> => {
    if (!selectedDevice) return false;
    const limit = selectedDevice.capabilities.brightnessRange.safetyLimit || settings.safetyBrightnessLimit;
    const clamped = Math.min(brightness, limit);

    if (window.api) {
      return await window.api.setBrightness(selectedDevice.id, clamped);
    }
    setDevices((prev) =>
      prev.map((d) => (d.id === selectedDevice.id ? { ...d, state: { ...d.state, brightness: clamped } } : d))
    );
    return true;
  }, [selectedDevice, settings.safetyBrightnessLimit]);

  const setColor = useCallback(async (color: LedColor): Promise<boolean> => {
    if (!selectedDevice) return false;
    if (window.api) {
      return await window.api.setColor(selectedDevice.id, color);
    }
    setDevices((prev) =>
      prev.map((d) =>
        d.id === selectedDevice.id
          ? { ...d, state: { ...d.state, color: { ...color }, mode: 'solid' } }
          : d
      )
    );
    return true;
  }, [selectedDevice]);

  const setEffect = useCallback(async (effectId: number, speed?: number): Promise<boolean> => {
    if (!selectedDevice) return false;
    if (window.api) {
      return await window.api.setEffect(selectedDevice.id, effectId, speed);
    }
    setDevices((prev) =>
      prev.map((d) =>
        d.id === selectedDevice.id
          ? {
              ...d,
              state: {
                ...d.state,
                mode: 'effect',
                effectId,
                effectSpeed: speed ?? d.state.effectSpeed,
              },
            }
          : d
      )
    );
    return true;
  }, [selectedDevice]);

  const setMusicMode = useCallback(async (modeId: number, sensitivity?: number): Promise<boolean> => {
    if (!selectedDevice) return false;
    if (window.api) {
      return await window.api.setMusicMode(selectedDevice.id, modeId, sensitivity);
    }
    setDevices((prev) =>
      prev.map((d) =>
        d.id === selectedDevice.id ? { ...d, state: { ...d.state, mode: 'music', effectId: modeId } } : d
      )
    );
    return true;
  }, [selectedDevice]);

  const setSegments = useCallback(async (segments: SegmentConfig[]): Promise<boolean> => {
    if (!selectedDevice) return false;
    if (window.api) {
      return await window.api.setSegments(selectedDevice.id, segments);
    }
    setDevices((prev) =>
      prev.map((d) => (d.id === selectedDevice.id ? { ...d, state: { ...d.state, segments } } : d))
    );
    return true;
  }, [selectedDevice]);

  const savePreset = useCallback(async (preset: Preset) => {
    if (window.api) {
      await window.api.savePreset(preset);
      const p = await window.api.getPresets();
      setPresets(p);
    } else {
      setPresets((prev) => [...prev.filter((p) => p.id !== preset.id), preset]);
    }
  }, []);

  const deletePreset = useCallback(async (presetId: string): Promise<boolean> => {
    if (window.api) {
      const ok = await window.api.deletePreset(presetId);
      const p = await window.api.getPresets();
      setPresets(p);
      return ok;
    }
    setPresets((prev) => prev.filter((p) => p.id !== presetId));
    return true;
  }, []);

  const applyPreset = useCallback(async (presetId: string): Promise<boolean> => {
    if (!selectedDevice) return false;
    if (window.api) {
      return await window.api.applyPreset(selectedDevice.id, presetId);
    }
    const found = presets.find((p) => p.id === presetId);
    if (found) {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === selectedDevice.id
            ? { ...d, state: { ...d.state, ...found.state } }
            : d
        )
      );
      return true;
    }
    return false;
  }, [selectedDevice, presets]);

  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>) => {
    if (window.api) {
      const updated = await window.api.updateSettings(newSettings);
      setSettings(updated);
    } else {
      setSettings((prev) => ({ ...prev, ...newSettings }));
    }
  }, []);

  return (
    <DeviceContext.Provider
      value={{
        devices,
        selectedDevice,
        selectedDeviceId,
        setSelectedDeviceId,
        activeScreen,
        setActiveScreen,
        presets,
        settings,
        isScanning,
        statusMessage,
        startDiscovery,
        rescanDevices,
        stopDiscovery,
        addWledDevice,
        testConnection,
        updateDeviceConfig,
        connectDevice,
        disconnectDevice,
        setPower,
        setBrightness,
        setColor,
        setEffect,
        setMusicMode,
        setSegments,
        savePreset,
        deletePreset,
        applyPreset,
        updateSettings,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevice = () => {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDevice must be used within a DeviceProvider');
  return ctx;
};
