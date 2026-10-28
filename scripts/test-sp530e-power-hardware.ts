import * as net from 'node:net';
import { SpnetCodec } from '../packages/adapters/src/sp530e/spnet-codec.ts';

const HOST = '192.168.86.34';
const PORT = 8587;

async function queryState(socket: net.Socket): Promise<Uint8Array> {
  const queryFrame = SpnetCodec.buildQueryFrame();
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);

    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length >= 13) {
        const payloadLen = (buffer[11]! << 8) | buffer[12]!;
        if (buffer.length >= 13 + payloadLen) {
          socket.removeListener('data', onData);
          socket.removeListener('error', onError);
          resolve(new Uint8Array(buffer.subarray(0, 13 + payloadLen)));
        }
      }
    };

    const onError = (err: Error) => {
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
      reject(err);
    };

    socket.on('data', onData);
    socket.on('error', onError);
    socket.write(queryFrame);
  });
}

async function runTest() {
  console.log(`Connecting to SP530E hardware at ${HOST}:${PORT}...`);
  const socket = new net.Socket();
  socket.setTimeout(5000);

  await new Promise<void>((resolve, reject) => {
    socket.connect(PORT, HOST, () => resolve());
    socket.on('error', reject);
    socket.on('timeout', () => reject(new Error('Connection timed out')));
  });

  console.log(`TCP Socket Connected.`);

  // 1. Initial State Query
  console.log(`1. Querying initial device state...`);
  const initialRaw = await queryState(socket);
  const initialParsed = SpnetCodec.decodeResponse(initialRaw);
  console.log(`Initial State: Power=${initialParsed.state.power ? 'ON' : 'OFF'}, Brightness=${initialParsed.state.brightness}%, Mode=${initialParsed.state.mode}, Pixels=${initialParsed.config.pixelCount}, FW=${initialParsed.config.firmwareVersion}`);
  console.log(`Initial Raw Hex: ${Buffer.from(initialRaw).toString('hex').slice(0, 60)}...`);

  // 2. Transmit exactly one Power OFF command
  const powerOffFrame = SpnetCodec.encodePower(false);
  const powerOffHex = Buffer.from(powerOffFrame).toString('hex');
  console.log(`\n2. Transmitting exactly ONE Power OFF command:`);
  console.log(`   Packet Hex: ${powerOffHex} (${powerOffFrame.length} bytes)`);

  await new Promise<void>((resolve, reject) => {
    socket.write(powerOffFrame, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  console.log(`   Packet successfully written to socket.`);

  // 3. Brief delay to allow hardware state update
  await new Promise((r) => setTimeout(r, 600));

  // 4. Query state after Power OFF
  console.log(`\n3. Querying post-command device state...`);
  const postRaw = await queryState(socket);
  const postParsed = SpnetCodec.decodeResponse(postRaw);
  console.log(`Post-Command State: Power=${postParsed.state.power ? 'ON' : 'OFF'}, Brightness=${postParsed.state.brightness}%`);
  console.log(`Post-Command Raw Hex: ${Buffer.from(postRaw).toString('hex').slice(0, 60)}...`);

  socket.destroy();

  console.log(`\n--- Verification Summary ---`);
  console.log(`Before: Power ${initialParsed.state.power ? 'ON' : 'OFF'}`);
  console.log(`After : Power ${postParsed.state.power ? 'ON' : 'OFF'}`);
  console.log(`State Changed: ${initialParsed.state.power !== postParsed.state.power}`);
}

runTest().catch((err) => {
  console.error('Test execution error:', err.message);
  process.exit(1);
});
