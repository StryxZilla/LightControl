import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  Sp530eBleCodec,
  Sp530eBleOpcode,
  SP530E_BLE_SERVICE_UUID,
  SP530E_BLE_CHARACTERISTIC_UUID,
  SP530E_MODEL_ID,
  SP530E_MANUFACTURER_ID,
} from '../packages/adapters/src/sp530e/sp530e-ble-codec.ts';

test('Sp530eBleCodec exposes verified GATT UUIDs and hardware IDs', () => {
  assert.equal(SP530E_BLE_SERVICE_UUID, '0000ffe0-0000-1000-8000-00805f9b34fb');
  assert.equal(SP530E_BLE_CHARACTERISTIC_UUID, '0000ffe1-0000-1000-8000-00805f9b34fb');
  assert.equal(SP530E_MODEL_ID, 0x4e); // 78
  assert.equal(SP530E_MANUFACTURER_ID, 0x5053); // "SP"
});

test('Sp530eBleCodec.encodePower matches verified protocol fixtures', () => {
  const onFixture = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'protocol/fixtures/sp530e/power_on.json'), 'utf8')
  );
  const offFixture = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'protocol/fixtures/sp530e/power_off.json'), 'utf8')
  );

  const onFrame = Sp530eBleCodec.encodePower(true);
  const offFrame = Sp530eBleCodec.encodePower(false);

  assert.deepEqual(Array.from(onFrame), onFixture.bytes);
  assert.deepEqual(Array.from(offFrame), offFixture.bytes);
  assert.equal(Sp530eBleCodec.isValidFrame(onFrame), true);
  assert.equal(Sp530eBleCodec.isValidFrame(offFrame), true);
});

test('Sp530eBleCodec.encodeBrightness matches 20% safety cap fixture and clamps values', () => {
  const brightFixture = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'protocol/fixtures/sp530e/set_brightness_20pct.json'), 'utf8')
  );

  const frame20 = Sp530eBleCodec.encodeBrightness(51); // 20% of 255 = ~51
  assert.deepEqual(Array.from(frame20), brightFixture.bytes);

  // Clamping tests
  const frameUnder = Sp530eBleCodec.encodeBrightness(-10);
  assert.equal(frameUnder[6], 0);

  const frameOver = Sp530eBleCodec.encodeBrightness(300);
  assert.equal(frameOver[6], 255);
});

test('Sp530eBleCodec.encodeColor matches primary RGB fixtures', () => {
  const redFixture = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'protocol/fixtures/sp530e/set_color_red.json'), 'utf8')
  );
  const greenFixture = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'protocol/fixtures/sp530e/set_color_green.json'), 'utf8')
  );
  const blueFixture = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'protocol/fixtures/sp530e/set_color_blue.json'), 'utf8')
  );

  const redFrame = Sp530eBleCodec.encodeColor(255, 0, 0);
  const greenFrame = Sp530eBleCodec.encodeColor(0, 255, 0);
  const blueFrame = Sp530eBleCodec.encodeColor(0, 0, 255);

  assert.deepEqual(Array.from(redFrame), redFixture.bytes);
  assert.deepEqual(Array.from(greenFrame), greenFixture.bytes);
  assert.deepEqual(Array.from(blueFrame), blueFixture.bytes);
});

test('Sp530eBleCodec.encodeEffectMode matches rainbow effect fixture', () => {
  const rainbowFixture = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'protocol/fixtures/sp530e/set_effect_rainbow.json'), 'utf8')
  );

  const frame = Sp530eBleCodec.encodeEffectMode(1);
  assert.deepEqual(Array.from(frame), rainbowFixture.bytes);
});

test('Sp530eBleCodec.encodeEffectSpeed and encodeEffectDirection build valid frames', () => {
  const speedFrame = Sp530eBleCodec.encodeEffectSpeed(128);
  assert.equal(Sp530eBleCodec.isValidFrame(speedFrame), true);
  assert.equal(speedFrame[3], Sp530eBleOpcode.EFFECT_SPEED);
  assert.equal(speedFrame[6], 128);

  const dirFwd = Sp530eBleCodec.encodeEffectDirection(false);
  assert.equal(dirFwd[6], 0x00);

  const dirRev = Sp530eBleCodec.encodeEffectDirection(true);
  assert.equal(dirRev[6], 0x01);
});

test('Sp530eBleCodec.dissectFrame rejects malformed frames', () => {
  assert.equal(Sp530eBleCodec.dissectFrame(new Uint8Array([0x00, 0x01])), null);
  assert.equal(Sp530eBleCodec.dissectFrame(new Uint8Array([0x53, 0x51, 0, 1, 0, 1, 1])), null); // Wrong magic
  assert.equal(Sp530eBleCodec.dissectFrame(new Uint8Array([0x53, 0x50, 0, 1, 0, 5, 1])), null); // Truncated length
});

test('Sp530eBleCodec.decodeNotification correctly parses incoming telemetry frames', () => {
  // Power notification
  const powerOn = new Uint8Array([0x53, 0x50, 0x00, 0x01, 0x00, 0x01, 0x01]);
  assert.deepEqual(Sp530eBleCodec.decodeNotification(powerOn), { power: true });

  const powerOff = new Uint8Array([0x53, 0x50, 0x00, 0x01, 0x00, 0x01, 0x00]);
  assert.deepEqual(Sp530eBleCodec.decodeNotification(powerOff), { power: false });

  // Brightness notification
  const bright51 = new Uint8Array([0x53, 0x50, 0x00, 0x02, 0x00, 0x01, 0x33]);
  assert.deepEqual(Sp530eBleCodec.decodeNotification(bright51), { brightness: 51 });

  // Color notification
  const colorRed = new Uint8Array([0x53, 0x50, 0x00, 0x04, 0x00, 0x03, 0xff, 0x00, 0x00]);
  const decodedColor = Sp530eBleCodec.decodeNotification(colorRed);
  assert.ok(decodedColor?.color);
  assert.equal(decodedColor.color.hex, '#FF0000');
  assert.equal(decodedColor.color.red, 255);
  assert.equal(decodedColor.color.green, 0);
  assert.equal(decodedColor.color.blue, 0);
});
