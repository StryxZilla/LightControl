import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SpnetCodec } from '../../packages/adapters/src/sp530e/spnet-codec.ts';
import { Sp530eBleCodec } from '../../packages/adapters/src/sp530e/sp530e-ble-codec.ts';

test('Sp530e protocol fixtures: BLE power commands match hardware capture', () => {
  const onFixture = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'protocol/fixtures/sp530e/power_on.json'), 'utf8')
  );
  const offFixture = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'protocol/fixtures/sp530e/power_off.json'), 'utf8')
  );

  const onFrame = Sp530eBleCodec.encodePower(true);
  const offFrame = Sp530eBleCodec.encodePower(false);

  assert.deepStrictEqual(Array.from(onFrame), onFixture.bytes);
  assert.deepStrictEqual(Array.from(offFrame), offFixture.bytes);
});

test('Sp530e protocol fixtures: BLE brightness 20% matches safety cap fixture', () => {
  const brightFixture = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'protocol/fixtures/sp530e/set_brightness_20pct.json'), 'utf8')
  );

  const frame20 = Sp530eBleCodec.encodeBrightness(51); // 20% of 255 = 51 (0x33)
  assert.deepStrictEqual(Array.from(frame20), brightFixture.bytes);
});

test('Sp530e protocol fixtures: BLE RGB primary color fixtures match hardware capture', () => {
  const redFixture = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'protocol/fixtures/sp530e/set_color_red.json'), 'utf8')
  );
  const greenFixture = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'protocol/fixtures/sp530e/set_color_green.json'), 'utf8')
  );
  const blueFixture = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'protocol/fixtures/sp530e/set_color_blue.json'), 'utf8')
  );

  assert.deepStrictEqual(Array.from(Sp530eBleCodec.encodeColor(255, 0, 0)), redFixture.bytes);
  assert.deepStrictEqual(Array.from(Sp530eBleCodec.encodeColor(0, 255, 0)), greenFixture.bytes);
  assert.deepStrictEqual(Array.from(Sp530eBleCodec.encodeColor(0, 0, 255)), blueFixture.bytes);
});

test('Sp530e protocol fixtures: Wi-Fi live hardware telemetry binary decodes correctly', () => {
  const rawResponse = fs.readFileSync(path.resolve(process.cwd(), 'protocol/fixtures/sp530e_status_response.bin'));
  const parsed = SpnetCodec.decodeResponse(new Uint8Array(rawResponse));

  assert.strictEqual(parsed.header.magic, 'SPTECH');
  assert.strictEqual(parsed.header.messageType, 2);
  assert.strictEqual(parsed.config.firmwareVersion, 'V2.0.13');
  assert.strictEqual(parsed.config.lightType, 0x86); // WS2812B
  assert.strictEqual(parsed.config.pixelCount, 60);
  assert.strictEqual(parsed.state.power, true);
  assert.strictEqual(parsed.state.brightness, 100);
});
