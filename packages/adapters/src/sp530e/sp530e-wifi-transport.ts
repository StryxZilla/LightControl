import * as net from 'node:net';
import type { ISp530eTransport, Sp530eTransportKind, TransportDiscoveredDevice } from './sp530e-transport-interface.ts';
import type { LedState } from '../../../core/src/types.ts';
import { SpnetCodec, SPNET_PORT, type SpnetParsedState } from './spnet-codec.ts';

export interface WiFiTransportOptions {
  host?: string;
  port?: number;
  dryRun?: boolean;
  reconnectAttempts?: number;
}

export class Sp530eWiFiTransport implements ISp530eTransport {
  readonly kind: Sp530eTransportKind = 'wifi-tcp';
  public dryRun: boolean;

  private host: string;
  private port: number;
  private socket: net.Socket | null = null;
  private connected: boolean = false;
  private reconnectAttempts: number;

  private notificationListeners = new Set<(bytes: Uint8Array) => void>();
  private errorListeners = new Set<(err: Error) => void>();
  private disconnectListeners = new Set<() => void>();

  constructor(options: WiFiTransportOptions = {}) {
    this.host = options.host ?? '192.168.86.34';
    this.port = options.port ?? SPNET_PORT;
    this.dryRun = options.dryRun ?? true;
    this.reconnectAttempts = options.reconnectAttempts ?? 3;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get targetHost(): string {
    return this.host;
  }

  get targetPort(): number {
    return this.port;
  }

  async connect(targetAddress = `${this.host}:${this.port}`, timeoutMs = 4000): Promise<boolean> {
    const parts = targetAddress.split(':');
    this.host = parts[0] || this.host;
    if (parts[1]) {
      this.port = parseInt(parts[1], 10) || this.port;
    }

    if (this.dryRun) {
      this.connected = true;
      return true;
    }

    if (this.connected && this.socket) {
      return true;
    }

    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);

      socket.connect(this.port, this.host, () => {
        this.socket = socket;
        this.connected = true;
        resolve(true);
      });

      let incomingBuffer = Buffer.alloc(0);

      socket.on('data', (chunk: Buffer) => {
        incomingBuffer = Buffer.concat([incomingBuffer, chunk]);

        if (incomingBuffer.length >= 13) {
          const payloadLen = (incomingBuffer[11]! << 8) | incomingBuffer[12]!;
          const totalExpected = 13 + payloadLen;

          if (incomingBuffer.length >= totalExpected) {
            const completePacket = new Uint8Array(incomingBuffer.subarray(0, totalExpected));
            incomingBuffer = incomingBuffer.subarray(totalExpected);

            for (const listener of this.notificationListeners) {
              listener(completePacket);
            }
          }
        }
      });

      socket.on('error', (err) => {
        this.connected = false;
        this.socket = null;
        this.emitError(err);
        reject(err);
      });

      socket.on('close', () => {
        this.connected = false;
        this.socket = null;
        this.emitDisconnect();
      });

      socket.on('timeout', () => {
        socket.destroy();
        this.connected = false;
        this.socket = null;
        const err = new Error(`Connection to SP530E at ${this.host}:${this.port} timed out after ${timeoutMs}ms`);
        this.emitError(err);
        reject(err);
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    this.emitDisconnect();
  }

  async discover(timeoutMs = 3000): Promise<TransportDiscoveredDevice[]> {
    if (this.dryRun) {
      return [
        {
          id: `sp530e-wifi-${this.host.replace(/\./g, '-')}`,
          name: `SP530E Controller (${this.host})`,
          address: `${this.host}:${this.port}`,
          transport: 'wifi-tcp',
        },
      ];
    }

    // Attempt a socket handshake to verify controller responsiveness
    try {
      await this.connect(`${this.host}:${this.port}`, timeoutMs);
      return [
        {
          id: `sp530e-wifi-${this.host.replace(/\./g, '-')}`,
          name: `SP530E Controller (${this.host})`,
          address: `${this.host}:${this.port}`,
          transport: 'wifi-tcp',
        },
      ];
    } catch {
      return [];
    }
  }

  async writeBytes(bytes: Uint8Array, timeoutMs = 3000): Promise<boolean> {
    if (this.dryRun) {
      return true;
    }

    if (!this.connected || !this.socket) {
      throw new Error(`Cannot write bytes: SP530E Wi-Fi socket is not connected to ${this.host}:${this.port}`);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Write to SP530E socket timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.socket?.write(bytes, (err) => {
        clearTimeout(timer);
        if (err) reject(err);
        else resolve(true);
      });
    });
  }

  async queryState(timeoutMs = 3000): Promise<LedState | null> {
    if (this.dryRun) {
      return {
        power: true,
        brightness: 20,
        color: { r: 255, g: 255, b: 255, hex: '#FFFFFF' },
        mode: 'solid',
        effectId: 0,
        effectSpeed: 50,
        activeSegments: 1,
      };
    }

    return new Promise((resolve, reject) => {
      const tempSocket = new net.Socket();
      tempSocket.setTimeout(timeoutMs);

      let buffer = Buffer.alloc(0);

      tempSocket.connect(this.port, this.host, () => {
        const queryFrame = SpnetCodec.buildQueryFrame();
        tempSocket.write(queryFrame);
      });

      tempSocket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length >= 13) {
          const payloadLen = (buffer[11]! << 8) | buffer[12]!;
          if (buffer.length >= 13 + payloadLen) {
            tempSocket.destroy();
            try {
              const parsed: SpnetParsedState = SpnetCodec.decodeResponse(new Uint8Array(buffer));
              resolve(parsed.state);
            } catch (decodeErr) {
              reject(decodeErr);
            }
          }
        }
      });

      tempSocket.on('error', (err) => {
        reject(err);
      });

      tempSocket.on('timeout', () => {
        tempSocket.destroy();
        reject(new Error(`Timeout reading telemetry from SP530E at ${this.host}:${this.port}`));
      });
    });
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
}
