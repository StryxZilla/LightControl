import type {
  LedState,
  LedColor,
  SegmentConfig,
  DeviceCapabilities,
  FirmwareInfo,
  EffectDescriptor,
} from '../../../core/src/types.ts';
import { rgbToHex, clamp } from '../../../core/src/color.ts';

/**
 * Standard WLED JSON API State schema (/json/state)
 */
export interface WledJsonState {
  on?: boolean;
  bri?: number; // 0 - 255
  transition?: number;
  ps?: number; // Preset ID
  pl?: number; // Playlist ID
  seg?: Array<{
    id?: number;
    start?: number;
    stop?: number;
    len?: number;
    grp?: number;
    spc?: number;
    of?: number;
    col?: number[][]; // [[R,G,B], [R,G,B], [R,G,B]]
    fx?: number; // Effect ID
    sx?: number; // Effect speed (0 - 255)
    ix?: number; // Effect intensity (0 - 255)
    pal?: number; // Palette ID
    sel?: boolean;
    rev?: boolean;
    on?: boolean;
    bri?: number;
  }>;
}

/**
 * Standard WLED JSON API Info schema (/json/info)
 */
export interface WledJsonInfo {
  ver: string;
  vid: number;
  leds: {
    count: number;
    pwr: number;
    fps: number;
    maxpwr: number;
    maxseg: number;
    actseg: number;
    seglock: boolean;
    cct: boolean;
    wv: boolean;
    rgbw: boolean;
  };
  str: boolean;
  name: string;
  udpport: number;
  live: boolean;
  fxcount: number;
  palcount: number;
  arch: string;
  core: string;
  freeheap: number;
  uptime: number;
  opt: number;
  brand: string;
  product: string;
  mac: string;
  ip: string;
}

/**
 * Codec for translating between Universal HAL models and WLED JSON API structures.
 */
export class WledCodec {
  /**
   * Translates Universal LedState into a WLED /json/state payload.
   */
  static stateToWledJson(state: Partial<LedState>): WledJsonState {
    const payload: WledJsonState = {};

    if (state.power !== undefined) {
      payload.on = state.power;
    }

    if (state.brightness !== undefined) {
      // Scale 0-100% to 0-255 WLED scale
      payload.bri = clamp(Math.round((state.brightness / 100) * 255), 0, 255);
    }

    // Segment / Color / Effect payload
    const segPayload: NonNullable<WledJsonState['seg']>[number] = { id: 0 };
    let hasSeg = false;

    if (state.color) {
      const c = state.color;
      segPayload.col = [[c.r, c.g, c.b]];
      if (c.w !== undefined) {
        segPayload.col[0]!.push(c.w);
      }
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

    if (state.segments && state.segments.length > 0) {
      payload.seg = state.segments.map((s, idx) => ({
        id: s.id ?? idx,
        start: s.start,
        stop: s.stop,
        on: s.on ?? true,
        fx: s.effectId ?? 0,
        sx: s.speed !== undefined ? clamp(Math.round((s.speed / 100) * 255), 0, 255) : 128,
        col: s.color ? [[s.color.r, s.color.g, s.color.b]] : undefined,
      }));
    } else if (hasSeg) {
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
   * Translates WLED /json/info metadata into DeviceCapabilities.
   */
  static parseWledInfoToCapabilities(info: WledJsonInfo, effectsList: string[] = []): DeviceCapabilities {
    const effects: EffectDescriptor[] = effectsList.map((name, id) => ({
      id,
      name,
      speedSupported: true,
      intensitySupported: true,
    }));

    const firmwareInfo: FirmwareInfo = {
      version: info.ver,
      build: info.vid ? info.vid.toString() : undefined,
      model: info.product || info.brand || 'QuinLED dig2go / WLED',
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
      maxTotalPixels: info.leds?.count || 8192,
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
      supportsMusicReactive: info.product?.toLowerCase().includes('audio') || info.name?.toLowerCase().includes('sound'),
      supportsTelemetry: true,
      firmwareInfo,
    };
  }
}
