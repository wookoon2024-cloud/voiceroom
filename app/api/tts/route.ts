import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import tls from "tls";

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WIN_EPOCH = 11644473600;
const CHROMIUM_FULL_VERSION = "143.0.3650.75";
const CHROMIUM_MAJOR_VERSION = "143";
const SEC_MS_GEC_VERSION = `2-${CHROMIUM_FULL_VERSION}`;

export interface VoicePreset {
  voice: string;
  rate: string;
  pitch: string;
}

export const VOICE_PRESETS: Record<string, VoicePreset> = {
  male_injoon: { voice: "ko-KR-InJoonNeural", rate: "+0%", pitch: "+0Hz" },
  male_hyunsu: { voice: "ko-KR-HyunsuMultilingualNeural", rate: "+0%", pitch: "+0Hz" },
  male_deep: { voice: "ko-KR-InJoonNeural", rate: "-5%", pitch: "-18Hz" },
  male_bright: { voice: "ko-KR-HyunsuMultilingualNeural", rate: "+8%", pitch: "+14Hz" },
  female_sunhi: { voice: "ko-KR-SunHiNeural", rate: "+0%", pitch: "+0Hz" },
  female_cute: { voice: "ko-KR-SunHiNeural", rate: "+6%", pitch: "+18Hz" },
};

const _SHA256_INITIAL = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];
const _SHA256_STATE = [
  0xfd9fbea2, 0x91243ce7, 0xbe499094, 0xcd2e1e0a,
  0x6c006f49, 0x04bd35ab, 0xfeb0a7e4, 0x03effbd2,
];
const _SHA256_SCHEDULE = [
  0xeb24bf9e, 0x1558691f, 0xa0c09ee2, 0x0cfa32ba,
  0xa622ee8c, 0xd1dd9491, 0xc0dd25a0, 0xf9e70ab6,
  0xf0c31573, 0x7058ce4e, 0x7188e606, 0x00e5ab33,
  0xd258b060, 0x72766564,
];
const _SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const _SHA256_ADJUSTMENT = 0xc9dc06a7;
const _SHA256_BLOCK_CONSTANTS = [
  ..._SHA256_ROUND_CONSTANTS.slice(0, 14),
  _SHA256_ADJUSTMENT,
  ..._SHA256_ROUND_CONSTANTS.slice(15),
];
const _SHA256_SIGMA0_ADJUSTMENT = 0x059c0b80;
const _SHA256_SIGMA1_ADJUSTMENT = 0x000b92c0;
const _CS64_COEFFICIENTS: [number, number][] = [
  [0xe82e91b1, 0xb32700d0], [0x44de24c6, 0x88dff51d], [0x3beb65bc, 0x29514038], [0xc89c5933, 0xb328cbdf],
  [0x8d1ec211, 0xd405b4d5], [0x314ef5d5, 0x26e55f3c], [0xe92491b1, 0x607801c6], [0xf0a5b9d5, 0x82b2c1fb],
  [0x06064cf3, 0xfa51a3da], [0xda79fa60, 0x207cc464], [0xbed20560, 0x3c3c74f3], [0x89f9c9f8, 0xd2d14b61],
  [0x35fa38c6, 0xbb04a2c1], [0xcb49e3c6, 0xc5626167],
];
const _CS64_FACTOR = 0x82893933;
const _CS64_ADJUSTMENT0 = 0xf2f90b1a;
const _CS64_ADJUSTMENT1 = 0x0b1a0000;

let clockSkewSeconds = 0;

const u32 = (v: number) => v >>> 0;
const mul32 = (a: number, b: number) => Math.imul(a, b) >>> 0;
const add32 = (...args: number[]) => {
  let s = 0;
  for (const x of args) s = (s + (x >>> 0)) >>> 0;
  return s >>> 0;
};
const rol16 = (v: number) => (((v >>> 0) << 16) | ((v >>> 0) >>> 16)) >>> 0;
const rotr = (v: number, n: number) => (((v >>> 0) >>> n) | ((v >>> 0) << (32 - n))) >>> 0;
const sigma0 = (v: number) => (rotr(v, 7) ^ rotr(v, 18) ^ ((v >>> 0) >>> 3)) >>> 0;
const sigma1 = (v: number) => (rotr(v, 17) ^ rotr(v, 19) ^ ((v >>> 0) >>> 10)) >>> 0;

