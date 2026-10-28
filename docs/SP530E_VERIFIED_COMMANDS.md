# SP530E Verified Wire Protocol Commands

## Overview
This document specifies the exact wire framing, opcodes, payload layouts, and empirical hardware responses for the Sperll SP530E LED controller operating over Wi-Fi TCP port `8587`.

All commands have been empirically validated against physical SP530E hardware (Firmware `V2.0.13`, Light Type `0x86` SPI WS2812B, 60 pixels) at IP `192.168.86.34:8587`.

---

## 1. Frame Structure

All Wi-Fi control frames use a 13-byte header prefixed by the ASCII magic string `"SPTECH\0"`, followed by the command opcode, key, packet counters, payload length, and payload bytes:

```text
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|   'S' (0x53)  |   'P' (0x50)  |   'T' (0x54)  |   'E' (0x45)  |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|   'C' (0x43)  |   'H' (0x48)  |   '\0' (0x00) |    Opcode     |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|  Key (0x00)   | Total (0x00)  | Index (0x00)  | Length High   |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|  Length Low   | ... Payload Bytes (Length bytes) ...          |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

| Offset | Field | Type | Description |
| :--- | :--- | :--- | :--- |
| `0..6` | Magic | `char[7]` | ASCII `"SPTECH\0"` (`53 50 54 45 43 48 00`) |
| `7` | Opcode | `uint8` | SPTech Command Byte (e.g. `0x02`, `0x50`, `0x51`, `0x52`) |
| `8` | Key | `uint8` | Encryption/Session Key (`0x00` for commands, `0x58` for query) |
| `9` | Total Packets | `uint8` | Total packets in message (`0x00`) |
| `10` | Packet Index | `uint8` | Zero-based packet index (`0x00`) |
| `11..12`| Payload Length| `uint16_be` | Big-endian payload byte count |
| `13..N`| Payload | `uint8[]` | Command-specific parameter bytes |

---

## 2. Command Reference Matrix

### 2.1 State Query (`0x02`)
* **Purpose**: Request full 428-byte hardware configuration, state, and telemetry chunk packet.
* **Hex String**: `53505445434800025800000000` (13 bytes)
* **Payload Length**: 0
* **Device Response**: 428 bytes containing Chunk 1 (Firmware, IC type, pixel count) and Chunk 3 (power state, active color, brightness, effect, speed).

### 2.2 Power OFF (`0x50 0x00`)
* **Purpose**: Turn off the LED output.
* **Hex String**: `5350544543480050000000000100` (14 bytes)
* **Payload**: `[0x00]`
* **Observed Physical Result**: The ESP32 clears the WS2812B RMT pulse train; all LEDs instantly extinguish.
* **Telemetry Response**: Offset 40 in response transitions from `0x01` to `0x00` (`Power: OFF`).

### 2.3 Power ON (`0x50 0x01` + State Re-assertion)
* **Purpose**: Turn on the LED output and illuminate the strip.
* **Primary Frame**: `5350544543480050000000000101` (14 bytes)
* **Payload**: `[0x01]`
* **Critical Firmware Nuance**: Sending `0x50 0x01` alone updates the controller's internal state register (`buffer[40] == 0x01`), but because the ESP32 RMT frame buffer was cleared to zero upon Power OFF, the LEDs remain black until pixel data is re-asserted.
* **Re-assertion Sequence**: `setPower(true)` must immediately transmit the active `0x52` Static Color (or `0x53` Effect Mode) and `0x51` Brightness frame to re-render pixel pulses to the strip.

### 2.4 Static Color (`0x52`)
* **Purpose**: Set solid RGB color and brightness level.
* **Hex Template**: `53505445434800520000000004[R][G][B][Level]` (17 bytes)
* **Payload**: 4 bytes: `[Red (0-255), Green (0-255), Blue (0-255), Brightness (0-255)]`
* **Verified Examples**:
  * Cyan (100%): `5350544543480052000000000400ffffff`
  * Pure Blue (100%): `535054454348005200000000040000ffff`
  * Pure Red (100%): `53505445434800520000000004ff0000ff`
  * Pure Green (100%): `5350544543480052000000000400ff00ff`
* **Observed Physical Result**: Strip immediately renders the specified RGB color.

### 2.5 Brightness Level (`0x51`)
* **Purpose**: Adjust master brightness scale.
* **Hex Template**: `5350544543480051000000000200[Level]` (15 bytes)
* **Payload**: 2 bytes: `[which=0x00 (color mode), level (0-255)]`
* **Verified Examples**:
  * 20% Safe Limit (`0x33` = 51): `535054454348005100000000020033`
  * 50% (`0x80` = 128): `535054454348005100000000020080`
  * 100% (`0xFF` = 255): `5350544543480051000000000200ff`

### 2.6 Dynamic Effect Mode (`0x53`)
* **Purpose**: Switch to built-in dynamic effect.
* **Hex Template**: `53505445434800530000000001[ModeId]` (14 bytes)
* **Payload**: 1 byte: `[modeId (1-255)]`
* **Verified Example**: Effect Mode 1: `5350544543480053000000000101`

### 2.7 Effect Speed (`0x54`)
* **Purpose**: Set dynamic animation speed.
* **Hex Template**: `53505445434800540000000001[Speed]` (14 bytes)
* **Payload**: 1 byte: `[speed (0-255)]`

### 2.8 Effect Direction (`0x56`)
* **Purpose**: Set animation forward / reverse direction.
* **Hex Template**: `53505445434800560000000001[Dir]` (14 bytes)
* **Payload**: 1 byte: `[0x00 = Forward, 0x01 = Reverse]`

### 2.9 Audio Input Source (`0x59`)
* **Purpose**: Switch sound reactivity between built-in onboard microphone (`inner_mic`) and auxiliary input.
* **Hex Template**: `53505445434800590000000001[Source]` (14 bytes)
* **Payload**: 1 byte: `[0x00 = Built-in Mic, 0x01 = Line In]`

### 2.10 Audio Sensitivity / Gain (`0x5A`)
* **Purpose**: Adjust microphone reaction threshold.
* **Hex Template**: `535054454348005a0000000001[Gain]` (14 bytes)
* **Payload**: 1 byte: `[gain (1-255)]`

---

## 3. Summary of Discovered Operational Constraints
1. **Single-Socket lwIP Stack**: The ESP32-C3 firmware enforces a single active TCP connection on port `8587`. Any secondary concurrent socket (e.g. background probe) immediately triggers an `ECONNRESET` or peer disconnect.
2. **Idle Session Teardown**: Sockets idle for greater than ~8 minutes are closed by the peer. The application command queue auto-reconnects on demand in under 60 ms.
3. **Power ON Frame Re-assertion**: WS2812B digital LED pixels are shift-register based. After power-down clears the signal, turning power on must be paired with active pixel data to drive visible illumination.
