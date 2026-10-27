# Project Progress & Investigation Log

## Current Status
- **Current Milestone**: Phase 1 (Protocol Discovery & Research) Substantially Advanced
- **Active Task**: Synthesized comprehensive research dossiers for SP530E and WLED/dig2go; established protocol bibliography and research gap ledger; updated project plan with transport recommendations.

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
- **Deep Research Completed & Documented**:
  - **`docs/SP530E_RESEARCH.md`**: Complete hardware audit (ESP32-C3, 5V-24V, 5 PWM channels up to 6A/ch, SPI up to 1200 RGB pixels), 12 operating modes, IC driver support, BLE GATT UUIDs (`0xFFE0`/`0xFFE1`), manufacturer ID `20563`, model code `0x4E`, single-client BLE lock, and local Wi-Fi `SPNET` protocol on TCP/UDP port 8587 (13-byte `SPTECH\0` header).
  - **`docs/WLED_RESEARCH.md`**: Official WLED JSON API (`/json`, `/json/state`, `/json/info`, `/json/eff`, `/json/pal`), WebSocket `/ws` real-time state broadcast and bi-directional control, mDNS discovery (`_wled._tcp`), multi-segment architecture, presets, playlists, and QuinLED dig2go hardware details (ESP32-WROOM-32E, 74AHCT125 5V level shifter, I2S mic, 3A USB-C limit, MOSFET power-cut relay).
  - **`docs/PROTOCOL_REFERENCE_LINKS.md`**: Bibliography of datasheets, manuals, GitHub repos, and issue threads.
  - **`docs/RESEARCH_GAPS.md`**: Verification ledger categorizing established facts, working hypotheses, and static APK extraction targets.
  - **`docs/PROJECT_PLAN.md` Updated**: Added detailed analysis recommending **Local Wi-Fi First, BLE Second** for SP530E hardware verification.

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
| **EV-007** | 2026-10-27 | Manufacturer Specs | QuinLED dig2go hardware specs verified. | `docs/WLED_RESEARCH.md` |

---

## Next Recommended Step
1. Commit research documentation suite to Git.
2. Confirm with user if physical SP530E is currently provisioned to their local Wi-Fi network.
3. Obtain approval to pull `com.spled.scenex` APK from `emulator-5554` into `research/apk` and extract exact `SPTECH` chunk structures and BLE opcodes via JADX.
