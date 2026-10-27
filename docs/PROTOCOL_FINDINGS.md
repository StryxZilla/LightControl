# Protocol Findings & Reverse Engineering Ledger

## 1. Overview
This document serves as the single source of truth for protocol specifications for the BanlanX ecosystem (Shenzhen Sperll Optoelectronic Technology) and the SP530E controller, derived through clean-room reverse engineering of the official BanlanX Android application (`com.spled.scenex` v3.3.5) and open-source interoperability research.

---

## 2. Verified Controller Identity & Architecture
- **Model**: SP530E
- **Model Hex Identifier**: **`0x4E`** (78 decimal).
- **SoC Architecture**: Espressif **ESP32-C3** (RISC-V 32-bit CPU, 2.4 GHz Wi-Fi + BLE 5.0).
- **Supported Outputs (5-in-1)**:
  - SPI Addressable (WS2811, WS2812B, WS2813, WS2815, SK6812, etc.) up to 1,200 RGB pixels.
  - 5-Channel PWM (Single Color, CCT, RGB, RGBW, RGBCCT) up to 6A/ch, 12A max combined.

---

## 3. Bluetooth Low Energy (BLE) Protocol

### 3.1 GATT Profile & Service UUIDs
Extracted from `com.spled.scenex` (`libapp.so` & `C2.a` / `D2.k` / `F2.l`):

| Identifier | UUID (128-bit) | Short UUID | Purpose |
| :--- | :--- | :--- | :--- |
| **Primary Service** | `0000ffe0-0000-1000-8000-00805f9b34fb` | `0xFFE0` | Main Sperll/BanlanX device service |
| **Alt Service (v2)** | `0000ffb0-0000-1000-8000-00805f9b34fb` | `0xFFB0` | Variant observed on select firmware |
| **Alt Service (v3)** | `0000e0ff-0000-1000-8000-00805f9b34fb` | `0xE0FF` | Variant observed on specialized units |
| **Command / Notify Char** | `0000ffe1-0000-1000-8000-00805f9b34fb` | `0xFFE1` | Bidirectional: Write (Without Response) & Notify |
| **Alt Char (v2)** | `0000ffb1-0000-1000-8000-00805f9b34fb` | `0xFFB1` | Paired with `0xFFB0` service |

### 3.2 Manufacturer Advertising Data
- **Manufacturer ID**: `20563` (`0x5053` - ASCII "SP")
- Contains model identifier byte `0x4E` (SP530E), output mode flag, and power status.

### 3.3 BLE Connection Exclusivity Rule
> [!IMPORTANT]
> The SP530E controller hardware firmware enforces a **strict single-client connection limit**. If the official BanlanX app on Android or iOS is actively connected or running in the background with an active BLE link, all connection attempts from Windows will fail or timeout. The mobile app must be closed or disconnected before testing.

---

## 4. Wi-Fi Local Network Protocol (`SPNET`)

### 4.1 Zero-Configuration mDNS Discovery (`_spled._tcp`)
*Extracted directly from BanlanX binary (`libapp.so` offset `0xb960a`):*
- **mDNS Service Type**: **`_spled._tcp`**
- **Discovery Mechanism**:
  - The SP530E announces itself via mDNS as an instance of `_spled._tcp.local.`.
  - Resolving this service returns the controller's IP address and target port (**`8587`**).
  - Matches the exact discovery pattern of WLED (`_wled._tcp`).

### 4.2 Network Transport Parameters
- **Protocol Name**: `SPNET` / `SPTech`
- **Transport**: TCP and UDP
- **Default Port**: `8587`
- **UDP Discovery**: Broadcast inquiry on port 8587.
- **TCP Command Socket**: Persistent or ad-hoc TCP connection to `<Controller-IP>:8587`.

### 4.3 SPNET Packet Framing (13-Byte Header + Payload)
Every TCP message sent to or received from the SP530E begins with a fixed 13-byte binary header:

