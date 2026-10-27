# QuinLED dig2go Hardware Validation Test Plan

## Objective
This test plan provides a rigorous, step-by-step verification procedure for validating the **QuinLED dig2go** addressable LED controller running Sound-Reactive WLED against the Universal Windows LED Controller software suite when physical hardware arrives.

> [!IMPORTANT]
> Real hardware compatibility must **never be claimed** until this test plan is executed against an authorized, physically connected QuinLED dig2go controller. All functionality documented to date is simulator-tested against the local mock WLED server.

---

## Hardware Profile & Safety Boundaries

| Parameter | Specification | Safety Constraint |
|---|---|---|
| **Input Power** | USB-C 5V @ up to 3.0A | **Do not exceed 15W total power consumption**. Use a certified 5V/3A power supply. |
| **Max Strip Length** | ~300 WS2812B / SK6812 LEDs | Limit strip length to 300 pixels without auxiliary power injection. |
| **Power Protection** | Hardware ABL (Automatic Brightness Limiter) | Ensure WLED ABL is enabled with current limit set to 2,800 mA. |
| **Relay Circuit** | Onboard MOSFET hard-off switch | Verify zero voltage bleed to LED VCC when turned off in software. |
| **Microphone** | ICS-43434 I2S Digital MEMS | Verify acoustic sensitivity in Sound-Reactive modes. |
| **Physical Button** | Tactile push button on enclosure | Verify local button presses synchronize back to the Windows app via WebSocket. |

---

## Pre-Flight Setup & Environment Preparation

1. **Power Supply**: Connect the dig2go to a reliable 5V USB-C power source rated for at least 2.4A–3.0A.
2. **LED Strip**: Connect a known 5V addressable LED strip (WS2812B, WS2811, or SK6812, up to 300 LEDs) to the 3-pin output terminal.
3. **Wi-Fi Provisioning**:
   - Power on dig2go. If not provisioned, connect to temporary AP `WLED-AP` (default password: `wled1234`).
   - Configure local Wi-Fi credentials matching the subnet of the Windows desktop application host.
   - Note the assigned local IP (e.g. `192.168.86.50`).
4. **App Readiness**:
   - Launch desktop app: `npm run desktop:start`
   - Navigate to **Controllers & Transports** (`Ctrl+2`).
   - Select **WLED / dig2go (HTTP 80)** target mode.

---

## 10-Stage Hardware Test Protocol

```
┌────────────────────────────────────────────────────────┐
│ Stage 1: Network Reachability & Handshake              │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Stage 2: Firmware & Dig2Go Identity Detection         │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Stage 3: MOSFET Relay Hard-Off & Power Control         │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Stage 4: 20% Safe Brightness Scaling & Clamping        │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Stage 5: Solid Color & Channel Accuracy                │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Stage 6: Dynamic Built-In Effects & Palettes           │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Stage 7: Sound-Reactive Microphone Audio Modes         │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Stage 8: Multi-Segment Zoning Control                  │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Stage 9: Hardware Preset Storing & Playlist Loops      │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Stage 10: WebSocket Push & Physical Button Sync        │
└────────────────────────────────────────────────────────┘
```

---

### Stage 1: Network Reachability & Socket Verification
- **Objective**: Confirm HTTP port 80 and WebSocket `/ws` accept connections from the Windows PC.
- **Action**:
  - Enter the dig2go IP in the app manual connection bar and click **Connect WLED / dig2go**.
  - Execute ping / curl check: `curl -s http://<IP>/json/info`.
- **Pass Criteria**: HTTP response status is 200 OK; WebSocket establishes within < 150 ms.

### Stage 2: Firmware & Dig2Go Identity Detection
- **Objective**: Verify metadata extraction accurately classifies hardware and capability flags.
- **Action**:
  - Read `device.capabilities` and inspect the Diagnostics tab (`Ctrl+0`).
- **Pass Criteria**:
  - `capabilities.family` is `'wled'`.
  - `capabilities.firmwareInfo.model` indicates `'QuinLED dig2go'` or `'dig2go'`.
  - `capabilities.firmwareInfo.targetChip` is `'esp32'`.
  - `capabilities.supportsMusicReactive` evaluates to `true`.
  - `capabilities.effectsList` contains > 100 effects.

### Stage 3: MOSFET Relay Hard-Off & Power Control
- **Objective**: Verify that `setPower(false)` triggers the onboard MOSFET relay to cut LED power completely.
- **Action**:
  - Toggle power OFF (`Ctrl+P` or UI power switch).
  - Observe LED strip and inspect multimeter voltage across LED VCC/GND terminals.
