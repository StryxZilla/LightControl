import test from 'node:test';
import assert from 'node:assert';
import { rgbToHex, hexToRgb, hsvToRgb, rgbToHsv, scaleBrightness, clamp } from '../../packages/core/src/color.ts';

test('clamp restricts numbers within bounds', () => {
  assert.strictEqual(clamp(50, 0, 100), 50);
  assert.strictEqual(clamp(-10, 0, 100), 0);
  assert.strictEqual(clamp(150, 0, 100), 100);
});

test('rgbToHex formats correctly', () => {
  assert.strictEqual(rgbToHex({ r: 255, g: 0, b: 0 }), '#FF0000');
  assert.strictEqual(rgbToHex({ r: 0, g: 255, b: 0 }), '#00FF00');
  assert.strictEqual(rgbToHex({ r: 0, g: 0, b: 255 }), '#0000FF');
  assert.strictEqual(rgbToHex({ r: 255, g: 255, b: 255 }), '#FFFFFF');
  assert.strictEqual(rgbToHex({ r: 0, g: 0, b: 0 }), '#000000');
});

test('hexToRgb parses 6-digit and 3-digit hex', () => {
  assert.deepStrictEqual(hexToRgb('#FF0000'), { r: 255, g: 0, b: 0 });
  assert.deepStrictEqual(hexToRgb('00FF00'), { r: 0, g: 255, b: 0 });
  assert.deepStrictEqual(hexToRgb('#FFF'), { r: 255, g: 255, b: 255 });
});

test('hsvToRgb and rgbToHsv round-trips primary colors', () => {
  const redHsv = rgbToHsv({ r: 255, g: 0, b: 0 });
  assert.strictEqual(redHsv.h, 0);
  assert.strictEqual(redHsv.s, 100);
  assert.strictEqual(redHsv.v, 100);

  const backToRed = hsvToRgb(redHsv.h, redHsv.s, redHsv.v);
  assert.deepStrictEqual(backToRed, { r: 255, g: 0, b: 0 });
});

test('scaleBrightness reduces channel intensity accurately', () => {
  const fullWhite = { r: 200, g: 100, b: 50 };
  const half = scaleBrightness(fullWhite, 50);
  assert.deepStrictEqual(half, { r: 100, g: 50, b: 25, w: undefined, cct: undefined });
});
