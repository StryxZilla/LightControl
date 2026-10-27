# Android Package Specification & Metadata

**Package Name**: `com.spled.scenex`  
**Application Label**: BanlanX  
**Official Developer**: Shenzhen Sperll Optoelectronic Technology Co., Ltd.  
**Version**: `3.3.5` (Build `140`)  
**SDK Target**: Android 16 (API Level 36, compileSdkVersion 36)  
**Minimum SDK**: Android 7.0 (API Level 24)  
**Primary Architecture**: `arm64-v8a`  

---

## 1. Application Architecture & Framework

The BanlanX Android application is constructed using a hybrid architecture:
- **Core UI & Logic**: Built with **Flutter (Embedding v2)**.
- **Dart Runtime**: Uses Dart Ahead-Of-Time (AOT) compiled native snapshots packaged inside native shared libraries (`libapp.so` and `libflutter.so`).
- **Native Android Plugins**: Registered via `io.flutter.plugins.GeneratedPluginRegistrant`, wrapping platform APIs for Bluetooth Low Energy, audio capture, permissions, and network sockets.

---

## 2. Permissions Inventory & Security Domains

The package declares 16 distinct permissions, mapped below to functional device capabilities:

### A. Bluetooth & Hardware Peripheral Control
| Permission | Target SDK Policy | Justification / Hardware Role |
| :--- | :--- | :--- |
| `android.permission.BLUETOOTH` | maxSdkVersion=30 | Legacy BLE peripheral communication |
| `android.permission.BLUETOOTH_ADMIN` | maxSdkVersion=30 | Legacy BLE scanning and connection management |
| `android.permission.BLUETOOTH_SCAN` | `neverForLocation` | Modern Android 12+ BLE device scanning without location access |
| `android.permission.BLUETOOTH_CONNECT` | Runtime Required | Modern Android 12+ GATT connection establishment to `0xFFE0` |
| `android.hardware.bluetooth_le` | Hardware Feature | Hardware feature declaration: controller requires BLE 4.0+ |

### B. Wi-Fi & Local Network Control
| Permission | Type | Justification / Role |
| :--- | :--- | :--- |
| `android.permission.INTERNET` | Install | Cloud telemetry and local TCP/UDP socket creation on port 8587 |
| `android.permission.ACCESS_NETWORK_STATE` | Install | Detects network availability (Wi-Fi vs Cellular) |
| `android.permission.ACCESS_WIFI_STATE` | Install | Inspects Wi-Fi connection info and SSID |
| `android.permission.CHANGE_WIFI_MULTICAST_STATE` | Install | **Critical**: Allows Android to acquire `MulticastLock`, enabling mDNS Zeroconf resolution of `_spled._tcp` on local LAN |

### C. Audio & Music-Reactive Lighting
| Permission | Type | Justification / Role |
| :--- | :--- | :--- |
| `android.permission.RECORD_AUDIO` | Runtime Required | Captures live microphone audio for music-reactive LED effects |
| `android.permission.READ_MEDIA_AUDIO` | Runtime Required | Reads local audio files for music player sync |
| `android.permission.FOREGROUND_SERVICE` | Install | Keeps music processing alive when screen is off |
| `android.permission.FOREGROUND_SERVICE_MICROPHONE` | Android 14+ Required | Declares foreground service type specifically for microphone access |

### D. System & Storage
| Permission | Type | Justification / Role |
| :--- | :--- | :--- |
| `android.permission.ACCESS_FINE_LOCATION` | Runtime | Required for BLE scanning on Android 6.0 to 11 |
| `android.permission.READ_EXTERNAL_STORAGE` | maxSdkVersion=32 | Legacy media file access on Android 12 and below |
| `android.permission.WAKE_LOCK` | Install | Prevents CPU sleep during active light shows or firmware updates |
| `com.spled.scenex.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | Signature | Android 14+ non-exported broadcast receiver security |

---

## 3. Registered Application Components

### A. Activities
1. **`com.spled.scenex.MainActivity`** (Exported: `true`, Launch Mode: `singleTask`):
   - Entry point for Flutter application.
   - Handles deep links:
     - Scheme: `https://app.ledhue.com` (AutoVerify enabled)
     - Scheme: `spledlinks://`
2. **`com.yalantis.ucrop.UCropActivity`** (Exported: `false`): Image cropping utility for custom scene icons.
3. **`io.flutter.plugins.urllauncher.WebViewActivity`** (Exported: `false`): In-app browser for web manuals and support.
4. **`com.google.android.gms.common.api.GoogleApiActivity`** (Exported: `false`): Google Play Services integration.

### B. Services
1. **`com.spled.audio_recorder.core.AudioRecordForegroundService`** (Exported: `false`, Foreground Type: `microphone`):
   - Native audio sampling daemon used for real-time mobile mic FFT analysis and music-reactive strip synchronization.
2. **`com.google.android.gms.metadata.ModuleDependencies`** (Exported: `false`): Photopicker module dependencies.
3. **`com.google.android.gms.auth.api.signin.RevocationBoundService`** (Exported: `true`): Google account token revocation.

### C. Content Providers
1. **`io.flutter.plugins.imagepicker.ImagePickerFileProvider`**: Authority `com.spled.scenex.flutter.image_provider`.
2. **`androidx.startup.InitializationProvider`**: Authority `com.spled.scenex.androidx-startup`.
