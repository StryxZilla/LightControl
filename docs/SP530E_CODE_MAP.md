# SP530E Decompiled Code Map & Component Ledger

**Target Device**: BanlanX SP530E 5-in-1 IoT LED Controller  
**Decompiled Source**: `com.spled.scenex` v3.3.5 (Build 140)  
**Tools Employed**: JADX 1.5.6, REA MCP (`jadx-headless-mcp` 0.7.1), Apktool 3.0.3, Native Dart Binary Inspection  
**Status**: Complete Architectural & Protocol Mapping  

---

## 1. Controller Identification & Model Detection Logic

| Identification Attribute | Location / Source | Value / Signature | Purpose & Behavior |
| :--- | :--- | :--- | :--- |
| **Model Hex Code** | `lib/net/sp53x_54xe.py`, Dart Model Tables | **`0x4E`** (78 decimal) | Unique hardware model identifier distinguishing SP530E from other BanlanX units. |
| **Manufacturer BLE ID** | Android BLE Advertisements | `20563` (`0x5053` - ASCII `"SP"`) | Populated in 16-bit Manufacturer Specific Data in BLE advertising frames. |
| **mDNS Service Type** | `com.spled.scenex:libapp.so` @ `0xb960a` | **`_spled._tcp`** | Advertised on local 2.4GHz network by ESP32-C3 firmware for zero-config discovery. |
| **Shared Multi-Mode Module** | Flutter Asset Manifest & Routes | **`packages/sp630e/`** | BanlanX unifies all 5-in-1 multi-mode controllers (SP530E & SP630E) under the `sp630e` Flutter module. |
| **SharedPreferences Storage Key** | `libapp.so` @ `0x559fd` | **`sp530e:diy_gradient_colors_`** | Device-specific local persistence key for user-defined gradient color presets. |

---

## 2. Bluetooth Low Energy (BLE) Transport Layer

### 2.1 Native Android Plugin Structure
- **Plugin Registry**: `io.flutter.plugins.GeneratedPluginRegistrant` lines 74-77.
- **Native Implementation**: Obfuscated package `C2.a` implementing `Z2.b` (`FlutterPlugin`).
- **Method Channel**: **`com.spled.plugins/flutter_ble/main`**
- **Event Channels (Telemetry & State Streams)**:
  - `com.spled.plugins/flutter_ble/bluetooth_adapter_state_changed`
  - `com.spled.plugins/flutter_ble/bluetooth_device_discovery_state_changed`
  - `com.spled.plugins/flutter_ble/bluetooth_device_found`
  - `com.spled.plugins/flutter_ble/ble_connection_state_changed`
  - `com.spled.plugins/flutter_ble/ble_characteristic_value_changed`

### 2.2 Native BLE Dispatch Handlers (`E2.d` & `E2.l`)
| Method Name | Handler Class | Parameter Signature | Underlying Android OS API |
| :--- | :--- | :--- | :--- |
| `openBluetoothAdapter` | `E2.d` | none | `BluetoothAdapter.enable()` |
| `closeBluetoothAdapter` | `E2.d` | none | `BluetoothAdapter.disable()` |
| `getBluetoothAdapterState` | `E2.d` | none | `BluetoothAdapter.getState()` |
| `startBluetoothDevicesDiscovery` | `E2.l` | `services`, `interval`, `clearPreDiscoveredDevices`, `aliveTime` | `BluetoothLeScanner.startScan()` |
| `stopBluetoothDevicesDiscovery` | `E2.l` | none | `BluetoothLeScanner.stopScan()` |
| `getBluetoothDevices` | `E2.l` | none | Internal discovered device cache |
| `createBleConnection` | `E2.d` | `deviceId` (MAC), `timeout` | `BluetoothDevice.connectGatt(..., false, ..., 2)` |
| `closeBleConnection` | `E2.d` | `deviceId` | `BluetoothGatt.disconnect()`, `BluetoothGatt.close()` |
| `requestMtu` | `E2.d` | `deviceId`, `value` (int) | `BluetoothGatt.requestMtu(int)` |
| `getBleDeviceServices` | `E2.d` | `deviceId` | `BluetoothGatt.getServices()` |
| `getBleDeviceCharacteristics` | `E2.d` | `deviceId`, `serviceUuid` | `BluetoothGattService.getCharacteristics()` |
| `notifyBleCharacteristicValueChange`| `E2.d` | `deviceId`, `serviceUuid`, `characteristicUuid`, `enabled` | `BluetoothGatt.setCharacteristicNotification()`, CCCD write |
| `writeBleCharacteristicValue` | `E2.d` | `deviceId`, `serviceUuid`, `characteristicUuid`, `value` (byte[]), `characteristicWriteType`, `forceWaitResponse` | `BluetoothGatt.writeCharacteristic()` |

