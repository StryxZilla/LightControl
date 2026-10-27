import type { LedState, LedColor } from '../../../core/src/types.ts';
import type { ISp530eTransport, Sp530eTransportKind } from './sp530e-transport-interface.ts';
import { SpnetCodec } from './spnet-codec.ts';
import { Sp530eBleCodec } from './sp530e-ble-codec.ts';
import { Sp530eWiFiTransport } from './sp530e-wifi-transport.ts';
import { Sp530eWindowsBleTransport } from './sp530e-windows-ble-transport.ts';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface DriverLogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  data?: any;
}

export interface Sp530eDriverOptions {
  transportKind?: Sp530eTransportKind;
  transport?: ISp530eTransport;
  dryRun?: boolean;
  safetyBrightnessLimit?: number; // 20% default
  commandTimeoutMs?: number;
  maxReconnectAttempts?: number;
  host?: string;
  port?: number;
  bleAddress?: string;
}

export class Sp530eDriver {
  public readonly transport: ISp530eTransport;
  public readonly dryRun: boolean;
  public readonly safetyBrightnessLimit: number;

  private state: LedState;
  private commandTimeoutMs: number;
  private maxReconnectAttempts: number;
  private logs: DriverLogEntry[] = [];
  private logListeners = new Set<(entry: DriverLogEntry) => void>();
  private stateListeners = new Set<(state: LedState) => void>();
  private errorListeners = new Set<(err: Error) => void>();

  // Command serialization queue
  private writeQueue: Promise<any> = Promise.resolve();

  // Last encoded frame for diagnostics/testing
  public lastEncodedFrame: Uint8Array | null = null;
  public lastOperation: string = '';

  constructor(options: Sp530eDriverOptions = {}) {
    this.dryRun = options.dryRun ?? true;
    this.safetyBrightnessLimit = options.safetyBrightnessLimit ?? 20;
    this.commandTimeoutMs = options.commandTimeoutMs ?? 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 3;

    if (options.transport) {
      this.transport = options.transport;
    } else if (options.transportKind === 'ble') {
      this.transport = new Sp530eWindowsBleTransport({ dryRun: this.dryRun });
    } else {
      // Default to Wi-Fi
      this.transport = new Sp530eWiFiTransport({
        host: options.host,
        port: options.port,
        dryRun: this.dryRun,
      });
    }

    this.state = {
      power: true,
      brightness: Math.min(20, this.safetyBrightnessLimit),
      color: { r: 255, g: 255, b: 255, hex: '#FFFFFF' },
      mode: 'solid',
      effectId: 0,
      effectSpeed: 50,
      activeSegments: 1,
    };

    // Forward transport notifications & errors
    this.transport.onNotification((rawBytes) => {
      this.handleIncomingNotification(rawBytes);
    });

    this.transport.onError((err) => {
      this.log('ERROR', `Transport error: ${err.message}`, err);
      for (const l of this.errorListeners) l(err);
    });

    this.log('INFO', `Initialized SP530E Driver (transport: ${this.transport.kind}, dryRun: ${this.dryRun}, safetyLimit: ${this.safetyBrightnessLimit}%)`);
  }

  get isConnected(): boolean {
    return this.transport.isConnected;
  }

  getState(): LedState {
    return { ...this.state };
  }

  getLogHistory(): DriverLogEntry[] {
    return [...this.logs];
  }

  /**
   * Connects to the SP530E controller.
   */
  async connect(address?: string): Promise<boolean> {
    this.log('INFO', `Connecting to SP530E via ${this.transport.kind}...`);
    try {
      const ok = await this.transport.connect(address || '', this.commandTimeoutMs);
      if (ok) {
        this.log('INFO', `Successfully connected to SP530E.`);
        try {
          await this.refreshState();
        } catch {
          this.log('WARN', `Initial telemetry refresh delayed, continuing.`);
        }
      }
      return ok;
    } catch (err: any) {
      this.log('ERROR', `Connection failed: ${err.message}`, err);
      throw err;
    }
  }

