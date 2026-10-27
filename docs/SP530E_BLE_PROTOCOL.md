# SP530E Bluetooth Low Energy (BLE) Protocol Specification

## 1. Executive Summary
This document defines the complete Bluetooth Low Energy (BLE) protocol specification for the **SP530E 5-in-1 IoT LED Controller** (Model code `0x4E` / 78 decimal, Manufacturer ID `20563` / `0x5053`). 

Findings are derived clean-room from:
1. Static analysis of `com.spled.scenex` v3.3.5 (decompiled Java source in `research/decompiled/jadx/` and Dart AOT binary in `research/decompiled/libapp.so`).
2. Multi-source open-source protocol drivers (`monty68/uniled` and `xydac/sp542e-ha-bridge`).
3. Empirical wire telemetry from the user's physical SP530E controller (`protocol/fixtures/sp530e_status_response.bin`).
4. Automated unit tests in `tests/sp530e-ble-codec.test.ts`.

---

## 2. Bluetooth LE Hardware & GATT Profile

### 2.1 Advertisement & Discovery
* **Manufacturer Identifier (Company ID)**: `0x5053` (`20563` decimal - ASCII `"SP"`).
* **Model Identifier**: **`0x4E`** (78 decimal), uniquely identifying the SP530E 5-in-1 controller.
* **Local Name**: Typically broadcast as `SP530E` or `SP530E-xxxx` (suffix matching the last 4 characters of the MAC address).
* **Advertising Mode**: Legacy Bluetooth 4.2 / 5.0 LE Advertisements emitted by the onboard Espressif ESP32-C3 SoC.

### 2.2 GATT Architecture
The SP530E exposes a single vendor-specific primary GATT service and characteristic:

| GATT Attribute | UUID | Value / Properties | Purpose |
| :--- | :--- | :--- | :--- |
| **Primary Service** | `0000ffe0-0000-1000-8000-00805f9b34fb` | 16-bit short: **`0xFFE0`** | Primary Sperll LED Service |
| **Unified Characteristic** | `0000ffe1-0000-1000-8000-00805f9b34fb` | 16-bit short: **`0xFFE1`** | Bidirectional Data Channel |
| **Properties** | `WRITE_WITHOUT_RESPONSE`, `WRITE`, `NOTIFY` | - | Accepts write commands from client; emits asynchronous state notifications |
| **CCCD** | `00002902-0000-1000-8000-00805f9b34fb` | `0x0001` (Notify enable) | Required to subscribe to state updates |

### 2.3 Strict Single-Client Connection Policy
> [!IMPORTANT]
> The ESP32-C3 firmware enforces a **strict single-client connection lock**. If an Android or iOS device running BanlanX has an active BLE connection to the controller, the controller immediately rejects any incoming connection requests from Windows. The mobile device must disconnect or disable Bluetooth before Windows establishes a GATT session.

---

## 3. BLE Framing & Packet Architecture

Unlike the 13-byte header used over local Wi-Fi (`SPTECH\0` on TCP port 8587), the Bluetooth Low Energy transport utilizes a compact **6-byte header** to fit cleanly within the default 23-byte BLE MTU (Maximum Transmission Unit) without fragmentation.

### 3.1 Header Layout
```text
Byte Offset   Size      Field Name        Value / Description
-----------------------------------------------------------------------------------------------------
0x00 - 0x01   2 bytes   Magic Prefix      ASCII "SP" (Hex: 0x53, 0x50)
0x02          1 byte    Sequence / Key    Packet sequence counter or session key (typically 0x00)
0x03          1 byte    Command Opcode    Operation category (e.g. 0x01 = Power, 0x04 = RGB Color)
0x04 - 0x05   2 bytes   Payload Length    uint16 Big-Endian (Payload byte count: N)
[0x06 ... N]  N bytes   Payload Data      Parameter values (clamped to command specification)
```

Total packet size = `6 + N` bytes.

---

## 4. BLE Command Specifications

### 4.1 Master Power Control (`Opcode 0x01`)
* **Payload Length**: 1 byte (`0x00 0x01`)
* **Parameter**: `0x00` = Power OFF, `0x01` = Power ON
* **Wire Frame**:
  * Power ON: `53 50 00 01 00 01 01`
  * Power OFF: `53 50 00 01 00 01 00`
* **Equivalent SPNET Frame**: `53 50 54 45 43 48 00 03 58 00 00 00 03 03 01 [00/01]`

