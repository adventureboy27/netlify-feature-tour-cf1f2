// Generates the vector (SVG) paperdoll asset set: faces, hair, facial hair,
// props and clothing, fitted to the real base bodies.
//
// Why generated rather than hand-saved files: the two real base bodies do
// not share a head size (the female head is ~16% wider and ~20% taller than
// the male one), so one "both-" file can never fit both. Every head-space
// shape here is authored once in head-normalized coordinates — u = -1..1
// across the skull's half-width, v = 0 at the crown and 1 at the chin — and
// emitted once per gender through that gender's measured head box.
//
// The HEAD and GAP numbers below were measured from the alpha channel of
// base/m.png and base/f.png scaled to a 512 canvas. If a base body is ever
// replaced, re-measure and re-run:  node tools/gen-paperdoll-assets.mjs
//
// Real painted art still wins: drop a PNG with the same name into the same
// folder and delete the generated .svg next to it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/ui/paperdoll/assets');

const HEAD = {
  m: { cx: 253.5, top: 12, hw: 42.5, H: 106 },
  f: { cx: 255.5, top: 12, hw: 49.5, H: 128 },
};

// Centre of the transparent gap between each arm and the torso, top
// (armpit) to bottom, as [y, leftX, rightX]. Clothing edges run down these
// so a garment never paints an arm.
const GAP = {
  m: [[304, 151, 358], [320, 155, 355], [336, 158.5, 351], [360, 156.5, 354], [392, 157.5, 353], [424, 155, 356.5], [440, 149, 362], [456, 141.5, 369.5], [472, 136, 375], [496, 130, 381], [512, 127, 384]],
  f: [[280, 162.5, 349], [296, 156.5, 354.5], [312, 155.5, 355.5], [328, 158.5, 352.5], [344, 166, 345], [368, 163.5, 347], [392, 167, 343.5], [416, 163, 348.5], [440, 154, 356.5], [456, 147.5, 363], [472, 141.5, 369], [496, 136.5, 374], [512, 134, 377]],
};

const GREY = '#b0b0b0';
const INK = '#2a1a12';
const r1 = (n) => Math.round(n * 10) / 10;

/** Head-space path ("u,v" pairs, absolute M/L/C/Q/Z only) -> canvas-space path. */
function hp(g, d) {
  const h = HEAD[g];
  return d.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (_, u, v) => `${r1(h.cx + u * h.hw)},${r1(h.top + v * h.H)}`);
}
const mirror = (d) => d.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (_, u, v) => `${-u},${v}`);
const both = (d) => `${d} ${mirror(d)}`;

// "xl" files carry a margin around the 512 canvas — 64 each side, 128 on
// top — so a tall hat or big hair has somewhere to go. ComposedPortrait
// positions a `--xl` layer to match (see paperdollAssets.ts).
const svg = (body, xl = false) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${xl ? '-64 -128 640 640' : '0 0 512 512'}">${body}</svg>\n`;
const fill = (d, color = GREY, extra = '') =>
  `<path d="${d}" fill="${color}"${extra.includes('fill-rule') ? '' : ' fill-rule="evenodd"'}${extra}/>`;
const stroke = (d, color, w, extra = '') =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;

/** An ellipse in head space, as a closed path, so it can join an evenodd fill. */
function oval(u, v, ru, rv) {
  const k = 0.5523;
  return `M ${u - ru},${v} C ${u - ru},${v - rv * k} ${u - ru * k},${v - rv} ${u},${v - rv} C ${u + ru * k},${v - rv} ${u + ru},${v - rv * k} ${u + ru},${v} C ${u + ru},${v + rv * k} ${u + ru * k},${v + rv} ${u},${v + rv} C ${u - ru * k},${v + rv} ${u - ru},${v + rv * k} ${u - ru},${v} Z`.replace(
    /-?\d+\.\d{4,}/g,
    (n) => String(Math.round(n * 1000) / 1000),
  );
}

/** A scalloped arc over the head (afro outline), from the left ear round to the right. */
function scallops(cu, cv, ru, rv, n) {
  const pt = (t) => [cu + ru * Math.cos(t), cv - rv * Math.sin(t)];
  const a0 = Math.PI * 1.12;
  const a1 = -Math.PI * 0.12;
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    const [u, v] = pt(t);
    if (i === 0) d += `M ${r3(u)},${r3(v)}`;
    else {
      const tm = a0 + ((a1 - a0) * (i - 0.5)) / n;
      const [bu, bv] = [cu + ru * 1.16 * Math.cos(tm), cv - rv * 1.16 * Math.sin(tm)];
      d += ` Q ${r3(bu)},${r3(bv)} ${r3(u)},${r3(v)}`;
    }
  }
  return d;
}
const r3 = (n) => Math.round(n * 1000) / 1000;

/** A hanging braid / dreadlock: a chain of overlapping lumps between two points. */
function chain(u0, v0, u1, v1, n, ru, rv) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    d += `${oval(r3(u0 + (u1 - u0) * t), r3(v0 + (v1 - v0) * t), ru * (1 - t * 0.35), rv)} `;
  }
  return d;
}

// ---------------------------------------------------------------- hair ----

const HAIRLINE = 'C .95,.36 .9,.27 .7,.22 C .35,.17 -.35,.17 -.7,.22 C -.9,.27 -.95,.36 -.97,.5';
const CAP = 'M -1.06,.5 C -1.14,.1 -.74,-.08 0,-.08 C .74,-.08 1.14,.1 1.06,.5 L .97,.5';
const capTo = (sideV) => CAP.replaceAll('.5', String(sideV));
const SLICK =
  'M -1.08,.56 C -1.18,.08 -.8,-.1 0,-.1 C .8,-.1 1.18,.08 1.08,.56 L .97,.56 C .97,.36 .88,.24 .6,.17 C .3,.12 .12,.16 0,.22 C -.12,.16 -.3,.12 -.6,.17 C -.88,.24 -.97,.36 -.97,.56 Z';
const PARTED =
  'M -1.07,.54 C -1.16,.08 -.78,-.1 0,-.1 C .78,-.1 1.16,.08 1.07,.54 L .97,.54 C .96,.36 .86,.25 .55,.19 L .12,.14 L 0,.2 L -.12,.14 L -.55,.19 C -.86,.25 -.96,.36 -.97,.54 Z';

const HAIR = {
  buzzcut: { g: 'm', d: `${CAP} ${HAIRLINE} Z` },
  crewcut: {
    g: 'm',
    d: 'M -1.06,.48 C -1.16,.06 -.8,-.1 0,-.1 C .8,-.1 1.16,.06 1.06,.48 L .96,.48 C .96,.34 .9,.25 .75,.2 C .4,.11 -.1,.13 -.45,.24 C -.7,.19 -.9,.28 -.96,.48 Z',
  },
  slickback: { g: 'm', d: SLICK },
  mohawk: {
    g: 'mf',
    d: 'M -.32,.21 C -.38,.05 -.32,-.1 -.2,-.1 L -.1,-.03 L 0,-.11 L .1,-.03 L .2,-.1 C .32,-.1 .38,.05 .32,.21 C .15,.15 -.15,.15 -.32,.21 Z',
    faint: `${CAP} ${HAIRLINE} Z`,
  },
  shaggy: {
    g: 'm',
    d: 'M -1.22,.95 C -1.4,.5 -1.3,-.02 -.5,-.1 C -.2,-.12 .2,-.12 .5,-.1 C 1.3,-.02 1.4,.5 1.22,.95 L 1.0,.8 C 1.05,.6 1.0,.45 .92,.36 C .8,.42 .7,.34 .62,.24 C .5,.36 .3,.36 .2,.24 C .05,.38 -.2,.38 -.3,.24 C -.45,.38 -.65,.36 -.72,.26 C -.8,.4 -.92,.4 -.95,.36 C -1.02,.5 -1.05,.65 -1.0,.8 Z',
  },
  long: {
    g: 'm',
    d: 'M 0,-.1 C .9,-.1 1.25,.1 1.25,.6 C 1.25,1.2 1.45,1.6 1.65,1.95 L 1.0,2.0 C 1.02,1.5 .98,1.0 .96,.6 C .94,.38 .7,.22 .1,.16 L 0,.2 L -.1,.16 C -.7,.22 -.94,.38 -.96,.6 C -.98,1.0 -1.02,1.5 -1.0,2.0 L -1.65,1.95 C -1.45,1.6 -1.25,1.2 -1.25,.6 C -1.25,.1 -.9,-.1 0,-.1 Z',
  },
  'loose-long': {
    g: 'f',
    d: 'M 0,-.1 C .95,-.1 1.3,.1 1.3,.6 C 1.3,1.2 1.5,1.7 1.72,2.15 L .92,2.2 C 1.02,1.6 1.0,1.0 .96,.6 C .92,.36 .6,.2 -.35,.16 C -.75,.24 -.94,.4 -.96,.6 C -1.0,1.0 -1.02,1.6 -.92,2.2 L -1.72,2.15 C -1.5,1.7 -1.3,1.2 -1.3,.6 C -1.3,.1 -.95,-.1 0,-.1 Z',
  },
  ponytail: {
    g: 'mf',
    d: { m: `${SLICK} M .9,.75 C 1.3,.9 1.45,1.4 1.3,1.95 C 1.2,1.6 1.1,1.3 .88,1.05 Z`, f: `${PARTED} M .98,.2 C 1.5,.1 1.8,.5 1.7,1.1 C 1.65,1.5 1.5,1.75 1.35,1.9 C 1.4,1.5 1.35,1.0 1.15,.7 C 1.1,.55 1.02,.45 .98,.4 Z` },
  },
  bob: {
    g: 'f',
    d: 'M 0,-.1 C .95,-.1 1.3,.15 1.32,.6 C 1.34,.85 1.3,1.02 1.2,1.12 L .9,1.08 C .98,.85 .98,.6 .94,.45 C .85,.3 .5,.2 -.3,.18 C -.6,.3 -.9,.36 -.95,.5 C -.98,.7 -.98,.9 -.9,1.08 L -1.2,1.12 C -1.3,1.02 -1.34,.85 -1.32,.6 C -1.3,.15 -.95,-.1 0,-.1 Z',
  },
  braids: { g: 'f', d: `${PARTED} ${chain(1.08, 0.62, 1.3, 2.2, 9, 0.2, 0.1)} ${chain(-1.08, 0.62, -1.3, 2.2, 9, 0.2, 0.1)}` },
  'space-buns': { g: 'f', d: `${PARTED} ${oval(0.86, 0.07, 0.34, 0.13)} ${oval(-0.86, 0.07, 0.34, 0.13)}` },
  undercut: {
    g: 'mf',
    d: 'M -.9,.3 C -1.0,.0 -.5,-.1 .1,-.1 C .9,-.1 1.3,.15 1.3,.55 C 1.3,.7 1.2,.8 1.1,.85 C 1.05,.6 .95,.4 .7,.3 C .3,.2 -.4,.18 -.9,.3 Z',
    faint: 'M -1.05,.52 C -1.08,.3 -1.0,.18 -.9,.12 L -.9,.3 C -.95,.36 -.96,.44 -.96,.52 Z',
  },
  afro: { g: 'mf', d: `${scallops(0, 0.3, 1.45, 0.42, 9)} L .96,.5 C .9,.25 .5,.18 0,.18 C -.5,.18 -.9,.25 -.96,.5 Z` },
  pixie: {
    g: 'f',
    d: 'M -1.08,.62 C -1.18,.06 -.8,-.1 0,-.1 C .8,-.1 1.18,.06 1.08,.62 L .98,.66 C 1.0,.44 .92,.32 .8,.26 C .6,.34 .3,.3 .1,.2 C -.1,.34 -.5,.36 -.78,.28 C -.92,.34 -1.0,.46 -.98,.66 Z',
  },
  dreads: {
    g: 'm',
    d: `${CAP} ${HAIRLINE} Z ${[-1.3, -1.08, 1.08, 1.3].map((u, i) => chain(u * 0.88, 0.5, u, 1.5 + (i % 2) * 0.25, 7, 0.11, 0.1)).join(' ')}`,
  },
};

const CREW =
  'M -1.06,.48 C -1.16,.06 -.8,-.1 0,-.1 C .8,-.1 1.16,.06 1.06,.48 L .96,.48 C .96,.34 .9,.25 .75,.2 C .4,.11 -.1,.13 -.45,.24 C -.7,.19 -.9,.28 -.96,.48 Z';
