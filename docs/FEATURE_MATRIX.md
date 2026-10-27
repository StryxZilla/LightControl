# Hardware Feature Matrix & Capability Schema

## Capability Categories

The universal interface evaluates devices across the following capability dimensions:

1. **Power Control**: Discrete Power On, Power Off, Toggle.
2. **Color Models**:
   - `RGB`: Standard 3-channel red/green/blue.
   - `RGBW`: 4-channel with dedicated pure white channel.
   - `RGBCCT`: 5-channel with dual warm/cold white channels.
   - `SingleColor / CCT`: Adjustable color temperature (Kelvin) and brightness only.
3. **Addressable LED Configuration**:
   - `ICType`: IC driver selection (WS2811, WS2812B, WS2813, WS2815, SK6812, UCS1903, etc.).
   - `ColorOrder`: RGB, GRB, BRG, etc.
   - `PixelCount`: Total number of controllable pixels.
4. **Segments & Multi-Zone**:
   - Discrete sub-strip segments with independent colors/effects.
5. **Effects & Dynamics**:
   - Built-in hardware effect patterns (rainbow, chase, fire, breathing, etc.).
   - Speed control (1-100%).
   - Intensity / Density control.
   - Direction control (Forward, Reverse).
6. **Sound / Music Reactive**:
   - Onboard controller microphone input.
   - Host / Audio streaming input.
   - Music effect presets (Energy, Rhythm, Rolling, Spectrum).
7. **Device Diagnostics & Status**:
   - Current state telemetry (Power, Color, Brightness, Effect ID).
   - Signal strength (RSSI) / Connection health.
   - Firmware revision info.

---

## Target Controller Comparison Matrix

| Feature / Capability | BanlanX SP530E (BLE) | BanlanX SP530E (Wi-Fi) | QuinLED dig2go (WLED) | Mock Simulator |
| :--- | :---: | :---: | :---: | :---: |
| **Transport Protocol** | BLE GATT (`0xFFE0` / `0xFFE1`) | TCP/UDP `8587` (`SPNET`) | HTTP REST / WebSocket | In-Memory IPC |
| **Connection Exclusivity** | Single Client Lock | Multi-Client TCP | Multi-Client HTTP/WS | Unlimited |
| **Power On/Off** | Supported | Supported | Supported | Supported |
| **Global Brightness** | Supported (0-100%) | Supported (0-255 / 0-100) | Supported (0-255) | Supported (0-100%) |
| **RGB Color Selection** | Supported | Supported | Supported | Supported |
| **Color Temperature (CCT)**| Supported | Supported | Supported | Supported |
| **Addressable IC Config** | Supported (multi-IC) | Supported | Supported (WLED LED Prefs) | Supported |
| **Segment Control** | Limited / Strip-level | Limited / Strip-level | Advanced (Multi-segment) | Supported |
| **Built-in Effects** | BanlanX SP FX library | BanlanX SP FX library | 100+ FX + Palettes | Demo FX Set |
| **Effect Speed/Intensity** | Supported | Supported | Supported | Supported |
| **Onboard Mic Music Mode** | Supported | Supported | Supported (SR Builds) | Supported |
| **Custom DIY Colors/Presets**| Supported | Supported | Supported (Presets API) | Supported |
| **Bidirectional Telemetry** | Supported (Notify `0xFFE1`) | Supported (TCP replies) | Full WebSocket Realtime | Supported |

---

## Dynamic Capability Schema Definition (TypeScript Preview)

```typescript
export interface DeviceCapabilities {
  supportsPower: boolean;
  colorModes: ('rgb' | 'rgbw' | 'rgbcct' | 'cct' | 'white')[];
  supportsBrightness: boolean;
  supportsICConfiguration: boolean;
  supportedICTypes?: string[];
  supportsSegments: boolean;
  maxSegments?: number;
  supportsBuiltInEffects: boolean;
  effectsList?: Array<{ id: number; name: string; category?: string }>;
  supportsSpeedControl: boolean;
  supportsMusicReactive: boolean;
  supportsTelemetry: boolean;
  maxPixelCount?: number;
}
```
