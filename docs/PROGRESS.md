# Project Progress & Investigation Log

## Current Status
- **Current Milestone**: Phase 0 Complete -> Phase 1 (Protocol Discovery & Reverse Engineering) Ready
- **Active Task**: Environment audit finalized, reverse engineering toolchain (ADB, REA MCP, JADX, Apktool, Wireshark/TShark) verified.

---

## Chronological Progress Log

### 2026-10-27
- **Project Initialized**:
  - Received project goals, constraints, hardware targets (SP530E with WS2812B, WLED dig2go), and execution framework.
  - Established persistent agent operating guidelines in `AGENTS.md`.
  - Authored Master Project Plan with phased milestones and risk assessment in `docs/PROJECT_PLAN.md`.
  - Initialized documentation suite (`PROGRESS.md`, `DECISIONS.md`, `FEATURE_MATRIX.md`, `PROTOCOL_FINDINGS.md`, `HARDWARE_TESTS.md`, `ENVIRONMENT.md`).
  - Scaffolded package and research directory hierarchies (`research/...`, `protocol/fixtures`, `packages/...`, `apps/...`, `tests`, `release`).
  - Configured comprehensive `.gitignore` preventing APK/log/secret leaks, initialized Git, and made initial commit.
- **Protocol Discovery Breakthroughs**:
  - Confirmed official Android app package: `com.spled.scenex` (BanlanX, published by SPLED / Sperll).
  - Identified SP530E BLE GATT Profile: Primary Service UUID `0xFFE0` (`0000ffe0-0000-1000-8000-00805f9b34fb`) and Characteristic `0xFFE1` for commands/notifications.
  - Discovered critical hardware limitation: Single-client BLE lock.
  - Discovered native local Wi-Fi protocol: SPNET over TCP/UDP port `8587`, using a 13-byte binary header prefixed by `SPTECH\0`.
- **Environment Audit & Recheck**:
  - Verified Node.js `v24.13.0`, npm `11.6.2`, Git `2.52.0`, Python `3.8.0`, Microsoft OpenJDK `21.0.9 LTS`.
  - Verified Windows BLE Radio (Realtek VID `13D3` PID `3586`) and Bluetooth Support Service running.
  - Resolved Apktool issue: renamed `apktool.jar.jar` to `apktool.jar` in `G:\Downloads\tools`, removed hanging pause, verified Apktool `3.0.3` via REA live call (`inspect_apktool_client`).
  - Verified Wireshark / TShark `4.6.9` installed at `C:\Program Files\Wireshark\tshark.exe`.
  - Confirmed JADX engine (`jadx-headless-mcp-0.7.1-all.jar`) and JADX GUI (`1.5.6`).

---

## Evidence Ledger

| ID | Date | Source | Description | Artifact Link |
| :--- | :--- | :--- | :--- | :--- |
| **EV-000** | 2026-10-27 | System Query | Node v24.13.0, npm 11.6.2, ADB present. | Terminal Log |
| **EV-001** | 2026-10-27 | ADB Shell | Package `com.spled.scenex` verified on device. | ADB Query |
| **EV-002** | 2026-10-27 | Community / Open Source | BLE GATT Service `0xFFE0`, Char `0xFFE1`. Single BLE connection limit verified. | `docs/PROTOCOL_FINDINGS.md` |
| **EV-003** | 2026-10-27 | Open Source / Protocol | SP530E Wi-Fi SPNET protocol: TCP/UDP port 8587 with 13-byte `SPTECH\0` binary framing. | `docs/PROTOCOL_FINDINGS.md` |
| **EV-004** | 2026-10-27 | REA Live Call | `inspect_adb_client` and `list_adb_devices` verified live. | `docs/ENVIRONMENT.md` |
| **EV-005** | 2026-10-27 | REA Live Call | `inspect_apktool_client` verified live (Apktool 3.0.3). | `docs/ENVIRONMENT.md` |

---

## Next Recommended Step
1. Request user approval to add `C:\Program Files\Wireshark` to the user's `PATH`.
2. Request user approval to pull `com.spled.scenex` APK from `emulator-5554` into `research/apk` and begin static protocol analysis with REA / JADX.
