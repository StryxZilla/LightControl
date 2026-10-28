import type {
  ILedDevice,
  ILedAdapter,
  TransportType,
  DeviceErrorEvent,
} from './types.ts';
import { DeviceStateManager } from './state-manager.ts';

export interface RateLimiterOptions {
  minIntervalMs?: number; // Minimum milliseconds between physical write commands
}

/**
 * Command Rate Limiter & Coalescing Engine
 * Prevents hardware buffer overruns by throttling rapid slider/color wheel events.
 */
export class DeviceRateLimiter {
  private lastExecution = new Map<string, number>();
  private pendingTimer = new Map<string, ReturnType<typeof setTimeout>>();
  private pendingResolvers = new Map<string, Array<{ resolve: (val: any) => void; reject: (err: any) => void }>>();
  private latestFn = new Map<string, () => Promise<any>>();
  private isExecuting = new Map<string, boolean>();
  private readonly minIntervalMs: number;

  constructor(options: RateLimiterOptions = {}) {
    this.minIntervalMs = options.minIntervalMs ?? 50; // 50ms default (20 Hz)
  }

  /**
   * Executes or coalesces a function call for a given device key.
   */
  async execute<T>(deviceKey: string, fn: () => Promise<T>): Promise<T | void> {
    const now = Date.now();
    const last = this.lastExecution.get(deviceKey) ?? 0;
    const elapsed = now - last;
    const busy = this.isExecuting.get(deviceKey) ?? false;

    if (!busy && elapsed >= this.minIntervalMs && !this.pendingTimer.has(deviceKey)) {
      this.lastExecution.set(deviceKey, now);
      this.isExecuting.set(deviceKey, true);
      try {
        return await fn();
      } finally {
        this.isExecuting.set(deviceKey, false);
        this.checkPending(deviceKey);
      }
    }

    // Coalesce into trailing execution
    this.latestFn.set(deviceKey, fn);

    return new Promise((resolve, reject) => {
      const list = this.pendingResolvers.get(deviceKey) ?? [];
      list.push({ resolve, reject });
      this.pendingResolvers.set(deviceKey, list);

      if (!this.pendingTimer.has(deviceKey) && !busy) {
        this.scheduleTrailing(deviceKey, Math.max(1, this.minIntervalMs - elapsed));
      }
    });
  }

  private scheduleTrailing(deviceKey: string, delay: number): void {
    if (this.pendingTimer.has(deviceKey)) return;
    const timer = setTimeout(() => {
      this.pendingTimer.delete(deviceKey);
      this.runTrailing(deviceKey);
    }, delay);
    this.pendingTimer.set(deviceKey, timer);
  }

  private async runTrailing(deviceKey: string): Promise<void> {
    if (this.isExecuting.get(deviceKey)) {
      return;
    }
    const targetFn = this.latestFn.get(deviceKey);
    this.latestFn.delete(deviceKey);
    const waiting = this.pendingResolvers.get(deviceKey) ?? [];
    this.pendingResolvers.delete(deviceKey);

    if (!targetFn && waiting.length === 0) return;

    this.lastExecution.set(deviceKey, Date.now());
    this.isExecuting.set(deviceKey, true);

    try {
      const res = targetFn ? await targetFn() : undefined;
      for (const waiter of waiting) {
        waiter.resolve(res);
      }
    } catch (err) {
      for (const waiter of waiting) {
        waiter.reject(err);
      }
    } finally {
      this.isExecuting.set(deviceKey, false);
      this.checkPending(deviceKey);
    }
  }

  private checkPending(deviceKey: string): void {
    if (this.latestFn.has(deviceKey) && !(this.isExecuting.get(deviceKey) ?? false)) {
      const now = Date.now();
      const last = this.lastExecution.get(deviceKey) ?? 0;
      const elapsed = now - last;
      const delay = Math.max(0, this.minIntervalMs - elapsed);
      if (delay === 0) {
        this.runTrailing(deviceKey);
      } else {
        this.scheduleTrailing(deviceKey, delay);
      }
    }
  }

  clear(): void {
    for (const timer of this.pendingTimer.values()) {
      clearTimeout(timer);
    }
    this.pendingTimer.clear();
    for (const waiting of this.pendingResolvers.values()) {
      for (const waiter of waiting) {
        waiter.resolve(undefined);
      }
    }
    this.pendingResolvers.clear();
    this.latestFn.clear();
    this.lastExecution.clear();
    this.isExecuting.clear();
  }
}

/**
 * Universal Device Manager & Dependency Injection Container
 */
export class DeviceManager {
  private adapters = new Map<TransportType, ILedAdapter>();
  private discoveredDevices = new Map<string, ILedDevice>();
  private stateManager: DeviceStateManager;
  private rateLimiter: DeviceRateLimiter;
  private dryRun = false;

  constructor(stateManager?: DeviceStateManager, rateLimiter?: DeviceRateLimiter) {
    this.stateManager = stateManager ?? new DeviceStateManager();
    this.rateLimiter = rateLimiter ?? new DeviceRateLimiter();
  }

