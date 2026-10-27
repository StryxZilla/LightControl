# SP530E Local Wi-Fi (`SPNET`) Protocol Specification

## 1. Executive Summary
This document provides the definitive technical specification for direct local network control of the **BanlanX SP530E 5-in-1 IoT LED Controller** over Wi-Fi. 

Findings are derived clean-room from:
1. Decompiled Java networking components in `com.spled.scenex` (Bonsoir mDNS resolver `P2.b` / `P2.f`, MulticastLock `H2.a`).
2. Dart AOT binary symbols in `libapp.so` (`_spled._tcp`, `setLfxColor`, `setOnOffLfx`).
3. Empirical live wire captures and decodes from physical hardware at `192.168.86.34:8587` (`protocol/fixtures/sp530e_status_response.bin`).
4. Automated unit tests passing in `tests/spnet-codec.test.ts` and `tests/sp530e-wifi-adapter.test.ts`.

---

## 2. Network Architecture: Local LAN vs. Cloud

```mermaid
flowchart LR
    subgraph LocalLAN [Secure Local Network - 192.168.86.0/24]
        WinApp[Windows Universal LED Controller]
        MobileApp[BanlanX Android App]
        SP530E[SP530E Controller - ESP32-C3]
        
        WinApp -- "Direct TCP Socket :8587 (SPNET)" --> SP530E
        MobileApp -- "Local TCP Socket :8587" --> SP530E
        SP530E -- "mDNS Announce (_spled._tcp)" --> LocalLAN
    end

    subgraph CloudInfrastructure [Vendor Cloud - app.ledhue.com]
        CloudServer[BanlanX Cloud API]
        VoiceBridge[Amazon Alexa / Google Assistant]
        
        CloudServer --- VoiceBridge
    end

    SP530E -.->|Optional Out-of-Home Relay| CloudServer
```

### 2.1 Complete Local Independence
* **No Authentication Required**: The local TCP socket on port `8587` accepts direct binary connections without token exchange, passwords, or certificate validation.
* **Zero Cloud Dependency**: Once provisioned to a 2.4 GHz 802.11b/g/n Wi-Fi access point, the controller functions completely offline on the local area network.
* **Dual-Stack Concurrent Access**: Unlike Bluetooth Low Energy (which enforces a strict single-client connection lock), the ESP32-C3 Wi-Fi TCP stack accepts multiple concurrent local connections, allowing the Windows desktop application and mobile app to observe status updates simultaneously.

---

## 3. Wi-Fi Provisioning & Discovery Mechanisms

### 3.1 Device Provisioning (Initial Onboarding)
When unconfigured from the factory or after a reset, the SP530E has no Wi-Fi credentials:
1. **Bluetooth Provisioning (Primary)**: The mobile app connects over BLE GATT service `0xFFE0` / `0xFFE1` and sends the local 2.4 GHz SSID and WPA2 passphrase.
2. **SoftAP Fallback**: If BLE is unavailable, the controller broadcasts an unencrypted access point named `SP530E-xxxx` with a captive configuration server.
3. **NVRAM Persistence**: The ESP32-C3 stores SSID and passphrase in non-volatile flash and automatically reconnects upon power-up.

### 3.2 Local Network Discovery Methods

#### Method 1: Zero-Configuration mDNS (`_spled._tcp`)
* **Service Name**: `_spled._tcp.local.`
* **Multicast Address**: `224.0.0.251:5353` (UDP)
* **Native Android Plugin**: `fr.skyost.bonsoir.BonsoirPlugin` (`P2.b` / `P2.f`) requiring `WifiManager.MulticastLock("bonsoirMulticastLock")`.
* **Resolution**: Returns controller hostname, local IP (`192.168.86.34`), and TCP control port (**`8587`**).

#### Method 2: Subnet TCP Sweep (Fast Fallback)
* Because ESP32-C3 mDNS multicast packets can occasionally be dropped by consumer Wi-Fi router IGMP snooping, the Windows application supports a high-speed multithreaded TCP port sweep across the `/24` subnet on port `8587`.
* Sweeping `192.168.86.0/24` locates the active SP530E in under 200 ms.

---

## 4. `SPNET` Binary Framing Specification

Communication over TCP port 8587 utilizes a fixed **13-byte binary header** followed by structured parameter chunks.

### 4.1 Fixed 13-Byte Header Layout

