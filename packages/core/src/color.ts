import type { LedColor } from './types.ts';

/**
 * Clamps a number between min and max bounds inclusive.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Converts 0-255 RGB values to a 6-character hex string (e.g. #FF5500).
 */
export function rgbToHex(color: LedColor): string {
  const r = clamp(Math.round(color.r), 0, 255).toString(16).padStart(2, '0');
  const g = clamp(Math.round(color.g), 0, 255).toString(16).padStart(2, '0');
  const b = clamp(Math.round(color.b), 0, 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`.toUpperCase();
}

/**
 * Parses a hex color string (e.g. "#FF5500" or "FF5500" or "#F50") into LedColor.
 */
export function hexToRgb(hex: string): LedColor {
  let clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length !== 6) {
    throw new Error(`Invalid hex color string: "${hex}"`);
  }
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return { r, g, b };
}

/**
 * Converts HSV (Hue 0-360, Saturation 0-100, Value/Brightness 0-100) to RGB (0-255).
 */
export function hsvToRgb(h: number, s: number, v: number): LedColor {
  const normH = ((h % 360) + 360) % 360;
  const normS = clamp(s, 0, 100) / 100;
  const normV = clamp(v, 0, 100) / 100;

  const c = normV * normS;
  const x = c * (1 - Math.abs(((normH / 60) % 2) - 1));
  const m = normV - c;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (normH < 60) {
    rPrime = c; gPrime = x; bPrime = 0;
  } else if (normH < 120) {
    rPrime = x; gPrime = c; bPrime = 0;
  } else if (normH < 180) {
    rPrime = 0; gPrime = c; bPrime = x;
  } else if (normH < 240) {
    rPrime = 0; gPrime = x; bPrime = c;
  } else if (normH < 300) {
    rPrime = x; gPrime = 0; bPrime = c;
  } else {
    rPrime = c; gPrime = 0; bPrime = x;
  }

  return {
    r: Math.round((rPrime + m) * 255),
    g: Math.round((gPrime + m) * 255),
    b: Math.round((bPrime + m) * 255),
  };
}

/**
 * Converts RGB (0-255) to HSV (h: 0-360, s: 0-100, v: 0-100).
 */
export function rgbToHsv(color: LedColor): { h: number; s: number; v: number } {
  const r = clamp(color.r, 0, 255) / 255;
  const g = clamp(color.g, 0, 255) / 255;
  const b = clamp(color.b, 0, 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
      h = 60 * (((b - r) / delta) + 2);
    } else {
      h = 60 * (((r - g) / delta) + 4);
    }
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : (delta / max) * 100;
  const v = max * 100;

  return {
    h: Math.round(h),
    s: Math.round(s),
    v: Math.round(v),
  };
}

/**
 * Scales color channels by a brightness percentage (0 - 100).
 */
export function scaleBrightness(color: LedColor, brightnessPercent: number): LedColor {
  const factor = clamp(brightnessPercent, 0, 100) / 100;
  return {
    r: Math.round(clamp(color.r, 0, 255) * factor),
    g: Math.round(clamp(color.g, 0, 255) * factor),
    b: Math.round(clamp(color.b, 0, 255) * factor),
    w: color.w !== undefined ? Math.round(clamp(color.w, 0, 255) * factor) : undefined,
    cct: color.cct,
  };
}
