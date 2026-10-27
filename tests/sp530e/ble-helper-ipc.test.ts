import test from 'node:test';
import assert from 'node:assert';
import * as cp from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { Sp530eWindowsBleTransport } from '../../packages/adapters/src/sp530e/sp530e-windows-ble-transport.ts';

test('Sp530eBleHelper executable exists and responds to JSON-RPC ping', async () => {
  const exePath = path.resolve(process.cwd(), 'packages/adapters/src/sp530e/ble-helper/Sp530eBleHelper.exe');
  assert.ok(fs.existsSync(exePath), 'Sp530eBleHelper.exe must exist');

  const proc = cp.spawn(exePath, [], { stdio: ['pipe', 'pipe', 'pipe'] });

  const responsePromise = new Promise<any>((resolve, reject) => {
    let output = '';
    proc.stdout.on('data', (d) => {
      output += d.toString('utf8');
      const lines = output.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line.trim());
          if (parsed.id === 42) {
            resolve(parsed);
            return;
          }
        } catch {
          // ignore non-json
        }
      }
    });

    proc.on('error', reject);
  });

  proc.stdin.write(JSON.stringify({ id: 42, method: 'ping' }) + '\n');

  const res = await responsePromise;
  assert.strictEqual(res.id, 42);
  assert.strictEqual(res.result.pong, true);
  assert.ok(res.result.time);

  proc.kill();
});

test('Sp530eWindowsBleTransport operates in safe dry-run mode without spawning child process', async () => {
  const transport = new Sp530eWindowsBleTransport({ dryRun: true });
  assert.strictEqual(transport.kind, 'ble');
  assert.strictEqual(transport.isConnected, false);

  const connected = await transport.connect('AA:BB:CC:DD:EE:FF');
  assert.strictEqual(connected, true);
  assert.strictEqual(transport.isConnected, true);

  const devices = await transport.discover();
  assert.ok(devices.length >= 1);
  assert.strictEqual(devices[0]?.transport, 'ble');

  // Test dry-run write
  const wrote = await transport.writeBytes(new Uint8Array([0x53, 0x50, 0x00, 0x01, 0x00, 0x01, 0x01]));
  assert.strictEqual(wrote, true);

  await transport.disconnect();
  assert.strictEqual(transport.isConnected, false);
});
