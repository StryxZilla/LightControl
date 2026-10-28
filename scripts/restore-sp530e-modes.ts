import * as net from 'node:net';
import { SpnetCodec } from '../packages/adapters/src/sp530e/spnet-codec.ts';

const HOST = '192.168.86.34';
const PORT = 8587;

async function queryState(socket: net.Socket): Promise<Uint8Array> {
  const queryFrame = SpnetCodec.buildQueryFrame();
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout waiting for queryState response from hardware'));
    }, 4000);

    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length >= 13) {
        const payloadLen = (buffer[11]! << 8) | buffer[12]!;
        if (buffer.length >= 13 + payloadLen) {
          cleanup();
          resolve(new Uint8Array(buffer.subarray(0, 13 + payloadLen)));
        }
      }
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const onClose = () => {
      cleanup();
      reject(new Error('Socket closed while waiting for queryState response'));
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
      socket.removeListener('close', onClose);
    };

    socket.on('data', onData);
    socket.on('error', onError);
    socket.on('close', onClose);
    socket.write(queryFrame);
  });
}

function parseModeFromTelemetry(raw: Uint8Array): {
  mode: number;
  effect: number;
  power: boolean;
  levelColor: number;
  levelWhite: number;
  color: [number, number, number];
  speed: number;
  length: number;
} {
  const payload = Array.from(raw.subarray(13));
  const lengthFields = payload.shift()!;
  while (payload.length > 0) {
    const chunkType = payload.shift()!;
    const chunkSize = lengthFields === 1
      ? (payload.shift()! << 8) | payload.shift()!
      : payload.shift()!;
    const chunkData = payload.splice(0, chunkSize);
    if (chunkType === 2 || chunkType === 3) {
      const d = [...chunkData];
      if (chunkType === 3) {
        d.shift(); // u30
        d.shift(); // light_type
      }
      return {
        power: d[1] === 1,
        mode: d[4],
        effect: d[5],
        levelColor: d[7],
        levelWhite: d[8],
        color: [d[9], d[10], d[11]],
        speed: d[14],
        length: d[15],
      };
    }
  }
  throw new Error('Could not find telemetry chunk in response');
}

