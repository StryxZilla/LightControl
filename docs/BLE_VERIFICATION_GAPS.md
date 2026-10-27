# SP530E BLE Protocol: Verification Gaps & Hardware Validation Ledger

## 1. Executive Summary
This document provides a rigorous, transparent ledger distinguishing **empirically confirmed protocol findings** from **candidate behaviors requiring live hardware verification**. In accordance with `AGENTS.md` and the Zero Fabrication Policy, assumptions are never treated as proven facts.

---

## 2. Status Ledger: Confirmed vs. Gaps

| Protocol Domain | Verification Status | Confidence Level | Evidence Basis | Remaining Gap / Action |
| :--- | :--- | :--- | :--- | :--- |
| **GATT Service UUID** (`0xFFE0`) | **Confirmed** | `VERIFIED_MULTI_SOURCE` | `libapp.so` @ `0xf6130`, `E2.d.java`, UniLED `ble_banlanx` | None. 100% verified. |
| **GATT Char UUID** (`0xFFE1`) | **Confirmed** | `VERIFIED_MULTI_SOURCE` | `libapp.so` @ `0x17f1c7`, `E2.d.java`, UniLED `ble_banlanx` | None. 100% verified. |
| **Model Code (`0x4E` / 78)** | **Confirmed** | `VERIFIED_HARDWARE` | Captured live in `sp530e_status_response.bin` Byte 13 | None. Matches physical SP530E hardware. |
| **Company ID (`0x5053` / 20563)** | **Confirmed** | `VERIFIED_MULTI_SOURCE` | BLE advertising manufacturer data, static decompilation | None. Matches ASCII `"SP"`. |
| **6-Byte Header Framing** | **Confirmed** | `VERIFIED_MULTI_SOURCE` | `xydac/sp542e-ha-bridge`, `monty68/uniled`, unit tests | None. Tested and passing in `sp530e-ble-codec.test.ts`. |
| **Power ON/OFF Encoders** | **Confirmed** | `VERIFIED_MULTI_SOURCE` | `setOnOffLfx` decompilation, cross-verified by 2 bridges | Direct Windows BLE write pending approval. |
| **Brightness Encoder (0..255)** | **Confirmed** | `VERIFIED_MULTI_SOURCE` | `setBrightness` decompilation, verified in `sp530e-ble-codec.test.ts` | Direct Windows BLE write pending approval. |
| **RGB Color Encoder** | **Confirmed** | `VERIFIED_MULTI_SOURCE` | `setLfxColor` decompilation, cross-verified by 2 bridges | Direct Windows BLE write pending approval. |
| **Dynamic Effect Mode Selector** | **Confirmed** | `VERIFIED_MULTI_SOURCE` | `setLfxMode` decompilation, 142 mode IDs cataloged | Direct Windows BLE write pending approval. |
| **Local Wi-Fi Telemetry (SPNET)** | **Confirmed** | `VERIFIED_HARDWARE` | 428-byte wire response from `192.168.86.34:8587` | None. Fully decoded in `tests/spnet-codec.test.ts`. |
| **Live Windows BLE Write** | **Pending** | `CANDIDATE` | Windows Bluetooth LE Enumerator active | Requires explicit user approval gate (Rule 3). |
| **BLE MTU Exchange & Fragmentation** | **Pending** | `CANDIDATE` | Standard BLE MTU is 23; ESP32-C3 supports MTU 512 | Test MTU negotiation behavior over live Windows BLE. |
| **Music Sensitivity Gain Register** | **Pending** | `CANDIDATE` | `setMusicSensitivity` symbol observed in `libapp.so` | Verify register offset in live hardware. |
| **Multi-Segment Buffer over BLE** | **Pending** | `CANDIDATE` | Segment table defined in SPNET Chunk 0x01 | Confirm whether BLE transmits full segment chunks. |

---

## 3. Physical Hardware Validation Options

### Option A: Direct Windows BLE Test (Recommended)
Because the host computer possesses an active Windows Bluetooth adapter (`Intel Wireless Bluetooth`, `Microsoft Bluetooth LE Enumerator`) and the SP530E is sitting on the desk:
1. **User Approval Gate**: User grants consent to transmit non-destructive BLE packets (Power toggle, 20% brightness, Red/Green/Blue color).
2. **Execution**: Antigravity executes a Node/WinRT BLE client using `Sp530eBleCodec` to connect to `0xFFE0` / `0xFFE1`.
3. **Safety Boundaries**: Master brightness capped at 20% (`0x33`), 1-second delay between commands.

### Option B: Physical Android Phone HCI Snoop Capture (Fallback)
If physical bit-for-bit capture from the official BanlanX app running on the user's Android phone is desired, here are the **exact minimum steps**:

```text
Step 1: On your Android phone, open Settings -> Developer options.
Step 2: Toggle "Enable Bluetooth HCI snoop log" to ON.
Step 3: Toggle Bluetooth OFF and then ON again to start logging.
Step 4: Open the BanlanX app, tap your SP530E, and perform 3 quick actions:
        - Toggle Power OFF and then ON
        - Move Brightness slider slightly
        - Select Red, then Green, then Blue
Step 5: Exit BanlanX and toggle Bluetooth OFF.
Step 6: Connect phone to PC via USB and notify Antigravity.
        Antigravity will run: adb pull /sdcard/btsnoop_hci.log
```
*Antigravity will automatically inspect the capture in Wireshark/TShark, sanitize all personal MAC addresses, and catalog the exact hex bytes.*