- **Pass Criteria**: LEDs turn off instantly; residual idle voltage drops to near 0V; no standby glow or ghosting.

### Stage 4: 20% Safe Brightness Scaling & Clamping
- **Objective**: Verify brightness slider obeys strict 20% safety limit.
- **Action**:
  - In Power & Brightness screen (`Ctrl+4`), adjust slider to 5%, 10%, 15%, 20%.
  - Verify dispatched WLED JSON: `bri` corresponds to `Math.round((pct/100) * 255)`.
- **Pass Criteria**: Physical illumination scales smoothly; software slider clamps at 20% (value 51) without thermal stress.

### Stage 5: Solid Color & Channel Accuracy
- **Objective**: Verify RGB chromatic fidelity across swatches.
- **Action**:
  - In Color Picker screen (`Ctrl+3`), select Primary Red (`#FF0000`), Pure Green (`#00FF00`), Pure Blue (`#0000FF`), and Warm White (`#FFB43C`).
- **Pass Criteria**: Physical LEDs match screen swatches accurately; RGB channel sliders adjust individual channel intensity without lag.

### Stage 6: Dynamic Built-In Effects & Palettes
- **Objective**: Verify built-in animation execution, speed control, and palette transitions.
- **Action**:
  - In Dynamic Effects screen (`Ctrl+5`), trigger:
    1. Rainbow Flow (FX ID 9)
    2. Fire 2012 (FX ID 38)
    3. Color Chase (FX ID 28)
  - Adjust animation speed slider between 10% and 90%.
- **Pass Criteria**: LEDs animate smoothly; speed adjustments respond instantaneously.

### Stage 7: Sound-Reactive Microphone Audio Modes
- **Objective**: Validate onboard ICS-43434 digital MEMS microphone responsiveness.
- **Action**:
  - In Music Reactive screen (`Ctrl+6`), select sound-reactive animation (e.g. Freqwave, Gravimeter, or Sound Wave).
  - Play acoustic audio or speak near the dig2go enclosure.
- **Pass Criteria**: LEDs react dynamically to sound amplitude and frequency without stuttering.

### Stage 8: Multi-Segment Zoning Control
- **Objective**: Verify multi-segment partitioning across the physical strip.
- **Action**:
  - Configure 2 segments (Segment 0: LEDs 0–149; Segment 1: LEDs 150–299).
  - Assign Solid Red to Segment 0 and Rainbow Flow to Segment 1.
- **Pass Criteria**: First half of physical strip remains solid red while the second half executes the rainbow animation independently.

### Stage 9: Hardware Preset Storing & Playlist Loops
- **Objective**: Verify flash storage of presets and playlist sequencing.
- **Action**:
  - Save current state as Preset 10 ("Dig2Go Night Glow").
  - Trigger Playlist alternating between Preset 1 and Preset 10 every 5 seconds.
- **Pass Criteria**: Preset persists in controller `/presets.json`; playlist cycles automatically at the specified duration.

### Stage 10: WebSocket Push & Physical Button Sync
- **Objective**: Verify bidirectional synchronization between physical hardware actions and the desktop UI.
- **Action**:
  - With the desktop dashboard open, physically press the tactile button on the dig2go case to toggle power.
- **Pass Criteria**: Within < 100 ms of the physical button press, the desktop app receives the WebSocket push and updates the power indicator to OFF without manual polling.

---

## Validation Sign-Off Checklist

| Test Stage | Expected Result | Verified Date | Hardware Status | Notes / Observations |
|---|---|---|---|---|
| Stage 1: Network Reachability | HTTP 200, WS Connected | Pending Hardware | Pending | |
| Stage 2: Firmware Identity | ESP32, QuinLED dig2go | Pending Hardware | Pending | |
| Stage 3: MOSFET Relay Cutoff | 0V LED VCC on Power OFF | Pending Hardware | Pending | |
| Stage 4: 20% Safe Brightness | Max bri 51 / 255 | Pending Hardware | Pending | |
| Stage 5: Color Accuracy | RGB matches swatches | Pending Hardware | Pending | |
| Stage 6: Built-in Effects | Smooth animations | Pending Hardware | Pending | |
| Stage 7: MEMS Microphone | Sound-reactive response | Pending Hardware | Pending | |
| Stage 8: Multi-Segment Zones | Independent strip zoning | Pending Hardware | Pending | |
| Stage 9: Presets & Playlists | Flash storage & looping | Pending Hardware | Pending | |
| Stage 10: WebSocket Push | <100ms bidirectional sync| Pending Hardware | Pending | |
