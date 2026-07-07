// Generate PWA icons (solid background + "M" glyph) as raw PNGs — no image deps.
const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');

function png(width, height, draw) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  const px = (x, y, [r, g, b, a = 255]) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const o = y * (1 + width * 4) + 1 + x * 4;
    raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
  };
  draw(px, width, height);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG = [0x45, 0x33, 0x24];      // dark bark brown
const FG = [0x7a, 0x8f, 0x6b];      // olive
function drawIcon(px, w, h) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(x, y, BG);
  // "M" glyph: two verticals + V between, sized to the maskable safe zone
  const t = Math.round(w * 0.085);            // stroke thickness
  const top = Math.round(h * 0.30), bot = Math.round(h * 0.72);
  const lx = Math.round(w * 0.26), rx = Math.round(w * 0.74) - t;
  const cx = Math.round(w * 0.5);
  for (let y = top; y < bot; y++) {
    for (let i = 0; i < t; i++) { px(lx + i, y, FG); px(rx + i, y, FG); }
  }
  const vBot = Math.round(h * 0.58);
  for (let y = top; y <= vBot; y++) {
    const f = (y - top) / (vBot - top);
    const xl = Math.round(lx + t / 2 + f * (cx - lx - t / 2));
    const xr = Math.round(rx + t / 2 - f * (rx + t / 2 - cx));
    for (let i = -Math.ceil(t / 2); i < Math.ceil(t / 2); i++) { px(xl + i, y, FG); px(xr + i, y, FG); }
  }
}

const out = path.join(__dirname, '..', 'web', 'public');
fs.mkdirSync(out, { recursive: true });
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(out, `icon-${size}.png`), png(size, size, drawIcon));
  console.log(`icon-${size}.png written`);
}
