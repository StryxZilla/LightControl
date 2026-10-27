# Universal Windows LED Controller - Desktop Application Documentation

## Overview
The Universal LED Controller desktop application is a native-feeling Windows 10/11 application built with Electron 34, React 18, TypeScript, Tailwind CSS, and Vite. It interfaces seamlessly with the underlying Universal Hardware Abstraction Layer (`@led-controller/core` and `@led-controller/adapters`), controlling both the BanlanX SP530E controller (via local Wi-Fi TCP port 8587 or WinRT BLE) and WLED devices (e.g., QuinLED dig2go via JSON HTTP/WebSocket).

---

## Architecture & Security Boundary

```
┌────────────────────────────────────────────────────────┐
│                   Electron Renderer                     │
│  React 18 + Tailwind CSS + Fluent Dark UI Components   │
│  (Sandbox: true, nodeIntegration: false)               │
└──────────────────────────┬─────────────────────────────┘
                           │ contextBridge (window.api)
┌──────────────────────────▼─────────────────────────────┐
│                   Preload Script                        │
│  Exposes strictly validated ElectronApi surface        │
└──────────────────────────┬─────────────────────────────┘
                           │ IPC Main / IPC Renderer
┌──────────────────────────▼─────────────────────────────┐
│                 Electron Main Process                  │
│  AppIpcManager with Coalesced Rate Limiting (20 Hz)   │
│  DeviceManager DI Registry                             │
│  ├─ SP530EWiFiAdapter (TCP 8587)                       │
│  ├─ SP530EBleAdapter (Windows WinRT BLE Helper)        │
│  ├─ WledAdapter (HTTP/WebSocket)                       │
│  └─ MockAdapter (Virtual Hardware Simulation)          │
└────────────────────────────────────────────────────────┘
```

### Security Posture
- **Context Isolation**: `contextIsolation: true` is strictly enforced.
- **Node Integration Disabled**: `nodeIntegration: false` in renderer.
- **Content Security Policy**: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;`
- **Safe Defaults**:
  - `dryRun: true` active on application startup until explicitly changed.
  - Maximum brightness safety cap set to **20%** across UI sliders, swatches, and preset triggers.

---

## 11 Application Screens

| Index | Screen Name | Route / Hash | Key Functionality |
|---|---|---|---|
| 1 | **Dashboard** | `#dashboard` (Ctrl+1) | Discovered controllers summary, active controller stats, quick scene cards, online status badge. |
| 2 | **Device Connection** | `#devices` (Ctrl+2) | Manual Wi-Fi IP/Port connector, auto-scan BLE & network devices, connection state details. |
| 3 | **Color Control** | `#color` (Ctrl+3) | Interactive glowing preview swatch, HEX input, quick palette, RGB channel sliders, CCT/White channel readiness. |
| 4 | **Power & Brightness** | `#power` (Ctrl+4) | Big power toggle, 20% safe brightness slider with visual safety zone indicators, quick presets (5%, 10%, 15%, 20%). |
| 5 | **Dynamic Effects** | `#effects` (Ctrl+5) | Built-in effect cards (Rainbow Flow, Color Chase, Fireplace, etc.), category filters, animation speed slider. |
| 6 | **Music Reactive** | `#music` (Ctrl+6) | Controller mic vs. auxiliary inputs, music visualizer animations, FFT sensitivity slider. |
| 7 | **Presets & Scenes** | `#presets` (Ctrl+7) | Factory safe presets (Warm White, Cyberpunk Cyan, Rainbow), custom preset creation, export/import JSON. |
| 8 | **Device Grouping** | `#grouping` (Ctrl+8) | Synchronized multi-room groups (Living Room, Studio, Whole House), unified power/brightness dispatch. |
| 9 | **Strip Configuration**| `#settings` | Pixel count configuration, RGB/GRB color order, IC model selection (WS2812B, UCS1903, SK6812), segments. |
| 10| **Diagnostics & Logs** | `#diagnostics` | Real-time IPC telemetry log stream, socket RTT latency, radio stack status, pending command queue. |
| 11| **Application Settings**| `#app-settings` | Dry-run safety toggle, brightness limit configuration, default Wi-Fi endpoints, theme settings. |

---

## Keyboard Shortcuts

- `Ctrl+1`: Switch to **Dashboard**
- `Ctrl+2`: Switch to **Device Connection**
- `Ctrl+3`: Switch to **Color Control**
- `Ctrl+4`: Switch to **Power & Brightness**
- `Ctrl+5`: Switch to **Dynamic Effects**
- `Ctrl+6`: Switch to **Music Reactive**
- `Ctrl+7`: Switch to **Presets & Scenes**
- `Ctrl+8`: Switch to **Device Grouping**
- `Ctrl+P`: Instant Toggle **Power (ON/OFF)** for selected controller

---

## Run & Build Instructions

### Workspace Commands (from repository root `G:\Light Test`)

```powershell
# Run the complete test suite (55 unit, protocol, and desktop tests)
npm test

# Build desktop production bundles (Vite renderer + esbuild electron main/preload)
npm run desktop:build

# Launch the desktop Electron application
npm run desktop:start

# Run Vite dev server for rapid browser preview / styling
npm run desktop:dev
```

### Desktop Package Commands (from `apps/desktop`)

```powershell
# Development browser preview
npm run dev

# Full production build
npm run build

# Start Electron application
npm start
```

---

## Verification & Screenshots
Automated tests and visual smoke tests verify that the UI compiles and runs without crashes.
Visual artifacts generated from live Electron window rendering:
- `research/screenshots/desktop_ui_dashboard.png` (Dashboard Screen)
- `research/screenshots/desktop_ui_color.png` (Color Control Screen)
- `research/screenshots/desktop_ui_effects.png` (Dynamic Effects Browser)
- `research/screenshots/desktop_ui_diagnostics.png` (Diagnostics & Logs Stream)
