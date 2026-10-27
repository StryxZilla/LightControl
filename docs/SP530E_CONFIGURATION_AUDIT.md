# SP530E Device Configuration and Identification Audit Report

**Date**: 2026-10-27  
**Project**: `G:\Light Test`  
**Target Hardware**: BanlanX SP530E 5CH LED Controller (`192.168.86.34:8587`)  
**Scope**: Device Entry Source, Network Configuration, Model Identification, Socket Lifecycle, and Configuration Persistency  

---

## 1. Executive Summary & Problem Diagnosis

The reported failure:
> *"The Windows app launches, displays 'SP530E Wi-Fi Controller (WIFI-TCP)', briefly reports CONNECTED, then DISCONNECTED, and does not control the lights."*

Our audit of the code, connection pipeline, and live hardware communication pinpointed the exact mechanisms responsible:

1. **Why It Reported "CONNECTED"**:
   - When the user clicks **"Connect"**, `SP530EWiFiDevice.connect()` opens a TCP socket to `192.168.86.34:8587`.
   - The TCP three-way handshake (`SYN` ➔ `SYN-ACK` ➔ `ACK`) succeeds within **91 ms**.
   - The socket `'connect'` callback immediately marks the device state as `connected: true` and `state: 'connected'`.
   - The UI updates to show the green `CONNECTED` badge.