```text
Offset (Hex)  Size (Bytes)  Field Name        Value / Representation
-------------------------------------------------------------------------------------------------
0x00 - 0x05   6 bytes       Magic Prefix      ASCII "SPTECH" (Hex: 53 50 54 45 43 48)
0x06          1 byte        Null Terminator   0x00
0x07          1 byte        Message Type      0x01 = Heartbeat, 0x02 = Query/Reply, 0x03 = Set State
0x08          1 byte        Encryption / Key  0x58 (Query request), 0x00 (Clear response/command)
0x09          1 byte        Total Packets     0x00 (Single-packet frame)
0x0A          1 byte        Packet Number     0x00 (First packet index)
0x0B - 0x0C   2 bytes       Payload Length    uint16 Big-Endian (Payload byte count: N)
[0x0D ... N]  N bytes       Payload Data      Structured parameter chunks
```

### 4.2 Standard Read-Only State Query Frame
* **Hex String**: `53 50 54 45 43 48 00 02 58 00 00 00 00` (13 bytes)
* **Dissection**:
  - `53 50 54 45 43 48 00`: ASCII `"SPTECH\0"`
  - `02`: Message Type (State Query)
  - `58`: Controller session key
  - `00 00`: Single packet (packet 0 of 0)
  - `00 00`: Zero payload length

---

## 5. Structured Telemetry Response (428-Byte Payload)

When queried, the SP530E returns a 428-byte frame (`protocol/fixtures/sp530e_status_response.bin`) composed of structured sub-chunks:

### 5.1 Chunk `0x01`: Hardware Configuration Chunk
* **Chunk Header**: Type `0x01`, Subtype `0x01`, Length `0x0011` (17 bytes)
* **Decoded Fields**:
  * **Firmware Version**: Bytes 6..13 = ASCII `"V2.0.13 "`
  * **Light Type**: Byte 14 = **`0x86`** (WS2812B Digital Addressable IC)
  * **Power On/Off Effect**: Byte 15 = `0x03`
  * **Transition Speed**: Byte 16 = `0x03`
  * **Pixel Count**: Bytes 17..18 = `0x00 0x3C` (**60 Pixels**)
  * **Segment Count**: Bytes 19..20 = `0x00 0x01` (**1 Segment**)

### 5.2 Chunk `0x03`: Real-Time Runtime State Chunk
* **Chunk Header**: Type `0x03`, Subtype `0x01`
* **Decoded Fields**:
  * **Power State**: Byte 40 = `0x01` (**Power ON**)
  * **Mode ID**: Byte 43 = `0x03` (**Dynamic Effect Mode #3**)
  * **Color RGB**: Bytes 45..47 = `(1, 255, 255)` (Cyan tint)
  * **Brightness**: Byte 47 = `0x64` (100 / 255 = **39%**)

### 5.3 Chunk `0x06`: Network Telemetry Chunk
* **Embedded Device IP**: Contains ASCII IPv4 string matching `"192.168.86.34"`.
* **Signal Strength**: Wi-Fi RSSI reporting.

---

## 6. Outgoing Control Commands over Wi-Fi

All control commands sent over TCP port 8587 wrap the command bytes in the 13-byte `SPTECH\0` header with Message Type `0x03`:

| Action | Hex Byte Sequence | Payload Length | Dissection |
| :--- | :--- | :--- | :--- |
| **Power ON** | `53 50 54 45 43 48 00 03 58 00 00 00 03 03 01 01` | 3 bytes | Header + `[03 01 01]` |
| **Power OFF** | `53 50 54 45 43 48 00 03 58 00 00 00 03 03 01 00` | 3 bytes | Header + `[03 01 00]` |
| **Set Brightness** | `53 50 54 45 43 48 00 03 58 00 00 00 03 03 02 [val]` | 3 bytes | Header + `[03 02 val]` (20% cap = `0x33`) |
| **Set RGB Color** | `53 50 54 45 43 48 00 03 58 00 00 00 05 03 04 [RR] [GG] [BB]` | 5 bytes | Header + `[03 04 R G B]` |
| **Select Effect** | `53 50 54 45 43 48 00 03 58 00 00 00 03 03 06 [modeId]` | 3 bytes | Header + `[03 06 modeId]` |
| **Set Effect Speed** | `53 50 54 45 43 48 00 03 58 00 00 00 03 03 07 [speed]` | 3 bytes | Header + `[03 07 speed]` |
| **Set Direction** | `53 50 54 45 43 48 00 03 58 00 00 00 03 03 08 [00/01]` | 3 bytes | Header + `[03 08 dir]` |