const LOOSE =
  'M 0,-.1 C .95,-.1 1.3,.1 1.3,.6 C 1.3,1.2 1.5,1.7 1.72,2.15 L .92,2.2 C 1.02,1.6 1.0,1.0 .96,.6 C .92,.36 .6,.2 -.35,.16 C -.75,.24 -.94,.4 -.96,.6 C -1.0,1.0 -1.02,1.6 -.92,2.2 L -1.72,2.15 C -1.5,1.7 -1.3,1.2 -1.3,.6 C -1.3,.1 -.95,-.1 0,-.1 Z';
Object.assign(HAIR, {
  mohawk: {
    g: 'mf',
    d: 'M -.3,.21 C -.38,-.1 -.3,-.45 0,-.55 C .3,-.45 .38,-.1 .3,.21 C .15,.15 -.15,.15 -.3,.21 Z',
    faint: `${CAP} ${HAIRLINE} Z`,
  },
  afro: { g: 'mf', d: `${scallops(0, 0.22, 1.6, 0.62, 11)} L .96,.5 C .9,.25 .5,.18 0,.18 C -.5,.18 -.9,.25 -.96,.5 Z` },
  flattop: {
    g: 'm',
    d: 'M -1.06,.48 L -1.1,-.04 C -1.1,-.18 -1.0,-.2 -.9,-.2 L .9,-.2 C 1.0,-.2 1.1,-.18 1.1,-.04 L 1.06,.48 L .96,.48 C .96,.32 .9,.24 .7,.2 C .35,.16 -.35,.16 -.7,.2 C -.9,.24 -.96,.32 -.96,.48 Z',
  },
  pompadour: {
    g: 'mf',
    d: 'M -1.07,.54 C -1.16,.1 -1.0,-.1 -.6,-.2 C -.2,-.46 .7,-.44 .95,-.1 C 1.12,.1 1.12,.3 1.07,.54 L .97,.54 C .97,.36 .9,.26 .7,.2 C .3,.26 -.3,.2 -.6,.1 C -.8,.2 -.95,.34 -.97,.54 Z',
  },
  mullet: { g: 'mf', d: `${CREW} ${both('M .98,.5 C 1.15,.8 1.3,1.2 1.5,1.55 L .93,1.5 C .98,1.1 .95,.8 .92,.6 Z')}` },
  combover: {
    g: 'm',
    d: `${both('M -1.06,.6 C -1.12,.4 -1.05,.25 -.95,.2 L -.9,.34 C -.96,.4 -.97,.5 -.96,.6 Z')} M -.95,.22 C -.4,-.07 .4,-.07 .92,.12 L .92,.16 C .4,-.03 -.4,-.03 -.95,.27 Z M -.93,.3 C -.4,.03 .4,.03 .9,.2 L .9,.24 C .4,.07 -.4,.07 -.93,.35 Z M -.9,.14 C -.4,-.11 .3,-.11 .8,.02 L .8,.06 C .3,-.07 -.4,-.07 -.9,.19 Z`,
  },
  'friar-bald': { g: 'm', d: both('M -1.09,.64 C -1.18,.4 -1.1,.2 -.96,.14 L -.9,.3 C -.97,.4 -.98,.5 -.97,.64 Z') },
  spiky: {
    g: 'mf',
    d: `M -1.06,.5 L -1.22,.2 L -.96,.12 L -1.02,-.16 L -.7,-.02 L -.6,-.32 L -.35,-.08 L -.15,-.38 L .05,-.1 L .3,-.36 L .45,-.06 L .75,-.28 L .8,.02 L 1.1,-.1 L 1.0,.18 L 1.22,.26 L 1.06,.5 L .97,.5 ${HAIRLINE} Z`,
  },
  'liberty-spikes': {
    g: 'mf',
    d: 'M -.34,.2 L -.55,-.5 L -.22,-.1 L -.16,-.85 L 0,-.14 L .16,-.85 L .22,-.1 L .55,-.5 L .34,.2 C .15,.14 -.15,.14 -.34,.2 Z',
    faint: `${CAP} ${HAIRLINE} Z`,
  },
  topknot: { g: 'm', d: `${SLICK} ${oval(0, -0.2, 0.3, 0.14)}` },
  bowl: { g: 'mf', d: 'M -1.1,.44 C -1.2,.05 -.8,-.12 0,-.12 C .8,-.12 1.2,.05 1.1,.44 C .6,.35 -.6,.35 -1.1,.44 Z' },
  curtains: {
    g: 'm',
    d: 'M 0,-.1 C .9,-.1 1.22,.1 1.2,.55 C 1.2,.75 1.12,.85 1.02,.9 C 1.02,.6 .9,.35 .1,.14 L 0,.2 L -.1,.14 C -.9,.35 -1.02,.6 -1.02,.9 C -1.12,.85 -1.2,.75 -1.2,.55 C -1.22,.1 -.9,-.1 0,-.1 Z',
  },
  'long-curly': { g: 'mf', d: `${PARTED} ${chain(1.12, 0.3, 1.4, 1.75, 10, 0.32, 0.13)} ${chain(-1.12, 0.3, -1.4, 1.75, 10, 0.32, 0.13)}` },
  'long-wavy': { g: 'f', d: `${LOOSE} ${chain(1.3, 0.6, 1.6, 2.1, 7, 0.26, 0.14)} ${chain(-1.3, 0.6, -1.6, 2.1, 7, 0.26, 0.14)}` },
  pigtails: { g: 'f', d: `${PARTED} ${both('M 1.0,.4 C 1.5,.3 1.9,.6 1.8,1.2 C 1.75,1.5 1.6,1.65 1.5,1.7 C 1.55,1.3 1.45,.9 1.05,.62 Z')}` },
  'high-bun': { g: 'f', d: `${PARTED} ${oval(0, -0.26, 0.44, 0.2)}` },
  beehive: {
    g: 'f',
    d: 'M -1.07,.54 C -1.25,.0 -1.0,-.78 0,-.82 C 1.0,-.78 1.25,.0 1.07,.54 L .97,.54 C .96,.36 .86,.25 .55,.19 L 0,.16 L -.55,.19 C -.86,.25 -.96,.36 -.97,.54 Z',
  },
  'long-bangs': {
    g: 'f',
    d: 'M 0,-.1 C .95,-.1 1.28,.1 1.28,.6 L 1.42,2.1 L .95,2.1 L .96,.6 L .94,.36 C .5,.4 -.5,.4 -.94,.36 L -.96,.6 L -.95,2.1 L -1.42,2.1 L -1.28,.6 C -1.28,.1 -.95,-.1 0,-.1 Z',
  },
  'curly-bob': { g: 'f', d: `${scallops(0, 0.5, 1.4, 0.64, 10)} L .96,.6 C .92,.3 .5,.2 0,.2 C -.5,.2 -.92,.3 -.96,.6 Z` },
  'half-up': { g: 'f', d: `${LOOSE} ${oval(0, -0.2, 0.3, 0.14)}` },
  'side-pony': { g: 'f', d: `${PARTED} M -1.0,.4 C -1.5,.3 -1.95,.6 -1.85,1.3 C -1.8,1.7 -1.6,1.9 -1.45,1.95 C -1.55,1.4 -1.45,.9 -1.05,.62 Z` },
});

// ---------------------------------------------------------- facial hair ----

const MOUTH_HOLE = 'M -.2,.84 C -.1,.81 .1,.81 .2,.84 C .12,.89 -.12,.89 -.2,.84 Z';
const BEARD =
  'M -1.0,.6 C -1.0,.85 -.85,1.05 -.5,1.14 C -.2,1.2 .2,1.2 .5,1.14 C .85,1.05 1.0,.85 1.0,.6 L .88,.62 C .8,.74 .55,.76 .36,.74 C .2,.7 -.2,.7 -.36,.74 C -.55,.76 -.8,.74 -.88,.62 Z';
const FACIAL = {
  goatee: { d: `M -.34,.76 C -.36,.92 -.3,1.06 0,1.08 C .3,1.06 .36,.92 .34,.76 C .2,.72 -.2,.72 -.34,.76 Z ${MOUTH_HOLE}` },
  fullbeard: { d: `${BEARD} ${MOUTH_HOLE}` },
  stubble: { d: `${BEARD} ${MOUTH_HOLE}`, opacity: 0.32 },
  moustache: { d: 'M -.38,.8 C -.3,.72 -.1,.7 0,.74 C .1,.7 .3,.72 .38,.8 C .2,.8 .1,.81 0,.79 C -.1,.81 -.2,.8 -.38,.8 Z' },
  horseshoe: { d: 'M -.38,.74 C -.2,.69 .2,.69 .38,.74 L .42,1.02 L .27,1.02 L .25,.81 C .1,.78 -.1,.78 -.25,.81 L -.27,1.02 L -.42,1.02 Z' },
  chinstrap: {
    d: 'M -1.0,.6 C -1.0,.85 -.85,1.05 -.5,1.12 C -.2,1.17 .2,1.17 .5,1.12 C .85,1.05 1.0,.85 1.0,.6 L .9,.62 C .88,.8 .75,.96 .45,1.02 C .2,1.06 -.2,1.06 -.45,1.02 C -.75,.96 -.88,.8 -.9,.62 Z',
  },
};

// ----------------------------------------------------------------- face ----
// Never recolored. Dark linework plus eye whites, so it reads on every skin
// tone; drawn under hair, facial hair and props.

function face(g, kind) {
  const h = HEAD[g];
  const brow = {
    neutral: 'M -.68,.435 C -.5,.385 -.3,.385 -.18,.42 L -.18,.45 C -.3,.42 -.5,.42 -.68,.465 Z',
    stern: 'M -.68,.44 C -.5,.42 -.3,.42 -.16,.435 L -.16,.468 C -.3,.455 -.5,.455 -.68,.47 Z',
    scowl: 'M -.68,.4 C -.5,.4 -.3,.43 -.14,.47 L -.15,.5 C -.3,.465 -.5,.44 -.68,.435 Z',
    smirk: 'M -.68,.435 C -.5,.385 -.3,.385 -.18,.42 L -.18,.45 C -.3,.42 -.5,.42 -.68,.465 Z',
  }[kind];
  const eye = 'M -.62,.51 C -.52,.465 -.32,.465 -.22,.51 C -.32,.545 -.52,.545 -.62,.51 Z';
  const lid = 'M -.64,.51 C -.52,.455 -.32,.455 -.2,.51';
  const mouth = {
    neutral: 'M -.24,.84 C -.1,.855 .1,.855 .24,.84',
    stern: 'M -.24,.845 L .24,.845',
    scowl: 'M -.25,.86 C -.1,.83 .1,.83 .25,.86',
    smirk: 'M -.24,.85 C -.05,.86 .14,.85 .28,.81',
  }[kind];
  const iris = (s) => `<circle cx="${r1(h.cx + s * 0.42 * h.hw)}" cy="${r1(h.top + 0.512 * h.H)}" r="${r1(0.075 * h.hw)}" fill="${INK}"/>`;
  const parts = [
    fill(hp(g, both(eye)), '#f3eee4'),
    iris(-1),
    iris(1),
    stroke(hp(g, both(lid)), INK, g === 'f' ? 2.6 : 2),
    fill(hp(g, both(brow)), INK, ' opacity=".9"'),
    stroke(hp(g, 'M -.12,.67 C -.05,.7 .05,.7 .12,.67'), INK, 1.8, ' opacity=".75"'),
    stroke(hp(g, 'M .1,.5 C .14,.58 .16,.62 .12,.67'), INK, 1.2, ' opacity=".35"'),
  ];
  if (g === 'f') {
    parts.push(stroke(hp(g, both('M -.64,.51 L -.74,.47')), INK, 2));
    parts.push(fill(hp(g, 'M -.25,.84 C -.12,.8 -.04,.81 0,.825 C .04,.81 .12,.8 .25,.84 C .12,.9 -.12,.9 -.25,.84 Z'), '#8f3a44', ' opacity=".85"'));
  }
  parts.push(stroke(hp(g, mouth), INK, g === 'f' ? 1.4 : 2.4, ' opacity=".85"'));
  return svg(parts.join(''));
}

// ----------------------------------------------------------------- hats ----
// prop/ — headwear and full masks. All written as --xl so nothing tall is
// cropped by the top of the canvas.

const MASK_SHELL =
  'M 0,-.08 C .76,-.08 1.1,.12 1.08,.5 L 1.17,.56 L 1.15,.74 L 1.0,.78 C .95,.93 .8,1.02 .6,1.06 C .3,1.11 -.3,1.11 -.6,1.06 C -.8,1.02 -.95,.93 -1.0,.78 L -1.15,.74 L -1.17,.56 L -1.08,.5 C -1.1,.12 -.76,-.08 0,-.08 Z';
