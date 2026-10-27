# Portable Windows Executable Packaging Guide

This document details the configuration, build procedures, runtime behavior, and troubleshooting steps for the single-file portable Windows executable of the Universal LED Controller.

---

## 1. Executive Summary

- **Output Artifact**: `G:\Light Test\release\LightControl-Portable.exe`
- **Format**: Single portable Windows x64 executable (`.exe`).
- **Packaging Method**: `electron-builder` with `portable` target (no NSIS installer, MSI, MSIX, or setup wizard).
- **Target OS**: Windows 10 (version 1903+) / Windows 11 (x64).
- **Target Host Prerequisites**: **Zero Node.js dependency**. Requires .NET Framework 4.6.2+ (standard on Windows 10/11) for the background WinRT BLE helper.
- **Hardware Integrations**:
  - **BanlanX SP530E Controller**: Native Windows WinRT Bluetooth Low Energy (BLE) via embedded `Sp530eBleHelper.exe`.
  - **WLED / QuinLED dig2go**: Native HTTP JSON API and WebSocket state synchronization over LAN.
  - **Mock / Simulator Mode**: Offline testing and development simulator.

---

## 2. Packaging Architecture

### 2.1 Why Portable Target?
Traditional Windows installers (NSIS/Inno Setup/MSI) require administrative rights or user wizard prompts, write uninstall keys to the registry, and modify start menu shortcuts. The portable target creates a standalone executable that:
1. Extracts required runtime components (Electron binary, runtime Chromium, and `app.asar`) into a sandboxed session temp directory (`%LOCALAPPDATA%\Temp\portable-...`).
2. Cleans up temporary extraction artifacts automatically upon exit.
3. Requires **no installation** or administrative elevation.

### 2.2 Settings Persistence Outside Temp Folders
A common pitfall with portable Electron applications is losing application state and settings when the temporary extraction folder is purged. To guarantee 100% persistence across restarts and executable version upgrades:
- In `apps/desktop/src/main/main.ts`, the application explicitly forces:
  ```typescript
  if (process.platform === 'win32') {
    app.name = 'LightControl';
    const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
    app.setPath('userData', path.join(appData, 'LightControl'));
  }
  ```
- Application configuration, presets, scenes, and controller pairings are stored in:
  `%APPDATA%\LightControl\settings.json` (resolves to `C:\Users\<Username>\AppData\Roaming\LightControl\settings.json`).
- This ensures settings remain persistent even if `LightControl-Portable.exe` is moved, renamed, or replaced with a new build.

### 2.3 Native Windows BLE Helper Bundling
Windows native BLE in Node.js often requires fragile node-gyp native bindings (`noble`, `@abandonware/noble`) that frequently break across Electron major versions. Our architecture utilizes a custom, high-performance C#/.NET WinRT BLE background helper (`Sp530eBleHelper.exe`):
- Compiled target: `.NET Framework 4.6.2` (utilizing `Windows.Devices.Bluetooth` and `Windows.Devices.Bluetooth.GenericAttributeProfile`).
- Inter-Process Communication: Localhost TCP socket (`127.0.0.1:8587`) with JSON-RPC.
- Bundled into the portable application via `electron-builder.json`:
  ```json
  "extraResources": [
    {
      "from": "../../packages/adapters/src/sp530e/ble-helper/Sp530eBleHelper.exe",
      "to": "bin/Sp530eBleHelper.exe"
    }
  ]
  ```
- In `Sp530eWindowsBleTransport`, the runtime dynamically resolves the helper executable using candidate paths:
  1. `path.join(process.resourcesPath, 'bin', 'Sp530eBleHelper.exe')` (Packaged Electron production)
  2. `path.join(process.resourcesPath, 'Sp530eBleHelper.exe')`
  3. `path.resolve(__dirname, 'ble-helper/Sp530eBleHelper.exe')` (Development)

---

## 3. How to Build the Portable Executable

### Option A: Fully Automated PowerShell Build Script (Recommended)
Run the root PowerShell build script:
```powershell
powershell -ExecutionPolicy Bypass -File "G:\Light Test\scripts\build-portable.ps1"
```
This script executes all 6 pipeline stages:
1. Verifies release directories.
2. Compiles the C# WinRT BLE Helper (`Sp530eBleHelper.exe`) if not present.
3. Generates modern multi-resolution icons (`icon.ico`, `icon.png`).
4. Executes the full 75-test test suite (`npm test`).
5. Compiles production frontend (Vite/React) and Electron main process (esbuild).
6. Packages `LightControl-Portable.exe` via `electron-builder`.

### Option B: npm Script
From the project root:
```bash
npm run package:portable
```

Or from `apps/desktop`:
```bash
cd apps/desktop
npm run package:portable
```

---

## 4. Launch & Operational Verification

### 4.1 Launching the Executable
- Double-click `G:\Light Test\release\LightControl-Portable.exe` in Windows File Explorer.
- Or launch via PowerShell/Terminal:
  ```powershell
  & "G:\Light Test\release\LightControl-Portable.exe"
  ```

### 4.2 Smoke Testing
The executable supports headless smoke testing and screenshot capture for automated CI/CD verification:
```powershell
& "G:\Light Test\release\LightControl-Portable.exe" --smoke-test
```
Or to capture an instant screenshot of the loaded UI:
```powershell
& "G:\Light Test\release\LightControl-Portable.exe" --smoke-test --capture-screenshot "screenshot.png"
```

---

## 5. Security & SmartScreen Guidelines

Because this application is freshly compiled in a development environment without an enterprise EV Code Signing Certificate:
1. **Windows SmartScreen Prompt**:
   - Windows SmartScreen may present a blue prompt: *"Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting."*
   - Click **More info**, then click **Run anyway**.
2. **Local Network / Firewall Access**:
   - When discovering or communicating with WLED controllers (mDNS/UDP 5353 and HTTP port 80/WebSocket), Windows Firewall may prompt to allow network access. Allow access on Private networks.
3. **Local Loopback BLE Helper**:
   - The embedded `Sp530eBleHelper.exe` opens a loopback TCP listener on `127.0.0.1:8587`. No external network exposure occurs.

---

## 6. Troubleshooting

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| SmartScreen blocks execution | Unsigned binary in dev environment | Click "More info" -> "Run anyway". In production, sign with a DigiCert/Sectigo EV certificate. |
| BLE controller not discovered | Windows Bluetooth is disabled or controller out of range | Enable Bluetooth in Windows Settings (`ms-settings:bluetooth`). Ensure SP530E controller is powered on (12V/24V) and BanlanX mobile app is disconnected (BLE only supports 1 connection at a time). |
| Settings not saved between runs | Permissions issue on `%APPDATA%` | Check write access to `C:\Users\<User>\AppData\Roaming\LightControl`. Verify `settings.json` is not locked by another process. |
| Port 8587 conflict | Another instance of `Sp530eBleHelper.exe` is already running | In PowerShell, run `Stop-Process -Name Sp530eBleHelper -Force` and relaunch the application. |
| WLED controller not found | Controller on different subnet/VLAN | Use the manual IP entry in Dashboard or application settings (`http://<ip-address>`). Verify you can ping the WLED controller. |