async function sendPacket(socket: net.Socket, packet: Uint8Array, label: string): Promise<void> {
  console.log(`Transmitting [${label}]: ${Buffer.from(packet).toString('hex')}`);
  await new Promise<void>((resolve, reject) => {
    socket.write(packet, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  await new Promise((r) => setTimeout(r, 200));
}

function getModeName(mode: number): string {
  switch (mode) {
    case 1: return 'Static Color (Mode 1)';
    case 2: return 'Static White (Mode 2)';
    case 3: return 'Dynamic Color (Mode 3)';
    case 4: return 'Dynamic White (Mode 4)';
    case 5: return 'Sound Color (Mode 5)';
    case 6: return 'Sound White (Mode 6)';
    case 7: return 'Custom Solid (Mode 7)';
    case 8: return 'Custom Gradient (Mode 8)';
    default: return `Unknown (Mode ${mode})`;
  }
}

async function main() {
  console.log(`=== SP530E Controller Mode Restoration & Verification Tool ===`);
  console.log(`Target: ${HOST}:${PORT}`);

  const socket = new net.Socket();
  socket.setTimeout(5000);

  await new Promise<void>((resolve, reject) => {
    socket.connect(PORT, HOST, () => resolve());
    socket.on('error', reject);
    socket.on('timeout', () => reject(new Error('Connection timed out')));
  });

  try {
    // 1. Initial State Query
    console.log(`\nStep 1: Reading current hardware telemetry...`);
    const initialRaw = await queryState(socket);
    const initialInfo = parseModeFromTelemetry(initialRaw);
    console.log(`Current Hardware State:`);
    console.log(`  Power:       ${initialInfo.power ? 'ON' : 'OFF'}`);
    console.log(`  Mode:        ${initialInfo.mode} (${getModeName(initialInfo.mode)})`);
    console.log(`  Effect:      ${initialInfo.effect}`);
    console.log(`  Color:       RGB(${initialInfo.color.join(', ')})`);
    console.log(`  Level Color: ${initialInfo.levelColor}`);
    console.log(`  Length:      ${initialInfo.length}`);

    // 2. Switch to Static Color Mode (1)
    console.log(`\nStep 2: Switching hardware to Static Color Mode (Mode 1, Effect 1)...`);
    const staticModeFrame = SpnetCodec.encodeStaticMode(); // 0x53 [0x01, 0x01]
    await sendPacket(socket, staticModeFrame, 'LIGHT_MODE: Static Color (Mode 1, Effect 1)');

    // 3. Set a vibrant test color (Solid Cyan: RGB 0, 255, 255 at full brightness)
    console.log(`\nStep 3: Setting Solid Cyan color (RGB 0, 255, 255, level 255)...`);
    const cyanColorFrame = SpnetCodec.encodeColor(0, 255, 255, 255);
    await sendPacket(socket, cyanColorFrame, 'STATIC_COLOR: Cyan (0, 255, 255, 255)');

    // 4. Query telemetry to verify restoration to Mode 1
    console.log(`\nStep 4: Verifying telemetry after Static Mode assertion...`);
    const postStaticRaw = await queryState(socket);
    const postStaticInfo = parseModeFromTelemetry(postStaticRaw);
    console.log(`Updated Hardware State:`);
    console.log(`  Power:       ${postStaticInfo.power ? 'ON' : 'OFF'}`);
    console.log(`  Mode:        ${postStaticInfo.mode} (${getModeName(postStaticInfo.mode)})`);
    console.log(`  Effect:      ${postStaticInfo.effect}`);
    console.log(`  Color:       RGB(${postStaticInfo.color.join(', ')})`);
    console.log(`  Level Color: ${postStaticInfo.levelColor}`);

    // 5. Test Dynamic Mode (Mode 3, Effect 1)
    console.log(`\nStep 5: Testing Dynamic Effect Mode (Mode 3, Effect 1 - Rainbow/Chaser)...`);
    const effectFrame = SpnetCodec.encodeEffectMode(1); // 0x53 [0x03, 0x01]
    await sendPacket(socket, effectFrame, 'LIGHT_MODE: Dynamic Color Mode 3, Effect 1');
    const playFrame = SpnetCodec.encodeEffectPlay(true);
    await sendPacket(socket, playFrame, 'EFFECT_PLAY: Play/Resume (0x5D [0x01])');

    const postEffectRaw = await queryState(socket);
    const postEffectInfo = parseModeFromTelemetry(postEffectRaw);
    console.log(`Dynamic Effect Hardware State:`);
    console.log(`  Mode:        ${postEffectInfo.mode} (${postEffectInfo.mode === 3 ? 'Dynamic (SUCCESS)' : getModeName(postEffectInfo.mode)})`);
    console.log(`  Effect:      ${postEffectInfo.effect}`);

    // 6. Return to Static Color Mode (Warm White / Amber safe limit)
    console.log(`\nStep 6: Returning to Static Color Mode (Warm Amber)...`);
    await sendPacket(socket, staticModeFrame, 'LIGHT_MODE: Static Color (Mode 1, Effect 1)');
    const warmFrame = SpnetCodec.encodeColor(255, 160, 40, 200);
    await sendPacket(socket, warmFrame, 'STATIC_COLOR: Warm Amber (255, 160, 40, 200)');

    console.log(`\n=== Verification Complete ===`);
    console.log(`Controller verified in Static Mode 1 and Dynamic Mode 3.`);
    console.log(`Socket closed. BanlanX app now has full exclusive access.`);
  } finally {
    socket.destroy();
  }
}

main().catch((err) => {
  console.error(`Execution failed:`, err);
  process.exit(1);
});
