import test from 'node:test';
import assert from 'node:assert';
import * as net from 'node:net';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SP530EWiFiAdapter, SP530EWiFiDevice } from '../../packages/adapters/src/sp530e/sp530e-wifi-adapter.ts';

test('SP530EWiFiAdapter initializes and discovers devices', async () => {
  const adapter = new SP530EWiFiAdapter();
  const discovered: string[] = [];

  await adapter.startDiscovery((device) => {
    discovered.push(device.id);
  });

  assert.strictEqual(discovered.length, 1);
  assert.ok(discovered[0]?.includes('192-168-86-34'));
});

test('SP530EWiFiDevice connects to mock TCP server and parses telemetry into ILedDevice state', async () => {
  const fixturePath = path.resolve('protocol/fixtures/sp530e_status_response.bin');
  const fixtureData = fs.readFileSync(fixturePath);

  // Spin up an ephemeral local TCP server simulating SP530E
  const server = net.createServer((socket) => {
    socket.on('data', () => {
      // Respond with real hardware fixture bytes
      socket.write(fixtureData);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as net.AddressInfo).port;

  const device = new SP530EWiFiDevice('127.0.0.1', port, 'Test Controller');

  try {
    assert.strictEqual(device.connectionInfo.connected, false);
    await device.connect();
    assert.strictEqual(device.connectionInfo.connected, true);

    // Refresh state from mock server
    const state = await device.refreshState();
    assert.strictEqual(state.power, true);
    assert.strictEqual(state.brightness, 100);
    assert.strictEqual(device.capabilities.maxPixelCount, 60); // Updated to 60 from fixture
    assert.strictEqual(device.capabilities.maxSegments, 1);
  } finally {
    await device.disconnect();
    server.close();
  }
});
