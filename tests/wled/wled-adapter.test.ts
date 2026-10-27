import { test, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { WledMockServer } from './wled-mock-server.ts';
import { WledDevice, WledAdapter } from '../../packages/adapters/src/wled/wled-adapter.ts';

let mockServer: WledMockServer;
let mockPort = 0;

before(async () => {
  mockServer = new WledMockServer();
  const info = await mockServer.start(0);
  mockPort = info.port;
});

after(async () => {
  await mockServer.stop();
});

test('WledDevice connects to mock HTTP/WS server and populates QuinLED dig2go metadata', async () => {
  const device = new WledDevice('127.0.0.1', mockPort, 'Test Dig2Go');

  const connected = await device.connect();
  assert.strictEqual(connected, true);
  assert.strictEqual(device.connectionInfo.state, 'connected');

  // Verify capabilities derived from mock QuinLED dig2go
  assert.strictEqual(device.capabilities.family, 'wled');
  assert.ok(device.capabilities.firmwareInfo?.model?.includes('dig2go'));
  assert.strictEqual(device.capabilities.firmwareInfo?.version, '0.14.1');
  assert.strictEqual(device.capabilities.maxTotalPixels, 300);
  assert.strictEqual(device.capabilities.supportsMusicReactive, true);

  // Dynamic effects and palettes lists populated from server
  assert.ok(device.effects.length > 50, `Effects count should be > 50, got: ${device.effects.length}`);
  assert.ok(device.effects.includes('Rainbow'));
  assert.ok(device.palettes.length > 30, `Palettes count should be > 30, got: ${device.palettes.length}`);

  await device.disconnect();
  assert.strictEqual(device.connectionInfo.state, 'disconnected');
});

test('WledDevice handles power, brightness, and color commands', async () => {
  const device = new WledDevice('127.0.0.1', mockPort);
  await device.connect();

  // Power OFF
  await device.setPower(false);
  assert.strictEqual(device.state.power, false);
  assert.strictEqual(mockServer.state.on, false);

  // Power ON
  await device.setPower(true);
  assert.strictEqual(device.state.power, true);
  assert.strictEqual(mockServer.state.on, true);

  // Brightness 20%
  await device.setBrightness(20);
  assert.strictEqual(device.state.brightness, 20);
  assert.strictEqual(mockServer.state.bri, 51); // 20% of 255 = 51

  // Color RGB
  await device.setColor({ r: 0, g: 255, b: 128, hex: '#00FF80' });
  assert.strictEqual(device.state.color.r, 0);
  assert.strictEqual(device.state.color.g, 255);
  assert.strictEqual(device.state.color.b, 128);
  assert.deepStrictEqual(mockServer.state.seg?.[0]?.col?.[0], [0, 255, 128]);

  await device.disconnect();
});

test('WledDevice handles effect, speed, intensity, and palette commands', async () => {
  const device = new WledDevice('127.0.0.1', mockPort);
  await device.connect();

  // Rainbow effect (ID 9), speed 75%, intensity 80%, palette 6 (Party)
  await device.setEffect(9, 75, 80, 6);
  assert.strictEqual(device.state.mode, 'effect');
  assert.strictEqual(device.state.effectId, 9);
  assert.strictEqual(device.state.effectSpeed, 75);

  const seg0 = mockServer.state.seg?.[0];
  assert.strictEqual(seg0?.fx, 9);
  assert.strictEqual(seg0?.sx, 191); // 75% of 255
  assert.strictEqual(seg0?.ix, 204); // 80% of 255
  assert.strictEqual(seg0?.pal, 6);

  // Set palette independently
  await device.setPalette(11); // Ocean palette
  assert.strictEqual(mockServer.state.seg?.[0]?.pal, 11);

  await device.disconnect();
});

test('WledDevice handles multi-segment configuration', async () => {
  const device = new WledDevice('127.0.0.1', mockPort);
  await device.connect();

  // Configure 2 segments: Segment 0 (0-150), Segment 1 (150-300)
  await device.setSegments([
    { id: 0, start: 0, stop: 150, length: 150, on: true, effectId: 0, color: { r: 255, g: 0, b: 0, hex: '#FF0000' } },
    { id: 1, start: 150, stop: 300, length: 150, on: true, effectId: 9, speed: 50, color: { r: 0, g: 0, b: 255, hex: '#0000FF' } },
  ]);

  assert.strictEqual(device.state.activeSegments, 2);
  assert.strictEqual(mockServer.state.seg?.length, 2);
  assert.strictEqual(mockServer.state.seg?.[0]?.start, 0);
  assert.strictEqual(mockServer.state.seg?.[0]?.stop, 150);
  assert.strictEqual(mockServer.state.seg?.[1]?.start, 150);
  assert.strictEqual(mockServer.state.seg?.[1]?.stop, 300);

  // Update individual segment
  await device.setSegment(1, { effectId: 38, speed: 90, color: { r: 255, g: 100, b: 0, hex: '#FF6400' } });
  assert.strictEqual(mockServer.state.seg?.[1]?.fx, 38);
  assert.strictEqual(mockServer.state.seg?.[1]?.sx, 230); // 90% of 255

  await device.disconnect();
});

test('WledDevice handles presets and playlists', async () => {
  const device = new WledDevice('127.0.0.1', mockPort);
  await device.connect();

  // Fetch presets from /presets.json
  const presets = await device.fetchPresets();
  assert.ok(presets.length >= 3);
  assert.strictEqual(presets[0]?.name, 'Warm Glow (20%)');

  // Apply preset 2
  await device.applyPreset(2);
  assert.strictEqual(mockServer.state.ps, 2);

  // Save preset 4
  await device.savePreset(4, 'Reading Lamp');
  assert.ok(mockServer.presets['4']);
  assert.strictEqual(mockServer.presets['4']?.n, 'Reading Lamp');

  // Delete preset 4
  await device.deletePreset(4);
  assert.strictEqual(mockServer.presets['4'], undefined);

  // Apply playlist
  await device.applyPlaylist([1, 2], [5, 10], 2);
  assert.ok(mockServer.lastReceivedPayload.playlist);
  assert.deepStrictEqual(mockServer.lastReceivedPayload.playlist.ps, [1, 2]);

  await device.disconnect();
});

test('WledAdapter handles manual IP registration and discovery', async () => {
  const adapter = new WledAdapter();

  // Manual IP add
  const dev1 = adapter.addDevice('127.0.0.1', mockPort, 'Desk Controller');
  assert.strictEqual(dev1.id, 'wled-127-0-0-1');
  assert.strictEqual(adapter.getDiscoveredDevices().length, 1);

  // Discovery with candidate hosts
  const foundDevices: string[] = [];
  await adapter.startDiscovery(
    (dev) => {
      foundDevices.push(dev.id);
    },
    { candidateHosts: ['127.0.0.1'], timeoutMs: 500 }
  );

  assert.ok(foundDevices.includes('wled-127-0-0-1'));
  await adapter.stopDiscovery();
});
