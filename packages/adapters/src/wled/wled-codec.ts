import type {
  LedState,
  LedColor,
  SegmentConfig,
  DeviceCapabilities,
  FirmwareInfo,
  EffectDescriptor,
} from '../../../core/src/types.ts';
import { rgbToHex, clamp } from '../../../core/src/color.ts';
import type { Preset } from '../../../core/src/presets.ts';

/**
 * Standard WLED JSON API Segment schema (/json/state seg array)
 */
export interface WledJsonSegment {
  id?: number;
  start?: number;
  stop?: number;
  len?: number;
  grp?: number;
  spc?: number;
  of?: number;
  col?: number[][]; // [[R,G,B] | [R,G,B,W]] (primary, secondary, tertiary)
  fx?: number; // Effect ID (0 = Solid)
  sx?: number; // Effect speed (0 - 255)
  ix?: number; // Effect intensity (0 - 255)
  pal?: number; // Palette ID
  c1?: number; // Custom effect slider 1 (0 - 255)
  c2?: number; // Custom effect slider 2 (0 - 255)
  c3?: number; // Custom effect slider 3 (0 - 255)
  sel?: boolean; // Selected segment
  rev?: boolean; // Reversed direction
  mi?: boolean; // Mirror segment
  on?: boolean; // Segment power
  bri?: number; // Segment brightness (0 - 255)
}

/**
 * Standard WLED JSON API Playlist schema
 */
export interface WledJsonPlaylist {
  ps: number[]; // Preset IDs
  dur: number[]; // Duration in tenths of seconds (10 = 1 sec)
  transition?: number | number[]; // Transition time in tenths of seconds
  repeat?: number; // Repeat count (0 = infinite)
  end?: number; // Final preset ID after playlist ends
}

/**
 * Standard WLED JSON API State schema (/json/state)
 */
export interface WledJsonState {
  on?: boolean;
  bri?: number; // 0 - 255
  transition?: number; // Crossfade transition time in tenths of seconds
  ps?: number; // Active Preset ID (-1 if none)
  pl?: number; // Active Playlist ID (-1 if none)
  nl?: {
    on?: boolean;
    dur?: number;
    mode?: number;
    tbri?: number;
    rem?: number;
  };
  udpn?: {
    send?: boolean;
    recv?: boolean;
  };
  lor?: number;
  mainseg?: number;
  seg?: WledJsonSegment[];
  playlist?: WledJsonPlaylist;
  psave?: number; // Save current state to preset ID
  pdel?: number; // Delete preset ID
  v?: boolean; // Verbose response flag
  time?: number;
}

/**
 * Standard WLED JSON API Info schema (/json/info)
 */
export interface WledJsonInfo {
  ver: string; // e.g. "0.14.1"
  vid: number; // e.g. 2312150
  leds: {
    count: number;
    pwr?: number;
    fps?: number;
    maxpwr?: number;
    maxseg: number;
    actseg?: number;
    seglock?: boolean;
    cct?: boolean;
    wv?: boolean;
    rgbw?: boolean;
    pin?: number[];
  };
  str?: boolean;
  name: string;
  udpport: number;
  live?: boolean;
  fxcount: number;
  palcount: number;
  arch: string; // e.g. "esp32", "esp8266"
  core?: string;
  freeheap?: number;
  uptime?: number;
  opt?: number;
  brand?: string; // e.g. "QuinLED"
  product?: string; // e.g. "dig2go"
  btype?: string; // Build type, e.g. "soundreactive"
  mac?: string;
  ip?: string;
  fs?: {
    u?: number;
    t?: number;
    pmt?: number;
  };
}

/**
 * Codec for translating between Universal HAL models and WLED JSON API structures.
 */
