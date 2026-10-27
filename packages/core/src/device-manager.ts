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

    if (elapsed >= this.minIntervalMs && !this.pendingTimer.has(deviceKey)) {
      this.lastExecution.set(deviceKey, now);
      return await fn();
    }

    // Coalesce into trailing execution
    this.latestFn.set(deviceKey, fn);

    return new Promise((resolve, reject) => {
      const list = this.pendingResolvers.get(deviceKey) ?? [];
      list.push({ resolve, reject });
      this.pendingResolvers.set(deviceKey, list);

      if (!this.pendingTimer.has(deviceKey)) {
        const delay = Math.max(1, this.minIntervalMs - elapsed);
        const timer = setTimeout(async () => {
          this.pendingTimer.delete(deviceKey);
          this.lastExecution.set(deviceKey, Date.now());

          const targetFn = this.latestFn.get(deviceKey);
          this.latestFn.delete(deviceKey);

          const waiting = this.pendingResolvers.get(deviceKey) ?? [];
          this.pendingResolvers.delete(deviceKey);

          try {
            const res = targetFn ? await targetFn() : undefined;
            for (const waiter of waiting) {
              waiter.resolve(res);
            }
          } catch (err) {
            for (const waiter of waiting) {
              waiter.reject(err);
            }
          }
        }, delay);

        this.pendingTimer.set(deviceKey, timer);
      }
    });
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
   */
  async startDiscovery(): Promise<void> {
    const discoveryPromises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        await adapter.startDiscovery((device) => {
          this.handleDeviceFound(device);
        });
      } catch (err) {
        console.error(`Error starting discovery on adapter ${adapter.transportName}:`, err);
      }
    });

    await Promise.all(discoveryPromises);
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

  private handleDeviceFound(device: ILedDevice): void {
    if (!this.discoveredDevices.has(device.id)) {
      this.discoveredDevices.set(device.id, device);
      this.stateManager.registerDevice(device);
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
      return true;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Connection to ${device.name} timed out after ${timeoutMs} ms.`));
      }, timeoutMs);
    });

    try {
      const success = await Promise.race([device.connect(), timeoutPromise]);
      if (timer) clearTimeout(timer);
      return success;
    } catch (err: any) {
      if (timer) clearTimeout(timer);
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
