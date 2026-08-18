# What is still open

Kept here rather than in a chat message so a cold session picks it up in one
read. Roughly in the order it is worth doing.

---

## Infrastructure debt

**`resolveWeek` is still ~5,200 lines inline in `store.ts`.** The ~90
independent, player-triggered actions around it are split out now (see
"Done" below), which took `store.ts` from ~9,400 lines to ~6,100 — but
`resolveWeek` itself is one function, sharing a lot of local state computed
once and read many times later, and every value it touches is RNG-order-
sensitive (see the RNG note in the root `CLAUDE.md`). Decomposing it into
phases is a real, harder follow-up, deliberately not started here. Do not
start it without asking first — this is a different, riskier kind of cut
than the one already made.

**Twelve scenario tests pin a magic seed.** They pass, but they rely on a
specific generated person having specific properties. Sturdier to search the
generated roster for somebody who fits the scenario.

---

## Smaller, known, not urgent

- **`stintLine` / `recordLine` career history** is on the roster card now, but
  nothing shows a *rival's* roster history anywhere.

---

## Done and worth not re-litigating

- **Illegal tampering is gone — from both directions.** It was a trap button:
  the player's own `tamperWith` success capped at 18% regardless of the
  situation, getting caught ran 40-75%, and it escalated to losing
  television — and it wasn't even wired to a UI button, so nobody could ever
  actually press it. Rather than tune the odds (the option this replaced),
  removed the whole illegal half on both sides: a rival can no longer go
  after somebody still under contract to you, and you can no longer go after
  somebody else's. What's left — a rival approaching once a wrestler's own
  deal has run out — is legal, was always the more interesting half, and is
  unchanged. `world/tampering.ts` and `career/poaching.ts`'s split (a smaller
  item above) is resolved as a side effect: both merged into
  `engine/world/poaching.ts`. Also gone as a direct consequence: the
  `legalThreat` response (nothing left to threaten), `World.signingBanWeeks`
  / `suspensionWeeks` / `tamperingOffenses`, the dead `World.poachingOffers`
  field nothing ever wrote to, and the bidding war's `banned` plumbing that
  existed only to serve the signing ban. `World.tamperingOffers` is renamed
  `World.approachOffers` (schema 45). Verified with `tsc --noEmit`, the full
  suite, and a production build.

- **`store.ts` split into `storeHelpers.ts` plus eleven slice files.** The
  ~90 non-`resolveWeek` actions (card building, events, tag teams/identity,
  business deals, show/production, officials/schedule, roster/contracts,
  storylines, titles, the cup, the supershow) moved out to
  `state/slices/*.ts` using zustand's immer-middleware slice pattern; the 22
  functions shared between those actions and `resolveWeek` moved to
  `state/storeHelpers.ts`. `store.ts` dropped from ~9,400 lines to ~6,100.
  Pure refactor — no action's behavior changed, and the RNG draw order
  inside `resolveWeek` (still fully inline) is untouched. `rng` is now
  exported from `store.ts` as a live ES-module binding so slices that only
  ever *read* the stream can import it directly; the four actions that
  reseed it (`newGame`, `newGameFromPlan`, `continueGame`,
  `importSaveFile`) stay in `store.ts`, since nothing outside this file may
  reassign it. Verified with `tsc --noEmit`, the full suite (2645/2645),
  and a production build.

- **Every promotion runs its own gym now, and a stat left untrained can fall
  as well as rise.** Rival rosters were static apart from ageing — the
  weekly gym/ring/appearances/rest pass in `career/assignment.ts` only ever
  ran over the player's own roster, gated by `world.promotion.rosterIds.
  includes(person.id)` in `state/store.ts`. That gate is now a lookup
  across every promotion (`promotionsById`, built from `world.promotion`
  plus `world.rivals`), so a rival's unbooked majority develops exactly
  like the player's, appearances income lands in the right promotion's own
  bank, and the news wire still only ever reports on the player's business
  (nothing changed there). Measured: rival physical average (strength +
  agility + stamina, every rival roster) rose 56.4 -> 59.0 over two seasons
  — see docs/BALANCE.md.
  The other half of "gradual increases or decreases": a physical stat not
  being maintained now drifts toward a floor instead of just standing
  still. New `declineRate` (career/assignment.ts) mirrors `learningRate`
  but isn't the same curve reversed — growth stopping at 38
  (`assignmentAgeNoGain`) and decline starting are deliberately not the
  same event, so it ramps its own curve from `assignmentAgePeak` (22) to a
  new `assignmentAgeDeclineMax` (45). It only fires on `appearances` (a
  real trade: cash and popularity for a week not spent training) and on
  `rest` nobody actually needed (healthy, unhurt, parked at home anyway) —
  never on a genuine injury or exhaustion rest, which would double-punish
  the same hurt. Floored at a new `physicalStatFloor` (20) so nobody gets
  erased. `autoAssignment` never sends a healthy person home on its own, so
  in an unmodified save this only ever bites the ~6% of weeks spent on
  appearances — a real, felt cost for parking a talent on a publicity tour
  instead of training them, without dragging the whole population down,
  since gym time still outweighs it by roughly 6:1.
- **The championship builder is now count → name → per-belt holders/colours,
  matching the new-game promotions flow instead of an eight-field form per
  belt.** `TitleBuilder` dropped its tier/division/weight-class/stipulation
  pickers and the preset-library picker; those defaulted to 'open'/'open'/
  none rather than asked for. Tier is still real underneath — it drives
  defence windows and team-held display — but the player is only ever asked
  for holders (1-5), which now decides tier for the two group sizes anything
  else in the game special-cases (2 → 'tag', 3 → 'trios'); everything else
  keeps whatever tier it already had, so a house style's varied suggested
  lineup (world/secondary/television/hardcore) is never clobbered by this
  component. "How many titles" is a caller-side concern, not the
  component's — `NewGameScreen` resizes the array from its own count
  dropdown, `PromotionScreen`'s existing one-at-a-time "introduce a title"
  flow is unaffected. Colours moved from a 12-swatch `<select>` to an
  overlay with a live strap/plate preview, the same swatches as quick
  presets, plus free-choice colour pickers for anything else.
  Found and fixed a real pre-existing bug along the way while wiring up
  holders 1-5: `crownOpeningChampions` hardcoded the opening-champion count
  to 2 for tier 'tag' and 1 for literally everything else — including
  'trios' — so a Six-Man Tag preset had only ever opened with a single
  champion, not three. It now reads `title.holdersRequired`, which
  `createStartingTitles` always fills in regardless of tier, so a trios or
  any custom multi-holder belt is crowned correctly. Verified in a real
  browser: resized to 3 belts, set one to 2 holders and one to 3, picked a
  swatch through the overlay, started the game, and confirmed via the save
  data that the tag belt crowned exactly 2, the trios belt crowned exactly
  3, and the custom colour landed on the right title.
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
