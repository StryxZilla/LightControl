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

### 2.3 Power ON (`0x50 0x01` + Paced Pixel Re-assertion)
* **Purpose**: Turn on the LED output and illuminate the strip.
* **Primary Frame**: `5350544543480050000000000101` (14 bytes)
* **Payload**: `[0x01]`
* **Critical Firmware Nuance**: Sending `0x50 0x01` alone updates the controller's internal state register (`buffer[40] == 0x01`), but because the ESP32 RMT frame buffer was cleared to zero upon Power OFF, the LEDs remain black until pixel data is re-asserted.
* **Pacing & Channel Isolation**:
  * Pacing delay (120ms) is required between `0x50 0x01` and the re-assertion frame to allow the ESP32 to complete its power-on state transition.
  * In solid mode, transmit ONLY `0x52` Static Color with the embedded brightness level.
  * **DO NOT transmit Opcode `0x51` (Brightness) in solid mode**: In the SP530E SPI-RGB configuration (`0x86`), `0x51` directs PWM white channel dimming. Transmitting `0x51` immediately after `0x52` overrides the channel multiplexer and blanks the WS2812B pixel output.
  * Defer background telemetry queries (`0x02`) by 350ms to prevent socket contention while the RMT driver is actively rendering.

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

### 2.6 Light Mode & Dynamic Effects (`0x53`)
* **Purpose**: Switch operating mode and active effect.
* **Hex Template**: `53505445434800530000000002[Mode][Effect]` (15 bytes)
* **Payload**: 2 bytes:
  * **Byte 0 (Mode)** (Verified via UniLED `SPTechFX` & Sperll firmware model):
    * `0x01`: Static Color mode (`MODE_STATIC_COLOR`)
    * `0x02`: Static White mode (`MODE_STATIC_WHITE`, PWM/CCT only)
    * `0x03`: Dynamic Color mode (`MODE_DYNAMIC_COLOR`, SPI RGB built-in animations 1-142)
    * `0x04`: Dynamic White mode (`MODE_DYNAMIC_WHITE`, PWM/CCT only)
    * `0x05`: Sound / Music Reactive mode (`MODE_SOUND_COLOR`, SPI RGB sound effects 1-18)
    * `0x06`: Sound White mode (`MODE_SOUND_WHITE`, PWM/CCT only)
    * `0x07`: Custom Solid DIY mode (`MODE_CUSTOM_SOLID`)
    * `0x08`: Custom Gradient DIY mode (`MODE_CUSTOM_GRADIENT`)
  * **Byte 1 (Effect)**:
    * For Mode 1 (Static): `0x01`
    * For Mode 3 (Dynamic Color): Effect index `0x01..0x8E` (1-142, e.g. 1 = Rainbow, 2 = Rainbow Meteor, etc.)
    * For Mode 5 (Sound Color): Sound effect index `0x01..0x12` (1-18)
* **Verified Frame Examples**:
  * **Static Solid Color Mode (Mode 1)**: `535054454348005300000000020101`
  * **Dynamic Effect 1 (Rainbow)**: `535054454348005300000000020301`
  * **Dynamic Effect 15 (Comet Red)**: `53505445434800530000000002030f`
  * **Sound Reactive Mode (Mode 5, Effect 1)**: `535054454348005300000000020501`
* **Critical Protocol Nuances**:
  * **Mode 2 vs Mode 3**: For addressable SPI RGB strips (`CFG_86`), Mode `0x02` is `MODE_STATIC_WHITE` (an invalid mode for pure RGB strips). Dynamic animations reside strictly under Mode `0x03` (`MODE_DYNAMIC_COLOR`).
  * **Effect Playback State (`0x5D`)**: Switching to Dynamic Mode requires unpausing the animation engine via Opcode `0x5D [0x01]` (`EFFECT_PLAY`).
  * **Length Parameter (`0x55`)**: The animation dot length should match the strip pixel count (e.g. 60 px) to render across the full strip.

### 2.7 Effect Speed (`0x54`)
* **Purpose**: Set dynamic animation speed.
* **Hex Template**: `53505445434800540000000001[Speed]` (14 bytes)
* **Payload**: 1 byte: `[speed (1-10)]` (Sperll SP530E controller hardware speed is 1 to 10; 1 = slowest, 10 = fastest).

### 2.8 Effect Length (`0x55`)
* **Purpose**: Set effect segment pattern length (number of active pixel dots in chaser/pattern).
* **Hex Template**: `53505445434800550000000001[Length]` (14 bytes)
* **Payload**: 1 byte: `[length (1-150)]`
* **Warning**: Opcode `0x55` is **Effect Length**, NOT Effect ID. Setting this to 0 or 1 blanks or truncates dynamic animations.

### 2.9 Effect Direction (`0x56`)
* **Purpose**: Set animation forward / reverse direction.
* **Hex Template**: `53505445434800560000000001[Dir]` (14 bytes)
* **Payload**: 1 byte: `[0x00 = Forward, 0x01 = Reverse]`

### 2.10 Effect Color (`0x57`)
* **Purpose**: Set custom RGB palette color for dynamic effects that support user colors (e.g. Comet, Snake, Wave, Stacking).
* **Hex Template**: `53505445434800570000000003[R][G][B]` (16 bytes)
* **Payload**: 3 bytes: `[R, G, B]`

### 2.11 Effect Play / Pause (`0x5D`)
* **Purpose**: Play/Resume or Pause/Stop dynamic running effects.
* **Hex Template**: `535054454348005d0000000001[Play]` (14 bytes)
* **Payload**: 1 byte: `[0x01 = Play/Resume, 0x00 = Pause/Stop]`

### 2.12 Audio Input Source (`0x59`)
* **Purpose**: Switch sound reactivity between built-in onboard microphone (`inner_mic`) and auxiliary input.
* **Hex Template**: `53505445434800590000000001[Source]` (14 bytes)
* **Payload**: 1 byte: `[0x00 = Built-in Mic, 0x01 = Line In]`

### 2.13 Audio Sensitivity / Gain (`0x5A`)
* **Purpose**: Adjust microphone reaction threshold.
* **Hex Template**: `535054454348005a0000000001[Gain]` (14 bytes)
* **Payload**: 1 byte: `[gain (1-16)]`

---

## 3. Summary of Discovered Operational Constraints
1. **Single-Socket lwIP Stack**: The ESP32-C3 firmware enforces a single active TCP connection on port `8587`. Any secondary concurrent socket (e.g. background probe) immediately triggers an `ECONNRESET` or peer disconnect.
2. **Idle Session Teardown**: Sockets idle for greater than ~8 minutes are closed by the peer. The application command queue auto-reconnects on demand in under 60 ms.
3. **Power ON Frame Re-assertion**: WS2812B digital LED pixels are shift-register based. After power-down clears the signal, turning power on must be paired with active pixel data to drive visible illumination.
