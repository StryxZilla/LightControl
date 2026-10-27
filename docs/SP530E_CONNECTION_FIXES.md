# SP530E Connection Fixes & Device Configuration Implementation Report

**Date**: 2026-10-27  
**Project**: `G:\Light Test`  
**Target Hardware**: BanlanX SP530E 5CH Addressable LED Controller  
**Scope**: Socket Idle Timeout Repair, Device Configuration Screen, Settings Persistence, and Executable Packaging  

---

## 1. Summary of Identified Defects & Applied Solutions

### Defect 1: Four-Second Disconnect Defect in Socket Management
- **Problem**: When connecting over TCP port 8587, the app initialized `socket.setTimeout(4000)`. In Node.js, `setTimeout` on a `net.Socket` is an idle inactivity timer that fires whenever no data is sent or received. Because `socket.setTimeout(0)` was never called upon connection, Node.js fired the `'timeout'` event after 4 seconds of idle time and destroyed the socket.
- **Fix**:
  - In [`packages/adapters/src/sp530e/sp530e-wifi-adapter.ts`](file:///G:/Light%20Test/packages/adapters/src/sp530e/sp530e-wifi-adapter.ts):
    ```typescript
    socket.connect(this.port, this.host, async () => {
      // Clear idle timeout so the persistent session is not killed by Node.js
      socket.setTimeout(0);
      socket.setKeepAlive(true, 5000);
      socket.setNoDelay(true);
      ...
    });
    ```
  - Guarded the `'timeout'` handler so it only triggers if the initial connection handshake fails (`if (!this.connectionInfo.connected)`), ensuring active sessions are never dropped due to idle periods.

### Defect 2: Socket Destruction Guard in Command Transmission
- **Problem**: `writeControlPacket()` only checked `if (!this.socket || this.connectionInfo.state !== 'connected')`, ignoring `this.socket.destroyed`.
- **Fix**:
  - Updated the check to `if (!this.socket || this.connectionInfo.state !== 'connected' || this.socket.destroyed)` to automatically re-establish the socket if it was terminated before transmitting control frames.

### Defect 3: Missing Device Configuration Screen & Persistence
- **Problem**: `DeviceSettingsScreen.tsx` previously contained only LED IC type, color order, and multi-segment zoning. There was no interface for the user to view or edit the controller's IP address, TCP port, or device label, and no button to test connection health. Furthermore, configuration was not persisted to disk.
- **Fix**:
  - Rebuilt [`apps/desktop/src/renderer/screens/DeviceSettingsScreen.tsx`](file:///G:/Light%20Test/apps/desktop/src/renderer/screens/DeviceSettingsScreen.tsx) with two clearly separated cards:
    1. **Network & Connection Configuration**:
       - Device Label (editable)
       - Actual Hardware Model: `BanlanX SP530E (5CH)`
       - Transport Protocol: `Local Wi-Fi (TCP)` / `WinRT BLE`
       - Target IP Address (editable, defaults to `192.168.86.34`)
       - Verified TCP Port (editable, defaults to `8587`)
       - Connection State Badge (`CONNECTED`, `CONNECTING`, `DISCONNECTED`, `ERROR`)
       - Firmware Version Display (`V2.0.13`)
       - **Test Connection** button (executes live non-destructive handshake and reports latency/telemetry)
       - **Connect / Disconnect** button
       - **Rescan Subnet** button
       - **Save Configuration** button (persists parameters permanently)
       - Real-time diagnostic error and status banner
    2. **LED Hardware Output Configuration**:
       - Driver IC Protocol (`WS2812B`, `WS2811`, `SK6812`, `UCS1903`)
       - Color Channel Order (`GRB`, `RGB`, `BRG`)
       - Total Addressable Pixels (e.g. `60`)
       - Multi-Segment Partitioning (Add Zone, Remove Zone, start/stop pixel indices)
       - Visual Strip Partition bar with color-coded zone divisions

### Defect 4: Settings Persistence & IPC Support
- **Problem**: No IPC channels existed to test connection health or persist device configuration parameters.
- **Fix**:
  - In [`apps/desktop/src/main/ipc-handlers.ts`](file:///G:/Light%20Test/apps/desktop/src/main/ipc-handlers.ts):
    - Added `device:test-connection`: Opens a temporary test socket to `${host}:${port}`, transmits the 13-byte query frame, reads the 428-byte status response, measures latency, and returns `{ success, latencyMs, message, firmware, pixels }`.
    - Added `device:update-config`: Updates device name, target IP, port, and pixel count, and persists settings to `%APPDATA%\LightControl\settings.json`.
    - Updated `getSettingsPath()` and `getLogFilePath()` to always resolve directly to persistent `%APPDATA%\LightControl` on Windows.
  - In [`apps/desktop/src/preload/preload.ts`](file:///G:/Light%20Test/apps/desktop/src/preload/preload.ts) & [`types.ts`](file:///G:/Light%20Test/apps/desktop/src/preload/types.ts):
    - Exposed `testConnection(host, port)` and `updateDeviceConfig(deviceId, config)`.
  - In [`apps/desktop/src/renderer/context/DeviceContext.tsx`](file:///G:/Light%20Test/apps/desktop/src/renderer/context/DeviceContext.tsx):
    - Provided `testConnection` and `updateDeviceConfig` to the entire application.

---

## 2. File Modification Audit

| File | Type | Description |
| :--- | :--- | :--- |
| `packages/adapters/src/sp530e/sp530e-wifi-adapter.ts` | Modified | Cleared socket idle timeout (`socket.setTimeout(0)`), added TCP keep-alive (`5000ms`), disabled Nagle algorithm (`setNoDelay`), guarded timeout to handshake only, and added socket destruction check in `writeControlPacket()`. |
| `apps/desktop/src/renderer/screens/DeviceSettingsScreen.tsx` | Modified | Completely redesigned screen: Section 1 for Network & Connection (editable IP, port, model, test connection, state badge) and Section 2 for LED Output (IC protocol, channel order, pixel count, multi-segment partitions). |
| `apps/desktop/src/main/ipc-handlers.ts` | Modified | Added `device:test-connection` and `device:update-config` handlers; ensured persistent storage to `%APPDATA%\LightControl\settings.json`. |
| `apps/desktop/src/preload/preload.ts` | Modified | Exposed `testConnection` and `updateDeviceConfig` across context bridge. |
| `apps/desktop/src/preload/types.ts` | Modified | Added TypeScript definitions for `testConnection` and `updateDeviceConfig`. |
| `apps/desktop/src/renderer/context/DeviceContext.tsx` | Modified | Exposed `testConnection` and `updateDeviceConfig` in React context and Provider. |
| `apps/desktop/src/renderer/components/Sidebar.tsx` | Modified | Updated navigation label to `'Device & Strip Config'`. |

---

## 3. Verification & Regression Testing

1. **Automated Unit & Integration Tests**:
   - `npm test`: **75 out of 75 tests passing** in 777 ms.
2. **Desktop Build Validation**:
   - `npm run build` in `apps/desktop`: Vite renderer bundle (43 modules) and esbuild electron bundle compiled cleanly with zero errors.
3. **Portable Packaging**:
   - `scripts/build-portable.ps1`: Generated `release/LightControl-Portable.exe` (77.54 MB).
4. **Smoke Test Verification**:
   - `release/win-unpacked/LightControl.exe --smoke-test`: Clean execution, exit code 0.
5. **Live Hardware Handshake Test**:
   - Probed `192.168.86.34:8587` with test script: connected in 91 ms, received 428-byte status response, and verified continuous connection for over 6 seconds without socket drops.
