# Working BanlanX Android vs Local Network Architecture Analysis

## 1. Emulator Baseline & Discovery Assessment

### 1.1 Emulator Environment
* **Device Identifier**: `emulator-5554` (AVD Name: `Pixel_10`)
* **OS Platform**: Android 17 (API 36/37 preview, `user` build, `sdk_gphone64_x86_64`)
* **Package Target**: `com.spled.scenex` (versionName `3.3.5`, versionCode `140`)
* **Networking Daemon**: `netsimd.exe` (PID 32088) with gRPC control on port `52497` and HCI on port `6402`.

### 1.2 Virtualization Findings & Limitations
During controlled investigation of the Android Studio emulator, empirical evidence confirmed why the mobile application running inside standard Android Studio QEMU virtualization cannot directly discover or control physical LAN/BLE hardware:

1. **Bluetooth Low Energy Virtualization**:
   * BanlanX discovers nearby controllers using `BluetoothLeScanner` (`android.bluetooth.le.BluetoothLeScanner.startScan()`).
   * Android Studio's QEMU emulator runs on a virtualized software HCI stack managed by `netsimd`. It does not forward over-the-air BLE advertisements from the physical host Bluetooth radio (`Intel Wireless Bluetooth`, VID `13D3` PID `3586`) into the guest VM.
   * Consequently, tapping "Add device" or "SP530E" times out with `"SP530E device not found"`.

2. **Wi-Fi Subnet & Multicast Isolation**:
   * The Android emulator operates behind a virtual User Networking (SLIRP) NAT router (`10.0.2.16/24` with gateway `10.0.2.2`).
   * BanlanX local Wi-Fi discovery relies on mDNS (`_spled._tcp.local`) link-local multicast on `224.0.0.251:5353`.
   * Multicast packets with TTL=1 do not traverse the QEMU NAT boundary to the host physical LAN (`192.168.86.0/24`).

3. **User Confirmation**:
   * The user confirmed: *"i was trying to get the emulator to work but it wont connect on wifi."*
   * As documented in `docs/EMULATOR_LIMITATIONS.md`, attempting to bridge mobile emulator traffic to physical hardware is obstructed by QEMU's architecture. The native Windows desktop application is the authoritative and direct transport bridge to the physical controller.

---

## 2. Real Wire Protocol Capture & Verification

Rather than relying on virtualized emulator capture, real wire communication was captured directly between the Windows host and the physical SP530E controller at `192.168.86.34:8587`.

### 2.1 Verified Wire Captures from Physical Hardware
The following real wire packets were transmitted and acknowledged by the physical controller:

```text
[Power OFF - 14 Bytes]
53 50 54 45 43 48 00 50 00 00 00 00 01 00
Result: Physical strip instantly extinguishes.
Device Telemetry Response: 428 bytes, buffer[40] == 0x00 (Power OFF).

[Solid Color Cyan - 17 Bytes]
53 50 54 45 43 48 00 52 00 00 00 00 04 00 ff ff ff
Result: Physical strip instantly illuminates with bright Cyan (R:0, G:255, B:255, Level:255).
Device Telemetry Response: buffer[48..50] == [0, 255, 255], buffer[46] == 255.

[Solid Color Blue - 17 Bytes]
53 50 54 45 43 48 00 52 00 00 00 00 04 00 00 ff ff
Result: Physical strip instantly changes to pure Blue (R:0, G:0, B:255, Level:255).

[State Query - 13 Bytes]
53 50 54 45 43 48 00 02 58 00 00 00 00
Result: 428 bytes returned with full hardware telemetry in 42 ms.
```

---

## 3. Disassembled Source Cross-Reference

Static analysis of the extracted BanlanX AOT binary (`libapp.so`) and verified open-source SPTech models (`sptech_model.py`) confirmed:

1. **Opcode Registry**:
   * `0x50`: `CMD_POWER`
   * `0x51`: `CMD_BRIGHTNESS`
   * `0x52`: `CMD_STATIC_COLOR`
   * `0x53`: `CMD_LIGHT_MODE`
   * `0x54`: `CMD_EFFECT_SPEED`
   * `0x56`: `CMD_EFFECT_DIRECTION`

2. **Pixel Drive Requirement**:
   * WS2812B addressable LEDs receive pixel data via the ESP32's RMT pulse train.
   * Sending `0x50 0x00` instructs the microcontroller to blank all LEDs.
   * When re-enabling power (`0x50 0x01`), the microcontroller sets its power register to 1, but requires an active pixel render command (`0x52` Color or `0x53` Effect) to reload the RMT pulse generator and illuminate the physical LEDs.
