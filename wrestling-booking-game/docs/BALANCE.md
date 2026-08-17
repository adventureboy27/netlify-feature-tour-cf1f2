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

| | Before | After | Target |
|---|---|---|---|
| On the shelf at any moment | 21.0% | **12.5%** | 10-12% |
| Injuries per match | 9.3% | 6.1% | — |
| Median length | 6w | 6w | — |
| 8 weeks or longer | 40.8% | ~30% | — |
| Career-threatening | 1.0% | 1-2% | rare, never zero |
| Worst single injury | 66w | 30-80w | rare |
| Matches with a blown spot | 4.4% | 4.1% | — |

**What was wrong.** `injuryMultiplier` scaled an injury's *length* as hard as
it scaled its *odds*, and every source of it compounds — stipulation, pace, bad
blood, nobody at ringside, a blown spot, a body that breaks easily. A hardcore
match with a botch and a fragile wrestler came to roughly 10x, turning a
six-week injury into a sixty-week one. Length now scales sub-linearly
(`casualtyLengthExponent`), and the odds are left alone, because the odds are
the honest place for danger to show up.

**Career-enders are their own roll** (`casualtyCatastrophicChance`), not the far
end of the multiplier. Capping the compounding removed them entirely, which was
not the point — a career-ender should be a rare awful thing that can happen in
any match, not something a booker manufactures by stacking a dangerous card.

**Known, not yet addressed:** the 8-weeks-plus share sits around 30% and barely
moves whatever the multipliers do, because it is set by the `weeks` centres in
the injury cause table (`src/data/casualties.ts`) rather than by any tunable.
Changing it means editing the causes, one at a time.

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
