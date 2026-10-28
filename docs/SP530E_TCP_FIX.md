# SP530E Wi-Fi TCP Connection Lifecycle & Protocol Architecture Fixes

## Overview
This document specifies the engineering fixes applied to resolve connection drops, command dropping, event race conditions, and response handling for the SP530E LED controller over TCP port 8587.

---

## 1. TCP Connection Mutex & Concurrency Lock
### Problem
The ESP32-C3 microcontroller only accepts one active client on port 8587. Rapid UI clicks or background discovery checks (`probeHost`) previously triggered multiple parallel `connect()` calls, causing the ESP32 lwIP stack to issue a TCP RST (`Connection reset by peer`).

### Solution
Implemented a singleton promise lock (`this.connectPromise`) in `SP530EWiFiDevice`:
```typescript
async connect(): Promise<boolean> {
  if (this.connectionInfo.state === 'connected' && this.socket && !this.socket.destroyed) {
    return true;
  }
  if (this.connectPromise) {
    return this.connectPromise;
  }
  this.connectPromise = this._doConnect().finally(() => {
    this.connectPromise = null;
  });
  return this.connectPromise;
}
```
Any concurrent call to `connect()` shares the single in-flight connection promise without opening redundant sockets. In addition, `SP530EWiFiAdapter.probeHost()` now checks if a controller is in `'connecting'` state and bypasses probing.

---

## 2. Session Token & Stale Event Handler Protection
### Problem
When a socket connection closed (due to inactivity or network transition), its registered `'close'` and `'error'` listeners fired asynchronously, nullifying `this.socket` on the device instance even while a new socket connection was already active or in progress. This led to commands failing and `RESPONSE_RECEIVED` logs appearing after `DISCONNECTED` logs.

### Solution
Each socket connection is bound to a monotonically increasing `currentSessionId`:
```typescript
const sessionId = ++this.currentSessionId;
```
All event listeners verify `if (this.currentSessionId !== sessionId) return;`. Stale events from defunct sockets are completely dropped and can never corrupt active session state.

---

## 3. Sequential FIFO Command Queue with Bounded Retries
### Problem
Commands were previously dispatched directly to `this.socket.write()`. If the socket had closed due to ESP32 idle timeout, the command was rejected and silently abandoned without transmission (`logCommandEncoded` fired, but `logCommandTransmitted` never did).

### Solution
Implemented a sequential FIFO queue `processCommandQueue()` in `SP530EWiFiDevice`:
1. Every state mutation (Power, Brightness, Color, Effect) is enqueued.
2. The queue processes commands strictly sequentially.
3. If the socket is disconnected or destroyed, it automatically connects.
4. If a write fails or the connection drops during transmission, it attempts bounded retries (up to 3 total attempts) with exponential backoff before reporting an error.
5. `logCommandTransmitted` is only logged when the socket write callback completes with zero errors.

---

## 4. Debounced & Serialized Rate Limiting
### Problem
Dragging color pickers or sliders emitted high-frequency bursts. While timestamp checks prevented rapid executions, async executions were not mutexed.

### Solution
Enhanced `DeviceRateLimiter` in `packages/core/src/device-manager.ts` with an `isExecuting` asynchronous lock:
- No two asynchronous calls for the same device key run concurrently.
- Rapid intermediate states are coalesced into a single trailing execution, ensuring the final user state is transmitted without overloading the ESP32.

---

## 5. Streaming TCP Frame Buffer
### Problem
Responses could arrive fragmented or concatenated in TCP chunks. Previous string conversions truncated raw responses to 64 characters.

### Solution
- The stream parser scans for the 7-byte ASCII magic header `SPTECH\0` (`53505445434800`).
- Slices the exact frame matching `13 + payloadLength`.
- Loops to process multiple frames delivered in a single TCP chunk.
- Logs the complete, untruncated hexadecimal string in `logDeviceResponse`.

---

## 6. Elimination of False BLE Devices & Dry-Run Normalization
### Problem
Nearby Bluetooth devices (such as televisions and streaming boxes) were incorrectly registered as SP530E controllers. Furthermore, `dryRun` defaulted to `true`, keeping BLE in simulation mode.

### Solution
1. `Sp530eBleHelper.cs` and `Sp530eWindowsBleTransport.ts` strictly filter out any peripheral that does not match `isSP530E` (validated Service UUID `0xFFE0`, Manufacturer ID `20563`, name containing `SP530E`/`SP630E`, or MAC `7C4FADEB2AAA`).
2. `dryRun` now defaults to `false` in `AppSettings` and `DeviceContext`, ensuring direct live hardware communication.
