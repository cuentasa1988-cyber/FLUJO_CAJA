const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation
function makeCrcTable() {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crcData = chunk.subarray(4, 8 + len);
  const crcVal = crc32(crcData);
  chunk.writeUInt32BE(crcVal, 8 + len);
  return chunk;
}

function createPng(width, height, drawFn) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  
  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // deflate
  ihdrData.writeUInt8(0, 11); // adaptive filter
  ihdrData.writeUInt8(0, 12); // no interlace
  const ihdrChunk = writeChunk('IHDR', ihdrData);

  // Raw image scanlines
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const idatCompressed = zlib.deflateSync(rawData);
  const idatChunk = writeChunk('IDAT', idatCompressed);
  const iendChunk = writeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Icon rendering logic for CashFlow Pro
function renderIcon(x, y, width, height, isMaskable = false) {
  const nx = x / width;
  const ny = y / height;

  // Background corner rounding if not maskable
  if (!isMaskable) {
    const cornerR = 0.22;
    const dx = Math.max(0, Math.abs(nx - 0.5) - (0.5 - cornerR));
    const dy = Math.max(0, Math.abs(ny - 0.5) - (0.5 - cornerR));
    if (Math.hypot(dx, dy) > cornerR) {
      return [0, 0, 0, 0]; // transparent outside rounded square
    }
  }

  // Deep luxury dark background gradient (0F172A -> 020617)
  const grad = ny;
  const bgR = Math.round(15 * (1 - grad) + 2 * grad);
  const bgG = Math.round(23 * (1 - grad) + 6 * grad);
  const bgB = Math.round(42 * (1 - grad) + 23 * grad);

  let r = bgR, g = bgG, b = bgB, a = 255;

  // Scale coordinates to standard 512 space
  const sx = nx * 512;
  const sy = ny * 512;

  // Bar 1: x 136..184, y 270..380 (Slate 334155)
  if (sx >= 136 && sx <= 184 && sy >= 270 && sy <= 380) {
    return [51, 65, 85, 255];
  }

  // Bar 2: x 204..252, y 210..380 (Sky Blue 0284C7)
  if (sx >= 204 && sx <= 252 && sy >= 210 && sy <= 380) {
    const t = (sy - 210) / 170;
    return [
      Math.round(56 * (1 - t) + 2 * t),
      Math.round(189 * (1 - t) + 132 * t),
      Math.round(248 * (1 - t) + 199 * t),
      255
    ];
  }

  // Bar 3: x 272..320, y 150..380 (Emerald 10B981)
  if (sx >= 272 && sx <= 320 && sy >= 150 && sy <= 380) {
    const t = (sy - 150) / 230;
    return [
      Math.round(52 * (1 - t) + 5 * t),
      Math.round(211 * (1 - t) + 150 * t),
      Math.round(153 * (1 - t) + 105 * t),
      255
    ];
  }

  // Cashflow Circle badge at (370, 330), r=44
  const distCircle = Math.hypot(sx - 370, sy - 330);
  if (distCircle <= 44) {
    // Check if drawing the '$' sign inside
    const isInnerDollar = (
      // vertical spine
      (Math.abs(sx - 370) <= 4 && sy >= 306 && sy <= 354) ||
      // top loop
      (Math.abs(sx - 370) <= 18 && Math.abs(sy - 317) <= 4) ||
      // mid stroke
      (Math.abs(sx - 370) <= 18 && Math.abs(sy - 330) <= 4) ||
      // bottom stroke
      (Math.abs(sx - 370) <= 18 && Math.abs(sy - 343) <= 4) ||
      // left top arch
      (sx >= 352 && sx <= 358 && sy >= 317 && sy <= 330) ||
      // right bottom arch
      (sx >= 382 && sx <= 388 && sy >= 330 && sy <= 343)
    );

    if (isInnerDollar) {
      return [6, 78, 59, 255]; // Deep rich emerald dark for dollar
    }
    return [52, 211, 153, 255]; // Vibrant mint/emerald circle
  }

  // Dynamic upward arrow curve:
  // Points: (130, 270) to (355, 120)
  const lineT = (sx - 130) / (355 - 130);
  if (lineT >= 0 && lineT <= 1) {
    const expectedY = 270 - 150 * Math.pow(lineT, 0.85);
    if (Math.abs(sy - expectedY) <= 10) {
      return [52, 211, 153, 255];
    }
  }

  // Arrowhead at (355, 120)
  const dArrow = Math.hypot(sx - 355, sy - 120);
  if (dArrow <= 24 && sx >= 335 && sy <= 135) {
    return [52, 211, 153, 255];
  }

  return [r, g, b, a];
}

const publicDir = path.resolve(__dirname, '../public');

console.log('Generating PWA icons...');
const png192 = createPng(192, 192, (x, y, w, h) => renderIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);

const png512 = createPng(512, 512, (x, y, w, h) => renderIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);

const pngMaskable = createPng(512, 512, (x, y, w, h) => renderIcon(x, y, w, h, true));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pngMaskable);

const appleIcon = createPng(180, 180, (x, y, w, h) => renderIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleIcon);

const favicon = createPng(32, 32, (x, y, w, h) => renderIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), favicon);

console.log('All PWA icons generated successfully!');
