import * as http from 'node:http';
import * as crypto from 'node:crypto';
import type { Socket } from 'node:net';
import type {
  WledJsonState,
  WledJsonInfo,
} from '../../packages/adapters/src/wled/wled-codec.ts';

export class WledMockServer {
  private server: http.Server | null = null;
  private wsSockets: Set<Socket> = new Set();
  public port = 0;
  public lastReceivedPayload: any = null;

  public state: WledJsonState = {
    on: true,
    bri: 51, // 20%
    transition: 7,
    ps: -1,
    pl: -1,
    seg: [
      {
        id: 0,
        start: 0,
        stop: 300,
        len: 300,
        col: [[255, 160, 50]],
        fx: 0,
        sx: 128,
        ix: 128,
        pal: 0,
        sel: true,
        rev: false,
        on: true,
        bri: 255,
      },
    ],
  };

  public info: WledJsonInfo = {
    ver: '0.14.1',
    vid: 2312150,
    leds: {
      count: 300,
      pwr: 1200,
      fps: 42,
      maxpwr: 3000,
      maxseg: 16,
      actseg: 1,
      seglock: false,
      cct: false,
      wv: false,
      rgbw: false,
    },
    str: false,
    name: 'QuinLED dig2go (Test Lab)',
    udpport: 21324,
    live: false,
    fxcount: 184,
    palcount: 71,
    arch: 'esp32',
    core: 'v4.4.4',
    freeheap: 142000,
    uptime: 18420,
    opt: 0,
    brand: 'QuinLED',
    product: 'dig2go',
    btype: 'soundreactive',
    mac: 'a4:cf:12:ef:90:12',
    ip: '127.0.0.1',
  };

  public effects: string[] = [
    'Solid',
    'Blink',
    'Breathe',
    'Wipe',
    'Wipe Random',
    'Random Colors',
    'Sweep',
    'Dynamic',
    'Colorloop',
    'Rainbow',
    'Scan',
    'Dual Scan',
    'Fade',
    'Chase',
    'Chase Rainbow',
    'Running',
    'Saw',
    'Twinkle',
    'Dissolve',
    'Dissolve Rnd',
    'Sparkle',
    'Dark Sparkle',
    'Sparkle+',
    'Strobe',
    'Strobe Rainbow',
    'Mega Strobe',
    'Blink Rainbow',
    'Android',
    'Chase 2',
    'Chase 3',
    'Colorful',
    'Traffic Light',
    'Color Sweep',
    'Fire 2012',
    'Fire 2021',
    'Noise 1',
    'Noise 2',
    'Noise 3',
    'Noise 4',
    'Colortwinkle',
    'Lake',
    'Meteor',
    'Meteor Smooth',
    'Railway',
    'Ripple',
    'Twinklefox',
    'Twinklecat',
    'Halloween Eyes',
    'Solid Pattern',
    'Solid Pattern Tri',
    'Spots',
    'Spots Fade',
    'Glitter',
    'Candle',
    'Fireworks',
    'Fireworks 1D',
    'Fireworks Starburst',
    'Explosion',
    'Flow',
    'Popcorn',
    'Drip',
    'Plasma',
    'Percent',
    'Ripple Rainbow',
    'Heartbeat',
    'Pacifica',
    'Candle Multi',
    'Solid Glacier',
    'Modal',
    'Sunrise',
    'Phased',
    'Twinkleup',
    'Noise Pal',
    'Sinus',
    'Sinus Inverted',
    'Juggle',
    'Palette',
    'Fire 2012 Sound',
    'Gravimeter',
    'Freqwave',
    'Freqmatrix',
    'Gravcentric',
  ];

