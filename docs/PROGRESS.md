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

---

## Chronological Progress Log

### Prompt 5: Dynamic Android UI & Behavioral Analysis via ADB (2026-10-27)
- Systematically automated `emulator-5554` with explicit serial targeting across 15+ application screens.
- Captured high-resolution screenshots and UIAutomator XML accessibility hierarchies (`research/screenshots/01_*.png` to `28_*.png`).
- Traversed Home (Devices/Groups), Quick Add menu, Device Catalog, Wi-Fi Controller models, Model Search (`SP530E`), Group Wizard (homogeneous type restriction), Me profile, Settings (Auto Connect, 12 locales, About), Third-Party Voice Services, FAQ, and Product Manuals.
- Correlated BanlanX shared UI package `packages/sp630e/` to physical SP530E 5-in-1 modality (WS2812B active profile, 142 dynamic effects, 8 strip music modes, 9 matrix music modes, onboard microphone gain).
- Produced comprehensive specifications:
  - `docs/ANDROID_UI_MAP.md`: Global Mermaid flowchart, screen-by-screen hierarchy, bounds, and widget trees.
  - `docs/UI_FEATURE_MATRIX.md`: Mapping of visible UI controls to SP530E hardware registers and Windows targets.
  - `docs/UI_TO_PROTOCOL_MAP.md`: Direct mapping from UI gestures to Dart AOT methods, opcodes, and 13-byte SPNET framing.
  - `docs/EMULATOR_LIMITATIONS.md`: Formal documentation of QEMU BLE and NAT multicast constraints vs native Windows advantages.

---

## Next Recommended Step
1. Commit Prompt 5 deliverables to Git repository.
2. Implement desktop UI components (`packages/ui/`) using React and Tailwind/CSS, mirroring BanlanX functionality with improved desktop ergonomics (keyboard shortcuts, preset slots, responsive layout).
3. Connect desktop UI to `@led-controller/adapters` (`MockAdapter` and `SP530EWiFiAdapter`).
4. Execute safe live hardware verification against user's physical SP530E controller at `192.168.86.34:8587` with strict 20% brightness safety limit.
