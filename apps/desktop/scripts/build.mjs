// Bundles the main process and the preload into dist/ (CommonJS, Node
// platform, `electron` external; workspace packages are bundled from source
// through their `flama-source` export) and draws the owl icons: the tray's,
// and the app's for every platform.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const pkg = JSON.parse(
  await import('node:fs/promises').then((fs) => fs.readFile(join(root, 'package.json'), 'utf8')),
);

if (process.argv.includes('--require-renderer')) {
  const index = join(root, '..', 'web', 'dist', 'index.html');
  if (!existsSync(index)) {
    console.error(`No renderer at ${index}: build the screens first (see README).`);
    process.exit(1);
  }
}

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  conditions: ['flama-source'],
  sourcemap: 'linked',
  logLevel: 'warning',
};

await Promise.all([
  build({
    ...common,
    entryPoints: [join(root, 'src/main/index.ts')],
    outfile: join(dist, 'main.js'),
  }),
  build({
    ...common,
    entryPoints: [join(root, 'src/preload/index.ts')],
    outfile: join(dist, 'preload.js'),
  }),
]);

// --- icons: the owl, as PNG, no image library ---
//
// One shape in coordinates from -1 to 1 (y down): ear tufts, a round body, two
// eyes cut out with their pupils left in, and a small beak cut out. Each pixel
// is sampled 4×4 times so the edges stay smooth at 16px.

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function inTriangle(x, y, [ax, ay], [bx, by], [cx, cy]) {
  const s1 = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
  const s2 = (cx - bx) * (y - by) - (cy - by) * (x - bx);
  const s3 = (ax - cx) * (y - cy) - (ay - cy) * (x - cx);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}

/**
 * True where the owl is ink, in owl coordinates. `simple` (16px) drops the
 * pupils and the beak, which only blur at that size, and opens the eyes wider.
 */
function owl(x, y, simple = false) {
  const body = (x / 0.8) ** 2 + ((y - 0.12) / 0.84) ** 2 <= 1;
  const ears =
    inTriangle(x, y, [-0.78, -0.98], [-0.2, -0.55], [-0.8, -0.3]) ||
    inTriangle(x, y, [0.78, -0.98], [0.2, -0.55], [0.8, -0.3]);
  if (!body && !ears) return false;
  for (const ex of [-0.34, 0.34]) {
    const d = Math.hypot(x - ex, y + 0.08);
    if (d <= (simple ? 0.27 : 0.3)) return !simple && d <= 0.12; // a hole; the pupil stays
  }
  if (!simple && inTriangle(x, y, [-0.11, 0.14], [0.11, 0.14], [0, 0.36])) return false;
  return true;
}

/**
 * A square PNG. With `tile`, the owl is white on a rounded tile of `color`
 * (the app icon); without, it is `color` on transparent (the tray). `inset`
 * shrinks the tile inside a transparent margin, as macOS icons are drawn
 * (824 of 1024 on Apple's grid); elsewhere the tile fills the image.
 */
function png(size, color, { tile = false, inset = 1 } = {}) {
  const [r, g, b] = color;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const S = 4;
  const scale = tile ? 0.66 : 0.98; // owl size relative to the image
  const radius = 0.22; // tile corner, as a fraction of the size
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let ink = 0;
      let ground = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          // 0..1 across the tile (beyond it when `inset` leaves a margin)
          const px = ((x + (sx + 0.5) / S) / size - 0.5) / inset + 0.5;
          const py = ((y + (sy + 0.5) / S) / size - 0.5) / inset + 0.5;
          const ox = (px * 2 - 1) / scale;
          const oy = (py * 2 - 1) / scale;
          if (owl(ox, oy, size <= 16)) ink++;
          if (tile) {
            const qx = Math.max(Math.abs(px - 0.5) - (0.5 - radius), 0);
            const qy = Math.max(Math.abs(py - 0.5) - (0.5 - radius), 0);
            if (Math.hypot(qx, qy) <= radius) ground++;
          }
        }
      }
      const i = y * (size * 4 + 1) + 1 + x * 4;
      if (tile) {
        // White owl over the coloured tile.
        const a = ink / (S * S);
        raw[i] = Math.round(r + (255 - r) * a);
        raw[i + 1] = Math.round(g + (255 - g) * a);
        raw[i + 2] = Math.round(b + (255 - b) * a);
        raw[i + 3] = Math.round((255 * ground) / (S * S));
      } else {
        raw[i] = r;
        raw[i + 1] = g;
        raw[i + 2] = b;
        raw[i + 3] = Math.round((255 * ink) / (S * S));
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** The sizes of the Linux icon theme (hicolor) the app installs into. */
const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

const assets = join(dist, 'assets');
mkdirSync(assets, { recursive: true });
// The design system's brand purple (--ds-brand).
const brand = [0x77, 0x64, 0xd8];
writeFileSync(join(assets, 'tray.png'), png(16, brand));
writeFileSync(join(assets, 'tray@2x.png'), png(32, brand));
// macOS template images are black + alpha; the system tints them.
writeFileSync(join(assets, 'trayTemplate.png'), png(16, [0, 0, 0]));
writeFileSync(join(assets, 'trayTemplate@2x.png'), png(32, [0, 0, 0]));
// The app icon: the window and the dock in development, and what
// electron-builder turns into each platform's format (electron-builder.json).
// Linux takes the folder of sizes, named the way it expects (`<n>x<n>.png`);
// macOS the inset tile, from which it makes the .icns; Windows the full tile,
// from which it makes the .ico.
writeFileSync(join(assets, 'icon.png'), png(512, brand, { tile: true }));
writeFileSync(join(assets, 'icon-mac.png'), png(1024, brand, { tile: true, inset: 824 / 1024 }));
const icons = join(assets, 'icons');
mkdirSync(icons, { recursive: true });
for (const size of ICON_SIZES) {
  writeFileSync(join(icons, `${size}x${size}.png`), png(size, brand, { tile: true }));
}

console.log(`built ${pkg.name}@${pkg.version} → dist/`);
