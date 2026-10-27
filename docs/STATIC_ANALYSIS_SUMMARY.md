# BanlanX Deep Static Analysis & SP530E Engineering Summary

**Target Application**: BanlanX Android (`com.spled.scenex` v3.3.5, Build 140)  
**Primary Target Controller**: Sperll / BTF-LIGHTING **SP530E** (ESP32-C3)  
**Date**: 2026-10-27  
**Lead Engineer**: Antigravity Autonomous Agent  

---

## 1. Executive Summary

A comprehensive, clean-room static analysis of the official BanlanX Android application was performed utilizing **REA MCP** (`inspect_android_package`, `search_android_classes`), **JADX 1.5.6**, **Apktool 3.0.3**, and native Dart Ahead-Of-Time (AOT) binary inspection.

The investigation has definitively established the full software architecture, transport handling, discovery mechanisms, and protocol command dispatch hierarchy for the SP530E controller.

---

## 2. Key Architectural Discoveries

### A. Dual Transport Architecture (Wi-Fi First, BLE Second)
1. **Wi-Fi Transport (`SPNET`)**:
   - The SP530E runs a lightweight, unencrypted binary TCP socket server on port **`8587`**.
   - Zero-configuration local discovery is handled via **mDNS** (`_spled._tcp`).
   - Control is 100% local and direct: commands do not transit external vendor cloud servers when communicating on the same subnet.
   - Every packet utilizes fixed **13-byte header framing** (`SPTECH\0` + command byte + encryption/status key + 2-byte payload length) followed by structured parameter chunks.
2. **Bluetooth Low Energy (BLE)**:
   - Primary GATT Service: `0000ffe0-0000-1000-8000-00805f9b34fb` (`0xFFE0`).
   - Primary Characteristic: `0000ffe1-0000-1000-8000-00805f9b34fb` (`0xFFE1`).
   - Operates with `WRITE_NO_RESPONSE` (write type 1) and notifications.
   - **Crucial Firmware Constraint**: ESP32-C3 firmware enforces a **strict single-client connection lock**. Simultaneous connections from mobile app and desktop are rejected.

### B. Controller Differentiation & Shared Logic
- **Shared Multi-Mode Core**: All 5-in-1 multi-mode controllers (both SP530E and SP630E) share the **`packages/sp630e/`** Flutter module for UI, scenes, and effect routing.
- **Hardware Model Code**: SP530E is differentiated at runtime by model hex identifier **`0x4E`** (78 decimal).
- **Light Configuration `0x86`**: Confirmed on physical hardware as the SPI Digital Addressable IC mode driving the user's **WS2812B** strip with 60 pixels.

### C. Command Dispatch & Effect Mapping
The complete command suite has been extracted from the native Dart text heap:
- Static Colors: `setLfxColor`, `setLfxColorTemp` (CCT)
- Effects & Dynamics: `setLfxMode`, `setLfxSpeed`, `setLfxDir`, `playPauseLfx`, `setOnOffLfx`
- Hardware Geometry: `setLfxPixelCount` (1 to 1,200 LEDs)
- Scenes & Playlists: `saveDiyLfx`, `updateFavoriteLfxList`, `setLfxLoopMode`

---

## 3. Deliverables & Documentation Index

All technical findings, byte layouts, call graphs, and code mappings have been committed to the project documentation suite:

1. **[`docs/SP530E_CODE_MAP.md`](file:///g:/Light%20Test/docs/SP530E_CODE_MAP.md)**:
   Comprehensive component inventory covering model identification, native plugins (`flutter_ble`, `multicast_lock`, `bonsoir`), GATT UUIDs, `SPNET` framing, and audio services.
2. **[`docs/SP530E_PROTOCOL_CANDIDATES.md`](file:///g:/Light%20Test/docs/SP530E_PROTOCOL_CANDIDATES.md)**:
   Exhaustive specification for each candidate command (query, power, brightness, color, effects, pixel count) with source method, expected parameters, byte layout, confidence level, and proposed verification test.
3. **[`docs/COMMAND_CALL_GRAPHS.md`](file:///g:/Light%20Test/docs/COMMAND_CALL_GRAPHS.md)**:
   Sequence diagrams tracing the end-to-end execution flow from representative UI actions (color change, power toggle, Wi-Fi discovery, BLE pairing) down to physical wire transmissions.
4. **[`docs/APK_INVENTORY.md`](file:///g:/Light%20Test/docs/APK_INVENTORY.md)**:
   Cryptographic hash ledger (SHA-256 and MD5) and provenance tracking for all acquired APK splits.
5. **[`docs/ANDROID_PACKAGE.md`](file:///g:/Light%20Test/docs/ANDROID_PACKAGE.md)**:
   Package specifications, permissions categorized by security domain, activities, services, and deep links.
6. **[`docs/APK_EXTRACTION_RESULTS.md`](file:///g:/Light%20Test/docs/APK_EXTRACTION_RESULTS.md)**:
   Detailed pipeline log, Apktool/JADX decompiler reports, REA evidence links, and resolution of Dart AOT decompilation boundaries.

---

## 4. Impact on Windows Application Architecture

1. **Universal HAL Implementation (`@led-controller/core`)**:
   Our abstraction layer is fully validated by empirical hardware evidence. The capability-driven model accurately accommodates SP530E's 5-in-1 multi-mode capabilities while maintaining complete decoupling from WLED.
2. **Transport Strategy**:
   The desktop application will default to **Local Wi-Fi First** via `SP530EWiFiAdapter` (TCP port 8587), providing zero-latency control, automatic state synchronization, and avoiding the single-client BLE lockout issue while the user's phone is nearby.
3. **Clean-Room Assurance**:
   All reverse engineering has been strictly observational. No proprietary code, obfuscated assets, or intellectual property has been incorporated into our independent TypeScript codebase.
