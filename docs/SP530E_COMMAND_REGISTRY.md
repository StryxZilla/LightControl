# SP530E Unified Command Registry

## 1. Overview
This registry catalogs all control, telemetry, configuration, and state commands supported by the **SP530E 5-in-1 IoT LED Controller** across both Bluetooth Low Energy (BLE) and Local Wi-Fi (`SPNET` TCP) transports.

---

## 2. Confidence Level Definitions
* **`VERIFIED_HARDWARE`**: Confirmed directly via physical hardware packet transmission or captured telemetry against the user's live controller (`192.168.86.34:8587`).
* **`VERIFIED_MULTI_SOURCE`**: Corroborated clean-room across decompiled Flutter/Dart code in `com.spled.scenex`, native Android plugins (`C2.a`, `E2.d`), and independent community implementations (`uniled`, `sp542e-ha-bridge`).
* **`CANDIDATE`**: Observed in static code disassembly or decompiled symbol tables, pending direct live hardware write execution.

---

## 3. Command Registry Table

### 3.1 Device Power & Core State Commands

#### `CMD-01`: Power ON
* **Supported Model**: SP530E (`0x4E`)
* **Transport**: BLE (`0xFFE0` / `0xFFE1`) & Wi-Fi TCP (`8587`)
* **Service UUID**: `0000ffe0-0000-1000-8000-00805f9b34fb`
* **Characteristic UUID**: `0000ffe1-0000-1000-8000-00805f9b34fb`
* **Command Structure**:
  * **BLE Frame**: `53 50 00 01 00 01 01` (7 bytes)
  * **SPNET Frame**: `53 50 54 45 43 48 00 03 58 00 00 00 03 03 01 01` (16 bytes)
* **Parameters**: None (Static constant `0x01`)
* **Expected Response**: BLE Notification / SPNET Chunk 0x03 with Power flag = `0x01`
* **Evidence / Source**: `libapp.so` @ `0x152ed1` (`setOnOffLfx`), `power_on.json`, `uniled/ble_banlanx`
* **Confidence Level**: **`VERIFIED_MULTI_SOURCE`**

#### `CMD-02`: Power OFF
* **Supported Model**: SP530E (`0x4E`)
* **Transport**: BLE (`0xFFE0` / `0xFFE1`) & Wi-Fi TCP (`8587`)
* **Service UUID**: `0000ffe0-0000-1000-8000-00805f9b34fb`
* **Characteristic UUID**: `0000ffe1-0000-1000-8000-00805f9b34fb`
* **Command Structure**:
  * **BLE Frame**: `53 50 00 01 00 01 00` (7 bytes)
  * **SPNET Frame**: `53 50 54 45 43 48 00 03 58 00 00 00 03 03 01 00` (16 bytes)
* **Parameters**: None (Static constant `0x00`)
* **Expected Response**: BLE Notification / SPNET Chunk 0x03 with Power flag = `0x00`
* **Evidence / Source**: `libapp.so` @ `0x152ed1` (`setOnOffLfx`), `power_off.json`
* **Confidence Level**: **`VERIFIED_MULTI_SOURCE`**

---

### 3.2 Brightness & Color Commands

#### `CMD-03`: Set Color Brightness
* **Supported Model**: SP530E (`0x4E`)
* **Transport**: BLE (`0xFFE0` / `0xFFE1`) & Wi-Fi TCP (`8587`)
* **Command Structure**:
  * **BLE Frame**: `53 50 00 02 00 01 [val]`
  * **SPNET Frame**: `53 50 54 45 43 48 00 03 58 00 00 00 03 03 02 [val]`
* **Parameters**:
  * `brightness`: `uint8` (`0x00` to `0xFF`). Enforced 20% safety limit during test mode = `0x33` (51).
* **Expected Response**: State update with updated brightness value in telemetry chunk.
* **Evidence / Source**: `libapp.so` (`setBrightness`), `set_brightness_20pct.json`
* **Confidence Level**: **`VERIFIED_MULTI_SOURCE`**

#### `CMD-04`: Set White Channel Brightness
* **Supported Model**: SP530E (`0x4E`)
* **Transport**: BLE (`0xFFE0` / `0xFFE1`) & Wi-Fi TCP (`8587`)
* **Command Structure**:
  * **BLE Frame**: `53 50 00 03 00 01 [val]`
  * **SPNET Frame**: `53 50 54 45 43 48 00 03 58 00 00 00 03 03 03 [val]`
* **Parameters**:
  * `whiteBrightness`: `uint8` (`0x00` to `0xFF`).
* **Expected Response**: White LED PWM channel adjustment.
* **Evidence / Source**: `packages/sp630e/assets/icons/ic_white_brightness.png`, `libapp.so`
* **Confidence Level**: **`CANDIDATE`** (Inactive on 3-channel WS2812B; applies to RGBW/RGBCCT)

#### `CMD-05`: Set Solid RGB Color
* **Supported Model**: SP530E (`0x4E`)
* **Transport**: BLE (`0xFFE0` / `0xFFE1`) & Wi-Fi TCP (`8587`)
* **Command Structure**:
  * **BLE Frame**: `53 50 00 04 00 03 [RR] [GG] [BB]` (9 bytes)
  * **SPNET Frame**: `53 50 54 45 43 48 00 03 58 00 00 00 05 03 04 [RR] [GG] [BB]` (18 bytes)
