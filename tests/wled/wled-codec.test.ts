import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  WledCodec,
  type WledJsonState,
  type WledJsonInfo,
} from '../../packages/adapters/src/wled/wled-codec.ts';
import type { LedState } from '../../packages/core/src/types.ts';

test('WledCodec.stateToWledJson serializes basic lighting parameters', () => {
  const state: Partial<LedState> = {
    power: true,
    brightness: 20, // 20% -> 51 on 0-255 scale
    color: { r: 255, g: 100, b: 0, hex: '#FF6400' },
    mode: 'solid',
  };

  const payload = WledCodec.stateToWledJson(state);
  assert.strictEqual(payload.on, true);
  assert.strictEqual(payload.bri, 51);
  assert.ok(payload.seg && payload.seg.length === 1);
  assert.deepStrictEqual(payload.seg[0]!.col, [[255, 100, 0]]);
  assert.strictEqual(payload.seg[0]!.fx, 0); // Solid mode
});

test('WledCodec.stateToWledJson serializes RGBW white channel and effect speed', () => {
  const state: Partial<LedState> = {
    color: { r: 120, g: 200, b: 255, w: 180, hex: '#78C8FF' },
    mode: 'effect',
    effectId: 9, // Rainbow
    effectSpeed: 80,
  };

  const payload = WledCodec.stateToWledJson(state);
  assert.ok(payload.seg && payload.seg.length === 1);
  assert.deepStrictEqual(payload.seg[0]!.col, [[120, 200, 255, 180]]);
  assert.strictEqual(payload.seg[0]!.fx, 9);
  assert.strictEqual(payload.seg[0]!.sx, 204); // 80% of 255
});

test('WledCodec.stateToWledJson serializes multi-segment configurations', () => {
  const state: Partial<LedState> = {
    segments: [
      { id: 0, start: 0, stop: 50, length: 50, on: true, effectId: 0, color: { r: 255, g: 0, b: 0, hex: '#FF0000' } },
      { id: 1, start: 50, stop: 100, length: 50, on: true, effectId: 9, speed: 60, color: { r: 0, g: 0, b: 255, hex: '#0000FF' } },
    ],
  };

  const payload = WledCodec.stateToWledJson(state);
  assert.strictEqual(payload.seg?.length, 2);
  assert.strictEqual(payload.seg![0]!.id, 0);
  assert.strictEqual(payload.seg![0]!.start, 0);
  assert.strictEqual(payload.seg![0]!.stop, 50);
  assert.strictEqual(payload.seg![0]!.fx, 0);
  assert.deepStrictEqual(payload.seg![0]!.col, [[255, 0, 0]]);

  assert.strictEqual(payload.seg![1]!.id, 1);
  assert.strictEqual(payload.seg![1]!.start, 50);
  assert.strictEqual(payload.seg![1]!.stop, 100);
  assert.strictEqual(payload.seg![1]!.fx, 9);
  assert.strictEqual(payload.seg![1]!.sx, 153); // 60% of 255
});

test('WledCodec.wledJsonToState parses incoming WLED JSON into Universal LedState', () => {
  const wledResponse: WledJsonState = {
    on: false,
    bri: 128, // ~50%
    seg: [
      {
        id: 0,
        start: 0,
        stop: 150,
        col: [[0, 255, 128, 64]],
        fx: 38, // Fire 2012
        sx: 200,
      },
    ],
  };

  const state = WledCodec.wledJsonToState(wledResponse);
  assert.strictEqual(state.power, false);
  assert.strictEqual(state.brightness, 50);
  assert.strictEqual(state.color.r, 0);
  assert.strictEqual(state.color.g, 255);
  assert.strictEqual(state.color.b, 128);
  assert.strictEqual(state.color.w, 64);
  assert.strictEqual(state.mode, 'effect');
  assert.strictEqual(state.effectId, 38);
  assert.strictEqual(state.effectSpeed, 78);
  assert.strictEqual(state.activeSegments, 1);
});

