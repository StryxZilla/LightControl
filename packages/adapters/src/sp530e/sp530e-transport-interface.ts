import type { LedState } from '../../../core/src/types.ts';

export type Sp530eTransportKind = 'wifi-tcp' | 'ble' | 'mock';

export interface TransportDiscoveredDevice {
  id: string;
  name: string;
  address: string;
  transport: Sp530eTransportKind;
  rssi?: number;
}

export interface ISp530eTransport {
  readonly kind: Sp530eTransportKind;
  readonly isConnected: boolean;

  connect(targetAddress: string, timeoutMs?: number): Promise<boolean>;
  disconnect(): Promise<void>;
  discover(timeoutMs?: number): Promise<TransportDiscoveredDevice[]>;
  writeBytes(bytes: Uint8Array, timeoutMs?: number): Promise<boolean>;
  queryState(timeoutMs?: number): Promise<LedState | null>;

  onNotification(listener: (bytes: Uint8Array) => void): () => void;
  onError(listener: (err: Error) => void): () => void;
  onDisconnect(listener: () => void): () => void;
}
