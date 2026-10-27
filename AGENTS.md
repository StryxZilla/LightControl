# AGENTS.md - Autonomous Agent Operating Guidelines

## Project Overview
- **Project Root**: `G:\Light Test`
- **Application**: Windows 10/11 LED Controller (Universal LED Device Controller)
- **Target Hardware**:
  - BanlanX-compatible SP530E LED controller (BLE / Wi-Fi)
  - QuinLED dig2go running WLED (HTTP / WebSocket)
- **Tech Stack**: TypeScript, React, Electron, Secure Node.js Backend (or small C#/.NET IPC helper if Windows native BLE in Node proves unreliable).

---

## Autonomous Execution Rules
1. **Workspace Confinement**: All code, documentation, and operational scratch files must reside within `G:\Light Test` or designated agent cache directories.
2. **Tool-First Autonomy**: Utilize terminal, ADB, REA (Reverse Engineer Anything), file editors, and web research autonomously for routine engineering and analysis. Do not ask the user to perform tasks that can be automated safely.
3. **Approval Gates**: Always request explicit user approval before:
   - External package installations or system configuration modifications.
   - Accessing sensitive or private user data.
   - Transmitting active Bluetooth Low Energy (BLE) or network packets to physical hardware.
   - Potentially destructive operations (file deletions, flashing, reset commands).
4. **Zero Fabrication Policy**: Never hallucinate or fabricate tool outputs, packet bytes, protocol reverse-engineering findings, hardware responses, or test outcomes. If data is unknown or missing, explicitly log it as an unknown or blocker.
5. **Human-in-the-Loop for Mobile**: Only request physical interaction with the Android phone or BanlanX app when ADB automation or static analysis is impossible or inappropriate.
6. **Continuous Documentation**: Maintain living project documentation in `docs/` and log state transitions after every stage.

---

## Reverse Engineering & Compliance Rules
1. **Interoperability Exclusivity**: Reverse engineering of the BanlanX Android application is conducted strictly for clean-room interoperability with authorized hardware owned by the user.
2. **No Proprietary Contamination**:
   - Never copy decompiled code, proprietary assets, logos, or copyrighted code into the project source.
   - Translate protocol insights into clean, independent TypeScript/domain implementations.
3. **Security & Privacy**:
   - Never bypass authentication mechanisms or extract user credentials/tokens.
   - Do not redistribute BanlanX APK files or proprietary assets.

---

## Architecture Principles
1. **Universal Hardware Abstraction Layer (HAL)**:
   - The application must communicate with controllers exclusively through a unified `ILedDevice` / `ILedAdapter` interface.
   - High-level application logic (UI, scenes, presets) must remain decoupled from physical transport mechanisms.
2. **Capability-Driven Design**:
   - Controllers report a `DeviceCapabilities` descriptor (e.g., color models, IC support, segment control, dynamic modes, music modes, timer support).
   - UI controls must dynamically adapt to device capabilities. Never assume all devices support uniform features.
3. **Pluggable Adapters**:
   - `MockAdapter` / Simulator (for rapid UI development and offline testing)
   - `SP530EBleAdapter` (Windows BLE transport)
   - `SP530EWiFiAdapter` (LAN/UDP/TCP/HTTP if verified feasible)
   - `WledAdapter` (JSON API / WebSocket)
4. **Safety & Robustness**:
   - Safe reconnection logic with exponential backoff.
   - Rate limiting and command coalescing to prevent hardware buffer overruns.
   - Graceful offline fallback.

---

## Project Documentation Inventory
Always keep these files accurate and up-to-date:
- `AGENTS.md`: This operational ruleset and persistent configuration.
- `docs/PROJECT_PLAN.md`: Strategic roadmap, milestone stages, and risk management.
- `docs/PROGRESS.md`: Chronological log of actions, evidence discovered, blockers, and next steps.
- `docs/DECISIONS.md`: Architectural Decision Records (ADRs).
- `docs/FEATURE_MATRIX.md`: Hardware capability comparison and feature support status.
- `docs/PROTOCOL_FINDINGS.md`: Verified protocol structures, byte layouts, checksums, and transport details.
- `docs/HARDWARE_TESTS.md`: Hardware test plans, execution reports, and safety boundaries.
