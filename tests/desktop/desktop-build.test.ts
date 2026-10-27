import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DESKTOP_ROOT = path.resolve('apps/desktop');

test('Desktop build artifacts verification', () => {
  const distHtml = path.join(DESKTOP_ROOT, 'dist', 'index.html');
  const mainJs = path.join(DESKTOP_ROOT, 'dist-electron', 'main.js');
  const preloadJs = path.join(DESKTOP_ROOT, 'dist-electron', 'preload.js');

  assert.ok(fs.existsSync(distHtml), 'Vite production build dist/index.html should exist');
  assert.ok(fs.existsSync(mainJs), 'Electron main bundle dist-electron/main.js should exist');
  assert.ok(fs.existsSync(preloadJs), 'Electron preload bundle dist-electron/preload.js should exist');

  const htmlContent = fs.readFileSync(distHtml, 'utf8');
  assert.ok(htmlContent.includes('<div id="root"></div>'), 'HTML should contain root mount element');

  const mainStats = fs.statSync(mainJs);
  const preloadStats = fs.statSync(preloadJs);
  assert.ok(mainStats.size > 10000, `main.js should be bundled with dependencies (>10KB), size: ${mainStats.size}`);
  assert.ok(preloadStats.size > 1000, `preload.js should contain contextBridge exposes (>1KB), size: ${preloadStats.size}`);
});

test('Desktop preload bundle exposes secure IPC methods', () => {
  const preloadJs = path.join(DESKTOP_ROOT, 'dist-electron', 'preload.js');
  const content = fs.readFileSync(preloadJs, 'utf8');

  // Verify contextIsolation boundary
  assert.ok(content.includes('exposeInMainWorld'), 'Preload must call exposeInMainWorld');
  assert.ok(content.includes('devices:get-all'), 'Preload must register devices:get-all');
  assert.ok(content.includes('device:set-power'), 'Preload must register device:set-power');
  assert.ok(content.includes('device:set-brightness'), 'Preload must register device:set-brightness');
  assert.ok(content.includes('device:set-color'), 'Preload must register device:set-color');
  assert.ok(content.includes('device:set-effect'), 'Preload must register device:set-effect');
  assert.ok(content.includes('device:set-music-mode'), 'Preload must register device:set-music-mode');
  assert.ok(content.includes('presets:get-all'), 'Preload must register presets:get-all');
  assert.ok(content.includes('diagnostics:get'), 'Preload must register diagnostics:get');
  assert.ok(content.includes('settings:get'), 'Preload must register settings:get');
  assert.ok(content.includes('device:add-wled'), 'Preload must register device:add-wled');
});

test('Desktop main bundle contains HAL adapters and security config', () => {
  const mainJs = path.join(DESKTOP_ROOT, 'dist-electron', 'main.js');
  const content = fs.readFileSync(mainJs, 'utf8');

  // Context isolation & security
  assert.ok(content.includes('contextIsolation: true'), 'Electron BrowserWindow must enforce contextIsolation: true');
  assert.ok(content.includes('nodeIntegration: false'), 'Electron BrowserWindow must enforce nodeIntegration: false');
  assert.ok(content.includes('sandbox: true'), 'Electron BrowserWindow must enforce sandbox: true');

  // Integrated adapters
  assert.ok(content.includes('SP530EWiFiAdapter'), 'Main bundle must package SP530EWiFiAdapter');
  assert.ok(content.includes('SP530EBleAdapter'), 'Main bundle must package SP530EBleAdapter');
  assert.ok(content.includes('WledAdapter'), 'Main bundle must package WledAdapter');
  assert.ok(content.includes('MockAdapter'), 'Main bundle must package MockAdapter');
});

test('Desktop renderer screens inventory exists', () => {
  const screensDir = path.join(DESKTOP_ROOT, 'src', 'renderer', 'screens');
  const expectedScreens = [
    'DashboardScreen.tsx',
    'DeviceConnectionScreen.tsx',
    'ColorControlScreen.tsx',
    'PowerBrightnessScreen.tsx',
    'EffectsBrowserScreen.tsx',
    'MusicReactiveScreen.tsx',
    'PresetsScenesScreen.tsx',
    'DeviceGroupingScreen.tsx',
    'DeviceSettingsScreen.tsx',
    'DiagnosticsScreen.tsx',
    'AppSettingsScreen.tsx',
  ];

  for (const screen of expectedScreens) {
    const screenPath = path.join(screensDir, screen);
    assert.ok(fs.existsSync(screenPath), `Screen ${screen} must exist`);
  }
});

test('Desktop IPC Security Review: Content Security Policy & Safe Defaults', () => {
  const distHtml = path.join(DESKTOP_ROOT, 'dist', 'index.html');
  const htmlContent = fs.readFileSync(distHtml, 'utf8');

  // Verify Content-Security-Policy
  assert.ok(htmlContent.includes('http-equiv="Content-Security-Policy"'), 'HTML must enforce CSP');
  assert.ok(htmlContent.includes("default-src 'self'"), 'CSP must restrict default sources to self');

  // Verify settings persistence logic exists in main
  const mainJs = path.join(DESKTOP_ROOT, 'dist-electron', 'main.js');
  const mainContent = fs.readFileSync(mainJs, 'utf8');
  assert.ok(mainContent.includes('settings.json'), 'Main process must persist settings to settings.json');
  assert.ok(mainContent.includes('safetyBrightnessLimit: 20'), 'Safe default 20% brightness cap must be configured');
});
