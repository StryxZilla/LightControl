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
  // Power ON: SPTECH\0 + 0x50 + 0x00 + 0x0000 + 0x0001 + [0x01]
  const pwrOn = SpnetCodec.encodePower(true);
  assert.strictEqual(pwrOn.length, 14); // 13 + 1
  assert.deepStrictEqual(Array.from(pwrOn.subarray(0, 7)), Array.from(SPTECH_MAGIC));
  assert.strictEqual(pwrOn[7], 0x50); // Command: POWER
  assert.strictEqual(pwrOn[8], 0x00); // Key: 0x00
  assert.strictEqual(pwrOn[11], 0x00);
  assert.strictEqual(pwrOn[12], 0x01); // Payload len = 1
  assert.deepStrictEqual(Array.from(pwrOn.subarray(13)), [0x01]);

  // Power OFF: SPTECH\0 + 0x50 + 0x00 + 0x0000 + 0x0001 + [0x00]
  const pwrOff = SpnetCodec.encodePower(false);
  assert.strictEqual(pwrOff.length, 14);
  assert.strictEqual(pwrOff[7], 0x50);
  assert.deepStrictEqual(Array.from(pwrOff.subarray(13)), [0x00]);

  // Brightness: SPTECH\0 + 0x51 + 0x00 + 0x0000 + 0x0002 + [0x00, 51]
  const bright = SpnetCodec.encodeBrightness(51);
  assert.strictEqual(bright.length, 15);
  assert.strictEqual(bright[7], 0x51); // Command: BRIGHTNESS
  assert.strictEqual(bright[12], 0x02);
  assert.deepStrictEqual(Array.from(bright.subarray(13)), [0x00, 51]);

  // Color Red (#FF0000): SPTECH\0 + 0x52 + 0x00 + 0x0000 + 0x0004 + [255, 0, 0, 255]
  const red = SpnetCodec.encodeColor(255, 0, 0);
  assert.strictEqual(red.length, 17); // 13 + 4
  assert.strictEqual(red[7], 0x52); // Command: STATIC_COLOR
  assert.strictEqual(red[12], 0x04); // Payload len = 4
  assert.deepStrictEqual(Array.from(red.subarray(13)), [255, 0, 0, 255]);

  // Dynamic Effect Mode 1: SPTECH\0 + 0x53 + 0x00 + 0x0000 + 0x0002 + [0x03, 1]
  const effect = SpnetCodec.encodeEffectMode(1);
  assert.strictEqual(effect.length, 15);
  assert.strictEqual(effect[7], 0x53); // Command: LIGHT_MODE
  assert.strictEqual(effect[12], 0x02); // Payload len = 2
  assert.deepStrictEqual(Array.from(effect.subarray(13)), [0x03, 1]);

  // Static Mode: SPTECH\0 + 0x53 + 0x00 + 0x0000 + 0x0002 + [0x01, 0x01]
  const staticMode = SpnetCodec.encodeStaticMode();
  assert.strictEqual(staticMode.length, 15);
  assert.strictEqual(staticMode[7], 0x53);
  assert.strictEqual(staticMode[12], 0x02);
  assert.deepStrictEqual(Array.from(staticMode.subarray(13)), [0x01, 0x01]);

  // Effect Speed: SPTECH\0 + 0x54 + 0x00 + 0x0000 + 0x0001 + [8] (clamped 1-10)
  const speed = SpnetCodec.encodeEffectSpeed(8);
  assert.strictEqual(speed.length, 14);
  assert.strictEqual(speed[7], 0x54); // Command: EFFECT_SPEED
  assert.deepStrictEqual(Array.from(speed.subarray(13)), [8]);

  // Effect Play: SPTECH\0 + 0x5D + 0x00 + 0x0000 + 0x0001 + [0x01]
  const play = SpnetCodec.encodeEffectPlay(true);
  assert.strictEqual(play.length, 14);
  assert.strictEqual(play[7], 0x5d); // Command: EFFECT_PLAY
  assert.deepStrictEqual(Array.from(play.subarray(13)), [0x01]);

  // Direction: SPTECH\0 + 0x56 + 0x00 + 0x0000 + 0x0001 + [1]
  const dir = SpnetCodec.encodeEffectDirection(true);
  assert.strictEqual(dir.length, 14);
  assert.strictEqual(dir[7], 0x56); // Command: EFFECT_DIRECTION
  assert.deepStrictEqual(Array.from(dir.subarray(13)), [0x01]);
});