export class WledCodec {
  /**
   * Translates Universal LedState into a WLED /json/state payload.
   */
  static stateToWledJson(state: Partial<LedState>, segmentIndex = 0): WledJsonState {
    const payload: WledJsonState = {};

    if (state.power !== undefined) {
      payload.on = state.power;
    }

    if (state.brightness !== undefined) {
      // Scale 0-100% to 0-255 WLED scale
      payload.bri = clamp(Math.round((state.brightness / 100) * 255), 0, 255);
    }

    // Check if multi-segment array is explicitly provided
    if (state.segments && state.segments.length > 0) {
      payload.seg = state.segments.map((s, idx) => {
        const segItem: WledJsonSegment = {
          id: s.id ?? idx,
          start: s.start,
          stop: s.stop,
          on: s.on ?? true,
        };

        if (s.effectId !== undefined) {
          segItem.fx = s.effectId;
        }

        if (s.speed !== undefined) {
          segItem.sx = clamp(Math.round((s.speed / 100) * 255), 0, 255);
        }

        if (s.color) {
          const colEntry: number[] = [s.color.r, s.color.g, s.color.b];
          if (s.color.w !== undefined) {
            colEntry.push(s.color.w);
          }
          segItem.col = [colEntry];
        }

        return segItem;
      });
      return payload;
    }

    // Single segment / color / effect update
    const segPayload: WledJsonSegment = { id: segmentIndex };
    let hasSeg = false;

    if (state.color) {
      const c = state.color;
      const colEntry: number[] = [c.r, c.g, c.b];
      if (c.w !== undefined) {
        colEntry.push(c.w);
      }
      segPayload.col = [colEntry];
      hasSeg = true;
    }

    if (state.mode === 'effect' && state.effectId !== undefined) {
      segPayload.fx = state.effectId;
      if (state.effectSpeed !== undefined) {
        segPayload.sx = clamp(Math.round((state.effectSpeed / 100) * 255), 0, 255);
      }
      hasSeg = true;
    } else if (state.mode === 'solid') {
      segPayload.fx = 0; // WLED FX 0 = "Solid"
      hasSeg = true;
    }

    if (hasSeg) {
      payload.seg = [segPayload];
    }

    return payload;
  }

  /**
   * Translates incoming WLED /json/state payload into Universal LedState.
   */
  static wledJsonToState(wled: WledJsonState, fallbackState?: LedState): LedState {
    const power = wled.on ?? fallbackState?.power ?? true;
    const brightness =
      wled.bri !== undefined ? Math.round((wled.bri / 255) * 100) : (fallbackState?.brightness ?? 100);

    let color: LedColor = fallbackState?.color ?? { r: 255, g: 255, b: 255, hex: '#FFFFFF' };
    let mode: 'solid' | 'effect' | 'music' = fallbackState?.mode ?? 'solid';
    let effectId: number | undefined = fallbackState?.effectId;
    let effectSpeed: number | undefined = fallbackState?.effectSpeed;

    const segments: SegmentConfig[] = [];

    if (wled.seg && wled.seg.length > 0) {
      const primary = wled.seg[0]!;
      if (primary.col && primary.col[0] && primary.col[0].length >= 3) {
        const r = primary.col[0][0]!;
        const g = primary.col[0][1]!;
        const b = primary.col[0][2]!;
        const w = primary.col[0][3];
        color = {
          r,
          g,
          b,
          w,
          hex: rgbToHex({ r, g, b }),
        };
      }

      if (primary.fx !== undefined) {
        effectId = primary.fx;
        mode = primary.fx === 0 ? 'solid' : 'effect';
      }

      if (primary.sx !== undefined) {
        effectSpeed = Math.round((primary.sx / 255) * 100);
      }

      for (const s of wled.seg) {
        segments.push({
          id: s.id ?? 0,
          start: s.start ?? 0,
          stop: s.stop ?? 60,
          length: (s.stop ?? 60) - (s.start ?? 0),
          on: s.on ?? true,
          effectId: s.fx,
          speed: s.sx !== undefined ? Math.round((s.sx / 255) * 100) : undefined,
          color:
            s.col && s.col[0]
              ? {
                  r: s.col[0][0] ?? 255,
                  g: s.col[0][1] ?? 255,
                  b: s.col[0][2] ?? 255,
                  w: s.col[0][3],
                  hex: rgbToHex({
                    r: s.col[0][0] ?? 255,
                    g: s.col[0][1] ?? 255,
                    b: s.col[0][2] ?? 255,
                  }),
                }
              : undefined,
        });
      }
    }

    return {
      power,
      brightness,
      color,
      mode,
      effectId,
      effectSpeed,
      activeSegments: segments.length || 1,
      segments: segments.length > 0 ? segments : undefined,
    };
  }

