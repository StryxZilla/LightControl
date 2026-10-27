# Known Issues & Edge Cases

This document details identified technical constraints, environmental quirks, and established mitigations across the Universal Windows LED Device Controller.

---

## 1. Electron Headless GPU Fallback Warnings

### Symptoms
When executing Electron headless smoke tests or automated window capture scripts from PowerShell, Chromium logs the following console output:
```
[ERROR:gpu_process_host.cc(981)] GPU process exited unexpectedly: exit_code=-1073741819
[ERROR:command_buffer_proxy_impl.cc(331)] GPU state invalid after WaitForGetOffsetInRange.
```

### Impact & Severity
**Low (Cosmetic)**. This is a known Chromium behavior when launching hardware-accelerated GPU pipelines in non-interactive shell sessions. Chromium automatically falls back to software rendering (SwiftShader), and the application window, DOM, and context bridge execute without issues.

### Mitigation
When running automated headless testing or CI, pass `--disable-gpu --disable-software-rasterizer` or ignore standard Chromium stderr GPU exit codes.

---

## 2. Windows Bluetooth Radio Disabled State

### Symptoms
Attempting BLE discovery or connection when Bluetooth is toggled OFF in Windows Settings causes the C# WinRT worker (`Sp530eBleHelper.exe`) to return:
```json
{"jsonrpc":"2.0","error":{"code":-32001,"message":"Radio disabled or unavailable"},"id":1}
```

### Impact & Severity
**Medium (User Environmental)**. Prevents Bluetooth Low Energy pairing.

### Mitigation
The TypeScript driver (`packages/adapters/src/sp530e/sp530e-windows-ble-transport.ts`) intercepts this error code and emits a user-friendly diagnostic message (`ERR_BLE_DISABLED: Please enable Bluetooth in Windows Settings.`). Alternatively, users with the SP530E controller can connect directly over the faster and more stable local Wi-Fi TCP port 8587.

---

## 3. Host Firewall & Local Subnet Routing (TCP Port 8587)

### Symptoms
Connecting to the SP530E via Wi-Fi times out after 4,000 ms if local firewall software blocks outbound TCP traffic on port 8587.

### Impact & Severity
**Medium (Network Configuration)**. Prevents local network socket establishment.

### Mitigation
Ensure the Windows host is on the same Wi-Fi subnet / VLAN as the SP530E controller (`192.168.86.0/24`) and that outbound TCP port 8587 is unblocked in Windows Defender Firewall.

---

## 4. QuinLED dig2go USB-C Power Budget Limit (15W Max)

### Symptoms
Powering more than 300 addressable LEDs (or running high-intensity white at 100% brightness) can exceed the 3.0A (15W) power rating of the dig2go's USB-C input, causing the onboard regulator to thermal throttle or brownout the ESP32.

### Impact & Severity
**High (Hardware Protection)**. Potential brownout under heavy load.

### Mitigation
- The Universal application strictly enforces a **20% default brightness safety cap** across all sliders, swatches, and preset triggers.
- WLED's built-in Automatic Brightness Limiter (ABL) must be configured in hardware settings to cap total current draw at 2,800 mA.
- For strip lengths exceeding 300 pixels, dedicated 5V auxiliary power injection must be wired directly to the strip.

---

## 5. TypeScript `.ts` Import Extensions with Node.js Experimental Type Stripping

### Symptoms
Standard Node 24 type stripping (`node --experimental-strip-types`) requires import paths to end with explicit `.ts` extensions (e.g. `import { foo } from './foo.ts'`), but standard TypeScript emit flags throw `error TS5097` if `allowImportingTsExtensions` is omitted.

### Impact & Severity
**Low (Resolved)**.

### Mitigation
All `tsconfig*.json` configurations across the workspace (`tsconfig.json`, `apps/desktop/tsconfig.json`, `apps/desktop/tsconfig.electron.json`) have been configured with:
```json
"compilerOptions": {
  "allowImportingTsExtensions": true,
  "noEmit": true
}
```
Bundling for production is handled by `esbuild` and `vite`, which naturally strip `.ts` extensions and resolve modules in milliseconds.
