import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  WledCodec,
  type WledJsonInfo,
  type WledJsonState,
} from '../../packages/adapters/src/wled/wled-codec.ts';

const FIXTURES_DIR = path.resolve('tests/wled/fixtures');

test('WLED protocol fixture: wled_dig2go_info.json validates QuinLED dig2go identity', () => {
  const filePath = path.join(FIXTURES_DIR, 'wled_dig2go_info.json');
  assert.ok(fs.existsSync(filePath), 'Fixture file must exist');

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as WledJsonInfo;
  assert.strictEqual(raw.brand, 'QuinLED');
  assert.strictEqual(raw.product, 'dig2go');
  assert.strictEqual(raw.arch, 'esp32');
  assert.strictEqual(raw.btype, 'soundreactive');
  assert.strictEqual(raw.leds.count, 300);

  const caps = WledCodec.parseWledInfoToCapabilities(raw);
  assert.strictEqual(caps.family, 'wled');
  assert.strictEqual(caps.firmwareInfo?.model, 'dig2go');
  assert.strictEqual(caps.firmwareInfo?.version, '0.14.1');
  assert.strictEqual(caps.maxTotalPixels, 300);
  assert.strictEqual(caps.supportsMusicReactive, true);
  assert.ok(WledCodec.isDig2Go(raw));
  assert.ok(WledCodec.isSoundReactive(raw));
});

test('WLED protocol fixture: wled_state_default.json parses accurately into LedState', () => {
  const filePath = path.join(FIXTURES_DIR, 'wled_state_default.json');
  assert.ok(fs.existsSync(filePath), 'Fixture file must exist');

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as WledJsonState;
  assert.strictEqual(raw.on, true);
  assert.strictEqual(raw.bri, 51); // 20% safe cap

  const state = WledCodec.wledJsonToState(raw);
  assert.strictEqual(state.power, true);
  assert.strictEqual(state.brightness, 20);
  assert.strictEqual(state.color.r, 255);
  assert.strictEqual(state.color.g, 160);
  assert.strictEqual(state.color.b, 50);
  assert.strictEqual(state.mode, 'solid');
  assert.strictEqual(state.activeSegments, 1);
});

test('WLED protocol fixture: wled_presets.json parses accurately into Universal Presets', () => {
  const filePath = path.join(FIXTURES_DIR, 'wled_presets.json');
  assert.ok(fs.existsSync(filePath), 'Fixture file must exist');

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, any>;
  const presets = WledCodec.parsePresetsJson(raw);

  assert.strictEqual(presets.length, 3);
  assert.strictEqual(presets[0]?.name, 'Warm Glow (20% Safe)');
  assert.strictEqual(presets[0]?.state.brightness, 20);
  assert.strictEqual(presets[0]?.state.mode, 'solid');

  assert.strictEqual(presets[1]?.name, 'Rainbow Flow');
  assert.strictEqual(presets[1]?.state.mode, 'effect');
  assert.strictEqual(presets[1]?.state.effectId, 9);

  assert.strictEqual(presets[2]?.name, 'Dig2Go Sound Reactive');
  assert.strictEqual(presets[2]?.state.mode, 'effect');
  assert.strictEqual(presets[2]?.state.effectId, 80);
});