function sha256Rounds(state: number[], words: number[], firstRound = 0): number[] {
  let [a, b, c, d, e, f, g, h] = state.map(u32);
  const constants = firstRound === 14 ? _SHA256_BLOCK_CONSTANTS : _SHA256_ROUND_CONSTANTS;
  for (let i = firstRound; i < 64; i++) {
    const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
    const ch = (g ^ (e & (f ^ g))) >>> 0;
    const t1 = add32(h, S1, ch, constants[i], words[i]);
    const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
    const maj = ((a & b) | (c & (a | b))) >>> 0;
    const t2 = add32(S0, maj);
    h = g; g = f; f = e; e = add32(d, t1); d = c; c = b; b = a; a = add32(t1, t2);
  }
  return [a, b, c, d, e, f, g, h];
}

function expandSha256Schedule(words: number[], firstWord = 16) {
  for (let i = firstWord; i < 64; i++) {
    words.push(add32(sigma1(words[i - 2]), words[i - 7], sigma0(words[i - 15]), words[i - 16]));
  }
}

function sha256Init(data7: Buffer): number[] {
  const words = new Array(14).fill(0);
  words.push(((data7[0] << 16) | (data7[1] << 8) | data7[2]) >>> 0);
  words.push(((data7[3] << 24) | (data7[4] << 16) | (data7[5] << 8) | data7[6]) >>> 0);
  for (let i = 16; i < 30; i++) {
    let val = _SHA256_SCHEDULE[i - 16];
    if (i - 2 >= 14) {
      const s1 = sigma1(words[i - 2]);
      val = add32(val, i === 16 ? (s1 ^ _SHA256_SIGMA1_ADJUSTMENT) >>> 0 : s1);
    }
    if (i - 7 >= 14) val = add32(val, words[i - 7]);
    if (i - 15 >= 14) {
      const s0 = sigma0(words[i - 15]);
      val = add32(val, i === 29 ? (s0 ^ _SHA256_SIGMA0_ADJUSTMENT) >>> 0 : s0);
    }
    words.push(val);
  }
  words.push(
    add32(
      sigma1(words[28]),
      words[23],
      sigma0(words[15]),
      words[14],
      _SHA256_ADJUSTMENT,
      (0x100000000 - _SHA256_ROUND_CONSTANTS[14]) >>> 0
    )
  );
  expandSha256Schedule(words, 31);
  const working = sha256Rounds(_SHA256_STATE, words, 14);
  return _SHA256_INITIAL.map((x, idx) => add32(x, working[idx]));
}

function sha256Digest(data: Buffer): Buffer {
  const length = 57 + data.length;
  const padZeroLen = (((55 - length) % 64) + 64) % 64;
  const tail = data.subarray(7);
  const padded = Buffer.alloc(tail.length + 1 + padZeroLen + 8);
  tail.copy(padded, 0);
  padded[tail.length] = 0x80;
  padded.writeBigUInt64BE(BigInt(length * 8), padded.length - 8);

  let state = sha256Init(data.subarray(0, 7));
  for (let offset = 0; offset < padded.length; offset += 64) {
    const words: number[] = [];
    for (let j = 0; j < 16; j++) words.push(padded.readUInt32BE(offset + j * 4));
    expandSha256Schedule(words, 16);
    const working = sha256Rounds(state, words, 0);
    state = state.map((x, idx) => add32(x, working[idx]));
  }
  const out = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) out.writeUInt32BE(state[i], i * 4);
  return out;
}

function wordsLe4Even(data: Buffer): number[] {
  const rem = (4 - (data.length % 4)) % 4;
  const padded = rem === 0 ? data : Buffer.concat([data, Buffer.alloc(rem)]);
  const words: number[] = [];
  for (let i = 0; i < padded.length; i += 4) words.push(padded.readUInt32LE(i));
  if (words.length % 2 === 1) words.push(0);
  return words;
}

