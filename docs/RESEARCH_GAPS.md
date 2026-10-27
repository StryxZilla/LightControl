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
| **VF-03** | **SP530E BLE Profile** | Primary GATT Service is `0xFFE0` (`0000ffe0-0000-1000-8000-00805f9b34fb`) and Characteristic is `0xFFE1`. | `phhusson/ha-banlanx` & static binary extraction in `libapp.so`. |
| **VF-04** | **BLE Single-Client** | The ESP32-C3 firmware only permits one active BLE connection. Phone app must be closed for PC connection. | Confirmed in Home Assistant / UniLED issue trackers. |
| **VF-05** | **Local Wi-Fi Port** | The SP530E runs a local `SPNET` server on TCP/UDP port `8587`. | Network packet analysis in UniLED integration. |
| **VF-06** | **mDNS Discovery** | The SP530E broadcasts mDNS service **`_spled._tcp`** via Bonsoir/Zeroconf. | Static string extraction in `com.spled.scenex:libapp.so` at `0xb960a`. |
| **VF-07** | **SPNET Header** | TCP packets start with a 13-byte header: `SPTECH\0` + 1-byte command + 4-byte length + 1-byte checksum. | Binary wire captures in UniLED codebase. |
| **VF-08** | **WLED JSON API** | WLED exposes `/json/state`, `/json/info`, `/json/eff`, and `/json/pal` over HTTP and `/ws` over WebSocket. | Official WLED open-source documentation. |
| **VF-09** | **dig2go Hardware** | QuinLED dig2go runs an ESP32-WROOM-32E with a 5V 74AHCT125 level shifter, I2S mic, and 3A USB-C limit. | Quindor / Intermit.Tech schematics and documentation. |
| **VF-10** | **App Architecture** | BanlanX is a Flutter app; multi-channel controllers share the `packages/sp630e/` UI module while binding to hardware `0x4E`. | Discovered via `AssetManifest.json` and `libapp.so`. |

---

## 2. Working Hypotheses & Remaining Investigation Targets

| Hypothesis ID | Area | Working Hypothesis | Basis / Reasoning | Status |
| :--- | :--- | :--- | :--- | :--- |
| **HYP-01** | **SPNET Checksum Formula** | Byte `0x0C` of the 13-byte SPNET header is an additive sum modulo 256 of the payload bytes. | Observed in community packet parsing logic. | **Target for Live Socket Verification**. |
| **HYP-02** | **Wi-Fi Multi-Client** | The SP530E TCP server on port 8587 supports multiple concurrent TCP client sockets, unlike the single-client BLE stack. | Standard lwIP / ESP-IDF TCP server implementation on ESP32. | **Target for Live Socket Verification**. |
| **HYP-03** | **WS2812B Payload Chunk** | When configuring WS2812B and GRB color sequence, the payload chunk specifies IC ID (typically `0x01` for WS2812B), color order (`0x02` for GRB), and 2-byte pixel count. | Observed in UniLED chunk definitions. | **Target for Live Socket Verification**. |

---

## 3. Recommended Next Validation Step
Now that the discovery mechanism (`_spled._tcp` and TCP port 8587) and BLE profile (`0xFFE0`/`0xFFE1`) are established:
1. Conduct a safe read-only local network scan (mDNS query for `_spled._tcp` and UDP inquiry on port 8587) to verify if the physical SP530E controller responds from the local subnet.
2. If located on Wi-Fi, establish a safe TCP socket connection to port 8587 and read the initial status chunk emitted by the controller without writing any command frames.
