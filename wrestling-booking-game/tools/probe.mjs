// Play the game and report what actually happened.
//
// The balance harness (`npm run sim`) generates people and prints their stats.
// This is the other half: it *plays a save* through the real store, for as many
// seeds and weeks as you ask, and reports the numbers you can only get by
// playing — injury load, morale spread, what the office had people doing, how
// a roster developed.
//
// Every serious bug found in this codebase so far was found this way and not by
// a test: the whole roster's contracts expiring in one week, the idle-morale
// rotation charging everybody every week, `moraleShowNeutral` sitting above 90%
// of the distribution it was meant to be the middle of, rival wages that never
// moved. Tests check that a function does what it says. This checks whether the
// game the player gets is any good.
//
// It exists as a checked-in tool rather than a scratch script because it kept
// being rewritten from scratch — a bespoke Playwright harness per question, ten
// times, each one re-deriving the same setup.
//
// ---------------------------------------------------------------------------
// Usage
//
//   node tools/probe.mjs --report injuries
//   node tools/probe.mjs --report morale --seeds 8 --weeks 140
//   node tools/probe.mjs --report all --seeds 3 --weeks 104 --set casualtyChanceCompetitor=0.02
//
//   --report   injuries | morale | assignments | development | money | all
//   --seeds    how many saves to average over (default 3)
//   --weeks    weeks to play each one (default 104)
//   --port     dev server port (default 5199)
//   --set      settings override, repeatable: --set key=number
//   --restock  sign free agents to keep the roster full (default on; --restock=0 off)
//
// It starts its own dev server, because `window.__store` only exists in dev.

import { spawn } from 'node:child_process';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

// ------------------------------------------------------------------- args

const argv = process.argv.slice(2);
function arg(name, fallback) {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  if (hit.includes('=')) return hit.split('=').slice(1).join('=');
  const next = argv[argv.indexOf(hit) + 1];
  return next && !next.startsWith('--') ? next : true;
}

const REPORT = String(arg('report', 'all'));
const SEEDS = Number(arg('seeds', 3));
const WEEKS = Number(arg('weeks', 104));
const PORT = Number(arg('port', 5199));
const RESTOCK = String(arg('restock', '1')) !== '0';
const OVERRIDES = Object.fromEntries(
  argv
    .filter((a) => a.startsWith('--set'))
    .map((a, i) => (a.includes('=') ? a.slice('--set='.length) : argv[argv.indexOf(a) + 1]))
    .filter(Boolean)
    .map((pair) => {
      const [k, v] = String(pair).split('=');
      return [k, Number(v)];
    }),
);

// --------------------------------------------------------------- the server

async function serve() {
  const proc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    detached: true,
  });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(`http://localhost:${PORT}/`);
      if (res.ok) return proc;
    } catch {
      /* not up yet */
    }
  }
  throw new Error(`dev server did not come up on ${PORT}`);
}

// ------------------------------------------------------------ playing a save
//
// Runs inside the page. Everything it needs has to be passed in — it cannot
// close over anything from this file.

async function playOne(page, { seed, weeks, restock, overrides }) {
  return page.evaluate(
    async ({ seed, weeks, restock, overrides }) => {
      const s = () => window.__store.getState();
      s().newGame();
      const base = {
        ...s().world.settings,
        // Mandates end a passive run at week 24, which makes any long
        // measurement impossible. Off for every probe, deliberately.
        ownerMandatesEnabled: false,
        seed,
        ...overrides,
      };
      s().newGame(base);

      const out = {
        weeksPlayed: 0,
        matches: 0,
        botched: 0,
        injuriesStarted: [],
        outAtWeek: [],
        rosterAtWeek: [],
        doing: {},
        moraleEnd: [],
        ringIQStart: [],
        ringIQEnd: [],
        popStart: [],
        popEnd: [],
        rating: 0,
        bank: 0,
        rosterEnd: 0,
      };

      const seen = new Set();
      const startIds = [...s().world.promotion.rosterIds];
      for (const id of startIds) {
        const w = s().world.wrestlers[id];
        if (w) {
          out.ringIQStart.push(w.ringIQ ?? 0);
          out.popStart.push(w.popularity ?? 0);
        }
      }

      for (let i = 0; i < weeks; i++) {
        const before = s().world;
        if (!before || !before.promotion.rosterIds.length) break;
        if (restock && before.promotion.rosterIds.length < base.startingRosterSize) {
          const pick = [...before.freeAgents].sort((a, b) => (a.askingRate ?? 0) - (b.askingRate ?? 0))[0];
          if (pick) s().signFreeAgent(pick.wrestlerId);
        }
        s().autoFillCard();
        s().resolveWeek();
        if (s().world?.pendingWeatherCall) s().answerWeatherCall('runIt');

        const w = s().world;
        if (!w || !w.promotion.rosterIds.length) break;
        out.weeksPlayed = w.week;

        // What ran, and what went wrong in it.
        const show = (w.showHistory ?? []).slice(-1)[0];
        if (show && show.week === w.week - 1) {
          for (const seg of show.segments ?? []) {
            if (seg.kind !== 'match') continue;
            out.matches += 1;
            const beats = seg.result?.beats ?? seg.beats ?? [];
            if (beats.some((b) => b.kind === 'botch')) out.botched += 1;
          }
        }

        // Injuries: counted once, when they start, with their length.
        let onTheShelf = 0;
        for (const id of w.promotion.rosterIds) {
          const p = w.wrestlers[id];
          if (!p) continue;
          if (p.injury) {
            onTheShelf += 1;
            // Keyed on when it happened, not on what is left of it. Keying
            // on `weeksRemaining` counts the same injury once per week as it
            // ticks down, which inflated the count by roughly the median
            // length and skewed the distribution toward short remainders.
            const key = `${id}:${p.injury.sufferedWeek}`;
            if (!seen.has(key)) {
              seen.add(key);
              out.injuriesStarted.push({
                weeks: p.injury.totalWeeks,
                severity: p.injury.severity,
              });
            }
          }
          const note = p.doingThisWeek;
          if (note) out.doing[note] = (out.doing[note] ?? 0) + 1;
        }
        out.outAtWeek.push(onTheShelf);
        out.rosterAtWeek.push(w.promotion.rosterIds.length);
      }

      const w = s().world;
      if (w) {
        for (const id of w.promotion.rosterIds) {
          const p = w.wrestlers[id];
          if (!p) continue;
          out.moraleEnd.push(p.morale ?? 0);
          out.ringIQEnd.push(p.ringIQ ?? 0);
          out.popEnd.push(p.popularity ?? 0);
        }
        out.rating = w.promotion.rating;
        out.bank = w.promotion.bankBalance;
        out.rosterEnd = w.promotion.rosterIds.length;
      }
      return out;
    },
    { seed, weeks, restock, overrides },
  );
}

