import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SpnetCodec, SPTECH_MAGIC } from '../../packages/adapters/src/sp530e/spnet-codec.ts';

test('SpnetCodec.buildQueryFrame builds valid 13-byte query frame', () => {
  const query = SpnetCodec.buildQueryFrame();
  assert.strictEqual(query.length, 13);
  
  // Verify magic SPTECH\0
  for (let i = 0; i < 7; i++) {
    assert.strictEqual(query[i], SPTECH_MAGIC[i]);
  }
  // Command 0x02, Key 0x58
  assert.strictEqual(query[7], 0x02);
  assert.strictEqual(query[8], 0x58);
  // Length = 0
  assert.strictEqual(query[11], 0x00);
  assert.strictEqual(query[12], 0x00);
});

test('SpnetCodec decodes real hardware fixture sp530e_status_response.bin correctly', () => {
  const fixturePath = path.resolve('protocol/fixtures/sp530e_status_response.bin');
  const buffer = new Uint8Array(fs.readFileSync(fixturePath));

  assert.strictEqual(buffer.length, 428);

  const parsed = SpnetCodec.decodeResponse(buffer);

  // Assert Header
  assert.strictEqual(parsed.header.magic, 'SPTECH');
  assert.strictEqual(parsed.header.messageType, 0x02);
  assert.strictEqual(parsed.header.key, 0x00);
  assert.strictEqual(parsed.header.payloadLength, 415);

  // Assert Config Chunk (Chunk 0x01)
  assert.strictEqual(parsed.config.firmwareVersion, 'V2.0.13');
  assert.strictEqual(parsed.config.lightType, 0x86); // WS2812B
  assert.strictEqual(parsed.config.onoffEffect, 0x03);
  assert.strictEqual(parsed.config.onoffSpeed, 0x03);
  assert.strictEqual(parsed.config.pixelCount, 60); // 60 pixels
  assert.strictEqual(parsed.config.segmentCount, 1);

  // Assert Real-Time Telemetry (Chunk 0x03)
  assert.strictEqual(parsed.state.power, true); // Strip is powered on
  assert.strictEqual(parsed.state.brightness, 100); // 255 -> 100%
  assert.strictEqual(parsed.deviceIp, '192.168.86.34');
});

test('SpnetCodec encodes control frames with 13-byte SPTECH header and correct payloads', () => {
  // Power ON
  const pwrOn = SpnetCodec.encodePower(true);
  assert.strictEqual(pwrOn.length, 16); // 13 + 3
  assert.deepStrictEqual(Array.from(pwrOn.subarray(0, 7)), Array.from(SPTECH_MAGIC));
  assert.strictEqual(pwrOn[7], 0x03); // Message Type
  assert.strictEqual(pwrOn[8], 0x58); // Key
  assert.strictEqual(pwrOn[11], 0x00);
  assert.strictEqual(pwrOn[12], 0x03); // Payload len = 3
  assert.deepStrictEqual(Array.from(pwrOn.subarray(13)), [0x03, 0x01, 0x01]);

  // Power OFF
  const pwrOff = SpnetCodec.encodePower(false);
  assert.deepStrictEqual(Array.from(pwrOff.subarray(13)), [0x03, 0x01, 0x00]);

  // Brightness (20% safety limit = 51)
  const bright = SpnetCodec.encodeBrightness(51);
  assert.deepStrictEqual(Array.from(bright.subarray(13)), [0x03, 0x02, 51]);

  // Color Red (#FF0000)
  const red = SpnetCodec.encodeColor(255, 0, 0);
  assert.strictEqual(red.length, 18); // 13 + 5
  assert.strictEqual(red[12], 0x05); // Payload len = 5
  assert.deepStrictEqual(Array.from(red.subarray(13)), [0x03, 0x04, 255, 0, 0]);

  // Dynamic Effect Mode 1
  const effect = SpnetCodec.encodeEffectMode(1);
  assert.deepStrictEqual(Array.from(effect.subarray(13)), [0x03, 0x06, 1]);

  // Effect Speed & Direction
  const speed = SpnetCodec.encodeEffectSpeed(128);
  assert.deepStrictEqual(Array.from(speed.subarray(13)), [0x03, 0x07, 128]);

  const dir = SpnetCodec.encodeEffectDirection(true);
  assert.deepStrictEqual(Array.from(dir.subarray(13)), [0x03, 0x08, 0x01]);
});
