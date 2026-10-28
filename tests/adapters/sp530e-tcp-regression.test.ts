import test from 'node:test';
import assert from 'node:assert';
import * as net from 'node:net';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SP530EWiFiDevice } from '../../packages/adapters/src/sp530e/sp530e-wifi-adapter.ts';
import { SpnetCodec } from '../../packages/adapters/src/sp530e/spnet-codec.ts';
import { DiagnosticsService } from '../../packages/core/src/diagnostics.ts';

test('TCP Connection Mutex: concurrent connect() calls share a single socket without racing', async () => {
  let socketCount = 0;
  const fixturePath = path.resolve('protocol/fixtures/sp530e_status_response.bin');
  const fixtureData = fs.readFileSync(fixturePath);

  const server = net.createServer((socket) => {
    socketCount++;
    socket.on('data', () => {
      socket.write(fixtureData);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as net.AddressInfo).port;
  const device = new SP530EWiFiDevice('127.0.0.1', port, 'Concurrency Test Controller');

  try {
    // Fire 5 simultaneous connect() calls
    const [c1, c2, c3, c4, c5] = await Promise.all([
      device.connect(),
      device.connect(),
      device.connect(),
      device.connect(),
      device.connect(),
    ]);

    assert.strictEqual(c1, true);
    assert.strictEqual(c2, true);
    assert.strictEqual(c3, true);
    assert.strictEqual(c4, true);
    assert.strictEqual(c5, true);
    assert.strictEqual(device.connectionInfo.connected, true);

    // Exactly one socket connection was opened on the server
    assert.strictEqual(socketCount, 1);
  } finally {
    await device.disconnect();
    server.close();
  }
});

test('TCP Command Queue: serializes rapid commands and performs bounded retries on socket drop', async () => {
  const receivedCommands: Uint8Array[] = [];
  let connectionCount = 0;
  let activeSocket: net.Socket | null = null;

  const server = net.createServer((socket) => {
    connectionCount++;
    activeSocket = socket;

    socket.on('data', (data) => {
      receivedCommands.push(new Uint8Array(data));

      // Simulate a transient socket drop on the first command
      if (receivedCommands.length === 1 && connectionCount === 1) {
        socket.destroy();
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as net.AddressInfo).port;
  const diag = new DiagnosticsService(50);
  const device = new SP530EWiFiDevice('127.0.0.1', port, 'Queue Test Controller', {
    diagnostics: diag,
  });

  try {
    // Send 3 commands in rapid succession: Power OFF, Brightness 20%, Color Green
    const p1 = device.setPower(false);
    const p2 = device.setBrightness(20);
    const p3 = device.setColor({ r: 0, g: 255, b: 0 });

    const results = await Promise.all([p1, p2, p3]);
    assert.deepStrictEqual(results, [true, true, true]);

    // All 3 commands were successfully transmitted despite the transient socket drop
    assert.strictEqual(receivedCommands.length >= 3, true);
    // At least 2 connections occurred (initial + reconnect after drop)
    assert.strictEqual(connectionCount >= 2, true);
  } finally {
    await device.disconnect();
    server.close();
  }
});

test('TCP Stream Parser: handles split partial packets and multiple frames in a single chunk', async () => {
  const fixturePath = path.resolve('protocol/fixtures/sp530e_status_response.bin');
  const fullPacket = fs.readFileSync(fixturePath);

  let serverSocket: net.Socket | null = null;
  const server = net.createServer((socket) => {
    serverSocket = socket;
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as net.AddressInfo).port;
  const diag = new DiagnosticsService(50);
  const device = new SP530EWiFiDevice('127.0.0.1', port, 'Stream Parser Test', {
    diagnostics: diag,
  });

  try {
    await device.connect();
    assert.ok(serverSocket);

    // Send the first 100 bytes (partial frame)
    (serverSocket as net.Socket).write(fullPacket.subarray(0, 100));
    await new Promise((r) => setTimeout(r, 50));

    // Send the remainder of frame 1 + a second full frame concatenated in one chunk
    const combined = Buffer.concat([fullPacket.subarray(100), fullPacket]);
    (serverSocket as net.Socket).write(combined);

    await new Promise((r) => setTimeout(r, 100));

    // Diagnostics should record complete raw packet responses without truncation
    const responses = diag.getRecentLogs(100).filter((l) => l.category === 'RECEIVE');
    assert.strictEqual(responses.length >= 2, true);

    for (const r of responses) {
      assert.ok(r.message.includes('5350544543480002'));
      assert.strictEqual(r.data?.rawHex?.length, 428 * 2);
    }
  } finally {
    await device.disconnect();
    server.close();
  }
});

test('Physical Re-illumination: setPower(true) re-asserts active color and brightness on wire', async () => {
  const commandsSent: Uint8Array[] = [];
  const fixturePath = path.resolve('protocol/fixtures/sp530e_status_response.bin');
  const fixtureData = fs.readFileSync(fixturePath);

  const server = net.createServer((socket) => {
    socket.on('data', (chunk) => {
      commandsSent.push(new Uint8Array(chunk));
      // Respond to state query
      if (chunk.length >= 8 && chunk[7] === 0x02) {
        socket.write(fixtureData);
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as net.AddressInfo).port;
  const device = new SP530EWiFiDevice('127.0.0.1', port, 'Power Restore Test');

  try {
    await device.connect();
    commandsSent.length = 0; // Clear query frames

    // Set initial color and power
    device.state.color = { r: 0, g: 255, b: 255 }; // Cyan
    device.state.brightness = 100;
    device.state.mode = 'solid';

    await device.setPower(true);

    // Verify commands sent:
    // 1. Power ON: 53 50 54 45 43 48 00 50 00 00 00 00 01 01
    // 2. Restore Color: 53 50 54 45 43 48 00 52 00 00 00 00 04 00 ff ff ff
    // 3. Restore Brightness: 53 50 54 45 43 48 00 51 00 00 00 00 02 00 ff
    const opcodes = commandsSent.map((c) => c[7]);
    assert.ok(opcodes.includes(0x50), 'Must transmit 0x50 Power command');
    assert.ok(opcodes.includes(0x52), 'Must transmit 0x52 Static Color to re-illuminate WS2812B pixels');
    assert.ok(opcodes.includes(0x51), 'Must transmit 0x51 Brightness level');

    const powerCmd = commandsSent.find((c) => c[7] === 0x50)!;
    assert.strictEqual(powerCmd[13], 0x01, 'Power command payload must be 0x01 (ON)');

    const colorCmd = commandsSent.find((c) => c[7] === 0x52)!;
    assert.strictEqual(colorCmd[13], 0x00, 'Color Red must match');
    assert.strictEqual(colorCmd[14], 0xff, 'Color Green must match');
    assert.strictEqual(colorCmd[15], 0xff, 'Color Blue must match');
    assert.strictEqual(colorCmd[16], 0xff, 'Color Level must match full brightness');
  } finally {
    await device.disconnect();
    server.close();
  }
});
