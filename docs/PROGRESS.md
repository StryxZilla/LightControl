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
| **EV-013** | 2026-10-27 | Wi-Fi Telemetry & Benchmarks | Verified 49ms TCP handshake, 150ms round-trip query, and 428B live telemetry. | `docs/WIFI_TEST_RESULTS.md`, `tests/protocol/spnet-codec.test.ts` |

---

## Chronological Progress Log

### Prompt 7: Local Wi-Fi Protocol Deep Dive & Empirical Benchmarks (2026-10-27)
- Executed safe, read-only Wi-Fi discovery and telemetry query against live physical hardware (`192.168.86.34:8587`).
- Verified empirical network benchmarks:
  - TCP socket connect latency: **49 ms**.
  - Read-only query round-trip: **150 ms**.
  - Packet integrity: 100% (428 bytes received and decoded).
  - Telemetry: Firmware `V2.0.13`, WS2812B IC (`0x86`), 60 pixels, Power ON, Brightness 100/255, Effect Mode 3, Color (1, 255, 255).
- Confirmed zero cloud dependency and unauthenticated local LAN binary protocol (`SPNET` on TCP 8587).
- Extended `SpnetCodec` with control frame encoders for Power, Brightness (20% safety limit), RGB Color, Effect Mode, Speed, and Direction.
- Added comprehensive unit tests in `tests/protocol/spnet-codec.test.ts` (suite total: 21/21 passing tests in 91 ms).
- Evaluated transport comparison: Formulated definitive recommendation to use **Local Wi-Fi (`SPNET`) as the primary desktop transport** (bypassing the BLE single-client lockout and providing multi-client support with sub-50ms responsiveness), while retaining BLE as secondary fallback.
- Produced specifications:
  - `docs/SP530E_WIFI_PROTOCOL.md`: Complete local Wi-Fi protocol specification, header framing, and chunk formats.
  - `docs/SP530E_TRANSPORT_COMPARISON.md`: Side-by-side technical comparison and empirical benchmark ledger.
  - `docs/WIFI_TEST_RESULTS.md`: Empirical test report and latency benchmarks.

---

## Next Recommended Step
1. Commit Prompt 7 deliverables to Git repository.
2. Proceed to scaffolding the desktop UI application (`packages/ui/`) in React with modern design, responsive controls (HSV color wheel, brightness slider with 20% limit, effect selector, preset slots), and adapter switching (`SP530EWiFiAdapter`, `MockAdapter`).
3. Connect UI components to live hardware adapter for interactive end-to-end control.
