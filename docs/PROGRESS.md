# Project Progress & Investigation Log

## Current Status
- **Current Milestone**: Phase 0 Complete -> Phase 1 (Protocol Discovery) In Progress
- **Active Task**: Synthesizing reverse-engineering discoveries, validating BLE/Wi-Fi transport specifications, preparing architecture definitions.

---

## Chronological Progress Log

### 2026-10-27
- **Project Initialized**:
  - Received project goals, constraints, hardware targets (SP530E, WLED dig2go), and execution framework.
  - Established persistent agent operating guidelines in `AGENTS.md`.
  - Authored Master Project Plan with phased milestones and risk assessment in `docs/PROJECT_PLAN.md`.
  - Initialized documentation suite (`PROGRESS.md`, `DECISIONS.md`, `FEATURE_MATRIX.md`, `PROTOCOL_FINDINGS.md`, `HARDWARE_TESTS.md`).
  - Scaffolded source and test directory hierarchies (`src/core`, `src/adapters`, `src/main`, `src/preload`, `src/renderer`, `tests/unit`, `tests/adapters`, `tests/protocol`).
- **Environment Assessment**:
  - Operating System: Windows 10/11 build 10.0.26200.
  - Node.js: `v24.13.0`, npm: `11.6.2`.
  - Android Debug Bridge (ADB): `1.0.41` installed.
  - Attached Android Devices: `emulator-5554` detected.
- **Protocol Discovery Breakthroughs (Phase 1)**:
  - Confirmed official Android app package: `com.spled.scenex` (BanlanX, published by SPLED / Sperll).
  - Identified SP530E BLE GATT Profile: Primary Service UUID `0xFFE0` (`0000ffe0-0000-1000-8000-00805f9b34fb`) and Characteristic `0xFFE1` for commands/notifications.
  - Discovered critical hardware limitation: **Single-client BLE lock**. The mobile app must not have an active BLE connection while Windows connects.
  - Discovered native local Wi-Fi protocol: **SPNET** over TCP/UDP port `8587`, using a 13-byte binary header prefixed by `SPTECH\0`, enabling local control without cloud dependencies!
  - Recorded detailed evidence in `docs/PROTOCOL_FINDINGS.md`.

---

## Evidence Ledger

| ID | Date | Source | Description | Artifact Link |
| :--- | :--- | :--- | :--- | :--- |
| **EV-000** | 2026-10-27 | System Query | Node v24.13.0, npm 11.6.2, ADB present. | Terminal Log |
| **EV-001** | 2026-10-27 | ADB Shell | Package `com.spled.scenex` verified on device. | ADB Query |
| **EV-002** | 2026-10-27 | Community / Open Source | BLE GATT Service `0xFFE0`, Char `0xFFE1`. Single BLE connection limit verified. | `docs/PROTOCOL_FINDINGS.md` |
| **EV-003** | 2026-10-27 | Open Source / Protocol | SP530E Wi-Fi SPNET protocol: TCP/UDP port 8587 with 13-byte `SPTECH\0` binary framing. | `docs/PROTOCOL_FINDINGS.md` |

---

## Active Blockers & Unknowns
1. **Physical Device Presence on BLE / LAN**: We need to know if the user's physical SP530E controller is currently powered on and within Bluetooth range of this Windows machine, or if it is already provisioned to the local 2.4GHz Wi-Fi network.
2. **Current LED Strip Details**: Need to confirm user's attached strip model (e.g., WS2812B, WS2811, SK6812, PWM) to set safe IC parameters and current limits.
3. **Approval for Next Phase**: Explicit user approval is required before installing project packages (`npm install`) or performing initial local network / BLE scans.

---

## Next Recommended Step
1. Present Phase 0 completion report, folder structure, risk matrix, and initial protocol discoveries to the user.
2. Request confirmation on physical hardware state (is the SP530E powered on, paired via BLE or on Wi-Fi?).
3. Request approval to initialize `package.json` and install core TypeScript / testing tooling.
