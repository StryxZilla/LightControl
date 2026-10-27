# SP530E Hardware & Protocol Research Dossier

**Author**: Antigravity Lead Engineer  
**Date**: 2026-10-27  
**Target Hardware**: Sperll / BanlanX SP530E Multi-Mode IoT LED Controller  
**Status**: Comprehensive Research & Static APK Evidence Synthesis  

---

## 1. Hardware Specifications & Supported LED Types

### 1.1 Electrical & Physical Architecture
* **Manufacturer**: Shenzhen Sperll Optoelectronic Technology Co., Ltd. (commonly distributed globally under the **BTF-LIGHTING** brand) [Source 1, 2].
* **Core Microcontroller**: Espressif **ESP32-C3** (Single-core RISC-V 32-bit CPU, 2.4 GHz Wi-Fi 802.11 b/g/n, and Bluetooth Low Energy 5.0) [Source 3, 4].
* **Input Operating Voltage**: **DC 5V to 24V** (DC barrel jack or screw terminals). The operating voltage supplied directly passes through to the LED strip; strip voltage and power supply voltage must match [Source 2].
* **Operating Current**: Quiescent draw is 20mA to 85mA [Source 3].
* **Output Configuration (5-in-1 Architecture)**:
  * **PWM Outputs**: 5 discrete PWM output channels (labeled `V+`, `R`, `G`, `B`, `CW`, `WW`). Rated for up to **6A per channel**, with a maximum combined continuous current limit of **12A** across all channels [Source 2].
  * **SPI Addressable Outputs**: Dedicated 3-pin / 4-pin screw terminal block providing `V+`, `GND`, `DAT` (Data Line), and `CLK` (Clock Line) [Source 2].
* **Dimensions & Enclosure**: 78mm × 56mm × 20mm, IP20 non-waterproof ABS casing [Source 3].
* **Operating Temperature Range**: -10°C to 60°C (14°F to 140°F) [Source 2].

### 1.2 Supported LED Configurations (12 Operating Modes)
The SP530E supports 12 distinct hardware wiring and light configurations selectable within firmware [Source 2, 5]:
1. **PWM Single Color** (1-channel PWM)
2. **PWM CCT / Dual White** (2-channel PWM: Warm White + Cool White)
3. **PWM RGB** (3-channel PWM)
4. **PWM RGBW** (4-channel PWM: RGB + Dedicated White)
5. **PWM RGBCCT** (5-channel PWM: RGB + Dual White)
6. **SPI Digital Single Color** (Addressable monochrome)
7. **SPI Digital CCT** (Addressable dual-white)
8. **SPI Digital RGB** (Addressable 3-channel: WS2811, WS2812B, etc.)
9. **SPI Digital RGBW** (Addressable 4-channel: SK6812 RGBW, WS2814)
10. **SPI Digital RGBCCT** (Addressable 5-channel: WS2805)
11. **Hybrid SPI RGB + 1-Channel PWM White**
12. **Hybrid SPI RGB + 2-Channel PWM CCT**

### 1.3 Supported Digital IC Driver Chips
The SPI data and clock generator supports a wide range of standard digital IC protocols [Source 2, 3]:
* **Standard NRZ Single-Wire Protocol**: WS2811, WS2812B, WS2813, WS2814, WS2815, SK6812, TM1804, TM1812, UCS1903, UCS1909, UCS1912, UCS2903, UCS2909, UCS2912, GS8206, GS8208, GW6205.
* **Dual-Wire (Data + Clock) Protocol**: TM1829, TM1914A, etc.
* **5-Channel Addressable Protocol**: WS2805 (SPI RGBCCT).
* **Maximum Addressable Pixel Limits**:
  * Single Color Addressable: Up to 3,600 pixels [Source 3].
  * CCT Addressable: Up to 1,200 – 1,800 pixels [Source 3].
  * RGB Addressable (e.g., WS2812B): Up to **1,200 pixels** [Source 3].
  * RGBW Addressable: Up to 900 pixels [Source 3].
  * RGBCCT Addressable: Up to 600 – 720 pixels [Source 3].

---

## 2. Bluetooth Low Energy (BLE) Profile & Protocol Findings

### 2.1 GATT Profile & UUID Specifications
Verified from static inspection of `com.spled.scenex` APK and community prior art [Source 6, 7, 19]:
* **Service UUID**: `0000ffe0-0000-1000-8000-00805f9b34fb` (Short 16-bit UUID: **`0xFFE0`**).
* **Characteristic UUID**: `0000ffe1-0000-1000-8000-00805f9b34fb` (Short 16-bit UUID: **`0xFFE1`**).
  * **Properties**: `WRITE WITHOUT RESPONSE`, `WRITE`, `NOTIFY`, `READ`.
  * **Function**: Serves as the unified bidirectional transport for control commands (writes) and controller telemetry / state broadcasts (notifications).