### 4.2 Color Brightness (`Opcode 0x02`)
* **Payload Length**: 1 byte (`0x00 0x01`)
* **Parameter**: Brightness integer `0x00` to `0xFF` (0 to 100%)
* **Wire Frame**: `53 50 00 02 00 01 [Brightness]`
  * Example (20% Safety Limit = 51 decimal): `53 50 00 02 00 01 33`
* **Equivalent SPNET Frame**: `53 50 54 45 43 48 00 03 58 00 00 00 03 03 02 [Brightness]`

### 4.3 White Channel Brightness (`Opcode 0x03`)
* **Payload Length**: 1 byte (`0x00 0x01`)
* **Parameter**: White channel brightness `0x00` to `0xFF`
* **Applicability**: Active when configured in RGBW, RGBCCT, or PWM-CW mode.
* **Wire Frame**: `53 50 00 03 00 01 [WhiteBrightness]`

### 4.4 Solid RGB Color (`Opcode 0x04`)
* **Payload Length**: 3 bytes (`0x00 0x03`)
* **Parameters**: `[Red: 0..255] [Green: 0..255] [Blue: 0..255]`
* **Wire Frame**: `53 50 00 04 00 03 [RR] [GG] [BB]`
  * Red (#FF0000): `53 50 00 04 00 03 ff 00 00`
  * Green (#00FF00): `53 50 00 04 00 03 00 ff 00`
  * Blue (#0000FF): `53 50 00 04 00 03 00 00 ff`
* **Equivalent SPNET Frame**: `53 50 54 45 43 48 00 03 58 00 00 00 05 03 04 [RR] [GG] [BB]`

### 4.5 Color Temperature CCT (`Opcode 0x05`)
* **Payload Length**: 2 bytes (`0x00 0x02`)
* **Parameters**: `[Warm White: 0..255] [Cool White: 0..255]`
* **Wire Frame**: `53 50 00 05 00 02 [Warm] [Cool]`

### 4.6 Dynamic Effect Mode (`Opcode 0x06`)
* **Payload Length**: 1 byte (`0x00 0x01`)
* **Parameter**: Mode ID `0x01` to `0x8E` (1 to 142 built-in effects)
* **Wire Frame**: `53 50 00 06 00 01 [ModeId]`
  * Example (Rainbow Mode 1): `53 50 00 06 00 01 01`

### 4.7 Effect Speed (`Opcode 0x07`)
* **Payload Length**: 1 byte (`0x00 0x01`)
* **Parameter**: Speed integer `0x00` to `0xFF` (0 to 100)
* **Wire Frame**: `53 50 00 07 00 01 [Speed]`
  * Example (50% Speed = 128): `53 50 00 07 00 01 80`

### 4.8 Effect Direction (`Opcode 0x08`)
* **Payload Length**: 1 byte (`0x00 0x01`)
* **Parameter**: `0x00` = Forward / Left, `0x01` = Reverse / Right
* **Wire Frame**: `53 50 00 08 00 01 [00/01]`

### 4.9 State Query (`Opcode 0x00`)
* **Payload Length**: 0 bytes (`0x00 0x00`)
* **Wire Frame**: `53 50 00 00 00 00`
* **Response**: Controller emits state notifications over characteristic `0xFFE1`.

---

## 5. Comparison: BLE vs. Local Wi-Fi (SPNET)

| Architectural Parameter | Bluetooth Low Energy (BLE) | Local Wi-Fi (`SPNET`) |
| :--- | :--- | :--- |
| **Physical Transport** | 2.4 GHz Bluetooth LE (GATT) | 2.4 GHz Wi-Fi (802.11b/g/n, TCP) |
| **GATT / Network Port** | Service `0xFFE0`, Char `0xFFE1` | TCP Port `8587` |
| **Header Size** | **6 bytes** (`SP` + Seq + Cmd + Len16) | **13 bytes** (`SPTECH\0` + Cmd + Key + Counts + Len16) |
| **MTU Constraint** | 23 bytes default (optimized for single packet) | Up to 1460 bytes TCP MSS (multi-chunk frames) |
| **Connection Scope** | Point-to-point (Strict single-client lock) | Concurrent local LAN sessions (PC + App possible) |
| **Discovery Protocol** | BLE Advertisement (Company ID `0x5053`) | mDNS Zero-Config (`_spled._tcp.local`) |
| **Telemetry Format** | Asynchronous GATT Notifications | Full structured 428-byte status frame (Chunks 0x01, 0x03) |
