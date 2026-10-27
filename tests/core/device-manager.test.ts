import test from 'node:test';
import assert from 'node:assert';
import { DeviceManager } from '../../packages/core/src/device-manager.ts';
import { MockAdapter, MockLedDevice } from '../../packages/adapters/src/mock/mock-adapter.ts';

test('DeviceManager registers adapters via Dependency Injection and coordinates discovery', async () => {
  const manager = new DeviceManager();
  const mockAdapter = new MockAdapter();

  manager.registerAdapter(mockAdapter);
  assert.strictEqual(manager.getAdapters().length, 1);
  assert.strictEqual(manager.getAdapter('mock'), mockAdapter);

  await manager.startDiscovery();
  const devices = manager.getDiscoveredDevices();

  assert.strictEqual(devices.length, 2);
  const sp530e = manager.getDevice('mock-sp530e');
  assert.ok(sp530e);
  assert.strictEqual(sp530e?.name, 'Simulated SP530E Controller');

  const wled = manager.getDevice('mock-dig2go-wled');
  assert.ok(wled);
  assert.strictEqual(wled?.family, 'wled');

  await manager.stopDiscovery();
});

test('DeviceManager handles connect and disconnect lifecycle with dry-run mode', async () => {
  const manager = new DeviceManager();
  const mockAdapter = new MockAdapter();
  manager.registerAdapter(mockAdapter);
  await manager.startDiscovery();

  // Test dry run mode
  manager.setDryRun(true);
  assert.strictEqual(manager.isDryRun(), true);
  const dryConnected = await manager.connectDevice('mock-sp530e');
  assert.strictEqual(dryConnected, true);

  // Turn dry run off and perform actual connection
  manager.setDryRun(false);
  const connected = await manager.connectDevice('mock-sp530e');
  assert.strictEqual(connected, true);

  const device = manager.getDevice('mock-sp530e');
  assert.strictEqual(device?.connectionInfo.state, 'connected');

  await manager.disconnectDevice('mock-sp530e');
  assert.strictEqual(device?.connectionInfo.state, 'disconnected');
});

test('DeviceManager throws error when attempting to connect unknown device', async () => {
  const manager = new DeviceManager();
  await assert.rejects(
    async () => {
      await manager.connectDevice('nonexistent-device-id');
    },
    /Cannot connect: device nonexistent-device-id not found/
  );
});

test('DeviceManager enforces connection timeout when device connection hangs', async () => {
  const manager = new DeviceManager();

  // Custom mock device that hangs indefinitely on connect()
  class HangingDevice extends MockLedDevice {
    override async connect(): Promise<boolean> {
      return new Promise(() => {}); // Never resolves
    }
  }

  const hangingDev = new HangingDevice('hanging-dev-1', 'Hanging Controller');
  const hangingAdapter = new MockAdapter([hangingDev]);
  manager.registerAdapter(hangingAdapter);
  await manager.startDiscovery();

  await assert.rejects(
    async () => {
      await manager.connectDevice('hanging-dev-1', 50); // 50ms timeout
    },
    /timed out after 50 ms/
  );
});