* **Alternate Variant Services (Firmware Dependent)**: Certain recent Sperll revisions advertise service `0xFFB0` with characteristic `0xFFB1`, or service `0xE0FF` [Source 6]. The primary target for SP530E remains `0xFFE0` / `0xFFE1`.

### 2.2 BLE Advertising & Manufacturer Data
* **Manufacturer Identifier**: Company ID `20563` (`0x5053` - ASCII string representation of "SP") [Source 6].
* **Model Identifier**: Hex code **`0x4E`** (Decimal: 78) uniquely designates the SP530E [Source 8, 9]. (For comparison, SP531E is `0x4F`, and SP541E is `0x5C`).
* **Advertising Payload**: Emits manufacturer data containing model byte `0x4E`, output configuration mode flag, power state flag, and MAC address components.

### 2.3 Strict Single-Client Connection Lock
> [!IMPORTANT]
> The ESP32-C3 firmware running on the SP530E implements a **strict single-client connection policy** over BLE [Source 7, 10]. If an Android or iOS smartphone running BanlanX has an active BLE connection to the controller (even in the background), any connection attempt from Windows will immediately fail with a GATT connection timeout or rejection. The mobile app must be explicitly closed or disconnected before testing Bluetooth LE from Windows.

---

## 3. Wi-Fi Discovery & Local Network Protocol (`SPNET`)

### 3.1 Architecture: Local API vs. Cloud Service
* **Local LAN Control**: **Confirmed Feasible**. Unlike purely cloud-tethered IoT devices, the SP530E runs an independent local network server [Source 11, 12]. It does **not** require an active internet connection or communication with BanlanX cloud servers to execute local commands once provisioned to a Wi-Fi network.
* **Cloud Relay**: The BanlanX cloud service is utilized strictly for out-of-home remote control and third-party voice assistant bridges (Amazon Alexa, Google Home, Xiao Ai) [Source 1]. When a mobile phone and controller are on the same subnet, communication is routed directly over the local network.

### 3.2 Verified Local mDNS Discovery (`_spled._tcp`)
Confirmed through static binary string extraction of `libapp.so` in `com.spled.scenex`:
* **mDNS Service Type**: **`_spled._tcp`** [Source 19].
* **Underlying Plugin**: `fr.skyost.bonsoir.BonsoirPlugin` (Zeroconf / mDNS discovery).
* **Discovery Workflow**:
  - The SP530E controller registers an mDNS responder announcing `_spled._tcp.local.` on the local network.
  - The client resolves this service to obtain the controller's local IP address and port (**`8587`**).
  - This allows zero-configuration automatic discovery across the subnet, exactly mirroring WLED's `_wled._tcp`.

### 3.3 Command & State Transport (TCP)
* **Transport**: Persistent or session-based TCP stream.
* **TCP Port**: Port **`8587`** [Source 11].
* **Protocol Name**: **SPNET** / **SPTech** [Source 11].

### 3.4 SPNET Binary Framing (13-Byte Header)
Every TCP message frame transmitted to or received from the SP530E begins with a rigid 13-byte binary header followed by a variable-length payload [Source 11, 14]:

| Byte Offset | Size | Field Name | Description | Example Hex Value |
| :---: | :---: | :--- | :--- | :--- |
| `0x00 - 0x05` | 6 bytes | Magic Prefix | ASCII string `"SPTECH"` | `53 50 54 45 43 48` |
| `0x06` | 1 byte | Terminator | Null byte (`\0`) | `0x00` |
| `0x07` | 1 byte | Command ID | Packet type specifier | `0x01` (Ping/Handshake), `0x02` (Query State), `0x03` (Set State) |
| `0x08 - 0x0B` | 4 bytes | Payload Length | `uint32` Big-Endian integer | e.g., `0x00 0x00 0x00 0x24` (36 bytes) |
| `0x0C` | 1 byte | Checksum / Flag | Modulo-256 additive checksum or status code | Dependent on payload contents |
| `0x0D ...` | N bytes | Structured Payload | Parameter chunks | Chunked data payload |

---

## 4. Chipset Configuration, Colors & Effects