const MASK_HOLES = `${oval(-0.42, 0.51, 0.3, 0.075)} ${oval(0.42, 0.51, 0.3, 0.075)} ${oval(0, 0.845, 0.3, 0.05)}`;
const MASK_TRIM = `${oval(-0.42, 0.51, 0.42, 0.125)} ${oval(0.42, 0.51, 0.42, 0.125)} ${oval(0, 0.845, 0.42, 0.09)}`;
const MASK_CREST = 'M 0,-.08 L .16,.1 L .08,.34 L 0,.42 L -.08,.34 L -.16,.1 Z';
const MASK_SCHEMES = { red: ['#a3251f', '#e9c46a'], blue: ['#1f4f8a', '#d9dde3'], black: ['#18181b', '#b3261e'], green: ['#256b3c', '#f2efe6'], purple: ['#55307a', '#e0b23c'] };
const EYE_HOLES = `${oval(-0.42, 0.51, 0.27, 0.06)} ${oval(0.42, 0.51, 0.27, 0.06)}`;
const DOME = 'M -1.08,.22 C -1.12,-.04 -.7,-.14 0,-.14 C .7,-.14 1.12,-.04 1.08,.22 C .5,.15 -.5,.15 -1.08,.22 Z';

const HAT_TINT = {
  'military-cap': 'M -1.12,.22 C -1.24,-.02 -.72,-.14 0,-.14 C .72,-.14 1.24,-.02 1.12,.22 C .9,.34 .5,.38 0,.38 C -.5,.38 -.9,.34 -1.12,.22 Z',
  'baseball-cap': 'M -1.07,.24 C -1.13,0 -.7,-.14 0,-.14 C .7,-.14 1.13,0 1.07,.24 L .92,.24 C .92,.4 .5,.47 0,.47 C -.5,.47 -.92,.4 -.92,.24 Z',
  'backwards-cap': `${DOME} M -.3,.2 L .3,.2 L .3,.26 L -.3,.26 Z`,
  'cowboy-hat': 'M -2.0,.16 C -1.5,.3 -.6,.28 0,.28 C .6,.28 1.5,.3 2.0,.16 C 1.6,.02 1.2,.06 1.0,.1 C .98,-.2 .9,-.5 .55,-.5 C .3,-.5 .2,-.4 0,-.4 C -.2,-.4 -.3,-.5 -.55,-.5 C -.9,-.5 -.98,-.2 -1.0,.1 C -1.2,.06 -1.6,.02 -2.0,.16 Z',
  'ten-gallon-cowboy-hat': 'M -2.2,.16 C -1.5,.32 -.6,.28 0,.28 C .6,.28 1.5,.32 2.2,.16 C 1.7,0 1.2,.06 1.02,.1 C 1.06,-.4 1.0,-.9 .55,-.9 C .3,-.9 .2,-.78 0,-.78 C -.2,-.78 -.3,-.9 -.55,-.9 C -1.0,-.9 -1.06,-.4 -1.02,.1 C -1.2,.06 -1.7,0 -2.2,.16 Z',
  bandana: 'M -1.07,.35 C -1.13,.05 -.7,-.12 0,-.12 C .7,-.12 1.13,.05 1.07,.35 C .6,.22 -.6,.22 -1.07,.35 Z M 1.04,.28 L 1.42,.4 L 1.3,.49 L 1.5,.62 L 1.02,.4 Z',
  headband: 'M -1.04,.19 C -.5,.12 .5,.12 1.04,.19 L 1.06,.31 C .5,.24 -.5,.24 -1.06,.31 Z',
  hood: 'M -.9,1.3 C -1.6,.9 -1.5,-.16 0,-.16 C 1.5,-.16 1.6,.9 .9,1.3 L .7,1.1 C 1.15,.8 1.1,.2 0,.16 C -1.1,.2 -1.15,.8 -.7,1.1 Z',
  hardhat: 'M -1.12,.2 C -1.15,-.06 -.7,-.16 0,-.16 C .7,-.16 1.15,-.06 1.12,.2 L 1.32,.2 L 1.32,.27 C .5,.32 -.5,.32 -1.32,.27 L -1.32,.2 Z',
  'top-hat': 'M -1.5,.16 C -.6,.26 .6,.26 1.5,.16 L 1.5,.08 C 1.3,.1 1.1,.12 .95,.12 L 1.0,-.75 C .5,-.82 -.5,-.82 -1.0,-.75 L -.95,.12 C -1.1,.12 -1.3,.1 -1.5,.08 Z',
  'wizard-hat': 'M -1.8,.18 C -.6,.3 .6,.3 1.8,.18 C 1.5,.12 1.2,.1 1.0,.09 L .22,-.9 L .1,-1.02 L -1.0,.09 C -1.2,.1 -1.5,.12 -1.8,.18 Z',
  beret: 'M -1.05,.2 C -1.5,-.1 -.9,-.36 0,-.32 C 1.0,-.32 1.4,-.15 1.2,.1 C .9,.24 .3,.14 -1.05,.2 Z',
  beanie: 'M -1.07,.3 C -1.13,-.04 -.7,-.22 0,-.22 C .7,-.22 1.13,-.04 1.07,.3 C .5,.2 -.5,.2 -1.07,.3 Z',
  'half-mask': `M -1.02,.4 C -.5,.36 -.2,.4 0,.45 C .2,.4 .5,.36 1.02,.4 L 1.0,.6 C .7,.68 .3,.66 .12,.6 L 0,.56 L -.12,.6 C -.3,.66 -.7,.68 -1.0,.6 Z ${EYE_HOLES}`,
};

function star(u, v, ru, rv, n = 5, inner = 0.42) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : 1;
    const a = (Math.PI * i) / n - Math.PI / 2;
    d += `${i ? 'L' : 'M'} ${r3(u + ru * r * Math.cos(a))},${r3(v + rv * r * Math.sin(a))} `;
  }
  return `${d}Z`;
}
/** A heart centred on (u,v), ru wide and rv tall (half-extents). */
function heart(u, v, ru, rv) {
  const P = (x, y) => `${r3(u + x * ru)},${r3(v + y * rv)}`;
  return `M ${P(0, 1)} C ${P(-1.3, 0.1)} ${P(-1, -1)} ${P(-0.5, -1)} C ${P(-0.2, -1)} ${P(0, -0.7)} ${P(0, -0.45)} C ${P(0, -0.7)} ${P(0.2, -1)} ${P(0.5, -1)} C ${P(1, -1)} ${P(1.3, 0.1)} ${P(0, 1)} Z`;
}

