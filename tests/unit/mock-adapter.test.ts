import test from 'node:test';
import assert from 'node:assert';
import { MockAdapter } from '../../packages/adapters/src/mock/mock-adapter.ts';

test('MockAdapter discovers mock devices with differing capabilities', async () => {
  const adapter = new MockAdapter();
  const discovered: string[] = [];

  await adapter.startDiscovery((device) => {
    discovered.push(device.id);
  });

  assert.strictEqual(discovered.length, 2);
  assert.ok(discovered.includes('mock-sp530e'));
  assert.ok(discovered.includes('mock-dig2go-wled'));

  const sp530e = adapter.getDeviceById('mock-sp530e')!;
  assert.strictEqual(sp530e.capabilities.supportsICConfiguration, true);
  assert.strictEqual(sp530e.capabilities.maxPixelCount, 1200);

  const dig2go = adapter.getDeviceById('mock-dig2go-wled')!;
  assert.strictEqual(dig2go.capabilities.supportsICConfiguration, false);
  assert.strictEqual(dig2go.capabilities.maxPixelCount, 300);
});

test('MockLedDevice connects, disconnects, and manages power state', async () => {
  const adapter = new MockAdapter();
  const device = adapter.getDeviceById('mock-sp530e')!;

  assert.strictEqual(device.connectionInfo.connected, false);
  await device.connect();
  assert.strictEqual(device.connectionInfo.connected, true);

  await device.setPower(false);
  assert.strictEqual(device.state.power, false);

  await device.setPower(true);
  assert.strictEqual(device.state.power, true);

  await device.disconnect();
  assert.strictEqual(device.connectionInfo.connected, false);
});

test('MockLedDevice sets brightness, color, and effects within bounds', async () => {
  const adapter = new MockAdapter();
  const device = adapter.getDeviceById('mock-sp530e')!;
  await device.connect();

  await device.setBrightness(120); // Should clamp to 100
  assert.strictEqual(device.state.brightness, 100);

  await device.setBrightness(-10); // Should clamp to 0
  assert.strictEqual(device.state.brightness, 0);

  await device.setColor({ r: 255, g: 128, b: 0 });
  assert.deepStrictEqual(device.state.color, { r: 255, g: 128, b: 0 });
  assert.strictEqual(device.state.mode, 'solid');

  await device.setEffect(1, 75);
  assert.strictEqual(device.state.mode, 'effect');
  assert.strictEqual(device.state.effectId, 1);
  assert.strictEqual(device.state.effectSpeed, 75);
});
