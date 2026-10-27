# Universal LED Controller - Capability-Driven Hardware Model

## 1. Design Philosophy

In traditional LED control software, applications frequently hardcode expectations about hardware (e.g., assuming all strips support 255 effects, uniform RGB color spaces, or fixed segment limits). This creates brittle codebases that break when introducing controllers from different manufacturers.

The Universal LED Controller adheres to a **Strict Capability-Driven Architecture**:
1. **Zero Homogeneity Assumptions**: No controller is assumed to share effect IDs, color channel counts, or timing parameters with any other.
2. **Dynamic UI Adaptation**: Presentation components query `device.capabilities` and dynamically mount or hide controls (e.g. CCT sliders, white channel level, multi-segment partition trees).
3. **Safety Enforcement**: Hardware safety constraints (such as maximum brightness caps for power injection limits) are encoded directly within the device capability profile and enforced by adapters and presets.

---

## 2. `DeviceCapabilities` Schema

Defined in `packages/core/src/types.ts`:

```typescript
export interface DeviceCapabilities {
  family: DeviceFamily; // 'sp530e' | 'wled' | 'mock'
  supportsPower: boolean;
  supportsBrightness: boolean;
  brightnessRange: {
    min: number;
    max: number;
    safetyLimit: number; // Software safety limit (e.g. 20% on lab setups)
  };
  colorModes: LedColorMode[]; // ('rgb' | 'rgbw' | 'rgbcct' | 'cct' | 'white')[]
  supportsWhiteChannel: boolean;
  supportsColorTemperature: boolean;
  colorTempRange?: {
    minKelvin: number;
    maxKelvin: number;
  };
  supportsSegments: boolean;
  maxSegments: number;
  maxTotalPixels: number;
  maxPixelCount?: number; // Legacy alias
  supportsICConfiguration?: boolean;
  supportedICTypes?: string[]; // E.g. ['WS2812B', 'WS2811', 'SK6812', 'UCS1903']
  supportsBuiltInEffects: boolean;
  effectsList: EffectDescriptor[];
  supportsSpeedControl: boolean;
  supportsMusicReactive: boolean;
  musicReactiveSources?: ('device_mic' | 'system_audio' | 'player')[];
  supportsTelemetry: boolean;
  firmwareInfo?: FirmwareInfo;
}
```

---

## 3. Hardware Capability Matrix

| Feature | SP530E (Bluetooth LE) | SP530E (Wi-Fi TCP) | QuinLED dig2go (WLED) | Mock Simulator |
| :--- | :--- | :--- | :--- | :--- |
| **Family** | `sp530e` | `sp530e` | `wled` | `mock` / dynamic |
| **Primary Transport** | BLE GATT (`0xFFE0` / `0xFFE1`) | TCP Sockets (`8587`) | HTTP REST (`80`) & WebSocket | In-memory virtual bus |
| **Power Control** | Yes (`Opcode 0x01`) | Yes (`SPTECH` type 0x03) | Yes (`on: true/false`) | Yes |
| **Brightness Range** | 0 - 100% (Safety cap: 20%) | 0 - 100% (Safety cap: 20%) | 0 - 100% (Hardware ABL) | 0 - 100% (Configurable) |
| **Color Modes** | `['rgb', 'rgbw']` | `['rgb']` | `['rgb', 'rgbw']` | `['rgb', 'rgbw']` |
| **White Channel** | Supported (`Opcode 0x03`) | Inferred from light type | Native (`col[0][3]`) | Supported |
| **CCT / Color Temp** | Supported (`Opcode 0x05`) | Limited | Supported (2000K - 8000K) | Supported |
| **Max Segments** | 5 | 5 (Telemetried: 1) | 16 | 10 |
| **Max Total Pixels** | Up to 1200 (Telemetried: 60) | Up to 1200 (Telemetried: 60) | 300 - 8192 | 300 - 1200 |
| **IC Configuration** | Yes (`WS2812B`, `SK6812`, etc.) | Yes (`WS2812B`, `SK6812`, etc.) | Configured in WLED Web UI | Simulated |
| **Built-in Effects** | 142 BanlanX Effects | 142 BanlanX Effects | 180+ WLED Effects | 4 Default FX |
| **Effect Speed Control** | Yes (`Opcode 0x07`, 1-100%) | Yes (`SPTECH` speed 0-255) | Yes (`sx: 0-255`) | Yes |
| **Music Reactive** | Device Mic & BanlanX App | Device Mic | Sound-Reactive WLED build | Simulated |
| **Telemetry Support** | Passive notification frames | Query frame (`SPTECH` 0x02) | Query (`/json/info`, `/json/state`) | Real-time state cache |

---

## 4. UI Adaptation Rules

The Desktop UI dynamically tailors itself according to the capability descriptor:

1. **Brightness Slider**:
   - Clamped between `brightnessRange.min` and `brightnessRange.safetyLimit` unless an expert toggle is explicitly unlocked by the user.
2. **Color Selector**:
   - If `colorModes` includes `'rgbw'`, the UI mounts a dedicated White Channel slider alongside the color wheel.
   - If `supportsColorTemperature` is `true`, a Kelvin temperature gradient slider (e.g. 2700K - 6500K) is displayed.
3. **Multi-Segment Editor**:
   - If `supportsSegments` is `false` or `maxSegments <= 1`, the multi-segment partition tabs are hidden and the strip is controlled as a single unified zone.
   - If `maxSegments > 1`, a visual segmented strip timeline is mounted allowing the user to partition pixels up to `maxTotalPixels`.
4. **Effect Catalog**:
   - Dynamic effect lists are populated directly from `device.capabilities.effectsList`, ensuring that WLED effect IDs (0-180) are never confused with BanlanX effect IDs (1-142).
   - If `supportsSpeedControl` is `false`, the effect speed slider is omitted.