function hatsFixed(g) {
  const h = HEAD[g];
  const P = (d) => hp(g, d);
  const dot = (u, v, r, c) => `<circle cx="${r1(h.cx + u * h.hw)}" cy="${r1(h.top + v * h.H)}" r="${r}" fill="${c}"/>`;
  const out = {
    crown:
      fill(P('M -1.0,.23 L -1.1,-.3 L -.7,-.02 L -.5,-.36 L -.25,-.04 L 0,-.42 L .25,-.04 L .5,-.36 L .7,-.02 L 1.1,-.3 L 1.0,.23 C .5,.16 -.5,.16 -1.0,.23 Z'), '#c99a2e') +
      dot(0, 0.08, 3.4, '#a3251f') + dot(-0.55, 0.1, 2.6, '#1f4f8a') + dot(0.55, 0.1, 2.6, '#1f4f8a'),
    strawhat:
      fill(P('M -1.9,.22 C -1.3,.34 -.6,.31 0,.31 C .6,.31 1.3,.34 1.9,.22 C 1.5,.14 1.2,.15 1.02,.17 C 1.02,-.1 .7,-.24 0,-.24 C -.7,-.24 -1.02,-.1 -1.02,.17 C -1.2,.15 -1.5,.14 -1.9,.22 Z'), '#d9b96a') +
      fill(P('M -1.02,.1 C -.5,.05 .5,.05 1.02,.1 L 1.02,.17 C .5,.12 -.5,.12 -1.02,.17 Z'), '#7a4a2a'),
    'chef-hat':
      fill(P(`${oval(-0.7, -0.38, 0.6, 0.3)} ${oval(0.7, -0.38, 0.6, 0.3)} ${oval(0, -0.55, 0.66, 0.34)}`), '#f4f1ea', ' fill-rule="nonzero"') +
      fill(P('M -1.0,.2 L -1.02,-.22 L 1.02,-.22 L 1.0,.2 C .5,.14 -.5,.14 -1.0,.2 Z'), '#f4f1ea') +
      stroke(P('M -1.0,-.2 C -.5,-.14 .5,-.14 1.0,-.2 M -.4,-.24 L -.45,-.6 M .4,-.24 L .45,-.6'), '#c4bfb2', 1.6),
    'party-hat':
      fill(P('M -.5,.0 L .1,-.85 L .6,.02 C .3,-.04 -.2,-.05 -.5,.0 Z'), '#e0457b') +
      fill(P('M -.3,-.28 L .32,-.44 L .4,-.3 L -.4,-.14 Z M -.08,-.6 L .18,-.7 L .24,-.6 L -.16,-.48 Z'), '#f2d14b') +
      dot(0.1, -0.87, 5, '#3fb6c9'),
    'propeller-beanie':
      fill(P(DOME), '#c0392b') + fill(P('M -.36,.15 C -.42,-.02 -.3,-.14 0,-.14 C .3,-.14 .42,-.02 .36,.15 C .2,.13 -.2,.13 -.36,.15 Z'), '#f2c230') +
      stroke(P('M 0,-.14 L 0,-.3'), '#333333', 2.4) +
      fill(P(`${oval(-0.34, -0.32, 0.32, 0.045)} ${oval(0.34, -0.32, 0.32, 0.045)}`), '#2f7fc1'),
    'viking-helmet':
      fill(P(both('M -1.0,.02 C -1.5,-.1 -1.65,-.5 -1.38,-.8 C -1.36,-.48 -1.2,-.32 -.88,-.22 Z')), '#eadfc4') +
      fill(P(`${DOME} M -.09,.16 L .09,.16 L .07,.64 L -.07,.64 Z`), '#8b9199') +
      fill(P('M -1.08,.22 C -.5,.15 .5,.15 1.08,.22 L 1.08,.12 C .5,.05 -.5,.05 -1.08,.12 Z'), '#5f656d'),
    sombrero:
      fill(P('M -2.4,.14 C -1.4,.38 1.4,.38 2.4,.14 C 1.6,-.04 1.1,.0 .8,.06 C .7,-.3 .4,-.64 0,-.64 C -.4,-.64 -.7,-.3 -.8,.06 C -1.1,.0 -1.6,-.04 -2.4,.14 Z'), '#d9b96a') +
      stroke(P('M -2.2,.17 C -1.4,.33 1.4,.33 2.2,.17 M -.74,-.06 C -.3,-.12 .3,-.12 .74,-.06'), '#b3261e', 2.6),
    'pirate-hat':
      fill(P('M -1.7,.22 C -1.25,-.3 -.6,-.58 0,-.62 C .6,-.58 1.25,-.3 1.7,.22 C .8,.06 -.8,.06 -1.7,.22 Z'), '#1b1b1f') +
      stroke(P('M -1.6,.17 C -.8,.02 .8,.02 1.6,.17'), '#e8e2d0', 2) +
      fill(P(`${oval(0, -0.28, 0.17, 0.075)} M -.09,-.2 L .09,-.2 L .07,-.14 L -.07,-.14 Z`), '#e8e2d0', ' fill-rule="nonzero"'),
    'jester-hat':
      fill(P('M -1.06,.22 C -1.1,-.1 -1.6,-.34 -1.95,-.05 C -1.5,-.56 -.6,-.56 0,-.12 L 0,.16 C -.5,.14 -.8,.16 -1.06,.22 Z'), '#b3261e') +
      fill(P('M 1.06,.22 C 1.1,-.1 1.6,-.34 1.95,-.05 C 1.5,-.56 .6,-.56 0,-.12 L 0,.16 C .5,.14 .8,.16 1.06,.22 Z'), '#2f8a4a') +
      dot(-1.95, -0.03, 4.5, '#f2c230') + dot(1.95, -0.03, 4.5, '#f2c230') + dot(0, -0.14, 4, '#f2c230'),
    'bunny-ears':
      fill(P(both('M -.78,.1 C -1.05,-.5 -.92,-.98 -.6,-.98 C -.34,-.98 -.28,-.5 -.4,.06 Z')), '#f4f1ea') +
      fill(P(both('M -.68,-.05 C -.82,-.45 -.76,-.8 -.6,-.8 C -.47,-.8 -.44,-.45 -.5,-.06 Z')), '#eea4b6') +
      fill(P('M -1.04,.19 C -.5,.12 .5,.12 1.04,.19 L 1.05,.26 C .5,.19 -.5,.19 -1.05,.26 Z'), '#f4f1ea'),
    'devil-horns': fill(P(both('M -.88,.1 C -1.0,-.2 -.82,-.44 -.58,-.54 C -.66,-.3 -.6,-.1 -.48,.04 Z')), '#b3261e'),
    halo: stroke(P(oval(0, -0.34, 0.72, 0.09)), '#f2c230', 5),
    'traffic-cone':
      fill(P('M -.6,.1 L -.16,-.92 L .16,-.92 L .6,.1 Z M -1.0,.22 L -.94,.06 L .94,.06 L 1.0,.22 Z'), '#e8691c', ' fill-rule="nonzero"') +
      fill(P('M -.44,-.28 L .44,-.28 L .35,-.5 L -.35,-.5 Z'), '#f4f1ea'),
    'santa-hat':
      fill(P('M -1.05,.14 C -.9,-.5 -.2,-.78 .5,-.62 C 1.1,-.5 1.5,-.1 1.55,.3 C 1.2,-.05 .9,-.1 1.02,.14 Z'), '#b3261e') +
      fill(P(`M -1.1,.27 L -1.1,.08 C -.5,.0 .5,.0 1.1,.08 L 1.1,.27 C .5,.19 -.5,.19 -1.1,.27 Z ${oval(1.56, 0.36, 0.2, 0.08)}`), '#f4f1ea', ' fill-rule="nonzero"'),
    fez:
      fill(P('M -.62,.06 L -.5,-.52 L .5,-.52 L .62,.06 C .3,.0 -.3,.0 -.62,.06 Z'), '#7d1f2a') +
      stroke(P('M 0,-.52 L .52,-.46 L .62,-.14'), '#e0b23c', 2),
    laurel: fill(P(`${chain(-1.08, 0.34, -0.25, 0.0, 7, 0.15, 0.05)} ${chain(1.08, 0.34, 0.25, 0.0, 7, 0.15, 0.05)}`), '#4f7a3a', ' fill-rule="nonzero"'),
    headphones:
      stroke(P('M -1.14,.56 C -1.2,-.3 1.2,-.3 1.14,.56'), '#26262b', 4.5) +
      fill(P(`${oval(-1.14, 0.62, 0.17, 0.13)} ${oval(1.14, 0.62, 0.17, 0.13)}`), '#26262b'),
  };
  const mask = (main, trim, extras = '') =>
    fill(P(`${MASK_SHELL} ${MASK_HOLES}`), main) + fill(P(`${MASK_TRIM} ${MASK_HOLES}`), trim) + extras;
  const FANGS = fill(P(both('M -.22,.82 L -.13,.93 L -.04,.82 Z')), '#f4f1ea');
  Object.assign(out, {
    'hockey-mask':
      stroke(P(both('M -.94,.5 L -1.14,.46 M -.9,.8 L -1.1,.84')), '#2b2b2b', 3) +
      fill(P(`M 0,.1 C .7,.1 .96,.28 .94,.6 C .92,.9 .6,1.1 0,1.12 C -.6,1.1 -.92,.9 -.94,.6 C -.96,.28 -.7,.1 0,.1 Z ${oval(-0.42, 0.51, 0.25, 0.07)} ${oval(0.42, 0.51, 0.25, 0.07)}`), '#e9e4d6') +
      fill(P(`M -.12,.14 L .12,.14 L 0,.36 Z ${both('M -.72,.66 L -.5,.62 L -.56,.82 Z')}`), '#b3261e', ' fill-rule="nonzero"') +
      [[0, 0.72], [-0.25, 0.8], [0.25, 0.8], [-0.5, 0.88], [0.5, 0.88], [0, 0.9], [-0.25, 0.98], [0.25, 0.98], [-0.3, 0.3], [0.3, 0.3]].map(([u, v]) => dot(u, v, 1.8, '#3a3a3a')).join(''),
    'monster-mask-zombie':
      mask('#6f8f5a', '#3f5236') + stroke(P('M -.6,.16 L -.05,.3 M -.45,.14 L -.5,.26 M -.3,.18 L -.35,.3 M -.15,.22 L -.2,.33 M .3,.7 L .75,.84 M .45,.7 L .4,.8 M .6,.74 L .55,.86'), '#26331f', 1.8),
    'monster-mask-demon':
      fill(P(both('M -.9,.08 C -1.1,-.3 -.9,-.6 -.55,-.72 C -.68,-.4 -.62,-.14 -.46,.02 Z')), '#2a1010') + mask('#9c1f1f', '#1a0a0a') + FANGS +
      fill(P(both('M -.72,.36 L -.14,.44 L -.14,.4 Z')), '#1a0a0a'),
    'monster-mask-werewolf':
      fill(P(both('M -.92,.14 L -1.2,-.42 L -.48,-.04 Z')), '#6b4a2f') + mask('#6b4a2f', '#3a2616') + FANGS + fill(P('M -.14,.64 L .14,.64 L 0,.74 Z'), '#141414') +
      stroke(P(both('M -1.0,.7 L -1.25,.76 M -.98,.8 L -1.2,.92')), '#6b4a2f', 3),
    'monster-mask-ghoul':
      fill(P(`${MASK_SHELL} ${MASK_HOLES}`), '#d8d6cc') + fill(P(`${oval(-0.42, 0.51, 0.44, 0.15)} ${oval(0.42, 0.51, 0.44, 0.15)} ${MASK_HOLES.split(' M ').slice(0, 2).join(' M ')}`), '#141414') +
      stroke(P('M -.46,.845 L -.36,.8 L -.26,.89 L -.16,.8 L -.06,.89 L .04,.8 L .14,.89 L .24,.8 L .34,.89 L .46,.845'), '#141414', 2),
    'monster-mask-pumpkin':
      fill(P('M -.1,-.06 L -.06,-.3 L .14,-.3 L .1,-.06 Z'), '#3f6b2a') + fill(P(`${MASK_SHELL} ${MASK_HOLES}`), '#e07b1a') +
      stroke(P('M 0,-.06 L 0,.36 M -.5,0 C -.62,.3 -.62,.7 -.5,1.02 M .5,0 C .62,.3 .62,.7 .5,1.02'), '#b85f10', 1.6) +
      fill(P(`${both('M -.42,.34 L -.12,.6 L -.72,.6 Z')} ${MASK_HOLES.split(' M ').slice(0, 2).join(' M ')}`), '#141414') +
      stroke(P('M -.46,.82 L -.3,.9 L -.16,.82 L 0,.9 L .16,.82 L .3,.9 L .46,.82'), '#141414', 2.4),
    'pirate-headscarf':
      fill(P('M -1.07,.35 C -1.13,.05 -.7,-.12 0,-.12 C .7,-.12 1.13,.05 1.07,.35 C .6,.22 -.6,.22 -1.07,.35 Z M 1.04,.28 L 1.42,.4 L 1.3,.49 L 1.5,.62 L 1.02,.4 Z'), '#a3251f', ' fill-rule="nonzero"') +
      [[-0.6, 0.08], [-0.2, 0.0], [0.25, 0.02], [0.65, 0.1], [0, 0.14], [-0.4, 0.18], [0.45, 0.2]].map(([u, v]) => dot(u, v, 1.6, '#f4f1ea')).join(''),
  });
  for (const [name, color] of Object.entries({ black: '#1d1d22', red: '#8f1f1f', white: '#e9e6de' })) {
    out[`ninja-mask-${name}`] =
      fill(P(`${MASK_SHELL} M -.92,.42 C -.4,.39 .4,.39 .92,.42 L .9,.61 C .4,.64 -.4,.64 -.9,.61 Z`), color) +
      stroke(P('M -.9,.36 C -.4,.33 .4,.33 .9,.36 M -.86,.68 C -.4,.72 .4,.72 .86,.68'), '#000000', 1.2, ' opacity=".3"');
  }
  // Luchador masks: one shell, many designs. Everything is drawn inside a
  // group that is clipped to the shell and has the eye and mouth openings
  // masked out, so a design never has to be cut around them by hand.
  const lucha = (main, trim, design, outside = '') =>
    `<defs><clipPath id="s"><path d="${P(MASK_SHELL)}"/></clipPath>` +
    `<mask id="h" maskUnits="userSpaceOnUse" x="-64" y="-128" width="640" height="640"><rect x="-64" y="-128" width="640" height="640" fill="#fff"/><path d="${P(MASK_HOLES)}" fill="#000"/></mask></defs>` +
    `<g mask="url(#h)">${outside}<g clip-path="url(#s)">${fill(P(MASK_SHELL), main)}${design}</g>` +
    `${stroke(P(MASK_HOLES), trim, 2.2)}${stroke(P(MASK_SHELL), '#000000', 1.4, ' opacity=".35"')}</g>`;
  const T = (d, c, extra = ' fill-rule="nonzero"') => fill(P(d), c, extra);
  const DESIGNS = {
    classic: (t) => T(`${MASK_TRIM} ${MASK_CREST}`, t),
    flames: (t) => T(`${both('M -.8,.44 C -.78,.2 -.52,.1 -.46,-.06 C -.38,.14 -.25,.16 -.2,.0 C -.14,.2 -.06,.3 -.08,.44 Z')} ${oval(0, 0.845, 0.42, 0.09)}`, t),
    wings: (t) => T(both('M -.06,.5 C -.3,.28 -.7,.22 -1.06,.26 C -.92,.38 -.98,.5 -1.04,.64 C -.7,.68 -.3,.68 -.06,.5 Z'), t),
    split: (t) => T('M 0,-.2 L 1.3,-.2 L 1.3,1.2 L 0,1.2 Z', t) + T(`${oval(-0.42, 0.51, 0.4, 0.115)}`, t) ,
    tiger: (t) => T(both('M -1.1,.26 L -.56,.36 L -1.08,.4 Z M -1.16,.6 L -.6,.68 L -1.1,.76 Z M -.96,.86 L -.46,.86 L -.8,.98 Z M -.56,-.06 L -.3,.28 L -.7,.08 Z M -.2,-.08 L -.06,.3 L -.3,.0 Z'), t),
    star: (t) => T(`${star(0, 0.19, 0.4, 0.165)} ${MASK_TRIM}`, t),
    cross: (t) => T('M -.15,-.2 L .15,-.2 L .15,1.2 L -.15,1.2 Z M -1.3,.4 L 1.3,.4 L 1.3,.63 L -1.3,.63 Z', t),
    bolts: (t) => T(both('M -.66,.02 L -.3,.02 L -.44,.34 L -.2,.34 L -.66,.9 L -.52,.52 L -.76,.52 Z'), t),
    teardrop: (t) => T(`${both('M -.12,.58 C -.3,.3 -.62,.16 -1.0,.18 C -.9,.46 -.62,.68 -.12,.58 Z')} ${oval(0, 0.845, 0.4, 0.085)}`, t),
    crest: (t) => T(`M -.2,-.2 L .2,-.2 L .12,.44 L 0,.5 L -.12,.44 Z ${both('M -.3,.74 L -.9,.66 L -.96,.9 L -.4,.98 Z')}`, t),
    fangs: (t) => T(`${oval(0, 0.845, 0.56, 0.13)} ${both('M -.72,.36 L -.12,.45 L -.12,.4 Z')}`, t) + T(both('M -.3,.76 L -.2,.9 L -.1,.76 Z M -.3,.93 L -.2,.8 L -.1,.93 Z'), '#f4f1ea'),
    horned: (t) => T(MASK_TRIM, t),
  };
  const HORNS = (t) => T(`${both('M -.5,.0 L -.78,-.5 L -.28,-.07 Z')} M -.1,-.06 L 0,-.6 L .1,-.06 Z`, t);
  const SCHEMES = [
    ['red', '#a3251f', '#e9c46a'], ['blue', '#1f4f8a', '#d9dde3'], ['black', '#18181b', '#b3261e'], ['green', '#256b3c', '#f2efe6'],
    ['purple', '#55307a', '#e0b23c'], ['white', '#ece8dc', '#1f4f8a'], ['gold', '#b5871f', '#18181b'], ['orange', '#d2601a', '#18181b'],
    ['teal', '#1f8a8a', '#f2efe6'], ['pink', '#d0457b', '#18181b'], ['silver', '#aeb4bd', '#18181b'], ['midnight', '#18181b', '#e0b23c'],
  ];
  Object.keys(DESIGNS).forEach((design, i) => {
    for (let k = 0; k < 3; k++) {
      const [name, main, trim] = SCHEMES[(i * 5 + k * 4) % SCHEMES.length];
      out[`luchador-mask-${design}-${name}`] = lucha(main, trim, DESIGNS[design](trim), design === 'horned' ? HORNS(trim) : '');
    }
  });
  return out;
}