  public palettes: string[] = [
    'Default',
    '* Random Cycle',
    '* Color 1',
    '* Colors 1&2',
    '* Colors Only',
    '* Color Waves',
    'Party',
    'Cloud',
    'Lava',
    'Ocean',
    'Forest',
    'Rainbow',
    'Rainbow Bands',
    'Sunset',
    'Rivendell',
    'Breeze',
    'Red & Blue',
    'Yellowout',
    'Analogous',
    'Splash',
    'Pastel',
    'Sunset 2',
    'Beech',
    'Vintage',
    'Departure',
    'Landscape',
    'Beach',
    'Sherbet',
    'Hult',
    'Hult 64',
    'Drywet',
    'Jul',
    'GrColors',
    'Game Over',
    'Tiamat',
    'Fire',
    'Icefire',
    'Cyan',
    'Light Pink',
    'Autumn',
    'Magenta',
    'Magred',
    'Yelmag',
    'Yelblu',
    'Orange & Teal',
  ];

  public presets: Record<string, any> = {
    '1': {
      n: 'Warm Glow (20%)',
      on: true,
      bri: 51,
      seg: [{ id: 0, col: [[255, 180, 60]], fx: 0 }],
    },
    '2': {
      n: 'Rainbow Chase',
      on: true,
      bri: 51,
      seg: [{ id: 0, col: [[255, 0, 0]], fx: 9, sx: 128 }],
    },
    '3': {
      n: 'Sound Reactive Pulse',
      on: true,
      bri: 51,
      seg: [{ id: 0, col: [[0, 255, 255]], fx: 80, sx: 200 }],
    },
  };