function cs64Digest(data: Buffer, digest: Buffer): [number, number] {
  const keyA = (digest.readUInt32LE(0) | 1) >>> 0;
  const keyB = (digest.readUInt32LE(4) | 1) >>> 0;
  const factors = [mul32(keyA, _CS64_FACTOR), mul32(keyB, _CS64_FACTOR)];
  const terms = _CS64_COEFFICIENTS.map(([coeff], idx) => mul32(coeff, factors[idx % 2]));
  const offsets = _CS64_COEFFICIENTS.map(([, off]) => off >>> 0);
  const inputWords = wordsLe4Even(Buffer.concat([Buffer.from([0x00]), data]));
  for (let idx = 0; idx < inputWords.length; idx++) {
    const word = inputWords[idx];
    let term = mul32(word, idx % 2 === 0 ? keyA : keyB);
    let offset = mul32(rol16(word), idx % 2 === 0 ? 0xef0569fb : 0xc31713db);
    if (idx === 0) {
      term = add32(term, mul32(_CS64_ADJUSTMENT0, factors[0]));
      offset = add32(offset, _CS64_ADJUSTMENT1);
    }
    terms.push(term);
    offsets.push(offset);
  }
  let swapAcc = 0, swapLast = 0, state = 0, acc = 0;
  for (let idx = 0; idx < terms.length; idx += 2) {
    const x = terms[idx], y = terms[idx + 1];
    let t = rol16(add32(offsets[idx], x));
    let q = mul32(t, 0x76f50f34);
    swapAcc = add32(swapAcc, add32(mul32(rol16(q), 0xc3efea97), q));
    t = rol16(add32(offsets[idx + 1], y));
    q = mul32(t, 0x1881ce3c);
    swapLast = add32(mul32(rol16(q), 0x35bd1ec9), q);
    swapAcc = add32(swapAcc, swapLast);
    state = add32(mul32(state, keyA), x);
    state = mul32(rol16(state), 0xcf98b111);
    state = mul32(rol16(state), 0x87085b9f);
    state = mul32(rol16(state), 0x12ceb96d);
    state = mul32(rol16(state), 0x257e1d83);
    acc = add32(acc, state);
    t = add32(mul32(state, keyB), y);
    t = mul32(rol16(t), 0xa27416f5);
    t = mul32(rol16(t), 0xd38396ff);
    state = mul32(rol16(mul32(rol16(t), 0x7c932b89)), 0xbfa49f69);
    acc = add32(acc, state);
  }
  return [(swapLast ^ state) >>> 0, (swapAcc ^ acc) >>> 0];
}

function generateSecMsGecV2(): string {
  const nowSec = Math.floor(Date.now() / 1000 + clockSkewSeconds);
  let ticks = BigInt(nowSec) + BigInt(WIN_EPOCH);
  ticks -= ticks % BigInt(300);
  ticks *= BigInt(10000000);
  const strToHash = Buffer.from(`${ticks.toString()}${TRUSTED_CLIENT_TOKEN}`, "ascii");
  const digest = sha256Digest(strToHash);
  const [cs0, cs1] = cs64Digest(strToHash, digest);
  const csBuf = Buffer.alloc(8);
  csBuf.writeUInt32LE(cs0, 0);
  csBuf.writeUInt32LE(cs1, 4);
  return `${csBuf.toString("hex").toUpperCase()}-${digest.toString("hex").toUpperCase()}`;
}

function encodeWsFrame(dataStr: string): Buffer {
  const payload = Buffer.from(dataStr, "utf8");
  const maskKey = crypto.randomBytes(4);
  let header: Buffer;
  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = 0x80 | payload.length;
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ maskKey[i % 4];
  return Buffer.concat([header, maskKey, masked]);
}