  getStateManager(): DeviceStateManager {
    return this.stateManager;
  }

  getRateLimiter(): DeviceRateLimiter {
    return this.rateLimiter;
  }

  setDryRun(enabled: boolean): void {
    this.dryRun = enabled;
  }

  isDryRun(): boolean {
    return this.dryRun;
  }

  /**
   * Registers a hardware or simulator adapter via Dependency Injection.
   */
  registerAdapter(adapter: ILedAdapter): void {
    this.adapters.set(adapter.transportName, adapter);
  }

  getAdapters(): ILedAdapter[] {
    return Array.from(this.adapters.values());
  }

  getAdapter(transport: TransportType): ILedAdapter | undefined {
    return this.adapters.get(transport);
  }

  /**
   * Starts discovery across all registered adapters concurrently.
   * If clearStale is true, previously discovered devices not found in the new scan are marked 'unavailable'.
   */
  async startDiscovery(clearStale = false): Promise<void> {
    const preDiscoveryIds = new Set(this.discoveredDevices.keys());
    const seenInThisScan = new Set<string>();

    const discoveryPromises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        await adapter.startDiscovery((device) => {
          seenInThisScan.add(device.id);
          this.handleDeviceFound(device);
        });
      } catch (err) {
        console.error(`Error starting discovery on adapter ${adapter.transportName}:`, err);
      }
    });

    await Promise.all(discoveryPromises);

    if (clearStale) {
      for (const id of preDiscoveryIds) {
        if (!seenInThisScan.has(id)) {
          const dev = this.discoveredDevices.get(id);
          if (dev && dev.connectionInfo.state !== 'connected') {
            dev.connectionInfo.state = 'unavailable';
            dev.connectionInfo.connected = false;
          }
        }
      }
    }
  }

  /**
   * Triggers a fresh rescan across all registered adapters.
   */
  async rescan(): Promise<void> {
    await this.startDiscovery(true);
  }

  /**
   * Stops discovery across all registered adapters.
   */
  async stopDiscovery(): Promise<void> {
    const stopPromises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        await adapter.stopDiscovery();
      } catch (err) {
        console.error(`Error stopping discovery on adapter ${adapter.transportName}:`, err);
      }
    });

    await Promise.all(stopPromises);
  }

  registerDevice(device: ILedDevice): void {
    this.handleDeviceFound(device);
  }

  private handleDeviceFound(device: ILedDevice): void {
    const existing = this.discoveredDevices.get(device.id);
    if (!existing) {
      this.discoveredDevices.set(device.id, device);
      this.stateManager.registerDevice(device);
    } else {
      // Update existing device reference and state
      existing.connectionInfo.state = device.connectionInfo.state;
      existing.connectionInfo.connected = device.connectionInfo.connected;
      existing.connectionInfo.address = device.connectionInfo.address;
      existing.connectionInfo.signalStrength = device.connectionInfo.signalStrength;
      existing.connectionInfo.lastSeen = Date.now();
      existing.state = { ...existing.state, ...device.state };
      existing.capabilities = { ...existing.capabilities, ...device.capabilities };
    }
  }

  getDiscoveredDevices(): ILedDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  getDevice(id: string): ILedDevice | undefined {
    return this.discoveredDevices.get(id);
  }

  /**
   * Connects to a device with a configurable timeout.
   */
  async connectDevice(id: string, timeoutMs = 5000): Promise<boolean> {
    const device = this.discoveredDevices.get(id);
    if (!device) {
      throw new Error(`Cannot connect: device ${id} not found in discovered devices.`);
    }

    if (this.dryRun) {
      device.connectionInfo.state = 'connected';
      device.connectionInfo.connected = true;
      device.connectionInfo.lastConnectedAt = Date.now();
      return true;
    }

    device.connectionInfo.state = 'connecting';

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Connection to ${device.name} timed out after ${timeoutMs} ms.`));
      }, timeoutMs);
    });

    try {
      const success = await Promise.race([device.connect(), timeoutPromise]);
      if (timer) clearTimeout(timer);
      if (success) {
        device.connectionInfo.state = 'connected';
        device.connectionInfo.connected = true;
      }
      return success;
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      device.connectionInfo.state = 'error';
      device.connectionInfo.connected = false;
      const errorEvent: DeviceErrorEvent = {
        deviceId: id,
        code: 'ERR_CONNECT_TIMEOUT',
        message: err.message,
        timestamp: Date.now(),
        recoverable: true,
      };
      this.stateManager.rollback(id, err.message);
      throw err;
    }
  }

  /**
   * Disconnects a device.
   */
  async disconnectDevice(id: string): Promise<void> {
    const device = this.discoveredDevices.get(id);
    if (device) {
      await device.disconnect();
    }
  }

  clear(): void {
    this.rateLimiter.clear();
    this.discoveredDevices.clear();
    this.adapters.clear();
  }
}
