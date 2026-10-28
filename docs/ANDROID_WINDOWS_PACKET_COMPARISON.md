# BanlanX Android vs Windows Desktop Application Wire Protocol Comparison

## Executive Summary
This document provides a side-by-side wire protocol and architectural comparison between the mobile BanlanX implementation (`com.spled.scenex` v3.3.5) and the Windows Desktop Universal LED Controller application (`LightControl`).

Empirical tests against physical hardware (`192.168.86.34:8587`) and analysis of decompiled artifacts (`libapp.so`, `uniled`, and runtime log telemetry) have verified that:
1. **Wi-Fi Control (TCP 8587)**: BanlanX and the Windows application both use the `SPNET` protocol over TCP port `8587` with the 13-byte `SPTECH\0` magic header.
2. **Opcode Parity**: Byte 7 is the direct SPTech command opcode (`0x50` Power, `0x51` Brightness, `0x52` Color, `0x53` Effect, `0x54` Speed).
3. **Hardware Illumination**: WS2812B pixel output requires active RGB/effect frames to illuminate the physical strip after Power OFF clears the controller's RMT output buffer.

---

## 1. Side-by-Side Wire Packet Comparison

| Feature / Action | BanlanX Wire Bytes | Windows App Sent Bytes | SP530E Response | Physical Hardware Result | Key Protocol Nuances |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **State Query** | `53 50 54 45 43 48 00 02 58 00 00 00 00` (13B) | `53 50 54 45 43 48 00 02 58 00 00 00 00` (13B) | 428-byte configuration & telemetry chunk payload | **PASS** — Controller returns firmware, IC model, and state | Header: `SPTECH\0`, Opcode `0x02`, Key `0x58`, Length `0x0000` |
| **Power OFF** | `53 50 54 45 43 48 00 50 00 00 00 00 01 00` (14B) | `53 50 54 45 43 48 00 50 00 00 00 00 01 00` (14B) | Telemetry response with `data[40] == 0x00` | **PASS** — Physical strip immediately turns dark | Opcode `0x50`, Payload `[0x00]`. ESP32 clears WS2812B RMT pulse train. |
| **Power ON** | `53 50 54 45 43 48 00 50 00 00 00 00 01 01` (14B) + active state re-render | `53 50 54 45 43 48 00 50 00 00 00 00 01 01` (14B) + `0x52` Color / `0x51` Brightness | Telemetry response with `data[40] == 0x01` | **PASS** — Physical strip immediately re-illuminates | `0x50 0x01` alone flips register; re-asserting pixel data renders LEDs. |
| **Solid Color (Cyan)** | `53 50 54 45 43 48 00 52 00 00 00 00 04 00 ff ff ff` (17B) | `53 50 54 45 43 48 00 52 00 00 00 00 04 00 ff ff ff` (17B) | State updated to Color mode, RGB (0, 255, 255) | **PASS** — Physical LEDs turn bright Cyan | Opcode `0x52`, Payload: `[R, G, B, Level]`. Length 4 bytes. |
| **Solid Color (Blue)** | `53 50 54 45 43 48 00 52 00 00 00 00 04 00 00 ff ff` (17B) | `53 50 54 45 43 48 00 52 00 00 00 00 04 00 00 ff ff` (17B) | State updated to Color mode, RGB (0, 0, 255) | **PASS** — Physical LEDs turn bright Blue | Directly drives pixel outputs. |
| **Brightness (20% Safe)** | `53 50 54 45 43 48 00 51 00 00 00 00 02 00 33` (15B) | `53 50 54 45 43 48 00 51 00 00 00 00 02 00 33` (15B) | Brightness register updated to 51/255 | **PASS** — Intensity dims to 20% | Opcode `0x51`, Payload: `[which=0x00, level=0x33]`. |
| **Brightness (100%)** | `53 50 54 45 43 48 00 51 00 00 00 00 02 00 ff` (15B) | `53 50 54 45 43 48 00 51 00 00 00 00 02 00 ff` (15B) | Brightness register updated to 255/255 | **PASS** — Intensity increases to full | Opcode `0x51`, Payload: `[0x00, 0xff]`. |
| **Dynamic Effect Mode** | `53 50 54 45 43 48 00 53 00 00 00 00 01 [id]` (14B) | `53 50 54 45 43 48 00 53 00 00 00 00 01 [id]` (14B) | Mode updated to Effect mode | **PASS** — Strip begins animated pattern | Opcode `0x53`, Payload: `[modeId]`. |
| **Effect Speed** | `53 50 54 45 43 48 00 54 00 00 00 00 01 [spd]` (14B) | `53 50 54 45 43 48 00 54 00 00 00 00 01 [spd]` (14B) | Speed register updated | **PASS** — Pattern animation speeds up/down | Opcode `0x54`, Payload: `[speed (0-255)]`. |

---

## 2. Granular Protocol Component Comparison

### 2.1 Magic Header
* **BanlanX**: 7 bytes: `53 50 54 45 43 48 00` (`"SPTECH\0"`).
* **Windows App**: 7 bytes: `53 50 54 45 43 48 00` (`"SPTECH\0"`).
* **Verdict**: **Exact 100% Match**.

### 2.2 Command ID / Opcode
* **BanlanX**: Direct command byte at offset 7 (`0x50` Power, `0x51` Brightness, `0x52` Color, `0x53` Mode, `0x54` Speed).
* **Windows App**: Direct command byte at offset 7 (upgraded from earlier community `0x03` hypothesis).
* **Verdict**: **Exact 100% Match**.

### 2.3 Encryption & Session Key
* **BanlanX**: Byte 8 is `0x58` for state queries, `0x00` for all control mutations.
* **Windows App**: Byte 8 is `0x58` for state queries, `0x00` for all control mutations.
* **Verdict**: **Exact 100% Match**.

### 2.4 Payload Length & Framing
* **BanlanX**: Big-endian 16-bit length at bytes 11..12 (`(len >> 8) & 0xff`, `len & 0xff`).
* **Windows App**: Big-endian 16-bit length at bytes 11..12.
* **Verdict**: **Exact 100% Match**.

### 2.5 Checksum / CRC
* **BanlanX**: None used for TCP `SPNET` frames (TCP checksum handles transport layer integrity).
* **Windows App**: None used for TCP frames.
* **Verdict**: **Exact 100% Match**.

---

## 3. Transport & Connection Lifecycle Comparison

| Transport Attribute | BanlanX Mobile App | Windows Desktop Application | Resolution & Impact |
| :--- | :--- | :--- | :--- |
| **Target Protocol** | TCP port `8587` | TCP port `8587` | Direct socket stream matching target hardware. |
| **Concurrent Sockets** | Serialized per device; only 1 TCP connection open | Mutex-locked command queue; prevents concurrent connect attempts | Avoids ESP32 lwIP single-client `ECONNRESET`. |
| **Idle Timeout** | Reconnects upon subsequent user tap | Automatically reconnects on-demand in `<60ms` | Handles peer socket closure cleanly. |
| **Secondary Probing** | Skips connected IPs during mDNS scan | Skips actively connected devices during background ARP scans | Preserves ongoing connection stability. |
| **State Re-assertion** | Pushes active color upon power toggle | Re-asserts active color and brightness in `setPower(true)` | Solves dark LED strip symptom after Power ON. |