### 4.1 Addressable IC & Channel Ordering Configuration
When configured for digital SPI strips (such as the user's **WS2812B**):
* **IC Model Selection**: Set to WS2812B / WS2811 protocol (800 kHz standard NRZ data line).
* **Color Sequence Order**: WS2812B strips typically use **GRB** color order; WS2811 commonly uses **RGB**. The controller firmware provides software byte-swapping for all 6 permutations: `RGB`, `RBG`, `GRB`, `GBR`, `BRG`, `BGR` [Source 2].
* **Pixel Count Allocation**: Configurable from 1 up to 1,200 RGB pixels [Source 3].

### 4.2 Dynamic Effects & Palettes
* **Built-in Patterns**: Contains **146 dynamic effects** (rainbow flows, chasing dots, color wipes, meteor trails, fire simulations, breathing cycles) [Source 3].
* **Parameter Adjustments**:
  * Effect Speed: 1% to 100%.
  * Effect Brightness: 1% to 100%.
  * Direction: Forward vs. Reverse.
  * Pattern Length / Segment Density: Adjustable pixel step count.

### 4.3 Audio & Music Reactive Modes
* **Audio Input Modes**:
  1. **Onboard Hardware Microphone** (`ic_inner_mic_selected`): High-sensitivity electret mic built into the SP530E chassis with adjustable hardware gain [Source 2, 3, 19].
  2. **Smartphone Microphone** (`ic_mobile_mic_selected`): Captures ambient sound via the mobile device microphone and streams reactive frames over BLE/Wi-Fi [Source 2, 19].
  3. **Media Audio Streaming** (`ic_player_selected`): Direct audio FFT analysis from media played on the host device [Source 2, 19].
* **Music Presets**: 18 specialized music-reactive visual patterns (Energy, Rhythm, Spectrum, Rolling, Jump, etc.) [Source 3].
* **Strip vs. Matrix Mapping**: Supports 1D linear strip sound bounce (`/sp630e/music/config/strip`) and 2D matrix audio frequency spectrum visualization (`/sp630e/music/config/matrix`) [Source 2, 19].

### 4.4 Timers, Power State & Scene Storage
* **Hardware Timers**: Up to 5 independent hardware timer schedules stored in non-volatile flash memory (`/sp630e/settings/timer/config`) [Source 2, 19].
* **Power-On State Memory**: Configurable behavior upon power restoration (`/sp630e/settings/powerOn`) [Source 2, 19].
* **Scene Storage**: Supports saving and recalling custom DIY static color and effect scenes (`/sp630e/diy/fav`) [Source 2, 19].

---

## 5. Firmware-Specific Behaviors & Community Findings

### 5.1 SP530E Architecture Mapping
* **Model Code**: SP530E identifies as `0x4E` [Source 8, 9].
* **App Code Unified Architecture**: In the BanlanX application, multi-channel controllers share the `packages/sp630e/` Flutter presentation module while binding to hardware model `0x4E` [Source 19].
* **Network Transport**: The SP530E runs the `SPNET` TCP/UDP protocol on port 8587 and broadcasts mDNS service `_spled._tcp`.

### 5.2 Known Integration Issues in Open-Source Projects
* **UniLED Issue #144**: *"sp530e failure to setup device due to config in power state"* — During initial handshake, if the device is queried while powered off, certain firmware builds return unexpected response chunks causing state parsing crashes [Source 16].
* **UniLED Issue #138**: Mixed RGB + CCT output quirks on WS2805 strips after mode transitions [Source 17].
* **Custom Effect Limitation**: In Home Assistant integrations, custom user-defined effect sequences cannot be edited remotely through the API; they must be configured first in the official BanlanX app and then recalled by ID [Source 10].

---

## 6. BanlanX App Pairing & Selection Flow

1. **Step 1: BLE Broadcast Discovery**:
   - The user opens the BanlanX app. The phone scans for BLE advertisements carrying Manufacturer ID `20563` and model code `0x4E` [Source 6, 8].
   - When detected within range (~10 meters), the app prompts the user to add the SP530E [Source 18].
2. **Step 2: BLE GATT Connection**:
   - App connects to GATT Service `0xFFE0` and Characteristic `0xFFE1` via `com.spled.flutter_ble.FlutterBlePlugin` [Source 6, 19].
   - Queries current device telemetry and firmware version.
3. **Step 3: Wi-Fi Provisioning (Over BLE)**:
   - The app prompts for the local 2.4GHz Wi-Fi SSID and password (`/sp630e/settings/netConfig`) [Source 18, 19].
   - Credentials are written to Characteristic `0xFFE1`.
   - The ESP32-C3 associates with the Wi-Fi network, obtains a local DHCP IP address, and starts both the `SPNET` TCP server (port 8587) and mDNS responder (`_spled._tcp`) [Source 11, 18, 19].
4. **Step 4: Operational Selection**:
   - If the phone and SP530E are on the same Wi-Fi subnet, BanlanX discovers the device via `_spled._tcp` and communicates via TCP port 8587.
   - If Wi-Fi is unavailable or the phone leaves the local network, BanlanX falls back to direct BLE or Cloud relay [Source 18].

---

## 7. Evidence Citations
* **[Source 1]**: SuperLightingLED SP530E Product Page ([https://superlightingled.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFkGJg0IHyAa8_BRnuDZX7cqilyYtc0xoDd5Emv7WW2IEjO9T7vBB_0H-TveSUW47Kozmgf_sTfhIysKJwXae8uAhE3u1isBo_rjf-2SoRy9lcmykCm7h4hnt2DeCT6rg6PPJ9vZw1K5Z-OATHGkbOnOA==))
* **[Source 2]**: Official Sperll SP530E User Manual & Technical Sheet ([https://manuals.plus](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH0VTPmJa6uxbERIf5U_ofVYK9h9ikJJh67lTvAbasrG3hZUo9PRSJwbEW1ADN27cnWdbAc2losbQAIZlwRySyBu3_R6YGbAvgbP62CvPHshqReXKvuzjVoymI=))
* **[Source 3]**: LEDBE SP530E Controller Technical Datasheet ([https://ledbe.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFuqCXfp1LwQxI37E9ooHqrbjFV49LYbocJhHlDyPmSz7RCfMC1c90jIkM3RbKxMamMVADyF0YeUiB-8dhAd9CYiq0pFpbxaViCi9bK7IFLtI7D8lQHOBNRdJTRYat6mI2j-zpNugT3_kfmAakX))
* **[Source 4]**: Elektroda SP530E Teardown & ESP32-C3 Architecture ([https://elektroda.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHY3GBRaxpREpLvK2sWj3EorpIeaUqW1o2az5chmj3zX3yE5e0pEWar4_MtVGOSAI8PAkOWVTCRoNqXQDs7iweFkzmttF4YoJgoW1ERz9IPc0-XGojyb4Kv2zgVSgvUshRu6V5u2GMSQAM=))
* **[Source 5]**: ManualsPlus SP530E 12-Mode Configuration Guide ([https://manuals.plus](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFDmHZFdw3glnUQ3iJWmPhpP8fCZ4bmsAZnELdqYOJZlmqx6PGZZyu3-KkxvkMKAne_Pts-ZL_9CcxuoWnBrxUponqFH5WuoA2bafsqXZR9cYPe-JpKpyBgvyCcnQae1AOiJvPduWjxc6TUiza_92b_Oshq2ivGxg8xBj2pZjOEX-A1-d1TcWnqzNlSlGU=))
* **[Source 6]**: `phhusson/ha-banlanx` BLE GATT Specifications ([https://github.com/phhusson/ha-banlanx](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFTMhS8qX1e9Cz1spiPl6o4Trw5l3hDczlBIOOxAn7nhS30sPgSjD7YV6xeQg2GExl9GcqYUWR2dFZtSh8GyhIPCDY0NjnqYnoKyRua14FrPuCGHMsn5Sqzm3hRDBzErC9n5w==))
* **[Source 7]**: Home Assistant Community BanlanX Discussion ([https://home-assistant.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH8Tj_NMOYfRAt1aED62K_hPeMOJlK0P1PZv4di3TcE0CmDGECato7HwZTQUoMd9cgI4YZ8uVPhX-K4pYKuHIGPrwWQmU_QSUazvuYGSe9tA3sCMHlI9g97-ajKRJAYuVHLgifiY1IaKBKRAqD1Gj2XW7tbnxnG722rPvnt_n2OC9ki51v-6g==))
* **[Source 8]**: `monty68/uniled` SP530E Model Hex Code `0x4E` Mapping ([https://github.com/monty68/uniled](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFu9vRP8sAk30oHkFsiKmeMXey-9k8590EiQxwy-EuwxCEOmpD9N-_ZZzoyep9qiZ_ebeIwGYkGPbCn0d5X0R8n-PpR7eMBSED_AxcVNB6G9VPJkswysrDW3m5XnmmhnHegHH-vIg==))
* **[Source 9]**: `monty68/uniled` SPTechSig Model Signatures ([https://github.com/monty68/uniled](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHy_ZQk4TG1IhHhtR_hud-hFpo-AIeDdIkKI1cXGKQQsrECLTfVRG_B8QjvFAKO5K7fB8FKi-A1tNeno8iWUWnMrmx6hqGWaUgkboEZDozMluQB7fVRayS-lqBLIp3TXjPxLI9Pvx0=))
* **[Source 10]**: `monty68/uniled` SP630E / SP530E Single-Connection Notice ([https://github.com/monty68/uniled](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEsqnezHvGOjDLoNuXZoYLInlm-nwn_uTgLp1B8ryZ8Iy70Cbe-GaTWzJf4PjjSkSbu6tM-28pFpgoOdr5wFVJsE0PqTbJ43u80PSMmKfduY76sGt5jsJk=))
* **[Source 11]**: `monty68/uniled` SPNET Framing on TCP/UDP 8587 ([https://github.com/monty68/uniled](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFfs9pRqO7pzjwRBKVXXUzZsc-Rwo7Xiaq_PKoVUiHwJdvQjplyOBe5MiroiguefgkmkM0uKtLWlIVxkh_Z0b7M1_fUwzDp7UmRQ8ZpIvuRvPJEZQdi_3C4b0h2Qx1BH638hQ==))
* **[Source 12]**: BanlanX Network Protocol Architecture ([https://banlanx.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE5S2KPfe0Ps1p0P0Absy-ejbUPI1TRkeQPiVRdJcjwyaw6BdagTWrpJKEW0aFySiifRStd6AuM9WVessDI62_s6WLRk1Dael4yZQ==))
* **[Source 13]**: UniLED Network Scanner Port 8587 Analysis ([https://github.com/monty68/uniled](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHywIrtbtb84knw8FyZvt5QM9P0-VoLHlw_BlWI53WkDY2qx7WPG-lLU21EuWRrrSa4adj-NreMwPrJBTaWzVC0JRNTas-qoNVVWIwLGAOrV15MIYPjHhFvuOnigQ==))
* **[Source 14]**: ReReHome BanlanX Protocol Header Examination ([https://rerehome.app](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHdO3wWNDA-A3o5xHOzrq3_TEK_k2Sb84RluhtFRcIHhny82sAUhHZP7NCFWV1MuCM3uCs7xJHwKha05iRRdSOIzUGqpHovcke-vaStoEXoItRuVLuvTED9iyBNLRt6-Rw=))
* **[Source 15]**: BTF-Lighting SP630E Product Sheet ([https://btf-lighting.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEubVA_WrjOWSinJUhB2OkLIGVIiBwPca_HlUAtG1M4wDYK-PsiLBbSco8jlEmhdXUZuCJGdqWgHdBzTzxp0Sr_zvMj_I6nP1ZPqmZ8Egj0I7W_uT-SFv_96aBOS1Kis5-gz5igOppXzH39aPWv8mKk6WMqB5PLVydpSjc=))
* **[Source 16]**: UniLED GitHub Issue #144 ([https://github.com/monty68/uniled/issues/144](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGINbddXZP3YvO5lxaYaJnUw0ML-Xu2usvMVjOaFx23OFLoEkb2PbwmAc4n9BOR0BMS3MiVrKiOVCerv3DympBc0mW7mDkZwVEdkD3f_ms55qHXw5TEQjQUkMk0po12))
* **[Source 17]**: UniLED GitHub Issue #138 ([https://github.com/monty68/uniled/issues/138](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEmO0A36BYGEY9Tcqw0geXe-BD9z0Xilwxyqjcdi16troS7V2rOhm-2GM3CwbsInnHWFw5Dn3kd13s0WeUo7I7CSoEAUksBmNrATGZBpfhGAnhEoCzrlIa8weHGts31sZtACA==))
* **[Source 18]**: BanlanX Official App Setup & Pairing Guide ([https://banlanx.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGP9WJSx8jqXxyJ5ixThHuUHORJGW7YAEtQef_KY2tOO8ZShifT0llXHNOh4SHip8MrLlW3cF93Z-T2pVc606ArHeiGOBFiBhlpOHt-bVcJwtCUkExWKSHonkxyowQp-M-7thhQ))
* **[Source 19]**: Static Decompiler Inspection of `com.spled.scenex` v3.3.5 (`base.apk` / `split_config.arm64_v8a.apk` / `libapp.so`) — Confirmed mDNS service `_spled._tcp`, BLE service UUID `0000ffe0-0000-1000-8000-00805f9b34fb`, characteristic `0000ffe1-0000-1000-8000-00805f9b34fb`, and module path `/sp630e/`.