// ---------------------------------------------------------- accessories ----
// acc/ — worn on the face, over hair and beard, under a hat.

const ACC_TINT = {
  'outlaw-bandana': 'M -1.0,.62 C -.5,.58 .5,.58 1.0,.62 C .9,.9 .5,1.12 0,1.34 C -.5,1.12 -.9,.9 -1.0,.62 Z',
};

function accFixed(g) {
  const h = HEAD[g];
  const P = (d) => hp(g, d);
  const dot = (u, v, r, c) => `<circle cx="${r1(h.cx + u * h.hw)}" cy="${r1(h.top + v * h.H)}" r="${r1(r * h.hw)}" fill="${c}"/>`;
  const LENSES = both('M -.76,.44 L -.1,.44 C -.1,.59 -.2,.63 -.42,.63 C -.66,.63 -.76,.59 -.76,.44 Z');
  const ARMS = `M -.1,.45 L .1,.45 L .1,.49 L -.1,.49 Z ${both('M -.76,.46 L -1.06,.5 L -1.06,.53 L -.76,.5 Z')}`;
  const SQUARE = both('M -.72,.43 L -.14,.43 L -.14,.6 L -.72,.6 Z');
  const FRAME = `${SQUARE} M -.14,.48 L .14,.48 ${both('M -.72,.47 L -1.05,.5')}`;
  return {
    sunglasses: fill(P(`${LENSES} ${ARMS}`), '#111111') + stroke(P(both('M -.66,.48 L -.5,.48')), '#ffffff', 1.5, ' opacity=".35"'),
    aviators: fill(P(LENSES), '#3a2f1c', ' opacity=".9"') + stroke(P(`${LENSES} M -.1,.46 L .1,.46 ${both('M -.76,.46 L -1.06,.5')}`), '#d1a93a', 1.6),
    glasses: fill(P(SQUARE), '#c8dcea', ' opacity=".22"') + stroke(P(FRAME), '#1c1c1c', 2.2),
    '3d-glasses':
      fill(P('M -.72,.43 L -.14,.43 L -.14,.6 L -.72,.6 Z'), '#d23b3b', ' opacity=".8"') +
      fill(P('M .72,.43 L .14,.43 L .14,.6 L .72,.6 Z'), '#35b6c9', ' opacity=".8"') +
      stroke(P(FRAME), '#f4f1ea', 3),
    'heart-shades':
      fill(P(`${heart(-0.42, 0.52, 0.34, 0.1)} ${heart(0.42, 0.52, 0.34, 0.1)}`), '#e0457b', ' fill-rule="nonzero"') +
      stroke(P(`M -.12,.48 L .12,.48 ${both('M -.74,.47 L -1.05,.5')}`), '#e0457b', 2),
    visor:
      fill(P('M -1.09,.42 C -.5,.37 .5,.37 1.09,.42 L 1.07,.61 C .5,.65 -.5,.65 -1.07,.61 Z'), '#8fa9b8') +
      fill(P('M -.9,.45 C -.4,.41 .1,.41 .5,.43 L .4,.48 C 0,.46 -.5,.47 -.9,.5 Z'), '#ffffff', ' opacity=".45"'),
    goggles:
      fill(P('M -1.06,.22 C -.5,.16 .5,.16 1.06,.22 L 1.06,.3 C .5,.25 -.5,.25 -1.06,.3 Z'), '#2b2b2b') +
      fill(P(`${oval(-0.4, 0.26, 0.3, 0.085)} ${oval(0.4, 0.26, 0.3, 0.085)}`), '#3a3a3a') +
      fill(P(`${oval(-0.4, 0.26, 0.22, 0.06)} ${oval(0.4, 0.26, 0.22, 0.06)}`), '#d98a2b'),
    'surgical-covering':
      fill(P('M -.92,.62 C -.5,.57 .5,.57 .92,.62 L .82,.96 C .4,1.05 -.4,1.05 -.82,.96 Z'), '#dce8ea') +
      stroke(P(`M -.86,.72 C -.4,.68 .4,.68 .86,.72 M -.84,.84 C -.4,.8 .4,.8 .84,.84 ${both('M -.92,.64 L -1.1,.58')}`), '#9fb6ba', 1.4),
    'eye-patch': stroke(P('M -1.03,.3 L .2,.45 M .68,.5 L 1.05,.56'), '#141414', 2.4) + fill(P(oval(0.42, 0.515, 0.3, 0.09)), '#141414'),
    monocle: stroke(P(`${oval(0.42, 0.52, 0.27, 0.085)}`), '#d1a93a', 2.4) + stroke(P('M .68,.55 C .92,.8 .84,1.1 .62,1.34'), '#d1a93a', 1.1),
    'clown-nose': dot(0, 0.655, 0.17, '#d62828') + dot(-0.05, 0.635, 0.05, '#ff8a8a'),
    'groucho-glasses':
      stroke(P(`${both(oval(-0.42, 0.51, 0.3, 0.085))} M -.12,.5 L .12,.5 ${both('M -.72,.5 L -1.05,.5')}`), '#141414', 2.6) +
      fill(P(both('M -.74,.4 C -.5,.34 -.3,.34 -.12,.4 L -.12,.44 C -.3,.4 -.5,.4 -.74,.44 Z')), '#141414') +
      fill(P(oval(0, 0.63, 0.18, 0.075)), '#dba98a') +
      fill(P('M -.44,.8 C -.2,.68 .2,.68 .44,.8 C .2,.86 -.2,.86 -.44,.8 Z'), '#141414'),
    'nose-bandage': fill(P('M -.24,.57 L .24,.57 L .24,.63 L -.24,.63 Z'), '#eadcc4') + stroke(P('M -.08,.57 L -.08,.63 M .08,.57 L .08,.63'), '#c9b99c', 1),
    'pirate-earring': stroke(P(oval(-1.12, 0.76, 0.1, 0.04)), '#d1a93a', 2.2),
    veil: fill(P('M -1.1,.12 C -.5,.04 .5,.04 1.1,.12 L 1.0,.64 C .5,.72 -.5,.72 -1.0,.64 Z'), '#111111', ' opacity=".45"'),
    'cat-whiskers': stroke(P(both('M -.3,.7 L -1.0,.62 M -.3,.74 L -1.0,.76 M -.3,.78 L -.95,.9')), '#141414', 1.2) + fill(P('M -.1,.63 L .1,.63 L 0,.7 Z'), '#141414'),
  };
}

// ---------------------------------------------------------------- paint ----
// paint/ — face makeup. Drawn UNDER the face features, so eyes, brows and
// mouth stay readable on top of it.

const PAINT_TINT = {
  'war-mask': [both('M -.86,.38 L -.1,.44 L -.16,.6 L -.44,.78 L -.8,.62 Z'), 0.85],
  'cheek-stripes': [both('M -.84,.6 L -.3,.56 L -.3,.62 L -.82,.67 Z M -.8,.71 L -.34,.67 L -.34,.73 L -.76,.78 Z'), 0.9],
  'star-eye': [star(0.42, 0.5, 0.56, 0.24), 0.9],
  lightning: ['M -.3,.2 L .22,.2 L -.02,.46 L .36,.46 L -.3,.98 L -.1,.58 L -.44,.58 Z', 0.9],
  'half-face': ['M 0,.14 C -.7,.14 -1.0,.3 -.98,.6 C -.96,.85 -.75,1.0 -.4,1.04 L 0,1.06 Z', 0.75],
  'eye-band': ['M -1.0,.42 C -.5,.38 .5,.38 1.0,.42 L 1.0,.6 C .5,.64 -.5,.64 -1.0,.6 Z', 0.85],
  'glam-wings': [both('M -.16,.52 C -.4,.38 -.7,.36 -1.02,.32 C -.86,.5 -.6,.58 -.16,.56 Z'), 0.85],
  'forehead-stripe': ['M -.12,.16 L .12,.16 L .1,.66 L -.1,.66 Z', 0.85],
  'chin-stripes': ['M -.3,.9 L -.18,.9 L -.14,1.04 L -.26,1.04 Z M -.06,.9 L .06,.9 L .06,1.06 L -.06,1.06 Z M .3,.9 L .18,.9 L .14,1.04 L .26,1.04 Z', 0.9],
};

function paintFixed(g) {
  const P = (d) => hp(g, d);
  const BASE = 'M 0,.14 C .7,.14 .98,.3 .96,.6 C .94,.85 .7,1.02 0,1.05 C -.7,1.02 -.94,.85 -.96,.6 C -.98,.3 -.7,.14 0,.14 Z';
  const SOCKETS = `${oval(-0.42, 0.51, 0.36, 0.105)} ${oval(0.42, 0.51, 0.36, 0.105)}`;
  return {
    'skull-paint':
      fill(P(BASE), '#eeeae0', ' opacity=".92"') + fill(P(`${SOCKETS} M 0,.6 L .11,.71 L -.11,.71 Z`), '#141414', ' fill-rule="nonzero"') +
      stroke(P('M -.5,.845 L .5,.845 M -.36,.8 L -.36,.89 M -.18,.8 L -.18,.89 M 0,.8 L 0,.89 M .18,.8 L .18,.89 M .36,.8 L .36,.89'), '#141414', 1.6),
    'corpse-paint':
      fill(P(BASE), '#eeeae0', ' opacity=".9"') + fill(P(SOCKETS), '#141414', ' fill-rule="nonzero"') +
      fill(P(both('M -.56,.58 L -.3,.58 L -.36,.94 L -.46,.94 Z')), '#141414') + fill(P('M -.34,.8 C -.1,.76 .1,.76 .34,.8 L .3,.9 C .1,.86 -.1,.86 -.3,.9 Z'), '#141414'),
    'clown-paint':
      fill(P(BASE), '#f4f1ea', ' opacity=".94"') +
      fill(P(both('M -.42,.3 L -.28,.5 L -.42,.74 L -.56,.5 Z')), '#2f7fc1') +
      fill(P('M -.56,.78 C -.2,.98 .2,.98 .56,.78 C .2,.86 -.2,.86 -.56,.78 Z M -.56,.78 C -.2,.74 .2,.74 .56,.78 C .2,.82 -.2,.82 -.56,.78 Z'), '#d62828', ' fill-rule="nonzero"'),
    'cheek-hearts': fill(P(`${heart(-0.62, 0.7, 0.14, 0.05)} ${heart(0.62, 0.7, 0.14, 0.05)}`), '#e0457b', ' fill-rule="nonzero"'),
    'rosy-cheeks': fill(P(`${oval(-0.62, 0.7, 0.2, 0.06)} ${oval(0.62, 0.7, 0.2, 0.06)}`), '#e0457b', ' opacity=".55"'),
    'black-tears': fill(P(both('M -.5,.56 L -.34,.56 L -.38,.92 L -.46,.92 Z')), '#141414', ' opacity=".85"'),
    'flag-stripes':
      fill(P(both('M -.84,.58 L -.3,.56 L -.3,.61 L -.83,.63 Z')), '#b3261e') + fill(P(both('M -.83,.65 L -.3,.63 L -.3,.68 L -.81,.7 Z')), '#f4f1ea') +
      fill(P(both('M -.8,.72 L -.3,.7 L -.3,.75 L -.77,.77 Z')), '#1f4f8a'),
  };
}

// ------------------------------------------------------------- clothing ----
// Body space. ComposedPortrait clips every clothing layer to the base
// body's own silhouette, so these only need to be right along the arm gaps
// and the neckline — anything spilling past the body's outer edge is cut.

const down = (g, side) => GAP[g].map(([y, l, r]) => `L ${side === 'l' ? l : r},${y}`).join(' ');
const up = (g, side) => [...GAP[g]].reverse().map(([y, l, r]) => `L ${side === 'l' ? l : r},${y}`).join(' ');

// Per-gender landmarks: armpit y, strap/neck points, neckline depth.
const BODY = {
  m: { cx: 253.5, pit: 304, strapOut: 44, strapIn: 20, neckY: 152, scoop: 236, shoulderY: 150, sleeve: 348, hem: 512 },
  f: { cx: 255.5, pit: 280, strapOut: 42, strapIn: 25, neckY: 174, scoop: 240, shoulderY: 172, sleeve: 322, hem: 512 },
};

function sleeveless(g, { scoop, strapOut } = {}) {
  const b = BODY[g];
  const [, pl, pr] = GAP[g][0];
  const so = strapOut ?? b.strapOut;
  const sc = scoop ?? b.scoop;
  return (
    `M ${pl - 1},${b.pit - 2} C ${pl + 20},${b.pit - 54} ${b.cx - so - 16},${b.neckY + 46} ${b.cx - so},${b.neckY + 4} ` +
    `L ${b.cx - b.strapIn},${b.neckY - 2} C ${b.cx - b.strapIn + 3},${sc} ${b.cx + b.strapIn - 3},${sc} ${b.cx + b.strapIn},${b.neckY - 2} ` +
    `L ${b.cx + so},${b.neckY + 4} C ${b.cx + so + 16},${b.neckY + 46} ${pr - 20},${b.pit - 54} ${pr + 1},${b.pit - 2}`
  );
}

