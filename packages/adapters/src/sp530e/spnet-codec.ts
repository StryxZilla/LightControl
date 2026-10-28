import type { LedState, LedColor } from '../../../core/src/types.ts';

export const SPTECH_MAGIC = new Uint8Array([0x53, 0x50, 0x54, 0x45, 0x43, 0x48, 0x00]); // "SPTECH\0"
export const SPNET_PORT = 8587;

export interface SpnetHeader {
  magic: string;
  messageType: number;
  key: number;
  totalPackets: number;
  packetNumber: number;
  payloadLength: number;
}

export interface SpnetConfigChunk {
  firmwareVersion: string;
  lightType: number;
  onoffEffect: number;
  onoffSpeed: number;
  pixelCount: number;
  segmentCount: number;
}

export interface SpnetParsedState {
  header: SpnetHeader;
  config: SpnetConfigChunk;
  state: LedState;
  rawColor: LedColor;
  rawBrightness: number; // 0 - 255
  modeId: number;
  deviceIp?: string;
}

export class SpnetCodec {
  /**
   * Supported SPTech Command numbers.
   */
  static readonly CMD = {
    STATUS_QUERY: 0x02,
    ONOFF_OPTIONS: 0x08,
    COEXISTENCE: 0x0a,
    ON_POWER: 0x0b,
    POWER: 0x50,
    BRIGHTNESS: 0x51,
    STATIC_COLOR: 0x52,
    LIGHT_MODE: 0x53,
    EFFECT_MODE: 0x53,
    EFFECT_SPEED: 0x54,
    EFFECT_LENGTH: 0x55,
    EFFECT_DIRECTION: 0x56,
    EFFECT_COLOR: 0x57,
    EFFECT_LOOP: 0x58,
    AUDIO_INPUT: 0x59,
    AUDIO_GAIN: 0x5a,
    EFFECT_PLAY: 0x5d,
    EFFECT_CCT: 0x60,
    STATIC_CCT: 0x61,
    LIGHT_TYPE: 0x6a,
    CHIP_ORDER: 0x6b,
  } as const;

  /**
   * Generates the standard 13-byte state query frame.
   * Frame: SPTECH\0 + 0x02 (Query) + 0x58 (Key) + 0x00 (Total) + 0x00 (Num) + 0x0000 (Length = 0)
   */
  static buildQueryFrame(): Uint8Array {
    return new Uint8Array([
      0x53, 0x50, 0x54, 0x45, 0x43, 0x48, 0x00, // Magic: "SPTECH\0"
      0x02,                                     // Message Type: State Query
      0x58,                                     // Encryption Key: 0x58
      0x00,                                     // Total Packets: 0
      0x00,                                     // Packet Number: 0
      0x00, 0x00                                // Payload Length: 0
    ]);
  }

  /**
   * Builds an SPNET control frame with the 13-byte header + payload.
   * Header: "SPTECH\0" + CommandByte + Key (0x00) + 0x00 0x00 + 16-bit PayloadLength.
   */
  static buildControlFrame(cmd: number, payload: Uint8Array, key = 0x00): Uint8Array {
    const frame = new Uint8Array(13 + payload.length);
    frame.set(SPTECH_MAGIC, 0); // 0..6
    frame[7] = cmd & 0xff; // Command Byte (e.g. 0x50 for Power, 0x51 for Brightness)
    frame[8] = key & 0xff; // Session/Encoder key (0x00)
    frame[9] = 0x00; // Total Packets
    frame[10] = 0x00; // Packet Index
    frame[11] = (payload.length >> 8) & 0xff; // Length High
    frame[12] = payload.length & 0xff; // Length Low
    frame.set(payload, 13);
    return frame;
  }

  /**
   * Encodes a Power ON/OFF command over Wi-Fi.
   * Opcode: 0x50. Payload: [0x01 = On, 0x00 = Off]
   */
  static encodePower(on: boolean): Uint8Array {
    return this.buildControlFrame(this.CMD.POWER, new Uint8Array([on ? 0x01 : 0x00]));
  }

  /**
   * Encodes a Brightness level (0-255) command over Wi-Fi.
   * Opcode: 0x51. Payload: [which=0x00 (color mode), level (0-255)]
   */
  static encodeBrightness(brightness: number): Uint8Array {
    const clamped = Math.max(0, Math.min(255, Math.round(brightness)));
    return this.buildControlFrame(this.CMD.BRIGHTNESS, new Uint8Array([0x00, clamped]));
  }