```text
Offset (Hex)  Size (Bytes)  Field Name        Description / Representation
------------------------------------------------------------------------------------------------
0x00 - 0x05   6 bytes       Magic Prefix      ASCII "SPTECH" (Hex: 53 50 54 45 43 48)
0x06          1 byte        Null Terminator   0x00
0x07          1 byte        Message Type      0x01 = Ping, 0x02 = State Query/Reply, 0x03 = Set State
0x08          1 byte        Encryption Key    0x58 (Query request), 0x00 (Unencrypted response)
0x09          1 byte        Total Packets     0x00 (Single-packet over network)
0x0A          1 byte        Packet Number     0x00 (First packet index)
0x0B - 0x0C   2 bytes       Payload Length    uint16 Big-Endian (Payload byte count, e.g. 0x019F = 415 bytes)
[0x0D ...]    N bytes       Payload Data      Structured parameter chunks
```

### 4.4 Verified Live Telemetry Payload Breakdown (428 Bytes Observed)
Captured directly from live SP530E controller at `192.168.86.34:8587` (`protocol/fixtures/sp530e_status_response.bin`):

#### A. Chunk 0x01 (Device Hardware & Config Block - 21 Bytes)
- **Offset `data[13..33]`**:
  - Chunk ID / Subtype: `0x01 0x01`
  - Chunk Length: `0x0011` (17 bytes)
  - Firmware Version: ASCII `"V2.0.13 "` (8 bytes)
  - Light Type: `0x86` (WS2812B SPI digital addressable IC)
  - Power-On Effect: `0x03`
  - Power-On Speed: `0x03`
  - Pixel Count: `0x003C` = **60 pixels** (WS2812B 60 LEDs)
  - Segment Count: `0x0001` = **1 segment**

#### B. Chunk 0x03 (Real-Time State, Telemetry & Scenes)
- **Operating State**:
  - Power State: `data[40] == 0x01` (**ON**)
  - Active Mode: `data[43] == 0x03`
  - Global Brightness: `data[47] == 0xFF` (**255 / 100%**)
  - Active Color: `data[45..47] = FF FF FF` (**White**)
- **Segments / Zones**:
  - 5 zone mapping blocks defined (`01 01`, `01 02`, `01 03`, `01 04`, `01 05`)
- **DIY Presets / Scenes**:
  - 5 stored presets of 32 bytes each (`01 00 01 ... 2B`, `01 00 02 ... 2B`, etc.)
- **Network Telemetry**:
  - Reported IP Address: ASCII `"192.168.86.34\0"` at payload offset 376.

---

## 5. Reverse Engineering Log & Evidence

| Evidence ID | Date | Source | Details | Status |
| :--- | :--- | :--- | :--- | :--- |
| **EV-001** | 2026-10-27 | ADB Shell | Package `com.spled.scenex` verified on device. | Verified |
| **EV-002** | 2026-10-27 | Community Prior Art | BLE GATT UUIDs: Service `0xFFE0`, Char `0xFFE1`. Model code `0x4E`. Single-client BLE lock. | Verified |
| **EV-003** | 2026-10-27 | REA APK Pull | Pulled full APK set (81MB base + splits) to `research/apk/com.spled.scenex/`. | Verified (`ev_8d3a1f44...`) |
| **EV-004** | 2026-10-27 | JADX Inspection | Confirmed Flutter app with `GeneratedPluginRegistrant` loading `FlutterBlePlugin` (`C2.a`) and `BonsoirPlugin`. | Verified (`ev_810a3604...`) |
| **EV-005** | 2026-10-27 | Binary Extraction | Extracted `_spled._tcp` mDNS service string from `libapp.so` at `0xb960a`. | Verified |
| **EV-006** | 2026-10-27 | Binary Extraction | Extracted `/sp630e/` unified multi-channel UI routing map and asset tree. | Verified |
| **EV-007** | 2026-10-27 | TCP Port Sweep | Discovered live SP530E controller at `192.168.86.34:8587`. | Verified |
| **EV-008** | 2026-10-27 | Live Wire Capture | Transmitted 13-byte query (`53 50 54 45 43 48 00 02 58 00 00 00 00`), received 428-byte status response payload. Captured in `protocol/fixtures/sp530e_status_response.bin`. | Verified |
