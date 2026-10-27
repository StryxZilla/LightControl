import test from 'node:test';
import assert from 'node:assert';
import { PresetManager, type Preset } from '../../packages/core/src/presets.ts';
import { DeviceManager } from '../../packages/core/src/device-manager.ts';
import { MockAdapter, MockLedDevice } from '../../packages/adapters/src/mock/mock-adapter.ts';

test('PresetManager loads default factory presets with safety brightness limits', () => {
  const manager = new PresetManager();
  const presets = manager.getPresets();

  assert.ok(presets.length >= 4);
  const warmWhite = manager.getPreset('preset-warm-white-safe');
  assert.ok(warmWhite);
  assert.strictEqual(warmWhite?.state.brightness, 20); // Strict safety limit
  assert.strictEqual(warmWhite?.state.color?.cct, 2700);

  const rainbow = manager.getPreset('preset-rainbow-flow');
  assert.ok(rainbow);
  assert.strictEqual(rainbow?.state.mode, 'effect');
  assert.strictEqual(rainbow?.state.effectId, 1);
});

test('PresetManager saves, deletes, and filters presets', () => {
  const manager = new PresetManager();

  const customPreset: Preset = {
    id: 'preset-custom-wled-neon',
    name: 'WLED Neon Glow',
    targetFamily: 'wled',
    state: {
      power: true,
      brightness: 20,
      color: { r: 0, g: 255, b: 128 },
      mode: 'solid',
    },
    createdAt: Date.now(),
  };

  manager.savePreset(customPreset);
  assert.strictEqual(manager.getPreset('preset-custom-wled-neon')?.name, 'WLED Neon Glow');

  // Filter by targetFamily
  const wledPresets = manager.getPresets('wled');
  assert.ok(wledPresets.some((p) => p.id === 'preset-custom-wled-neon'));

  const sp530ePresets = manager.getPresets('sp530e');
  assert.ok(!sp530ePresets.some((p) => p.id === 'preset-custom-wled-neon'));

  // Delete
  const deleted = manager.deletePreset('preset-custom-wled-neon');
  assert.strictEqual(deleted, true);
  assert.strictEqual(manager.getPreset('preset-custom-wled-neon'), undefined);
});

test('PresetManager exports and imports presets via JSON', () => {
  const manager = new PresetManager();
  const json = manager.exportPresetsJson();
  assert.ok(typeof json === 'string');

  const newManager = new PresetManager([]);
  assert.strictEqual(newManager.getPresets().length, 0);

  const count = newManager.importPresetsJson(json);
  assert.ok(count >= 4);
  assert.strictEqual(newManager.getPresets().length, count);
});

test('PresetManager applies preset to device respecting safety brightness limit', async () => {
  const presetMgr = new PresetManager();
  const devMgr = new DeviceManager();
  const mockDev = new MockLedDevice('test-device-1', 'Safe Test Device', {
    brightnessRange: { min: 0, max: 100, safetyLimit: 20 },
  });
  const adapter = new MockAdapter([mockDev]);

  devMgr.registerAdapter(adapter);
  await devMgr.startDiscovery();
  await devMgr.connectDevice('test-device-1');

  // Create preset with 80% brightness (exceeding 20% safety limit)
  const highBrightnessPreset: Preset = {
    id: 'preset-high-bright',
    name: 'High Brightness Test',
    state: {
      power: true,
      brightness: 80,
      color: { r: 0, g: 100, b: 255 },
      mode: 'solid',
    },
    createdAt: Date.now(),
  };
  presetMgr.savePreset(highBrightnessPreset);

  // Apply to device
  await presetMgr.applyPreset('test-device-1', 'preset-high-bright', devMgr);

  // Device state must be clamped to 20% safety limit
  assert.strictEqual(mockDev.state.brightness, 20);
  assert.strictEqual(mockDev.state.color.b, 255);
});