* **Parameters**:
  * `red`: `uint8` (`0` to `255`)
  * `green`: `uint8` (`0` to `255`)
  * `blue`: `uint8` (`0` to `255`)
* **Expected Response**: Controller shifts color into WS2812B register; Chunk 0x03 Bytes 4-6 reflect `#RRGGBB`.
* **Evidence / Source**: `libapp.so` @ `0x10b6a5` (`setLfxColor`), `set_color_red.json`, `sp530e_status_response.bin`
* **Confidence Level**: **`VERIFIED_MULTI_SOURCE`**

#### `CMD-06`: Set CCT Color Temperature
* **Supported Model**: SP530E (`0x4E`)
* **Transport**: BLE (`0xFFE0` / `0xFFE1`) & Wi-Fi TCP (`8587`)
* **Command Structure**:
  * **BLE Frame**: `53 50 00 05 00 02 [Warm] [Cool]` (8 bytes)
  * **SPNET Frame**: `53 50 54 45 43 48 00 03 58 00 00 00 04 03 05 [Warm] [Cool]` (17 bytes)
* **Parameters**:
  * `warm`: `uint8` (`0` to `255`)
  * `cool`: `uint8` (`0` to `255`)
* **Expected Response**: CCT balance updated in firmware register.
* **Evidence / Source**: `libapp.so` (`setLfxColorTemp`), `xydac/sp542e-ha-bridge`
* **Confidence Level**: **`CANDIDATE`**

---

### 3.3 Dynamic Lighting Effect Commands

#### `CMD-07`: Select Dynamic Effect Mode
* **Supported Model**: SP530E (`0x4E`)
* **Transport**: BLE (`0xFFE0` / `0xFFE1`) & Wi-Fi TCP (`8587`)
* **Command Structure**:
  * **BLE Frame**: `53 50 00 06 00 01 [modeId]`
  * **SPNET Frame**: `53 50 54 45 43 48 00 03 58 00 00 00 03 03 06 [modeId]`
* **Parameters**:
  * `modeId`: `uint8` (`1` to `142`). Mode 1 = Rainbow, Mode 2 = Fire, etc.
* **Expected Response**: Chunk 0x03 Byte 1 updates to `modeId`.
* **Evidence / Source**: `libapp.so` @ `0x13d0ba` (`setLfxMode`), `set_effect_rainbow.json`
* **Confidence Level**: **`VERIFIED_MULTI_SOURCE`**

#### `CMD-08`: Set Effect Speed
* **Supported Model**: SP530E (`0x4E`)
* **Transport**: BLE (`0xFFE0` / `0xFFE1`) & Wi-Fi TCP (`8587`)
* **Command Structure**:
  * **BLE Frame**: `53 50 00 07 00 01 [speed]`
  * **SPNET Frame**: `53 50 54 45 43 48 00 03 58 00 00 00 03 03 07 [speed]`
* **Parameters**:
  * `speed`: `uint8` (`0` to `255`).
* **Expected Response**: Dynamic animation clock rate adjusted.
* **Evidence / Source**: `libapp.so` @ `0x60c79` (`setLfxSpeed`), Chunk 0x03 Byte 7
* **Confidence Level**: **`VERIFIED_MULTI_SOURCE`**

#### `CMD-09`: Set Effect Direction
* **Supported Model**: SP530E (`0x4E`)
* **Transport**: BLE (`0xFFE0` / `0xFFE1`) & Wi-Fi TCP (`8587`)
* **Command Structure**:
  * **BLE Frame**: `53 50 00 08 00 01 [00/01]`
  * **SPNET Frame**: `53 50 54 45 43 48 00 03 58 00 00 00 03 03 08 [00/01]`
* **Parameters**:
  * `direction`: `uint8` (`0x00` = Forward / Left, `0x01` = Reverse / Right).
* **Expected Response**: Animation flow reversed on addressable pixels.
* **Evidence / Source**: `libapp.so` @ `0xc3bb0` (`setLfxDir`), Chunk 0x03 Byte 8
* **Confidence Level**: **`VERIFIED_MULTI_SOURCE`**

---

### 3.4 Hardware Telemetry & Query Commands

#### `CMD-10`: Query Controller State & Configuration
* **Supported Model**: SP530E (`0x4E`)
* **Transport**: BLE (`0xFFE0` / `0xFFE1`) & Wi-Fi TCP (`8587`)
* **Command Structure**:
  * **BLE Frame**: `53 50 00 00 00 00` (6 bytes)
  * **SPNET Frame**: `53 50 54 45 43 48 00 02 58 00 00 00 00` (13 bytes)
* **Parameters**: None
* **Expected Response**:
  * On BLE: Stream of state notifications over characteristic `0xFFE1`.
  * On Wi-Fi: Complete 428-byte unencrypted payload containing Chunk 0x01 (Config) and Chunk 0x03 (Telemetry).
* **Evidence / Source**: Captured live wire response in `protocol/fixtures/sp530e_status_response.bin`
* **Confidence Level**: **`VERIFIED_HARDWARE`** (100% Empirically verified)