  /**
   * Disconnects from the controller.
   */
  async disconnect(): Promise<void> {
    this.log('INFO', `Disconnecting SP530E driver.`);
    await this.transport.disconnect();
  }

  /**
   * Refreshes telemetry and state from live hardware.
   */
  async refreshState(): Promise<LedState> {
    this.log('DEBUG', `Querying state from hardware...`);
    const refreshed = await this.transport.queryState(this.commandTimeoutMs);
    if (refreshed) {
      this.state = { ...this.state, ...refreshed };
      this.emitStateChange();
      this.log('INFO', `State updated: Power=${this.state.power}, Bri=${this.state.brightness}%, Mode=${this.state.mode}`);
    }
    return { ...this.state };
  }

  /**
   * Controls power ON/OFF with command serialization.
   */
  async setPower(on: boolean): Promise<boolean> {
    return this.enqueueCommand('setPower', async () => {
      this.log('INFO', `Command: setPower(${on})`);
      let frame: Uint8Array;

      if (this.transport.kind === 'wifi-tcp') {
        frame = SpnetCodec.encodePower(on);
      } else {
        frame = Sp530eBleCodec.encodePower(on);
      }

      this.lastEncodedFrame = frame;
      this.lastOperation = `setPower(${on})`;

      await this.transport.writeBytes(frame, this.commandTimeoutMs);
      this.state.power = on;
      this.emitStateChange();
      return true;
    });
  }

  /**
   * Adjusts brightness (0-100%) respecting the hardware safety limit.
   */
  async setBrightness(percent: number): Promise<boolean> {
    return this.enqueueCommand('setBrightness', async () => {
      const clamped = Math.max(0, Math.min(this.safetyBrightnessLimit, Math.round(percent)));
      this.log('INFO', `Command: setBrightness(${percent}%) -> Clamped to safe ${clamped}%`);

      // Scale 0-100% to 0-255 raw value
      const rawVal = Math.round((clamped / 100) * 255);
      let frame: Uint8Array;

      if (this.transport.kind === 'wifi-tcp') {
        frame = SpnetCodec.encodeBrightness(rawVal);
      } else {
        frame = Sp530eBleCodec.encodeBrightness(rawVal);
      }

      this.lastEncodedFrame = frame;
      this.lastOperation = `setBrightness(${clamped}%)`;

      await this.transport.writeBytes(frame, this.commandTimeoutMs);
      this.state.brightness = clamped;
      this.emitStateChange();
      return true;
    });
  }

  /**
   * Sets static RGB color.
   */
  async setColor(r: number, g: number, b: number, w?: number): Promise<boolean> {
    return this.enqueueCommand('setColor', async () => {
      const red = Math.max(0, Math.min(255, Math.round(r)));
      const green = Math.max(0, Math.min(255, Math.round(g)));
      const blue = Math.max(0, Math.min(255, Math.round(b)));
      this.log('INFO', `Command: setColor(R=${red}, G=${green}, B=${blue})`);

      let frame: Uint8Array;
      if (this.transport.kind === 'wifi-tcp') {
        frame = SpnetCodec.encodeColor(red, green, blue);
      } else {
        frame = Sp530eBleCodec.encodeColor(red, green, blue);
      }

      this.lastEncodedFrame = frame;
      this.lastOperation = `setColor(${red}, ${green}, ${blue})`;

      await this.transport.writeBytes(frame, this.commandTimeoutMs);
      this.state.color = {
        r: red,
        g: green,
        b: blue,
        w: w !== undefined ? Math.max(0, Math.min(255, Math.round(w))) : undefined,
      };
      this.state.mode = 'solid';
      this.emitStateChange();
      return true;
    });
  }

