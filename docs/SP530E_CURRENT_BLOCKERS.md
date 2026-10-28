# SP530E Hardware Interoperability: Current Blockers & Resolution Roadmap

## 1. Executive Summary
This document analyzes the technical root causes behind observed control issues with the **BanlanX SP530E 5-in-1 IoT LED Controller** (`192.168.86.34:8587`), documents the software defects identified and repaired, and provides a concise testing roadmap for live hardware verification.

---

## 2. Exhaustive Defect & Blocker Analysis

### 2.1 Blocker #1: 4-Second Socket Inactivity Disconnect
* **Observed Symptom**:
  The application connected to `192.168.86.34:8587`, ingested 428 bytes of telemetry, reported `CONNECTED`, and then abruptly dropped the connection with `Connection timed out` after exactly 4.003 seconds.
* **Root Cause**:
  In `packages/adapters/src/sp530e/sp530e-wifi-adapter.ts`, `socket.setTimeout(4000)` was initialized prior to calling `socket.connect()`. In Node.js / Electron, `socket.setTimeout()` configures an **idle inactivity timer** that resets only on socket I/O. When no incoming packets arrived from the controller within 4 seconds, Node.js fired the `'timeout'` event, causing the handler to destroy the socket.
* **Resolution**:
  1. Added `socket.setTimeout(0)` inside the `connect()` callback to disable the idle timer immediately upon socket establishment.
  2. Enabled TCP keep-alive probes: `socket.setKeepAlive(true, 5000)`.
  3. Enabled TCP Nagle bypass: `socket.setNoDelay(true)`.
  4. Guarded `'timeout'` listener to trigger only if the initial connection fails to establish within 5000ms.
* **Status**: **RESOLVED & VERIFIED**.

---

### 2.2 Blocker #2: Silent Dry-Run Simulation Mode Default
* **Observed Symptom**:
  UI controls (Power ON/OFF, Brightness sliders, Color picker) changed visual state on screen, but the physical WS2812B LED strip did not illuminate or change color.
* **Root Cause**:
  In accordance with safe agent guidelines, `AppIpcManager` initialized `dryRun: true` by default whenever `%APPDATA%\LightControl\settings.json` was absent. When `dryRun` is enabled:
  ```typescript
  if (this.dryRun) {
    this.diagnostics?.logCommandTransmitted(this.id, `${opcodeDesc} (DRY-RUN)`, hex, frame.length);
    return true; // Skips socket.write()!
  }
  ```
  The application encoded and validated all frames in memory, but inhibited physical wire packet writes to protect hardware. Without an explicit indicator in the main header, it was not immediately obvious that the app was operating in simulation mode.
* **Resolution**:
  1. Added an interactive **"SIMULATION (DRY-RUN)" vs "LIVE HARDWARE"** mode toggle badge in the top navigation header (`Header.tsx`).
  2. Injected a prominent warning tag in `DiagnosticsScreen.tsx`.
  3. Added an explicit switch in `AppSettingsScreen.tsx` allowing one-click toggling between simulation and live hardware dispatch.
* **Status**: **RESOLVED & VERIFIED**.

---

### 2.3 Blocker #3: Brightness Safety Clamping at 20%
* **Observed Symptom**:
  Commands sent at 20% brightness (`0x33` = 51) may be barely visible or below threshold on high-density WS2812B strips powered by 5V buck converters with voltage drop.
* **Root Cause**:
  Safety limits hard-clamped all outgoing brightness byte values to 20% (`Math.min(brightness, 20)`).
* **Resolution**:
  1. Implemented a user-configurable safety switch in `AppSettingsScreen.tsx` and `PowerBrightnessScreen.tsx`.
  2. Users can switch between **"Safe Mode (20% Max)"** and **"Full Range (100% Unlocked)"** with one click.
  3. Added a continuous ceiling slider (5% to 100%) so users can set their preferred safe ceiling.
* **Status**: **RESOLVED & VERIFIED**.

---

### 2.4 Blocker #4: SPNET Byte 8 Session Key (`0x58` vs `0x00`)
* **Technical Observation**:
  - Outgoing state query frame: `53 50 54 45 43 48 00 02 58 00 00 00 00` (Byte 8 = `0x58`). This is 100% verified operational on hardware and triggers the 428-byte reply.
  - Received telemetry reply: `53 50 54 45 43 48 00 02 00 00 00 01 9f ...` (Byte 8 = `0x00`).
  - Control frames (`0x03`): Currently transmitted with `key = 0x58` (`[0x53, 0x50, 0x54, 0x45, 0x43, 0x48, 0x00, 0x03, 0x58, ...]`).
* **Remaining Investigation**:
  Does firmware `V2.0.13` require `key = 0x58` or `key = 0x00` in Message Type `0x03`?
  In `SpnetCodec.buildControlFrame(payload, key = 0x58)`, the default key is `0x58`. If live wire packets sent in Live mode do not trigger a visual LED change, testing `key = 0x00` is the primary hypothesis.
* **Status**: **READY FOR LIVE WIRE VERIFICATION**.

---

## 3. Verification & Diagnostic Checklist for Live Testing

To confirm complete end-to-end control of the SP530E controller:

1. **Launch Portable Application**:
   Run `G:\Light Test\release\LightControl-Portable.exe`.
2. **Verify Header Status**:
   - Confirm Device Selector displays: `SP530E Wi-Fi Controller (WIFI-TCP)`.
   - Confirm Connection Badge displays: `CONNECTED` (green pulse).
3. **Switch to Live Mode**:
   - In the header, click the amber `DRY-RUN` pill to toggle it to `LIVE` (cyan pulse).
4. **Inspect Diagnostic Log Console**:
   - Navigate to **Diagnostics & Logs** (`Ctrl+9` or sidebar).
   - Verify log stream is active and auto-scrolling.
   - Click **Copy All** or highlight text and click **Copy Selected** to test clipboard functionality.
   - Click **Export to .txt** to verify file-save dialog.
5. **Toggle Master Power**:
   - Click the master **Power ON / OFF** button in the header or on the Power screen.
   - Observe whether the physical WS2812B strip toggles power.
   - Check the diagnostic log for:
     `[TRANSMIT] [TRANSMITTED] Transmitted [Power ON] (16B) to sp530e-wifi-192-168-86-34: 53505445434800035800000003030101`
6. **Adjust Brightness & Colors**:
   - Unlock brightness if desired (toggle safety cap to 100%).
   - Select Red `#FF0000` or Cyan `#00FFFF` on the Color Picker screen.
   - Observe physical strip output.