### 2.3 GATT UUID Profile
- **Primary Service UUID**: `0000ffe0-0000-1000-8000-00805f9b34fb` (`0xFFE0`)
- **Characteristic UUID**: `0000ffe1-0000-1000-8000-00805f9b34fb` (`0xFFE1`)
  - Properties: `WRITE_NO_RESPONSE`, `WRITE`, `NOTIFY`
- **Single-Client Lock**: Enforced in ESP32-C3 firmware. Simultaneous BLE links are rejected.

---

## 3. Wi-Fi Local Network Transport Layer (`SPNET`)

### 3.1 Network Discovery & Multicast Lock
- **Android Manifest Permission**: `android.permission.CHANGE_WIFI_MULTICAST_STATE`
- **Native Helper**: `com.spled.multicast_lock.MulticastLockPlugin` (`H2.a`)
  - Channel: `com.spled.plugins/multicast_lock`
  - Acquires `WifiManager.MulticastLock("discovery")` to bypass Android OS multicast filtering.
- **mDNS Resolver Plugin**: `fr.skyost.bonsoir.BonsoirPlugin` (`P2.b` / `P2.f`)
  - Channel: `fr.skyost.bonsoir`
  - Listens for mDNS PTR/SRV records matching **`_spled._tcp`**.
  - Returns controller IP address and control port (**`8587`**).

### 3.2 Local vs. Cloud Architecture
- **Local Control Path**:
  - Direct TCP connection opened to `<Controller-IP>:8587`.
  - Zero authentication or cloud token required for local LAN control.
  - Commands and telemetry use unencrypted binary `SPNET` framing (`SPTECH\0`).
- **Cloud Control Path**:
  - HTTP / REST API endpoint observed in deep links: `app.ledhue.com`.
  - Used strictly for remote away-from-home control, account scenes, and firmware distribution.
  - When on the same subnet, BanlanX prioritizes direct local socket communication.

---

## 4. Protocol Framing & Packet Structure

### 4.1 Fixed 13-Byte Header Layout
```text
Offset (Hex)  Size (Bytes)  Field Name        Description / Representation
------------------------------------------------------------------------------------------------
0x00 - 0x05   6 bytes       Magic Prefix      ASCII "SPTECH" (Hex: 53 50 54 45 43 48)
0x06          1 byte        Null Terminator   0x00
0x07          1 byte        Message Type      0x01 = Heartbeat, 0x02 = State Query/Reply, 0x03 = Set State
0x08          1 byte        Encryption Key    0x58 (Query request), 0x00 (Unencrypted response)
0x09          1 byte        Total Packets     0x00 (Single-packet frame over local network)
0x0A          1 byte        Packet Number     0x00 (First packet index)
0x0B - 0x0C   2 bytes       Payload Length    uint16 Big-Endian (Payload byte count)
[0x0D ...]    N bytes       Payload Data      Structured parameter chunks
```