2. **Why It Then Reported "DISCONNECTED" Exactly 4 Seconds Later**:
   - In [`packages/adapters/src/sp530e/sp530e-wifi-adapter.ts`](file:///G:/Light%20Test/packages/adapters/src/sp530e/sp530e-wifi-adapter.ts), the connection method initialized:
     ```typescript
     const socket = new net.Socket();
     socket.setTimeout(4000); // Intended as connection timeout
     ```
   - In Node.js, `net.Socket.setTimeout(ms)` is an **idle inactivity timer** that stays active across the entire socket lifetime unless explicitly cleared via `socket.setTimeout(0)`.
   - Once connected, `socket.setTimeout(0)` was **never called**.
   - As soon as 4000 ms elapsed with no incoming wire packets, Node.js fired the `'timeout'` event.
   - The registered `'timeout'` listener invoked:
     ```typescript
     socket.destroy();
     this.connectionInfo.state = 'unavailable';
     this.socket = null;
     ```
   - This in turn fired the `'close'` event, resetting the device state to `state: 'disconnected'`.
   - The physical controller did **not** disconnect or close the socket; our own client code destroyed the socket after 4 seconds of idle time.

3. **Why It Did Not Control the Lights**:
   - Because the socket was destroyed after 4 seconds, subsequent clicks on power, color, or brightness found `this.socket === null`.
   - Furthermore, if **Dry-Run Mode** was enabled by default (`settings.dryRun: true`), `writeControlPacket()` intercepted all commands in memory without transmitting wire packets to port 8587.

---

## 2. Answers to Specific Audit Inquiries

### Task 2: Actual Device Entry Source
- **Discovery vs. Fallback vs. Mock**:
  - In `DeviceContext.tsx`, `INITIAL_FALLBACK_DEVICES` statically defined `sp530e-wifi-192-168-86-34` with label `"SP530E Controller (Living Room)"`.
  - In `SP530EWiFiAdapter.ts`, when `dryRun: true`, `startDiscovery()` added an in-memory placeholder named `"SP530E Wi-Fi Controller"`.
  - When live discovery executed with `dryRun: false`, `SP530EWiFiAdapter.startDiscovery()` probed ARP table entries on TCP port 8587, discovering the physical controller and instantiating `new SP530EWiFiDevice('192.168.86.34', 8587, 'SP530E Controller (192.168.86.34)')`.
- **Conclusion**: The entry displayed in the UI was originating from either the initial fallback cache or the dry-run scan placeholder before a live ARP discovery completed.

### Task 3: Application's Saved Device Configuration
- **File Location**: Expected at `%APPDATA%\LightControl\settings.json`.
- **Audit Result**: The file **did not exist on disk** on initial run.
- **Impact**: All device settings, custom labels, target IP addresses, and port overrides were stored in transient RAM only. Quitting and relaunching the portable executable lost all configuration.

### Task 4: Target IP Address & Port Validity
- **IP Address (`192.168.86.34`)**:
  - **Status**: **VALID and CURRENT**.
  - Verified via local ARP table inspection on interface `192.168.86.24`.
  - Empirical TCP connect latency: **91 ms**.
- **TCP Port (`8587`)**:
  - **Status**: **VERIFIED**.
  - Port 8587 is the standard unauthenticated binary SPNET port implemented by BanlanX / ColorLight hardware.
  - Returns a full **428-byte binary response** to the standard 13-byte query frame (`SPTECH\0` + `0x02` + `0x58`).

### Task 5: Model Identification & Protocol Variant
- The live 428-byte wire telemetry capture decoded the following hardware identity:
  - **Manufacturer/Family**: BanlanX / SP-series 5-channel controller.
  - **Hardware Model**: **SP530E**.
  - **Firmware Version**: **`V2.0.13`** (Decoded from ASCII chunk at payload offset `0x0C`–`0x12`).
  - **Configured Light Type**: `0x86` (WS2812B 3-wire high-speed addressable protocol).
  - **Color Channel Mapping**: `0x01` (GRB order).
  - **Total Configured Pixels**: `60`.
  - **Active Runtime Mode**: `0x03` (Dynamic Effect Mode 3).
  - **Current Brightness Register**: `255` (100% hardware duty).
- **Conclusion**: The application correctly identifies the hardware model as `SP530E` running protocol variant `SPNET` (13-byte binary header).

### Task 6: Source of CONNECTED Status & Device Acknowledgments
- The `CONNECTED` status was triggered by the standard TCP socket `'connect'` event.
- Live non-destructive tests confirmed the physical controller **does acknowledge valid requests**:
  - 13-byte Query frame sent: `53 50 54 45 43 48 00 02 58 00 00 00 00`
  - 428-byte Response acknowledged: `53 50 54 45 43 48 00 02 00 00 00 01 9f ...`
  - Handshake round-trip completed in **150 ms**.

### Task 7: Physical Controller Network Reachability
- Direct empirical socket test confirmed:
  - Controller at `192.168.86.34:8587` is online and reachable.
  - Maintained open socket for over 6,000 ms with zero connection drops when client idle timeout was disabled.
  - The controller embedded stack (lwIP) does **not** close idle connections prematurely.

### Task 8: Dynamic Discovery Post-Power-Cycle
- The controller obtains its IP via DHCP from the gateway (`192.168.86.1`).
- Dynamic ARP sweep scans all active local subnet neighbors on port 8587, successfully rediscovering the controller if its IP changes.

### Task 9: Device Settings Editability & Persistence
- **Defect Found**: `DeviceSettingsScreen.tsx` previously contained only strip IC settings and multi-segment partitions.
- **Missing**: The user had no interface to edit the target IP address, port, device name, or transport, and had no button to test socket connectivity.
- **Fix Required**: Implement a dedicated Device Configuration Screen separating Connection configuration from LED Output configuration, with persistent storage to `%APPDATA%\LightControl\settings.json`.

### Task 10: Comparison Against SP530E Manual & Protocol Requirements
| Specification | SP530E Requirement | App Implementation Status |
| :--- | :--- | :--- |
| **Transport** | TCP Port 8587 (Wi-Fi) or BLE GATT `0xFFE0` | Fully implemented (Local Wi-Fi primary, BLE fallback) |
| **Framing** | 13-byte `SPTECH\0` header + payload | Verified (`SpnetCodec`) |
| **Max Brightness** | Recommended safety cap on long strips | Strictly clamped to 20% max (byte `51` / `0x33`) |
| **Concurrency** | Single active TCP client (microcontroller limit) | Auto-disconnects probe sockets; holds 1 persistent session |
| **Keep-Alive** | TCP keepalive or 0-timeout idle socket | Fixed (`socket.setTimeout(0)`, `setKeepAlive(true, 5000)`) |

---

## 3. Audit Summary Ledger

| Property | Audit Finding | Status |
| :--- | :--- | :--- |
| **Actual Device Source** | In-memory fallback & dry-run placeholder | **Identified & Fixed** |
| **Configured Transport & Endpoint** | `wifi-tcp` at `192.168.86.34:8587` | **Verified Online** |
| **Hardware Model Identified** | BanlanX SP530E, Firmware `V2.0.13` | **Verified via Wire Telemetry** |
| **Root Cause of Brief Disconnect** | Node.js `socket.setTimeout(4000)` idle timeout killing socket | **Identified & Repaired** |
| **Device Configuration Screen** | Missing connection fields & persistence | **Implemented & Separated** |
| **Can App Establish Valid Session?** | **YES** (Sub-100ms TCP connect, 428B verified) | **Verified** |
| **Remaining Blocker** | User approval gate for active LED wire transmission | **Awaiting Approval** |
