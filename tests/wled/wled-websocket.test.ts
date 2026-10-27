import { test, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { WledMockServer } from './wled-mock-server.ts';
import { WledDevice } from '../../packages/adapters/src/wled/wled-adapter.ts';

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

test('WledDevice establishes WebSocket connection and synchronizes real-time state', async () => {
  const device = new WledDevice('127.0.0.1', mockPort);
  await device.connect();

  // Wait 100ms for WebSocket handshake to complete
  await new Promise((r) => setTimeout(r, 100));
  assert.strictEqual(device.isWebSocketConnected, true, 'WebSocket should be in OPEN readyState');

  // Register state change listener
  let receivedStateUpdate = false;
  let updatedPower: boolean | undefined;

  const unsubscribe = device.onStateChange((event) => {
    receivedStateUpdate = true;
    updatedPower = event.state.power;
  });

  // Modify state directly via mock server HTTP POST (which triggers WebSocket broadcast to clients)
  await fetch(`http://127.0.0.1:${mockPort}/json/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ on: false, bri: 25 }),
  });

  // Wait up to 300ms for WebSocket push to arrive
  await new Promise((r) => setTimeout(r, 200));

  assert.strictEqual(receivedStateUpdate, true, 'Device should receive state change via WebSocket');
  assert.strictEqual(updatedPower, false, 'Power state should reflect remote update');
  assert.strictEqual(device.state.power, false);
  assert.strictEqual(device.state.brightness, 10); // 25 / 255 = ~10%

  unsubscribe();
  await device.disconnect();
  assert.strictEqual(device.isWebSocketConnected, false);
});

test('WledDevice sends commands directly over WebSocket when connected', async () => {
  const device = new WledDevice('127.0.0.1', mockPort);
  await device.connect();

  await new Promise((r) => setTimeout(r, 100));
  assert.strictEqual(device.isWebSocketConnected, true);

  // Send power and color commands
  await device.setPower(true);
  await device.setColor({ r: 255, g: 0, b: 255, hex: '#FF00FF' });

  // Wait 100ms for server to receive frame
  await new Promise((r) => setTimeout(r, 100));

  assert.strictEqual(mockServer.state.on, true);
  assert.deepStrictEqual(mockServer.state.seg?.[0]?.col?.[0], [255, 0, 255]);

  await device.disconnect();
});

test('WledDevice gracefully handles connection timeout and unreachable host', async () => {
  // Attempt to connect to an unreachable port
  const badDevice = new WledDevice('127.0.0.1', 65530, 'Unreachable Controller');

  let errorFired = false;
  badDevice.onError((err) => {
    errorFired = true;
    assert.strictEqual(err.code, 'ERR_WLED_CONNECT');
  });

  await assert.rejects(async () => {
    await badDevice.connect();
  });

  assert.strictEqual(errorFired, true);
  assert.strictEqual(badDevice.connectionInfo.state, 'error');
});