// --------------------------------------------------------------- the reports

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sd = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
};
const pct = (n, d) => (d > 0 ? ((100 * n) / d).toFixed(1) + '%' : '—');
const round = (n, p = 1) => Number(n.toFixed(p));

function injuries(runs) {
  const started = runs.flatMap((r) => r.injuriesStarted);
  const outShare = mean(
    runs.flatMap((r) => r.outAtWeek.map((n, i) => (r.rosterAtWeek[i] ? n / r.rosterAtWeek[i] : 0))),
  );
  const lengths = started.map((i) => i.weeks).sort((a, b) => a - b);
  const q = (p) => (lengths.length ? lengths[Math.floor(lengths.length * p)] : 0);
  const bySeverity = {};
  for (const i of started) bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;

  const lines = [
    `  on the shelf at any moment   ${(100 * outShare).toFixed(1)}% of the roster`,
    `  new injuries                 ${started.length} over ${runs.length} saves`,
    `  per match                    ${pct(started.length, runs.reduce((n, r) => n + r.matches, 0))}`,
    `  length  p25 ${q(0.25)}w  median ${q(0.5)}w  p75 ${q(0.75)}w  p90 ${q(0.9)}w  worst ${lengths.at(-1) ?? 0}w`,
    `  long ones (8w+)              ${pct(lengths.filter((w) => w >= 8).length, lengths.length)}`,
    `  by severity                  ${Object.entries(bySeverity).map(([k, n]) => `${k} ${pct(n, started.length)}`).join('  ')}`,
    `  botched matches              ${pct(runs.reduce((n, r) => n + r.botched, 0), runs.reduce((n, r) => n + r.matches, 0))}`,
  ];
  return lines;
}

function morale(runs) {
  const all = runs.flatMap((r) => r.moraleEnd);
  return [
    `  mean ${round(mean(all))}  spread(sd) ${round(sd(all))}`,
    `  range ${Math.round(Math.min(...all))} to ${Math.round(Math.max(...all))}`,
  ];
}

function assignments(runs) {
  const doing = {};
  for (const r of runs) for (const [k, n] of Object.entries(r.doing)) doing[k] = (doing[k] ?? 0) + n;
  const total = Object.values(doing).reduce((a, b) => a + b, 0);
  return Object.entries(doing)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `  ${pct(n, total).padStart(6)}  ${k}`);
}

function development(runs) {
  return [
    `  ring IQ    ${round(mean(runs.flatMap((r) => r.ringIQStart)))} -> ${round(mean(runs.flatMap((r) => r.ringIQEnd)))}`,
    `  popularity ${round(mean(runs.flatMap((r) => r.popStart)))} -> ${round(mean(runs.flatMap((r) => r.popEnd)))}`,
  ];
}

function money(runs) {
  return [
    `  company rating  ${round(mean(runs.map((r) => r.rating)))}`,
    `  bank            $${Math.round(mean(runs.map((r) => r.bank)) / 1000)}k`,
    `  roster          ${round(mean(runs.map((r) => r.rosterEnd)))}`,
    `  survived        ${runs.filter((r) => r.weeksPlayed >= WEEKS).length}/${runs.length} saves`,
  ];
}

const REPORTS = { injuries, morale, assignments, development, money };

// -------------------------------------------------------------------- main

const server = await serve();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });

  const runs = [];
  for (let i = 0; i < SEEDS; i++) {
    process.stdout.write(`\r  playing seed ${i + 1}/${SEEDS}...   `);
    runs.push(await playOne(page, { seed: `probe-${i}`, weeks: WEEKS, restock: RESTOCK, overrides: OVERRIDES }));
  }
  process.stdout.write('\r' + ' '.repeat(40) + '\r');

  console.log(`${SEEDS} saves x ${WEEKS} weeks${RESTOCK ? ', roster kept stocked' : ', passive'}`);
  if (Object.keys(OVERRIDES).length) console.log(`overrides: ${JSON.stringify(OVERRIDES)}`);
  console.log('');
  const wanted = REPORT === 'all' ? Object.keys(REPORTS) : [REPORT];
  for (const name of wanted) {
    const fn = REPORTS[name];
    if (!fn) {
      console.log(`unknown report "${name}" — try ${Object.keys(REPORTS).join(', ')}, all`);
      continue;
    }
    console.log(`${name}:`);
    for (const line of fn(runs)) console.log(line);
    console.log('');
  }
} finally {
  await browser.close();
  try {
    process.kill(-server.pid);
  } catch {
    /* already gone */
  }
}
