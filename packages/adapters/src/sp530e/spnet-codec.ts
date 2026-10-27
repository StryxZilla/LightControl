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
   * Header: "SPTECH\0" + MessageType (0x03) + Key (0x58) + 0x00 0x00 + 16-bit PayloadLength.
   */
  static buildControlFrame(payload: Uint8Array, key = 0x58): Uint8Array {
    const frame = new Uint8Array(13 + payload.length);
    frame.set(SPTECH_MAGIC, 0); // 0..6
    frame[7] = 0x03; // Message Type: Set State
    frame[8] = key & 0xff; // Session key
    frame[9] = 0x00; // Total Packets
    frame[10] = 0x00; // Packet Index
    frame[11] = (payload.length >> 8) & 0xff; // Length High
    frame[12] = payload.length & 0xff; // Length Low
    frame.set(payload, 13);
    return frame;
  }

  /**
   * Encodes a Power ON/OFF command over Wi-Fi.
   * Payload: [0x03, 0x01, state]
   */
  static encodePower(on: boolean): Uint8Array {
    return this.buildControlFrame(new Uint8Array([0x03, 0x01, on ? 0x01 : 0x00]));
  }

  /**
   * Encodes a Brightness level (0-255) command over Wi-Fi.
   * Payload: [0x03, 0x02, brightness]
   */
  static encodeBrightness(brightness: number): Uint8Array {
    const clamped = Math.max(0, Math.min(255, Math.round(brightness)));
    return this.buildControlFrame(new Uint8Array([0x03, 0x02, clamped]));
  }

  /**
   * Encodes an RGB Color command over Wi-Fi.
   * Payload: [0x03, 0x04, R, G, B]
   */
  static encodeColor(r: number, g: number, b: number): Uint8Array {
    const red = Math.max(0, Math.min(255, Math.round(r)));
    const green = Math.max(0, Math.min(255, Math.round(g)));
    const blue = Math.max(0, Math.min(255, Math.round(b)));
    return this.buildControlFrame(new Uint8Array([0x03, 0x04, red, green, blue]));
  }

  /**
   * Encodes a Dynamic Effect mode selection command over Wi-Fi.
   * Payload: [0x03, 0x06, modeId]
   */
  static encodeEffectMode(modeId: number): Uint8Array {
    const id = Math.max(1, Math.min(255, Math.round(modeId)));
    return this.buildControlFrame(new Uint8Array([0x03, 0x06, id]));
  }

  /**
   * Encodes an Effect Speed (0-255) command over Wi-Fi.
   * Payload: [0x03, 0x07, speed]
   */
  static encodeEffectSpeed(speed: number): Uint8Array {
    const s = Math.max(0, Math.min(255, Math.round(speed)));
    return this.buildControlFrame(new Uint8Array([0x03, 0x07, s]));
  }

  /**
   * Encodes an Effect Direction command over Wi-Fi.
   * Payload: [0x03, 0x08, dir] (0 = Forward / Left, 1 = Reverse / Right)
   */
  static encodeEffectDirection(reverse: boolean): Uint8Array {
    return this.buildControlFrame(new Uint8Array([0x03, 0x08, reverse ? 0x01 : 0x00]));
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

    // Decode Chunk 0x03 (Real-time telemetry and state)
    // Absolute buffer indices:
    // buffer[40]: Power state (0 = Off, 1 = On)
    // buffer[43]: Mode ID
    // buffer[45..47]: R, G, B channels
    // buffer[47]: Brightness level (0 - 255)
    const power = buffer.length > 40 ? buffer[40]! > 0 : true;
    const modeId = buffer.length > 43 ? buffer[43]! : 0;
    const rawR = buffer.length > 45 ? buffer[45]! : 255;
    const rawG = buffer.length > 46 ? buffer[46]! : 255;
    const rawB = buffer.length > 47 ? buffer[47]! : 255;
    const rawBrightness = buffer.length > 47 ? buffer[47]! : 255;

    // Convert 0-255 brightness to 0-100%
    const brightnessPercent = Math.round((rawBrightness / 255) * 100);

    // Extract embedded IP address if present in Chunk 0x06
    let deviceIp: string | undefined;
    const payloadStr = Array.from(payload).map(b => String.fromCharCode(b)).join('');
    const ipMatch = payloadStr.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
    if (ipMatch) {
      deviceIp = ipMatch[0];
    }

    const state: LedState = {
      power,
      brightness: brightnessPercent,
      color: { r: rawR, g: rawG, b: rawB },
      mode: modeId === 0 ? 'solid' : 'effect',
      effectId: modeId,
      effectSpeed: onoffSpeed,
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
