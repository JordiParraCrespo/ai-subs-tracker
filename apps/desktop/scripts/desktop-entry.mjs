// Gives an unpackaged run on Linux its name and icon in the dock.
//
// A Linux desktop names a window and draws its icon from the `.desktop` file
// whose name is the window's app id, which Electron takes from `desktopName`
// in package.json (`resetowl`). A packaged install brings that file; running
// from this checkout (`pnpm desktop:dev`) has none, so the dock shows a
// generic cog and the package name. This writes one for the checkout:
//
//   node scripts/desktop-entry.mjs install     # after `node scripts/build.mjs`
//   node scripts/desktop-entry.mjs uninstall
//
// Opt-in and reversible: it writes only under $XDG_DATA_HOME (default
// ~/.local/share), marks its file `X-ResetOwl-Development=true`, never
// replaces a `resetowl.desktop` without that mark (an installed ResetOwl's),
// and `uninstall` removes only what carries it.
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const id = pkg.desktopName.replace(/\.desktop$/, '');
const MARK = 'X-ResetOwl-Development=true';

const dataHome = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
const entryFile = join(dataHome, 'applications', `${id}.desktop`);
const iconsSrc = join(root, 'dist', 'assets', 'icons');
const iconFile = (name) => {
  const size = name.replace(/\.png$/, '');
  return join(dataHome, 'icons', 'hicolor', size, 'apps', `${id}.png`);
};

function ours() {
  return existsSync(entryFile) && readFileSync(entryFile, 'utf8').includes(MARK);
}

/** Desktop-entry strings may not hold a raw newline; paths are quoted for Exec. */
function quote(arg) {
  return `"${arg.replace(/[\\"`$]/g, (c) => `\\${c}`)}"`;
}

/** Best effort: most desktops watch these folders anyway. */
function refreshCaches() {
  for (const [cmd, args] of [
    ['update-desktop-database', [join(dataHome, 'applications')]],
    ['gtk-update-icon-cache', ['-f', '-t', join(dataHome, 'icons', 'hicolor')]],
  ]) {
    try {
      execFileSync(cmd, args, { stdio: 'ignore' });
    } catch {
      // not installed, or nothing to do
    }
  }
}

function install() {
  if (existsSync(entryFile) && !ours()) {
    console.error(
      `${entryFile} is not this checkout's (an installed ResetOwl's?); leaving it as it is.`,
    );
    process.exit(1);
  }
  if (!existsSync(iconsSrc)) {
    console.error(`No icons at ${iconsSrc}: run \`node scripts/build.mjs\` first.`);
    process.exit(1);
  }
  const electron = createRequire(join(root, 'package.json'))('electron');
  for (const name of readdirSync(iconsSrc)) {
    mkdirSync(dirname(iconFile(name)), { recursive: true });
    copyFileSync(join(iconsSrc, name), iconFile(name));
  }
  mkdirSync(dirname(entryFile), { recursive: true });
  writeFileSync(
    entryFile,
    [
      '[Desktop Entry]',
      'Type=Application',
      `Name=${pkg.productName}`,
      `Comment=${pkg.description} (from ${root})`,
      `Exec=${quote(electron)} ${quote(root)} %U`,
      `Icon=${id}`,
      `StartupWMClass=${id}`,
      'Terminal=false',
      'Categories=Development;',
      MARK,
      '',
    ].join('\n'),
  );
  refreshCaches();
  console.log(`installed ${entryFile} and the ${id} icons; restart the app to see them.`);
}

function uninstall() {
  if (!existsSync(entryFile)) {
    console.log('nothing to remove');
    return;
  }
  if (!ours()) {
    console.error(`${entryFile} is not this checkout's; leaving it as it is.`);
    process.exit(1);
  }
  rmSync(entryFile);
  if (existsSync(iconsSrc))
    for (const name of readdirSync(iconsSrc)) rmSync(iconFile(name), { force: true });
  refreshCaches();
  console.log(`removed ${entryFile} and the ${id} icons`);
}

if (process.platform !== 'linux') {
  console.error('Only Linux needs this: macOS and Windows take the icon from the running app.');
  process.exit(1);
}
const command = process.argv[2];
if (command === 'install') install();
else if (command === 'uninstall') uninstall();
else {
  console.error('usage: desktop-entry.mjs install|uninstall');
  process.exit(1);
}
