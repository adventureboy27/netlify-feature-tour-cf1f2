// Headless balance harness — `npm run sim`.
//
// M0 scope (booking-game-design.md §0 "Where to start", step 6): generate 300
// wrestlers with the seeded RNG and print them. No UI, no week simulation yet
// — this script grows into the full 20-simulated-year balance harness (§2
// "Balance test harness") as later milestones add the weekly loop, the sim
// engine, and AI promotions.

import { rngFromSeed } from '../src/engine/rng';
import { generateWrestlers } from '../src/engine/generate/wrestler';
import { defaultWorldSettings } from '../src/engine/world/settings';
import type { Wrestler } from '../src/engine/types';

const ROSTER_SIZE = 300;

function formatRow(w: Wrestler, index: number): string {
  const alignment = w.alignment >= 15 ? 'face' : w.alignment <= -15 ? 'heel' : 'tween';
  const cols = [
    String(index + 1).padStart(3, ' '),
    w.name.padEnd(24, ' '),
    w.archetype.padEnd(11, ' '),
    w.style.padEnd(11, ' '),
    alignment.padEnd(5, ' '),
    `age ${String(w.age).padStart(2, ' ')}`,
    `pop ${String(w.popularity).padStart(2, ' ')}`,
    `str ${String(w.strength).padStart(2, ' ')}`,
    `skl ${String(w.skill).padStart(2, ' ')}`,
    `agi ${String(w.agility).padStart(2, ' ')}`,
    `sta ${String(w.stamina).padStart(2, ' ')}`,
    `${w.gender}`,
    `${w.weightLbs}lb`,
    w.gimmick.name,
  ];
  return cols.join('  ');
}

function summarize(wrestlers: Wrestler[]): void {
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

  const byArchetype = new Map<string, number>();
  for (const w of wrestlers) byArchetype.set(w.archetype, (byArchetype.get(w.archetype) ?? 0) + 1);

  const faces = wrestlers.filter((w) => w.alignment >= 15).length;
  const heels = wrestlers.filter((w) => w.alignment <= -15).length;
  const tweeners = wrestlers.length - faces - heels;

  console.log('\n--- Summary ---');
  console.log(`Total generated: ${wrestlers.length}`);
  console.log(`Unique names: ${new Set(wrestlers.map((w) => w.name.toLowerCase())).size}`);
  console.log(
    `Alignment split: ${faces} face (${((faces / wrestlers.length) * 100).toFixed(1)}%) / ` +
      `${heels} heel (${((heels / wrestlers.length) * 100).toFixed(1)}%) / ` +
      `${tweeners} tweener (${((tweeners / wrestlers.length) * 100).toFixed(1)}%)`,
  );
  console.log(`Gender split: ${wrestlers.filter((w) => w.gender === 'm').length} m / ${wrestlers.filter((w) => w.gender === 'f').length} f`);
  console.log(
    `Mean stats — pop ${mean(wrestlers.map((w) => w.popularity)).toFixed(1)}, ` +
      `str ${mean(wrestlers.map((w) => w.strength)).toFixed(1)}, ` +
      `skl ${mean(wrestlers.map((w) => w.skill)).toFixed(1)}, ` +
      `agi ${mean(wrestlers.map((w) => w.agility)).toFixed(1)}, ` +
      `sta ${mean(wrestlers.map((w) => w.stamina)).toFixed(1)}, ` +
      `talent(hidden) ${mean(wrestlers.map((w) => w.talent)).toFixed(1)}`,
  );
  console.log(`Mean age: ${mean(wrestlers.map((w) => w.age)).toFixed(1)}`);
  console.log('Archetype distribution:');
  for (const [archetype, count] of [...byArchetype.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${archetype.padEnd(11, ' ')} ${count} (${((count / wrestlers.length) * 100).toFixed(1)}%)`);
  }
}

function main(): void {
  const settings = defaultWorldSettings();
  const rng = rngFromSeed(settings.seed);
  const wrestlers = generateWrestlers(rng, ROSTER_SIZE, { currentYear: settings.startingYear });

  console.log(`Generated ${wrestlers.length} wrestlers with seed "${settings.seed}"\n`);
  wrestlers.forEach((w, i) => console.log(formatRow(w, i)));
  summarize(wrestlers);
}

main();
