# What a played save actually looks like

Numbers measured by playing the game, not by reasoning about it. They exist so
that nobody re-measures them from scratch, and so that a tuning change can be
argued against a baseline instead of a hunch.

**How to reproduce any of these:**

```
node tools/probe.mjs --report all --seeds 6 --weeks 104
node tools/probe.mjs --report injuries --seeds 6 --set=casualtyChanceCompetitor=0.02
```

The probe plays real saves through the real store. Unless a row says otherwise
it is: 6 seeds x 104 weeks, owner mandates off, roster kept stocked from free
agents, card auto-filled every week.

Two rules that have earned themselves:

- **Compare like with like.** Changing the seed count changes which saves you
  are averaging, so a 3-seed run and a 4-seed run are not comparable. Use
  `--set` to A/B a setting across the *same* seeds.
- **Six seeds is about the floor for a stable read.** Three is enough to spot a
  gross problem and not enough to tune on.

---

## Injuries — measured 2026-08-17

Two passes. The first cut the rate; the second replaced severity-as-a-label
with severity-as-a-number.

| | Original | After rate work | After the grade model |
|---|---|---|---|
| On the shelf at any moment | 21.0% | 12.5% | **9.0%** |
| Injuries per match | 9.3% | 6.1% | 5.4% |
| Minor / moderate / severe / career | — | — | 32 / 40 / 27 / 0.9% |
| Worst single injury | 66w | 30-80w | 62w |
| Matches with a blown spot | 4.4% | 4.1% | 4.7% |

The shelf figure counts people who cannot be booked. It fell in the second pass
partly because injuries got shorter and partly because somebody is fit to work
again at `gradeFitToWork` rather than at full recovery — they come back
carrying it, and carrying it still makes them easier to hurt.

**Pass one: compounding.** `injuryMultiplier` scaled an injury's *length* as
hard as its *odds*, and every source of it compounds — stipulation, pace, bad
blood, nobody at ringside, a blown spot, a fragile body. A hardcore match with
a botch and a Made Of Glass wrestler is about 10x, turning a six-week injury
into a sixty-week one. Length now scales sub-linearly
(`casualtyLengthExponent`) and the odds are untouched, because the odds are the
honest place for danger to show up. Career-enders became their own roll
(`casualtyCatastrophicChance`) rather than the far end of a multiplier —
capping the compounding had removed them entirely.

**Pass two: `Injury.grade`.** Severity used to be a label inferred from a week
count, so nothing could ask how hurt somebody was *now*. Grade is 0-100 and is
the thing that moves: it heals down by what the week was spent doing, a fresh
injury stacks onto it rather than replacing it, and weeks-remaining is an
estimate re-derived from it every week.

Three numbers in that model are pinned rather than picked, and each was picked
first and wrong:

- **Band edges derive from the week thresholds.** Round numbers moved "severe"
  from ten weeks to fifteen — a balance change dressed as a refactor.
- **`gradeHealResting` is `100 / gradeWeeksAtWorst`.** A week of rest has to be
  a week of recovery or the estimate lies about itself. Set by hand at 6 it was
  nearly double, and the shelf figure read 1.2%.
- **The tick belongs outside the per-wrestler loop.** Nested inside it, every
  injury healed or worsened once per person in the world — about 300 times a
  week. Symptoms were a 1.2% shelf and every surviving injury reading
  career-threatening.

**Known, not addressed:** the 8-weeks-plus share sits near 38% and barely moves
whatever the multipliers do, because it is set by the `weeks` centres in the
injury cause table (`src/data/casualties.ts`) rather than by any tunable.
Changing it means editing causes one at a time.

## Morale — measured 2026-08-17

| | Value |
|---|---|
| Mean at week 160 | 33 |
| Spread (sd) | 30.9 |
| Range | 0 to 100 |

Before personality traits the spread was around 10 — everybody drifted to the
same number, because nothing in the room wanted different things. The spread is
the number that matters here, not the mean.

**Set points and levers** live in `src/engine/career/personality.ts`.

### The floor — measured 2026-08-17

`moraleFloor` (10) replaced the implicit 0 floor every `.morale = clamp(x, 0,
100)` write used across `state/store.ts`. A/B on the same 5 seeds x 160 weeks,
`--set moraleFloor=0` against the shipped default of 10:

| | floor 0 (old) | floor 10 (shipped) |
|---|---|---|
| At the literal floor | 4.7% of the roster | 4.7% of the roster |
| Disgruntled (restless+unhappy+miserable) | 52.3% | 59.0% |
| Range | 0 to 100 | 10 to 96 |

Same share of the roster still bottoms out under sustained neglect (long idle,
demanding traits) — that is booking-driven and correct, not a bug the floor is
meant to fix. What changes is where they sit when it happens: a livable rock
bottom inside "miserable" rather than the literal edge of the whole scale, which
read as broken rather than as "as bad as it gets." The wider disgruntled band is
a side effect of nobody's mood being able to hard-clamp at the exact bottom
anymore, not a deliberate second lever — no term magnitude or weekly cap moved.

Reproduce: `node tools/probe.mjs --report morale --seeds 5 --weeks 160` against
the same command with `--set moraleFloor=0`.

## The roster — measured 2026-08-17

| | Value |
|---|---|
| Median health, working roster | 52 |
| 10th percentile health | 41 |
| Share below 55 | 58% |

This is why `assignmentRestBelowHealth` is 42 and not 55: anything near the
median sends most of the company home every week, and the office then never
develops anybody.

## Shows

| | Value |
|---|---|
| Mean show rating, player | 41 |
| Mean show rating, rivals | 41 |
| Share above 55 | 8-13% |

`moraleShowNeutral` is pinned to this (42). It sat at 55 for a long time, which
is above 90% of the distribution it was meant to be the middle of, so "The show
was a mess" printed after nearly every card anybody ran.

## Company health, well-run save

| | Value |
|---|---|
| Company rating at week 104-160 | 75-93 |
| Bank | $2.4M-2.9M |
| Rivals folded per 140 weeks | ~1.7 of 6 |

A *passive* booker — never signing anybody — declines to nothing and this is
correct behaviour, not a bug. Any measurement of long-run health has to restock
or it is measuring a company that refuses to hire.
