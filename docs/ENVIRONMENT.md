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
| **ADB & Devices** | >= 1.0.40 | `1.0.41` (Bridge `37.0.1`) | `emulator-5554` (`com.spled.scenex` installed) | **PASSED** |
| **REA MCP** | >= 2.0 | `2.3.1` (Agents `6.7.0`) | Verified live via harmless tool calls | **PASSED** |
| **Java** | >= 17 | `21.0.9 LTS` | `C:\Program Files\Microsoft\jdk-21.0.9.10-hotspot\bin\java.exe` | **PASSED** |
| **Apktool** | >= 2.9 | `3.0.3` | `G:\Downloads\tools\apktool.bat` (Verified live in REA MCP) | **PASSED** |
| **Wireshark / TShark** | >= 4.0 | `4.6.9` | `C:\Program Files\Wireshark\tshark.exe` | **PASSED (CLI Verified)** |
| **Python** | >= 3.8 | `3.8.0` | `C:\Users\Andy\AppData\Local\Programs\Python\Python38\python.exe` | **PASSED** |
| **Windows BLE** | WinRT BLE | Realtek VID 13D3 / PID 3586 | `Microsoft Bluetooth LE Enumerator` (Status: OK) | **PASSED** |
| **JADX (Headless MCP)** | >= 0.7 | `0.7.1` (JADX `1.5.6`) | `C:\tools\jadx\jadx-headless-mcp-0.7.1-all.jar` | **PASSED** |
| **JADX (GUI / Standalone)**| >= 1.5 | `1.5.6` | `C:\Users\Andy\AppData\Local\Microsoft\WinGet\Packages\Skylot.jadx_*\jadx-gui-1.5.6.exe` | **PASSED** |
| **.NET SDK** | >= 8.0 | Not Found | Not installed (Optional Phase 3 BLE fallback) | **DEFERRED (ADR-004)** |

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
1. **`rea:inspect_adb_client`**: Confirmed client binary `adb.exe` (Evidence: `ev_c2a04dc08f29e129ff2da42125f5e0fd9576495a02d223431cc1c8c31d244e88`).
2. **`rea:list_adb_devices`**: Successfully enumerated attached Android target `emulator-5554` (Evidence: `ev_4c757347880f0441e1c71e7cf73fdd9a45173a969fdcdb6170654d8aa8753f91`).
3. **`rea:inspect_apktool_client`**: Successfully verified Apktool 3.0.3 execution live via REA MCP (Evidence: `ev_874533cff8d7bc106baec2718f8b6872725c35028c1340f6d162a475b2c69158`).
4. **`rea:binary_session`**: Successfully verified provider availability and engine bindings across 207 MCP tools.

---

## 4. Problems Safely Resolved

1. **Apktool Missing / Malformed Extension**:
   - Discovered `apktool.jar.jar` (double `.jar` extension) in `G:\Downloads\tools`.
   - Safely renamed to `apktool.jar`.
   - Disabled the trailing non-interactive cmd pause (`pause & exit /b`) in `apktool.bat` to prevent background CLI hangs.
   - Tested and verified Apktool `3.0.3` running with Microsoft JDK 21.
2. **Wireshark / TShark Installation**:
   - Verified Wireshark 4.6.9 installed at `C:\Program Files\Wireshark\tshark.exe` and `capinfos.exe`.
   - Verified successful version execution in PowerShell.
   - Configured `REA_TSHARK_COMMAND` and `REA_CAPINFOS_COMMAND` in `C:\Users\Andy\.gemini\config\mcp_config.json`.
3. **JADX GUI Found**:
   - Discovered `jadx-gui-1.5.6.exe` installed via WinGet in user package directory.

---

## 5. Next Step & Recommended PATH Configuration
- `C:\Program Files\Wireshark` is installed on disk. To ensure every background process and shell resolves `tshark` without absolute paths, recommend adding `C:\Program Files\Wireshark` to the user's `PATH`.
- With Apktool, JADX, Java 21, Python, ADB, and TShark now verified and operational, the environment is ready to proceed to Phase 1: Android Reverse Engineering (pulling and inspecting `com.spled.scenex` APK).
