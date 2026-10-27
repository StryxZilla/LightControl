import test from 'node:test';
import assert from 'node:assert';
import { DeviceRateLimiter } from '../../packages/core/src/device-manager.ts';

test('DeviceRateLimiter executes first call immediately and throttles rapid subsequent calls', async () => {
  const limiter = new DeviceRateLimiter({ minIntervalMs: 40 });
  const history: number[] = [];

  // Call 1: Immediate execution
  await limiter.execute('device-1', async () => {
    history.push(1);
  });
  assert.strictEqual(history.length, 1);
  assert.strictEqual(history[0], 1);

  // Rapid calls in sequence: 2, 3, 4
  const p2 = limiter.execute('device-1', async () => {
    history.push(2);
  });
  const p3 = limiter.execute('device-1', async () => {
    history.push(3);
  });
  const p4 = limiter.execute('device-1', async () => {
    history.push(4);
  });

  // Wait for all to complete
  await Promise.all([p2, p3, p4]);

  // Intermediate values (2, 3) are coalesced, only the final value (4) executed
  assert.strictEqual(history.length, 2);
  assert.strictEqual(history[1], 4);
});

test('DeviceRateLimiter handles multiple distinct devices independently', async () => {
  const limiter = new DeviceRateLimiter({ minIntervalMs: 40 });
  const historyDevA: number[] = [];
  const historyDevB: number[] = [];

  // Device A call
  await limiter.execute('dev-A', async () => {
    historyDevA.push(10);
  });

  // Device B call immediately after should execute without waiting for A's cooldown
  await limiter.execute('dev-B', async () => {
    historyDevB.push(20);
  });

  assert.strictEqual(historyDevA.length, 1);
  assert.strictEqual(historyDevB.length, 1);
});

test('DeviceRateLimiter clear cancels pending throttled calls', async () => {
  const limiter = new DeviceRateLimiter({ minIntervalMs: 50 });
  const executed: number[] = [];

  await limiter.execute('dev-1', async () => {
    executed.push(1);
  });

  // Queue a trailing execution
  limiter.execute('dev-1', async () => {
    executed.push(2);
  });

  // Clear immediately
  limiter.clear();

  // Wait 60ms to verify trailing call does not fire
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.strictEqual(executed.length, 1);
});
