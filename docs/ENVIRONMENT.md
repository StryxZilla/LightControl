# Environment Audit & Verification Report

**Audit Date**: 2026-10-27  
**Host Operating System**: Windows 11 Pro / Enterprise (build 10.0.26200 x64)  
**Workspace**: `G:\Light Test` (Verified quoted path handling)

---

## 1. Tool Verification Summary

| Component | Target Version | Detected Version | Executable / Location | Audit Status |
| :--- | :---: | :---: | :--- | :---: |
| **Node.js** | >= 18 | `v24.13.0` | `C:\Program Files\nodejs\node.exe` | **PASSED** |
| **npm** | >= 9 | `11.6.2` | `C:\Program Files\nodejs\npm.cmd` | **PASSED** |
| **Git** | Any modern | `2.52.0.windows.1` | `C:\Program Files\Git\cmd\git.exe` | **PASSED** |
| **ADB** | >= 1.0.40 | `1.0.41` (Bridge `37.0.1`) | `C:\Users\Andy\AppData\Local\Android\Sdk\platform-tools\adb.exe` | **PASSED** |
| **REA MCP** | >= 2.0 | `2.3.1` (Agents `6.7.0`) | `C:\Users\Andy\.gemini\config\mcp_config.json` | **PASSED** |
| **Java** | >= 17 | `21.0.9 LTS` | `C:\Program Files\Microsoft\jdk-21.0.9.10-hotspot\bin\java.exe` | **PASSED** |
| **Python** | >= 3.8 | `3.8.0` | `C:\Users\Andy\AppData\Local\Programs\Python\Python38\python.exe` | **PASSED** |
| **Windows BLE** | WinRT BLE | Realtek VID 13D3 / PID 3586 | `Microsoft Bluetooth LE Enumerator` (Status: OK) | **PASSED** |
| **JADX (Headless MCP)** | >= 0.7 | `0.7.1` (JADX `1.5.6`) | `C:\tools\jadx\jadx-headless-mcp-0.7.1-all.jar` | **PASSED** |
| **JADX (CLI)** | Any | Not Found on PATH | Missing system-wide CLI (`skylot.jadx`) | **OPTIONAL** |
| **Apktool** | >= 2.9 | Not Found on PATH | Missing `apktool` launcher | **BLOCKED** |
| **Wireshark / TShark** | >= 4.0 | Not Found on PATH | Missing `tshark.exe` | **BLOCKED** |
| **.NET SDK** | >= 8.0 | Not Found on PATH | Missing `dotnet` SDK | **PENDING** |

---

## 2. Connected Devices & Hardware Audit

### 2.1 Android Device (ADB)
- **Serial**: `emulator-5554`
- **State**: `device` (Transport: `tcp`)
- **Product / Model**: `sdk_gphone64_x86_64` (Architecture: `x86_64`)
- **Target Application Detected**: `com.spled.scenex` (Official BanlanX app installed)
- **APK Path on Device**: `/data/app/~~ulM99EfcL9AVCW2-ehfrYw==/com.spled.scenex-42pGodbKYMf9Iu01IPgfCQ==/base.apk`

### 2.2 Physical LED Hardware Profile
- **Controller**: BanlanX-compatible SP530E (ESP32-C3 dual-mode BLE + Wi-Fi)
- **Power State**: Powered on
- **Attached LED Strip**: WS2812B addressable LED strip (5V SPI data line)
- **Current Safety Directive**: 20% software brightness cap during initial live verification to prevent voltage drop and current overload.

### 2.3 Windows Bluetooth Subsystem
- **Radio**: `Generic Bluetooth Adapter` (Hardware ID: `USB\VID_13D3&PID_3586\00E04C000001`)
- **Enumerators**: `Microsoft Bluetooth Enumerator` (Status: OK), `Microsoft Bluetooth LE Enumerator` (Status: OK)
- **Service**: `bthserv` (Bluetooth Support Service) is `Running`.

---

## 3. Live REA MCP Connectivity Tests
In compliance with the project rule to test REA functionality by invoking harmless live tools:

1. **Test 1 - `inspect_adb_client`**:
   - Invocation: `call_mcp_tool(ServerName="rea", ToolName="inspect_adb_client", Arguments={})`
   - Result: Successful response with valid Evidence ID `ev_c2a04dc08f29e129ff2da42125f5e0fd9576495a02d223431cc1c8c31d244e88`.
   - Confirmed client binary: `C:\Users\Andy\AppData\Local\Android\Sdk\platform-tools\adb.exe`.

