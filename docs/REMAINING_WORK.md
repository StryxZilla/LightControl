# Remaining Work & Strategic Roadmap

This document outlines the remaining engineering milestones, planned enhancements, and hardware test schedules for the Universal Windows 10/11 LED Controller project.

---

## Prioritized Milestone Roadmap

```
┌────────────────────────────────────────────────────────┐
│ Milestone 1: Physical QuinLED dig2go Validation       │
│ Status: PENDING HARDWARE DELIVERY                      │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Milestone 2: Cross-Device Scene Synchronization        │
│ Status: ARCHITECTURE READY / PENDING MULTI-DEVICE TEST │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Milestone 3: Windows WASAPI Audio Loopback Ingest      │
│ Status: PLANNED                                        │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Milestone 4: Windows Packaging & System Tray           │
│ Status: READY FOR PACKAGING CONFIGURATION              │
└────────────────────────────────────────────────────────┘
```

---

## Milestone 1: Physical QuinLED dig2go Hardware Validation
- **Trigger**: Physical arrival of the QuinLED dig2go hardware unit.
- **Action Items**:
  1. Follow the step-by-step 10-stage test protocol in [`docs/DIG2GO_HARDWARE_TEST_PLAN.md`](file:///g:/Light%20Test/docs/DIG2GO_HARDWARE_TEST_PLAN.md).
  2. Verify ESP32 identity, Sound-Reactive WLED firmware build, and ICS-43434 digital MEMS microphone response.
  3. Validate onboard MOSFET relay hard-off voltage drop (0V idle).
  4. Validate bidirectional WebSocket push latency when pressing the physical enclosure tactile button.
  5. Update `docs/COMPATIBILITY_REPORT.md` transitioning dig2go from *Verified using mock or simulator* to *Verified on real hardware*.

---

## Milestone 2: Multi-Device Synchronized Scene Orchestration
- **Objective**: Create unified scenes that coordinate multiple controllers across distinct families simultaneously.
- **Action Items**:
  1. Enhance `PresetManager` and `DeviceGroupingScreen` to allow single-click scene application targeting both the SP530E (living room) and QuinLED dig2go (desk/office).
  2. Implement command grouping synchronization with millisecond compensation to align effect phase timing across heterogeneous protocols.
  3. Support mixed color models (e.g. RGB on SP530E and RGBW on WLED).

---

## Milestone 3: Windows Native WASAPI Audio Visualizer
- **Objective**: Expand the Music Reactive screen (`Ctrl+6`) from controller microphone input to system-wide Windows audio reactive visualization.
- **Action Items**:
  1. Capture system audio via Windows WASAPI loopback (capturing desktop audio output from Spotify, games, or media players).
  2. Perform real-time FFT (Fast Fourier Transform) frequency binning (bass, midrange, treble) in the Electron main process.
  3. Stream high-speed lighting intensity frames (20–30 FPS) to both SP530E and WLED controllers with dynamic beat detection.

---

## Milestone 4: Windows Desktop Packaging & System Tray
- **Objective**: Distribute the desktop application as a native Windows executable and background service.
- **Action Items**:
  1. Configure `electron-builder` in `apps/desktop/package.json` to generate NSIS `.exe` installers and `.msi` enterprise packages.
  2. Add Windows System Tray icon with quick power toggle and scene selector context menu.
  3. Support "Minimize to Tray" on window close and optional "Launch on Windows Startup" registry entry.
  4. Package application icons (`.ico`) in 16x16, 32x32, 48x48, and 256x256 resolutions.