  /**
   * Encodes an RGB Color command over Wi-Fi.
   * Opcode: 0x52. Payload: [R, G, B, level]
   */
  static encodeColor(r: number, g: number, b: number, level = 255): Uint8Array {
    const red = Math.max(0, Math.min(255, Math.round(r)));
    const green = Math.max(0, Math.min(255, Math.round(g)));
    const blue = Math.max(0, Math.min(255, Math.round(b)));
    const lvl = Math.max(0, Math.min(255, Math.round(level)));
    return this.buildControlFrame(this.CMD.STATIC_COLOR, new Uint8Array([red, green, blue, lvl]));
  }

  /**
   * Encodes a Light Mode selection command over Wi-Fi (Opcode 0x53).
   * Verified payload: [mode (1-5), effect (1-N)] (2 bytes)
   * Mode 1: Static Color (effect = 1)
   * Mode 2: Dynamic Effects (effect = effectId)
   * Mode 3: Sound / Music Reactive (effect = soundEffectId)
   * Mode 4: Custom Solid DIY
   * Mode 5: Custom Gradient DIY
   */
  static encodeLightMode(mode: number, effect = 1): Uint8Array {
    const m = Math.max(1, Math.min(5, Math.round(mode)));
    const eff = Math.max(1, Math.min(255, Math.round(effect)));
    return this.buildControlFrame(this.CMD.LIGHT_MODE, new Uint8Array([m, eff]));
  }

  /**
   * Encodes switching to Static Color mode (Mode 1, Effect 1).
   */
  static encodeStaticMode(): Uint8Array {
    return this.encodeLightMode(0x01, 0x01);
  }

  /**
   * Encodes a Dynamic Effect mode selection command over Wi-Fi.
   * Opcode: 0x53. Payload: [mode = 0x02, effect = effectId] (2 bytes)
   */
  static encodeEffectMode(effectId: number): Uint8Array {
    return this.encodeLightMode(0x02, effectId);
  }

  /**
   * Encodes a Sound / Music reactive mode selection command over Wi-Fi.
   * Opcode: 0x53. Payload: [mode = 0x03, effect = effectId] (2 bytes)
   */
  static encodeSoundMode(effectId: number): Uint8Array {
    return this.encodeLightMode(0x03, effectId);
  }

  /**
   * Encodes an Effect Speed (0-255) command over Wi-Fi.
   * Opcode: 0x54. Payload: [speed]
   */
  static encodeEffectSpeed(speed: number): Uint8Array {
    const s = Math.max(0, Math.min(255, Math.round(speed)));
    return this.buildControlFrame(this.CMD.EFFECT_SPEED, new Uint8Array([s]));
  }

  /**
   * Encodes an Effect Direction command over Wi-Fi.
   * Opcode: 0x56. Payload: [dir: 0 = Forward, 1 = Reverse]
   */
  static encodeEffectDirection(reverse: boolean): Uint8Array {
    return this.buildControlFrame(this.CMD.EFFECT_DIRECTION, new Uint8Array([reverse ? 0x01 : 0x00]));
  }

  /**
   * Validates and decodes the 13-byte SPNET header.
   */
  static decodeHeader(buffer: Uint8Array): SpnetHeader {
    if (buffer.length < 13) {
      throw new Error(`Buffer too short for SPNET header: ${buffer.length} < 13 bytes`);
    }

    for (let i = 0; i < 7; i++) {
      if (buffer[i] !== SPTECH_MAGIC[i]) {
        throw new Error(`Invalid SPNET magic header at offset ${i}: 0x${buffer[i]?.toString(16)} != 0x${SPTECH_MAGIC[i]?.toString(16)}`);
      }
    }

    const messageType = buffer[7]!;
    const key = buffer[8]!;
    const totalPackets = buffer[9]!;
    const packetNumber = buffer[10]!;
    const payloadLength = (buffer[11]! << 8) | buffer[12]!;

    return {
      magic: 'SPTECH',
      messageType,
      key,
      totalPackets,
      packetNumber,
      payloadLength,
    };
  }

