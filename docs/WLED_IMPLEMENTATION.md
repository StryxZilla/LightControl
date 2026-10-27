# WLED Device Integration & Architecture Reference

## Overview
This document details the universal WLED adapter implementation within the Windows 10/11 LED Controller architecture (`@led-controller/adapters/wled`). The adapter provides unified control over any standard WLED device (versions 0.11+ through 0.14/0.15+) and is tailored for upcoming compatibility with the **QuinLED dig2go** addressable LED controller.

---

## Architectural Principles & Separation of Concerns

```
┌─────────────────────────────────────────────────────────────────┐
│               Universal Hardware Abstraction Layer               │
│                        (ILedDevice / ILedAdapter)               │
└───────────────┬─────────────────────────────────┬───────────────┘
                │                                 │
┌───────────────▼─────────────────┐ ┌─────────────▼───────────────┐
│       BanlanX / SP530E          │ │        WLED / QuinLED       │
│  - Proprietary SPNET TCP (8587) │ │  - Open Standard HTTP REST  │
│  - WinRT BLE GATT               │ │  - Real-Time WebSocket (/ws)│
│  - Checksummed Binary Packets   │ │  - Dynamic Effect/Palettes  │
│  - 0x53 0x50 0x54 0x45 0x43 0x48│ │  - JSON State / Info API    │
└─────────────────────────────────┘ └─────────────────────────────┘
```

1. **Protocol Exclusivity**: WLED logic is fully decoupled from BanlanX/SP530E. No opcodes, checksum algorithms, or framing headers are shared.
2. **Zero Hardcoded Effect IDs**: All effects and palettes are queried dynamically via `/json/eff`, `/json/pal`, or `/json`. Effects lists adapt dynamically across WLED firmware revisions (e.g. 180+ effects in v0.14+).
3. **Dual-Transport Reliability**:
   - **HTTP REST (`/json/state`)**: Synchronous command dispatch with guaranteed HTTP 200/400 validation.
   - **WebSocket (`ws://<ip>/ws`)**: Non-blocking real-time bidirectional push notification channel for instant state synchronization.

---

## QuinLED dig2go Hardware Profile

The **QuinLED dig2go** is a compact ESP32-based addressable LED controller engineered specifically for WLED:

| Feature | Specification | Universal Adapter Support |
|---|---|---|
| **MCU** | ESP32 Dual-Core @ 240 MHz, 4MB Flash | Verified via `info.arch === "esp32"` |
| **Firmware** | Sound-Reactive WLED pre-installed | Detected via `btype: "soundreactive"` or `product: "dig2go"` |
| **Power Budget** | USB-C 5V @ up to 3A (15W Max) | Safe default brightness limits respected |
| **Relay Circuit** | Onboard MOSFET hard-off | Fully supported via `setPower(false)` (`{"on": false}`) |
| **Microphone** | Digital MEMS ICS-43434 | Sound-reactive modes enabled dynamically |
| **LED Channels** | 5V level-shifted data output (~300 LEDs) | Default max pixel ceiling dynamically configured |
| **Buttons / Inputs** | Onboard tactile button, IR receiver | State changes pushed to app via WebSocket |

---

## API Endpoints & Transport Details

### 1. HTTP JSON Endpoints
- `GET /json`: Comprehensive single-call retrieval containing `{ state, info, effects, palettes }`.
- `GET /json/state`: Current lighting state (power, brightness, segments, active preset/playlist).
- `POST /json/state`: Dispatches JSON mutations; returns `{ success: true, ... }`.
- `GET /json/info`: Controller hardware, network, and firmware metadata.
- `GET /json/eff`: Array of all available effect names.
- `GET /json/pal`: Array of all available palette names.
- `GET /presets.json`: Full preset database stored in controller flash memory.

### 2. WebSocket Protocol (`/ws`)
- **Handshake**: Standard RFC 6455 upgrade on `ws://<ip>:<port>/ws`.
- **Initial Telemetry**: Server immediately emits `{ state: {...}, info: {...} }` upon socket establishment.
- **State Push**: Any state change (whether from the physical dig2go button, IR remote, web UI, or automation) triggers an unprompted state frame broadcast to all connected WebSocket clients.
- **Heartbeat**: Periodic application-level ping (`p`) to which WLED responds (`pong`).
- **Verbose Query**: Sending `{"v": true}` requests an immediate full state telemetry frame.

---

## Universal HAL Mapping Matrix

| Universal HAL Operation | WLED JSON Payload Structure | WebSocket Event / Response |
|---|---|---|
| `setPower(true / false)` | `{"on": boolean}` | State push: `{"state": {"on": ...}}` |
| `setBrightness(0..100)` | `{"bri": Math.round(bri / 100 * 255)}` | State push: `{"state": {"bri": ...}}` |
| `setColor({ r, g, b, w? })` | `{"seg": [{"id": 0, "col": [[r, g, b, w?]]}]}` | State push: `{"state": {"seg": [...]}}` |
| `setEffect(id, speed, ix, pal)`| `{"seg": [{"id": 0, "fx": id, "sx": sx, "ix": ix, "pal": pal}]}` | State push with updated `fx` / `sx` |
| `setSegments(segments[])` | `{"seg": [{"id": 0, "start": 0, "stop": 150}, ...]}` | Segment array synchronized |
| `applyPreset(presetId)` | `{"ps": presetId}` | Active preset indicator updated |
| `savePreset(presetId, name)` | `{"psave": presetId, "n": name, ...state}` | Stored in `/presets.json` |
| `deletePreset(presetId)` | `{"pdel": presetId}` | Removed from `/presets.json` |
| `applyPlaylist(ids, dur, rep)` | `{"playlist": {"ps": ids, "dur": dur, "repeat": rep}}` | Multi-preset loop initiated |

---

## Error Handling, Backoff & Resilience

1. **Exponential WebSocket Reconnection**:
   - Initial retry: 1,000 ms
   - Exponential multiplier: $2^n$ up to a maximum cap of 16,000 ms.
   - Max retry attempts: 6 attempts before waiting for manual or event-driven triggers.
2. **Non-Blocking Timers**:
   - All internal timers (`wsReconnectTimer`, `wsHeartbeatTimer`) execute with `.unref()`, allowing Node.js processes and tests to cleanly terminate without hanging.
3. **HTTP Fallback**:
   - In the event of network dropouts or WebSocket failure, state mutation calls fall back seamlessly to synchronous HTTP POST requests with a 3,000 ms abort timeout.
4. **Heartbeat Health Monitoring**:
   - 15-second heartbeat intervals ensure stale sockets are identified and cycled.

---

## Simulator Testing & Mock Server

Since physical QuinLED dig2go hardware is pending shipment, testing is conducted using a zero-dependency local mock server:
- `tests/wled/wled-mock-server.ts`: Fully compliant RFC 6455 WebSocket upgrade and HTTP REST server simulating a QuinLED dig2go controller with 300 pixels, sound-reactive audio capabilities, 82 effects, and 45 palettes.
- **Test Results**:
  - `tests/wled/wled-codec.test.ts`: 7 passing tests
  - `tests/wled/wled-adapter.test.ts`: 6 passing tests
  - `tests/wled/wled-websocket.test.ts`: 3 passing tests
  - **Overall Project Suite**: **71 tests passing in 780 ms (`npm test`)**
