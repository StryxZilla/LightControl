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

    // Give mock loopback server a moment to drain the socket
    await new Promise((r) => setTimeout(r, 50));

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
    device.enforceSafetyLimits = false;

    await device.setPower(true);
    // Allow loopback server to receive the paced re-illumination packet
    await new Promise((r) => setTimeout(r, 60));

    // Verify commands sent:
    // 1. Power ON: 53 50 54 45 43 48 00 50 00 00 00 00 01 01
    // 2. Restore Color: 53 50 54 45 43 48 00 52 00 00 00 00 04 00 ff ff ff
    // Note: 0x51 is intentionally not sent in solid mode to avoid PWM output conflicts with SPI-RGB LEDs
    const opcodes = commandsSent.map((c) => c[7]);
    assert.ok(opcodes.includes(0x50), 'Must transmit 0x50 Power command');
    assert.ok(opcodes.includes(0x52), 'Must transmit 0x52 Static Color to re-illuminate WS2812B pixels');
    assert.ok(!opcodes.includes(0x51), 'Must not transmit 0x51 PWM Brightness level in solid mode to prevent SPI blanking');

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

test('SPTech Light Mode Switching: setEffect sets Mode 2, setColor asserts Mode 1, and setMusicMode sets Mode 3', async () => {
  const commandsSent: Uint8Array[] = [];
  const fixturePath = path.resolve('protocol/fixtures/sp530e_status_response.bin');
  const fixtureData = fs.readFileSync(fixturePath);

  const server = net.createServer((socket) => {
    socket.on('data', (chunk) => {
      commandsSent.push(new Uint8Array(chunk));
      if (chunk.length >= 8 && chunk[7] === 0x02) {
        socket.write(fixtureData);
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as net.AddressInfo).port;
  const device = new SP530EWiFiDevice('127.0.0.1', port, 'Mode Switch Test');

  try {
    await device.connect();
    commandsSent.length = 0;

    // 1. Switch to Dynamic Effect 15
    await device.setEffect(15);
    await new Promise((r) => setTimeout(r, 50));
    const effectCmd = commandsSent.find((c) => c[7] === 0x53);
    assert.ok(effectCmd, 'Must transmit 0x53 for EffectMode');
    assert.strictEqual(effectCmd[12], 0x02, 'Payload length must be 2 bytes');
    assert.strictEqual(effectCmd[13], 0x03, 'Byte 0 must be Mode 3 (Dynamic Mode for SPI RGB)');
    assert.strictEqual(effectCmd[14], 15, 'Byte 1 must be Effect ID 15');
    assert.strictEqual(device.state.mode, 'effect');

    // Also verify EffectPlay (0x5D) was transmitted
    const playCmd = commandsSent.find((c) => c[7] === 0x5d);
    assert.ok(playCmd, 'Must transmit 0x5D to unpause dynamic animations');
    assert.strictEqual(playCmd[13], 0x01, 'EffectPlay must be 0x01');

    commandsSent.length = 0;

    // 2. Switch back to Solid Color (Red) from Effect mode
    await device.setColor({ r: 255, g: 0, b: 0 });
    await new Promise((r) => setTimeout(r, 50));
    // Must transmit 0x53 (Mode 1 Static) AND 0x52 (Static Color)
    const modeCmds = commandsSent.filter((c) => c[7] === 0x53);
    assert.ok(modeCmds.length >= 1, 'Must transmit 0x53 to switch mode to Static Color');
    const staticModeCmd = modeCmds[0]!;
    assert.strictEqual(staticModeCmd[13], 0x01, 'Byte 0 must be Mode 1 (Static Mode)');
    assert.strictEqual(staticModeCmd[14], 0x01, 'Byte 1 must be Effect 1');

    const colorCmd = commandsSent.find((c) => c[7] === 0x52);
    assert.ok(colorCmd, 'Must transmit 0x52 for Color');
    assert.strictEqual(device.state.mode, 'solid');

    commandsSent.length = 0;

    // 3. Switch to Music Mode 4
    await device.setMusicMode(4);
    await new Promise((r) => setTimeout(r, 50));
    const musicCmd = commandsSent.find((c) => c[7] === 0x53);
    assert.ok(musicCmd, 'Must transmit 0x53 for MusicMode');
    assert.strictEqual(musicCmd[13], 0x05, 'Byte 0 must be Mode 5 (Music Mode for SPI RGB)');
    assert.strictEqual(musicCmd[14], 4, 'Byte 1 must be Music Effect 4');
    assert.strictEqual(device.state.mode, 'music');
  } finally {
    await device.disconnect();
    server.close();
  }
});

test('Rapid Power ON/OFF cycling: cancels obsolete color restoration and maintains single connection', async () => {
  const commandsSent: Uint8Array[] = [];
  let socketCount = 0;
  const fixturePath = path.resolve('protocol/fixtures/sp530e_status_response.bin');
  const fixtureData = fs.readFileSync(fixturePath);

  const server = net.createServer((socket) => {
    socketCount++;
    socket.on('data', (chunk) => {
      commandsSent.push(new Uint8Array(chunk));
      if (chunk.length >= 8 && chunk[7] === 0x02) {
        socket.write(fixtureData);
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as net.AddressInfo).port;
  const device = new SP530EWiFiDevice('127.0.0.1', port, 'Rapid Power Test');

  try {
    await device.connect();
    commandsSent.length = 0;

    // Simulate rapid ON followed immediately by OFF (user double click / quick toggle)
    const onPromise = device.setPower(true);
    await new Promise((r) => setTimeout(r, 20)); // Short pause < 120ms power restoration delay
    const offPromise = device.setPower(false);

    await Promise.all([onPromise, offPromise]);

    // Wait 250ms to ensure the 120ms delay in setPower(true) has expired
    await new Promise((r) => setTimeout(r, 250));

    // Device state must remain OFF
    assert.strictEqual(device.state.power, false);

    // Filter power commands
    const powerCommands = commandsSent.filter((c) => c[7] === 0x50);
    assert.ok(powerCommands.length >= 2, 'Must have received Power ON and Power OFF commands');

    // The last power command sent must be Power OFF (0x00)
    const lastPower = powerCommands[powerCommands.length - 1]!;
    assert.strictEqual(lastPower[13], 0x00, 'Final power packet on wire must be Power OFF (0x00)');

    // Crucially: Because setPower(false) occurred before 120ms elapsed,
    // NO color restoration packets (0x52 or 0x53) from setPower(true) should have been sent after Power OFF!
    const lastOffIdx = commandsSent.lastIndexOf(lastPower);
    const trailingCommands = commandsSent.slice(lastOffIdx + 1);
    const trailingColorCmds = trailingCommands.filter((c) => c[7] === 0x52 || (c[7] === 0x53 && c[13] === 0x01));
    assert.strictEqual(trailingColorCmds.length, 0, 'No obsolete color restoration commands sent after Power OFF');

    // Socket count must remain exactly 1 (no rogue tempSockets)
    assert.strictEqual(socketCount, 1, 'Only one persistent TCP session opened throughout rapid cycling');
  } finally {
    await device.disconnect();
    server.close();
  }
});
