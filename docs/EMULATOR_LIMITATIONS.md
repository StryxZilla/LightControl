# Android Emulator Limitations & Testing Strategy

## 1. Overview
During dynamic analysis of the official BanlanX application (`com.spled.scenex` v3.3.5) inside the Android Studio emulator (`emulator-5554`, Android 16 API 36, `sdk_gphone64_x86_64`), key hardware virtualization constraints were observed and cataloged. This document defines these boundaries, explains why certain features cannot run inside standard QEMU virtual machines, and details how the Windows native application architecture bypasses them.

---

## 2. Virtualization Boundaries Encountered

### 2.1 Bluetooth Low Energy (BLE) Radio Virtualization
* **Observed Symptom**:
  * Tapping "Add device" or "SP530E" in the catalog initiates BLE scan mode (`Searching SP530E…`), but fails with `"SP530E device not found"` after the scan timeout.
* **Root Cause**:
  * Android Studio QEMU emulators virtualize an emulated Bluetooth HCI device that does not bind to the physical Windows host Bluetooth adapter (`Intel Wireless Bluetooth`).
  * While the Android OS reports `PackageManager.FEATURE_BLUETOOTH_LE = true` and `BluetoothAdapter.isEnabled() = true`, `BluetoothLeScanner.startScan()` never receives peripheral advertisement packets emitted by physical BLE hardware.
* **Rule Compliance**:
  * Per `AGENTS.md` and user instructions, zero cycles were wasted on repeated retries or unsupported emulator modifications.

---

### 2.2 Network Virtualization & Multicast (mDNS)
* **Observed Symptom**:
  * Zero-configuration Wi-Fi device discovery via mDNS (`_spled._tcp.local`) does not locate the controller on `192.168.86.34`.
* **Root Cause**:
  * The emulator resides behind a virtual QEMU User Networking (SLIRP) NAT router:
    * Emulator IP: `10.0.2.16/24`
    * Gateway / Host: `10.0.2.2`
    * DNS: `10.0.2.3`
  * mDNS relies on Link-Local Multicast (`224.0.0.251:5353`). Link-local multicast frames have a Time-to-Live (TTL) of 1 and do not traverse the NAT routing boundary between the emulator's `10.0.2.0/24` virtual network and the host LAN (`192.168.86.0/24`).
* **Contrast with Host**:
  * On the Windows host, the physical network adapter (`192.168.86.27`) shares the exact L2 broadcast domain as the SP530E (`192.168.86.34`). Direct TCP connections to port 8587 succeed instantly.

---

### 2.3 Audio & Microphone Virtualization
* **Observed Symptom**:
  * Features utilizing `mobile_mic` (phone microphone music visualizers) and `AudioRecordForegroundService` rely on the virtual QEMU microphone, which produces silence unless virtual audio input is explicitly configured on the host.
* **Impact**:
  * Does not affect controller testing because the SP530E features its own onboard physical microphone (`inner_mic`).

---

## 3. Comparison: Emulator vs Windows Desktop Application

| Capability | Android Studio Emulator (`emulator-5554`) | Windows Desktop Application (`universal-led-controller`) |
| :--- | :--- | :--- |
| **BLE Radio Access** | Emulated QEMU dummy HCI; cannot receive physical BLE packets | Direct access via `Windows.Devices.Bluetooth` or Node WinRT BLE bridge |
| **Wi-Fi Subnet Access** | Isolated behind `10.0.2.x` NAT | Native L2/L3 host network interface on `192.168.86.x` |
| **mDNS Discovery** | Blocked by virtual NAT router | Fully supported via native Node `bonjour-service` or SSDP/multicast-dns |
| **TCP Port 8587 (`SPNET`)** | Accessible only via gateway translation | Native direct TCP stream; verified in unit & live hardware tests |
| **Audio Capture** | Emulated virtual mic | Windows WASAPI loopback capture (syncs lights to PC audio output!) |
| **Development Velocity** | Requires slow ADB taps, screencaps, and UI dumps | Instant sub-100ms TypeScript compilation and native unit testing |

---

## 4. Engineering Verification Strategy

1. **Clean-Room UI Reference**:
   * Use captured screenshots (`research/screenshots/01_*.png` through `28_*.png`) and XML hierarchies as the visual and interaction specification for React components in `packages/ui/`.
2. **Mock Adapter Development**:
   * Implement UI components against `@led-controller/adapters/MockAdapter` to verify all sliders, color wheels, palettes, and mode toggles without requiring physical devices.
3. **Native Windows Hardware Transport**:
   * Test live SP530E control directly over host TCP port 8587 (`SP530EWiFiAdapter`), where communication has already been proven with real telemetry frames (`protocol/fixtures/sp530e_status_response.bin`).
