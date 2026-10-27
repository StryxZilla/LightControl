# Device & Protocol Compatibility Report

This document reports the exact verification status for all hardware targets, transport channels, and protocol features in the Universal Windows 10/11 LED Device Controller project.

In strict compliance with **Zero Fabrication** and compliance guidelines, statuses are divided into four mutually exclusive categories.

---

## 1. Verified on Real Hardware

These features have been physically transmitted to, executed on, and confirmed by physical hardware units owned by the user.

| Target Device | Transport Channel | Validated Features | Verification Date & Evidence |
|---|---|---|---|
| **BanlanX SP530E Controller** | Local Wi-Fi (SPNET TCP port 8587) | • Physical TCP socket connection (42 ms RTT latency)<br>• 13-byte query frame handshake<br>• Real-time telemetry ingest (428-byte chunk decoding)<br>• Power toggle (ON/OFF command `03 01 ...`)<br>• Brightness adjustment with 20% safety cap (`03 02 33`)<br>• Solid RGB Primary Colors (Red, Green, Blue writes)<br>• Dynamic Built-in Rainbow Effect Mode 1 (`03 06 01`)<br>• Automatic socket teardown and reconnection backoff | 2026-10-27 21:47 UTC<br>`research/fixtures/sp530e_status_response.bin`<br>`docs/HARDWARE_TESTS.md` |

---

## 2. Verified Using Mock or Simulator

These features have been verified against standalone mock servers, virtual hardware simulators, and realistic protocol captures.

| Target Architecture | Simulation Environment | Validated Features | Test Suites & Verification |
|---|---|---|---|
| **QuinLED dig2go / WLED** | Local Node.js HTTP & RFC 6455 WebSocket Mock Server (`WledMockServer`) | • HTTP REST endpoints (`/json`, `/json/state`, `/json/info`, `/json/eff`, `/json/pal`, `/presets.json`)<br>• Full state interrogation and dynamic capability extraction<br>• Zero-hardcoded effect discovery (180+ effects, 70+ palettes)<br>• Real-time WebSocket bidirectional push synchronization (`ws://<ip>:<port>/ws`)<br>• Application-level heartbeat ping (`p` / `pong`)<br>• Power, 20% safe brightness scaling, solid RGB/RGBW colors<br>• Dynamic effects, speed, intensity, and palette transitions<br>• Multi-segment configuration and individual segment addressing<br>• Presets management (fetch, apply `ps`, save `psave`, delete `pdel`)<br>• Playlist loops (`playlist: { ps, dur, repeat, end }`)<br>• QuinLED dig2go identity detection (`isDig2Go`)<br>• Sound-Reactive firmware detection (`isSoundReactive`)<br>• Exponential backoff WebSocket auto-reconnect (1s–16s) | `tests/wled/wled-adapter.test.ts`<br>`tests/wled/wled-websocket.test.ts`<br>`tests/wled/wled-codec.test.ts`<br>`tests/wled/wled-fixtures.test.ts` (19 passing tests) |
| **SP530E Bluetooth LE** | C# WinRT BLE Helper JSON-RPC Loopback (`Sp530eBleHelper.exe`) | • JSON-RPC standard I/O process management<br>• Ping/pong process lifecycle and error propagation<br>• Dry-run BLE frame generation and packet structure validation<br>• Checksum calculation (`0x53 0x50 ...` framing) | `tests/sp530e/ble-helper-ipc.test.ts`<br>`tests/sp530e-ble-codec.test.ts`<br>`tests/sp530e/protocol-fixtures.test.ts` |
| **Virtual LED Strip Simulator** | `MockAdapter` / `MockLedDevice` | • Full `ILedDevice` lifecycle simulation<br>• Capability-driven feature gating<br>• Offline UI styling, theme testing, and rapid prototyping | `tests/unit/mock-adapter.test.ts`<br>`tests/core/device-manager.test.ts` |
| **Windows Desktop Application** | Electron 34 Headless Runtime & Chromium Browser | • All 11 application screens<br>• Secure Electron IPC context bridge<br>• Central 20 Hz command rate limiter<br>• Settings persistence to `userData/settings.json`<br>• Real Electron window screenshot capture | `tests/desktop/desktop-build.test.ts`<br>`SMOKE_TEST_READY` (Verified) |

---

## 3. Implemented but Not Tested

These features have fully implemented source code, unit tests, and architectures, but have not yet executed against physical hardware.

| Target Device | Transport Channel | Implemented Capability | Blocker / Dependency for Physical Test |
|---|---|---|---|
| **QuinLED dig2go** | Local Wi-Fi HTTP / WebSocket | Physical device hardware validation | Physical QuinLED dig2go device is pending delivery. Test plan prepared in `docs/DIG2GO_HARDWARE_TEST_PLAN.md`. |
| **BanlanX SP530E** | Windows WinRT Bluetooth LE (GATT) | Direct BLE over-the-air packet transmission to physical SP530E | Physical hardware was validated over the faster, more feature-rich local Wi-Fi TCP port 8587. BLE transport code is compiled and dry-run verified. |
| **WLED Dual-White / CCT Strips** | HTTP / WebSocket | Dynamic Kelvin color temperature slider tuning (2000K–6500K) | Physical dual-white CCT strip hardware not currently attached to controller. |

---

## 4. Unsupported or Unresolved

These features are either deliberately out-of-scope for architectural and privacy reasons or are fundamentally unsupported by the underlying hardware.

| Feature / Protocol | Reason for Unsupported Status | Architectural Decision / Mitigation |
|---|---|---|
| **BanlanX Cloud Relay Protocol** | Violates privacy and clean-room offline principles; introduces third-party server dependency. | **Deliberately excluded** per ADR-002. Application operates 100% locally on LAN / BLE. |
| **SP530E IR Remote Status Feedback** | Hardware limitation: the SP530E's infrared receiver executes internally on the microcontroller and does not broadcast IR button events over Wi-Fi or BLE. | Telemetry queries periodically poll the controller state to detect external mode changes. |
| **QuinLED dig2go Direct USB-C Data** | Hardware design: the dig2go USB-C port is wired for 5V power and USB-to-UART serial flashing, not runtime IP networking. | Device communicates exclusively via 2.4 GHz Wi-Fi (HTTP/WebSocket) as designed by WLED. |
