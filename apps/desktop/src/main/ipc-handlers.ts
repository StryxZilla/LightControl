import { ipcMain, BrowserWindow, app } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as net from 'node:net';
import { DeviceManager } from '../../../../packages/core/src/device-manager.ts';
import { PresetManager, DEFAULT_PRESETS, type Preset } from '../../../../packages/core/src/presets.ts';
import { MockAdapter } from '../../../../packages/adapters/src/mock/mock-adapter.ts';
import { SP530EWiFiAdapter } from '../../../../packages/adapters/src/sp530e/sp530e-wifi-adapter.ts';
import { SP530EBleAdapter } from '../../../../packages/adapters/src/sp530e/sp530e-ble-adapter.ts';
import { Sp530eWindowsBleTransport } from '../../../../packages/adapters/src/sp530e/sp530e-windows-ble-transport.ts';
import { SpnetCodec } from '../../../../packages/adapters/src/sp530e/spnet-codec.ts';
import { WledAdapter } from '../../../../packages/adapters/src/wled/wled-adapter.ts';
import { DiagnosticsService } from '../../../../packages/core/src/diagnostics.ts';
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
  private diagnostics: DiagnosticsService;
  private mockAdapter: MockAdapter;
  private wifiAdapter: SP530EWiFiAdapter;
  private bleAdapter: SP530EBleAdapter;
  private bleTransport: Sp530eWindowsBleTransport;
  private wledAdapter: WledAdapter;

  private settings: AppSettings = {
    dryRun: true, // Safe default on first run
    safetyBrightnessLimit: 20,
    autoConnectLastDevice: true,
    theme: 'dark',
    wifiHost: '192.168.86.34',
    wifiPort: 8587,
  };

  constructor() {
    this.deviceManager = new DeviceManager();
    this.presetManager = new PresetManager(DEFAULT_PRESETS);

    // Initialize stable persistent diagnostics log file in %APPDATA%\LightControl\logs\diagnostic.log
    const logFilePath = this.getLogFilePath();
    this.diagnostics = new DiagnosticsService(1000, logFilePath);

    this.loadSettings();

    // Initialize adapters
    this.mockAdapter = new MockAdapter();
    this.wifiAdapter = new SP530EWiFiAdapter(this.settings.wifiHost, this.diagnostics);
    this.wifiAdapter.dryRun = this.settings.dryRun;

    this.bleTransport = new Sp530eWindowsBleTransport({ dryRun: this.settings.dryRun });
    this.bleAdapter = new SP530EBleAdapter(undefined, this.bleTransport, this.diagnostics);
    this.bleAdapter.dryRun = this.settings.dryRun;

    this.wledAdapter = new WledAdapter();

    // Register adapters into DeviceManager DI container
    this.deviceManager.registerAdapter(this.mockAdapter);
    this.deviceManager.registerAdapter(this.wifiAdapter);
    this.deviceManager.registerAdapter(this.bleAdapter);
    this.deviceManager.registerAdapter(this.wledAdapter);

    this.deviceManager.setDryRun(this.settings.dryRun);
    this.diagnostics.log('info', 'SYSTEM', `Registered adapters: mock, sp530e-wifi, sp530e-ble, wled. LogFile: ${logFilePath}`);
  }

  private getLogFilePath(): string {
    try {
      if (app && typeof app.getPath === 'function') {
        const logDir = path.join(app.getPath('userData'), 'logs');
        fs.mkdirSync(logDir, { recursive: true });
        return path.join(logDir, 'diagnostic.log');
      }
    } catch {}
    const appData = process.env.APPDATA || (process.platform === 'win32' ? path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming') : '');
    if (appData) {
      const logDir = path.join(appData, 'LightControl', 'logs');
      fs.mkdirSync(logDir, { recursive: true });
      return path.join(logDir, 'diagnostic.log');
    }
    return path.resolve('diagnostic.log');
  }

  private getSettingsPath(): string {
    try {
      if (app && typeof app.getPath === 'function') {
        return path.join(app.getPath('userData'), 'settings.json');
      }
    } catch {}
    const appData = process.env.APPDATA || (process.platform === 'win32' ? path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming') : '');
    if (appData) {
      return path.join(appData, 'LightControl', 'settings.json');
    }
    return path.resolve('.settings.json');
  }

  private loadSettings(): void {
    try {
      const p = this.getSettingsPath();
      if (fs.existsSync(p)) {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        this.settings = { ...this.settings, ...raw };
      }
    } catch {}
  }

  private saveSettings(): void {
    try {
      const p = this.getSettingsPath();
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(this.settings, null, 2), 'utf8');
    } catch {}
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
      this.diagnostics.logScan('START', 'all');
      await this.deviceManager.startDiscovery(false);
      return this.serializeDevices(this.deviceManager.getDiscoveredDevices());
    });

    ipcMain.handle('devices:rescan', async () => {
      this.diagnostics.log('info', 'RESCAN', 'Fresh rescan requested by UI');
      await this.deviceManager.rescan();
      return this.serializeDevices(this.deviceManager.getDiscoveredDevices());
    });

    ipcMain.handle('discovery:stop', async () => {
      this.diagnostics.logScan('STOP', 'all');
      await this.deviceManager.stopDiscovery();
    });

    ipcMain.handle('device:add-wled', async (_, host: string, port = 80, name?: string) => {
      this.diagnostics.log('info', 'WLED', `Registering manual WLED device: ${host}:${port}`);
      const dev = this.wledAdapter.addDevice(host, port, name || `QuinLED dig2go (${host})`);
      this.deviceManager.registerDevice(dev);
      return this.serializeDevices([dev])[0]!;
    });

    ipcMain.handle('device:test-connection', async (_, host: string, port = 8587) => {
      this.diagnostics.log('info', 'IPC', `Test connection requested for ${host}:${port}`);
      const startTime = Date.now();
      return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2500);

        socket.connect(port, host, () => {
          const latencyMs = Date.now() - startTime;
          const query = SpnetCodec.buildQueryFrame();
          socket.write(query);

          let buffer = Buffer.alloc(0);
          socket.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
            if (buffer.length >= 13) {
              const payloadLen = (buffer[11]! << 8) | buffer[12]!;
              if (buffer.length >= 13 + payloadLen) {
                socket.destroy();
                try {
                  const parsed = SpnetCodec.decodeResponse(new Uint8Array(buffer));
                  resolve({
                    success: true,
                    latencyMs,
                    message: `Verified SP530E (Firmware ${parsed.config.firmwareVersion}, ${parsed.config.pixelCount} LEDs) in ${latencyMs}ms`,
                    firmware: parsed.config.firmwareVersion,
                    pixels: parsed.config.pixelCount,
                  });
                } catch {
                  resolve({
                    success: true,
                    latencyMs,
                    message: `TCP socket connected and responded in ${latencyMs}ms`,
                  });
                }
              }
            }
          });
        });

        socket.on('error', (err) => {
          socket.destroy();
          resolve({
            success: false,
            message: `Connection failed: ${err.message}`,
          });
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve({
            success: false,
            message: `Connection timed out after 2500ms`,
          });
        });
      });
    });

    ipcMain.handle('device:update-config', async (_, deviceId: string, config: { name?: string; host?: string; port?: number; icType?: string; pixelCount?: number; channelOrder?: string }) => {
      this.diagnostics.log('info', 'IPC', `Updating device config for ${deviceId}: ${JSON.stringify(config)}`);
      let dev = this.deviceManager.getDevice(deviceId);
      if (!dev && config.host) {
        dev = this.wifiAdapter.addDevice(config.host, config.port || 8587, config.name);
        this.deviceManager.registerDevice(dev);
      }
      if (dev) {
        if (config.name) dev.name = config.name;
        if (config.pixelCount) {
          dev.capabilities.maxTotalPixels = config.pixelCount;
          dev.capabilities.maxPixelCount = config.pixelCount;
        }
        if (config.host) {
          this.settings.wifiHost = config.host;
          this.wifiAdapter.setDefaultHost(config.host);
        }
        if (config.port) {
          this.settings.wifiPort = config.port;
        }
        this.saveSettings();
        return this.serializeDevices([dev])[0]!;
      }
      throw new Error(`Device not found: ${deviceId}`);
    });

    ipcMain.handle('device:connect', async (_, deviceId: string) => {
      this.diagnostics.log('info', 'IPC', `IPC device:connect requested for ${deviceId}`);
      try {
        const ok = await this.deviceManager.connectDevice(deviceId, 5000);
        return ok;
      } catch (err: any) {
        this.diagnostics.log('error', 'IPC', `Connect failed for ${deviceId}: ${err.message}`);
        throw err;
      }
    });

    ipcMain.handle('device:disconnect', async (_, deviceId: string) => {
      this.diagnostics.log('info', 'IPC', `IPC device:disconnect requested for ${deviceId}`);
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
      this.diagnostics.log('info', 'PRESET', `Saved preset: ${preset.name}`);
    });

    ipcMain.handle('presets:delete', async (_, presetId: string) => {
      const ok = this.presetManager.deletePreset(presetId);
      this.diagnostics.log('info', 'PRESET', `Deleted preset ${presetId}: ${ok}`);
      return ok;
    });

    ipcMain.handle('presets:apply', async (_, deviceId: string, presetId: string) => {
      this.diagnostics.log('info', 'PRESET', `Applying preset ${presetId} to device ${deviceId}`);
      return this.presetManager.applyPreset(deviceId, presetId, this.deviceManager);
    });

    ipcMain.handle('diagnostics:get', async () => {
      return {
        version: '0.1.0',
        platform: process.platform,
        uptimeSec: Math.round(process.uptime()),
        logFilePath: this.diagnostics.getLogFilePath(),
        logs: this.diagnostics.getRecentLogs(100),
      };
    });

    ipcMain.handle('diagnostics:export', async () => {
      return this.diagnostics.exportDiagnosticReport();
    });

    ipcMain.handle('settings:get', async () => {
      return { ...this.settings };
    });

    ipcMain.handle('settings:update', async (_, newSettings: Partial<AppSettings>) => {
      this.settings = { ...this.settings, ...newSettings };
      if (newSettings.dryRun !== undefined) {
        this.deviceManager.setDryRun(newSettings.dryRun);
        this.wifiAdapter.dryRun = newSettings.dryRun;
        this.bleAdapter.dryRun = newSettings.dryRun;
        this.bleTransport.dryRun = newSettings.dryRun;
      }
      if (newSettings.wifiHost) {
        this.wifiAdapter.setDefaultHost(newSettings.wifiHost);
      }
      this.saveSettings();
      this.diagnostics.log(
        'info',
        'SETTINGS',
        `Updated settings: dryRun=${this.settings.dryRun}, safetyLimit=${this.settings.safetyBrightnessLimit}%`
      );
      return { ...this.settings };
    });

    // Auto-discover devices 400ms after window is ready
    setTimeout(async () => {
      try {
        await this.deviceManager.startDiscovery(false);
        const devs = this.deviceManager.getDiscoveredDevices();
        if (!mainWindow.isDestroyed() && devs.length > 0) {
          mainWindow.webContents.send('device:discovered-all', this.serializeDevices(devs));
        }
      } catch {}
    }, 400);
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
}