### 4.2 State Chunk Structure (Captured in `protocol/fixtures/sp530e_status_response.bin`)
- **Chunk 0x01 (Hardware & Configuration Chunk - 21 Bytes)**:
  - `payload[0..1]`: Chunk Type & Subtype (`0x01 0x01`)
  - `payload[2..3]`: Chunk Length (`0x0011` = 17 bytes)
  - `payload[6..13]`: ASCII Firmware string (`"V2.0.13 "`)
  - `payload[14]`: Light Type code (`0x86` for WS2812B addressable IC)
  - `payload[15]`: On/Off transition effect code (`0x03`)
  - `payload[16]`: On/Off transition speed (`0x03`)
  - `payload[17..18]`: Total configured pixel count (`0x003C` = 60 pixels)
  - `payload[19..20]`: Total configured segment count (`0x0001` = 1 segment)
- **Chunk 0x03 (Real-Time Operating State)**:
  - `data[40]`: Power status (`0x01` = ON, `0x00` = OFF)
  - `data[43]`: Active effect / mode ID
  - `data[45..47]`: Active Color RGB channels (`0xFFFFFF`)
  - `data[47]`: Brightness value (`0x00` - `0xFF`, 0 - 255)
  - `data[376..389]`: Self-reported device IP address ASCII (`"192.168.86.34\0"`)

---

## 5. Dart AOT Lighting Effect & Command Method Catalog

Discovered directly from the native Dart text heap in `libapp.so`:

| Dart Method Name | Binary Offset | Parameters Extracted | Functional Role |
| :--- | :--- | :--- | :--- |
| **`setLfxColor`** | `0x10b6a8` | `Color color`, `channels`, `isPWM` | Sets solid static color channels (RGB, RGBW, RGBCCT). |
| **`setLfxColorTemp`**| `0x190085` | `int colorTemp` (Kelvin), `brightness` | Sets CCT / warm-cool dual white balance. |
| **`setLfxMode`** | `0x13d0bd` | `int modeId`, `channels` | Sets built-in dynamic effect preset. |
| **`setLfxSpeed`** | `0x60c7c` | `int speed` (1 - 100) | Adjusts effect animation speed. |
| **`setLfxDir`** | `0xc3bb3` | `LfxDirection dir` (forward / reverse) | Sets direction of pattern flow along the strip. |
| **`playPauseLfx`** | `0x150993` | none / toggle | Pauses or resumes dynamic animation playback. |
| **`setOnOffLfx`** | `0x152ed9` | `int effect`, `int speed` | Configures fade-in / fade-out power transitions. |
| **`setLfxPixelCount`**|`0x127460` | `int count` (1 - 1200) | Sets addressable pixel length. |
| **`setLfxLoopMode`** | `0xe4fb3` | `LfxLoopMode mode` | Loops current effect or iterates all favorite scenes. |
| **`setLfxGradient`** | `0x186ba7` | `List<Color> colors`, `LfxDirection` | Sets custom multi-point color gradient animation. |
| **`saveDiyLfx`** | `0xbad03` | `DiyLfx effect` | Commits custom user scene to controller memory. |
| **`resetLfx`** | `0x1d3908` | none | Resets lighting patterns to factory defaults. |
| **`updateFavoriteLfxList`**|`0x1cf860`| `List<int> effectIds` | Updates the round-robin playlist of favorite effects. |

---

## 6. Audio Reactive & Music Pipeline

- **Native Sampling Service**: `com.spled.audio_recorder.core.AudioRecordForegroundService`
  - Runs with `android:foregroundServiceType="microphone"`.
  - Captures raw PCM audio from Android device microphone when host audio mode is selected.
- **Microphone Input Modes**:
  1. `ic_inner_mic_selected`: Onboard physical microphone on the SP530E controller.
  2. `ic_mobile_mic_selected`: Smartphone / Host microphone streaming PCM FFT data.
  3. `ic_player_selected`: Media player audio stream sync.
- **Audio Assets**: Bundled sound triggers for gesture/clap reactivity (`whistle.mp3`, `snap_fingers.mp3`).
