# What is still open

Kept here rather than in a chat message so a cold session picks it up in one
read. Roughly in the order it is worth doing.

---

## On hold

**Tampering is a trap button.** Success capped at 18% regardless of the
situation; getting caught runs 40-75% depending on the target's fame, and
escalates on repeat offences to losing television. The code comment says
it's *meant* to be a last resort, so this may be intended — but a button
that is never the correct play is dead content rather than a hard choice.
Three directions on the table: leave it as a deliberate trap, make the odds
a real option generally, or keep it bad for stars but let it cross into
"actually correct" in narrow situations (unhappy prospect, weak rival
roster, big offer). Explicitly paused — no call made, do not pick a
direction without asking first.

---

## Infrastructure debt

**`src/state/store.ts` is ~9,000 lines** and `resolveWeek` is most of it. Every
session pays to navigate it. Splitting by concern is invisible to the player and
permanently cheapens all future work. No visible payoff, real compounding
value.

**Twelve scenario tests pin a magic seed.** They pass, but they rely on a
specific generated person having specific properties. Sturdier to search the
generated roster for somebody who fits the scenario.

---

## Smaller, known, not urgent

- **`stintLine` / `recordLine` career history** is on the roster card now, but
  nothing shows a *rival's* roster history anywhere.
- **Rival promotions never develop their people.** The assignment system is the
  player's only; a rival's roster stats are static apart from ageing. Deliberate
  for now — developing somebody else's roster for them is work the player should
  not be doing for free — but it means rivals slowly fall behind a player who
  uses the gym.
- **The two-module tampering split** (`world/tampering.ts` generates,
  `career/poaching.ts` resolves) was never merged and is confusing to navigate.

---

## Done and worth not re-litigating

