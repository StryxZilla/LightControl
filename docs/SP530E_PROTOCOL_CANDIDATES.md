# SP530E Candidate Protocol Specifications

**Author**: Antigravity Autonomous Engineering  
**Scope**: Candidate command frames for SP530E (Wi-Fi `SPNET` and BLE GATT)  
**Status**: Synthesized from decompiled APK analysis, open-source prior art (`uniled`), and empirical live hardware verification.  

---

## 1. Candidate Command Index

| Command Identifier | Functional Purpose | Transport Supported | Verification Status |
| :--- | :--- | :---: | :---: |
| **`CMD_STATE_QUERY`** | Poll complete device configuration and telemetry | TCP 8587 / BLE 0xFFE1 | **Verified Live** (EV-008) |
| **`CMD_POWER_SET`** | Turn LED strip power ON or OFF | TCP 8587 / BLE 0xFFE1 | High Confidence Candidate |
| **`CMD_BRIGHTNESS_SET`**| Adjust global brightness (0 - 100%) | TCP 8587 / BLE 0xFFE1 | High Confidence Candidate |
| **`CMD_COLOR_SET`** | Set solid RGB / RGBW color | TCP 8587 / BLE 0xFFE1 | High Confidence Candidate |
| **`CMD_EFFECT_SET`** | Activate built-in dynamic effect pattern | TCP 8587 / BLE 0xFFE1 | High Confidence Candidate |
| **`CMD_EFFECT_SPEED`** | Adjust animation speed (1 - 100%) | TCP 8587 / BLE 0xFFE1 | High Confidence Candidate |
| **`CMD_EFFECT_DIR`** | Reverse animation direction (Forward / Reverse) | TCP 8587 / BLE 0xFFE1 | Medium Confidence Candidate |
| **`CMD_PIXEL_COUNT`** | Configure total addressable LED count (1 - 1200) | TCP 8587 / BLE 0xFFE1 | High Confidence Candidate |
| **`CMD_IC_TYPE`** | Set LED IC chipset (WS2812B, SK6812, etc.) | TCP 8587 / BLE 0xFFE1 | Medium Confidence Candidate |

---

## 2. Command Specifications & Byte Layouts

---

### Candidate 01: `CMD_STATE_QUERY` (State Telemetry Request)
- **Source Location**: `libapp.so` Dart network client, `monty68/uniled/lib/net/sp53x_54xe.py`.
- **Expected Parameters**: None (query command).
- **Byte-Level Construction**:
  ```text
  [0x53, 0x50, 0x54, 0x45, 0x43, 0x48, 0x00, 0x02, 0x58, 0x00, 0x00, 0x00, 0x00]
  - Bytes 0..5 : "SPTECH"
  - Byte 6     : 0x00 (Null delimiter)
  - Byte 7     : 0x02 (Command ID = Query)
  - Byte 8     : 0x58 (Key = 0x58)
  - Bytes 9..10: 0x00, 0x00 (Packet count / Index)
  - Bytes 11..12: 0x00, 0x00 (Payload length = 0)
  ```
