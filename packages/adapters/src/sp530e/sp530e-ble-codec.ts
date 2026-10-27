import type { LedState, LedColor } from '../../../core/src/types.ts';
import { clamp, rgbToHex } from '../../../core/src/color.ts';

/**
 * Standard Bluetooth Low Energy GATT UUIDs for Sperll / BanlanX controllers.
 */
export const SP530E_BLE_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
export const SP530E_BLE_CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

/**
 * Hardware identifiers.
 */
export const SP530E_MODEL_ID = 0x4e; // Decimal 78
export const SP530E_MANUFACTURER_ID = 0x5053; // ASCII 'SP', decimal 20563

/**
 * 2-byte Magic prefix for BLE frames: ASCII 'SP' (0x53, 0x50).
 */
export const BLE_MAGIC_PREFIX = new Uint8Array([0x53, 0x50]);

/**
 * Command Opcodes for BLE frames.
 */
export const Sp530eBleOpcode = {
  QUERY_STATE: 0x00,
  POWER: 0x01,
  BRIGHTNESS: 0x02,
  WHITE_BRIGHTNESS: 0x03,
  COLOR_RGB: 0x04,
  COLOR_TEMP_CCT: 0x05,
  EFFECT_MODE: 0x06,
  EFFECT_SPEED: 0x07,
  EFFECT_DIRECTION: 0x08,
  MUSIC_SOURCE: 0x09,
  MUSIC_MODE: 0x0a,
  MUSIC_SENSITIVITY: 0x0b,
} as const;

export type Sp530eBleOpcode = typeof Sp530eBleOpcode[keyof typeof Sp530eBleOpcode];

export interface BleFrameDissection {
  valid: boolean;
  magic: string;
  sequence: number;
  opcode: Sp530eBleOpcode;
  payloadLength: number;
  payload: Uint8Array;
}

/**
 * Codec for encoding and decoding SP530E Bluetooth Low Energy GATT frames.
 * Frame format: [0x53, 0x50] (Magic) + [Seq] + [Opcode] + [Len_H, Len_L] + [Payload...]
 */
export class Sp530eBleCodec {
  /**
   * Builds a raw framed BLE packet with the 6-byte header:
   * [0..1] 'SP' (0x53, 0x50)
   * [2] Sequence / Key (default 0x00)
   * [3] Opcode
   * [4..5] 16-bit Big-Endian Payload Length
   * [6..N] Payload bytes
   */
  public static buildFrame(opcode: Sp530eBleOpcode, payload: Uint8Array = new Uint8Array(0), sequence = 0x00): Uint8Array {
    const frame = new Uint8Array(6 + payload.length);
    frame[0] = 0x53; // 'S'
    frame[1] = 0x50; // 'P'
    frame[2] = sequence & 0xff;
    frame[3] = opcode & 0xff;
    frame[4] = (payload.length >> 8) & 0xff;
    frame[5] = payload.length & 0xff;
    frame.set(payload, 6);
    return frame;
  }

  /**
   * Encodes a Power ON/OFF command frame.
   * Frame: 53 50 [seq] 01 00 01 [00=Off / 01=On]
   */
  public static encodePower(on: boolean, sequence = 0x00): Uint8Array {
    return this.buildFrame(Sp530eBleOpcode.POWER, new Uint8Array([on ? 0x01 : 0x00]), sequence);
  }

  /**
   * Encodes a Color Brightness (0-255) command frame.
   * Frame: 53 50 [seq] 02 00 01 [brightness]
   */
  public static encodeBrightness(brightness: number, sequence = 0x00): Uint8Array {
    const clamped = clamp(Math.round(brightness), 0, 255);
    return this.buildFrame(Sp530eBleOpcode.BRIGHTNESS, new Uint8Array([clamped]), sequence);
  }

  /**
   * Encodes a White Channel Brightness (0-255) command frame.
   * Frame: 53 50 [seq] 03 00 01 [whiteBrightness]
   */
  public static encodeWhiteBrightness(brightness: number, sequence = 0x00): Uint8Array {
    const clamped = clamp(Math.round(brightness), 0, 255);
    return this.buildFrame(Sp530eBleOpcode.WHITE_BRIGHTNESS, new Uint8Array([clamped]), sequence);
  }

  /**
   * Encodes an RGB Color command frame.
   * Frame: 53 50 [seq] 04 00 03 [R] [G] [B]
   */
  public static encodeColor(r: number, g: number, b: number, sequence = 0x00): Uint8Array {
    const red = clamp(Math.round(r), 0, 255);
    const green = clamp(Math.round(g), 0, 255);
    const blue = clamp(Math.round(b), 0, 255);
    return this.buildFrame(Sp530eBleOpcode.COLOR_RGB, new Uint8Array([red, green, blue]), sequence);
  }

  /**
   * Encodes a Color Temperature (CCT) command frame.
   * Frame: 53 50 [seq] 05 00 02 [Warm: 0..255] [Cool: 0..255]
   */
  public static encodeColorTemperature(warm: number, cool: number, sequence = 0x00): Uint8Array {
    const w = clamp(Math.round(warm), 0, 255);
    const c = clamp(Math.round(cool), 0, 255);
    return this.buildFrame(Sp530eBleOpcode.COLOR_TEMP_CCT, new Uint8Array([w, c]), sequence);
  }

