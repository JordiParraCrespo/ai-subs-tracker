// Bundles the main process and the preload into dist/ (CommonJS, Node
// platform, `electron` external; workspace packages are bundled from source
// through their `flama-source` export) and draws the tray icons.
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

// --- tray icons: a ring with a filled arc, as PNG, no image library ---

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
function png(size, [r, g, b]) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const c = (size - 1) / 2;
  const outer = size / 2 - 0.5;
  const inner = outer - Math.max(1.5, size / 7);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      const angle = (Math.atan2(x - c, c - y) + 2 * Math.PI) % (2 * Math.PI);
      const ring = d <= outer && d >= inner;
      const dot = d <= inner - Math.max(1.5, size / 8) && angle < Math.PI * 1.4;
      const alpha = ring ? 255 : dot ? 200 : 0;
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = alpha;
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

const assets = join(dist, 'assets');
mkdirSync(assets, { recursive: true });
const brand = [0xf9, 0x73, 0x16];
writeFileSync(join(assets, 'tray.png'), png(16, brand));
writeFileSync(join(assets, 'tray@2x.png'), png(32, brand));
// macOS template images are black + alpha; the system tints them.
writeFileSync(join(assets, 'trayTemplate.png'), png(16, [0, 0, 0]));
writeFileSync(join(assets, 'trayTemplate@2x.png'), png(32, [0, 0, 0]));
writeFileSync(join(assets, 'icon.png'), png(512, brand));

console.log(`built ${pkg.name}@${pkg.version} → dist/`);