  /**
   * Decodes a complete SPNET telemetry response packet (Header + Payload).
   */
  static decodeResponse(buffer: Uint8Array): SpnetParsedState {
    const header = this.decodeHeader(buffer);
    const expectedTotal = 13 + header.payloadLength;

    if (buffer.length < expectedTotal) {
      throw new Error(`Incomplete packet: expected ${expectedTotal} bytes, got ${buffer.length}`);
    }

    const payload = buffer.subarray(13, expectedTotal);

    // Decode Chunk 0x01 (Config Chunk)
    if (payload.length < 21) {
      throw new Error(`Payload too short for Chunk 0x01: ${payload.length} < 21 bytes`);
    }

    // Chunk 0x01 structure:
    // Offset 0: Type (0x01)
    // Offset 1: Subtype (0x01)
    // Offset 2..3: Length (0x0011 = 17)
    // Offset 4..5: Unknown flags
    // Offset 6..13: ASCII Firmware version ("V2.0.13 ")
    // Offset 14: Light Type (0x86)
    // Offset 15: onoff_effect (0x03)
    // Offset 16: onoff_speed (0x03)
    // Offset 17..18: Pixel count (0x003C = 60)
    // Offset 19..20: Segment count (0x0001 = 1)
    let firmwareVersion = '';
    for (let i = 6; i < 14; i++) {
      const code = payload[i]!;
      if (code >= 32 && code < 127) {
        firmwareVersion += String.fromCharCode(code);
      }
    }
    firmwareVersion = firmwareVersion.trim();

    const lightType = payload[14]!;
    const onoffEffect = payload[15]!;
    const onoffSpeed = payload[16]!;
    const pixelCount = (payload[17]! << 8) | payload[18]!;
    const segmentCount = (payload[19]! << 8) | payload[20]!;

    const config: SpnetConfigChunk = {
      firmwareVersion,
      lightType,
      onoffEffect,
      onoffSpeed,
      pixelCount,
      segmentCount,
    };

    // Decode Chunk 0x03 (Real-time telemetry and state verified via sptech_model.py & live hardware)
    // Absolute buffer indices:
    // buffer[40]: Power state (0 = Off, 1 = On)
    // buffer[42]: Chip order
    // buffer[43]: Light mode (0x01 = solid color, etc.)
    // buffer[44]: Effect ID / mode number
    // buffer[46]: Level color / Brightness level (0 - 255)
    // buffer[48..50]: R, G, B channels
    // buffer[53]: Effect speed
    const power = buffer.length > 40 ? buffer[40]! > 0 : true;
    const modeId = buffer.length > 44 ? buffer[44]! : 0;
    const rawBrightness = buffer.length > 46 ? buffer[46]! : 255;
    const rawR = buffer.length > 48 ? buffer[48]! : 255;
    const rawG = buffer.length > 49 ? buffer[49]! : 255;
    const rawB = buffer.length > 50 ? buffer[50]! : 255;
    const effectSpeed = buffer.length > 53 ? buffer[53]! : onoffSpeed;

    // Convert 0-255 brightness to 0-100%
    const brightnessPercent = Math.round((rawBrightness / 255) * 100);

    // Extract embedded IP address if present in Chunk 0x06
    let deviceIp: string | undefined;
    const payloadStr = Array.from(payload).map(b => String.fromCharCode(b)).join('');
    const ipMatch = payloadStr.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
    if (ipMatch) {
      deviceIp = ipMatch[0];
    }

    const lightModeNum = buffer.length > 43 ? buffer[43]! : 0x01;
    let mappedMode: 'solid' | 'effect' | 'music' = 'solid';
    if (lightModeNum === 0x03) {
      mappedMode = 'music';
    } else if (lightModeNum === 0x02 || (lightModeNum !== 0x01 && modeId > 0)) {
      mappedMode = 'effect';
    }

    const state: LedState = {
      power,
      brightness: brightnessPercent,
      color: { r: rawR, g: rawG, b: rawB },
      mode: mappedMode,
      effectId: modeId,
      effectSpeed,
      activeSegments: segmentCount,
    };

    return {
      header,
      config,
      state,
      rawColor: { r: rawR, g: rawG, b: rawB },
      rawBrightness,
      modeId,
      deviceIp,
    };
  }
}