  async start(port = 0): Promise<{ port: number; url: string; wsUrl: string }> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleHttpRequest(req, res);
      });

      this.server.on('upgrade', (req, socket, head) => {
        this.handleWsUpgrade(req, socket as Socket, head);
      });

      this.server.on('error', reject);

      this.server.listen(port, '127.0.0.1', () => {
        const addr = this.server!.address() as any;
        this.port = addr.port;
        this.info.ip = `127.0.0.1:${this.port}`;
        resolve({
          port: this.port,
          url: `http://127.0.0.1:${this.port}`,
          wsUrl: `ws://127.0.0.1:${this.port}/ws`,
        });
      });
    });
  }

  async stop(): Promise<void> {
    for (const socket of this.wsSockets) {
      try {
        socket.destroy();
      } catch {}
    }
    this.wsSockets.clear();

    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.server = null;
          resolve();
        });
      });
    }
  }

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const parsedUrl = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);
    const pathname = parsedUrl.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === '/json' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          state: this.state,
          info: this.info,
          effects: this.effects,
          palettes: this.palettes,
        })
      );
      return;
    }

    if (pathname === '/json/state') {
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.state));
        return;
      }
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            this.lastReceivedPayload = parsed;
            this.applyStateUpdate(parsed);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, ...this.state }));
          } catch (e: any) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }
    }

    if (pathname === '/json/info' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.info));
      return;
    }

    if (pathname === '/json/eff' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.effects));
      return;
    }

    if (pathname === '/json/pal' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.palettes));
      return;
    }

    if (pathname === '/presets.json' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.presets));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }

  private handleWsUpgrade(req: http.IncomingMessage, socket: Socket, head: Buffer): void {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }

    const accept = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    this.wsSockets.add(socket);

    // Send initial verbose state payload on connect
    this.sendWsTextFrame(socket, JSON.stringify({ state: this.state, info: this.info }));

    socket.on('data', (buffer) => {
      this.handleWsFrame(socket, buffer);
    });

    socket.on('close', () => {
      this.wsSockets.delete(socket);
    });

    socket.on('error', () => {
      this.wsSockets.delete(socket);
    });
  }

  private handleWsFrame(socket: Socket, buffer: Buffer): void {
    if (buffer.length < 2) return;

    const firstByte = buffer[0]!;
    const opcode = firstByte & 0x0f;

    // Connection close frame (0x8)
    if (opcode === 0x8) {
      this.wsSockets.delete(socket);
      socket.destroy();
      return;
    }

    // Ping frame (0x9) -> respond with Pong (0xA)
    if (opcode === 0x9) {
      const pongFrame = Buffer.from([0x8a, 0x00]);
      socket.write(pongFrame);
      return;
    }

    // Text frame (0x1)
    if (opcode === 0x1) {
      const secondByte = buffer[1]!;
      const isMasked = (secondByte & 0x80) !== 0;
      let payloadLen = secondByte & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        payloadLen = buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        payloadLen = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }

      let payload: Buffer;
      if (isMasked) {
        const maskKey = buffer.subarray(offset, offset + 4);
        offset += 4;
        payload = Buffer.alloc(payloadLen);
        for (let i = 0; i < payloadLen; i++) {
          payload[i] = buffer[offset + i]! ^ maskKey[i % 4]!;
        }
      } else {
        payload = buffer.subarray(offset, offset + payloadLen);
      }

      const text = payload.toString('utf8');

      if (text === 'p') {
        // Heartbeat ping -> respond with pong text
        this.sendWsTextFrame(socket, 'pong');
        return;
      }

      try {
        const parsed = JSON.parse(text);
        this.lastReceivedPayload = parsed;
        if (parsed.v) {
          // Request state update
          this.sendWsTextFrame(socket, JSON.stringify({ state: this.state, info: this.info }));
        } else {
          this.applyStateUpdate(parsed);
        }
      } catch {}
    }
  }

  private applyStateUpdate(update: Record<string, any>): void {
    if (update.on !== undefined) this.state.on = update.on;
    if (update.bri !== undefined) this.state.bri = update.bri;
    if (update.ps !== undefined) this.state.ps = update.ps;
    if (update.pl !== undefined) this.state.pl = update.pl;

    // Presets handling
    if (update.psave !== undefined) {
      const idStr = String(update.psave);
      this.presets[idStr] = {
        n: update.n || `Preset ${idStr}`,
        on: this.state.on,
        bri: this.state.bri,
        seg: this.state.seg ? JSON.parse(JSON.stringify(this.state.seg)) : [],
      };
      this.state.ps = update.psave;
    }

    if (update.pdel !== undefined) {
      const idStr = String(update.pdel);
      delete this.presets[idStr];
    }

    // Segments handling
    if (update.seg && Array.isArray(update.seg)) {
      if (!this.state.seg) this.state.seg = [];
      for (const newSeg of update.seg) {
        const segId = newSeg.id ?? 0;
        let existing = this.state.seg.find((s) => s.id === segId);
        if (!existing) {
          existing = { id: segId, start: 0, stop: 300 };
          this.state.seg.push(existing);
        }
        if (newSeg.start !== undefined) existing.start = newSeg.start;
        if (newSeg.stop !== undefined) existing.stop = newSeg.stop;
        if (newSeg.col !== undefined) existing.col = newSeg.col;
        if (newSeg.fx !== undefined) existing.fx = newSeg.fx;
        if (newSeg.sx !== undefined) existing.sx = newSeg.sx;
        if (newSeg.ix !== undefined) existing.ix = newSeg.ix;
        if (newSeg.pal !== undefined) existing.pal = newSeg.pal;
        if (newSeg.on !== undefined) existing.on = newSeg.on;
        if (newSeg.bri !== undefined) existing.bri = newSeg.bri;
      }
    }

    // Broadcast updated state to all WebSocket clients
    this.broadcastWsState();
  }

  private broadcastWsState(): void {
    const msg = JSON.stringify({ state: this.state });
    for (const socket of this.wsSockets) {
      this.sendWsTextFrame(socket, msg);
    }
  }

  private sendWsTextFrame(socket: Socket, text: string): void {
    try {
      const payload = Buffer.from(text, 'utf8');
      const len = payload.length;
      let frame: Buffer;

      if (len < 126) {
        frame = Buffer.alloc(2 + len);
        frame[0] = 0x81;
        frame[1] = len;
        payload.copy(frame, 2);
      } else if (len <= 65535) {
        frame = Buffer.alloc(4 + len);
        frame[0] = 0x81;
        frame[1] = 126;
        frame.writeUInt16BE(len, 2);
        payload.copy(frame, 4);
      } else {
        frame = Buffer.alloc(10 + len);
        frame[0] = 0x81;
        frame[1] = 127;
        frame.writeBigUInt64BE(BigInt(len), 2);
        payload.copy(frame, 10);
      }

      socket.write(frame);
    } catch {}
  }
}
