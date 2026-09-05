// Fold the production build into one HTML file you can just open.
//
// `npm run build` emits dist/index.html plus a JS and a CSS file beside it,
// which is right for hosting and useless for "send it to my phone". This
// inlines both so the result opens over file:// with no server, no install
// and no network — which the game already required of itself (§0: fully
// offline, no network calls anywhere), so nothing is lost by doing it.
//
// The sprite atlas and the title logo are already inlined as data URIs by
// Vite's raised `assetsInlineLimit` (vite.config.ts), so there is nothing
// else to gather. `?inline` alone does not force this in the installed Vite
// version — confirmed the hard way when the title logo shipped as a real
// /assets/... URL that a file:// page cannot resolve; assetsInlineLimit is
// the actual mechanism, for every asset under the threshold.
//
//   npm run play    # build, bundle, and print the path

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const assets = join(dist, 'assets');

const files = readdirSync(assets);
const jsName = files.find((f) => f.endsWith('.js'));
const cssName = files.find((f) => f.endsWith('.css'));
if (!jsName || !cssName) {
  console.error('No build found in dist/assets. Run `npm run build` first.');
  process.exit(1);
}

// A literal closing tag inside the bundle would end the element early. Vite
// does not currently emit one, but a future dependency easily could, and the
// failure mode is a blank page rather than an error.
const escapeFor = (text, tag) => text.replaceAll(`</${tag}`, `<\\/${tag}`);

const js = escapeFor(readFileSync(join(assets, jsName), 'utf8'), 'script');
const css = escapeFor(readFileSync(join(assets, cssName), 'utf8'), 'style');

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Pro Wrestling: Rival Booker Battle</title>
    <style>
${css}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
${js}
    </script>
  </body>
</html>
`;

const out = join(dist, 'wrestling-booker.html');
writeFileSync(out, html);
const kb = Math.round(Buffer.byteLength(html) / 1024);
console.log(`\n  ${out}  (${kb} KB)\n`);
console.log('  Open it in any browser, or send the file to a phone. No server needed.\n');
