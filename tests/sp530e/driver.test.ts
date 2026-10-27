import test from 'node:test';
import assert from 'node:assert';
import { Sp530eDriver } from '../../packages/adapters/src/sp530e/sp530e-driver.ts';
import type { ISp530eTransport, TransportDiscoveredDevice, Sp530eTransportKind } from '../../packages/adapters/src/sp530e/sp530e-transport-interface.ts';
import type { LedState } from '../../packages/core/src/types.ts';

// Mock transport to test driver queueing, retry logic, and timeouts
class MockSp530eTransport implements ISp530eTransport {
  readonly kind: Sp530eTransportKind = 'mock';
  isConnected = false;
  writtenFrames: Uint8Array[] = [];
  shouldFailWrites = 0; // Number of writes to fail before succeeding
  writeDelayMs = 0;

  private notificationListeners = new Set<(bytes: Uint8Array) => void>();
  private errorListeners = new Set<(err: Error) => void>();
  private disconnectListeners = new Set<() => void>();

  async connect(): Promise<boolean> {
    this.isConnected = true;
    return true;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    for (const l of this.disconnectListeners) l();
  }

  async discover(): Promise<TransportDiscoveredDevice[]> {
    return [
      { id: 'mock-1', name: 'Mock SP530E', address: '127.0.0.1:8587', transport: 'mock' },
    ];
  }

  async writeBytes(bytes: Uint8Array): Promise<boolean> {
    if (this.writeDelayMs > 0) {
      await new Promise(r => setTimeout(r, this.writeDelayMs));
    }

    if (this.shouldFailWrites > 0) {
      this.shouldFailWrites--;
      throw new Error('Simulated write failure on transport');
    }

    this.writtenFrames.push(new Uint8Array(bytes));
    return true;
  }

  async queryState(): Promise<LedState | null> {
    return {
      power: true,
      brightness: 20,
      color: { r: 255, g: 128, b: 0, hex: '#FF8000' },
      mode: 'solid',
    };
  }

  onNotification(listener: (bytes: Uint8Array) => void): () => void {
    this.notificationListeners.add(listener);
    return () => this.notificationListeners.delete(listener);
  }

  onError(listener: (err: Error) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  onDisconnect(listener: () => void): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  emitTestNotification(bytes: Uint8Array): void {
    for (const l of this.notificationListeners) l(bytes);
  }
}

test('Sp530eDriver initializes in dry-run mode and executes commands safely', async () => {
  const driver = new Sp530eDriver({ transportKind: 'wifi-tcp', dryRun: true });
  assert.strictEqual(driver.dryRun, true);
  assert.strictEqual(driver.safetyBrightnessLimit, 20);

  const connected = await driver.connect('192.168.86.34:8587');
  assert.strictEqual(connected, true);

  // Power
  await driver.setPower(true);
  assert.strictEqual(driver.getState().power, true);
  assert.ok(driver.lastEncodedFrame);
  assert.strictEqual(driver.lastEncodedFrame[7], 0x03); // SPTECH control type

  // Brightness clamping to 20% safety limit
  await driver.setBrightness(80); // Should clamp to 20%
  assert.strictEqual(driver.getState().brightness, 20);

  // Colors
  await driver.setColor(255, 0, 128);
  assert.strictEqual(driver.getState().color.r, 255);
  assert.strictEqual(driver.getState().color.g, 0);
  assert.strictEqual(driver.getState().color.b, 128);

  // Effects
  await driver.setEffect(1, 50);
  assert.strictEqual(driver.getState().mode, 'effect');
  assert.strictEqual(driver.getState().effectId, 1);
  assert.strictEqual(driver.getState().effectSpeed, 50);

  await driver.disconnect();
});

test('Sp530eDriver serializes concurrent commands sequentially', async () => {
  const mockTransport = new MockSp530eTransport();
  mockTransport.writeDelayMs = 25; // 25ms artificial delay per write

  const driver = new Sp530eDriver({ transport: mockTransport, dryRun: false });
  await driver.connect();

  // Launch three rapid concurrent operations
  const p1 = driver.setPower(true);
  const p2 = driver.setColor(255, 0, 0);
  const p3 = driver.setBrightness(20);

  await Promise.all([p1, p2, p3]);

  // All three commands must have executed in exact sequence without collision
  assert.strictEqual(mockTransport.writtenFrames.length, 3);
  assert.strictEqual(driver.getState().power, true);
  assert.strictEqual(driver.getState().color.r, 255);
  assert.strictEqual(driver.getState().brightness, 20);
});

test('Sp530eDriver retries failed transport writes with backoff', async () => {
  const mockTransport = new MockSp530eTransport();
  // Transport will fail once, then succeed on retry
  mockTransport.shouldFailWrites = 1;

  const driver = new Sp530eDriver({
    transport: mockTransport,
    dryRun: false,
    maxReconnectAttempts: 3,
  });
  await driver.connect();

  // Command should succeed despite 1 transient failure
  const success = await driver.setPower(false);
  assert.strictEqual(success, true);
  assert.strictEqual(driver.getState().power, false);
  assert.strictEqual(mockTransport.writtenFrames.length, 1);
});