- **Transport & Destination**: TCP Port `8587` on `<Controller-IP>` (or BLE Characteristic `0xFFE1`).
- **Device Model Applicability**: SP530E (`0x4E`), SP541E (`0x5C`), SP630E, and SP548E.
- **Confidence Level**: **Verified Empirical Fact** (Observed live response of 428 bytes from `192.168.86.34:8587`).
- **Runtime Verification**: Transmitted live in Python/Node; parsed in [`tests/protocol/spnet-codec.test.ts`](file:///g:/Light%20Test/tests/protocol/spnet-codec.test.ts).

---

### Candidate 02: `CMD_POWER_SET` (Power ON / OFF)
- **Source Location**: `libapp.so` @ `0x152ed9` (`setOnOffLfx`), `monty68/uniled/lib/sptech_model.py`.
- **Expected Parameters**: `on: boolean` (`0x01` = ON, `0x00` = OFF).
- **Byte-Level Construction (Wi-Fi SPNET TCP)**:
  ```text
  Header (13 bytes):
  [0x53, 0x50, 0x54, 0x45, 0x43, 0x48, 0x00, 0x03, 0x58, 0x00, 0x00, 0x00, 0x02]
  - Command ID: 0x03 (Set State)
  - Payload Length: 0x0002 (2 bytes)

  Payload (2 bytes):
  [0x2A, 0x01] -> Power ON
  [0x2A, 0x00] -> Power OFF
  ```
  *(Opcode `0x2A` maps to power state in Sperll multi-mode controllers).*
- **Transport & Destination**: TCP Port `8587` on `<Controller-IP>` (or BLE `0xFFE1`).
- **Device Model Applicability**: SP530E, SP630E.
- **Confidence Level**: **High Confidence Candidate**.
- **Proposed Runtime Verification Test**:
  1. Ensure strip is visible.
  2. With user approval, transmit `CMD_POWER_SET(false)` and visually verify strip turns dark.
  3. Transmit `CMD_POWER_SET(true)` and verify strip illuminates.

---

### Candidate 03: `CMD_BRIGHTNESS_SET` (Global Brightness)
- **Source Location**: `libapp.so` @ `0x60c7c`, `packages/sp630e/assets/icons/ic_brightness.png`.
- **Expected Parameters**: `brightness: number` (0 - 100% mapped to hardware 0 - 255).
- **Byte-Level Construction (Wi-Fi SPNET TCP)**:
  ```text
  Header (13 bytes):
  [0x53, 0x50, 0x54, 0x45, 0x43, 0x48, 0x00, 0x03, 0x58, 0x00, 0x00, 0x00, 0x02]
  - Command ID: 0x03 (Set State)
  - Payload Length: 0x0002 (2 bytes)

  Payload (2 bytes):
  [0x2B, <BRIGHTNESS_0_TO_255>]
  E.g. 10% brightness = 26 (0x1A) -> [0x2B, 0x1A]
  E.g. 50% brightness = 128 (0x80) -> [0x2B, 0x80]
  ```
- **Transport & Destination**: TCP Port `8587` on `<Controller-IP>` (or BLE `0xFFE1`).
- **Device Model Applicability**: SP530E, SP630E.
- **Confidence Level**: **High Confidence Candidate**.
- **Proposed Runtime Verification Test**:
  1. Enforce safety limit (max 20% brightness).
  2. Send `CMD_BRIGHTNESS_SET(10%)` (`0x1A`), followed by status query to verify `data[47] == 0x1A`.

---

### Candidate 04: `CMD_COLOR_SET` (Solid RGB / RGBW Color)
- **Source Location**: `libapp.so` @ `0x10b6a8` (`setLfxColor`), `packages/sp630e/assets/icons/ic_color_brightness.png`.
- **Expected Parameters**: `r, g, b: number` (0 - 255).
- **Byte-Level Construction (Wi-Fi SPNET TCP)**:
  ```text
  Header (13 bytes):
  [0x53, 0x50, 0x54, 0x45, 0x43, 0x48, 0x00, 0x03, 0x58, 0x00, 0x00, 0x00, 0x04]
  - Command ID: 0x03 (Set State)
  - Payload Length: 0x0004 (4 bytes)

  Payload (4 bytes):
  [0x2C, <RED>, <GREEN>, <BLUE>]
  E.g. Solid Red:   [0x2C, 0xFF, 0x00, 0x00]
  E.g. Solid Green: [0x2C, 0x00, 0xFF, 0x00]
  E.g. Solid Blue:  [0x2C, 0x00, 0x00, 0xFF]
  ```
- **Transport & Destination**: TCP Port `8587` on `<Controller-IP>` (or BLE `0xFFE1`).
- **Device Model Applicability**: SP530E, SP630E.
- **Confidence Level**: **High Confidence Candidate**.
- **Proposed Runtime Verification Test**:
  1. Send solid blue at 10% brightness.
  2. Visually verify LEDs turn pure blue.
  3. Query status to verify `data[45..47] == [0x00, 0x00, 0xFF]`.

---

### Candidate 05: `CMD_EFFECT_SET` (Dynamic Built-in Effects)
- **Source Location**: `libapp.so` @ `0x13d0bd` (`setLfxMode`), `AssetManifest.json` (`ic_mode_rainbow_spin.png`).
- **Expected Parameters**: `modeId: number` (1 - 142 built-in Sperll dynamic patterns).
- **Byte-Level Construction (Wi-Fi SPNET TCP)**:
  ```text
  Header (13 bytes):
  [0x53, 0x50, 0x54, 0x45, 0x43, 0x48, 0x00, 0x03, 0x58, 0x00, 0x00, 0x00, 0x02]

  Payload (2 bytes):
  [0x2D, <MODE_ID>]
  E.g. Rainbow Flow (Mode 1): [0x2D, 0x01]
  E.g. Meteor Chase (Mode 5): [0x2D, 0x05]
  ```
- **Transport & Destination**: TCP Port `8587` on `<Controller-IP>` (or BLE `0xFFE1`).
- **Device Model Applicability**: SP530E, SP630E.
- **Confidence Level**: **High Confidence Candidate**.
- **Proposed Runtime Verification Test**:
  1. Select Mode 1 (Rainbow).
  2. Verify dynamic rainbow pattern flows across WS2812B strip.
  3. Query status to verify `data[43] == 0x01`.

---

### Candidate 06: `CMD_PIXEL_COUNT` (Total Strip Length)
- **Source Location**: `libapp.so` @ `0x127460` (`setLfxPixelCount`).
- **Expected Parameters**: `pixelCount: number` (1 - 1200).
- **Byte-Level Construction (Wi-Fi SPNET TCP)**:
  ```text
  Header (13 bytes):
  [0x53, 0x50, 0x54, 0x45, 0x43, 0x48, 0x00, 0x03, 0x58, 0x00, 0x00, 0x00, 0x03]

  Payload (3 bytes):
  [0x2E, <PIXEL_COUNT_HI>, <PIXEL_COUNT_LO>]
  E.g. 60 Pixels (0x003C):  [0x2E, 0x00, 0x3C]
  E.g. 300 Pixels (0x012C): [0x2E, 0x01, 0x2C]
  ```
- **Transport & Destination**: TCP Port `8587` on `<Controller-IP>` (or BLE `0xFFE1`).
- **Device Model Applicability**: SP530E (SPI modes).
- **Confidence Level**: **High Confidence Candidate** (Directly corresponds to `data[17..18] == 0x003C` in Chunk 0x01).
- **Proposed Runtime Verification Test**:
  1. Send 30 pixels. Verify only first 30 LEDs illuminate.
  2. Restore to 60 pixels. Verify entire strip illuminates.
