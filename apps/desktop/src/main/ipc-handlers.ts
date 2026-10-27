import { ipcMain, BrowserWindow } from 'electron';
import { DeviceManager } from '../../../../packages/core/src/device-manager.ts';
import { PresetManager, DEFAULT_PRESETS, type Preset } from '../../../../packages/core/src/presets.ts';
import { MockAdapter } from '../../../../packages/adapters/src/mock/mock-adapter.ts';
import { SP530EWiFiAdapter } from '../../../../packages/adapters/src/sp530e/sp530e-wifi-adapter.ts';
import { SP530EBleAdapter } from '../../../../packages/adapters/src/sp530e/sp530e-ble-adapter.ts';
import { WledAdapter } from '../../../../packages/adapters/src/wled/wled-adapter.ts';
import type { SerializedDevice, AppSettings } from '../preload/types.ts';
import type {
  ILedDevice,
  LedColor,
  SegmentConfig,
  DeviceFamily,
} from '../../../../packages/core/src/types.ts';

export class AppIpcManager {
  private deviceManager: DeviceManager;
  private presetManager: PresetManager;
  private mockAdapter: MockAdapter;
  private wifiAdapter: SP530EWiFiAdapter;
  private bleAdapter: SP530EBleAdapter;
  private wledAdapter: WledAdapter;

  private settings: AppSettings = {
    dryRun: true, // Safe default
    safetyBrightnessLimit: 20,
    autoConnectLastDevice: true,
    theme: 'dark',
    wifiHost: '192.168.86.34',
    wifiPort: 8587,
  };

  private logs: Array<{ level: string; message: string; timestamp: number }> = [];

  constructor() {
    this.deviceManager = new DeviceManager();
    this.presetManager = new PresetManager(DEFAULT_PRESETS);

    // Initialize adapters
    this.mockAdapter = new MockAdapter();
    this.wifiAdapter = new SP530EWiFiAdapter();
    this.bleAdapter = new SP530EBleAdapter();
    this.wledAdapter = new WledAdapter();

    // Register adapters into DeviceManager DI container
    this.deviceManager.registerAdapter(this.mockAdapter);
    this.deviceManager.registerAdapter(this.wifiAdapter);
    this.deviceManager.registerAdapter(this.bleAdapter);
    this.deviceManager.registerAdapter(this.wledAdapter);

    this.deviceManager.setDryRun(this.settings.dryRun);
    this.log('INFO', 'Registered all adapters: mock, sp530e (wifi/ble), wled.');
  }