function clothing(g) {
  const b = BODY[g];
  const [, pl, pr] = GAP[g][0];
  const torsoClose = `${down(g, 'r')} ${up(g, 'l')} Z`;
  const tee = (hem) =>
    `M 30,${b.sleeve + 4} L ${pl - 3},${b.sleeve - 10} L ${pl},${b.pit} ${down(g, 'l').replace(/^L [\d.]+,[\d.]+ /, '')} ${hem ?? ''} ${up(g, 'r')} ` +
    `L ${pr + 3},${b.sleeve - 10} L 482,${b.sleeve + 4} L 482,${b.shoulderY - 30} L ${b.cx + 44},${b.shoulderY - 4} ` +
    `C ${b.cx + 34},${b.shoulderY + 34} ${b.cx - 34},${b.shoulderY + 34} ${b.cx - 44},${b.shoulderY - 4} L 30,${b.shoulderY - 30} Z`;
  const panel = (sleeves) => {
    const outer = sleeves
      ? `M 30,512 L 30,${b.shoulderY - 30} L ${b.cx - 40},${b.shoulderY - 6}`
      : `M ${pl - 1},${b.pit - 2} C ${pl + 6},${b.pit - 60} ${b.cx - 86},${b.shoulderY + 44} ${b.cx - 62},${b.shoulderY + 12} L ${b.cx - 40},${b.shoulderY - 6}`;
    const left = `${outer} L ${b.cx - 20},${b.neckY} C ${b.cx - 26},${b.neckY + 90} ${b.cx - 36},${b.neckY + 200} ${b.cx - 30},512 ${sleeves ? '' : up(g, 'l')} Z`;
    return `${left} ${left.replace(/(-?[\d.]+),(-?[\d.]+)/g, (_, x, y) => `${r1(2 * b.cx - x)},${y}`)}`;
  };
  const tops =
    g === 'm'
      ? {
          tshirt: tee(),
          singlet: `${sleeveless(g)} ${torsoClose}`,
          'onestrap-singlet':
            `M ${pl + 8},${b.pit + 30} C ${pl + 30},${b.pit - 40} ${b.cx - 60},${b.neckY + 50} ${b.cx - 44},${b.neckY + 4} L ${b.cx - 20},${b.neckY - 2} ` +
            `C ${b.cx - 10},${b.pit - 20} ${b.cx + 70},${b.pit + 40} ${pr - 4},${b.pit + 56} ${down(g, 'r').replace(/^(L [\d.]+,[\d.]+ ){3}/, '')} ${up(g, 'l').replace(/( L [\d.]+,[\d.]+){2}$/, '')} Z`,
        }
      : {
          sportsbra: `${sleeveless(g)} L ${pr + 2},332 L 346,352 C 300,364 211,364 165,352 L ${pl - 3},332 Z`,
          singlet: `${sleeveless(g)} ${torsoClose}`,
          'crop-top': `${sleeveless(g, { scoop: 214, strapOut: 50 })} L ${pr + 2},340 L 348,372 C 300,380 211,380 163,372 L ${pl - 3},340 Z`,
          tshirt: tee(),
        };
  const [, wl, wr] = GAP[g][GAP[g].length - 3];
  const [, bl, br] = GAP[g][GAP[g].length - 1];
  return {
    top: tops,
    outer: { vest: panel(false), jacket: panel(true) },
    waistband: { 'trunks-band': `M ${wl},474 C ${b.cx - 60},464 ${b.cx + 60},464 ${wr},474 L ${br},512 L ${bl},512 Z` },
  };
}

// ---------------------------------------------------------------- loose ----
// Garments that hang off the body instead of hugging it: baggy shirts,
// coats, robes, a karate gi. Written with a `--loose` marker, which tells
// ComposedPortrait NOT to clip them to the body silhouette. Their outline
// is the body's own outer edge pushed out by `pad`; a 2px slit is left
// along each arm gap so sleeves still read as sleeves.

// Outer edge of the left arm, shoulder to wrist, as [x, y]. The right is its mirror.
const ARM = {
  m: [[200, 150], [184, 160], [166, 176], [150, 184], [128, 192], [116, 200], [102, 216], [94, 232], [90, 256], [86, 280], [79, 296], [75, 320], [77, 336], [78, 352], [71, 368], [69, 384], [63, 400], [59, 416], [60, 432], [64, 448], [66, 464], [68, 480], [71, 496], [72, 512]],
  f: [[203, 176], [191, 184], [179, 192], [146, 200], [134, 208], [121, 224], [114, 240], [110, 256], [112, 272], [112, 288], [104, 304], [100, 320], [100, 336], [102, 352], [100, 368], [93, 384], [88, 400], [85, 416], [86, 432], [87, 448], [89, 464], [91, 480], [92, 496], [93, 512]],
};
const COLLAR = { m: 40, f: 34 };
const flipX = (g, d) => d.replace(/(-?[\d.]+),(-?[\d.]+)/g, (_, x, y) => `${r1(2 * BODY[g].cx - x)},${y}`);

/** Torso edge x at height y, interpolated along an arm gap. */
function gapAt(g, y, side) {
  const rows = GAP[g];
  const k = side === 'l' ? 1 : 2;
  if (y <= rows[0][0]) return rows[0][k];
  for (let i = 1; i < rows.length; i++) {
    if (y <= rows[i][0]) {
      const t = (y - rows[i - 1][0]) / (rows[i][0] - rows[i - 1][0]);
      return rows[i - 1][k] + (rows[i][k] - rows[i - 1][k]) * t;
    }
  }
  return rows[rows.length - 1][k];
}

/**
 * The left half of a loose garment. `front` finishes the path from the
 * bottom of the torso back up to the collar — a closed neckline or an open
 * coat front.
 */
function looseHalf(g, pad, front) {
  const b = BODY[g];
  const collar = `${b.cx - COLLAR[g]},${b.neckY - 6}`;
  const outer = ARM[g].map(([x, y], i) => {
    const k = Math.min(1, i / 4);
    return `L ${r1(x - pad * k)},${r1(y - pad * 0.5 * (1 - k) - (i < 5 ? pad * 0.4 : 0))}`;
  });
  const sleeveIn = [...GAP[g]].reverse().map(([y, l]) => `L ${l - 1},${y}`);
  const torso = GAP[g].map(([y, l]) => `L ${l + 1},${y}`);
  return `M ${collar} ${outer.join(' ')} ${sleeveIn.join(' ')} ${torso.join(' ')} ${front} Z`;
}
function looseShape(g, pad, kind, depth = 26) {
  const b = BODY[g];
  const c = b.cx + 0.5;
  const front =
    kind === 'open'
      ? `L ${b.cx - 34},512 L ${b.cx - 20},${b.neckY + 8}`
      : kind === 'vee'
        ? `L ${c},512 L ${c},${b.neckY + depth}`
        : `L ${c},512 L ${c},${b.neckY + depth} Q ${b.cx - COLLAR[g] * 0.6},${b.neckY + depth} ${b.cx - COLLAR[g]},${b.neckY - 6}`;
  const half = looseHalf(g, pad, front);
  return `${half} ${flipX(g, half)}`;
}

function looseWear(g) {
  const b = BODY[g];
  const [cx, ny] = [b.cx, b.neckY];
  const arm = ARM[g];
  const belt = (y1, y2, color) =>
    fill(`M ${gapAt(g, y1, 'l') + 1},${y1} L ${gapAt(g, y1, 'r') - 1},${y1} L ${gapAt(g, y2, 'r') - 1},${y2} L ${gapAt(g, y2, 'l') + 1},${y2} Z`, color);
  const lapels = (color, w, drop) => stroke(`M ${cx - COLLAR[g]},${ny - 4} L ${cx + 16},${ny + drop} M ${cx + COLLAR[g]},${ny - 4} L ${cx - 6},${ny + drop * 0.62}`, color, w);
  const trim = (color, w) => stroke(`M ${cx - 21},${ny + 8} L ${cx - 35},512 M ${cx + 21},${ny + 8} L ${cx + 35},512`, color, w);
  const shell = (pad, kind, color, depth) => fill(looseShape(g, pad, kind, depth), color, ' fill-rule="nonzero"');
  const dots = (pts, r, colors) => pts.map(([x, y], i) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r}" fill="${colors[i % colors.length]}"/>`).join('');
  const gi = (cloth, lap, sash) =>
    shell(9, 'vee', cloth, 74) + lapels(lap, 6, 150) + belt(452, 474, sash) + fill(`M ${cx - 9},448 L ${cx + 9},448 L ${cx + 14},492 L ${cx + 4},492 L ${cx},470 L ${cx - 4},492 L ${cx - 14},492 Z`, sash);
  const robe = (cloth, edge) =>
    shell(16, 'open', cloth) + trim(edge, 13) + stroke(`M ${cx - COLLAR[g] - 4},${ny - 8} L ${cx - 21},${ny + 8} M ${cx + COLLAR[g] + 4},${ny - 8} L ${cx + 21},${ny + 8}`, edge, 13) +
    dots([[arm[9][0] + 22, arm[9][1]], [2 * cx - arm[9][0] - 22, arm[9][1] + 30], [arm[15][0] + 20, arm[15][1]], [2 * cx - arm[15][0] - 20, arm[15][1] - 20], [cx - 70, ny + 200], [cx + 74, ny + 150]], 2.4, [edge]);
  const flowers = [[cx - 30, ny + 62], [cx + 34, ny + 70], [cx - 56, ny + 112], [cx + 58, ny + 122], [cx - 14, ny + 132], [cx + 16, ny + 176], [cx - 44, ny + 196], [cx + 46, ny + 214], [cx - 10, ny + 246], [cx + 30, ny + 276], [cx - 52, ny + 280], [arm[8][0] + 22, arm[8][1]], [2 * cx - arm[8][0] - 22, arm[8][1] + 14], [arm[13][0] + 22, arm[13][1]], [2 * cx - arm[13][0] - 22, arm[13][1]]];
  return {
    top: {
      tint: { 'baggy-shirt': looseShape(g, 10, 'crew') },
      fixed: {
        'karate-gi': gi('#f2f0ea', '#cfcabd', '#18181b'),
        'ninja-gi': gi('#1d1d22', '#3a3a42', '#8f1f1f'),
        'pirate-shirt':
          shell(14, 'vee', '#efe9da', 96) + stroke(`M ${cx - 12},${ny + 40} L ${cx + 12},${ny + 52} M ${cx + 12},${ny + 40} L ${cx - 12},${ny + 52} M ${cx - 8},${ny + 62} L ${cx + 8},${ny + 74} M ${cx + 8},${ny + 62} L ${cx - 8},${ny + 74}`, '#6b4a2f', 1.6) + belt(450, 478, '#a3251f'),
        'hawaiian-shirt': shell(11, 'vee', '#1f8a8a', 60) + dots(flowers, 7, ['#f2c230', '#e0457b', '#f4f1ea']) + dots(flowers, 2.4, ['#b3261e', '#f2c230', '#e0457b']),
      },
    },
    outer: {
      tint: { 'long-coat': looseShape(g, 13, 'open') },
      fixed: {
        'pirate-coat': shell(14, 'open', '#22304d') + trim('#d1a93a', 4) + dots([0, 1, 2, 3].flatMap((i) => [[cx - 46, ny + 70 + i * 46], [cx + 46, ny + 70 + i * 46]]), 3.4, ['#d1a93a']),
        'lab-coat': shell(11, 'open', '#eef0f0') + trim('#c3c9cc', 2) + stroke(`M ${cx + 44},${ny + 96} L ${cx + 74},${ny + 96} L ${cx + 74},${ny + 126} L ${cx + 44},${ny + 126} Z`, '#c3c9cc', 1.6),
        'fur-coat': shell(20, 'open', '#6b4a2f') + stroke(`M ${cx - COLLAR[g] - 6},${ny - 6} L ${cx - 22},${ny + 30} L ${cx - 30},${ny + 120} M ${cx + COLLAR[g] + 6},${ny - 6} L ${cx + 22},${ny + 30} L ${cx + 30},${ny + 120}`, '#93714a', 18),
        'robe-red': robe('#8f1f1f', '#e0b23c'),
        'robe-purple': robe('#55307a', '#e0b23c'),
        'robe-white': robe('#ece8dc', '#b9bec6'),
        'robe-black': robe('#18181b', '#b3261e'),
        'robe-gold': robe('#b5871f', '#f4f1ea'),
        'robe-blue': robe('#1f4f8a', '#d9dde3'),
      },
    },
  };
}

