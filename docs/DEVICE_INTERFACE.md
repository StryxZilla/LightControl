# Universal LED Controller - Device Interface Specification (`ILedDevice` & `ILedAdapter`)

This document defines the interface contracts, data models, error handling semantics, and lifecycle rules governing the Hardware Abstraction Layer (HAL).

---

## 1. Core Interfaces

### 1.1 `ILedDevice`

Every controllable controller (physical or simulated) must implement `ILedDevice`.

```typescript
export interface ILedDevice {
  readonly id: string;
  readonly name: string;
  readonly family: DeviceFamily; // 'sp530e' | 'wled' | 'mock'
  readonly connectionInfo: ConnectionInfo;
  readonly capabilities: DeviceCapabilities;
  readonly state: LedState;

  connect(): Promise<boolean>;
  disconnect(): Promise<void>;

  setPower(on: boolean): Promise<boolean>;
  setBrightness(brightness: number): Promise<boolean>;
  setColor(color: LedColor): Promise<boolean>;
  setEffect(effectId: number, speed?: number): Promise<boolean>;
  setSegments?(segments: SegmentConfig[]): Promise<boolean>;
  setMusicMode?(modeId: number, sensitivity?: number): Promise<boolean>;

  refreshState(): Promise<LedState>;

  onStateChange(listener: (event: DeviceStateChangeEvent) => void): () => void;
  onError(listener: (event: DeviceErrorEvent) => void): () => void;
}
```

#### Method Specifications

| Method | Parameters | Returns | Description & Invariants |
| :--- | :--- | :--- | :--- |
| `connect()` | None | `Promise<boolean>` | Establishes physical transport connection (BLE GATT link or TCP/HTTP session). Must transition `connectionInfo.state` to `'connected'`. Throws if unreachable. |
| `disconnect()` | None | `Promise<void>` | Closes open sockets or disconnects GATT. Transitions `connectionInfo.state` to `'disconnected'`. |
| `setPower(on)` | `on: boolean` | `Promise<boolean>` | Turns light output ON or OFF. Updates `state.power`. |
| `setBrightness(brightness)` | `brightness: number` (0-100) | `Promise<boolean>` | Adjusts brightness percentage. Must clamp between `capabilities.brightnessRange.min` and `max`. Clamps to `safetyLimit` if configured. |
| `setColor(color)` | `color: LedColor` | `Promise<boolean>` | Sets solid color (RGB, plus optional White or CCT). Switches `state.mode` to `'solid'`. |
| `setEffect(effectId, speed?)` | `effectId: number`, `speed?: number` (1-100) | `Promise<boolean>` | Activates built-in dynamic effect. Sets `state.mode` to `'effect'` and updates `state.effectId`. |
| `setSegments(segments)` *(Optional)* | `segments: SegmentConfig[]` | `Promise<boolean>` | Reconfigures pixel strip segments. Throws or ignores if `capabilities.supportsSegments` is false. |
| `setMusicMode(modeId, sensitivity?)` *(Optional)* | `modeId: number`, `sensitivity?: number` | `Promise<boolean>` | Engages sound-reactive lighting effect. |
| `refreshState()` | None | `Promise<LedState>` | Triggers a query frame or HTTP GET to synchronize state with live hardware telemetry. |
| `onStateChange(listener)` | `listener: (event) => void` | `() => void` (Unsubscribe) | Subscribes to device state updates. Returns cleanup function to unsubscribe. |
| `onError(listener)` | `listener: (event) => void` | `() => void` (Unsubscribe) | Subscribes to device error events. Returns cleanup function. |

---

### 1.2 `ILedAdapter`

Every transport provider (BLE, Wi-Fi TCP, WLED HTTP, Mock) implements `ILedAdapter`.

```typescript
export interface ILedAdapter {
  readonly transportName: TransportType;
  startDiscovery(onDeviceFound: (device: ILedDevice) => void): Promise<void>;
  stopDiscovery(): Promise<void>;
  getConnectedDevices(): ILedDevice[];
  getDiscoveredDevices(): ILedDevice[];
}
```

