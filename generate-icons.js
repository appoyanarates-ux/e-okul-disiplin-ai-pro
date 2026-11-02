import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, drawFn) {
  // RGBA buffer
  const stride = width * 4;
  const rawData = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (stride + 1);
    rawData[rowOffset] = 0; // Filter byte 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function crc32(buf) {
    let crc = 0 ^ -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  const crcTable = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }

  function makeChunk(type, data) {
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const chunkData = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(chunkData), 0);
    return Buffer.concat([lenBuf, chunkData, crcBuf]);
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Draw a beautiful circular / rounded shield badge with navy background, gold/white scale & gavel
function drawIcon(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const radius = w * 0.46;
  const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

  // Outer border & background (Dark Navy #0f172a to Royal Blue #1e40af gradient)
  if (dist > radius) {
    // Transparent outside
    return [0, 0, 0, 0];
  }

  // Smooth antialiasing at border
  const alphaEdge = Math.min(1, Math.max(0, radius - dist));

  // Gold Ring at edge (r between 0.40 and 0.45)
  if (dist >= radius - 10) {
    return [217, 119, 6, Math.floor(255 * alphaEdge)]; // Gold #d97706
  }

  // Gradient Navy background
  const grad = y / h;
  const rBg = Math.floor(15 + grad * 20); // 15 - 35
  const gBg = Math.floor(23 + grad * 45); // 23 - 68
  const bBg = Math.floor(42 + grad * 120); // 42 - 162

  // Central emblem: Scales of Justice + Gavel design
  // Normalised coords (-1 to +1 from center)
  const nx = (x - cx) / (w * 0.4);
  const ny = (y - cy) / (h * 0.4);

  // Center vertical stem: nx between -0.04 and 0.04, ny between -0.4 and 0.5
  const inStem = Math.abs(nx) < 0.04 && ny > -0.45 && ny < 0.5;

  // Top horizontal bar: ny between -0.45 and -0.38, nx between -0.65 and 0.65
  const inTopBar = ny >= -0.45 && ny <= -0.38 && Math.abs(nx) <= 0.65;

  // Left scale pan triangle strings:
  const leftDist = Math.hypot(nx - (-0.5), ny - (-0.38));
  const inLeftStrings = (Math.abs(nx - (-0.5)) * 0.7 + (ny - (-0.38))) > 0 && ny < 0.05 && (
    Math.abs((ny - (-0.38)) - 1.2 * Math.abs(nx - (-0.5))) < 0.04
  );
  // Left pan bowl:
  const inLeftBowl = Math.hypot((nx - (-0.5)) * 1.5, ny - 0.08) < 0.22 && ny >= 0.05 && ny <= 0.2;

  // Right scale pan strings:
  const inRightStrings = (Math.abs(nx - 0.5) * 0.7 + (ny - (-0.38))) > 0 && ny < 0.05 && (
    Math.abs((ny - (-0.38)) - 1.2 * Math.abs(nx - 0.5)) < 0.04
  );
  // Right pan bowl:
  const inRightBowl = Math.hypot((nx - 0.5) * 1.5, ny - 0.08) < 0.22 && ny >= 0.05 && ny <= 0.2;

  // Base pedestal: ny between 0.45 and 0.58, nx tapering
  const inBase = ny >= 0.48 && ny <= 0.62 && Math.abs(nx) <= (0.45 - (ny - 0.48) * 0.5);

  // Gavel diagonal angle through center:
  // (x*cos - y*sin)
  const angle = 0.55;
  const gx = nx * Math.cos(angle) - ny * Math.sin(angle);
  const gy = nx * Math.sin(angle) + ny * Math.cos(angle);
  const inGavelHead = Math.abs(gx) < 0.16 && Math.abs(gy - 0.05) < 0.45;
  const inGavelHandle = Math.abs(gx - 0.0) < 0.035 && gy > 0.05 && gy < 0.85;

  if (inStem || inTopBar || inLeftBowl || inRightBowl || inBase) {
    // Scales in Bright Warm Gold
    return [245, 158, 11, Math.floor(255 * alphaEdge)];
  }

  if (inLeftStrings || inRightStrings) {
    return [254, 240, 138, Math.floor(255 * alphaEdge)];
  }

  if (inGavelHead || inGavelHandle) {
    // Gavel in crisp White-Silver
    return [248, 250, 252, Math.floor(255 * alphaEdge)];
  }

  // Inner subtle badge glow
  if (dist < radius * 0.7) {
    const glow = (1 - dist / (radius * 0.7)) * 0.15;
    return [
      Math.min(255, Math.floor(rBg + 255 * glow)),
      Math.min(255, Math.floor(gBg + 255 * glow)),
      Math.min(255, Math.floor(bBg + 255 * glow)),
      Math.floor(255 * alphaEdge)
    ];
  }

  return [rBg, gBg, bBg, Math.floor(255 * alphaEdge)];
}

async function main() {
  const pngToIco = (await import('png-to-ico')).default;

  const buildDir = path.resolve('build');
  const publicDir = path.resolve('public');
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  const png256 = createPng(256, 256, drawIcon);
  fs.writeFileSync(path.join(buildDir, 'icon.png'), png256);
  fs.writeFileSync(path.join(publicDir, 'icon.png'), png256);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), png256);

  console.log('Generated build/icon.png & public/icon.png');

  const icoBuf = await pngToIco(path.join(buildDir, 'icon.png'));
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuf);
  fs.writeFileSync(path.join(publicDir, 'icon.ico'), icoBuf);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuf);

  console.log('Successfully generated Windows build/icon.ico and public/icon.ico!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