// ----------------------------------------------------------------- neck ----
// neck/ — body space, worn over everything on the torso.

function neck(g) {
  const b = BODY[g];
  const [cx, ny] = [b.cx, b.neckY];
  const curve = (t, w = 40, drop = 62) => [cx + (2 * t - 1) * w, ny - 8 + drop * 4 * t * (1 - t)];
  const beads = (n, r, colors, w, drop) =>
    Array.from({ length: n }, (_, i) => {
      const [x, y] = curve(i / (n - 1), w, drop);
      return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r}" fill="${colors[i % colors.length]}"/>`;
    }).join('');
  const tie = `M ${cx - 10},${ny + 6} L ${cx + 10},${ny + 6} L ${cx + 7},${ny + 22} L ${cx + 13},${ny + 156} L ${cx},${ny + 174} L ${cx - 13},${ny + 156} L ${cx - 7},${ny + 22} Z`;
  const bow = `M ${cx - 24},${ny - 4} L ${cx - 4},${ny + 6} L ${cx + 4},${ny + 6} L ${cx + 24},${ny - 4} L ${cx + 24},${ny + 22} L ${cx + 4},${ny + 12} L ${cx - 4},${ny + 12} L ${cx - 24},${ny + 22} Z`;
  const scarf = `M ${cx - 44},${ny - 24} C ${cx - 20},${ny - 8} ${cx + 20},${ny - 8} ${cx + 44},${ny - 24} L ${cx + 46},${ny + 6} C ${cx + 20},${ny + 22} ${cx - 20},${ny + 22} ${cx - 46},${ny + 6} Z M ${cx + 8},${ny + 10} L ${cx + 34},${ny + 8} L ${cx + 40},${ny + 96} L ${cx + 12},${ny + 96} Z`;
  const towel = (s) => `M ${cx + s * 48},${ny - 14} L ${cx + s * 22},${ny - 4} L ${cx + s * 26},${ny + 116} L ${cx + s * 60},${ny + 116} Z`;
  const chainD = `M ${cx - 36},${ny - 8} C ${cx - 30},${ny + 56} ${cx + 30},${ny + 56} ${cx + 36},${ny - 8}`;
  return {
    tint: {
      tie,
      bowtie: bow,
      scarf,
      'feather-boa': null,
    },
    fixed: {
      'gold-chain': stroke(chainD, '#d1a93a', 4, ' stroke-dasharray="5 3"') + `<circle cx="${cx}" cy="${ny + 46}" r="9" fill="#d1a93a"/><circle cx="${cx}" cy="${ny + 46}" r="5" fill="#b0861f"/>`,
      towel: fill(`${towel(-1)} ${towel(1)}`, '#f1efe8', ' fill-rule="nonzero"') + stroke(`M ${cx - 57},${ny + 104} L ${cx - 27},${ny + 104} M ${cx + 27},${ny + 104} L ${cx + 57},${ny + 104}`, '#b3261e', 3),
      lei: beads(15, 8, ['#e0457b', '#f2c230', '#f08a24', '#f4f1ea'], 46, 80),
      medal: fill(`M ${cx - 30},${ny - 8} L ${cx - 18},${ny - 8} L ${cx + 4},${ny + 60} L ${cx - 6},${ny + 64} Z M ${cx + 30},${ny - 8} L ${cx + 18},${ny - 8} L ${cx - 4},${ny + 60} L ${cx + 6},${ny + 64} Z`, '#1f4f8a', ' fill-rule="nonzero"') + `<circle cx="${cx}" cy="${ny + 72}" r="13" fill="#d1a93a"/><circle cx="${cx}" cy="${ny + 72}" r="8" fill="#e9c46a"/>`,
      'dog-collar': stroke(`M ${cx - 38},${ny - 16} C ${cx - 18},${ny - 4} ${cx + 18},${ny - 4} ${cx + 38},${ny - 16}`, '#1b1b1f', 9) + beads(5, 2.6, ['#c9ccd1'], 30, -2).replace(/cy="([\d.]+)"/g, (_, y) => `cy="${r1(+y - 3)}"`),
    },
    boa: beads(19, 13, ['#b0b0b0'], 52, 110),
  };
}

// ---------------------------------------------------------------- logos ----
// logo/ — a chest graphic, only ever drawn on a top and cut to its shape.
// Unit coordinates: -1..1 around the chest centre.

const LOGO_AT = { m: { cx: 253.5, cy: 268, s: 34 }, f: { cx: 255.5, cy: 266, s: 24 } };
const lp = (g, d) => {
  const l = LOGO_AT[g];
  return d.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (_, u, v) => `${r1(l.cx + u * l.s)},${r1(l.cy + v * l.s)}`);
};
const LOGOS = {
  star: star(0, 0, 1, 1),
  bolt: 'M .15,-1 L -.55,.12 L -.05,.12 L -.25,1 L .55,-.18 L .05,-.18 Z',
  heart: heart(0, 0.05, 0.9, 0.85),
  skull: `M -.8,-.2 C -.8,-.8 -.4,-1 0,-1 C .4,-1 .8,-.8 .8,-.2 C .8,.1 .7,.3 .5,.4 L .5,.9 L -.5,.9 L -.5,.4 C -.7,.3 -.8,.1 -.8,-.2 Z ${oval(-0.36, -0.2, 0.22, 0.24)} ${oval(0.36, -0.2, 0.22, 0.24)} M 0,.1 L .12,.34 L -.12,.34 Z`,
  flame: 'M 0,-1 C .2,-.5 .8,-.2 .7,.4 C .65,.8 .3,1 0,1 C -.3,1 -.65,.8 -.7,.4 C -.75,0 -.4,-.2 -.3,-.5 C -.1,-.3 -.1,-.1 -.05,.05 C .1,-.3 .1,-.6 0,-1 Z',
  diamond: 'M 0,-1 L .75,0 L 0,1 L -.75,0 Z',
  plus: 'M -.3,-1 L .3,-1 L .3,-.3 L 1,-.3 L 1,.3 L .3,.3 L .3,1 L -.3,1 L -.3,.3 L -1,.3 L -1,-.3 L -.3,-.3 Z',
  'big-x': 'M -1,-.7 L -.7,-1 L 0,-.3 L .7,-1 L 1,-.7 L .3,0 L 1,.7 L .7,1 L 0,.3 L -.7,1 L -1,.7 L -.3,0 Z',
  bullseye: `${oval(0, 0, 1, 1)} ${oval(0, 0, 0.7, 0.7)} ${oval(0, 0, 0.36, 0.36)}`,
  smiley: `${oval(0, 0, 1, 1)} ${oval(-0.36, -0.28, 0.14, 0.2)} ${oval(0.36, -0.28, 0.14, 0.2)} M -.58,.18 C -.3,.72 .3,.72 .58,.18 C .3,.5 -.3,.5 -.58,.18 Z`,
  crown: 'M -1,.6 L -1,-.5 L -.5,.0 L 0,-.8 L .5,.0 L 1,-.5 L 1,.6 Z',
  'number-one': 'M -.3,-.55 L .1,-1 L .32,-1 L .32,.7 L .6,.7 L .6,1 L -.4,1 L -.4,.7 L -.05,.7 L -.05,-.5 L -.3,-.3 Z',
  paw: `${oval(0, 0.35, 0.55, 0.45)} ${oval(-0.7, -0.2, 0.22, 0.28)} ${oval(-0.26, -0.62, 0.22, 0.28)} ${oval(0.26, -0.62, 0.22, 0.28)} ${oval(0.7, -0.2, 0.22, 0.28)}`,
  'chest-stripe': 'M -8,-.4 L 8,-.4 L 8,.4 L -8,.4 Z',
  'double-stripe': 'M -8,-.6 L 8,-.6 L 8,-.15 L -8,-.15 Z M -8,.15 L 8,.15 L 8,.6 L -8,.6 Z',
  moon: 'M .3,-1 C -.5,-.9 -1,-.4 -1,.1 C -1,.7 -.5,1 0,1 C .5,1 .9,.7 1,.3 C .5,.6 -.2,.4 -.3,-.2 C -.35,-.6 0,-.9 .3,-1 Z',
  target: `${oval(0, 0, 1, 1)} ${oval(0, 0, 0.72, 0.72)} M -.12,-1.2 L .12,-1.2 L .12,1.2 L -.12,1.2 Z`,
};

// -------------------------------------------------------------- tattoos ----
// tattoo/ — ink on the skin. Body space, drawn under all clothing and cut
// to the body silhouette by ComposedPortrait. The id's first word is the
// zone (arm-l, arm-r, chest, neck, belly, face); a wrestler gets at most
// one piece per zone.

const TAT_INK = '#16242c';
// Centre and half-width of the LEFT upper arm and forearm.
const LIMB = {
  m: { upper: [112, 262, 24], fore: [93, 425, 19] },
  f: { upper: [130, 262, 17], fore: [112, 425, 15] },
};
const place = (d, x, y, sc) => d.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (_, u, v) => `${r1(x + u * sc)},${r1(y + v * sc)}`);
const ANCHOR = `M -.1,-.9 L .1,-.9 L .1,-.6 L .5,-.6 L .5,-.4 L .1,-.4 L .1,.55 C .45,.5 .7,.25 .75,-.05 L 1,.15 C .85,.7 .45,1 0,1 C -.45,1 -.85,.7 -1,.15 L -.75,-.05 C -.7,.25 -.45,.5 -.1,.55 L -.1,-.4 L -.5,-.4 L -.5,-.6 L -.1,-.6 Z ${oval(0, -1.12, 0.26, 0.26)} ${oval(0, -1.12, 0.12, 0.12)}`;
const DAGGER = 'M 0,-1.4 L .17,-.2 L .55,-.2 L .55,0 L .14,0 L .14,.9 L 0,1.25 L -.14,.9 L -.14,0 L -.55,0 L -.55,-.2 L -.17,-.2 Z';
const SWALLOW = 'M -1,-.3 C -.5,-.3 -.2,0 0,.3 C .2,0 .5,-.3 1,-.3 C .7,.1 .4,.4 .1,.5 L .3,1 L 0,.7 L -.3,1 L -.1,.5 C -.4,.4 -.7,.1 -1,-.3 Z';
const WING = 'M -.04,.2 C -.3,-.3 -.75,-.36 -1,-.16 C -.8,-.08 -.75,.04 -.84,.2 C -.66,.12 -.56,.24 -.6,.42 C -.44,.3 -.34,.4 -.32,.56 C -.22,.4 -.1,.34 -.04,.36 Z';

