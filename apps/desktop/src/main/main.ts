import { app, BrowserWindow } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AppIpcManager } from './ipc-handlers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure stable persistent userData in %APPDATA%\LightControl so settings survive portable extraction
if (process.platform === 'win32') {
  app.name = 'LightControl';
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
  app.setPath('userData', path.join(appData, 'LightControl'));
}

let mainWindow: BrowserWindow | null = null;
const ipcManager = new AppIpcManager();

function createWindow(): void {
  const iconCandidates = [
    path.resolve(__dirname, '../build/icon.ico'),
    path.resolve(__dirname, '../../build/icon.ico'),
    path.resolve(app.getAppPath(), 'build/icon.ico'),
  ];
  const windowIcon = iconCandidates.find((p) => fs.existsSync(p));

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 980,
    minHeight: 650,
    title: 'Universal LED Controller',
    icon: windowIcon,
    backgroundColor: '#0d1117',
    show: false,
    frame: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.resolve(__dirname, 'preload.js'),
    },
  });

  ipcManager.registerHandlers(mainWindow);

  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  const screenArgIdx = process.argv.indexOf('--screen');
  const targetScreen = screenArgIdx !== -1 && process.argv[screenArgIdx + 1] ? process.argv[screenArgIdx + 1] : '';

  if (isDev) {
    mainWindow.loadURL(`http://localhost:5173/${targetScreen ? `#${targetScreen}` : ''}`);
  } else {
    mainWindow.loadFile(path.resolve(__dirname, '../dist/index.html'), {
      hash: targetScreen || undefined,
    });
  }

  mainWindow.once('ready-to-show', async () => {
    mainWindow?.show();
    const screenshotIdx = process.argv.indexOf('--capture-screenshot');
    if (screenshotIdx !== -1 && process.argv[screenshotIdx + 1]) {
      const outPath = path.resolve(process.argv[screenshotIdx + 1]);
      setTimeout(async () => {
        try {
          const image = await mainWindow!.webContents.capturePage();
          if (!fs.existsSync(path.dirname(outPath))) {
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
          }
          fs.writeFileSync(outPath, image.toPNG());
          console.log(`SCREENSHOT_SAVED: ${outPath}`);
        } catch (err: any) {
          console.error(`SCREENSHOT_ERROR: ${err.message}`);
        }
        if (process.argv.includes('--smoke-test')) {
          app.quit();
        }
      }, 750);
      return;
    }

    if (process.argv.includes('--smoke-test')) {
      console.log('SMOKE_TEST_READY: Window initialized and ready.');
      setTimeout(() => {
        app.quit();
      }, 500);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