test('WledCodec.parseWledInfoToCapabilities identifies QuinLED dig2go and capabilities', () => {
  const info: WledJsonInfo = {
    ver: '0.14.1',
    vid: 2312150,
    leds: {
      count: 300,
      maxseg: 16,
      actseg: 1,
      rgbw: false,
      cct: false,
    },
    name: 'QuinLED dig2go Living Room',
    brand: 'QuinLED',
    product: 'dig2go',
    arch: 'esp32',
    btype: 'soundreactive',
    udpport: 21324,
    fxcount: 184,
    palcount: 71,
    ip: '192.168.1.150',
    mac: 'a4:cf:12:ef:90:12',
  };

  const effects = ['Solid', 'Blink', 'Rainbow', 'Fire 2012', 'Sound Wave'];
  const palettes = ['Default', 'Party', 'Fire'];

  const caps = WledCodec.parseWledInfoToCapabilities(info, effects, palettes);

  assert.strictEqual(caps.family, 'wled');
  assert.strictEqual(caps.firmwareInfo?.model, 'dig2go');
  assert.strictEqual(caps.firmwareInfo?.version, '0.14.1');
  assert.strictEqual(caps.firmwareInfo?.targetChip, 'esp32');
  assert.strictEqual(caps.maxTotalPixels, 300);
  assert.strictEqual(caps.maxSegments, 16);
  assert.strictEqual(caps.supportsMusicReactive, true); // Sound-reactive detected
  assert.strictEqual(caps.effectsList.length, 5);
  assert.strictEqual(caps.effectsList[2]?.name, 'Rainbow');
  assert.ok(WledCodec.isDig2Go(info));
  assert.ok(WledCodec.isSoundReactive(info));
});

test('WledCodec.parsePresetsJson parses /presets.json dictionary into universal Presets', () => {
  const presetsJson = {
    '1': {
      n: 'Warm Glow',
      on: true,
      bri: 51,
      seg: [{ id: 0, col: [[255, 180, 60]], fx: 0 }],
    },
    '2': {
      n: 'Cyber Rainbow',
      on: true,
      bri: 51,
      seg: [{ id: 0, col: [[0, 255, 255]], fx: 9 }],
    },
  };

  const parsed = WledCodec.parsePresetsJson(presetsJson);
  assert.strictEqual(parsed.length, 2);
  assert.strictEqual(parsed[0]!.id, 'wled-preset-1');
  assert.strictEqual(parsed[0]!.name, 'Warm Glow');
  assert.strictEqual(parsed[0]!.state.power, true);
  assert.strictEqual(parsed[0]!.state.brightness, 20);
  assert.strictEqual(parsed[0]!.state.color?.r, 255);
  assert.strictEqual(parsed[0]!.state.color?.g, 180);
  assert.strictEqual(parsed[0]!.state.color?.b, 60);

  assert.strictEqual(parsed[1]!.id, 'wled-preset-2');
  assert.strictEqual(parsed[1]!.name, 'Cyber Rainbow');
  assert.strictEqual(parsed[1]!.state.effectId, 9);
});

test('WledCodec playlist and preset save payloads build correct schemas', () => {
  const savePayload = WledCodec.buildPresetSavePayload(3, 'Reading Light', {
    power: true,
    brightness: 20,
    color: { r: 255, g: 200, b: 100, hex: '#FFC864' },
  });

  assert.strictEqual(savePayload.psave, 3);
  assert.strictEqual(savePayload.n, 'Reading Light');
  assert.strictEqual(savePayload.bri, 51);
  assert.ok(savePayload.seg && savePayload.seg.length > 0);

  const playlistPayload = WledCodec.buildPlaylistPayload([1, 2, 3], [5, 10, 15], 2, 1);
  assert.deepStrictEqual(playlistPayload.playlist.ps, [1, 2, 3]);
  assert.deepStrictEqual(playlistPayload.playlist.dur, [50, 100, 150]); // Converted to tenths of seconds
  assert.strictEqual(playlistPayload.playlist.repeat, 2);
  assert.strictEqual(playlistPayload.playlist.end, 1);
});