function tattoos(g) {
  const b = BODY[g];
  const [cx, ny] = [b.cx, b.neckY];
  const L = LIMB[g];
  const [, pitL] = GAP[g][0];
  // Everything on the left arm is cut off at the arm gap, so a sleeve never bleeds onto the ribs.
  const armClip = `M 0,0 L ${pitL - 6},0 ${GAP[g].map(([y, l]) => `L ${l},${y}`).join(' ')} L 0,512 Z`;
  const ink = (body, clip) =>
    (clip ? `<defs><clipPath id="a"><path d="${clip}"/></clipPath></defs>` : '') +
    `<g opacity=".8"${clip ? ' clip-path="url(#a)"' : ''}>${body}</g>`;
  const I = (d, extra = '') => fill(d, TAT_INK, extra);
  const S = (d, w) => stroke(d, TAT_INK, w);
  const armX = (y) => L.upper[0] + ((L.fore[0] - L.upper[0]) * (y - L.upper[1])) / (L.fore[1] - L.upper[1]);
  const blades = (y0, y1) => {
    let d = '';
    for (let y = y0, i = 0; y < y1; y += 24, i++) {
      const c = armX(y);
      const w = (i % 2 ? -1 : 1) * 46;
      d += `M ${r1(c - w)},${y} C ${r1(c)},${y - 6} ${r1(c + w * 0.6)},${y + 2} ${r1(c + w)},${y + 10} C ${r1(c + w * 0.3)},${y + 8} ${r1(c - w * 0.2)},${y + 12} ${r1(c - w)},${y + 18} C ${r1(c - w * 0.5)},${y + 12} ${r1(c - w * 0.6)},${y + 6} ${r1(c - w)},${y} Z `;
    }
    return d;
  };
  const band = (y, t) => `M 0,${y} L 260,${y + 8} L 260,${y + 8 + t} L 0,${y + t} Z`;
  const zig = (y) => {
    let d = `M 20,${y}`;
    for (let x = 30, i = 0; x < 260; x += 10, i++) d += ` L ${x},${y + (i % 2 ? 7 : -3)}`;
    return d;
  };
  const up = (d, sc = 1) => place(d, L.upper[0], L.upper[1], L.upper[2] * sc);
  const fo = (d, sc = 1) => place(d, L.fore[0], L.fore[1], L.fore[2] * sc);
  const arm = {
    tribal: I(blades(206, 330), ' fill-rule="nonzero"'),
    sleeve: I(blades(206, 480), ' fill-rule="nonzero"') + S(`M ${armX(210) - 30},214 L ${armX(470) - 26},470 M ${armX(210) + 30},214 L ${armX(470) + 26},470`, 1.4),
    bands: I(`${band(292, 7)} ${band(306, 3)} ${band(400, 5)}`, ' fill-rule="nonzero"'),
    'barbed-wire': S(`${zig(296)} ${zig(302)}`, 1.8),
    heart: I(up(heart(0, -0.1, 0.8, 0.75))) + I(up('M -1.1,.15 L 1.1,-.05 L 1.1,.4 L -1.1,.6 Z'), ' opacity=".6"'),
    skull: I(up(LOGOS.skull, 0.95)),
    stars: I(`${place(star(0, 0, 1, 1), L.upper[0] - 4, L.upper[1] - 34, L.upper[2] * 0.55)} ${up(star(0.2, 0.3, 0.42, 0.42))} ${up(star(-0.5, 0.9, 0.3, 0.3))}`, ' fill-rule="nonzero"'),
    anchor: I(fo(ANCHOR, 0.95)),
    dagger: I(fo(DAGGER, 1.05)),
    'forearm-bands': I(`${band(380, 4)} ${band(392, 9)} ${band(410, 4)}`, ' fill-rule="nonzero"'),
  };
  const out = {};
  for (const [id, body] of Object.entries(arm)) {
    out[`arm-l-${id}`] = ink(body, armClip);
    out[`arm-r-${id}`] = ink(flipX(g, body), flipX(g, armClip));
  }
  // Chest pieces sit on the upper chest — on a woman that is above the bust, and mostly under her top.
  const [chY, chS] = g === 'm' ? [ny + 78, 86] : [ny + 52, 62];
  const wing = place(WING, cx, chY, chS);
  Object.assign(out, {
    'chest-wings': ink(I(`${wing} ${flipX(g, wing)} ${place('M 0,-.1 L .1,.25 L 0,.6 L -.1,.25 Z', cx, chY, chS)}`, ' fill-rule="nonzero"')),
    'chest-script': ink(S(`M ${cx - chS * 0.9},${chY - 14} C ${cx - chS * 0.4},${chY + 6} ${cx + chS * 0.4},${chY + 6} ${cx + chS * 0.9},${chY - 14} M ${cx - chS * 0.7},${chY + 2} C ${cx - chS * 0.3},${chY + 18} ${cx + chS * 0.3},${chY + 18} ${cx + chS * 0.7},${chY + 2}`, 2.6)),
    'chest-sun': ink(I(`${place(star(0, 0, 1, 1, 12, 0.6), cx, chY, chS * 0.36)} ${place(oval(0, 0, 0.34, 0.34), cx, chY, chS * 0.36)}`)),
    'chest-shoulder-cap': ink(I(blades(196, 268).replace(/(-?[\d.]+),(-?[\d.]+)/g, (_, x, y) => `${r1(+x + 44)},${y}`), ' fill-rule="nonzero"')),
    'neck-swallow': ink(I(place(SWALLOW, cx + (g === 'm' ? 22 : 18), ny - 20, 10))),
    'neck-star': ink(I(place(star(0, 0, 1, 1), cx - (g === 'm' ? 22 : 18), ny - 22, 8))),
    'belly-script': ink(S(`M ${cx - 46},418 C ${cx - 20},404 ${cx + 20},404 ${cx + 46},418 M ${cx - 34},432 C ${cx - 14},422 ${cx + 14},422 ${cx + 34},432`, 2.4)),
    'belly-sun': ink(I(`${place(star(0, 0, 1, 1, 10, 0.55), cx, 440, 22)} ${place(oval(0, 0, 0.36, 0.36), cx, 440, 22)}`)),
    'face-teardrop': ink(I(hp(g, 'M .62,.6 C .7,.66 .7,.72 .62,.74 C .54,.72 .54,.66 .62,.6 Z'))),
    'face-star': ink(I(hp(g, star(-0.78, 0.4, 0.13, 0.055)))),
  });
  return out;
}

// ------------------------------------------------------------- patterns ----
// pattern/ — a second color laid over a top and cut to that top's shape by
// ComposedPortrait. Canvas-wide and gender-neutral, so these are `both-`.

function patterns() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const rect = (x, y, w, h) => `M ${r1(x)},${r1(y)} L ${r1(x + w)},${r1(y)} L ${r1(x + w)},${r1(y + h)} L ${r1(x)},${r1(y + h)} Z`;
  const grid = (step, fn, stagger = true) => {
    let d = '';
    for (let y = 130, row = 0; y < 520; y += step, row++) for (let x = 20 + (stagger && row % 2 ? step / 2 : 0); x < 500; x += step) d += `${fn(x, y, row)} `;
    return d;
  };
  const rows = (step, h) => Array.from({ length: Math.ceil(400 / step) }, (_, i) => rect(0, 130 + i * step, 512, h)).join(' ');
  const cols = (step, w) => Array.from({ length: Math.ceil(512 / step) }, (_, i) => rect(i * step, 100, w, 420)).join(' ');
  const diag = (step, w) => Array.from({ length: 40 }, (_, i) => `M ${i * step - 420},520 L ${i * step - 420 + w},520 L ${i * step + w},100 L ${i * step},100 Z`).join(' ');
  const blob = (x, y, r) => {
    const n = 7;
    let d = '';
    for (let i = 0; i <= n; i++) {
      const a = (Math.PI * 2 * i) / n;
      const rr = r * (0.6 + rnd() * 0.7);
      d += `${i ? 'L' : 'M'} ${r1(x + rr * Math.cos(a) * 1.5)},${r1(y + rr * Math.sin(a))} `;
    }
    return `${d}Z`;
  };
  const scatter = (n, fn) => Array.from({ length: n }, () => fn(30 + rnd() * 450, 140 + rnd() * 370)).join(' ');
  const slash = (y, dir) => {
    const x0 = dir > 0 ? 40 : 472;
    return `M ${x0},${y} C ${x0 + dir * 60},${y + 4} ${x0 + dir * 130},${y + 14} ${x0 + dir * 190},${y + 34} C ${x0 + dir * 120},${y + 26} ${x0 + dir * 60},${y + 22} ${x0},${y + 20} Z`;
  };
  const flames = () => {
    let d = 'M 0,520 L 0,440';
    for (let x = 0, i = 0; x < 512; x += 32, i++) d += ` C ${x + 6},${420 - (i % 3) * 14} ${x + 12},${380 - (i % 2) * 30} ${x + 16},${350 - (i % 3) * 22} C ${x + 20},${390} ${x + 26},${420} ${x + 32},440`;
    return `${d} L 512,520 Z`;
  };
  const chevrons = Array.from({ length: 9 }, (_, i) => {
    const y = 150 + i * 44;
    return `M 20,${y} L 256,${y + 60} L 492,${y} L 492,${y + 18} L 256,${y + 78} L 20,${y + 18} Z`;
  }).join(' ');
  return {
    'hoop-stripes': rows(30, 13),
    'thin-hoops': rows(16, 5),
    'vertical-stripes': cols(28, 12),
    pinstripes: cols(14, 3),
    diagonal: diag(34, 14),
    'polka-dots': grid(30, (x, y) => oval(x, y, 7, 7)),
    checker: grid(48, (x, y) => `${rect(x, y, 24, 24)} ${rect(x + 24, y + 24, 24, 24)}`, false),
    'star-field': grid(46, (x, y) => star(x, y, 10, 10)),
    camo: scatter(46, (x, y) => blob(x, y, 14 + rnd() * 10)),
    'tiger-stripes': Array.from({ length: 14 }, (_, i) => slash(150 + i * 27, i % 2 ? 1 : -1)).join(' '),
    leopard: scatter(70, (x, y) => `${blob(x, y, 7)} ${oval(x, y, 3, 2.4)}`),
    flames: flames(),
    'color-block': rect(0, 330, 512, 200),
    'half-and-half': rect(256, 100, 256, 420),
    chevrons,
    sash: 'M 120,130 L 190,130 L 420,520 L 340,520 Z',
    sequins: scatter(170, (x, y) => oval(x, y, 2.2, 2.2)),
    hearts: grid(44, (x, y) => heart(x, y, 10, 9)),
    'side-panels': `${rect(0, 100, 196, 420)} ${rect(316, 100, 196, 420)}`,
    'shoulder-yoke': 'M 0,100 L 512,100 L 512,236 C 380,262 132,262 0,236 Z',
  };
}

// ---------------------------------------------------------------- write ----

let count = 0;
function write(folder, name, content) {
  fs.mkdirSync(path.join(ROOT, folder), { recursive: true });
  fs.writeFileSync(path.join(ROOT, folder, name), content);
  count++;
}

for (const folder of ['pattern', 'tattoo', 'face', 'hair', 'facial', 'prop', 'acc', 'paint', 'neck', 'logo', 'top', 'outer', 'waistband']) {
  const dir = path.join(ROOT, folder);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.svg')) fs.unlinkSync(path.join(dir, f));
}

const tinted = (d, opacity) => fill(d, GREY, opacity ? ` opacity="${opacity}"` : '');

for (const [id, d] of Object.entries(patterns())) write('pattern', `both-${id}--tint.svg`, svg(fill(d, GREY, ' fill-rule="nonzero"')));

for (const g of ['m', 'f']) {
  for (const kind of ['neutral', 'stern', 'scowl', 'smirk']) write('face', `${g}-${kind}.svg`, face(g, kind));

  for (const [id, def] of Object.entries(HAIR)) {
    if (!def.g.includes(g)) continue;
    const d = typeof def.d === 'string' ? def.d : def.d[g];
    const faint = def.faint ? fill(hp(g, def.faint), GREY, ' opacity=".4"') : '';
    write('hair', `${g}-${id}--xl--tint.svg`, svg(faint + fill(hp(g, d)), true));
  }

  if (g === 'm') {
    for (const [id, def] of Object.entries(FACIAL)) write('facial', `m-${id}--tint.svg`, svg(tinted(hp(g, def.d), def.opacity)));
  }

  for (const [id, d] of Object.entries(HAT_TINT)) write('prop', `${g}-${id}--xl--tint.svg`, svg(tinted(hp(g, d)), true));
  for (const [id, body] of Object.entries(hatsFixed(g))) write('prop', `${g}-${id}--xl.svg`, svg(body, true));

  for (const [id, d] of Object.entries(ACC_TINT)) write('acc', `${g}-${id}--tint.svg`, svg(tinted(hp(g, d))));
  for (const [id, body] of Object.entries(accFixed(g))) write('acc', `${g}-${id}.svg`, svg(body));

  for (const [id, [d, opacity]] of Object.entries(PAINT_TINT)) write('paint', `${g}-${id}--tint.svg`, svg(tinted(hp(g, d), opacity)));
  for (const [id, body] of Object.entries(paintFixed(g))) write('paint', `${g}-${id}.svg`, svg(body));

  const n = neck(g);
  for (const [id, d] of Object.entries(n.tint)) write('neck', `${g}-${id}--tint.svg`, svg(d ? tinted(d) : n.boa));
  for (const [id, body] of Object.entries(n.fixed)) write('neck', `${g}-${id}.svg`, svg(body));

  for (const [id, body] of Object.entries(tattoos(g))) write('tattoo', `${g}-${id}.svg`, svg(body));

  for (const [id, d] of Object.entries(LOGOS)) write('logo', `${g}-${id}--tint.svg`, svg(tinted(lp(g, d))));

  for (const [folder, kinds] of Object.entries(looseWear(g))) {
    for (const [id, d] of Object.entries(kinds.tint)) write(folder, `${g}-${id}--loose--tint.svg`, svg(fill(d, GREY, ' fill-rule="nonzero"')));
    for (const [id, body] of Object.entries(kinds.fixed)) write(folder, `${g}-${id}--loose.svg`, svg(body));
  }

  for (const [folder, items] of Object.entries(clothing(g))) {
    for (const [id, d] of Object.entries(items)) write(folder, `${g}-${id}--tint.svg`, svg(fill(d)));
  }
}

console.log(`wrote ${count} paperdoll assets to ${path.relative(process.cwd(), ROOT)}`);
