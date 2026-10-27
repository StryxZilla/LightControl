# Research Gaps & Investigation Ledger

**Author**: Antigravity Lead Engineer  
**Date**: 2026-10-27  
**Scope**: Distinction between verified facts, working hypotheses, and unresolved empirical unknowns.

---

## 1. Verified Evidence Ledger (Established Facts)

| Fact ID | Component | Statement | Verification Method |
| :--- | :--- | :--- | :--- |
| **VF-01** | **SP530E MCU** | The controller is powered by an Espressif ESP32-C3 chip with 2.4 GHz Wi-Fi and Bluetooth LE 5.0. | Teardown analysis & community hardware audits. |
| **VF-02** | **SP530E Model ID** | The unique model code byte for SP530E in BanlanX / UniLED is `0x4E` (Decimal: 78). | Reverse-engineered `sp53x_54xe.py` model tables. |
| **VF-03** | **SP530E BLE Profile** | Primary GATT Service is `0xFFE0` (`0000ffe0-0000-1000-8000-00805f9b34fb`) and Characteristic is `0xFFE1`. | `phhusson/ha-banlanx` & community GATT inspection. |
| **VF-04** | **BLE Single-Client** | The ESP32-C3 firmware only permits one active BLE connection. Phone app must be closed for PC connection. | Confirmed in Home Assistant / UniLED issue trackers. |
| **VF-05** | **Local Wi-Fi Port** | The SP530E runs a local `SPNET` server on TCP/UDP port `8587`. | Network packet analysis in UniLED integration. |
| **VF-06** | **SPNET Header** | TCP packets start with a 13-byte header: `SPTECH\0` + 1-byte command + 4-byte length + 1-byte checksum. | Binary wire captures in UniLED codebase. |
| **VF-07** | **WLED JSON API** | WLED exposes `/json/state`, `/json/info`, `/json/eff`, and `/json/pal` over HTTP and `/ws` over WebSocket. | Official WLED open-source documentation. |
| **VF-08** | **dig2go Hardware** | QuinLED dig2go runs an ESP32-WROOM-32E with a 5V 74AHCT125 level shifter, I2S mic, and 3A USB-C limit. | Quindor / Intermit.Tech schematics and documentation. |

---

## 2. Working Hypotheses & Unverified Claims

| Hypothesis ID | Area | Working Hypothesis | Basis / Reasoning | Status |
| :--- | :--- | :--- | :--- | :--- |
| **HYP-01** | **BLE Frame Format** | The SP530E BLE GATT write characteristic (`0xFFE1`) accepts packets formatted either as legacy Sperll command frames (`0x38`/`0x53`) or as chunked binary payloads identical to SPNET. | Some newer Sperll devices unified their BLE and Wi-Fi payload decoders on ESP32. | **Unverified**: Must decompile `com.spled.scenex` or sniff BLE packets. |
| **HYP-02** | **SPNET Checksum Formula** | Byte `0x0C` of the 13-byte SPNET header is an additive sum modulo 256 of the payload bytes. | Observed in community packet parsing logic. | **Unverified**: Must verify against decompiled Java encoder in APK. |
| **HYP-03** | **Wi-Fi Multi-Client** | The SP530E TCP server on port 8587 supports multiple concurrent TCP client sockets, unlike the single-client BLE stack. | Standard lwIP / ESP-IDF TCP server implementation on ESP32. | **Unverified**: Requires live connection test. |
| **HYP-04** | **WS2812B Chunk Structure** | Configuring WS2812B mode and GRB color sequence sends a specific setup chunk containing IC type ID, byte order index (e.g., `0x01` for GRB), and 2-byte pixel count. | Observed in `sptech_model.py` chunk serializers. | **Unverified**: Needs static confirmation from BanlanX app code. |

---

## 3. Critical Research Gaps Requiring Static APK Analysis

Before implementing live command packet encoders for the SP530E, the following gaps must be resolved through static analysis of the pulled `com.spled.scenex` APK:

1. **Exact BLE Characteristic Write Payload Layout**:
   - What are the exact opcode bytes sent to characteristic `0xFFE1` for:
     - Power On / Power Off
     - Master Brightness (0-100 or 0-255)
     - Solid Color RGB (`R`, `G`, `B`)
     - Built-in Effect selection (`EffectID`, `Speed`)
2. **Wi-Fi Provisioning Packet Structure**:
   - How does the mobile app format Wi-Fi SSID and password when writing to the BLE characteristic during network pairing?
3. **SPNET TCP Request/Response Chunks**:
   - Extract the exact Java class definitions responsible for encoding `SPTECH` packets (likely within a package such as `com.spled.scenex.protocol` or `com.spled.scenex.device.sptech`).
4. **Telemetry Decoding**:
   - How does the controller report its current state (power, brightness, active color, selected IC) in notification packets?

---

## 4. Empirical Validation Protocol
These gaps will be closed methodically:
1. Pull APK `com.spled.scenex` to `research/apk/`.
2. Execute focused JADX decompiler search on classes handling `0x4E`, `0xFFE1`, `SPTECH`, and port `8587`.
3. Document exact Java byte encoder routines into clean TypeScript specifications in `docs/PROTOCOL_FINDINGS.md`.
4. Run live Wireshark / TShark packet captures against the physical SP530E upon user approval.