2. **Test 2 - `list_adb_devices`**:
   - Invocation: `call_mcp_tool(ServerName="rea", ToolName="list_adb_devices", Arguments={})`
   - Result: Successful response with Evidence ID `ev_4c757347880f0441e1c71e7cf73fdd9a45173a969fdcdb6170654d8aa8753f91`.
   - Correctly identified `emulator-5554` as an emulator device.

3. **Test 3 - `binary_session`**:
   - Invocation: `call_mcp_tool(ServerName="rea", ToolName="binary_session", Arguments={})`
   - Result: Live capability report returned 207 MCP tools across native, managed, artifact graph, and Android providers.

---

## 4. Repository & Workspace Scaffolding

- **Workspace Path**: `G:\Light Test`
- **Git Repository**: Initialized empty Git repository at `G:\Light Test\.git`.
- **Git Exclusion Configuration (`.gitignore`)**:
  - Excludes raw APKs, splits, and dex files (`research/apk/*`).
  - Excludes decompiled source trees (`research/decompiled/*`).
  - Excludes network captures (`*.pcap`, `*.pcapng`, `research/network/*`).
  - Excludes screenshots and UI assets (`research/screenshots/*`).
  - Excludes logs, debug dumps, and crash logs.
  - Excludes secrets, certificates, and environment files (`.env*`).
  - Excludes build outputs (`dist/`, `build/`, `release/`, `*.exe`, `*.dll`).
- **Required Folder Layout Created**:
  - `research/apk` (with `.gitkeep`)
  - `research/decompiled` (with `.gitkeep`)
  - `research/screenshots` (with `.gitkeep`)
  - `research/bluetooth` (with `.gitkeep`)
  - `research/network` (with `.gitkeep`)
  - `research/references` (with `.gitkeep`)
  - `docs`
  - `protocol/fixtures` (with `.gitkeep`)
  - `packages/core`
  - `packages/adapters`
  - `packages/ui`
  - `apps/desktop`
  - `apps/test-harness`
  - `tests`
  - `release` (with `.gitkeep`)

---

## 5. Safely Resolved Issues & Local Fixes

1. **Java 17+ Location**:
   - `java` was not on global `PATH`.
   - Discovered Microsoft OpenJDK 21.0.9 LTS at `C:\Program Files\Microsoft\jdk-21.0.9.10-hotspot`.
   - Verified execution and confirmed `JAVA_HOME` configuration in `mcp_config.json`.
2. **JADX Engine Availability**:
   - Discovered headless JADX MCP jar `jadx-headless-mcp-0.7.1-all.jar` at `C:\tools\jadx`.
   - Successfully tested execution under Java 21. Headless JADX is fully wired to REA MCP.

---

## 6. Blockers & Missing Dependencies Requiring User Approval

Per our project governance rules, system-wide installations or external downloads require explicit user approval.

### Blocker 1: Wireshark / TShark (For Bluetooth & SPNET Packet Captures)
- **Role**: Required for automated packet inspection and capture analysis (`inspect_pcap_client`).
- **Proposed Solution**: Install via winget:
  ```powershell
  winget install --id WiresharkFoundation.Wireshark -e
  ```

### Blocker 2: Apktool (For Android Resource & Manifest Decoding)
- **Role**: Used by REA for decoding binary XML manifests and Android resources (`inspect_apktool_client`).
- **Proposed Solution**: Download official `apktool.jar` (v2.10.x) to a project-local or local tool directory (`C:\tools\apktool\apktool.jar`) and create a batch wrapper, or install via package manager.

### Blocker 3: JADX CLI (Optional Convenience)
- **Role**: While REA uses the headless JADX MCP jar (`C:\tools\jadx\jadx-headless-mcp-0.7.1-all.jar`), having the standalone JADX GUI/CLI (`jadx.bat`) allows rapid interactive decompilation browsing.
- **Proposed Solution**: Install via winget:
  ```powershell
  winget install --id Skylot.jadx -e
  ```

### Blocker 4: .NET SDK (Optional / Phase 3 Transport Fallback)
- **Role**: Required only if Node.js native Bluetooth Low Energy libraries fail on Windows 11 and we deploy the C# WinRT IPC helper (ADR-004).
- **Proposed Solution**: Defer until needed, or install now via winget:
  ```powershell
  winget install --id Microsoft.DotNet.SDK.8 -e
  ```

---

## 7. Reverse Engineering Readiness Gate
In accordance with user instruction:
> **"Do not start Android reverse engineering until the environment is ready."**

The environment is in a **HELD (AWAITING APPROVAL)** state pending resolution of the packet capture (Wireshark/TShark) and resource decoding (Apktool) tools, or explicit user sign-off to proceed using the verified JADX MCP + ADB REA toolchain.
