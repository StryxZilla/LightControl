# LightControl — Universal Windows Desktop LED Controller

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-34.5.8-47848F.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://react.dev/)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011%20x64-0078D6.svg)](https://www.microsoft.com/windows)
[![Tests](https://img.shields.io/badge/Tests-75%20Passing-brightgreen.svg)]()
[![Release](https://img.shields.io/badge/Release-Portable%20x64%20(No%20Installer)-orange.svg)](https://github.com/StryxZilla/LightControl/releases)

**LightControl** is a modern, responsive Windows 10/11 desktop application and universal Hardware Abstraction Layer (HAL) engineered for independently controlling smart addressable LED controllers without proprietary cloud dependencies or mobile apps.

---

## 🌟 Supported Hardware & Transports

| Controller | Transports | Protocol | Status |
| :--- | :--- | :--- | :--- |
| **BanlanX SP530E** | **Local Wi-Fi (LAN)** | Unauthenticated binary TCP (`SPNET` port 8587) | ✅ **Confirmed on Physical Hardware** (sub-50ms latency) |
| **BanlanX SP530E** | **Bluetooth Low Energy** | GATT Service `0xFFE0` / Char `0xFFE1` via WinRT BLE | ✅ **Verified Driver & Codec** (Single-client BLE fallback) |
| **QuinLED dig2go** | **Local Wi-Fi / LAN** | Official WLED JSON REST API + RFC 6455 WebSocket | ✅ **Simulator-Verified** (Dynamic effects, audio reactive, palettes) |
| **Standard WLED** | **Local Wi-Fi / LAN** | WLED v0.14+ JSON API (`/json/state`, `/json/info`) | ✅ **Verified** (Multi-segment zoning, presets, playlists) |
| **Mock Simulator** | **In-Memory** | Synthetic device simulator | ✅ **Active** (Full offline UI development & CI testing) |

---

## ✨ Features

- **Zero-Installer Portable Executable**: Runs directly as a single portable Windows executable (`LightControl-Portable.exe`). No installation, no setup wizards, no UAC prompts, and **zero Node.js prerequisites** on target systems.
- **Persistent State**: Stores settings, controller pairings, and custom presets in `%APPDATA%\LightControl\settings.json`, ensuring state survives across portable executable runs.
- **11 Windows-Native UI Screens**:
  1. **Dashboard**: Live device overview, online counters, mode badges, quick scene triggers.
  2. **Device Connection**: Local Wi-Fi socket connector (SP530E TCP 8587), WLED connector (HTTP 80), and automatic network discovery.
  3. **Color Control**: Real-time glowing preview, hex input, primary color swatches, RGB sliders, and CCT/white channel sliders.
  4. **Power & Brightness**: Master toggle, safety brightness slider, quick percentage buttons (10%, 20%, 50%, 100%).
  5. **Effects Browser**: Built-in effect cards, animation categories, live speed and direction controls.
  6. **Music Reactive**: Sound-reactive visualizer with internal mic vs. auxiliary audio modes and sensitivity controls.
  7. **Presets & Scenes**: Factory safe presets, user-defined presets, and JSON preset export/import.
  8. **Device Grouping**: Multi-room controller grouping and synchronized multi-device dispatch.
  9. **Device Settings**: Pixel counts, RGB/GRB color ordering, IC driver selection (WS2812B, UCS1903, SK6812), and segment zoning.
  10. **Diagnostics & Telemetry**: Live IPC telemetry log stream, socket RTT latency measurements, radio stack monitors.
  11. **Application Settings**: Dry-run mode safety toggle, hardware safety brightness limit, default host/port.
- **Microcontroller Safety & Coalescing**:
  - **Hardware Brightness Cap**: Default 20% brightness safety limit prevents LED strip power supply overdraw.
  - **Rate Limiting Engine**: Central 20 Hz (50 ms) command coalescing prevents hardware buffer overruns during rapid slider adjustments.
  - **Optimistic Rollback**: Automatic UI rollback if a physical controller rejects or drops a command.

---

## 🚀 Quick Start (Portable Executable)

1. Download **`LightControl-Portable.exe`** from the [Latest Release](https://github.com/StryxZilla/LightControl/releases).
2. Double-click to launch (no installer needed).
3. If Windows SmartScreen appears (*"Windows protected your PC"*), click **More info** ➔ **Run anyway**.
4. In the **Device Connection** tab (`Ctrl+2`), enter your controller's IP address and connect (see the [Device Pairing Guide](docs/PAIRING_GUIDE.md) for full instructions).

For detailed step-by-step pairing instructions for BanlanX SP530E (Wi-Fi & BLE) and QuinLED dig2go/WLED, refer to **[`docs/PAIRING_GUIDE.md`](docs/PAIRING_GUIDE.md)**.

---

## 🛠️ Architecture & Monorepo Structure

```text
LightControl/
├── apps/
│   ├── desktop/            # Electron 34 + React 18 + Vite 6 desktop UI
│   │   ├── src/main/       # Electron main process, secure IPC, settings persistence
│   │   ├── src/preload/    # Sandboxed ContextBridge API (nodeIntegration: false)
│   │   └── src/renderer/   # React 18 dark-mode interface (11 screens)
│   └── test-harness/       # Standalone diagnostic test CLI
├── packages/
│   ├── core/               # Hardware Abstraction Layer (HAL), State & Rate Limiter
│   └── adapters/           # SP530E (Wi-Fi & BLE), WLED, and Mock adapters
│       └── src/sp530e/ble-helper/ # Native C#/.NET WinRT BLE IPC helper
├── protocol/fixtures/      # Real-hardware binary captures & validated JSON schemas
├── scripts/                # Automated packaging and icon generation scripts
├── tests/                  # 75 unit, adapter, protocol, and security test suites
└── docs/                   # Full reverse engineering & architecture documentation
```

---

## 💻 Developer Setup & Build

### Prerequisites
- Windows 10 (1903+) or Windows 11 (x64)
- Node.js 22+ (tested on Node.js 24)
- .NET Framework 4.6.2+ (standard on Windows 10/11)

### Installation
```bash
git clone https://github.com/StryxZilla/LightControl.git
cd LightControl
npm install
```

### Running Test Suite
Execute the full test suite (75 tests):
```bash
npm test
```

### Running in Development
Start Vite development server and launch Electron with Hot Module Replacement:
```bash
npm run dev:desktop
```

### Building the Single Portable .exe
Generate `release/LightControl-Portable.exe`:
```powershell
powershell -ExecutionPolicy Bypass -File "scripts/build-portable.ps1"
```
*Or via npm:*
```bash
npm run package:portable
```

---

## 📚 Documentation Index

- **[`docs/PAIRING_GUIDE.md`](docs/PAIRING_GUIDE.md)** — **Step-by-step controller pairing & connection guide for SP530E & WLED/dig2go.**
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Comprehensive HAL architecture, data flow, and IPC design.
- [`docs/PORTABLE_BUILD.md`](docs/PORTABLE_BUILD.md) — Portable build guide, electron-builder configuration, and troubleshooting.
- [`docs/SP530E_WIFI_PROTOCOL.md`](docs/SP530E_WIFI_PROTOCOL.md) — Clean-room reverse engineering specification for SP530E TCP 8587 protocol.
- [`docs/SP530E_COMMAND_REGISTRY.md`](docs/SP530E_COMMAND_REGISTRY.md) — Verified opcode mapping across BLE and Wi-Fi transports.
- [`docs/WLED_IMPLEMENTATION.md`](docs/WLED_IMPLEMENTATION.md) — WLED JSON and WebSocket protocol integration details.
- [`docs/DIG2GO_HARDWARE_TEST_PLAN.md`](docs/DIG2GO_HARDWARE_TEST_PLAN.md) — Validation test plan for QuinLED dig2go hardware.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — Architectural Decision Records (ADRs).

---

## 🔒 Security & Privacy Notice

- **Clean-Room Interoperability**: Reverse-engineered protocol structures were developed strictly for interoperability with user-owned hardware. No proprietary code, binaries, or assets from third-party mobile applications are distributed.
- **Local Network Exclusivity**: Zero telemetry or traffic is sent to external cloud servers. All communication occurs strictly within your local LAN or direct Bluetooth range.

---

## 📄 License

Licensed under the MIT License. See [LICENSE](LICENSE) for details.