#### Method Specifications

| Method | Parameters | Returns | Description |
| :--- | :--- | :--- | :--- |
| `startDiscovery(onDeviceFound)` | Callback invoked with `ILedDevice` | `Promise<void>` | Scans transport medium (mDNS, BLE advertisement, subnet scan, or virtual pool) and invokes callback as devices appear. |
| `stopDiscovery()` | None | `Promise<void>` | Halts background scanning timers and listeners. |
| `getConnectedDevices()` | None | `ILedDevice[]` | Returns all devices currently in `'connected'` state. |
| `getDiscoveredDevices()` | None | `ILedDevice[]` | Returns all known devices discovered by this adapter. |

---

## 2. Common Data Models

### 2.1 `LedColor`

Standard color representation supporting standard RGB, optional dedicated White channel, and Color Temperature (CCT):

```typescript
export interface LedColor {
  r: number;    // 0 - 255 (Red channel)
  g: number;    // 0 - 255 (Green channel)
  b: number;    // 0 - 255 (Blue channel)
  w?: number;   // 0 - 255 (Optional White channel for RGBW)
  cct?: number; // Color temperature (Kelvin, e.g. 2700-6500) or warm/cool ratio
  hex?: string; // Standard formatted uppercase hex string (e.g. '#FF5500')
}
```

### 2.2 `LedState`

Snapshot of the device's operational state:

```typescript
export interface LedState {
  power: boolean;
  brightness: number; // 0 - 100 (%)
  color: LedColor;
  mode: 'solid' | 'effect' | 'music';
  effectId?: number;
  effectSpeed?: number; // 1 - 100 (%)
  activeSegments?: number;
  segments?: SegmentConfig[];
}
```

### 2.3 `SegmentConfig`

Configuration for multi-segment addressable strip zoning:

```typescript
export interface SegmentConfig {
  id: number;
  start: number;       // Start pixel index (0-based)
  stop: number;        // Stop pixel index (exclusive)
  length: number;      // Pixel count in segment
  color?: LedColor;
  effectId?: number;
  speed?: number;
  on?: boolean;
}
```

### 2.4 `ConnectionInfo`

Network and radio transport metadata:

```typescript
export interface ConnectionInfo {
  transport: TransportType; // 'ble' | 'wifi-tcp' | 'wifi-http' | 'websocket' | 'mock'
  address: string;          // MAC address, IP:Port, or virtual URI
  name: string;
  state: ConnectionState;   // 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'reconnecting' | 'error'
  connected?: boolean;      // Legacy convenience flag
  signalStrength?: number;  // RSSI in dBm
  lastConnectedAt?: number;
  disconnectReason?: string;
}
```

---

## 3. Event Models

### 3.1 `DeviceStateChangeEvent`
Fired whenever state updates occur through direct command or background telemetry ingestion:

```typescript
export interface DeviceStateChangeEvent {
  deviceId: string;
  state: LedState;
  previousState?: Partial<LedState>;
  timestamp: number;
}
```

### 3.2 `DeviceErrorEvent`
Fired when transport errors, timeouts, or buffer overruns occur:

```typescript
export interface DeviceErrorEvent {
  deviceId: string;
  code: string;           // E.g. 'ERR_NOT_CONNECTED', 'ERR_WIFI_TIMEOUT', 'ERR_ROLLBACK'
  message: string;
  timestamp: number;
  recoverable: boolean;
}
```

---

## 4. Architectural Rules & Invariants

1. **No UI Raw Command Construction**: Presentation components must never assemble raw byte arrays, SPTECH headers, or WLED JSON structures. All mutations must occur via `ILedDevice` high-level methods.
2. **Dynamic Capability Gating**: UI components must inspect `device.capabilities` before showing controls (e.g., segment editor, white channel slider, CCT picker).
3. **Optimistic Updates**: State changes are cached optimistically by `DeviceStateManager` and broadcast to UI components immediately; if physical execution fails, the state automatically rolls back to the previous snapshot.
4. **Idempotence**: Calling `setPower(true)` when the strip is already ON must be a safe, idempotent operation.