  /**
   * Encodes a Dynamic Effect Mode ID command frame.
   * Frame: 53 50 [seq] 06 00 01 [modeId]
   */
  public static encodeEffectMode(modeId: number, sequence = 0x00): Uint8Array {
    const id = clamp(Math.round(modeId), 1, 255);
    return this.buildFrame(Sp530eBleOpcode.EFFECT_MODE, new Uint8Array([id]), sequence);
  }

  /**
   * Encodes an Effect Speed (0-255) command frame.
   * Frame: 53 50 [seq] 07 00 01 [speed]
   */
  public static encodeEffectSpeed(speed: number, sequence = 0x00): Uint8Array {
    const s = clamp(Math.round(speed), 0, 255);
    return this.buildFrame(Sp530eBleOpcode.EFFECT_SPEED, new Uint8Array([s]), sequence);
  }

  /**
   * Encodes an Effect Direction (0 = Forward / Left, 1 = Reverse / Right) command frame.
   * Frame: 53 50 [seq] 08 00 01 [dir]
   */
  public static encodeEffectDirection(reverse: boolean, sequence = 0x00): Uint8Array {
    return this.buildFrame(Sp530eBleOpcode.EFFECT_DIRECTION, new Uint8Array([reverse ? 0x01 : 0x00]), sequence);
  }

  /**
   * Encodes a State Query request frame.
   * Frame: 53 50 [seq] 00 00 00
   */
  public static encodeQueryState(sequence = 0x00): Uint8Array {
    return this.buildFrame(Sp530eBleOpcode.QUERY_STATE, new Uint8Array(0), sequence);
  }

  /**
   * Validates whether a buffer possesses the proper 'SP' magic prefix and length headers.
   */
  public static isValidFrame(data: Uint8Array): boolean {
    if (data.length < 6) return false;
    if (data[0] !== 0x53 || data[1] !== 0x50) return false;
    const payloadLen = (data[4] << 8) | data[5];
    return data.length === 6 + payloadLen;
  }

  /**
   * Dissects a raw BLE frame into structured header and payload fields.
   */
  public static dissectFrame(data: Uint8Array): BleFrameDissection | null {
    if (!this.isValidFrame(data)) return null;
    const payloadLen = (data[4] << 8) | data[5];
    return {
      valid: true,
      magic: 'SP',
      sequence: data[2],
      opcode: data[3] as Sp530eBleOpcode,
      payloadLength: payloadLen,
      payload: data.slice(6, 6 + payloadLen),
    };
  }

  /**
   * Decodes an incoming BLE notification or status response frame into partial LedState.
   */
  public static decodeNotification(data: Uint8Array): Partial<LedState> | null {
    const dissection = this.dissectFrame(data);
    if (!dissection) return null;

    switch (dissection.opcode) {
      case Sp530eBleOpcode.QUERY_STATE:
        if (dissection.payload.length >= 7) {
          const p = dissection.payload;
          const power = p[0] === 0x01;
          const modeId = p[1]!;
          const mode = modeId === 0 ? 'solid' : 'effect';
          const speed = p[2]!;
          const brightness = p[3]!;
          const r = p[4]!;
          const g = p[5]!;
          const b = p[6]!;
          const w = p.length >= 8 ? p[7] : undefined;
          return {
            power,
            brightness: Math.round((brightness / 255) * 100),
            mode,
            effectId: modeId,
            effectSpeed: Math.round((speed / 255) * 100),
            color: {
              r,
              g,
              b,
              w,
              hex: rgbToHex({ r, g, b }),
            },
          } as any;
        }
        break;

      case Sp530eBleOpcode.POWER:
        if (dissection.payload.length >= 1) {
          return { power: dissection.payload[0] === 0x01 };
        }
        break;

      case Sp530eBleOpcode.BRIGHTNESS:
        if (dissection.payload.length >= 1) {
          return { brightness: dissection.payload[0] };
        }
        break;

      case Sp530eBleOpcode.COLOR_RGB:
        if (dissection.payload.length >= 3) {
          const r = dissection.payload[0];
          const g = dissection.payload[1];
          const b = dissection.payload[2];
          return {
            color: {
              mode: 'rgb',
              red: r,
              green: g,
              blue: b,
              hex: rgbToHex({ r, g, b }),
            },
          };
        }
        break;

      case Sp530eBleOpcode.EFFECT_MODE:
        if (dissection.payload.length >= 1) {
          return {
            effect: {
              id: dissection.payload[0],
              name: `Effect ${dissection.payload[0]}`,
              speed: 128,
            },
          };
        }
        break;

      case Sp530eBleOpcode.EFFECT_SPEED:
        if (dissection.payload.length >= 1) {
          return {
            effect: {
              id: 1,
              name: 'Dynamic Mode',
              speed: dissection.payload[0],
            },
          };
        }
        break;

      default:
        break;
    }

    return null;
  }
}
