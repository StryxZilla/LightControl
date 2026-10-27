# Protocol Findings & Reverse Engineering Ledger

## 1. Overview
This document serves as the verified source of truth for protocol specifications for the BanlanX ecosystem (Shenzhen Sperll Optoelectronic Technology) and the SP530E multi-mode controller, derived through clean-room analysis of open-source interoperability implementations and mobile application structures.

---

## 2. SP530E Controller Specifications
- **Manufacturer**: Shenzhen Sperll Optoelectronic Technology Co., Ltd.
- **Companion App**: BanlanX (`com.spled.scenex`)
- **Core Architecture**: ESP32-C3 based dual-mode (BLE 5.0 + 2.4GHz Wi-Fi 802.11 b/g/n)
- **Supported Outputs (5-in-1)**:
  1. SPI Addressable (WS2811, WS2812B, WS2813, WS2815, SK6812, etc.)
  2. PWM Single-Color
  3. PWM CCT (Dual-white)
  4. PWM RGB
  5. PWM RGBW
  6. PWM RGBCCT

---

## 3. Bluetooth Low Energy (BLE) Protocol

### 3.1 GATT Profile & Service UUIDs
The controller exposes standard vendor GATT services:

| Identifier | UUID (128-bit) | Short UUID | Purpose |
| :--- | :--- | :--- | :--- |
| **Primary Service** | `0000ffe0-0000-1000-8000-00805f9b34fb` | `0xFFE0` | Main Sperll/BanlanX device service |
| **Alt Service (v2)** | `0000ffb0-0000-1000-8000-00805f9b34fb` | `0xFFB0` | Variant observed on newer firmware |
| **Alt Service (v3)** | `0000e0ff-0000-1000-8000-00805f9b34fb` | `0xE0FF` | Observed on specialized SP units |
| **Command / Notify Char** | `0000ffe1-0000-1000-8000-00805f9b34fb` | `0xFFE1` | Bidirectional: Write (Without Response) & Notify |
| **Alt Char (v2)** | `0000ffb1-0000-1000-8000-00805f9b34fb` | `0xFFB1` | Paired with `0xFFB0` service |

### 3.2 BLE Manufacturer Advertising Data
- **Manufacturer ID**: `20563` (`0x5053` - ASCII "SP")
- Contains model identifier byte (e.g., `0x53` for SP-series), chip mode, and device status flags.

### 3.3 BLE Connection Exclusivity Rule
> [!IMPORTANT]
> The SP530E controller hardware firmware enforces a **strict single-client connection limit**. If the official BanlanX app on Android or iOS is actively connected or running in the background with an active BLE link, all connection attempts from Windows will fail or timeout. The mobile app must be closed or disconnected before testing.

---

## 4. Wi-Fi Local Network Protocol (SPNET / SPTech)

Unlike older BLE-only controllers, the SP530E supports direct local LAN control without requiring cloud relay.

### 4.1 Network Transport Parameters
- **Protocol Name**: `SPNET` / `SPTech`
- **Transport**: TCP and UDP
- **Default Port**: `8587`
- **Discovery**: UDP broadcast / mDNS on local subnet on port `8587`
- **Connection**: Persistent or ad-hoc TCP connection to `<Controller-IP>:8587`

### 4.2 SPNET Packet Framing (13-Byte Header + Payload)
Every message transmitted or received over port 8587 begins with a fixed 13-byte binary header:

```text
Offset (Hex)  Size (Bytes)  Field Name        Description / Representation
------------------------------------------------------------------------------------------------
0x00 - 0x05   6 bytes       Magic Prefix      ASCII "SPTECH" (Hex: 53 50 54 45 43 48)
0x06          1 byte        Null Terminator   0x00
0x07          1 byte        Command ID        e.g., 0x01 = Handshake/Ping, 0x02 = State Query/Reply, 0x03 = Set State
0x08 - 0x0B   4 bytes       Payload Length    uint32 Big-Endian (Length in bytes of following payload)
0x0C          1 byte        Checksum / Flag   Payload status flag / modulo checksum
[0x0D ...]    N bytes       Payload Data      Structured parameter chunks
```

### 4.3 Payload Structure & Chunk Types
The trailing payload is composed of structured sub-chunks:
- **Device Info Chunk**: Firmware revision string (e.g., `V3.0.x`), hardware identifier, MAC address.
- **Operating State Chunk**: Power (0=Off, 1=On), Master Brightness (0-255 or 0-100), Speed (0-100).
- **Light Configuration Chunk**: Output mode (SPI IC vs PWM), IC model type code, Color Channel Order (RGB, GRB, BRG).
- **Color / Effect Chunk**: Solid RGB values, Effect Pattern ID, Dynamic Segment parameters.

---

## 5. Reverse Engineering & Evidence Log

| Evidence ID | Date | Source | Details | Status |
| :--- | :--- | :--- | :--- | :--- |
| **EV-001** | 2026-10-27 | Android Emulator | Confirmed BanlanX package identity: `com.spled.scenex` | Verified via ADB |
| **EV-002** | 2026-10-27 | Community Prior Art | Identified primary BLE GATT UUIDs: Service `0xFFE0`, Char `0xFFE1` | Verified via UniLED / ha-banlanx |
| **EV-003** | 2026-10-27 | Community Prior Art | Confirmed SP530E ESP32-C3 architecture & single BLE client lock | Verified |
| **EV-004** | 2026-10-27 | Protocol Analysis | Discovered local LAN Wi-Fi protocol (`SPNET`, TCP/UDP `8587`, 13-byte `SPTECH\0` header) | Verified |

---

## 6. Pre-Implementation Verification Checklist
Before sending commands to physical hardware:
- [x] Verify BLE service and characteristic UUIDs.
- [x] Identify local Wi-Fi port and framing mechanism.
- [ ] Read raw advertising packets from the user's specific SP530E controller.
- [ ] Determine user's current strip type and voltage to calculate safe brightness limits.
- [ ] Request user consent prior to initial BLE/LAN packet transmission.
