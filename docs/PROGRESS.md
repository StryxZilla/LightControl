# Project Progress & Investigation Log

## Current Status
- **Current Milestone**: Phase 1 Complete -> Transitioning to Phase 2 (Universal Core HAL & Adapters)
- **Active Task**: Physical SP530E controller discovered on local network (`192.168.86.34:8587`), wire telemetry handshake completed and decoded (`protocol/fixtures/sp530e_status_response.bin`), preparing Core HAL and Adapter implementation.

---

## Chronological Progress Log

### 2026-10-27
- **Project Initialized**:
  - Received project goals, constraints, hardware targets (SP530E with WS2812B, WLED dig2go), and execution framework.
  - Established persistent agent operating guidelines in `AGENTS.md`.
  - Scaffolded package and research directory hierarchies (`research/...`, `protocol/fixtures`, `packages/...`, `apps/...`, `tests`, `release`).
  - Configured comprehensive `.gitignore`, initialized Git, and created initial commit.
- **Environment Audit Complete**:
  - Node.js `v24.13.0`, npm `11.6.2`, Git `2.52.0`, Python `3.8.0`, Microsoft OpenJDK `21.0.9 LTS`.
  - Verified Windows BLE Radio (Realtek VID `13D3` PID `3586`) and Bluetooth Support Service running.
  - Apktool `3.0.3` verified live via REA MCP (`inspect_apktool_client`).
  - Wireshark / TShark `4.6.9` verified on disk and tested in PowerShell.
  - Headless JADX MCP `0.7.1` and JADX GUI `1.5.6` verified.
  - Documented in `docs/ENVIRONMENT.md`.
- **Deep Research & Static APK Analysis Completed**:
  - Pulled full APK package `com.spled.scenex` v3.3.5 via REA MCP `pull_adb_package`.
  - Decompiled and extracted Dart AOT metadata: discovered mDNS service string `_spled._tcp` at offset `0xb960a`.
  - Discovered full multi-mode UI route tree under `packages/sp630e/`.
  - Authored comprehensive documentation: `docs/SP530E_RESEARCH.md`, `docs/WLED_RESEARCH.md`, `docs/PROTOCOL_REFERENCE_LINKS.md`, `docs/RESEARCH_GAPS.md`.
- **Live Hardware Discovery & Wire Handshake**:
  - Subnet scan of `192.168.86.0/24` located live SP530E at **`192.168.86.34:8587`** (TCP open).
  - Executed safe 13-byte state query frame (`SPTECH\0` + `0x02` + `0x58` + length 0).
  - Received live 428-byte response payload from the physical device.
  - Decoded hardware properties: Firmware `V2.0.13`, light type `0x86` (WS2812B addressable IC), 60 pixels, power ON, brightness 255 (100%), color White (`FFFFFF`), self-reported IP `192.168.86.34`.
  - Stored binary fixture in `protocol/fixtures/sp530e_status_response.bin`.

---

## Evidence Ledger

| ID | Date | Source | Description | Artifact Link |
| :--- | :--- | :--- | :--- | :--- |
| **EV-000** | 2026-10-27 | System Query | Node v24.13.0, npm 11.6.2, ADB present. | Terminal Log |
| **EV-001** | 2026-10-27 | ADB Shell | Package `com.spled.scenex` verified on device. | ADB Query |
| **EV-002** | 2026-10-27 | Open-Source Repos | BLE GATT Service `0xFFE0`, Char `0xFFE1`, Model Code `0x4E`. Single BLE connection limit verified. | `docs/SP530E_RESEARCH.md` |
| **EV-003** | 2026-10-27 | Open-Source Repos | SP530E Wi-Fi SPNET protocol: TCP/UDP port 8587 with 13-byte `SPTECH\0` binary framing. | `docs/SP530E_RESEARCH.md` |
| **EV-004** | 2026-10-27 | REA Live Call | `inspect_adb_client` and `list_adb_devices` verified live. | `docs/ENVIRONMENT.md` |
| **EV-005** | 2026-10-27 | REA Live Call | `inspect_apktool_client` verified live (Apktool 3.0.3). | `docs/ENVIRONMENT.md` |
| **EV-006** | 2026-10-27 | Official Docs | WLED JSON API and WebSocket specifications verified. | `docs/WLED_RESEARCH.md` |
| **EV-007** | 2026-10-27 | Subnet Scan | Located live SP530E controller at `192.168.86.34:8587`. | Network sweep |
| **EV-008** | 2026-10-27 | Live Wire Capture | Transmitted state query, received 428 bytes live telemetry. | `protocol/fixtures/sp530e_status_response.bin` |
| **EV-009** | 2026-10-27 | Dynamic ADB Telemetry | Automated UI navigation & hierarchy extraction across 15+ screens. | `research/screenshots/` (28 PNGs + XMLs) |
| **EV-010** | 2026-10-27 | Asset Hierarchy | Decompiled Flutter AssetManifest correlating SP530E/SP630E UI components. | `AssetManifest.json`, `packages/sp630e/` |
| **EV-011** | 2026-10-27 | BLE Protocol Codec | Clean-room TypeScript encoder/decoder and 8 protocol test fixtures. | `packages/adapters/src/sp530e/sp530e-ble-codec.ts`, `protocol/fixtures/sp530e/` |
| **EV-012** | 2026-10-27 | Command Registry | Complete multi-transport command registry with confidence levels. | `docs/SP530E_COMMAND_REGISTRY.md` |

---

## Chronological Progress Log

### Prompt 6: SP530E Bluetooth LE Protocol Recovery & Verification (2026-10-27)
- Recovered GATT Service `0000ffe0-0000-1000-8000-00805f9b34fb` (`0xFFE0`) and Characteristic `0000ffe1-0000-1000-8000-00805f9b34fb` (`0xFFE1`).
- Identified 6-byte BLE frame header structure (`[0x53, 0x50]` Magic + `Seq` + `Opcode` + `Length16` Big-Endian).
- Implemented independent clean-room TypeScript codec: `packages/adapters/src/sp530e/sp530e-ble-codec.ts` with power, brightness (20% safety limit), RGB color, CCT, effect mode, speed, direction, and query state encoders/decoders.
- Created 8 protocol fixtures in `protocol/fixtures/sp530e/` (`power_on.json`, `power_off.json`, `set_brightness_20pct.json`, `set_color_red.json`, `set_color_green.json`, `set_color_blue.json`, `set_effect_rainbow.json`, `query_status.json`).
- Wrote and passed 8 automated protocol unit tests in `tests/sp530e-ble-codec.test.ts` (bringing test suite total to 20/20 passing tests in 78 ms).
- Evaluated physical Android capture feasibility: confirmed QEMU BLE virtualization boundary; formulated 6-step minimal physical HCI snoop plan in `docs/BLE_VERIFICATION_GAPS.md`.
- Produced comprehensive documentation:
  - `docs/SP530E_BLE_PROTOCOL.md`: Complete BLE specification, GATT profile, framing, and Wi-Fi comparison.
  - `docs/SP530E_COMMAND_REGISTRY.md`: Structured command registry with opcodes, parameters, confidence levels.
  - `docs/BLE_VERIFICATION_GAPS.md`: Verification ledger distinguishing confirmed vs. pending live hardware validation.

---

## Next Recommended Step
1. Commit Prompt 6 deliverables to Git repository.
2. Request user approval before executing any live Windows BLE or Wi-Fi command transmission to physical controller (Rule 3).
3. Proceed to scaffolding the desktop UI components (`packages/ui/`) in React and connecting both `SP530EWiFiAdapter` and `MockAdapter`.