- **New-game is now three steps, and imports go through the same three
  steps rather than a separate flow.** How many promotions (1-7, dropdown so
  nobody can type past it) → name each one, Generate or Import per slot,
  with a single roster file split across every Import slot → which one you
  play as. `state/world.ts`'s `createInitialWorld` takes an optional
  `NewGamePlan`; when absent, the original single-promotion path runs
  completely untouched — same code, same RNG draw order, verified against
  all ~2600 existing tests rather than assumed (an earlier version of the
  branch reordered a few RNG-consuming steps and broke two seeded
  `store.test.ts` cases before the fix; `buildSupportPool` now runs at the
  exact point in the stream the procedural path always ran it, in both
  paths). `buildPlannedPromotion` builds a promotion — player or rival,
  generated or imported, identically — with a uniformly-rolled house style
  when a slot didn't name one and an identical starting bank balance for
  everyone (a deliberate call, not the old rival formula of
  `rating*4000`). One file format serves both: entries tagged with a
  `company` field build one promotion per distinct company, kept intact and
  matched to a slot by name; a fully untagged file (or the untagged
  leftovers in an otherwise-tagged one) is one flat pool, split evenly by
  gender across whichever Import slots didn't get a name match
  (`roster-io.ts`'s `groupByCompany`/`splitEvenlyByGender`,
  `state/newGamePlan.ts`'s `resolveNewGamePlan`). A company nobody's slot
  name matched is left unimported rather than silently folded into a
  differently-named promotion. Verified in a real browser: pasted a
  two-company-shaped file with only one company tagged, split across 3
  slots, confirmed via `localStorage` that the tagged wrestlers landed
  exactly on the matching promotion (not the player's, not mixed in), and
  every promotion opened with the same starting bank balance.
- **Undercard popularity no longer erodes the whole roster over a career.**
  Measured (`--report development`, `docs/BALANCE.md`): a roster kept fully
  stocked and booked every week, nobody idle on purpose, still lost 7 points
  of mean popularity over two seasons. Not composition — isolated with
  `--set matchPopularityChase=0` (drift nearly stopped) and `--restock=0`
  on top of that (popularity actually *climbed*, from win bonuses alone).
  `popularityChase` (`sim/aftermath.ts`) pulls a wrestler's popularity
  toward the rating of the matches they're in with no damping either
  direction, and a fixed six-slot card serving a much bigger roster means
  most people spend most weeks chasing a ~25-rated opener down. Fixed the
  same way `ratingLadderFallMultiplier` already treats the company's own
  rating: falling slower than climbing, not stopped, via the new
  `matchPopularityChaseFallShare` (0.4). Measured result lands at 46.1,
  close to the 46.7 composition-only floor — most of the individual decay
  is gone, real (damped) downward pressure on a chronic undercard act
  remains.
- **Two optional dark match slots on the card.** Player asked for this
  directly. `World.currentDarkMatches` sits alongside `currentCard` and
  `currentPromos` (same "does not consume a card spot" principle as the promo
  slots), resolved by a new pure engine function
  (`engine/sim/darkMatch.ts::resolveDarkMatch`) rather than folded into the
  ~1,100-line televised-card loop: real sim, real winner, real development
  (`computeAftermath`, popularity scaled to `darkMatchPopularityShare` since
  nobody outside the building saw it), real injury risk — but deliberately no
  stipulation, titles, managers, or referee, and never folded into
  `computeShowRating`'s slot weights, so it cannot move the TV rating however
  good it was. Fans in `ratedSegments` can pick a dark match as best/worst of
  the night the same as anything broadcast. A dark match adds a flat
  attendance-scaled merch bump (`darkMatchMerchPerHead`). Schema bumped to 44
  (`World.currentDarkMatches` is dereferenced without a guard). Verified in a
  real browser, not just tests: booked one, ran the show, confirmed the
  card's `showRating` was unaffected, the news feed printed "Dark match,
  never aired: ... beat ...", and the wrestlers' records moved.
- **A good undercard match can now actually rate as good.**
  `computeMatchRating`'s popularity term outweighed its workrate term nearly
  2:1 (weight 42 vs 24), so an opener was capped low by fame alone — a
  technically flawless match with unknown talent could not out-rate a
  mediocre main event. `matchRatingPopularityWeight`/`matchRatingWorkrateWeight`
  (24/42, roughly swapped) fixed that: measured A/B on 6 seeds x 104 weeks
  (`docs/BALANCE.md`), main event and overall show rating barely moved
  (49.2->50.6, 46.7->45.9) while a skilled-but-unpopular match's odds of a
  real 55+ rating nearly quadrupled (0.5%->1.9%). Caught and fixed a real bug
  in `tools/probe.mjs` along the way: `--set` passed twice as separate tokens
  silently collapsed onto the first override via a stale `argv.indexOf`.
- **Set-point pairings no longer bottom somebody out at literal zero.** Three
  people sat at 0 morale in a measured save — long-idle, so mostly correct
  behaviour, but 0 is the exact edge of the whole scale and reads as broken
  rather than "as bad as it gets." Every `.morale` write in `state/store.ts`
  (21 sites) now goes through `career/morale.ts`'s `clampMorale`, which holds
  the floor at `moraleFloor` (10, comfortably inside "miserable") instead of
  0. Measured A/B on the same seeds (`docs/BALANCE.md`): the same ~4.7% of
  the roster still bottoms out under sustained neglect — that part is
  intentional, booking-driven consequence — but nobody sits at a literal,
  scale-breaking zero, and the disgruntled band (restless+unhappy+miserable)
  widened from 52% to 59% as a side effect, with no term magnitude or weekly
  cap touched. `tools/probe.mjs`'s morale report now prints a band histogram
  and a "% at the floor" line so this stays measurable going forward.
- **Traits now reach the rest of the game.** Contract demands and walk risk
  (`career/ego.ts`), poaching temptation (`world/tampering.ts`, via a new
  `Suitor` so `somebodyAtHome` knows whether the approaching promotion is
  where the partner works), retirement pressure (`career/retirement.ts`), and
  release requests (`economy/termination.ts`, via a new `WantsOutContext` for
  `inItForTheMoney`'s pay-gap check and `somebodyAtHome`'s apart-from-partner
  check) all reweight off the same `leverWeight`/`hasTrait` accessors morale
  already used, plus three new narrow accessors (`walkRiskWeight`,
  `temptationWeight`, `releaseThresholdShift`) where nothing existing fit.
  Fixing this exposed the RNG-shared-stream trap directly: changing which
  wrestlers `wantsOut` returns true for shifted which weeks drew a
  `chance()` roll for a release request, which shifted every seeded draw
  after it — including, three modules away, a bidding-war test. Fixed by
  seeding that roll from the wrestler and week instead of the shared stream,
  matching the pattern already used for `defect`.
- §16 supershows are complete, including per-match approval of the joint card.
  `titleCanTravel` was cut deliberately: only one belt in the game sets
  `lineageProtected`, so wiring it up would have let every other title change
  hands on a joint show. The rule is enforced by giving the card no titles.
- `noJobbing` / `titlePush` were removed rather than implemented, and the reason
  is written down in `types.ts` above the `Clause` union.
- The pronoun guard (`career/pronouns.test.ts`) now walks `engine/`, `data/`,
  `state/` and `ui/`. Every widening of it has found more; do not narrow it.
