import type {
  DeviceFamily,
  LedState,
  SegmentConfig,
} from './types.ts';
import type { DeviceManager } from './device-manager.ts';

export interface Preset {
  id: string;
  name: string;
  targetFamily?: DeviceFamily;
  state: Partial<LedState>;
  segments?: SegmentConfig[];
  tags?: string[];
  createdAt: number;
}

export const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'preset-warm-white-safe',
    name: 'Warm White (20% Safe)',
    tags: ['reading', 'cozy', 'safe'],
    state: {
      power: true,
      brightness: 20, // Strict safety cap
      color: { r: 255, g: 180, b: 60, cct: 2700, hex: '#FFB43C' },
      mode: 'solid',
    },
    createdAt: 1700000000000,
  },
  {
    id: 'preset-cool-white',
    name: 'Daylight Cool White (20%)',
    tags: ['work', 'focus'],
    state: {
      power: true,
      brightness: 20,
      color: { r: 255, g: 255, b: 255, cct: 6500, hex: '#FFFFFF' },
      mode: 'solid',
    },
    createdAt: 1700000000000,
  },
  {
    id: 'preset-cyberpunk-cyan',
    name: 'Cyberpunk Cyan',
    tags: ['ambient', 'gaming'],
    state: {
      power: true,
      brightness: 20,
      color: { r: 0, g: 255, b: 200, hex: '#00FFC8' },
      mode: 'solid',
    },
    createdAt: 1700000000000,
  },
  {
    id: 'preset-rainbow-flow',
    name: 'Rainbow Wave Effect',
    tags: ['dynamic', 'party'],
    state: {
      power: true,
      brightness: 20,
      mode: 'effect',
      effectId: 1, // Mode 1 Rainbow
      effectSpeed: 50,
    },
    createdAt: 1700000000000,
  },
];

/**
 * Presets, Scenes & Effects Manager
 */
export class PresetManager {
  private presets = new Map<string, Preset>();

  constructor(initialPresets: Preset[] = DEFAULT_PRESETS) {
    for (const p of initialPresets) {
      this.presets.set(p.id, { ...p });
    }
  }

  savePreset(preset: Preset): void {
    this.presets.set(preset.id, { ...preset });
  }

  getPreset(id: string): Preset | undefined {
    const p = this.presets.get(id);
    return p ? { ...p } : undefined;
  }

  getPresets(family?: DeviceFamily): Preset[] {
    const all = Array.from(this.presets.values());
    if (!family) return all;
    return all.filter((p) => !p.targetFamily || p.targetFamily === family);
  }

  deletePreset(id: string): boolean {
    return this.presets.delete(id);
  }

  /**
   * Applies a preset to a target device via DeviceManager.
   */
  async applyPreset(deviceId: string, presetId: string, deviceManager: DeviceManager): Promise<boolean> {
    const preset = this.presets.get(presetId);
    if (!preset) {
      throw new Error(`Preset ${presetId} not found.`);
    }

    const device = deviceManager.getDevice(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found.`);
    }

    const state = preset.state;

    // Apply power
    if (state.power !== undefined) {
      await device.setPower(state.power);
    }

    // Apply brightness
    if (state.brightness !== undefined) {
      // Respect device capability safety limit
      const safetyLimit = device.capabilities.brightnessRange.safetyLimit;
      const targetBright = Math.min(state.brightness, safetyLimit);
      await device.setBrightness(targetBright);
    }

    // Apply color or effect depending on mode
    if (state.mode === 'solid' && state.color) {
      await device.setColor(state.color);
    } else if (state.mode === 'effect' && state.effectId !== undefined) {
      await device.setEffect(state.effectId, state.effectSpeed);
    }

    // Apply segments if supported
    if (preset.segments && device.setSegments && device.capabilities.supportsSegments) {
      await device.setSegments(preset.segments);
    }

    return true;
  }

  exportPresetsJson(): string {
    return JSON.stringify(Array.from(this.presets.values()), null, 2);
  }

  importPresetsJson(json: string): number {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      throw new Error('Invalid preset JSON: expected array of presets.');
    }
    let imported = 0;
    for (const item of parsed) {
      if (item && item.id && item.name && item.state) {
        this.savePreset(item);
        imported++;
      }
    }
    return imported;
  }
}
