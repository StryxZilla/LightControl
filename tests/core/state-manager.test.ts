import test from 'node:test';
import assert from 'node:assert';
import { DeviceStateManager } from '../../packages/core/src/state-manager.ts';
import { MockLedDevice } from '../../packages/adapters/src/mock/mock-adapter.ts';
import type { DeviceStateChangeEvent, DeviceErrorEvent } from '../../packages/core/src/types.ts';

test('DeviceStateManager registers device and captures initial state', () => {
  const stateMgr = new DeviceStateManager();
  const mockDev = new MockLedDevice('test-dev', 'Test Device', {}, {
    power: true,
    brightness: 20,
    color: { r: 255, g: 100, b: 50 },
  });

  stateMgr.registerDevice(mockDev);

  const state = stateMgr.getState('test-dev');
  assert.ok(state);
  assert.strictEqual(state?.power, true);
  assert.strictEqual(state?.brightness, 20);
  assert.strictEqual(state?.color.r, 255);
});

test('DeviceStateManager notifies subscribers on optimistic updates and commits updates', () => {
  const stateMgr = new DeviceStateManager();
  const mockDev = new MockLedDevice('test-dev', 'Test Device');
  stateMgr.registerDevice(mockDev);

  const events: DeviceStateChangeEvent[] = [];
  const unsubscribe = stateMgr.subscribe((e) => {
    events.push(e);
  });

  // Apply optimistic update
  stateMgr.setOptimisticState('test-dev', { brightness: 50, power: false });
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0]?.state.brightness, 50);
  assert.strictEqual(events[0]?.state.power, false);

  // Read current cached state
  const cached = stateMgr.getState('test-dev');
  assert.strictEqual(cached?.brightness, 50);

  // Unsubscribe and verify no more events received
  unsubscribe();
  stateMgr.setOptimisticState('test-dev', { brightness: 75 });
  assert.strictEqual(events.length, 1);
});

test('DeviceStateManager rolls back state and emits error event when command fails', () => {
  const stateMgr = new DeviceStateManager();
  const mockDev = new MockLedDevice('test-dev', 'Test Device', {}, { brightness: 20 });
  stateMgr.registerDevice(mockDev);

  const errorEvents: DeviceErrorEvent[] = [];
  stateMgr.subscribeErrors((err) => {
    errorEvents.push(err);
  });

  // Optimistically set to 80%
  stateMgr.setOptimisticState('test-dev', { brightness: 80 });
  assert.strictEqual(stateMgr.getState('test-dev')?.brightness, 80);

  // Rollback on simulated network/hardware rejection
  stateMgr.rollback('test-dev', 'GATT write timed out');

  // Verify state restored to initial 20%
  assert.strictEqual(stateMgr.getState('test-dev')?.brightness, 20);

  // Verify error event was emitted
  assert.strictEqual(errorEvents.length, 1);
  assert.strictEqual(errorEvents[0]?.code, 'ERR_ROLLBACK');
  assert.ok(errorEvents[0]?.message.includes('GATT write timed out'));
});
