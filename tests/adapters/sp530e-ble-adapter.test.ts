import test from 'node:test';
import assert from 'node:assert';
import { SP530EBleAdapter, SP530EBleDevice } from '../../packages/adapters/src/sp530e/sp530e-ble-adapter.ts';
import {
  SP530E_BLE_SERVICE_UUID,
  SP530E_BLE_CHARACTERISTIC_UUID,
  Sp530eBleOpcode,
} from '../../packages/adapters/src/sp530e/sp530e-ble-codec.ts';

test('SP530EBleAdapter discovers and registers BLE devices', async () => {
  const device = new SP530EBleDevice('AA:BB:CC:DD:EE:FF', { name: 'Lab SP530E' });
  const adapter = new SP530EBleAdapter([device]);

  assert.strictEqual(adapter.transportName, 'ble');
  assert.strictEqual(adapter.serviceUuid, SP530E_BLE_SERVICE_UUID);
  assert.strictEqual(adapter.characteristicUuid, SP530E_BLE_CHARACTERISTIC_UUID);

  const discovered: string[] = [];
  await adapter.startDiscovery((d) => {
    discovered.push(d.id);
  });

  assert.strictEqual(discovered.length, 1);
  assert.strictEqual(discovered[0], 'sp530e-ble-aabbccddeeff');
  assert.strictEqual(adapter.getDiscoveredDevices().length, 1);
});

test('SP530EBleDevice executes commands in dry-run mode and verifies encoded frame bytes', async () => {
  const device = new SP530EBleDevice('AA:BB:CC:DD:EE:FF', { dryRun: true });
  await device.connect();

  // Test setPower(true)
  await device.setPower(true);
  assert.strictEqual(device.state.power, true);
  assert.ok(device.lastEncodedFrame);
  assert.strictEqual(device.lastEncodedFrame[0], 0x53); // 'S'
  assert.strictEqual(device.lastEncodedFrame[1], 0x50); // 'P'
  assert.strictEqual(device.lastEncodedFrame[3], Sp530eBleOpcode.POWER);
  assert.strictEqual(device.lastEncodedFrame[6], 0x01); // ON

  // Test setBrightness(20) (clamped to safety limit)
  await device.setBrightness(20);
  assert.strictEqual(device.state.brightness, 20);
  assert.strictEqual(device.lastEncodedFrame[3], Sp530eBleOpcode.BRIGHTNESS);
  assert.strictEqual(device.lastEncodedFrame[6], 51); // 20% of 255 = 51

  // Test setColor(red)
  await device.setColor({ r: 255, g: 0, b: 0 });
  assert.deepStrictEqual(device.state.color, { r: 255, g: 0, b: 0 });
  assert.strictEqual(device.lastEncodedFrame[3], Sp530eBleOpcode.COLOR_RGB);
  assert.strictEqual(device.lastEncodedFrame[6], 255);
  assert.strictEqual(device.lastEncodedFrame[7], 0);
  assert.strictEqual(device.lastEncodedFrame[8], 0);

  // Test setEffect(1, 50)
  await device.setEffect(1, 50);
  assert.strictEqual(device.state.mode, 'effect');
  assert.strictEqual(device.state.effectId, 1);
  assert.strictEqual(device.lastEncodedFrame[3], Sp530eBleOpcode.EFFECT_MODE);
  assert.strictEqual(device.lastEncodedFrame[6], 1);

  await device.disconnect();
  assert.strictEqual(device.connectionInfo.state, 'disconnected');
});

test('SP530EBleDevice.handleNotification ingests telemetry frame and updates device state', async () => {
  const device = new SP530EBleDevice('AA:BB:CC:DD:EE:FF');
  await device.connect();

  // Simulated 14-byte notification frame:
  // [0..1] 'SP'
  // [2] Seq 0x01
  // [3] Opcode 0x00
  // [4..5] Len 0x0008
  // [6] Power 0x01
  // [7] Mode 0x01 (effect 1)
  // [8] Speed 0x32 (50)
  // [9] Brightness 0x33 (51 -> 20%)
  // [10] R 0xFF
  // [11] G 0x00
  // [12] B 0x80
  // [13] White 0x00
  const notificationFrame = new Uint8Array([
    0x53, 0x50, 0x01, 0x00, 0x00, 0x08,
    0x01, 0x01, 0x32, 0x33, 0xff, 0x00, 0x80, 0x00
  ]);

  device.handleNotification(notificationFrame);

  assert.strictEqual(device.state.power, true);
  assert.strictEqual(device.state.mode, 'effect');
  assert.strictEqual(device.state.effectId, 1);
  assert.strictEqual(device.state.brightness, 20);
  assert.strictEqual(device.state.color.r, 255);
  assert.strictEqual(device.state.color.g, 0);
  assert.strictEqual(device.state.color.b, 128);
});