  /**
   * Selects dynamic effect mode (1-142) with speed (1-100%) and optional direction.
   */
  async setEffect(effectId: number, speed = 50, direction = false): Promise<boolean> {
    return this.enqueueCommand('setEffect', async () => {
      const id = Math.max(1, Math.min(142, Math.round(effectId)));
      const spd = Math.max(1, Math.min(100, Math.round(speed)));
      this.log('INFO', `Command: setEffect(ID=${id}, Speed=${spd}%, Direction=${direction ? 'REV' : 'FWD'})`);

      let frame: Uint8Array;
      if (this.transport.kind === 'wifi-tcp') {
        frame = SpnetCodec.encodeEffectMode(id);
      } else {
        frame = Sp530eBleCodec.encodeEffectMode(id);
      }

      this.lastEncodedFrame = frame;
      this.lastOperation = `setEffect(${id})`;

      await this.transport.writeBytes(frame, this.commandTimeoutMs);

      // If speed parameter provided, send speed command as well
      const rawSpeed = Math.round((spd / 100) * 255);
      const speedFrame = this.transport.kind === 'wifi-tcp'
        ? SpnetCodec.encodeEffectSpeed(rawSpeed)
        : Sp530eBleCodec.encodeEffectSpeed(rawSpeed);
      await this.transport.writeBytes(speedFrame, this.commandTimeoutMs);

      this.state.mode = 'effect';
      this.state.effectId = id;
      this.state.effectSpeed = spd;
      this.emitStateChange();
      return true;
    });
  }

  /**
   * Serializes commands sequentially through the write queue.
   */
  private async enqueueCommand<T>(actionName: string, action: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      let attempts = 0;
      while (true) {
        try {
          return await action();
        } catch (err: any) {
          attempts++;
          this.log('WARN', `Action '${actionName}' failed (attempt ${attempts}/${this.maxReconnectAttempts}): ${err.message}`);

          if (attempts >= this.maxReconnectAttempts || this.dryRun) {
            this.log('ERROR', `Action '${actionName}' failed after ${attempts} attempts.`);
            throw err;
          }

          // Exponential backoff
          const delay = Math.min(2000, 250 * Math.pow(2, attempts - 1));
          this.log('INFO', `Reconnecting in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));

          try {
            await this.transport.connect('');
          } catch {
            // Ignore reconnect failure, next loop will retry or fail
          }
        }
      }
    };

    // Chain to previous queue
    const queued = this.writeQueue.then(run, run);
    this.writeQueue = queued;
    return queued;
  }

  private handleIncomingNotification(rawBytes: Uint8Array): void {
    try {
      if (this.transport.kind === 'wifi-tcp') {
        const parsed = SpnetCodec.decodeResponse(rawBytes);
        this.state = { ...this.state, ...parsed.state };
        this.emitStateChange();
      } else {
        const parsed = Sp530eBleCodec.decodeNotification(rawBytes);
        if (parsed) {
          if (parsed.power !== undefined) this.state.power = parsed.power;
          if (parsed.brightness !== undefined) this.state.brightness = parsed.brightness;
          if (parsed.color !== undefined) this.state.color = { ...parsed.color };
          if (parsed.mode !== undefined) this.state.mode = parsed.mode;
          if (parsed.effectId !== undefined) this.state.effectId = parsed.effectId;
          this.emitStateChange();
        }
      }
    } catch (err: any) {
      this.log('WARN', `Failed to parse incoming notification frame: ${err.message}`);
    }
  }

  onLog(listener: (entry: DriverLogEntry) => void): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  onStateChange(listener: (state: LedState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onError(listener: (err: Error) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  private emitStateChange(): void {
    const copy = { ...this.state };
    for (const l of this.stateListeners) l(copy);
  }

  private log(level: LogLevel, message: string, data?: any): void {
    const entry: DriverLogEntry = {
      level,
      message,
      timestamp: Date.now(),
      data,
    };
    this.logs.push(entry);
    if (this.logs.length > 500) this.logs.shift();
    for (const l of this.logListeners) l(entry);
  }
}
