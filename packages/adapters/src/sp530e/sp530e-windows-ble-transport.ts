import * as cp from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import type { ISp530eTransport, Sp530eTransportKind, TransportDiscoveredDevice } from './sp530e-transport-interface.ts';
import type { LedState } from '../../../core/src/types.ts';
import { Sp530eBleCodec } from './sp530e-ble-codec.ts';

export interface BleTransportOptions {
  helperPath?: string;
  dryRun?: boolean;
}

export class Sp530eWindowsBleTransport implements ISp530eTransport {
  readonly kind: Sp530eTransportKind = 'ble';
  public dryRun: boolean;

  private helperProcess: cp.ChildProcessWithoutNullStreams | null = null;
  private helperPath: string;
  private connected: boolean = false;
  private currentAddress: string = '';
  private nextRequestId: number = 1;
  private pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void; timer: NodeJS.Timeout }>();

  private notificationListeners = new Set<(bytes: Uint8Array) => void>();
  private errorListeners = new Set<(err: Error) => void>();
  private disconnectListeners = new Set<() => void>();

  constructor(options: BleTransportOptions = {}) {
    this.dryRun = options.dryRun ?? true;

    // Resolve helper path across development and packaged environments
    const candidatePaths = [
      options.helperPath,
      typeof process !== 'undefined' && (process as any).resourcesPath
        ? path.join((process as any).resourcesPath, 'bin', 'Sp530eBleHelper.exe')
        : undefined,
      typeof process !== 'undefined' && (process as any).resourcesPath
        ? path.join((process as any).resourcesPath, 'Sp530eBleHelper.exe')
        : undefined,
      typeof process !== 'undefined' && process.execPath
        ? path.join(path.dirname(process.execPath), 'bin', 'Sp530eBleHelper.exe')
        : undefined,
      path.resolve(process.cwd(), 'packages', 'adapters', 'src', 'sp530e', 'ble-helper', 'Sp530eBleHelper.exe'),
      path.resolve(process.cwd(), '..', '..', 'packages', 'adapters', 'src', 'sp530e', 'ble-helper', 'Sp530eBleHelper.exe'),
    ].filter((p): p is string => typeof p === 'string' && fs.existsSync(p));

    this.helperPath =
      candidatePaths[0] ??
      path.resolve(process.cwd(), 'packages', 'adapters', 'src', 'sp530e', 'ble-helper', 'Sp530eBleHelper.exe');
  }

  get isConnected(): boolean {
    return this.connected;
  }

  private ensureProcessStarted(): void {
    if (this.helperProcess && !this.helperProcess.killed) {
      return;
    }

    if (!fs.existsSync(this.helperPath)) {
      throw new Error(`Sp530eBleHelper.exe not found at ${this.helperPath}. Compile it first using build.ps1.`);
    }

    this.helperProcess = cp.spawn(this.helperPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let buffer = '';

    this.helperProcess.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed);
          this.handleIpcMessage(msg);
        } catch {
          // Ignore non-JSON log lines
        }
      }
    });

    this.helperProcess.stderr.on('data', (chunk: Buffer) => {
      const errStr = chunk.toString('utf8').trim();
      if (errStr) {
        this.emitError(new Error(`BleHelper stderr: ${errStr}`));
      }
    });

    this.helperProcess.on('exit', (code) => {
      this.connected = false;
      this.helperProcess = null;
      // Reject any pending requests
      for (const [id, req] of this.pendingRequests.entries()) {
        clearTimeout(req.timer);
        req.reject(new Error(`BleHelper process exited unexpectedly with code ${code}`));
        this.pendingRequests.delete(id);
      }
      this.emitDisconnect();
    });
  }

  private handleIpcMessage(msg: any): void {
    if (msg.event === 'notification' && msg.params?.hex) {
      const bytes = this.hexToBytes(msg.params.hex);
      for (const l of this.notificationListeners) l(bytes);
      return;
    }

    if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
      const req = this.pendingRequests.get(msg.id)!;
      clearTimeout(req.timer);
      this.pendingRequests.delete(msg.id);

      if (msg.error) {
        req.reject(new Error(`BLE Error [${msg.error.code}]: ${msg.error.message}`));
      } else {
        req.resolve(msg.result);
      }
    }
  }

  private sendRequest(method: string, params: any = {}, timeoutMs = 5000): Promise<any> {
    if (this.dryRun) {
      return Promise.resolve({ dryRun: true, method, params });
    }

    this.ensureProcessStarted();

    const id = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`IPC request '${method}' (id ${id}) timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });

      const payload = JSON.stringify({ id, method, params }) + '\n';
      this.helperProcess?.stdin.write(payload);
    });
  }

  async connect(targetAddress: string, timeoutMs = 5000): Promise<boolean> {
    this.currentAddress = targetAddress;

    if (this.dryRun) {
      this.connected = true;
      return true;
    }

    const res = await this.sendRequest('connect', { address: targetAddress }, timeoutMs);
    this.connected = !!res.connected;
    return this.connected;
  }

  async disconnect(): Promise<void> {
    if (!this.dryRun && this.connected) {
      try {
        await this.sendRequest('disconnect', {}, 2000);
      } catch {
        // Ignore disconnect errors
      }
    }
    this.connected = false;
    if (this.helperProcess) {
      this.helperProcess.kill();
      this.helperProcess = null;
    }
    this.emitDisconnect();
  }

  async discover(timeoutMs = 5000): Promise<TransportDiscoveredDevice[]> {
    if (this.dryRun) {
      return [
        {
          id: 'sp530e-ble-mock1',
          name: 'SP530E (Dry-Run BLE)',
          address: 'AA:BB:CC:DD:EE:FF',
          transport: 'ble',
          rssi: -60,
        },
      ];
    }

    const res = await this.sendRequest('discover', { timeoutMs }, timeoutMs + 1000);
    const devices: TransportDiscoveredDevice[] = [];

    if (res?.devices && Array.isArray(res.devices)) {
      for (const d of res.devices) {
        const isTarget = d.isSP530E || d.address.toUpperCase() === '7C4FADEB2AAA' || d.name?.includes('SP530E');
        const displayName = d.name && d.name.trim().length > 0
          ? d.name
          : (isTarget ? `SP530E Controller (${d.address})` : `BLE Device (${d.address})`);
        devices.push({
          id: `sp530e-ble-${d.address.toLowerCase()}`,
          name: displayName,
          address: d.address,
          transport: 'ble',
          rssi: d.rssi,
        });
      }
    }

    return devices;
  }

  async writeBytes(bytes: Uint8Array, timeoutMs = 3000): Promise<boolean> {
    if (this.dryRun) {
      return true;
    }

    const hex = this.bytesToHex(bytes);
    const res = await this.sendRequest('write', { hex }, timeoutMs);
    return !!res.success;
  }

  async queryState(timeoutMs = 3000): Promise<LedState | null> {
    if (this.dryRun) {
      return {
        power: true,
        brightness: 20,
        color: { r: 255, g: 0, b: 0, hex: '#FF0000' },
        mode: 'solid',
      };
    }

    const queryPacket = Sp530eBleCodec.buildFrame(0x00);
    await this.writeBytes(queryPacket, timeoutMs);
    return null;
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

  private emitError(err: Error): void {
    for (const l of this.errorListeners) l(err);
  }

  private emitDisconnect(): void {
    for (const l of this.disconnectListeners) l();
  }

  private hexToBytes(hex: string): Uint8Array {
    const clean = hex.replace(/[^0-9a-fA-F]/g, '');
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
}
