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

### Popularity vs. workrate in match rating — measured 2026-08-17

`computeMatchRating`'s two biggest single terms were popularity (weight 42)
and workrate (weight 24) — fame outweighed skill nearly 2:1 at the top of the
scale. Measured effect: an opener could not become a genuinely good match by
being well-worked, only by being famous, which is backwards for a system that
is supposed to let a deep roster's hidden talent get discovered. A/B on the
same 6 seeds x 104 weeks, `--set matchRatingPopularityWeight=42
--set matchRatingWorkrateWeight=24` (the old values) against the shipped
24/42:

| | pop 42 / work 24 (old) | pop 24 / work 42 (shipped) |
|---|---|---|
| Mean show rating | 49.2 | 50.6 |
| Opener rating | 24.4 | 25.8 |
| Main event rating | 46.7 | 45.9 |
| Low-popularity matches (bottom third) rating >=55 | 0.5% | 1.9% |

Roughly a swap rather than a straight cut, sized so the two terms' *average*
combined contribution barely moves (the roster's mean popularity and mean
raw workrate happen to sit close together, ~46-52 on this save's roster) —
which is why the overall show rating and main event rating barely shift.
What moves is which matches can reach a good rating: a technically strong
performer nobody has heard of yet went from a ~1-in-200 chance of a real
55+ to better than 1-in-50. Still a small share in absolute terms — a
"future superstar" being visibly great before anyone is booking them as one
is meant to be a genuine find, not the median outcome.

**A miscalibration caught during this measurement, not before it:** the
probe's `--set` parsing broke on more than one override passed as separate
`--set key=value` tokens — `argv.indexOf('--set')` always resolved to the
*first* `--set` in argv, so a second `--set` silently reused the first
override's value instead of its own. The first A/B run this produced looked
like the reweighting made everything worse; it was actually comparing
pop-24/work-42 against pop-42/work-42 (the second `--set` had been dropped).
Fixed in `tools/probe.mjs` to pair each `--set` with the token that
immediately follows it, by index, rather than re-searching argv.

Reproduce: `node tools/probe.mjs --report shows --seeds 6 --weeks 104`
against the same command with `--set matchRatingPopularityWeight=42 --set
matchRatingWorkrateWeight=24`.

`moraleShowNeutral` is pinned to this (42). It sat at 55 for a long time, which
is above 90% of the distribution it was meant to be the middle of, so "The show
was a mess" printed after nearly every card anybody ran.

## Undercard popularity decay — measured 2026-08-18

`--report development` on a roster kept fully stocked and booked, nobody
idle on purpose: mean popularity fell 49.3 -> 42.2 over two seasons (104
weeks). Not composition (new low-popularity signings diluting the average)
— isolated that by disabling `matchPopularityChase` entirely, which left
only a 49.3 -> 46.7 drift, and by also turning restocking off
(`--restock=0`, a fixed roster, no new signings at all), which showed
popularity *climbing*, 49.3 -> 56.5, from win bonuses alone. So the fall
side of `popularityChase` — the term that pulls a wrestler's popularity
toward the rating of the matches they're in — was the whole story: a fixed
six-slot card serving a much bigger roster means most of the roster spends
most weeks chasing a ~25-rated opener (see the shows section above) down,
and there was nothing damping that side of it.

Fixed the same way `ratingLadderFallMultiplier` already treats the
company's own rating — falling slower than climbing, not falling not at
all — via `matchPopularityChaseFallShare` (0.4):

| | fall undamped (old) | fall at 0.4 (shipped) |
|---|---|---|
| Popularity, week 1 -> 104 | 49.3 -> 42.2 | 49.3 -> 46.1 |

46.1 lands close to the 46.7 composition-only floor measured above — most
of the individual-level decay is gone, a fixed roster with no chase at all
would still drift a little from new signings, and there is still real
(damped, not eliminated) downward pressure on anyone kept on the
undercard, because reaching zero real consequence for a genuinely dead-end
push was never the goal — see docs/BACKLOG.md.

Reproduce: `node tools/probe.mjs --report development --seeds 6 --weeks 104`
against the same command with `--set matchPopularityChase=0`, and again with
`--set matchPopularityChase=0 --restock=0`.

## Rival development and neglect decay — measured 2026-08-18

Before this, a rival's roster was static apart from ageing — confirmed in
the code, not assumed: `career/assignment.ts`'s weekly gym/ring/appearances
pass only ever ran over `world.promotion.rosterIds`, so nobody signed to a
rival ever moved a physical stat, full stop, for as long as the game has
existed. `--report development` now tracks the average of
strength/agility/stamina across every rival roster combined, start vs end:

| | Value |
|---|---|
| Rival physical average, week 1 -> 104 (3 seeds) | 56.4 -> 59.0 |

That is the whole population, including established veterans already at or
past their `potentials` ceiling (headroom 0, no room left to gain) — the
same people who would show zero movement under the player-side system too.
Gradual by design, same magnitude as the player's own gym (`assignmentGymGain
2.4/week` at full rate and headroom, tapered by age exactly like the
player's).

The other half — a stat that isn't being maintained should drift down, not
just stop drifting up — landed at `assignmentNeglectLoss 1.2`, ramping 0 at
`assignmentAgePeak` (22) to full at the new `assignmentAgeDeclineMax` (45),
floored at `physicalStatFloor` (20) so nobody gets erased. It only fires on
`appearances` (a deliberate trade: popularity and cash for a week not spent
training) and on `rest` the wrestler didn't actually need (healthy, unhurt,
but parked at home anyway) — never on a genuine injury/exhaustion rest,
which would be punishing the same hurt twice. Under plain `autoAssignment`
(no booker pins, which is what the probe plays) "Sent home for the week" is
50.6% of all assignments but is *entirely* the needed kind — the office
never sends a healthy person home on its own — so in an unmodified save the
decay term only ever fires on the 5.7% out on appearances. It shows up as
real per-person cost (see `career/assignment.test.ts`'s "neglect" suite for
the unit-level numbers) without dragging the population average down,
because gym time (34.1% of assignments) outweighs it by roughly 6:1.

Reproduce: `node tools/probe.mjs --report development --seeds 3 --weeks 104`
(rival physical average); `node tools/probe.mjs --report assignments --seeds
3 --weeks 104` (the 50.6/34.1/9.7/5.7 split above).

## Company health, well-run save

| | Value |
|---|---|
| Company rating at week 104-160 | 75-93 |
| Bank | $2.4M-2.9M |
| Rivals folded per 140 weeks | ~1.7 of 6 |

A *passive* booker — never signing anybody — declines to nothing and this is
correct behaviour, not a bug. Any measurement of long-run health has to restock
or it is measuring a company that refuses to hire.