  /**
   * Translates WLED /json/info metadata and dynamic effect/palette lists into DeviceCapabilities.
   */
  static parseWledInfoToCapabilities(
    info: WledJsonInfo,
    effectsList: string[] = [],
    palettesList: string[] = []
  ): DeviceCapabilities {
    const effects: EffectDescriptor[] = effectsList.map((name, id) => ({
      id,
      name,
      speedSupported: true,
      intensitySupported: true,
    }));

    const isDig2go = this.isDig2Go(info);
    const isSoundReactive = this.isSoundReactive(info);

    const firmwareInfo: FirmwareInfo = {
      version: info.ver,
      build: info.vid ? info.vid.toString() : undefined,
      model: info.product || (isDig2go ? 'QuinLED dig2go' : (info.brand || 'WLED Controller')),
      targetChip: info.arch,
      ip: info.ip,
      mac: info.mac,
    };

    return {
      family: 'wled',
      supportsPower: true,
      supportsBrightness: true,
      brightnessRange: {
        min: 0,
        max: 100,
        safetyLimit: 100, // WLED has built-in hardware ABL (Automatic Brightness Limiter)
      },
      colorModes: info.leds?.rgbw ? ['rgb', 'rgbw'] : ['rgb'],
      supportsWhiteChannel: !!info.leds?.rgbw,
      supportsColorTemperature: !!info.leds?.cct,
      colorTempRange: info.leds?.cct ? { minKelvin: 2000, maxKelvin: 8000 } : undefined,
      supportsSegments: true,
      maxSegments: info.leds?.maxseg || 16,
      maxTotalPixels: info.leds?.count || (isDig2go ? 300 : 8192),
      supportsBuiltInEffects: true,
      effectsList: effects.length > 0 ? effects : [
        { id: 0, name: 'Solid', speedSupported: false },
        { id: 1, name: 'Blink', speedSupported: true },
        { id: 2, name: 'Breathe', speedSupported: true },
        { id: 3, name: 'Wipe', speedSupported: true },
        { id: 9, name: 'Rainbow', speedSupported: true },
        { id: 15, name: 'Dynamic', speedSupported: true },
        { id: 38, name: 'Fire 2012', speedSupported: true },
      ],
      supportsSpeedControl: true,
      supportsMusicReactive: isSoundReactive || isDig2go,
      supportsTelemetry: true,
      firmwareInfo,
    };
  }

  /**
   * Detects if device is a QuinLED dig2go hardware controller.
   */
  static isDig2Go(info: WledJsonInfo): boolean {
    const brand = info.brand?.toLowerCase() || '';
    const product = info.product?.toLowerCase() || '';
    const name = info.name?.toLowerCase() || '';
    return (
      product.includes('dig2go') ||
      brand.includes('quinled') ||
      name.includes('dig2go') ||
      name.includes('dig-2-go')
    );
  }

  /**
   * Detects if device is running Sound-Reactive WLED firmware.
   */
  static isSoundReactive(info: WledJsonInfo): boolean {
    const btype = info.btype?.toLowerCase() || '';
    const name = info.name?.toLowerCase() || '';
    const product = info.product?.toLowerCase() || '';
    return (
      btype.includes('sound') ||
      btype.includes('audio') ||
      btype.includes('sr') ||
      name.includes('audio') ||
      name.includes('sound') ||
      product.includes('sound')
    );
  }

  /**
   * Translates /presets.json dictionary into an array of Universal Preset objects.
   */
  static parsePresetsJson(presetsObj: Record<string, any>): Preset[] {
    const presets: Preset[] = [];

    for (const [key, val] of Object.entries(presetsObj)) {
      if (!val || typeof val !== 'object' || key === '0') continue;
      const presetId = parseInt(key, 10);
      if (isNaN(presetId)) continue;

      const name = val.n || `Preset ${presetId}`;
      const power = val.on ?? true;
      const brightness = val.bri !== undefined ? Math.round((val.bri / 255) * 100) : 100;

      let color: LedColor = { r: 255, g: 255, b: 255, hex: '#FFFFFF' };
      let mode: 'solid' | 'effect' = 'solid';
      let effectId: number | undefined;

      if (val.seg && Array.isArray(val.seg) && val.seg[0]) {
        const seg0 = val.seg[0];
        if (seg0.col && seg0.col[0]) {
          const r = seg0.col[0][0] ?? 255;
          const g = seg0.col[0][1] ?? 255;
          const b = seg0.col[0][2] ?? 255;
          const w = seg0.col[0][3];
          color = { r, g, b, w, hex: rgbToHex({ r, g, b }) };
        }
        if (seg0.fx !== undefined) {
          effectId = seg0.fx;
          mode = effectId === 0 ? 'solid' : 'effect';
        }
      }

      presets.push({
        id: `wled-preset-${presetId}`,
        name,
        state: {
          power,
          brightness,
          color,
          mode,
          effectId,
        },
        createdAt: Date.now(),
        tags: ['wled', `id-${presetId}`],
      });
    }

    return presets;
  }

  /**
   * Generates a WLED JSON payload to save a preset.
   */
  static buildPresetSavePayload(
    presetId: number,
    name: string,
    state?: Partial<LedState>
  ): WledJsonState & { psave: number; n: string } {
    const base = state ? this.stateToWledJson(state) : {};
    return {
      ...base,
      psave: presetId,
      n: name,
    };
  }

  /**
   * Generates a WLED JSON playlist payload.
   * duration in seconds is converted to tenths of seconds.
   */
  static buildPlaylistPayload(
    presetIds: number[],
    durationsSec: number[] = [10],
    repeat = 0,
    endPresetId?: number
  ): { playlist: WledJsonPlaylist } {
    const durTenths = durationsSec.map((s) => Math.round(s * 10));
    return {
      playlist: {
        ps: presetIds,
        dur: durTenths,
        transition: 0,
        repeat,
        end: endPresetId,
      },
    };
  }
}
