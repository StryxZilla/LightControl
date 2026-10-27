import test from 'node:test';
import assert from 'node:assert';
import { WledCodec, type WledJsonState, type WledJsonInfo } from '../../packages/adapters/src/wled/wled-codec.ts';
import type { LedState } from '../../packages/core/src/types.ts';

test('WledCodec.stateToWledJson serializes Universal state to WLED JSON', () => {
  const universalState: Partial<LedState> = {
    power: true,
    brightness: 50, // 50% should scale to ~128 on 0-255
    color: { r: 255, g: 128, b: 0, hex: '#FF8000' },
    mode: 'solid',
  };

  const json = WledCodec.stateToWledJson(universalState);
  assert.strictEqual(json.on, true);
  assert.strictEqual(json.bri, 128);
  assert.ok(json.seg && json.seg.length > 0);
  assert.deepStrictEqual(json.seg[0]?.col, [[255, 128, 0]]);
  assert.strictEqual(json.seg[0]?.fx, 0); // Solid mode is fx 0 in WLED
});

test('WledCodec.stateToWledJson serializes dynamic effects and multi-segment configuration', () => {
  const universalState: Partial<LedState> = {
    power: true,
    brightness: 20,
    mode: 'effect',
    effectId: 9, // Rainbow
    effectSpeed: 75,
    segments: [
      { id: 0, start: 0, stop: 30, length: 30, on: true, effectId: 9, speed: 75 },
      { id: 1, start: 30, stop: 60, length: 30, on: true, effectId: 1, speed: 50 },
    ],
  };

  const json = WledCodec.stateToWledJson(universalState);
  assert.strictEqual(json.bri, 51); // 20% of 255
  assert.strictEqual(json.seg?.length, 2);
  assert.strictEqual(json.seg?.[0]?.start, 0);
  assert.strictEqual(json.seg?.[0]?.stop, 30);
  assert.strictEqual(json.seg?.[0]?.fx, 9);
  assert.strictEqual(json.seg?.[1]?.start, 30);
  assert.strictEqual(json.seg?.[1]?.fx, 1);
});

test('WledCodec.wledJsonToState deserializes WLED JSON payload into Universal LedState', () => {
  const wledResponse: WledJsonState = {
    on: true,
    bri: 255,
    seg: [
      {
        id: 0,
        start: 0,
        stop: 60,
        col: [[0, 255, 200, 128]], // RGBW
        fx: 9,
        sx: 191, // ~75%
      },
    ],
  };

  const state = WledCodec.wledJsonToState(wledResponse);
  assert.strictEqual(state.power, true);
  assert.strictEqual(state.brightness, 100);
  assert.strictEqual(state.color.r, 0);
  assert.strictEqual(state.color.g, 255);
  assert.strictEqual(state.color.b, 200);
  assert.strictEqual(state.color.w, 128); // White channel preserved
  assert.strictEqual(state.mode, 'effect');
  assert.strictEqual(state.effectId, 9);
  assert.strictEqual(state.effectSpeed, 75);
  assert.strictEqual(state.segments?.length, 1);
});

test('WledCodec.parseWledInfoToCapabilities parses WLED /json/info into DeviceCapabilities', () => {
  const info: WledJsonInfo = {
    ver: '0.14.0',
    vid: 2310130,
    leds: {
      count: 300,
      pwr: 0,
      fps: 42,
      maxpwr: 850,
      maxseg: 16,
      actseg: 1,
      seglock: false,
      cct: true,
      wv: false,
      rgbw: true,
    },
    str: false,
    name: 'Office Desk Dig2Go',
    udpport: 21324,
    live: false,
    fxcount: 180,
    palcount: 70,
    arch: 'esp32',
    core: 'v4.4.4',
    freeheap: 142000,
    uptime: 3600,
    opt: 0,
    brand: 'QuinLED',
    product: 'dig2go',
    mac: '244cab123456',
    ip: '192.168.86.50',
  };

  const effects = ['Solid', 'Blink', 'Breathe', 'Wipe', 'Colorloop', 'Rainbow'];
  const capabilities = WledCodec.parseWledInfoToCapabilities(info, effects);

  assert.strictEqual(capabilities.family, 'wled');
  assert.strictEqual(capabilities.maxTotalPixels, 300);
  assert.strictEqual(capabilities.maxSegments, 16);
  assert.strictEqual(capabilities.supportsWhiteChannel, true);
  assert.strictEqual(capabilities.supportsColorTemperature, true);
  assert.deepStrictEqual(capabilities.colorModes, ['rgb', 'rgbw']);
  assert.strictEqual(capabilities.effectsList.length, 6);
  assert.strictEqual(capabilities.firmwareInfo?.model, 'dig2go');
  assert.strictEqual(capabilities.firmwareInfo?.version, '0.14.0');
});