function synthesizeEdgeTTSOnce(
  text: string,
  voice: string,
  rate: string,
  pitch: string
): Promise<{ audio: Buffer; serverDate?: string }> {
  return new Promise((resolve, reject) => {
    const secMsGec = generateSecMsGecV2();
    const connectId = crypto.randomUUID().replace(/-/g, "");
    const path = `/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connectId}`;
    const wsKey = crypto.randomBytes(16).toString("base64");
    const muid = crypto.randomBytes(16).toString("hex").toUpperCase();

    const socket = tls.connect(
      443,
      "speech.platform.bing.com",
      { servername: "speech.platform.bing.com", timeout: 7000 },
      () => {
        const req = [
          `GET ${path} HTTP/1.1`,
          `Host: speech.platform.bing.com`,
          `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
          `Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold`,
          `Accept-Encoding: gzip, deflate, br, zstd`,
          `Accept-Language: en-US,en;q=0.9`,
          `Cookie: muid=${muid};`,
          `Pragma: no-cache`,
          `Cache-Control: no-cache`,
          `Upgrade: websocket`,
          `Connection: Upgrade`,
          `Sec-WebSocket-Key: ${wsKey}`,
          `Sec-WebSocket-Version: 13`,
          `\r\n`,
        ].join("\r\n");
        socket.write(req);
      }
    );

    let handshakeDone = false;
    let recvBuf = Buffer.alloc(0);
    const audioChunks: Buffer[] = [];
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.destroy();
        reject(new Error("Edge TTS timeout"));
      }
    }, 7000);

    socket.on("data", (chunk: Buffer) => {
      recvBuf = Buffer.concat([recvBuf, chunk]);
      if (!handshakeDone) {
        const idx = recvBuf.indexOf("\r\n\r\n");
        if (idx !== -1) {
          const headerStr = recvBuf.subarray(0, idx).toString("utf8");
          const dateMatch = headerStr.match(/^Date:\s*(.+)$/im);
          const serverDate = dateMatch ? dateMatch[1].trim() : undefined;

          if (!headerStr.includes("101 Switching Protocols")) {
            clearTimeout(timer);
            settled = true;
            socket.destroy();
            const err: any = new Error("Handshake failed: " + headerStr.split("\r\n")[0]);
            err.serverDate = serverDate;
            return reject(err);
          }
          handshakeDone = true;
          recvBuf = recvBuf.subarray(idx + 4);

          const configMsg =
            `X-Timestamp:${new Date().toISOString()}\r\n` +
            `Content-Type:application/json; charset=utf-8\r\n` +
            `Path:speech.config\r\n\r\n` +
            JSON.stringify({
              context: {
                synthesis: {
                  audio: {
                    metadataoptions: { sentenceBoundaryEnabled: "false", wordBoundaryEnabled: "false" },
                    outputFormat: "audio-24khz-48kbitrate-mono-mp3",
                  },
                },
              },
            });
          socket.write(encodeWsFrame(configMsg));

          const requestId = crypto.randomUUID().replace(/-/g, "");
          const safeText = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
          const ssml =
            `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ko-KR'>` +
            `<voice name='${voice}'>` +
            `<prosody pitch='${pitch}' rate='${rate}' volume='+0%'>${safeText}</prosody>` +
            `</voice></speak>`;

          const ssmlMsg =
            `X-RequestId:${requestId}\r\n` +
            `Content-Type:application/ssml+xml\r\n` +
            `X-Timestamp:${new Date().toISOString()}Z\r\n` +
            `Path:ssml\r\n\r\n` +
            ssml;
          socket.write(encodeWsFrame(ssmlMsg));
        }
      }

      if (handshakeDone) {
        while (recvBuf.length >= 2) {
          const byte0 = recvBuf[0];
          const byte1 = recvBuf[1];
          const opcode = byte0 & 0x0f;
          let payloadLen = byte1 & 0x7f;
          let offset = 2;
          if (payloadLen === 126) {
            if (recvBuf.length < 4) break;
            payloadLen = recvBuf.readUInt16BE(2);
            offset = 4;
          } else if (payloadLen === 127) {
            if (recvBuf.length < 10) break;
            payloadLen = Number(recvBuf.readBigUInt64BE(2));
            offset = 10;
          }
          if (recvBuf.length < offset + payloadLen) break;

          const frameData = recvBuf.subarray(offset, offset + payloadLen);
          recvBuf = recvBuf.subarray(offset + payloadLen);

          if (opcode === 0x01) {
            const str = frameData.toString("utf8");
            if (str.includes("Path:turn.end")) {
              clearTimeout(timer);
              settled = true;
              socket.end();
              return resolve({ audio: Buffer.concat(audioChunks) });
            }
          } else if (opcode === 0x02) {
            if (frameData.length >= 2) {
              const headerLen = frameData.readUInt16BE(0);
              const header = frameData.subarray(2, 2 + headerLen).toString("utf8");
              if (header.includes("Path:audio")) {
                audioChunks.push(frameData.subarray(2 + headerLen));
              }
            }
          } else if (opcode === 0x08) {
            clearTimeout(timer);
            settled = true;
            socket.end();
            return resolve({ audio: Buffer.concat(audioChunks) });
          }
        }
      }
    });

    socket.on("error", (err) => {
      if (!settled) {
        clearTimeout(timer);
        settled = true;
        reject(err);
      }
    });
  });
}

async function synthesizeEdgeTTS(text: string, presetKey: string): Promise<Buffer> {
  const preset = VOICE_PRESETS[presetKey] || VOICE_PRESETS.male_injoon;
  try {
    const res = await synthesizeEdgeTTSOnce(text, preset.voice, preset.rate, preset.pitch);
    if (res.audio.length > 0) return res.audio;
    throw new Error("Empty audio");
  } catch (err: any) {
    if (err?.serverDate) {
      const parsed = Date.parse(err.serverDate);
      if (!isNaN(parsed)) {
        clockSkewSeconds = (parsed - Date.now()) / 1000;
      }
    }
    const retry = await synthesizeEdgeTTSOnce(text, preset.voice, preset.rate, preset.pitch);
    return retry.audio;
  }
}

export async function GET(req: NextRequest) {
  const rawText = (req.nextUrl.searchParams.get("text") || "").trim();
  const voiceKey = (req.nextUrl.searchParams.get("voice") || "male_injoon").trim();

  if (!rawText) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const text = rawText.slice(0, 250);

  try {
    const mp3Buf = await synthesizeEdgeTTS(text, voiceKey);
    return new NextResponse(new Uint8Array(mp3Buf), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "TTS failed" }, { status: 500 });
  }
}