  public registerHandlers(mainWindow: BrowserWindow): void {
    // Forward state updates to renderer
    this.deviceManager.getStateManager().subscribe((event) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('device:state-changed', event);
      }
    });

    // Forward error events to renderer
    this.deviceManager.getStateManager().subscribeErrors((event) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('device:error', event);
      }
    });

    // IPC Handlers
    ipcMain.handle('devices:get-all', async () => {
      return this.serializeDevices(this.deviceManager.getDiscoveredDevices());
    });

    ipcMain.handle('discovery:start', async () => {
      this.log('INFO', 'Starting discovery across all registered adapters...');
      await this.deviceManager.startDiscovery();
      return this.serializeDevices(this.deviceManager.getDiscoveredDevices());
    });

    ipcMain.handle('discovery:stop', async () => {
      this.log('INFO', 'Stopping discovery...');
      await this.deviceManager.stopDiscovery();
    });

    ipcMain.handle('device:add-wled', async (_, host: string, port = 80, name?: string) => {
      this.log('INFO', `Registering manual WLED device: ${host}:${port}`);
      const dev = this.wledAdapter.addDevice(host, port, name || `QuinLED dig2go (${host})`);
      this.deviceManager.registerDevice(dev);
      return this.serializeDevices([dev])[0]!;
    });

    ipcMain.handle('device:connect', async (_, deviceId: string) => {
      this.log('INFO', `Connecting to device: ${deviceId}`);
      try {
        const ok = await this.deviceManager.connectDevice(deviceId, 4000);
        this.log('INFO', `Device ${deviceId} connected: ${ok}`);
        return ok;
      } catch (err: any) {
        this.log('ERROR', `Failed connecting to ${deviceId}: ${err.message}`);
        throw err;
      }
    });

    ipcMain.handle('device:disconnect', async (_, deviceId: string) => {
      this.log('INFO', `Disconnecting device: ${deviceId}`);
      await this.deviceManager.disconnectDevice(deviceId);
    });

    ipcMain.handle('device:set-power', async (_, deviceId: string, on: boolean) => {
      const dev = this.deviceManager.getDevice(deviceId);
      if (!dev) throw new Error(`Device not found: ${deviceId}`);
      return this.deviceManager.getRateLimiter().execute(deviceId, () => dev.setPower(on));
    });

    ipcMain.handle('device:set-brightness', async (_, deviceId: string, brightness: number) => {
      const dev = this.deviceManager.getDevice(deviceId);
      if (!dev) throw new Error(`Device not found: ${deviceId}`);
      // Enforce configured safety limit
      const clamped = Math.min(brightness, this.settings.safetyBrightnessLimit);
      return this.deviceManager.getRateLimiter().execute(deviceId, () => dev.setBrightness(clamped));
    });

    ipcMain.handle('device:set-color', async (_, deviceId: string, color: LedColor) => {
      const dev = this.deviceManager.getDevice(deviceId);
      if (!dev) throw new Error(`Device not found: ${deviceId}`);
      return this.deviceManager.getRateLimiter().execute(deviceId, () => dev.setColor(color));
    });

    ipcMain.handle('device:set-effect', async (_, deviceId: string, effectId: number, speed?: number) => {
      const dev = this.deviceManager.getDevice(deviceId);
      if (!dev) throw new Error(`Device not found: ${deviceId}`);
      return this.deviceManager.getRateLimiter().execute(deviceId, () => dev.setEffect(effectId, speed));
    });

    ipcMain.handle('device:set-music-mode', async (_, deviceId: string, modeId: number, sensitivity?: number) => {
      const dev = this.deviceManager.getDevice(deviceId);
      if (!dev) throw new Error(`Device not found: ${deviceId}`);
      if (dev.setMusicMode) {
        return this.deviceManager.getRateLimiter().execute(deviceId, () => dev.setMusicMode!(modeId, sensitivity));
      }
      return false;
    });

    ipcMain.handle('device:set-segments', async (_, deviceId: string, segments: SegmentConfig[]) => {
      const dev = this.deviceManager.getDevice(deviceId);
      if (!dev) throw new Error(`Device not found: ${deviceId}`);
      if (dev.setSegments) {
        return this.deviceManager.getRateLimiter().execute(deviceId, () => dev.setSegments!(segments));
      }
      return false;
    });

    ipcMain.handle('presets:get-all', async (_, family?: DeviceFamily) => {
      return this.presetManager.getPresets(family);
    });

    ipcMain.handle('presets:save', async (_, preset: Preset) => {
      this.presetManager.savePreset(preset);
      this.log('INFO', `Saved preset: ${preset.name}`);
    });

    ipcMain.handle('presets:delete', async (_, presetId: string) => {
      const ok = this.presetManager.deletePreset(presetId);
      this.log('INFO', `Deleted preset ${presetId}: ${ok}`);
      return ok;
    });

    ipcMain.handle('presets:apply', async (_, deviceId: string, presetId: string) => {
      this.log('INFO', `Applying preset ${presetId} to device ${deviceId}`);
      return this.presetManager.applyPreset(deviceId, presetId, this.deviceManager);
    });

    ipcMain.handle('diagnostics:get', async () => {
      return {
        version: '0.1.0',
        platform: process.platform,
        uptimeSec: Math.round(process.uptime()),
        logs: [...this.logs],
      };
    });

    ipcMain.handle('settings:get', async () => {
      return { ...this.settings };
    });

    ipcMain.handle('settings:update', async (_, newSettings: Partial<AppSettings>) => {
      this.settings = { ...this.settings, ...newSettings };
      if (newSettings.dryRun !== undefined) {
        this.deviceManager.setDryRun(newSettings.dryRun);
      }
      this.log('INFO', `Updated settings: dryRun=${this.settings.dryRun}, safetyLimit=${this.settings.safetyBrightnessLimit}%`);
      return { ...this.settings };
    });
  }

  private serializeDevices(devices: ILedDevice[]): SerializedDevice[] {
    return devices.map((d) => ({
      id: d.id,
      name: d.name,
      family: d.family,
      connectionInfo: { ...d.connectionInfo },
      capabilities: { ...d.capabilities },
      state: { ...d.state },
    }));
  }

  private log(level: string, message: string): void {
    this.logs.push({ level, message, timestamp: Date.now() });
    if (this.logs.length > 300) this.logs.shift();
  }
}
