import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { DiagnosticsService, redactSensitiveData, type DiagnosticLogEntry } from '../../packages/core/src/diagnostics.ts';

test('redactSensitiveData masks passwords, secrets, and credentials', () => {
  const sensitiveObj = {
    user: 'testUser',
    password: 'superSecretPassword123',
    token: 'jwt.token.abc',
    nested: {
      auth_secret: 'nestedSecret',
      normalField: 'hello',
    },
    list: [
      { key: 'secretKey', value: '12345' },
    ],
  };

  const sanitized = redactSensitiveData(sensitiveObj);
  assert.strictEqual(sanitized.user, 'testUser');
  assert.strictEqual(sanitized.password, '[REDACTED]');
  assert.strictEqual(sanitized.token, '[REDACTED]');
  assert.strictEqual(sanitized.nested.auth_secret, '[REDACTED]');
  assert.strictEqual(sanitized.nested.normalField, 'hello');
  assert.strictEqual(sanitized.list[0].key, '[REDACTED]');
  assert.strictEqual(sanitized.list[0].value, '12345');
});

test('DiagnosticsService records logs, notifies listeners, and persists to file', () => {
  const tmpLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lightcontrol-test-'));
  const logFilePath = path.join(tmpLogDir, 'diagnostic-test.log');

  const diag = new DiagnosticsService(50, logFilePath);
  assert.strictEqual(diag.getLogFilePath(), logFilePath);

  const receivedEntries: DiagnosticLogEntry[] = [];
  const unsub = diag.onLog((entry) => {
    receivedEntries.push(entry);
  });

  // Log scan start
  diag.logScan('START', 'wifi-tcp', { subnet: '192.168.86.0/24' });
  // Log device discovered
  diag.logDeviceDiscovered({
    id: 'sp530e-1',
    name: 'SP530E Living Room',
    transport: 'wifi-tcp',
    address: '192.168.86.34:8587',
  });
  // Log command transmitted
  diag.logCommandTransmitted('sp530e-1', 'Power ON', '53505445434800035800000003030101', 16);
  // Log response received
  diag.logDeviceResponse('sp530e-1', '5350544543480002000000019f', 45);

  assert.strictEqual(receivedEntries.length, 4);
  assert.strictEqual(receivedEntries[0]?.category, 'SCAN');
  assert.strictEqual(receivedEntries[1]?.category, 'DISCOVERY');
  assert.strictEqual(receivedEntries[2]?.category, 'TRANSMIT');
  assert.strictEqual(receivedEntries[3]?.category, 'RECEIVE');

  // Verify file was written
  assert.ok(fs.existsSync(logFilePath));
  const fileContent = fs.readFileSync(logFilePath, 'utf8');
  assert.ok(fileContent.includes('[SCAN] [START]'));
  assert.ok(fileContent.includes('[DISCOVERY] [DISCOVERED]'));
  assert.ok(fileContent.includes('[TRANSMIT] [TRANSMITTED]'));
  assert.ok(fileContent.includes('[RECEIVE] [RESPONSE_RECEIVED]'));

  // Test unsubscribe
  unsub();
  diag.log('info', 'TEST', 'After unsubscribe');
  assert.strictEqual(receivedEntries.length, 4); // Did not receive 5th log

  // Cleanup
  fs.rmSync(tmpLogDir, { recursive: true, force: true });
});
