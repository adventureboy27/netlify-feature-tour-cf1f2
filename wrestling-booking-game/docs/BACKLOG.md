# What is still open

Kept here rather than in a chat message so a cold session picks it up in one
read. Roughly in the order it is worth doing.

---

## Three more major stories: network realignment, owner rivalry, rogue turn — shipped

Fourth slice of "build it all," and the first half of the six brainstormed major stories. Split deliberately:
these three are rival-side-only (no player decision, the same way `starIsBorn`/`torchPassed` incidents are)
and share almost no new machinery beyond the registry itself, so they shipped together; the other three
(scandal collapse, breakaway promotion, legend's farewell tour) each need real new machinery of their own —
a shared roster-shedding sub-story, a brand-new promotion actually getting founded mid-save, and a real player
decision — and are tracked as a follow-up slice rather than rushed into this one.

All three are new `data/worldStories.ts` registry entries, same shape as merger/succession: `networkRealignment`
(a rival's TV arrangement shifts, rating swing either direction, no guaranteed win), `ownerRivalry` (two
*different* existing rivals go after each other publicly — the only one of the three with no world.mergerHappened-
style singleton state; the loser and winner swap every time it fires), and `rogueTurn` (a rival drops
regulation and goes outlaw for good — a permanent `styleProfile.violenceTolerance` shift plus a real either-
direction rating swing, once per rival).

`rogueTurn`'s "once per rival" need was the reason `World` gained something new rather than another dedicated
array: `worldStoryHappenedFor: Record<string, Id[]>`, a generic per-story tracker the same shape as
`successionHappenedFor` but keyed by story id, so a fourth, fifth, sixth per-rival-gated story (scandal
collapse and breakaway promotion, next slice, both need exactly this) never needs its own bespoke field again.
`succession`/`merger` were left on their own existing dedicated fields rather than migrated onto the new
generic one — no reason to touch two already-shipped, already-tested stories for a refactor that costs real
regression risk and buys nothing new.

Verified: `tsc --noEmit` clean, full `vitest run` (new coverage in `networkRealignment.test.ts`,
`ownerRivalry.test.ts`, `rogueTurn.test.ts` for the pure roll/apply logic, `worldStoriesD.store.test.ts` for
the real weekly-dispatch round trip on all three), `npm run build` clean, and a 3-seed/160-week probe run with
all three saves surviving and no regressions to the existing injury/morale/show/money baselines.

---

## The rest of the "Rival Booker Battle" sub-stories pool — shipped

Third slice of "build it all." Ten of the twelve brainstormed sub-stories landed here; the other two were
scope decisions, made and disclosed rather than silently skipped:

- **Title stripping** was left alone — the champion-injury vacate path (`titleDefence.ts`, `OfficeScreen`'s
  `ChampionCallPanel`) already covers a title coming off somebody for a real, booker-driven reason, and
  building a second, parallel path for the same outcome would have been pure duplication.
- **Billionaire below-cost pricing turmoil** is deliberately not here — it needs real multi-week temporary
  state (a lifespan, not a one-shot effect) and ties directly into the pricing dashboard, so it is paired with
  that build instead of forced into this slice.

**Nine landed as ordinary creative events** (`data/events.ts`, same reuse as the last slice — zero new
plumbing): `personalConfrontation`, `charityPRMove`, `whisperCampaign`, `insiderDefector`,
`thirdCompanyRace`, `territoryTargetingBias` (gated on actually owning a territory), `blackballing`,
`staffPoaching`, and `spiteFreeAgentSigning` — the free-agent-pool sub-story the player asked for by name
early in the brainstorm. Two of these (`blackballing`, `staffPoaching`) hit the same real limitation
`uninvitedLegend` hit last slice: the event scheduler's subject resolution only ever pulls a `primary`/
`secondary` from the *active roster*, and there is no `EventEffect` that touches a manager or referee at all
(only `wrestlerId`-keyed effects exist). `blackballing` was kept pointed at a real roster wrestler rather than
somebody who already left; `staffPoaching` was kept deliberately unnamed — a real business consequence
(money, reputation) without pretending to move a specific manager's contract the engine has no vocabulary
for.

**The tenth, `contractRaid` (`engine/world/contractRaid.ts`, new), needed its own small module** — the one
explicitly detailed brainstormed item: "one of the rivals finds problems in 5 of your wrestler contracts and
signs them away immediately." A creative event could not express this: `EventOption.effects()` has no `rng`
parameter, so there was no way to pick which 5 wrestlers inside the standard pipeline. Reuses
`ownershipShakeup.ts`'s `pickShakeupReleases` wholesale for "how many, who" — the exact reusable sub-story
function the player asked for when this system was first designed. The raid itself is not a decision (the
wrestlers are already gone, released to free agency, by the time the promoter hears about it — the same scope
simplification as the truck-breaks-down event: a rival directly re-signing them was more machinery than this
was worth); what *is* a decision is the aftermath, presented the same non-blocking, expiring way as the
existing champion-injury call (`pendingChampionCall`'s own precedent): overhaul every contract in the
building (real money, real reassurance), retaliate (spends reputation, buys a real, mechanical grudge against
the raiding rival via the existing `engine/world/grudges.ts` ledger — the same ledger invasions already read),
or do nothing (free today, costs roster morale, and decides itself the same way if the grace period runs out
unanswered).

Adding nine more entries to the shared weekly creative-event pool shifted which event fires, in which week,
for any long fixed-seed playthrough — expected, since it changes what a given random draw resolves to without
changing the draw count (not the entity-seeding trap in CLAUDE.md, a different, milder version of the same
family). It broke one existing store.test.ts assertion: a school-leaver graduate landed at exactly 38
popularity, which is not noise — 38 is `settings.biddingPhenomPopularity` verbatim, a real, designed exception
(`academy.ts`'s `asPhenom`) the test's own title already implied it meant to exclude ("leaves the *ordinary*
school leavers unknown") but never actually filtered out, only filtering lineage kids. Re-expressed rather
than re-baselined: the test now also zeroes `biddingPhenomChancePerClass`, the same way it already zeroes
`secondGenChancePerGraduate` — ruling the one deliberately-famous exception out on purpose instead of leaving
it to chance whether a given seed rolls one. Confirmed via `academy.test.ts`'s own dedicated, RNG-cascade-free
unit test that the actual invariant (ordinary graduates come out scaled down and unknown) was never in
question.

Verified: `tsc --noEmit` clean, full `vitest run` (163 files, 3044 tests, 0 failures — new coverage in
`contractRaid.test.ts` for the pure roll/resolve logic and `contractRaid.store.test.ts` for the real
raise/answer/expiry round trip, plus the nine new events already covered automatically by `events.test.ts`'s
library-wide checks), `npm run build` clean, and a 3-seed/160-week probe run with all three saves surviving
and no regressions to the existing
injury/morale/show/money baselines.

---

## The rest of the standalone random events pool — shipped

Second slice of "build it all." Went through the brainstormed random-events pool item by item rather than
building blind: `familyEmergency` (misfortunes.ts) and the shoot/post-match-beatdown pair (`itWentReal`/
`postMatchBeatdown` in incidents.ts) turned out to already exist, so those were left alone. What was
genuinely missing, and where each landed:

**Five new creative events** (`data/events.ts`, reusing the existing engine wholesale — no new plumbing):
`sponsorPullout` (a committed sponsor bails, three real options: eat it, chase a fast replacement gamble, or
burn the relationship publicly for a reputation/credibility trade), `liveRetirement` (a veteran or legend
wants to call it live, on the show — grant it or talk them out of it), `uninvitedLegend` (a name out of the
record books wants a spot on tonight's card — deliberately unnamed/generic rather than pulling a real Hall of
Famer, since the event scheduler's subject resolution only ever draws from the *active* roster; inventing a
second resolution path for a retired name was more machinery than this one event was worth), `protestNoShow`
(gated on real reputation trouble — a boycotted house, apologize publicly or dig in), and
`schedulingCollision` (a rival deliberately books your date — push through as a real gamble or pay to move
it). Every option was checked against the library's own house rule (`events.test.ts`'s "no option is free") —
a certain downside or a real chance of failure, never pure upside.

`liveRetirement`'s "give them the send-off" needed a capability the closed `EventEffect` vocabulary didn't
have: `{kind: 'retire', wrestlerId}` (new, routes straight through the existing, already-battle-tested
`career/retirement.ts` `retire()` + `leaveTheBusiness()` — no new retirement logic, just a new door into it).

**Two new incidents** (`data/incidents.ts`), for the ones that only make sense as a reaction to something the
sim already produced rather than a weekly card-draw: `viralBotch` and `luckyPyroAccident`. Read
`simulateMatch.ts` first — `MatchSimResult.botchedById` already existed and was already unused by any caller;
the pyro burn's worker id was sitting in a `'pyroBurn'`-kind beat's `actorId`, also unread. Both incidents are
layered *on top of* the mistake's own already-applied cost rather than undoing it — the botch or the burn
still cost what it always cost, but the internet occasionally decides it's the story of the night anyway, and
that same viral moment also personally embarrasses whoever it happened to (a real morale hit alongside the
real popularity/rating gain) — upside and downside both genuine, matching the plan's own rule. `IncidentContext`
gained `botchedById`/`pyroBurnedById`, populated only at the player's own show's incident-roll call site (the
same "player-only" precedent already set by `incidentReduction`/`potentialInvaders`) — a rival's own show
summarizes match results without carrying beat-level detail that far, and reaching it would have meant
touching `rivalBooking.ts`'s summarization for a scope this small.

Verified: `tsc --noEmit` clean, full `vitest run` (161 files, 3002 tests, 0 failures — new coverage in
`incidents.test.ts` for the two viral incidents and `retireEffect.test.ts` for the new `EventEffect`, plus the
five new events already covered automatically by `events.test.ts`'s library-wide well-formedness and
no-free-option checks), `npm run build` clean, and a 3-seed/160-week probe run with all three saves surviving
and no regressions to the existing injury/morale/show/money baselines.

---

## The truck breaks down: Arena Floor, a new unlockable stipulation — shipped

First slice of "build it all" on the rest of the brainstormed pool. Asked specifically for this one: the
equipment truck breaks down, and the promoter has to decide between calling the show off or holding it on
the bare arena floor — real elevated injury risk, a rating swing that can go either way, still real ticket
sales, and it permanently unlocks Arena Floor as a bookable match type going forward.

Read `engine/world/ringCall.ts` first, since the ring-giving-out event shipped in the previous slice already
covers almost the identical scenario mechanically (a worn ring failing mid-life, with a "go nuclear" outcome
whose own narration already says "bare cement... show went on anyway"). Rather than build a second, near-
duplicate pending-decision system, the new `engine/world/truckBreakdown.ts` deliberately mirrors the same
shape — a warning, a two-way choice, honest either-direction consequences — while staying its own small
module: the trigger is genuinely unrelated (a truck breaking down two states back is bad luck, not
accumulated ring wear), so it gets its own rare weekly roll (`truckBreakdownChancePerWeek`) independent of
ring condition, and its own settings block, rather than forcing one cause into a system built around the
other. `ringCall.ts` itself was not touched, so nothing here risks the already-shipped, already-tested
ring-call path.

The unlock itself needed a real place to live: `Stipulation` gained a `locked` flag, and `World` gained
`unlockedStipulationIds: Id[]` — a small, generalized array rather than a single `arenaFloorUnlocked`
boolean, so any *future* earned stipulation can reuse the same field instead of getting its own bespoke one.
`arenaFloor` is the only entry in `STIPULATIONS` with `locked: true`; `MatchSetupScreen`'s stipulation picker
filters it out unless the id is present in `unlockedStipulationIds`. Confirmed rivals can't stumble into
booking it before it's earned — rival shows pick stipulations off their own identity's `signatureBelt`, never
by iterating `STIPULATIONS`, so there was no second gate to add.

Wired into `resolveWeek` as its own self-contained pre-show block, same shape and same scope-cut as the ring
call before it: checked before the ring call (so a week the truck never shows up never also asks whether the
perfectly fine ring was about to give out), and its consequences — refund-equivalent economics on "call it
off," an extra injury roll and a real rating swing on "hold it on the arena floor" — apply *after* the show
already resolved normally rather than genuinely gating whether it simulates. Same reasoning as documented for
the ring call: real mid-resolution control-flow surgery is exactly what this doc's own infrastructure-debt
note warns against.

Verified: `tsc --noEmit` clean, full `vitest run` (160 files, 2981 tests, 0 failures — new coverage in
`truckBreakdown.test.ts` for the pure raise/resolve logic and `truckBreakdown.store.test.ts` for the real
pending/answer round trip including the unlock), `npm run build` clean, and a 3-seed/160-week probe run with
all three saves surviving and no regressions to injury/morale/show/money baselines.

Five more slices of the same brainstormed backlog remain, tracked as their own entries once shipped: the rest
of the standalone random events (viral botch, live retirement, an uninvited legend, sponsor pullout, protest
no-show, a lucky pyro accident, scheduling collision — `familyEmergency` and the shoot/beatdown-style
"backstage brawl" idea turned out to already exist, as `misfortunes.ts`'s `familyEmergency` entry and
`incidents.ts`'s `itWentReal`/`postMatchBeatdown`, so those are not being rebuilt), the rest of the
brainstormed sub-stories, the rest of the major stories, the pricing dashboard with deliberately inconsistent
rival pricing, and a general unlockables system beyond this one stipulation.

---

## A world-story registry, succession, Breaking News, and skill-based in-ring danger — shipped

Asked for an open-ended brainstorm of more stories and random events beyond the merger — "need outside
influences" — with hard requirements laid down up front: every story or event needs real upside(s),
downside(s), and an explicit multiple-choice decision tree wherever a real choice exists; sub-stories should
be a shared, reusable pool rather than owned by one main story; and every major/sub story must be announced
as clearly-labeled Breaking News in the weekly feed, separated by category, and never conflated with tweets
("tweets are always a reaction gauge, not a story teller"). The brainstorm ran long and stayed brainstorm-only
for most of the conversation ("don't build yet" / "keep brainstorming until I say otherwise") before a
first, narrow slice was greenlit: a second major story (succession), the plumbing to hold more of these
without hand-rolling each one into `resolveWeek`, the Breaking News UI, and two of the standalone random
events (skill-linked injury risk, the ring giving out).

**The registry.** The merger was originally a bespoke block inside `resolveWeek`; adding a second major story
the same way would have meant two near-identical eligibility/roll blocks and no shared place for a third.
`data/worldStories.ts` (new) holds `WorldStoryDefinition {id, category, weight, chancePerWeek(settings),
eligible(ctx)}` — metadata only, no mutation logic, because a merger and a succession do genuinely different
things to the world and forcing them through one closed effect vocabulary would have been the wrong kind of
generalization. `engine/sim/worldStories.ts` rolls each eligible story against its own `chancePerWeek`
independently, breaking ties among simultaneous hits by `weight`. `resolveWeek` now does one dispatch off the
result instead of a bespoke merger check; `applyMerger` itself is untouched.

**Succession.** `engine/world/succession.ts` (new): once a rival is old enough (`successionEarliestWeek`:
104, two years — same era as invasions) and hasn't already been through it, a founder/booker dies or steps
back and the company passes to an heir. `rollHeirBranch` weights three outcomes — steady (45%, no change),
sharp (25%, real rating/reputation gain), weak (30%, real rating/reputation loss) — so the upside and
downside are both genuine and neither is guaranteed. A weak heir also triggers a shared sub-story: `engine/
world/ownershipShakeup.ts`'s `pickShakeupReleases` sheds 2-5 of that company's roster into the free agent
pool, panic cost-cutting from new ownership that doesn't know what it's doing. Built as a standalone,
reusable function rather than succession-only, so any future ownership-change trigger (the merger, or
something later) can call the same release logic instead of a bespoke copy.

**Breaking News.** `WireKind` gained `'ownership'`, `'contract'`, and `'talent'` alongside the merger's
existing `'business'`. `ShowResults.tsx` gained a `BreakingNews` component that pulls `weight === 'lead'`
items of those kinds into their own visually distinct, category-labeled section ahead of the regular wire;
`TheWire` excludes the same items so nothing doubles up. This is UI-and-classification only — no new data
pipeline, since `WireKind` and the lead/routine weight distinction already existed and just weren't being
surfaced as a dedicated section.

**Skill-based in-ring danger.** Answered a direct mechanics question — can a wrestler hurt another during a
match, tied to in-ring skill, worse when neither is any good — with `engine/sim/casualties.ts`'s new
`skillDangerMultiplier(personSkill, opponentSkills, settings)`: `1 + (1 - personSkill/100) * (1 -
avgOpponentSkill/100) * settings.skillInjuryWeight`. Deliberately multiplicative, not averaged: one
genuinely good worker with a green opponent keeps the product low (one near-zero term protects the whole
match), while two green workers compound real danger instead of diluting it — matching how it actually reads
ringside. Wired into the one real "wrestler hurts wrestler" competitor-vs-competitor `rollCasualty` call site
in `resolveWeek` (traced directly rather than assumed — the other three `rollCasualty`/`stoppageCasualty`
call sites are unrelated: stunt/environmental risk, not opponent skill).

**The ring gives out.** `engine/world/ringCall.ts` (new): when ring condition drops below
`ringCallConditionFloor`, a real warning can be raised before a show — worn ropes, a soft spot in the
canvas — and the promoter gets a genuine two-way choice, not a coin flip disguised as one: play it safe
(refund-equivalent economics, `worked` morale hit, merch sales down, show never runs) or go nuclear (the show
runs as booked, injury odds go up by `ringCallNuclearInjuryMultiplier`, and the rating swing can land either
direction — no guaranteed pop for the risk). **Scoped down from the original ask on purpose, and said so
plainly rather than silently cutting it**: a literal mid-match interruption would have meant restructuring
`resolveWeek`'s control flow, exactly what this doc's own "don't start without asking" note on infrastructure
debt warns against. So the call fires *before* the show, as its own self-contained pending-decision block —
same real consequences (refund vs. real injury/rating risk), reused verbatim from the weather-call
pending-decision pattern (`world.pendingRingCall`/`ringCallChoice`, a new `answerRingCall` action, a
`DialogueCard` built off `RING_CALL_OPTIONS`) — rather than a true in-match interrupt. No store-level
integration test exercises the full pending/answer round trip end to end; `ringCall.test.ts` covers the pure
raise/resolve logic directly instead.

Not built in this slice, left for later prioritization: the rest of the brainstormed major-story pool
(scandal collapse, network realignment, breakaway promotion, owner rivalry, rogue promotion, a legend's
farewell tour), most of the brainstormed sub-stories (blackballing, personal confrontations, title stripping,
territory-targeting bias, insider defectors, a third-company race, whisper campaigns, charity-PR moves, staff
poaching, the contract-loophole raid, the billionaire's below-cost pricing turmoil sub-story, and the 4x-value
spite free-agent signing), most of the standalone random events (backstage brawl, viral botch, live
retirement, an uninvited legend, sponsor pullout, protest no-show, family emergency, a lucky pyro accident,
scheduling collision, and the truck-breaks-down/Arena Floor stipulation event), the pricing dashboard with
deliberately-inconsistent rival pricing, and a general unlockables system. All of it stayed design discussion
only, per the standing "don't build yet" instruction that governed the brainstorm until this narrower slice
was explicitly greenlit.

Verified: `tsc --noEmit` clean, full `vitest run` (158 files, 2970 tests, 0 failures — new coverage in
`succession.test.ts`, `ownershipShakeup.test.ts`, `ringCall.test.ts`, `worldStories.test.ts`,
`succession.store.test.ts`, plus additions to `casualties.test.ts` and `wire.test.ts`), `npm run build`
clean, and a 3-seed/160-week probe run with all three saves surviving and plausible injury metrics.  Schema
bumped to 61 (`World.pendingRingCall`, `World.ringCallChoice`, `World.successionHappenedFor` are all new).

---

## The billionaire merger — a one-time, late-game escalation — shipped

Asked whether the game needed an endgame, and pitched a specific mechanic: a rich outside buyer eventually
acquires the two strongest surviving rivals, keeps them running as separate shows under one shared brand
split East and West, and makes them meaningfully harder for everybody left — not a formal win/lose state,
just real escalating pressure on a long save. Scoped down to exactly that: no new ending screen, no victory
check, and it never repeats once it has happened — a permanent shift in the shape of the business for the
rest of the save, not an ongoing threat to keep rebalancing.

`engine/world/merger.ts` (new) is the whole mechanic in pure functions: `eligibleForMerger` gates on
`WorldSettings.mergerEarliestWeek` (156 — three years, later than invasions' own 104-week gate) and needing
at least `mergerMinLivingRivals` (3) living rivals — two to buy, one left over besides the player, so the
business is never reduced to a two-company death match by the event itself. `pickMergerTargets` always takes
the two highest-rated survivors (a buyer with this kind of money is not interested in a struggling regional
outfit); `nameMerger` draws a brand and a buyer's name from small invented pools (`Vantage`, `Colossus`,
`Dominion`...); `applyMerger` renames both `<Brand> East`/`<Brand> West`, gives both a real rating and
bankroll boost, and stamps a shared `Promotion.conglomerateId` (new, optional — absent for everyone else,
including the player, who can never be bought).

Wired into `resolveWeek` as a one-time weekly roll, entity-seeded off `rngFromSeed('merger:${week}')` per the
CLAUDE.md RNG-order trap — inserted into weekly resolution, so it must never touch the shared stream — rare
on purpose (`mergerChancePerWeek: 0.015`, so it reads as a genuine surprise even once eligible) and guarded
by `World.mergerHappened` so it can only ever fire once. Announced in full on the wire the week it happens
(a new `'business'` `WireKind` — nothing this size happens off-screen).

The "colder to everyone else" half reuses the existing joint-supershow negotiation wholesale: `coopAppetite`
already reads a `resentment` term computed at its one call site, so a hostile-outsider check
(`isHostileOutsider` — anyone who isn't their own sibling) just adds `mergerCrossPromotionResistance` (40)
onto that same term. No new negotiation system needed. Deliberately *not* built: an actual simulated joint
show between the two halves (there is no rival-vs-rival supershow system in this game at all, and inventing
one was out of scope), and any AI-vs-AI poaching (doesn't exist either) — the difficulty increase for the
rest of the business comes honestly from the rating/bankroll boost alone, which already scales poaching
aggression, bidding-war strength, and territory draw everywhere those numbers are read. Flagged plainly
rather than implied, since it would have been easy to oversell this as more mechanized than it is.

Verified: `tsc --noEmit` clean, full `vitest run` (2936 tests, 0 failures — 11 new in `merger.test.ts` for
the pure functions, 3 new in `merger.store.test.ts` confirming the weekly roll is correctly gated, applies
once, and never repeats), `npm run build` clean, and a 3-seed/200-week probe run (past the merger's own week
gate) with no regressions to the existing injury/morale/show/money baselines and all three saves surviving.
Schema bumped to 60 (`Promotion.conglomerateId`, `World.mergerHappened`, `WireKind.business` are all new
required/closed-set surface).

A world-map/international-expansion system was discussed in the same conversation and deliberately parked as
a future expansion, not built here — see the session's own design notes if it comes back up.

---

## Secret signings now feed the same grudge invasions read — shipped

A gap flagged and deliberately left open while building invasions: `Grudge` (`engine/world/grudges.ts`) was
only ever created by a lopsided joint supershow night, so a rival who had just had their top guy stolen out
from under them via a secret signing carried zero mechanical resentment — a real betrayal with no memory
behind it, and one fewer path into the invasion incident that now reads that ledger.

`rememberNight`'s merge-and-clamp logic is specific to a joint night's own stats (`playerWins`/`partnerWins`/
`showStars`), so rather than force poaching through that shape, `grudges.ts` gained a smaller sibling,
`addGrudge(existing, promotionId, amount, reason, week)` — same merge/clamp/drop-at-zero rule, but driven by
a plain magnitude and reason instead of a derived night. `rosterAndContracts.ts`'s `revealSecretSigning` —
the moment a secretly-signed wrestler actually walks out on television and the rest of the business finds
out — now calls it right alongside the rating hit it already applied to the victimized rival, scaled by the
same `revealImpact` the existing effects already use (a fresh, high-stature, unblown reveal lands roughly
20-30 resentment via the new `grudgeSecretSigningPerImpact` setting; a stale or already-blown one barely
registers, matching how little of a surprise it was left by the time it happened).

Deliberately one-directional: a rival poaching *from* the player (`answerApproach`'s `doNothing` resolution)
does not get a symmetric grudge, because `Grudge` only ever represents how a rival feels about the player —
there is no ledger for the reverse, and inventing one was out of scope for this pass.

Verified: `tsc --noEmit` clean, full `vitest run` (2922 tests, 0 failures — 4 new in `grudges.test.ts` for
`addGrudge`'s merge/clamp/drop behavior, 1 new in `store.test.ts` confirming a real secret-signing reveal
leaves the victimized rival with resentment on the books), `npm run build` clean.

---

## Invasion angles — a rival with a real grudge sends somebody through the curtain — shipped

The second of "1 and 3" — custom creation and logo/photo work landed first; this is invasions, the
cross-promotion angle. Asked explicitly to "save some surprises for down the road... a few years into it,"
so this is deliberately not available in a fresh save: `WorldSettings.invasionEarliestWeek` (104 — two years,
at 52 weeks/year) gates it well behind `supershowEarliestWeek`'s 20, and it further requires
`invasionGrudgeThreshold` worth of real resentment already on a rival's ledger. A save has to be old, and a
rival has to have a real reason, before this can ever fire — the whole point of the request.

Read `engine/sim/incidents.ts`'s header first: an incident never decides who won, and nothing fires without a
real reason already in the world. `runIn` was the near-exact structural precedent — a wrestler off the card
with unfinished business crashes the main event — so invasions reuse the same shape, sourced cross-promotion
instead of same-roster. The one existing promotion-vs-promotion "feeling" in the game is
`engine/world/grudges.ts`'s `Grudge` ledger, fed today only by lopsided joint supershow nights — so a rival
who was buried on a supershow is exactly the company that would now send someone to get some of it back.

New `couldInvade(world, hostPromotionId, booked, againstIds)` (`state/storeHelpers.ts`, mirroring the
existing `couldTurnUp`) walks every rival with resentment past the threshold and offers up their fit roster
members. It's deliberately one-sided: grudges only ever record how a rival feels about the *player* (there's
no ledger for how rivals feel about each other), so it returns nothing at all unless `hostPromotionId` is the
player's own promotion — a rival's own show never gets an invader, rather than guessing. `IncidentContext`
gained a `potentialInvaders` field carrying each candidate's wrestler and home promotion; the new
`rivalInvasion` incident (`data/incidents.ts`) fires only in a main event or title match with a winner to
target, exactly `runIn`'s own gate, and names the invader's promotion right in the headline.

The "getting their moment lets some steam off" half needed a new closed vocabulary entry rather than a direct
world mutation — `EventEffect` gained `grudgeRelief` (a promotion id and a magnitude), with its case in
`applyEffect` draining resentment off that rival's `Grudge` and dropping the entry entirely once it reaches
zero, the same as it already does when it decays away naturally. `rivalInvasion` spends `invasionCatharsis`
of it on every fire, so a rival doesn't just get one invasion and then another immediately after — the grudge
that earned it is real, and using it costs something.

Verified: `tsc --noEmit` clean, full `vitest run` (2917 tests, 0 failures — 22 in `incidents.test.ts`
including new eligibility and build coverage for `rivalInvasion`, 8 new in `invasion.test.ts` for
`couldInvade`'s gates and the `grudgeRelief` effect), `npm run build` clean, and a 3-seed/160-week probe run
confirming the new incident sits safely in the weekly resolution loop for a save well past
`invasionEarliestWeek` with no regressions to the existing injury/morale/show/money baselines. Natural
observation of a fired invasion in a played save needs a completed, lopsided supershow first (itself a rare,
multi-year event) — the gating logic and the incident's own `when`/`build` are covered directly instead,
against a real `World` built through the store rather than a hand-rolled fixture.

---

## Custom promotion creation, a generated logo, and batch photo import — shipped

Asked "what else, let's be the best," the design doc's own §23 named custom promotion creation as a
post-v1 candidate — checking what NewGameScreen already did turned up far more than expected: a real name,
generate-or-import per company, house style, and a full custom-championship builder already existed. The
actual gap was narrower and already anticipated in the type system: `WorldPresetName` has carried a `'custom'`
member since the five-preset system was built, with no UI ever reaching it — the five presets' own starting
cash/roster/rating/following are fixed bundles, and there was no way to set those numbers directly.

`data/worldPresets.ts` gained `CUSTOM_PRESET_BOUNDS` — four sliders (cash, roster size, national credibility,
home following), each clamped to the exact span the five hand-tuned presets already validated individually
(Backyard's floor to Big money's ceiling, per field) so Custom can only ever recombine numbers this game has
already balance-tested, never exceed them. A generated (never hand-written) `customSqueezeLine()` reads the
combination back in the same voice as the five presets' own `theSqueeze` — qualitative, words not numbers,
reacting to both money-per-head and how known the promotion already is. `engine/world/settings.ts` gained the
matching `worldSettingsFromCustom()`, and `NewGameScreen.tsx` a sixth tile alongside the five fixed presets,
sliders appearing inline when it's selected. Locked with 23 new tests in `worldPresets.test.ts`, including one
that asserts every bound stays inside the five presets' own measured span — if a future preset retune ever
widens or narrows that span, this test catches Custom drifting outside proven territory.

Separately, asked for "generic logos with initials" the player can still name and choose: rather than a
second, disconnected color system, `PromotionMark` (new) reuses the *existing* seven-way house-style palette
(`chrome.tsx`'s `promotionTheme`, already driving every button and header wash in the game) and pairs each
archetype with its own badge shape — a circle for Territory, a five-point star for Sports entertainment, a
jagged burst for Hardcore, a hexagon for Technical, a rotated diamond for Lucha, a heraldic shield for Old
school, a plain rounded square for Athletic — via inline `clipPath`, no art asset. It's the exact same
"generate from the name, no upload" idea `PaperDoll` already uses for a wrestler with no photo. Needs zero new
state: fully derived from a promotion's existing `name` and `identity`, so "choosing" the logo *is* picking
the house style the player was already going to pick — updates live in `NewGameScreen`'s creation flow, and
placed persistently in `App.tsx`'s header, `PromotionScreen`'s "Who you are" panel, and the rival-company
picker on `RivalRosterScreen`.

Third: "make sure importing photos is easy... whether it's batch or individually... make sure it knows male
vs female... utilities in the menu that are run and foolproof." The individual case and the JSON whole-roster
import (which already carries `gender` and `photoDataUrl` per entry) both already existed; the real gap was
attaching real image *files* — a folder of actual photos — to a roster already in play, which had no path at
all. New `BatchPhotoImport.tsx`, reachable from Settings next to the existing save/roster file tools: pick any
number of image files at once, each gets matched against the roster by filename (`suggestMatch` — normalizes
both sides and pre-selects only on an *exact, unambiguous* single match, never guessing between candidates),
reuses the existing `resizeToDataUrl` pipeline unchanged, and shows every row's target wrestler with their
name and gender spelled out before anything is written — nothing is saved until Apply, and a duplicate pick
within one batch is flagged rather than silently overwritten. The store gained a new, deliberately minimal
`setWrestlerPhoto` action rather than routing through the existing `repackageWrestler` — that path always
resets `gimmickFreshness` to 100 on the theory that a new look is a new character, which a plain photo attach
must never trigger as a side effect (confirmed by a new store test asserting freshness is untouched).

Verified: `tsc --noEmit` clean, full `vitest run` (2906 tests, 0 failures — 23 new for the custom preset, 3
new for `setWrestlerPhoto`), `npm run build` clean, and two live Playwright walk-throughs: building a custom
promotion end to end (dragging every slider, confirming the squeeze line and the live logo both react, then
actually opening the doors and seeing the chosen numbers land in the real save), and a batch photo import
against a real roster (three files, two filename-matched correctly, one correctly left unmatched, applied and
confirmed on the roster screen afterward).

---

## Vignette packages — a paid gamble to hype a debut — shipped

Asked whether the game had a way to build anticipation for a new signing the way wrestling did it in the 80s
and 90s — Razor Ramon's toothpick-and-gold-chain vignettes, not a wire photo — the honest answer was a single
one-shot dialogue option buried inside an *existing* wrestler's gimmick-change event, not anything reachable
from a fresh signing. Scoped and built as its own thing per the player's own spec: a dedicated card-slot
presence, offered at signing time, three real weeks paid for up front, the wrestler unbookable the whole
time, and a genuine coin-flip-ish gamble at the end — a real popularity and momentum payoff if it catches, or
nothing at all for the money and the missed weeks if the crowd never bites.

`engine/career/vignette.ts` (new) is the whole mechanic: `newVignette`/`tickVignette` manage the three-week
countdown the same way `Leave` already does; `resolveVignette` rolls the payoff off an entity-seeded stream —
`rngFromSeed(\`vignette:${wrestlerId}:${startWeek}\`)`, never the shared stream, so adding this decision can't
shift a single existing seeded roll — weighted by the wrestler's own charisma via two new settings
(`vignetteSuccessChance`, `vignetteCharismaBonus`). A bust is deliberately worth exactly zero, not a
punishment on top of the sunk cost — the risk the player asked for is real, not padded.

The signing-time hook is the existing "meet the booker" `SigningTalk` flow, which already fires exactly once
per new signee regardless of how they arrived (free agent, folded-roster pickup, bidding-war win). It gained
a third stage, `chooseDebut`, between picking the gimmick and the tag-team pairing offer:
`chooseSigningDebut(wrestlerId, 'now' | 'vignette')` either fires the ordinary immediate "debuts tonight"
wire (moved out of `chooseSigningGimmick`, which used to fire it unconditionally) or spends
`vignetteCost` up front and sets `Wrestler.vignette` — a new optional field, no schema bump needed, same
safe-optional-field pattern as every other save-compatible addition here. Unaffordable is a silent no-op,
same convention as `signFreeAgent`'s own guard — the talk just stays open for a real choice.

A running vignette blocks booking exactly like `Leave` already does: `canWork()` in `rivalBooking.ts` (used
by every AI's own booking, including auto-fill) now refuses a wrestler mid-campaign, `theCatch()` in
`scouting.ts` says so on their card, and `BookingScreen.tsx`'s "rest of the week" panel reports it with a
countdown. The manual slot picker still lets the booker cast them anyway if they really want to — same
established convention as an injured or on-leave wrestler, since the game does not block the player's own
bad decisions, only the AI's.

The card-slot presence itself is `ui/components/VignettePanel.tsx` — a new, read-only section on the booking
screen mirroring `PromoSlots`/`DarkMatchSlots`'s exact layout convention, listing anyone currently mid-campaign
with a week-by-week flavor line ("Grainy footage, no name, no face" → "the crowd cannot stop talking about
it" → "one more week of this"). Nothing to cast here on purpose — the whole campaign was decided the day it
was bought.

The payoff resolves in `resolveWeek`, in the same post-increment bookkeeping pass as `Leave`'s own tick (right
after `world.week += 1`, so a wire stamped `world.week` there lands correctly rather than vanishing per
CLAUDE.md's own stamping trap): ticks down, and on the final week either applies the real, lasting
popularity/momentum gain and posts the "three weeks finally pay off" wire, or clears silently into an
ordinary, unremarked debut.

Verified: `tsc --noEmit` clean, full `vitest run` (2898 tests, 0 failures — 10 new in
`engine/career/vignette.test.ts`, 7 new in `state/vignette.store.test.ts`), `npm run build` clean,
`tools/probe.mjs` unchanged from baseline (the mechanic is entirely player-decision-gated, same as the
existing gimmick/pairing signing talks, so the automated probe never exercises it — expected, not a gap),
and a full live Playwright walk-through: signed a free agent, picked a gimmick, chose the vignette option in
the new "How do we bring them out?" dialogue, watched the cost leave the bank and the card-slot panel appear
and progress week over week, and ran the show three times to see the real debut wire land and the panel
clear.

---

## Feud pages, pair chemistry, and earned rivalry status — shipped

Asked what else was worth building, the honest read of the storyline system was that it mostly already
existed — `engine/world/storyline.ts` and the Stories board on the booking screen already ran the whole
opening/building/boiling/blown-off lifecycle. The real gap, once scoped, was everything the player actually
asked for next: a per-wrestler feud history with a visible rise-and-fall shape, some pairings clicking and
some never working, a real mechanic for revisiting a great feud for a spark without running it into the
ground, and an earned "All-Time Rivals" tier modeled explicitly on the real thing — Flair and Steamboat,
picking a decades-old feud back up and the house knowing it's in for a treat, versus the same match run once
too often burning out its own heat.

The mechanic (`engine/sim/pairChemistry.ts`, new) has two halves, both feeding a single
`pairChemistryBonus` term in `matchRating.ts` that already existed as a wired but permanently-zero context
field — the same "dead hook" pattern `overexposurePenalty` was before `freshness.ts` gave it a real value,
so the rating formula itself needed no changes at all:

- `innateChemistry(participantIds, settings)` — a fixed, entity-seeded roll (`rngFromSeed`, never the shared
  stream) per pairing, gaussian around a slight positive mean with real negative tail. Some pairs just click;
  a few genuinely never do, and that pair's segments carry a real, visible penalty every time they're booked
  together, all the way down to `chemistryLabel()`'s plain-words read ("no chemistry at all — this is a
  fight to book, not a story") rather than a number.
- `sharedHistoryBonus(history, currentWeek, settings)` — real, tunable modeling of the too-soon-vs-earned-
  spark tradeoff: reviving a pairing inside `rivalryRestWeeks` costs a real penalty that compounds per
  revival: too many trips back to the well and the audience is done with it. Given enough rest, a genuinely
  great past blow-off (quality-weighted, using the pre-existing `blowOffQuality()`) earns a real bonus that
  fades a little on each subsequent revival, exactly the diminishing-returns shape asked for.

Both `blowOffQuality` and past-blow-off history had to actually survive past the moment they were computed.
`blowOff()` always calculated a quality score to color that one week's write-up and then threw it away;
`Storyline` now carries an optional `blowOffQuality?: number` (no schema bump — old saves just read it as
`undefined`, same safe-optional-field pattern as every prior save-compatible addition here), so a pairing's
whole history of blow-offs is queryable after the fact. `legendStatus()` derives the earned tier from that
history against the existing `storylineGreatBlowoff`/`storylineFairBlowoff` thresholds (reused, not
duplicated) plus two new settings, `allTimeRivalGreatBlowoffs` (2) and `classicRivalryFairBlowoffs` (2) —
most feuds never get there on purpose.

Five new UI surfaces, all reading the engine rather than deciding anything themselves:

- **`WrestlerFeudsScreen.tsx`** (new `feuds` screen) — one wrestler's whole feud history, current feuds
  (up to however many are actually running) shown first and foremost, each with a `FeudTimeline` — a
  horizontal progress bar against the real building/boiling thresholds, a dot per beat, colored by stage —
  so the rise/fall shape asked for is the actual shape of the story, not a chart bolted on after. Real,
  attributable comparability stats (`sharedNightsSummary`) — matches together, best and average stars, gate
  on the nights they shared a card — substitute for per-wrestler merch tracking, which the data model
  genuinely does not carry (`merch` is Show-level only); said so rather than fabricating a number. A "Start a
  story" panel lets the booker manually name a pairing without waiting for the crowd to earn it, reusing the
  pre-existing `startStoryline` action untouched.
- **`AllTimeRivalsScreen.tsx` / `ClassicRivalriesScreen.tsx`** (new History-group screens) — every pairing
  at each earned tier, citation-card style deliberately matching the Hall of Fame's own look.
- **Office → Feuds tab** (`OfficeScreen.tsx`) — the feud index the player asked for: every wrestler who has
  ever carried a real story, current business sorted first, each row linking straight to their feud page.
- **`WrestlerDetail.tsx`** gained a "View feud history" link (any wrestler with a storyline, not just
  roster members), and every screen that renders it (`Roster`, `FreeAgents`, `RivalRosters`,
  `WrestlerDetailScreen`) threads an `onOpenFeuds` prop down to it.
- **Card-slot chip** — `segmentSummary.ts` gained a `storyline` field (any live story whose principals are
  both present in a segment, singles or tag), surfaced as an "Advances: {name}" chip on both the card
  overview and the match setup screen, so booking a pairing that's mid-story says so before the show runs.

Wiring in a real, always-on rating term surfaced a genuine pre-existing content gap rather than a bug in the
new code: `store.test.ts`'s "does not repeat the colour man across the card" test failed once chemistry
started shifting match ratings for real, because the "you do not envy {ref} tonight" observation had exactly
one eligible template for a `hopeSpot`/`signature` beat with a non-face colour man — any card where three or
more segments hit that combination was always going to force a third repeat, chemistry or not. Fixed at the
actual source per CLAUDE.md's own rule (re-express what broke, don't re-baseline the number): two more
templates in that same slot in `data/commentaryLines.ts`, giving the colour man real alternatives instead of
tuning the chemistry math to dodge one fixed seed.

Verified: `tsc --noEmit` clean, full `vitest run` (2881 tests, 0 failures, including the new 24-test
`pairChemistry.test.ts`), `npm run build` clean, and `tools/probe.mjs` (3 seeds × 104 weeks) showing mean
show rating unchanged from the documented baseline (49.6 against a 49-51 baseline range) — the new rating
term is real without having quietly reshaped the whole rating curve.

---

## Photo portraits replace the generated sprite atlas — shipped

Asked directly what it takes to upload a profile picture, the honest answer was that there was no upload
feature at all — every wrestler's look was a procedurally generated pixel-art sprite, and Claude's art
"isn't very good." Scoped as a photo-upload feature to sit *alongside* the generator; the player's actual
instruction, once the scoping doc was in front of them, was more decisive: **"let's remove all body parts.
one profile pic per person."** One clarifying question — what a wrestler with no uploaded photo should
look like, since that's the vast majority of the roster — got "Simple placeholder avatar," matching the
initials-and-color-swatch style already used for commentators in the match viewer.

The entire procedural system is gone, not patched around: `Appearance` (20 numeric traits), the indexed
sprite atlas (`tools/wrestler_atlas.py`, 72 PNG sheets, the compositor, the manifest/traits contract), the
Hamming-distance distinctness checks at generation and repackage time, `GimmickLook`/`applyGimmickLook` and
stable unified colors, and second-generation face resemblance — all deleted, along with every import and
call site that touched them (three generation call sites, `repackage.ts`, `lineage.ts`, `roster-io.ts`,
~24 `<PaperDoll>` render sites across the UI, and every test that exercised any of it).

`Wrestler.photoDataUrl?: string` is the entire replacement: an optional data URI, absent for the
overwhelming majority of the roster (every generated NPC, free agent, rival). `PaperDoll.tsx` is the one
render point everything still goes through — a real photo if `photoDataUrl` is set, otherwise a flat
colored circle with the wrestler's initials, hue derived from a hash of their name so it's stable across
renders. `ui/paperdoll/photoUpload.ts` turns an uploaded file into that data URI entirely client-side —
decode, centre-crop to a square, downscale to 96×96, export as compressed WebP — no network call, same as
the rest of the game. The upload/remove-photo control lives in a rewritten `WrestlerEditor.tsx`, which also
dropped its now-meaningless gender/alignment "preview" controls (they only ever existed to drive the
deleted atlas's frame selection and heel/face tint; `repackageWrestler` never actually saved them).

One real mechanic had to survive the cut: the "Mask vs Mask" stipulation needs to know who is actually
masked, both to gate booking it (all participants must be masked) and to apply its stakes (the loser is
unmasked for good). That was previously read off `appearance.mask`. It's now `Wrestler.masked: boolean` —
a mechanical fact, not a look — set at generation from a new `Gimmick.masked?: 'required' | 'forbidden'`
field (kept on exactly the three gimmicks that ever cared: Luchador and Mysterious Outsider require it,
Daredevil forbids it) or, for everyone else, a small flat chance seeded off the wrestler's own id so
removing this draw can never reroll anyone who already existed. The three places a gimmick can change
underneath a wrestler (`gimmickChange`, the signing-meeting picker, the cold-meeting relaunch) re-apply the
required/forbidden rule the same way `applyGimmickLook` used to. "Hair vs Hair" needed nothing: nothing
else in the sim ever read hairstyle, so its consequence is now just the write-up line, same as always.

Removing the appearance generator's RNG draws shifted every seeded roll after it in world/wrestler
creation — the exact trap CLAUDE.md warns about, just in reverse (removing draws instead of adding one).
Four existing tests broke as a result, none from a logic bug: an academy age-range assertion that was
actually checking the wrong settings field and had only ever passed by seed luck; a tag-match pinned/pinner
test whose 60-iteration loop was actually just two fixed entity-seeded draws repeated (fixed by varying
`week` per iteration so it samples real independent draws); and two joint-show tests that depended on a
rival's booked card having spare standby capacity, which a bigger local roster (30 vs. the file's 24)
restores with headroom rather than chasing the old seed. Re-expressed per CLAUDE.md's own rule, not
re-baselined — each fix is documented inline at the assertion it touches.

Verified: `tsc --noEmit` clean, full `vitest run` (2857 tests, 0 failures), `npm run build` clean, and a
live Playwright pass through a fresh save — roster and detail screens render initials placeholders
correctly for the whole generated roster, the editor's upload flow accepts a file, crops/resizes/previews
it, and Save writes it through so the roster row and every other `<PaperDoll>` site immediately show the
real photo in place of the placeholder.

---

## UX/navigation overhaul — all four phases shipped

Player played the actual built game for the first time and the verdict was blunt: "the ux and layout is
horrible. I didn't even know where to go... we've done fairly well behind the scenes......but nobody will
want to play." Originally deferred for a later session; the player then explicitly kicked it off ("let's
start on it"), and a bare "proceed" carried it straight on into Phase 2 (navigation stack + the wrestler-
detail screen — see "UX/navigation overhaul, Phase 1" and "Phase 2" below). Mid-way through Phase 3, the
player redirected the whole thing: the game is not phone-tailored any more — it's headed for Steam, on a
PC, and should use a real window's worth of space instead of a single scrolling column. That pivot —
sidebar shell, the booking flow finished natively for desktop, and Roster/Free Agents/The competition
rebuilt as master-detail split panes — shipped as "UX/navigation overhaul, desktop/Steam pivot" further
down this file. **Phase 4 (a calendar "this week" indicator, a free-agent "new graduates" filter) has now
shipped too — see "UX/navigation overhaul, Phase 4" at the very end of this file — closing out the whole
overhaul.** The full plan lives in `/root/.claude/plans/synthetic-plotting-planet.md`.

The player supplied seven reference screenshots from mDickie's *Wrestling Empire* (a genre sibling, not
this codebase) and named exactly what makes its interface work, as a concrete brief for what "much more
user-friendly and visually appealing" means here:

- **One screen, one job.** The card/booking screen in the reference shows *only* the card — Main Event /
  Mid Card slots, nothing else competing for attention. Compare our `BookingScreen.tsx`, which currently
  puts stipulation pickers, gear-unit chips, referee/manager assignment, and the full segment editor all
  on screen at once per slot.
- **Drill-down navigation instead of one crowded screen.** Tap a calendar date → straight into that
  night's card. Tap an empty slot on the card → back to a roster-picker screen to fill it. Tap a booked
  match → a dedicated match-setup screen with its own top tab bar (`Arena / Rules / Cast / Script /
  Play`), each tab a focused single-purpose screen, not an accordion or a scroll-everything page.
- **A real roster/wrestler-detail screen.** Tap a name anywhere → a screen with the portrait, quick
  stat bars up top (Popularity/Strength/Skill/Agility/Stamina/Attitude — visually near-identical to what
  our own `RosterScreen`-adjacent stat displays already compute, just laid out cleaner), and — this is
  the part we don't have at all — **tag partners and managers shown right there on the same screen**,
  each tappable to jump to *their* detail screen. Same list-of-wrestler-rows visual language reused
  everywhere: a promotion's roster, a rival's roster, the free-agent pool, the wrestling school
  intake, and a legends pool all render as the same scrollable list component, just filtered
  differently — not five different bespoke layouts.
- **Consistent, uncluttered chrome.** Every reference screen has the same header shape (back arrow,
  section wordmark/logo, a small stat/portrait cluster top-right) and the same list-row visual style
  (colored bars, a name, a small icon for a title belt/manager/mystery-signing). Ours currently varies
  screen to screen with no single reusable "list row" or "detail header" component doing the work.

**What this means for us, concretely, next time:** an audit of every existing `ui/screens/*.tsx` against
"is this one screen doing one job, or several," a real wrestler-detail screen/route that doesn't exist
yet (tag partners and managers are data we already have — `world.relationships`, tag team state, manager
assignments — just never surfaced as a single drill-down destination), a shared `RosterList`/`ListRow`
component to stop every screen inventing its own roster-row markup, and reworking `BookingScreen.tsx`'s
segment editor into its own dedicated screen/route reached by tapping a card slot, rather than expanding
inline. This is a real information-architecture pass, not a visual-polish pass — the design-system work
already done (tokens, `chrome.tsx`, the pilot screens) is about *how things look*; this is about *how you
get from one thing to the next*, which the player is saying is the actual blocker to anyone wanting to
play. Screenshots referenced are attached to the chat message that raised this, not saved into the repo —
re-request them from the player when this work actually starts if they aren't still visible in scrollback.

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

---

## Bankruptcy rework — all five pieces shipped

Grew out of a long design conversation with the player. The loan, the blind
bulk-buyout offer, a struggling rival's own cost-cutting, the player's own
production-gear fire sale, and release stigma reaching ordinary negotiations
are all built (see "Done" below). Nothing is left open on this one.

Also confirmed but deliberately *not* built as its own system: firing the
booker for taking a loan. Decided against a standalone mechanism — it
already routes through the existing owner-mandate strikes
(`loanMandateStrikes1st/2nd/3rd`, added to `world.mandateStrikes` the moment
a loan is taken, which can end the save the same way three missed mandates
already can). Re-inventing a separate "new booker" identity was considered
and rejected: everything it would need to do reduces to the same tightened
leash the strike system already provides.

---

## Gimmick module — all pieces shipped

Grew out of a long design conversation with the player about a gimmick
selection system: the booker picks a new signee's direction, gimmicks
evolve or get relaunched, and a hot/cold meter tracks whether the crowd is
actually buying it. All of that is built, including the fan-tweet category
that closed the last open piece of it (see "Done" below — the content
library, the reaction-driven heat rework, the signing-time dialogue, the
forced cold-meeting, and the tweet reactions). Nothing is left open on
this one.

---

## Done and worth not re-litigating

- **The player's bankruptcy lifeline: a loan, sized against the promotion's
  own payroll, repeatable but escalating.** New file `engine/economy/loan.ts`
  — see its own doc comment for the three design decisions behind the shape
  (not a flat figure, not one-time-ever, cumulative escalation that never
  resets). Offered non-blocking (`World.pendingLoanOffer`, same one-week
  grace as every other pending decision before it lapses) once
  `weeksInTheRed` crosses `loanTriggerWeeksInTheRed` (2 — before the 4-week
  hard bankruptcy cutoff, so it's a genuine off-ramp, not a consolation
  prize). Three tiers (small/medium/large, fractions of a ceiling sized off
  current payroll), and three escalating attempt tiers (1st/2nd/3rd+: less
  money, worse repayment multiple, shorter fuse, more mandate strikes, and a
  longer required cooldown before the next offer). The cooldown
  (`World.solventWeeksSinceLastLoan`) counts genuinely clean weeks only — any
  red week or any week still repaying resets it to zero, so the recovery has
  to be real, not just waited out. `World.loansTaken` never resets across the
  whole save — good behaviour earns back access, not a clean record.
  Auto-repayment (`tickLoan`) is unconditional: it deducts before the
  existing bankruptcy check even looks at the balance, so a loan taken
  without fixing the underlying problem can be the very thing that tips the
  promotion under, on purpose. Taking a loan adds real mandate strikes
  immediately and can end the save on the spot if it crosses the owner's
  threshold — reuses the existing strike/firing system rather than
  inventing a parallel one. UI: a `DialogueCard`-driven offer panel plus a
  standing "loan repayment" notice on the Office desk, both new. Verified:
  `tsc --noEmit` clean, full suite 134 files / 2708 tests passed (2684 prior
  + 24 new — 10 pure pricing/escalation tests, 14 store-level tests covering
  the trigger, the cooldown, accepting/declining, unconditional weekly
  deduction, and the owner-firing interaction), `npm run sim` and `npm run
  build` both clean, and a real-browser pass taking an actual loan through
  the real dialogue UI and confirming the bank balance, active-loan notice,
  and the existing mandate-strike warning line all updated correctly.

- **The blind bulk-buyout offer.** New file `engine/economy/buyout.ts` — see
  its doc comment for why this exists at all despite wrestling having no
  real transfer-fee tradition: the player was skeptical a general "sell a
  contract" mechanic wouldn't just become sign-cheap-develop-and-flip, a
  strategy from a different kind of game entirely. Two things close that off
  by design, not by accident — only fires while `World.activeLoan` is
  running (nobody signs a prospect hoping to go bankrupt later to unlock
  this), and the booker never chooses who goes: a rival offers a flat sum
  for a known *count*, and only picks the actual wrestlers — by uniform
  shuffle, `answerBuyoutOffer` — once the booker has already said yes. The
  price is deliberately not derived from who ends up taken, even after the
  fact: `rollBuyoutTerms` anchors it to the *selling* promotion's own
  current payroll times a randomized 3-8x multiplier, so there is no formula
  a player could reverse-engineer into "is this worth it." Titleholders are
  not protected — `stripTitle(..., 'soldOff')`, a new `TitleReignEndMethod`
  — since losing a champion in the batch was the specific drama the player
  asked for ("might get more money but lose their champions"). The rest of
  the roster feels it too, a flat morale hit reusing the same "the room
  hears about it" shape `answerApproach` already uses. Weekly trigger
  (`maybeOfferBuyout`) reads an isolated per-week seed from `resolveWeek`
  rather than the shared stream — gated behind `activeLoan` or not, this
  codebase's own history says never risk it (see the RNG note in root
  CLAUDE.md); `answerBuyoutOffer` itself uses the shared stream since it is
  a player-triggered action, same convention as every other one-off pick in
  `storeHelpers.ts`. Schema bumped to 52 (`World.pendingBuyoutOffer` is
  non-optional and read every week). Verified: `tsc --noEmit` clean, full
  suite 136 files / 2722 tests passed (2708 prior + 14 new — 4 pricing tests
  confirming the price tracks payroll rather than roster composition, 10
  store-level tests covering the distress gate, affordability, the stale
  lapse, accept/decline, the title vacate, and the teammate morale hit),
  `npm run sim` and `npm run build` both clean, and a real-browser pass
  forcing an offer, accepting it through the real dialogue UI, and
  confirming the bank balance, roster count, and a genuinely random
  championship loss all landed and were narrated on the wire.

- **A struggling rival cuts its own payroll — not the player's loan system,
  a lighter version of the same struggle.** The player was explicit about
  the shape: "it's not dollar against dollar... it's making it so they
  struggle some too... but not to put them out quickly by any means." Two
  new pure functions in `rivalEconomy.ts` — `shouldTrimPayroll` (eligible at
  half of `rivalBankruptcyGraceWeeks`, the same point `foldRisk` already
  reads "In real trouble" on the chart the player sees) and
  `cheapestToRelease` (lowest `weeklyRate`, not popularity or age) — plus
  `maybeTrimRivalPayroll` in `storeHelpers.ts`, rolled weekly per rival with
  its own isolated seed. `shouldFold`'s actual grace period is completely
  untouched; this only makes the run-up to it visible. Also narrated, for
  the first time, the existing rival bailout branch that was already there
  and already silent — a rival taking on "emergency investment" now reads
  as a real wire item instead of a bank number that quietly resets.

  Found and fixed a real bug while verifying through the actual weekly
  pipeline rather than trusting the isolated unit tests: the pre-existing
  "rivals shop the free-agent pool" system (one signing a week, per rival,
  whenever they're under their target size) ran *after* the new trim in the
  same `resolveWeek` tick, so a rival that had just released someone to cut
  costs would immediately re-sign somebody — sometimes that exact wrestler
  — the same week, netting to no visible change at all. Fixed by skipping
  that signing loop entirely for a rival currently in `shouldTrimPayroll`
  territory: a company already cutting payroll to survive does not spend
  the same week hiring. Also caught, in the same pass, a second instance of
  the documented "wire item stamped before `world.week`'s own increment
  vanishes" trap (both the new trim wire and the newly-narrated bailout
  line sit in the loop that runs *before* the increment, so both needed
  `world.week + 1` — the isolated unit tests never would have caught this
  themselves, since they call the helpers directly rather than filtering
  through resolveWeek's real post-increment cut; the fix was found only by
  running the real pipeline in a browser and noticing the wire item was
  missing). Added a regression test asserting the stamped week explicitly,
  not just the text, so this can't quietly regress again.

  Verified: `tsc --noEmit` clean, full suite 137 files / 2732 tests passed
  (2722 prior + 10 new — 4 pure-function tests, 6 store-level tests covering
  the trigger, the roster floor, the weekly-chance gate, a closed rival, and
  the enabled/disabled toggle), `npm run sim` and `npm run build` both
  clean, and a real-browser pass running the actual `resolveWeek()` — not
  just calling the helper directly — confirming the roster genuinely and
  *permanently* shrinks by one, the released wrestler lands in free agency
  and stays there, and the wire item renders correctly on the real newsfeed
  screen.

- **Fire sale of the promotion's own production gear.** The last of the
  bankruptcy rework's four confirmed pieces. New file
  `engine/economy/fireSale.ts` — `fireSaleEligible` and `fireSaleValue`, both
  pure. Only the player owns tracked production gear at all in this engine
  (`World.ownedAssetIds`/`assetConditions` — rivals don't), so this is
  necessarily a player-only mechanic, exactly as the backlog note framed it.
  Two judgment calls, checked with the player rather than assumed: the
  training facility ($130k, backs `talentGrowth`/`injuryReduction`) is
  excluded — it's the school, not show-night gear, and selling it would
  quietly gut a whole other system — via a new optional
  `ProductionAsset.fireSaleEligible` field (omit = eligible, `false` on just
  that one entry in `data/production.ts`); and the sale is gated behind
  `World.activeLoan` being active, the same distress signal `buyout.ts`
  already uses, so this stays "a genuine last resort" rather than becoming
  an ordinary way to raise cash. Pricing reuses the existing condition
  machinery rather than a flat fraction: `fireSaleValue` is
  `cost * assetEffectiveness(condition) * fireSaleValueFraction` (new
  setting, default 0.35) — a neglected rig fetches less, same curve
  `repairCost` already uses, on top of a hard distress discount, so
  under-maintaining gear costs twice. New `sellProductionAsset` store action
  (`slices/showAndProduction.ts`) removes the asset from `ownedAssetIds` and
  `assetConditions`, credits the sale value, and writes a wire item. UI: a
  "Fire sale · $X" button next to the existing Repair button on
  `PromotionScreen`, only rendered for an owned, eligible asset while a loan
  is active. Verified: `tsc --noEmit` clean, full suite 139 files / 2744
  tests passed (2732 prior + 12 new — 7 pure tests on eligibility and
  condition-scaled pricing, 5 store-level tests covering the distress gate,
  the training-facility exclusion, an unowned asset, and the on/off
  setting), `npm run sim` and `npm run build` both clean, and a real-browser
  pass forcing an active loan and two owned assets (one ordinary, one the
  training facility), confirming the sell button only appears for the
  eligible one, and that clicking it moved the cash, removed the asset, and
  narrated it on the wire.

- **Release stigma reaching ordinary negotiations — the fifth and last piece
  of the bankruptcy rework.** New file `engine/economy/releaseStigma.ts` —
  `releaseStigmaActive` (a cooldown check) and `releaseStigmaTerms`, both
  pure. Same cooldown shape as the loan's own on purpose
  (`World.solventWeeksSinceLastLoan`): a new `World.solventWeeksSinceLastRelease`
  resets to 0 the moment any release happens (`letThemGo`, the single choke
  point both booker-initiated firing and a granted release request already
  funnel through), and only climbs back up on a genuinely solvent week
  (`tickReleaseStigma`, called from `resolveWeek` right beside `tickLoan`).
  Fades faster than the loan's own — 8 weeks by default, versus the loan's
  multi-attempt escalating cooldown — since this is a lighter,
  everyday-negotiation tax, not another rescue mechanism. What a wary free
  agent actually asks for is one or the other, never both: somebody who
  would already command a guarantee off pure ego asks for a signing bonus
  instead (the guarantee has nowhere further to go), and somebody who
  wouldn't otherwise get one gets a flat guaranteed floor instead. Wired
  into both ordinary signing paths — `signFreeAgent`
  (`slices/rosterAndContracts.ts`) and the fold-pickup `signPickedWrestler`
  (`storeHelpers.ts`) — since the wariness is about the *signing
  promotion's* reputation, not the specific circumstance a wrestler is
  available under. `FreeAgentsScreen` gets a banner when the stigma is
  active, matching the existing "what this company did" death-stigma
  banner's placement and tone. Verified: `tsc --noEmit` clean, full suite
  141 files / 2756 tests passed (2744 prior + 12 new — 6 pure tests on the
  cooldown and the guarantee-vs-bonus branch, 6 store-level tests covering
  both signing paths, the cooldown tick itself, and the on/off setting),
  `npm run sim` and `npm run build` both clean.

- **Booker-initiated release, the renewal window, and queued contracts — the
  three-part contract rework confirmed in an earlier planning pass, all
  built in one session.** Three linked changes, none of them touching
  natural contract expiry, which stays exactly as cheap and unrestricted as
  it always was:

  1. **A booker-initiated firing now carries the same ninety-day freeze as a
     negotiated release.** `economy/termination.ts`'s `exitTerms`, `'fired'`
     branch: `noCompeteWeeks: 0` → `settings.noCompeteWeeks`. This is an
     amendment to an on-the-record design decision (the file's own doc
     comment used to argue the opposite — "you broke it, so you do not also
     get to keep him off television"); the doc comment now says so
     explicitly rather than silently reversing itself. Re-expressed, not
     re-baselined: `termination.test.ts`'s "is the only exit where..." test
     now asserts firing and a negotiated release carry the *same* wait, and
     that expiry alone carries none.

  2. **The last `renewalWindowWeeks` (2, new `WorldSettings` field) of any
     deal opens a real, booker-initiated conversation — not an automatic
     demand at the buzzer.** New `World.renewalTalks` (schema bump to 54),
     one entry per wrestler stepping through two stages in place rather
     than two separate lists: `'askInterest'` (booker speaker — "is the
     promotion even interested in keeping them?") advancing on "yes" to
     `'askWrestler'` (the wrestler's own portrait, first person — "so, are
     we doing this again?"), with three outcomes: negotiate now (reuses
     `contractDemand`/`answerRenewal`'s existing terms-and-counter flow
     completely unchanged, just triggered earlier — `answerRenewalWish`'s
     `'stay'` branch pushes to `pendingRenewals` exactly the way the old
     automatic trigger did), a clean warm exit (`'leave'`), or throwing it
     open to the market (`'explore'`, see #3). A "no" on either side — the
     booker's or the wrestler's — means nothing was ever agreed, and the
     deal now runs down to a genuinely plain, silent departure at actual
     expiry: the automatic `contractDemand` that used to fire for
     *everyone* at the buzzer is gone, replaced by that plain departure as
     the fallback for "nothing was agreed in time." Two new `DialogueCard`
     surfaces on `OfficeScreen`'s Contracts tab (`answerRenewalInterest`,
     `answerRenewalWish`), following the same browsable-list-then-tap
     pattern release requests already established.

  3. **A renewal auction's winner doesn't take over until the current deal
     actually runs out — win or lose, the wrestler keeps working the
     current employer's dates.** New optional `Wrestler.queuedContract`
     (not schema-bumped — optional, and every read treats a missing field
     exactly like `null`, same precedent as `motivators`). New
     `BiddingReason: 'renewalAuction'` in `economy/bidding.ts`, which
     bypasses `worthAnAuction`'s ordinary star-only gate and drops
     `minRivals` to 1 — the same reasoning `foldPickup` already established
     ("the booker already reached for this one specifically"). Reuses
     `interestedIn`'s existing, untouched "the current employer is in if
     they can pay" clause, so the wrestler's own current promotion bids
     against everyone else for their own talent. New
     `queueRenewalContract` (`storeHelpers.ts`) mirrors `awardContract`
     exactly except it writes the winning terms into `queuedContract`
     instead of touching the roster or the live contract — the signing
     bonus is still real money paid the day the deal is agreed, only the
     move itself is deferred. The swap-in lives in the same `resolveWeek`
     pass that already detects expiry (`store.ts`'s `expired` loop),
     checked first — before the death-stigma and notice-given branches —
     since a queued contract is a done deal regardless of what else is
     going on. Handles both outcomes: the wrestler moving to the winning
     rival (roster membership actually transfers, `'departure'` wire item)
     and the current employer winning their own auction (nothing changes
     day to day, `'signing'` wire item saying so plainly).

  New file `state/renewalWindow.store.test.ts` covers the window's exact
  trigger timing (opens at precisely `renewalWindowWeeks` left, never
  twice), all three `answerRenewalWish` outcomes, the widened eligibility
  gate, and the queued-contract swap-in for both a rival win and the
  current employer re-signing their own talent. One existing test needed
  re-expression, not re-baselining: `workedHurt.test.ts`'s "charges the man
  who already works here the same premium as a stranger" used to run every
  contract down to expiry in one tick and check the *automatically*-created
  `pendingRenewals` demands; it now walks every deal to the renewal window
  instead, drives the conversation to `'stay'` for everyone who isn't
  refusing to work here at all, and then runs the clock the rest of the way
  for the ones who were — the same claim (a death's premium reaches
  existing employees, not just strangers), proven against the new trigger
  point instead of the old one.

  Verified: `tsc --noEmit` clean, full suite 142 files / 2767 tests passed
  (2756 prior + 11 new — covering the window's trigger timing, all three
  `answerRenewalWish` outcomes, the widened eligibility gate, and the
  queued-contract swap-in — plus one re-expressed test, zero regressions),
  `npm run sim` and `npm run build`
  both clean, `tools/probe.mjs`'s default 3-seed/104-week run showed no
  balance drift (roster stayed stocked, all three saves survived, bank and
  company rating both in a healthy range), and a real-browser pass driving
  the full conversation end to end — Node 1 "yes" advancing live to Node 2,
  "stay" opening the real negotiation card with the right premium, and a
  forced queued contract actually swapping a wrestler onto a rival's roster
  the week their old deal ran out, narrated correctly on the wire. Caught
  one real bug in that pass: the booker's "yes" at Node 1 was closing the
  dialogue back to the list instead of advancing to Node 2, because the
  UI's `onClose`-on-every-answer pattern (correct for every *other*
  `DialogueCard` on this tab, which all terminate in one choice) doesn't
  hold for a conversation that steps through more than one node in place —
  fixed by only closing on the choices that actually end it.

- **The dialogue engine's content roughly doubled, and four new sudden-event
  types joined the weather call.** Direct follow-up to the dialogue engine
  above, in three parts, driven by explicit user feedback throughout.

  *Personnel decisions (Part 1, close to weekly now):* ten new
  wrestler-initiated events — time off, late to work, a training injury
  (branches on a failed gamble, same shape as `workingHurt`'s aftermath),
  burnout, being sick, wanting the main event, pitching a tag team, wanting
  to go part time, wanting a title shot (branches into how big the moment
  is), a movie offer — plus a third `gimmickRequest` debut option, a
  dark-match tryout with lower stakes than debuting cold. Every one of these
  moves a wrestler's morale, momentum, popularity, or a relationship, never
  just company money — enforced by a new test scoped to just these events,
  since it doesn't apply to the legitimately company-only business/rival
  events. Five new `EventEffect` kinds back this: `relationship` (the
  missing vocabulary for a pairwise tie), `fatigue` (`fatigueDebt`), `leave`
  (the existing `Leave`/`onOurWatch.ts` absence system), `contractType`
  (finally giving the long-unused `ContractType` field real meaning), and
  `violation` (routes through the existing discipline ladder). Pacing
  retuned (`eventWeeklyChance` 0.45→0.8, `eventGlobalGapWeeks` 2→1,
  `eventCategoryGapWeeks` 6→4) — "I want personnel decisions pretty
  regularly (weekly)."

  *Sudden events (Part 2):* a new business-wide catastrophe roll
  (`engine/world/catastrophe.ts`) — a couple of times a year, picks a
  category (weather/disaster or a no-show) and lands it on a promotion
  chosen at random among the player and every rival, "so the user can dodge
  a bullet if the rival's stadium roof caves in." On the player it reuses
  the existing `pendingWeatherCall` machinery unchanged for weather, or
  opens a new `pendingNoShowCall` for a no-show — blocking the week the same
  way weather does, offering a mystery opponent (the existing
  `pickReplacement` weighting, now shown instead of silent), a handicap
  match, or pulling the segment, and recording a real discipline violation.
  On a rival it applies a fixed default and always writes one wire line
  either way — "all promotions must suffer the same issues." Three more
  non-blocking reactive decisions, answered whenever the booker next visits
  the office or never: `pendingTitleMemorial` (what happens to a belt left
  with a dead champion — death itself stays fully automatic, per the
  deliberate "applied rather than offered" design note in `seasons.ts`; only
  the belt's fate is new), `pendingRivalMove` (react to a rival signing
  worth reacting to, gated on the signing's popularity), and a new rare
  mechanic where a rival can launch a whole new championship of their own
  (narrated only — no dialogue on this one specifically, a deliberate scope
  trim). The frequent, low-stakes, player-only misfortune/absence system
  that already existed is untouched throughout — every new sudden event is
  layered on top of it, not a replacement.

  *The confrontation escalation call (Part 3):* research found promo/
  confrontation/contract-signing segments already existed in full —
  `data/confrontations.ts`'s `contractSigning` intent, `PromoSlots.tsx`'s
  booker-facing picker, the additive `promoRating` — so this pass added only
  the one thing missing: `pendingConfrontationCall`. When a confrontation's
  twist roll produces an actual injury, the casualty is held back instead of
  applying automatically; the segment's own rating/write-up are already
  locked in (same principle as the champion call), and the booker decides
  separately whether to let it happen (the injury lands as rolled, real
  heat) or pull them apart (no injury, a `bookingCredibility` cost for
  looking like the office stepped in).

  *RNG discipline, learned the hard way:* the catastrophe roll and the
  rival-new-title roll both run every week (the ~96-99% of the time nothing
  happens included), so both draw from a per-week isolated seed
  (`rngFromSeed`) rather than the shared stream — the exact CLAUDE.md trap,
  caught by two real test failures during this pass (`store.test.ts`'s
  official-departure test and the weather-call `forceCall` tests) and fixed
  by isolating the draw rather than patching the symptom. A third failure
  (`forceCall` stalling on an unanswered no-show call it didn't know to
  answer) was a real gap in test-loop robustness, fixed by teaching the
  helper to wave through an incidental no-show the same way it already
  waves through mandate outcomes. Schema bumped 46→50 across the four new
  `World` fields, one version per field, no migrations, old saves rejected
  on mismatch as always. Verified with `tsc --noEmit`, the full suite (2669
  tests), `npm run sim`, a production build, and a real-browser pass forcing
  all four new dialogue surfaces (no-show, title memorial, rival move,
  confrontation call) via direct store state, confirming each renders with
  the right speaker treatment, choices, and gains/costs.

- **Reactive personnel/managerial moments now play out as a conversation, not
  a flat card of buttons.** Creative events, release requests, rival
  approaches, an injured champion's title call, and severe-weather calls all
  render through one new shared component (`ui/dialogue/DialogueCard.tsx`):
  the wrestler's real portrait, first-person body text, and the booker's
  multiple-choice reply — a themed monogram badge stands in for the booker
  (never a generated face), and weather/disaster calls get the no-face
  "narrator" variant since nobody with a face is doing the asking. The
  underlying data model (`engine/events/types.ts`) is additive: `EventOption`
  gained an optional `next` (and a gamble's optional `nextOnSuccess`/
  `nextOnFailure`), and `CreativeEvent` gained an optional `nodes` map — a
  root option that omits `next` still terminates exactly as before, so all 9
  non-branching events needed zero data changes. `resolveOption`
  (`engine/events/apply.ts`) now takes the current node id and returns either
  a terminal summary or a `next` node to advance to; `chooseEventOption`
  (`state/slices/events.ts`) advances `PendingEvent.currentNodeId` and
  appends to its `history` instead of always closing the card. Two events
  (`gimmickRequest`, `workingHurt`) were given a real second node as proof
  the engine actually branches — granting a gimmick change now asks how it
  debuts, and working-hurt's gamble failure asks how the medical bill gets
  handled — the other 9 events are single-node, first-person-only where one
  wrestler is doing the asking (two-subject events like `backstageFight`
  stay narrator-voiced, since forcing one person to "own" the line would
  misstate what's happening). Release requests and rival approaches gained
  real first-person lines (`releaseRequestLine` in
  `engine/economy/termination.ts`, `approachLine` in `engine/world/poaching.ts`)
  picked deterministically from the request itself, not from `world.rng`, so
  a re-render never changes what somebody already said. Schema bumped to 46
  for `PendingEvent`'s new `currentNodeId`/`history` fields — no migration,
  old saves with a mid-flight event are rejected on version mismatch, same
  as every prior bump. Verified with `tsc --noEmit`, the full suite (2633
  tests), `npm run sim`, a production build, and a real browser: forced each
  of the five surfaces to fire (naturally for creative events, via direct
  store state for the rarer release/approach/champion/weather calls, which
  the plan explicitly allows for a screenshot pass) and confirmed the
  portrait, first-person text, and gains/costs choices all render correctly,
  then drove `gimmickRequest`'s branch through "grant" → the `debut`
  follow-up node → a failed gamble, confirming the scrollback, the second
  choice's own effects, and the terminal outcome summary all work.
  Booker-initiated back-office work (contract renewals, scheduling, browsing
  stats/profiles) deliberately stays on ordinary browsable screens, not this
  engine — reactive vs. proactive was an explicit split from the start. A
  related contract/tampering-period rework (last-two-weeks renewal
  conversation, a legal-tampering bidding war, a 90-day freeze on
  booker-initiated releases) was scoped alongside this but deliberately not
  built — it touches contracts/free-agency/the bidding-war auction deeply
  enough to be its own follow-up.

- **A rival's roster, and their career history, is now browsable — "The
  competition" (`RivalRosterScreen.tsx`, behind More).** Every screen that
  touched a rival before this showed a name and a record at most (Rankings'
  top-N lists, the Sheet's top-N lists) — nothing let you open a company and
  see who they actually had. The new screen lists every company still
  running (folded ones are skipped — their people already scattered to the
  free agent pool or somebody else's roster, tracked there), and picking one
  shows its full roster: `WrestlerRow` (unchanged, already generic — no
  edits needed to reuse it read-only) plus belts held, plus `CareerLedger`.
  `CareerLedger` itself was pulled out of `RosterScreen.tsx` into
  `ui/components/CareerLedger.tsx` so both screens share one implementation
  rather than fork it. No management actions on this screen by design — you
  can look, not touch. Verified in a real browser: started a 3-promotion
  game, ran four weeks so ledgers had stints and records to show, opened The
  competition, switched between both rivals, and expanded a career ledger —
  confirmed belts, records, and stint history all render correctly and the
  promotion switcher works.

- **The "twelve magic-seed tests" line was stale — checked and the pattern is
  gone.** An exhaustive pass over `store.test.ts` (the scenario-test file the
  line meant) and every other seeded test in the suite found no case of a
  test reaching into a generated roster by a fixed index and assuming
  whoever that seed happened to produce satisfied some property the test
  actually needed. Every place that needs someone specific already either
  overrides the property right after generation or explicitly
  `.find()`/`.filter()`s the roster for a match — and several carry their own
  comments documenting exactly this fix having been made already (e.g.
  `store.test.ts` around "a bound that has to be re-tuned every time the
  world gains a system is testing the seed, not the rule" and "asserting on
  *this* legend's kid specifically made the test a bet on nobody bigger
  having finished that year"). One candidate
  (`data/titleLifecycle.test.ts`'s `'cannot be put on a card'` test, which
  books two unfiltered generated wrestlers against a title) was investigated
  and ruled out: the test retires the title first, and `eligibleTitles`
  short-circuits on `retiredWeek` before either wrestler's properties are
  ever read. Whatever prompted this backlog line, it had already been fixed
  by the time it was checked — removed rather than re-litigated.

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
- **A folded promotion's roster is now picked through, not auctioned as one
  lot.** Player asked directly: "the user should get a pick any of the
  bankrupt promotion's wrestlers. any that they choose that other companies
  also want should go to the bidding war module. the rest should go to free
  agency." Replaces the whole-roster `engine/world/auction.ts` module
  (`AuctionLot`/`appraise`/`aiBid`/`settleAuction`, deleted outright) with
  `World.pendingFoldPicks` — the fold's roster sits open for the booker to
  browse, `pickFromFoldedRoster` (`state/storeHelpers.ts`) signs an
  uncontested pick straight onto the roster (`signPickedWrestler`, same
  guard triplet as `signFreeAgent` — 90-day freeze, grudge, affordability —
  applied directly rather than through the ordinary free-agent flow) and
  routes a contested one into the bidding-war module under a new
  `BiddingReason: 'foldPickup'`. `finishFoldPicking` sweeps whatever the
  booker leaves behind to `world.freeAgents`, same as any other release.
  Titles the closed promotion held vacate immediately via the existing
  `stripTitle` (new `TitleReignEndMethod: 'promotionFolded'`) — the player's
  ask was scoped to wrestlers, so belts were not folded into the pick UI.
  Two real wrinkles: `interestedIn`'s "do they actually want him" desire
  test runs against `world.rivals` only for a fold pickup (not the player),
  since the player's interest is already the pick itself — testing it again
  against the generic popularity-vs-rating formula could contradict the
  click; and `openBiddingWar`'s one-war-at-a-time limit meant multiple
  contested picks off one roster need a queue (`World.foldBidQueue`,
  drained one at a time at the true end of `settleBiddingWar`, with the
  same "recheck disagreed, sign them anyway rather than let them vanish"
  fallback the non-queued path already had). A `foldPickup` war with no
  winning bid sends the wrestler to free agency rather than "back" to their
  now-nonexistent employer. Second half of the ask — "have Bidding WAR
  displayed really big and bold at the top, it's an exciting thing" — is a
  new banner in `ui/components/BiddingWar.tsx`, plus a `foldPickup`-specific
  line in both the invitation and result copy (`engine/economy/bidding.ts`)
  so a fold pickup reads differently from a plain star auction. New direct
  test coverage in `state/foldPicks.test.ts` (closing vacates titles and
  opens the pool; an uncontested pick signs outright; a contested pick opens
  a `foldPickup` war with the player unconditionally invited; two contested
  picks queue and drain in order; a war with no winner lands the wrestler in
  free agency; `finishFoldPicking` sweeps the leftovers) — the prior auction
  system had no direct test of its own either, only the fold-trigger
  (`rivalWeek`/`shouldFold`/`foldRisk`) tests, which moved as-is to the new
  `engine/world/rivalEconomy.test.ts`. Verified: `tsc --noEmit` clean, full
  suite 131 files / 2666 tests passed (2660 prior + 6 new), `npm run sim`
  and `npm run build` both clean, and a real-browser pass confirming the
  fold-picks panel, the queued-pick notice, the queue draining into a fresh
  war on settle, and the bold amber "BIDDING WAR" banner all render as
  designed.
- **The motivation system: what somebody is actually chasing, as its own
  icon row, separate from morale.** Grew out of a long conversation with the
  player about bankruptcy design, specifically the observation that a
  well-paid star can stop trying — "they get a big money contract... then no
  longer produce," the player's own NFL comparison — and the wish for a
  system that answers with something other than throwing more money at it.
  Landed on the player's own simplification over my first, heavier proposal
  (a whole new stat with its own decay feeding into match ratings): "a
  symbol for what motivates them, then if achieved, the morale moves" — one
  to a handful of icons per wrestler, plus a legend.

  New file `engine/career/motivation.ts`: six new `MotivatorId`s
  (championship 🏆, push 🎤, fame ⭐, creative 🎭, competition 🥊, security 🛡️),
  drawn once at generation off their own isolated stream
  (`rngFromSeed(\`motivate:${id}\`)`, same pattern as traits — this is what
  let the whole system land without rerolling a single existing wrestler,
  confirmed by the full suite passing with zero new failures). Wired two
  different ways because they are two different kinds of thing, and said so
  in the module doc comment rather than forcing one mechanism on both:
  - Championship and push re-weight morale terms that already exist for
    everybody (`gold`, `spotlight`, `idle`) — exactly how a trait does it.
    `morale.ts`'s `add()` now multiplies by both `leverWeight` (traits) and
    the new `motivatorLeverWeight` (motivators), the product capped once at
    `traitLeverCap` rather than each side capping itself and then
    multiplying past the ceiling.
  - Fame, creative, and competition are genuinely new weekly signals nobody
    was reading before: how close somebody is to their own career-best
    popularity (`Wrestler.careerHighPopularity`, already tracked, never
    read by morale before this), how fresh their gimmick still feels
    (`gimmickFreshness`, same story), and whether the last person they
    shared a ring with was a real test (`MoraleContext.opponentPopularity`,
    a new field computed the same way `beatenByPopularity` already is, but
    for both sides regardless of the result). Bespoke in a new
    `motivatorReasons`, called from `weeklyMorale` the same way
    `traitReasons` already is.
  - Security-motivated is not morale at all — it overrides
    `theBody.ts`'s `dealAppetite` to always read as `'insurance'`, the
    existing appetite a frightened, injury-history-driven wrestler already
    gets, now available to anybody the player has said wants it regardless
    of ego or history.

  Money, rest, the room, gratitude, and home were **not** duplicated as new
  motivators — they already exist as traits (`inItForTheMoney`,
  `wantsMoreTimeOff`, `lockerRoomLeader`, `gratefulForTheWork`,
  `somebodyAtHome`) with real, tested mechanisms behind them. Deleting and
  rebuilding those four to fit a new parallel system would have touched
  `drawTraits`'s RNG-sensitive pool composition and every existing trait
  test for no mechanical gain — instead `Trait` gained an optional `icon`
  field, set on exactly those five, and the roster card now shows one
  unified icon row (`motivationSymbolsOf`) mixing real motivators and
  iconified traits, plus one shared legend (`motivationLegend`, rendered as
  a `<details>` "What the icons mean" panel on the roster screen — same
  collapsible-key idiom `WrestlerRow.tsx`'s existing `RowKey` already uses
  for the card-builder tags) — the player never needs to know or care which
  underlying system produced which icon.

  `Wrestler.motivators` is optional and every reader goes through
  `motivatorsOf`/`hasMotivator`, both defaulting a missing array to empty —
  deliberately **not** a schema bump, since a bump exists to stop an old
  save crashing on a field it doesn't have, and there is no crash here:
  loading a pre-existing save just shows nobody with a motivator until
  natural roster turnover generates people who have one.

  Verified: `tsc --noEmit` clean, full suite 132 files / 2684 tests passed
  (2666 prior + 18 new, zero regressions — the RNG-isolation held), `npm run
  sim` and `npm run build` both clean, and a real-browser pass generating a
  20-person roster, confirming a spread of all six motivators actually
  landed, and screenshotting both the icon row on real roster cards and the
  expanded legend. One icon swap during that pass: crossed swords (⚔️) for
  competition-motivated rendered as an ambiguous X in the test environment's
  font, so it became a boxing glove (🥊) instead — safer across whatever
  emoji font a real device actually has.

- **The gimmick selection module — a real content library, reaction-driven
  heat, and two new booker conversations.** Grew out of a long design
  conversation: gimmicks should be real, specific characters (not just an
  abstract intensity tier), a wrestler's heat should track whether the crowd
  actually cares (not just win/loss), and going cold long enough should
  force the booker's hand. Four pieces, all shipped:

  - **The library.** `src/data/gimmicks.ts` — 190 solo gimmicks (the
    original 28-entry "Classic" set plus 162 drafted from real territorial-
    wrestling history, see `docs/gimmicks-catalog-draft.md`), authored as
    `GimmickSeed`s (id/name/category/alignmentLean/concept/promoLines/prop
    only) run through `engine/generate/gimmickDefaults.ts`'s
    `deriveGimmickDefaults`, which fills in every mechanical number and a
    default look off the category, deterministically seeded off the
    gimmick's own id (`rngFromSeed`) so nobody hand-tunes a popularity
    ceiling for entry #187 and the numbers never reroll on load. Adding a
    gimmick is one more array entry, per CLAUDE.md's "content lives in
    data/" rule and the player's explicit "leaving it easy to add more
    gimmicks down the road" ask. A late `Minor tweak` category covers the
    other end of the brief — wrestlers who don't need a full character at
    all: earned nicknames, a single visual tell, or just being genuinely
    serious (`Straight Shooter`) or loosened all the way up (`Good Times`).
    `src/data/groupGimmicks.ts` adds 36 shared identities (21 tag teams, 15
    factions) for the pairing step below.
  - **Reaction-driven heat.** `gimmickFreshness` used to be a one-way clock
    (`engine/sim/freshness.ts`'s `ageGimmick`) — it decayed no matter what,
    with no way to earn it back short of a full reset. Now it drifts toward
    a target set by the wrestler's existing `momentum` stat
    (`heatTarget`): a genuinely hot act holds or climbs, a merely-tolerated
    one still settles low even while it keeps working, matching "not every
    wrestler needs the best reaction, but no reaction at all still needs to
    be looked at." The roster card now shows this as a persistent ice-to-
    fire meter (`GimmickHeatMeter`, `ui/components/display.tsx`) — a
    position on a spectrum, not a fill bar — always visible rather than
    only once an act has already gone stale.
  - **The signing-time "meet the booker" dialogue.** Every generated
    wrestler already had a random gimmick with no way for the booker to
    actually decide. `World.signingTalks` (same in-place-stage pattern as
    the existing `RenewalTalk`) opens once a wrestler lands on the player's
    roster — a free agent, a folded-roster pickup, a bidding-war win, or a
    renewal auction's deferred swap-in. Node 1 picks the gimmick via a
    category-grouped `<select>`; node 2 optionally pairs them into a tag
    team or faction under a `GroupGimmick`'s shared identity, checking
    eligible same-division roster partners not already spoken for
    (`engine/world/tagTeams.ts` gained `canFormGroup`/
    `formGroupGimmickStable`/`groupOf`, generalizing the existing two-person
    `canFormTeam`/`createTeam` to any group size).
  - **The forced cold-meeting.** An act sitting at or under
    `iceColdThreshold` for `coldMeetingTriggerWeeks` running
    (`Wrestler.weeksIceCold`, tracked in `resolveWeek` alongside the
    existing `ageGimmick` call) now forces a real decision instead of
    quietly dragging every match it's in — `World.coldMeetings` opens, the
    ice-cold trigger gets its own lead wire item (`goneIceColdLine`), and
    the booker gets exactly two ways out: relaunch (the same gimmick
    picker, always resetting the heat meter to a clean 100 — a real
    repackage, matching `generate/repackage.ts`'s own reset, whether or not
    the gimmick id actually changed) or release (the same `releaseWrestler`
    action and terms as any other release, called via `get()` rather than
    duplicated).

  All three narrative moments — a debut, a pairing, a relaunch — now write
  their own wire item too (`state/slices/rosterAndContracts.ts`), which
  incidentally closed a real pre-existing gap: a plain free-agent signing
  had never carried its own wire line at all. See the "Gimmick module"
  section above the "Done" list for what's still open on the narrative side
  (a dedicated fan-tweet category).

  Bumped the save schema twice — 55 for `World.signingTalks`, 56 for
  `World.coldMeetings` — both new, unconditionally-read array fields.
  `Wrestler.weeksIceCold` is optional and not part of either bump, same
  treatment as every other "missing means zero" field this session.

  Verified across three passes (the content/heat rework, the signing
  dialogue, and the cold-meeting): `tsc --noEmit` clean throughout, the full
  142-file / 2769-test suite passing after every change (21 new/re-expressed
  tests in `freshness.test.ts`, zero regressions elsewhere — including a
  guard test, `career/pronouns.test.ts`, that caught 37 gendered pronouns in
  the hand-authored gimmick concepts/promo lines and forced a genuine
  content fix, not a test change), `npm run sim` and `npm run build` both
  clean throughout. Real-browser passes: signed a free agent, picked
  "Trashman" over their generated gimmick, paired them into "The Wrecking
  Crew" tag team, and confirmed it on the roster screen; forced both
  cold-meeting branches via `useGameStore.setState` (natural triggering
  takes six-plus in-game weeks) and confirmed a relaunch (gimmick changed,
  freshness and `weeksIceCold` reset, meeting closed) and a release
  (dropped from the roster, meeting closed) both landed correctly — this
  pass caught and fixed a real bug where "try a new direction" was closing
  the dialogue instead of advancing it to the relaunch picker, the same
  class of mistake the renewal-talk precedent's own in-place-stage pattern
  exists to avoid.

  **Follow-up: the fan-tweet category for gimmick reactions.** The wire
  feed already covered a debut, a pairing, and a relaunch; what was still
  missing was `engine/world/fanReaction.ts`'s tweet layer reacting to any
  of it. Three new template pools (`GIMMICK_DEBUT_TWEETS`,
  `GIMMICK_PAIRING_TWEETS`, `GIMMICK_RELAUNCH_TWEETS` in
  `data/fanVoices.ts`) and a `GimmickReactionSubject` type. Because a
  gimmick decision happens on a booker's own schedule and not tied to a
  show resolving, it queues onto `World.pendingGimmickReactions` the
  moment the decision is made (same three call sites as the wire items)
  and drains into the feed the next time the player's own show actually
  runs — genuinely mixed into the ordinary reactions, not a separate box,
  following the exact leads-but-stays-inside-the-count pattern the
  existing title-change tweets use. Bumped the save schema to 57 for the
  new field. Verified: `tsc --noEmit` clean, the full 142-file /
  2775-test suite passing (6 new tests, zero regressions — the queue is
  empty for every existing scenario), `npm run sim` and `npm run build`
  both clean, and a real-browser pass signing a free agent, confirming a
  gimmick, and running the actual show — confirmed via direct store
  inspection that the queue populated before the show and drained after,
  with the debut tweet landing in the real feed alongside the ordinary
  show reactions.

- **Bug fix: two promos on the same card could write up as the identical
  line.** The player spotted it directly — two separate "on the
  microphone" segments both read "Sharp, mean, and over. {name} made
  their point." `sim/promo.ts`'s `writeUp` picked independently per promo
  with no memory of what had already been said that night, and each
  quality band only carried 3 lines, so a repeat on any card with two or
  more promos was common rather than rare. `resolvePromo` now takes an
  optional shared `usedLines` set (defaults to a fresh one, so every
  existing caller and test is unaffected); `writeUp` prefers an unused
  line in the right quality band, then reaches into every other band
  before ever repeating one outright. Threaded through both places that
  resolve more than one promo per card in a loop — the player's own show
  (`state/store.ts`) and a rival's AI-booked card
  (`engine/world/rivalBooking.ts`). Also expanded `PROMO_LINES` from 3 to
  6 lines per band (`data/promoTopics.ts`) so the fallback is rarely
  needed at all. Verified: `tsc --noEmit` clean, full suite 142 files /
  2778 tests passed (3 new — no-repeat-within-a-card, graceful behaviour
  once a card genuinely exhausts every line, and independent calls with
  no shared set staying unaffected), `npm run sim` and `npm run build`
  both clean, and a real-browser pass auto-filling and running 15
  consecutive shows (30 promos total) confirming zero duplicate write-ups
  on any single card, plus a screenshot of the exact scenario the player
  flagged now showing two distinct lines.

- **The same fix, applied everywhere else it applied.** The player's
  stated principle after the promo fix: "if the frequency of repetition is
  too high anywhere in the game, we don't have enough variety of words and
  expressions in that area." Rather than wait for the next place to get
  caught, a survey of every `pick(rng, ...)` call site that draws from a
  content pool found two more with the exact same shape — small pool,
  multiple draws in the same show, zero same-context tracking:
  - **`sim/confrontation.ts`'s `resolveConfrontation`.** Openers and twist
    lines (3 each) were drawn independently per confrontation; up to 2
    confrontations can be booked on one card. Same fix as promo.ts: a new
    `pickUnused` helper and an optional shared `usedLines` set (defaults
    to a fresh one), threaded through `resolveConfrontationSlot`
    (`storeHelpers.ts`) and reusing the *same* `usedPromoLines` set
    store.ts's promo loop already creates — a confrontation and a promo on
    the same card now can't collide with each other either, not just
    within their own kind.
  - **`sim/narrative.ts`'s `generateBeats`.** `CONTROL_BEATS` carries only
    2-4 lines per wrestling style (`data/matchBeats.ts`), and several
    winners on one card sharing a style is routine on a real roster — a
    real, not edge-case, way to read the identical control-segment
    sentence in two different match write-ups on the same show.
    `generateBeats` already had a local `used` set, but it was recreated
    per match and thrown away; it now takes an optional shared
    `usedAcrossCard` set (default fresh, so every existing caller — dark
    matches, rival-booked cards, cup runs — is unaffected) and store.ts's
    own match-resolution loop creates and threads one across every match
    on the player's card. `SimulateMatchContext` gained an optional
    `usedBeats` field to carry it through.
  - Also expanded content directly, the other half of the player's
    principle: `CONTROL_BEATS` from 2 to 4 lines per style (all 12 styles)
    and `TITLE_BEATS` from 3 to 5, so the dedup fallback is rarely needed
    at all rather than doing all the work alone.
  - Originally flagged `misfortune.ts` and `referees.ts` as real but
    lower-priority (chance-gated, most weeks/shows produce zero or one
    hit) rather than urgent — the player asked for them checked properly
    anyway, so both got the same treatment as a follow-up:
    - **`misfortune.ts`'s `rollMisfortune`.** Each of the 17 misfortune
      definitions carried only 2-3 lines, and a large roster can draw the
      *same* definition for two different people in one week — reading
      "the car died in a petrol station car park" for two different
      wrestlers in the same week's news is thin even though the names
      differ. Now takes an optional shared `usedLines` set, defaulting
      fresh; only dedupes within one definition's own pool (a fallback
      into a different definition would describe the wrong kind of
      misfortune entirely — a gym-accident line under a car-wreck heading
      makes no sense), threaded through store.ts's weekly roster loop.
      Every one of the 17 definitions expanded from 2-3 lines to 4.
    - **`referees.ts`'s `rollRefereeMiss`.** Same shape: 12 miss types at
      2 lines each, drawn once per match with several matches per card.
      Same fix — optional shared `usedLines`, dedupe within one miss
      type's own pool only, threaded through store.ts's match loop
      (reusing the same `usedBeats`-adjacent pattern, its own
      `usedRefereeMissLines` set). All 12 miss types expanded from 2 to 4
      lines, catching and fixing one real content bug along the way: two
      of the new lines were missing the `{victim}` placeholder the
      existing data-integrity test requires on every victim-needing miss.
    - `casualties.ts` remains flagged but genuinely lower priority even
      on a second look — a collision there needs two *different* people
      to both actually get hurt, draw the same cause, and draw the same
      line, a compound low-probability event rather than the near-certain
      shape the other four had.
  - Verified: `tsc --noEmit` clean, full suite 142 files / 2784 tests
    passed (7 new — cross-card dedup for confrontations, match beats,
    misfortunes, and referee misses, plus confirming an unshared/default
    call stays unaffected in each), `npm run sim` and `npm run build` both
    clean, and a real-browser pass auto-filling and running shows across
    both rounds of this fix (25 consecutive shows total) with no runtime
    errors from any of the newly threaded parameters.

---

## Fan taste — a crowd's preference that actually drifts with booking history

Came out of a design conversation prompted by an outside take on wrestling
booker sims ("dynamically evolve fan taste based on booking history"). The
promotion identity system (`data/promotionIdentity.ts`) already gave every
company a fixed, declared house style — what the marquee says. This adds a
second, dynamic layer: what the crowd has *actually* come to want, which can
drift away from the declared identity if the booker keeps giving them
something else.

- **`engine/world/fanTaste.ts`, new file.** `FanTaste = Record<WrestlingStyle,
  number>`, one 0-100 value per style, 50 neutral. `defaultFanTaste(archetype)`
  seeds a mild lean toward the declared identity for a brand-new promotion.
  `styleRunShare(styles)` turns a night's competitor list into a per-style
  fraction of the card. `driftFanTaste(taste, runShare, settings)` moves
  taste toward a target set by how far above or below its "fair share" (1/12
  of the card) a style ran that week — reuses the exact drift-toward-a-target
  shape `sim/freshness.ts`'s `ageGimmick` already uses for gimmick heat, for
  the same reason: evidence should accumulate over a season, not snap to one
  night. Mutates in place, same contract as `ageGimmick`. A style that never
  runs at all drifts gently toward mildly cold rather than pinning at zero or
  staying frozen at neutral forever — flagged with a `// DESIGN:` comment
  since it's a genuine judgment call, not a forced conclusion. `fanTasteHighlights`
  turns the numbers into words for the player — a style only gets named as
  "loved" or "gone cold" once it's crossed a real gap from neutral.
- **`sim/houseStyle.ts`'s `houseStyleRatingBonus`** gained an optional
  trailing `currentTaste` parameter. Omitted (every caller before this),
  behavior is byte-identical to before. Passed, it adds a second, fully
  additive rating term off the same participants — a match can be rewarded
  for suiting the declared house, for suiting what the crowd currently
  wants, both, or neither. Deliberately smaller than the identity term
  (`fanTasteRatingWeight: 2` vs. `houseStyleRatingWeight: 4`) — a thumb on
  the thumb, not a second identity system.
- **`Promotion.fanTaste`**, a new required field, initialized at all four
  real construction sites (`newPromotions.ts`'s `foundPromotion`,
  `state/world.ts`'s player/rival/mid-save-founding paths — `cupRun.ts`'s
  `hardcoreSaturation: 0` turned out to belong to `SimulateMatchContext`,
  not a `Promotion`, so it needed no change). Bumped the save schema to 58.
- **Wired into the player's own week** (`state/store.ts`): a `tonightsStyles`
  accumulator declared alongside the existing `violenceLevels` (same
  push-during-the-match-loop, consume-after-the-card-resolves shape that
  already feeds `hardcoreSaturation`), drifted right after that
  `hardcoreSaturation` update, and `world.promotion.fanTaste` passed into
  the `houseStyleRatingBonus` call.
- **Wired into every rival, too** — the tradeoff flagged and accepted before
  building: `runRivalShow` (`engine/world/rivalBooking.ts`) only ever reads
  `ctx.promotion`, never mutates it (confirmed by grep before touching it —
  every other promotion-level counter, including `hardcoreSaturation`
  itself, follows the same read-only convention there and turned out to
  never actually get updated for rivals as a result, a pre-existing gap
  this deliberately did not also leave fan taste in). Rather than break that
  convention, `RivalShow` gained a `styles: WrestlingStyle[]` field —
  tallied inside `runRivalShow`, returned rather than applied — and
  store.ts's `rivalShows` loop calls `driftFanTaste` on `rival.fanTaste`
  itself once a show comes back, the same way it already applies every
  other rival-show effect.
- **A small UI surface**, words not numbers, per §0: a new paragraph in
  `PromotionScreen.tsx`'s "Who you are" panel, right under the declared
  identity's `knownFor` line, reading e.g. "Lately the crowd has taken to
  technical and showman wrestling — and gone cold on bruiser." Only appears
  once `fanTasteHighlights` actually has something to say, same "only speak
  at the ends" rule `fitLabel`/`hypeLabel` already follow. New
  `STYLE_LABEL` map in `data/styles.ts` turns the raw camelCase style ids
  (`highFlyer`, `oldSchool`) into words that read as a sentence rather than
  a tag, since this is prose rather than a compact stat chip.
- Verified: `tsc --noEmit` clean, full suite 143 files / 2803 tests passed
  (19 new — starting taste, run-share reading, the drift's climb/settle/hold/
  bounds/mutate/cancelled-night behavior, the highlight labeling, and
  `houseStyleRatingBonus`'s taste-aware path including the byte-identical
  no-taste-passed case), `npm run build` clean, `npm run sim` clean, and —
  because this touches match rating, `npm run sim` alone doesn't cover it —
  `node tools/probe.mjs --report shows --seeds 6 --weeks 104` against the
  documented baseline: mean show rating 50.5 against the baseline's 50.6, no
  measurable shift. A real-browser pass ran 20 consecutive auto-filled
  weeks from a fresh save, confirmed `Promotion.fanTaste` moved
  independently per style based on actual booking (not frozen, not moving
  in lockstep) with zero runtime errors, and screenshotted the "Lately the
  crowd has taken to technical and showman wrestling" line rendering live
  on the Promotion screen.

---

## Repetition audit, round three — the no-show call and its rival sibling

Return to the repetition theme ("check misfortune-driven no-shows too") after
the earlier round covered `promo.ts`, `confrontation.ts`, `narrative.ts`,
`misfortune.ts`, and `referees.ts`. This round found a worse variant of the
same bug rather than a milder one.

- **`engine/world/noShowCall.ts`'s `resolveNoShowCall`** had three outcome
  branches (`pullSegment`, `handicapMatch`, `mysteryOpponent`), each writing
  a single, completely fixed template sentence — not "small pool, might
  repeat," but zero pool, guaranteed identical, forever, across the whole
  save. Fixed by adding a 4-line pool per branch (`PULL_SEGMENT_LINES`,
  `HANDICAP_LINES`, `MYSTERY_OPPONENT_LINES`) and a private `outcomeRng(call,
  choice)` helper that derives a seeded RNG off `absentId:week:choice` rather
  than drawing from the shared stream — this resolves mid-`resolveWeek`,
  after the booker has answered, so a shared-stream draw here would shift
  every seeded roll after it (the documented trap). Stable and replay-safe:
  the same call and choice always writes up the same way.
- **`state/store.ts`'s rival-catastrophe wire line** had the identical shape
  one level up: a fixed ternary between one "weather" sentence and one
  "no-show" sentence for narrating a catastrophe landing on a rival instead
  of the player. Fixed the same way — two new 4-line pools in
  `data/misfortunes.ts` (`RIVAL_WEATHER_CATASTROPHE_LINES`,
  `RIVAL_NO_SHOW_CATASTROPHE_LINES`), picked via a seeded
  `rngFromSeed(\`rivalCatastropheLine:${rival.id}:${world.week}\`)` for the
  same reason — this sits inside `resolveWeek`'s deterministic sequence too.
- Deliberately left alone: `noShowCallFrom`'s own excuse-line draw (the
  `warning` field) already pulls from the full, already-expanded `misfortune.ts`
  absence pool — no separate fix needed there. Considered and declined
  threading a dedup set across the call: it's a rare, chance-gated,
  business-wide roll (a couple of times a year per the catastrophe system),
  and the same-week collision risk against an unrelated wrestler's ordinary
  `rollMisfortune` draw is low enough that the complexity of bridging a
  declaration-order gap in `resolveWeek` (the no-show call resolves earlier
  than `usedMisfortuneLines` is declared) wasn't worth it — consistent with
  the earlier round's finding that chance-gated, at-most-weekly draws are
  lower priority than the "always identical" bug class this round actually
  found.
- Verified: `tsc --noEmit` clean, new `engine/world/noShowCall.test.ts` (7
  tests — placeholder-free output on all three choices, more than one
  distinct phrasing per choice across 30 simulated weeks, replacement name
  present on the mystery-opponent line, replay-identical for the same call
  and choice, and the segment drops from the card only when pulled), full
  suite 144 files / 2810 tests passed (2803 + 7 new, zero regressions),
  `npm run build` and `npm run sim` both clean, and a real-browser pass:
  forced a `NoShowCall` directly into `world.pendingNoShowCall` to bypass the
  rare weekly roll, confirmed the full-screen dialogue overlay renders
  correctly with all three choices and their gains/costs, that its warning
  text came from the already-expanded `misfortune.ts` pool (confirming the
  whole pipeline wires together end-to-end, not just unit-tested in
  isolation), and zero page errors.

---

## Match types played straight — Phase 1 of 2

An audit of every stipulation (asked directly: "are we familiar with all
match types... it has to flow correctly and know how to create drama and
win in multiple fashion") found the win-probability math genuinely correct
for multi-way matches, but the storytelling layer on top thin in five
specific, fixable ways. The user confirmed these needed fixing for real —
"these must play out properly or risk jeopardizing the game," not a
cosmetic pass. This is Phase 1 (mechanics) of a two-phase plan; Phase 2 (a
full hyped-up wrestling-reporter voice rewrite across the whole game, plus
an Americanization pass on some British vocabulary that had leaked into the
setting) is scoped separately and not started here.

- **Finish-flavor text for the 12 stipulations that had none.**
  `Stipulation.finishFlavor` (`data/stipulations.ts`) previously existed
  only on `tables`/`flamingTables`/`casket` — every other gimmick match
  (Steel Cage, Ladder, No-DQ, Hardcore, Street Fight, Last Man Standing,
  Iron Man, Submission, Hair vs Hair, Mask vs Mask, Loser Leaves, Battle
  Royal) fell back to the generic pin/knockout/submission line, so a Ladder
  match's finish read with zero mention of a ladder. All 12 now have their
  own finish text. Along the way, `sim/narrative.ts`'s finish-line assembly
  was routed through the same `fill()` every other beat uses (it previously
  only substituted `{winner}`/`{loser}` by hand), so a stipulation's finish
  line can now use `{weapon}`/`{finisher}`/`{title}` too — hardcore's
  knockout line names a real weapon off the existing `WEAPONS` pool.
- **A real Steel Cage escape.** `FinishType` gained `'escape'`
  (`engine/types.ts`); `sim/kayfabe.ts` biases toward agility/stamina for
  it, same shape as the existing `'ironMan'`/`'submissionOnly'` aim biases;
  `sim/finish.ts`'s `rollFinish` gained an `escape` entry gated to zero for
  every stipulation except Steel Cage, which now sets `aim: 'escape'` and a
  real `finishWeights.escape`, so a cage match can end by pin, submission,
  *or* escaping, same as real cage matches. Confirmed via `rules.aim`'s only
  other consumer (`kayfabe.ts`) that this is fully additive — no other
  system reads `.aim`.
  - Iron Man's existing `finishWeights: { timeLimitDraw: 2.5 }` turned out
    *not* to force a draw on inspection (base pin/submission/knockout
    weights stay live; this just raises the odds) — but when it does land
    on `timeLimitDraw`, the generic "both still standing" line read like an
    ordinary stalemate. Caught and fixed a real correctness trap while
    writing this: the first draft of Iron Man's `timeLimitDraw` flavor text
    claimed a winner "led on the scorecard," which would have contradicted
    the actual mechanical result (`isDrawFinish('timeLimitDraw')` still
    nulls `winnerSide` — no title change, no popularity transfer, rivalry
    heat unmoved). Rewritten to honestly describe a tie framed in Iron Man's
    own vocabulary ("battled dead even on the scorecard... the bell beat
    them both to a winner") instead of asserting a decision that never
    happened in the surrounding systems.
- **The three blowoff stipulations with a real stake now pay it.** `hairVsHair`/
  `maskVsMask`/`loserLeaves` carried `isBlowoff: true`, which only ever
  resolved the rivalry — nobody's hair actually came off, no mask actually
  came off, nobody actually left the roster. New pure `stipulationConsequence`
  (`data/stipulations.ts`, colocated with `stipulationRequirementsMet`/
  `effectiveRules`) maps a stipulation id to `'shaveHead' | 'unmask' |
  'release' | null`; `state/store.ts`'s match-resolution block applies it to
  the loser only on a decisive finish (same test the rivalry system already
  uses) — `appearance.hairStyle = 0` (confirmed 0 is bald), `appearance.mask
  = 0` (confirmed 0 is none), or the exact existing release pipeline
  `releaseWrestler` already uses (`exitTerms(loser, 'fired', ...)` then
  `letThemGo`) — no new release mechanics invented. Each fires a new,
  varied `stipulationConsequenceLine` beat naming what just happened, in the
  hype voice, seeded off the segment+week rather than the shared stream
  (this resolves mid-`resolveWeek`).
- **Battle royal gets a real trickle of eliminations.** Previously every
  multi-way match — triple threat, fatal 4-way, battle royal — resolved as
  one instant `weightedPick` across all sides, so a battle royal didn't
  *feel* different from a fatal 4-way. New pure `engine/sim/battleRoyal.ts`
  (`orderEliminations`) builds a full elimination order by
  weighted-sampling-without-replacement from the sides not yet eliminated,
  weighted by *inverse* win probability — weaker sides tend to go out
  first — until only the pre-decided `winnerSide` remains, appended last.
  This is ordering dressing on a decision already made: it reuses
  `winProbabilitiesBySide` `simulateMatch` already computed and never
  overrides `winnerSide`, so the win/loss math is provably unchanged (no
  balance-probe run needed — noted explicitly so the omission reads as a
  decision, not an oversight). Two new beat pools in `data/matchBeats.ts`
  (`BATTLE_ROYAL_MIDDLE_BEATS`, `BATTLE_ROYAL_FINAL_BEATS`) name a
  mid-field elimination and a "down to the final two" moment — placed
  *ahead* of the rating-gated hopeSpot/nearFall/bigSpot beats in
  `narrative.ts`'s budget, not after, since a first draft put them after
  and a real test run showed the beat budget getting exhausted by the
  optional flavor beats before ever reaching the elimination beats on an
  ordinary-rated card.
- **Multi-man live commentary stopped mislabeling the field.** `store.ts`'s
  commentary-call setup flattened every side past 0 into one "sideB" group
  — correct for a 1v1 or tag match, wrong for a genuine multi-way, where it
  called a fatal 4-way or battle royal like a tag match against a phantom
  team. `commentary.ts`'s whole vocabulary (`{sideA}`/`{sideB}`, two-corner
  framing) is built around exactly two corners by design; reworking it to
  be N-way aware is a real, separate project, not attempted here. Scoped
  fix: the live two-voice call is now gated to exactly two competitor
  sides — a genuine multi-way gets no live call (same as every rival-show
  match already has) and leans on the now-much-better highlight beats
  instead.
- Verified: `tsc --noEmit` clean; new tests in `stipulations.test.ts` (12,
  including one that every gimmick match but squash now carries its own
  finish text) and `engine/sim/battleRoyal.test.ts` (4, including a
  weighted-elimination-order statistical check); `narrative.test.ts` grew 6
  new cases (escape finish text, `{weapon}` resolving through finishFlavor,
  the Iron Man draw framing, the battle-royal elimination/final-two beats
  firing, and confirming they're absent from an ordinary match). Caught and
  fixed two real regressions in the full suite: a pre-existing
  `gimmickMatches.test.ts` case had assumed hairVsHair had no finish text
  (re-expressed per CLAUDE.md rather than deleted — it now tests the
  fallback path against `squash`, the one stipulation still carrying none,
  and gained a sibling case locking in hairVsHair's new line), and one new
  battle-royal beat line used the idiom "that was all she wrote," caught by
  the pronoun-neutrality guard and rewritten. Full suite: 145 files / 2825
  tests passing. `npm run build` and `npm run sim` both clean. A real
  in-app pass (via the live store, not a mock) forced a card with a battle
  royal, a Hair vs Hair, a Mask vs Mask, a Loser Leaves, a Steel Cage, and
  an ordinary 1v1, then called the real `resolveWeek()` across several
  seeds: confirmed the battle royal produced a genuine mid-field
  elimination beat and a final-two beat with no live commentary generated;
  the Hair vs Hair loser's `appearance.hairStyle` actually flipped to bald
  in world state; the Mask vs Mask loser's `appearance.mask` actually
  zeroed; the Loser Leaves loser was actually removed from the roster and
  landed in the free-agent pool on a decisive finish, and — confirmed on a
  separate seed — correctly did *not* fire when that match rolled a
  non-decisive double-KO draw instead, proving the decisive-only gate
  works both ways; a Steel Cage match rolled a genuine `escape` finish on
  one seed; and the ordinary 1v1 still generated a full live commentary
  call, confirming no regression to the normal two-side path. Zero runtime
  errors across every run.

---

## Americanizing the game's vocabulary — Phase 2a of the reporter-voice rewrite

First sub-pass of the "write it like a hyped-up American wrestling reporter"
rewrite (Phase 2 of the plan started alongside the match-type work above).
Before touching tone, the plan called for a mechanical pass fixing British
vocabulary/spelling that had leaked into an otherwise American-coded
setting — interstate, gas stations, dollar amounts sitting next to tyre,
bonnet, petrol, £, lorry, colour, favour, honour, licence, recognise,
realise. Scoped strictly to text the player actually reads: data-file
content strings (`text`/`blurb`/`label`/`name`/nickname/tweet pools) and
real UI copy (headings, button labels, aria-labels). Internal identifiers,
type fields, and code comments were deliberately left alone — `favouredStyles`
the field, `ColourTemplate` the type, `centre` the React prop, the
`'colour'`/`'flavour'` internal enum values — none of these are ever
rendered as literal text to the player (confirmed for each before leaving
it: no UI file references `VenueKind`'s `'theatre'` or the commentary
`Speaker` union as raw display text), so renaming them would be pure
internal churn with no player-facing benefit and real risk of missing a
call site. The one internal spot that *did* need a fix: `WIRE_KIND_LABELS`
in `engine/world/wire.ts` maps the internal `'honour'` kind to a real
displayed newsfeed badge — the key stayed, the label went from `'Honours'`
to `'Honors'`.

- **Vehicle/roadside vocabulary**: `misfortunes.ts`'s car-trouble pool
  (tyre→tire, bonnet→hood, boot→trunk, petrol station→gas station, hard
  shoulder→shoulder, overturned lorry→overturned truck), plus every other
  `car park` across `misfortunes.ts`, `weather.ts` (four separate weather
  events, including one event's own display `name`), and `weatherCalls.ts`
  → `parking lot`. `ResidencyDeal.tsx`'s two player-visible "no lorry"
  lines → "no hauling"/"no truck", with the matching engine comments in
  `economy/residency.ts` updated for consistency.
- **-our/-ise/-ence/-ence spellings in real content**: `colour`→`color`
  (`matchBeats.ts`, `weather.ts`, `commentaryLines.ts`'s one non-placeholder
  instance), `favour(ing)`→`favor(ing)` (`refereePool.ts`, `weather.ts`,
  `events.ts`, `commentaryLines.ts`), `honour`→`honor`
  (`CrucibleScreen.tsx`'s "Roll of honor" heading, `OfficeScreen.tsx`'s
  "They honor the deal" option label), `recognise`/`realise`→
  `recognize`/`realize` (`misfortunes.ts`, `owners.ts`, `fanVoices.ts`),
  `licence`→`license` (`stands.ts`), `defence`→`defense`
  (`promotionIdentity.ts`'s ladder-belt blurb), `cancelled`→`canceled`
  (`misfortunes.ts`, `weatherCalls.ts`), `travelling`→`traveling`
  (`events.ts`), `Favourite`→`Favorite` (a nickname in `nicknames.ts`),
  `queue`→`line` (`stands.ts`'s concession blurb, `leverage.ts`'s
  negotiating-screen leverage line — the genuine "line of interested
  parties" sense; every other `queue` hit in the codebase is the unrelated
  CS data-structure term and was correctly left alone), `crisps`→`chips`
  (`stands.ts`).
- **`TitleBuilder.tsx`**: both the aria-label and the visible "Colours"
  button label → "Colors" — this one also fixed an existing internal
  inconsistency, since the component's own `data-testid` already said
  `belt-colors-*` in American spelling while the rendered text didn't.
- Deliberately NOT touched, and why: `data/fanVoices.ts`'s lowercase tweet
  register (already Americanized separately, e.g. `£4`→`$4`, but kept its
  deliberate casual/lowercase conceit — that's fan voice, not reporter
  voice, per the plan). `data/gimmicks.ts`'s first-person promo lines
  weren't touched by this pass at all — first-person character voice is a
  separate treatment, scoped for a later Phase 2 sub-pass. `grey` (used
  once, in `casualties.ts`) was left alone — unlike `colour`/`favour`,
  both `grey` and `gray` are genuinely current American spellings, so
  changing it wouldn't fix anything a player would notice.
- Verified: `tsc --noEmit` clean; full suite 145 files / 2825 tests passing
  with zero changes needed anywhere (every edit was either inside a data
  pool with no test pinned to its exact wording, or a UI label with no
  test asserting the old text — checked each one individually before
  editing rather than assuming); `npm run build` and `npm run sim` both
  clean; a real in-app pass starting a fresh game confirmed zero runtime
  errors from the edited pools actually rendering.

---

## The hype-reporter voice — Phase 2b, the match/broadcast cluster

Second sub-pass of the reporter-voice rewrite: swapping the game's
deliberately spare, understated match prose for a vivid, idiomatic,
superlative-heavy American sports-reporter voice — the register the user
actually asked for ("write from the standpoint of a wrestling reporter...
use some flair"). Scoped to the cluster Phase 1's mechanics work already
touched, so this content only gets written in its final voice once, not
written spare and rewritten later.

- **`data/matchBeats.ts`** — every beat pool rewritten: all 10 `OPENING_BEATS`,
  all 48 lines across the 12 `CONTROL_BEATS` styles (powerhouse through
  allRounder), all 4 `HOPE_SPOT_BEATS`, all 5 `NEAR_FALL_BEATS`, all 5
  `BIG_SPOT_BEATS`, all 5 `TITLE_BEATS`, all 4 `GRUDGE_BEATS`, all 5
  `AFTERMATH_BEATS`. `BATTLE_ROYAL_MIDDLE_BEATS`/`BATTLE_ROYAL_FINAL_BEATS`
  needed no rewrite — they were authored directly in this target voice
  during Phase 1, exactly per the plan's intent that new content added
  alongside the mechanics work skip the spare-then-rewrite round-trip.
  `WEAPONS` (a bare noun list, not prose) left untouched.
- **`data/stipulations.ts`**'s 16 `blurb` fields (the marquee-style
  one-liner shown per stipulation, distinct from the `finishFlavor` text
  Phase 1 already wrote in this voice) — all rewritten with more color
  while staying short enough to work as poster copy, not paragraph prose.
- **`data/refereeMisses.ts`** — all 48 lines across the 12 miss types
  rewritten. Verified against `referees.test.ts`'s two real data-integrity
  constraints before and after: every line still contains the literal
  `{ref}` placeholder, and every `needsVictim: true` miss's every line
  still contains `{victim}` — both checked by the existing test suite, not
  just eyeballed.
- **`data/casualties.ts`** — all 22 lines across the 11 injury causes
  rewritten. One incidental fix along the way: the `cut` cause's second
  line used to end on "was grey by the end of it" — replaced with "looked
  like a ghost by the final bell," which is both more vivid and sidesteps
  the grey/gray spelling question entirely rather than picking a side.
- **`data/commentaryLines.ts`** — read in full (895 lines, ~209 templates)
  and deliberately given a lighter touch than the other four files, for a
  specific reason: this file was already the closest thing in the codebase
  to the target voice before this pass started (real present-tense hype
  calling — "ONE, TWO — no! How is {lowThey} still in this?", "ONE, TWO,
  THREE — {winner} has done it!"), and it carries far more structural risk
  than the others — a dense custom placeholder vocabulary
  (`{Top}`/`{topThey}`/`{topTheir}`/`{lowThem}`/`{Win}`/`{loseThem}`, all
  grammatical-agreement tokens with real substitution logic behind them in
  `engine/sim/commentary.ts`) plus a `needs`-fact-gating contract that a
  careless rewrite could silently violate. Punched up only the handful of
  genuinely flat, no-conditions fallback lines in `OPENERS` (the ones that
  have to work for literally any match, so they were written deliberately
  plain) without touching any placeholder token, `needs` array, or other
  structural field anywhere in the file. Flagging this explicitly as a
  scoped, deliberate decision rather than an oversight — the file was
  already carrying the tone the user asked for.
- Verified: `tsc --noEmit` clean throughout (checked after each file);
  `referees.test.ts` (50 tests) and `casualties.test.ts` (29 tests) both
  passed unchanged against the rewritten content, confirming the rewrite
  didn't quietly break either file's placeholder contract; `commentary.test.ts`
  (49 tests) passed unchanged; full suite 145 files / 2825 tests passing
  with zero test edits needed anywhere in this pass; `npm run build` and
  `npm run sim` both clean; a real in-app pass forcing a battle royal, a
  Hair vs Hair, a Mask vs Mask, a Loser Leaves, a Steel Cage, and an
  ordinary 1v1 through the live store (same harness Phase 1 used) confirmed
  the new hype-voice text renders correctly end-to-end with real wrestler
  names substituted in, live commentary still generates for the ordinary
  match, and zero runtime errors.

## Phase 2c: misfortune / incident / wire cluster in hype-reporter voice

Continuing the voice pass (2a Americanization, 2b match/broadcast) into the
next cluster: everything that reports the stuff that happens to people
between shows, and the ~20 inline newsfeed strings written directly inside
`state/store.ts` and `state/slices/*.ts` rather than pulled from a `data/`
pool.

- **`data/misfortunes.ts`** — all 17 `MisfortuneDefinition.lines` arrays
  rewritten (car trouble through infection setbacks), plus
  `RIVAL_WEATHER_CATASTROPHE_LINES`/`RIVAL_NO_SHOW_CATASTROPHE_LINES`. One
  gendered-pronoun slip caught by `pronouns.test.ts` on the first full-suite
  run (`barFight`'s "he was picking a fight with") and fixed to "they were."
- **`engine/world/noShowCall.ts`** — `PULL_SEGMENT_LINES`, `HANDICAP_LINES`,
  `MYSTERY_OPPONENT_LINES` all rewritten, four lines apiece.
- **`data/incidents.ts`** — all 13 incident definitions' three-headline
  pools rewritten, every `${nameOf(x)}`/`${group.name}`/`${manager.name}`/
  `${belt}` interpolation preserved exactly.
- **`engine/world/impromptu.ts`** — the memorial and charity `announcement`
  templates, `afterLine()`, and `familyLine()` rewritten.
- **`engine/career/retirement.ts`** — `RETIREMENT_REASON_TEXT`'s four
  clauses rewritten. Incidentally fixed a pre-existing grammar bug while
  doing it: the clauses follow `${name} has retired. ${reason}`
  (`engine/world/wire.ts`'s `retirementLine`) but started lowercase, reading
  as a sentence fragment after a full stop — the new text is capitalized.
- **`engine/career/hallOfFame.ts`** — `citationFor`'s four citation lines
  given a moderate hype touch (an induction is a celebration, not a
  eulogy, even for the rare posthumous inductee).
- **`engine/career/awards.ts`** — the full end-of-year awards voice: all 8
  `AWARDS` blurbs and every inline citation string in `decideAwards`
  rewritten. This one leans hardest into the hype register of anything in
  the cluster — it's the one system in the game explicitly modeled on an
  actual awards broadcast.
- **`engine/career/mortality.ts` and `engine/career/epitaph.ts` —
  deliberately left untouched.** CLAUDE.md states deaths are "Handled
  soberly: no gore, no spectacle, no in-ring deaths" — `mortality.ts`'s
  `DEATH_CAUSE_TEXT` and `epitaph.ts`'s `whoTheyWere`/`whatTheyLeave`/
  `howTheyWent` (which literally embeds `DEATH_CAUSE_TEXT` and is shared
  between the memorial wall and the Hall of Fame board) are already
  correct by design, not a gap the tone pass should close. Same exception
  class as `gimmicks.ts` (first-person) and `fanVoices.ts` (tweet
  register) getting different treatment — flagged explicitly rather than
  silently skipped. The same solemnity call was applied to the handful of
  title-memorial wire lines in `state/slices/titles.ts` that fire in the
  direct wake of a champion's death (`answerTitleMemorial`'s three
  outcomes) — left in the existing plain register rather than hyped up.
- **~25 inline `wire(...)` template strings across `state/store.ts` and
  `state/slices/{titles,showAndProduction,storylines,supershow,
  rosterAndContracts,cup}.ts`** rewritten in place — residency deals,
  title strips/vacates/renames, faction joins/departures, contract
  expiries and poaching, house-show and dark-match recaps, story
  heat/death, Crucible tournament recaps, and more. Two of these needed a
  second pass after the full suite caught them: `poaching.store.test.ts`
  and `renewalWindow.store.test.ts` both assert on an exact substring
  (`'never answered'`, `'won them on the open market'`) inside a wire
  line's text, and the first hype rewrite of those two lines lost the
  literal phrase the tests were checking for — re-expressed to keep the
  hype color while preserving the exact matched substrings, per CLAUDE.md's
  re-express-don't-re-baseline rule (the tests were right; the rewrite was
  wrong).
- Also touched two engine helper functions that generate wire text outside
  any `data/` pool: `engine/sim/freshness.ts`'s `goneStaleLine`/
  `goneIceColdLine` (gimmick heat going cold/dead) and
  `engine/sim/casualties.ts`'s `aggravationLine` (working hurt and making
  it worse) — same cluster in spirit even though they're not in the
  original file inventory.
- **Explicitly deferred, not in this pass:** `career/discipline.ts`'s
  sanction notes (`sanction.note`, `suspensionLine`) referenced from two
  spots in `store.ts`, and the `fieldLine`/`result.line` helpers backing
  the Crucible tournament recap in `state/slices/cup.ts` — both generate
  text from a data/logic file outside the originally inventoried list and
  were left as a follow-up rather than scope-creeping this pass further.
- Verified: `tsc --noEmit` clean; full suite 145 files / 2825 tests
  passing (two failures found and fixed on the first full run, both
  substring-match regressions described above, plus the one gendered-
  pronoun catch); `npm run build` and `npm run sim` both clean.

## Phase 2d: promo / confrontation / event cluster in hype-reporter voice

The promo, confrontation, and creative-event systems — the game's other big
narrator-voiced surfaces, plus its one substantial first-person-dialogue
surface.

- **`data/promoTopics.ts`** — all 10 `PROMO_TOPICS`' `effect`/`cost` fields
  punched up (kept short — these are decision-panel copy, not prose, same
  treatment `stipulations.ts`'s `blurb` fields got in 2b) and all 24 lines
  across the 4 `PROMO_LINES` quality bands rewritten in full reporter
  voice, `{speaker}` preserved throughout.
- **`data/confrontations.ts`** — all 9 `CONFRONTATIONS`' `blurb` fields and
  27 `openers` lines rewritten, and all 10 `CONFRONTATION_TWISTS`' 30
  `lines` rewritten; every `{a}`/`{b}`/`{c}` placeholder preserved exactly
  (verified by placeholder-count grep before and after: 44/47/10
  occurrences, unchanged). Twist `label` fields (short results-page tags
  like "And that was that") and event `title` fields (short narrator
  headlines like "{primary} was late again") were deliberately left as-is
  — same precedent as leaving stipulation names and award names alone
  while their `blurb`/citation prose got the full treatment: these are
  functional labels, not the prose doing the narrating.
- **`data/events.ts`** (1,169 lines, the largest single narrative file) —
  all 21 creative events and both branching sub-nodes (`gimmickRequest`'s
  `debut`, `wantsTitleShot`'s `howBig`, `workingHurt`'s `aftermath`,
  `trainingInjury`'s `setback`) rewritten: every `body` array (narrator
  prose for the 6 `speaker: 'narrator'` events, first-person dialogue for
  the other 15 `speaker: 'primary'` events and their nodes) and every
  option's `gains`/`costs` pair. First-person events got more color and
  idiom *within* first-person voice per the plan's explicit carve-out —
  not converted to third-person reporter narration. Two inline `wire()`
  text strings inside gamble effects (the `gimmickRequest`/`debut` dark-
  match phone-video line) rewritten too. `title` fields left alone, same
  reasoning as above. `effects`, `gamble`, `next`, `conditions`, `weight`,
  and `cooldownWeeks` — every mechanical field — untouched.
- `events.test.ts` has no string-content assertions (only structural ones:
  option counts, body-variant counts, placeholder-reachability, gains/costs
  non-empty, effect-negativity), so this was a lower-risk rewrite than
  Phase 2c's inline wire strings — confirmed by re-reading the test file in
  full before starting rather than discovering it the hard way.
- Verified: `tsc --noEmit` clean; full suite 145 files / 2825 tests passing
  with zero test changes needed; `npm run build` and `npm run sim` both
  clean; placeholder-integrity re-checked by grep count before/after on all
  three files rather than a live-app pass this round, since every edit was
  a pure string-literal change to fields the existing structural test suite
  already covers exhaustively and no logic, effect, or branching field was
  touched.

## Phase 2e: world-flavor cluster in hype-reporter voice

The broadest sub-phase by file count: everything that gives the game world
its texture — venues, weather, ownership, championships, production,
concessions, broadcasters, sponsors, residencies, the ringside/referee
pools, and the world's taste-geography systems.

- **`data/venues.ts`** — all 25 venue `blurb` fields rewritten.
- **`data/weather.ts`** — all 33 `WEATHER_EVENTS`' `lines` and `warnings`
  rewritten (flavour/minor/notable/severe/catastrophe tiers), `{town}`
  preserved throughout.
- **`data/weatherCalls.ts`** — `WEATHER_CALL_OPTIONS` gains/costs,
  `FORECAST_LINES` (kept free of digits and `%`, per
  `weatherCall.test.ts`'s constraint), and all 25 `WEATHER_CALL_LINES`
  outcome strings across the 5 severe events rewritten.
- **`data/owners.ts`** — all 5 owner `blurb`s (narrator voice) and
  `greetings` (first-person, more color within character) rewritten, plus
  every `MANDATE_TEXT` entry, `{target}`/`{value}` preserved.
- **`data/titles.ts`** — all 28 title blurbs across `startingBlueprints`
  and `TITLE_PRESETS` rewritten (several are literal duplicates shared
  between the two, caught and rewritten consistently via `replace_all`).
- **`data/promotionIdentity.ts`** — every archetype's `knownFor`,
  `topBeltBlurb`, `secondaryBeltBlurb`, and `signatureBelt.blurb`
  rewritten (8 archetypes × 4 fields). Caught a real Americanization miss
  from Phase 2a along the way: `knownFor: 'Armouries...'` and a matching
  comment — fixed to "Armories" as part of this pass.
  `favouredStyles`/`preferredStyles` (internal field/prop names) left
  alone per the established "only touch player-visible text" rule.
- **`data/production.ts`** — all 10 `PRODUCTION_ASSETS` and all 12
  `SHOW_EXTRAS` blurbs rewritten.
- **`data/stands.ts`** — all 9 `MERCH_LINES` and 4 `CONCESSIONS` blurbs
  rewritten. Also caught and fixed a Phase 2a miss: `'Programmes'` (the
  displayed name) → `'Programs'` — the internal id `programmes` was left
  alone as an identifier, not player-facing text.
- **`data/broadcasters.ts`** — all 4 `BROADCASTERS` blurbs and all 9
  `BroadcastDemand.text` lines rewritten; fixed `'the fishing programme'` →
  `'the fishing program'` in the same pass.
- **`data/sponsors.ts`** — all 5 `SPONSORS` blurbs and 4 condition `text`
  lines rewritten; fixed `'cheque'` → `'check'` along the way.
- **`data/residencies.ts`** — all 8 `RESIDENCY_HOMES` blurbs rewritten;
  fixed `'holiday town'` → `'vacation town'`.
- **`data/ringsidePool.ts`** — all 12 named managers' blurbs rewritten.
- **`data/refereePool.ts`** — all 12 named referees' blurbs plus all 12
  `REFEREE_BLURBS` (excellent/decent/poor/crooked × 3) rewritten; fixed
  `'rumours'` → `'rumors'`.
- **`data/circuits.ts`** — all 4 `CIRCUITS`' `blurb` and `hardSell` fields
  rewritten; fixed `'phoney'` → `'phony'`.
- **`data/territories.ts`** — all 12 `TERRITORIES` blurbs rewritten;
  fixed a second `'phoney'` → `'phony'` instance here too.
- **`data/perks.ts`** — all 8 `PERKS`' `blurb` and `cost` fields rewritten.
- **`data/biddingTemperaments.ts`** — reviewed; contains only short
  mechanical `label` fields (e.g. "chases names", "pays for grit"), same
  treatment as twist/award labels elsewhere — deliberately left as-is,
  not a gap.
- **`data/storylineBeats.ts`** — `MATCH_BEAT_LINES` (the most-read text in
  the storyline system) rewritten, `{who}` preserved.
  `STORYLINE_NAME_PATTERNS` left alone — short generated titles, same
  precedent as event titles and twist labels.
- Several genuine Phase 2a Americanization misses were caught and fixed
  incidentally while rewriting adjacent prose in this pass (armouries,
  programmes/programme, cheque, holiday town, rumours, phoney×2) — noted
  here rather than filed as a separate pass since they were touched
  in-line with content already being edited.
- Verified: `tsc --noEmit` clean after every file; full suite 145 files /
  2825 tests passing with zero test changes needed; `npm run build` and
  `npm run sim` both clean.

## Phase 2f: gimmick character-voice cluster, first-person treatment

The largest single content pool in the game (~779 strings across two
files), and the one place in the voice sweep where "hype-reporter voice"
explicitly does not apply — this is in-character wrestler dialogue, not
narrator prose, and the plan calls for more flair *within* first-person
voice rather than converting it to third-person reporter narration.

- **`data/gimmicks.ts`** — every `GimmickSeed.promoLines` entry across all
  ~190 gimmicks rewritten: punchier, more idiomatic first-person promo
  dialogue (added intensifiers — "absolutely", "genuinely", "flat-out",
  "every single", "not one" — and traded flat statements for the kind of
  line a real promo would actually deliver), while keeping each
  character's persona intact per its `concept`. Entries that started with
  an empty `promoLines: []` (silentMonster, gironGrip, gbellToBell,
  goldReliable, gsecondGear, gtheQuietType, glocalFavorite) were left
  empty — that silence is the character.
  - **`concept` deliberately left untouched.** It reads as tight,
    already-vivid third-person catalog/scouting-report prose — closer to
    the target register already than the flat prose this whole project
    exists to fix — and rewriting it into reporter narration would
    directly contradict the plan's "first-person treatment, not
    third-person reporter narration" instruction for this cluster. Same
    call as Phase 2b's partial touch on `commentaryLines.ts`: content
    already close to the target gets left alone rather than risked on a
    rewrite it doesn't need. `id`, `name`, `category`, `alignmentLean`,
    `prop`, and the Classic-set's mechanical fields (`popularityCeiling`,
    `growthRateMultiplier`, `territoryFit`, `merchMultiplier`, `look`) are
    untouched as well — none of them are prose.
  - Worth flagging: `concept` **is** player-facing (rendered as the
    `subtext` in `OfficeScreen.tsx`'s `DialogueCard` at the signing,
    relaunch, and group-formation dialogues), but `promoLines` is
    currently **not wired into the UI or referenced by any engine logic**
    anywhere — confirmed by grep across `src/ui`, `src/state`, and
    `src/engine`, turning up only the type definition in `types.ts` and a
    `Pick<...>` reference in `gimmickDefaults.ts`. The rewrite still
    covers it in full per the plan's explicit naming of `promoLines` as
    in-scope content, on the basis that it's real content waiting on a
    UI hookup rather than dead weight.
- **`data/groupGimmicks.ts`** — same first-person treatment applied to
  every non-empty `promoLines` entry across the 22 tag-team identities
  (the 15 faction/`stable` entries all carry empty `promoLines` in the
  source data — a shared identity speaking with one voice doesn't fit a
  faction the way it fits a duo, so that was left as-is rather than
  invented). `concept` left untouched for the same reason as above.
  - Caught two unescaped-apostrophe syntax errors introduced by the
    rewrite itself (`you're`, `you've` inside single-quoted string
    literals) via `tsc --noEmit` immediately after the edit — fixed by
    escaping them properly before moving on to verification.
- No test file constrains `concept` or `promoLines` content in either
  file, so this was a zero-test-risk content rewrite.
- Verified: `tsc --noEmit` clean; full suite 145 files / 2825 tests
  passing with zero test changes needed; `npm run sim` clean (300-name
  roster generation, distributions unaffected — gimmick prose has no
  mechanical weight); `npm run build` clean.

## Phase 2g: fan-voice cluster, lowercase tweet register kept

`data/fanVoices.ts` is the other deliberate carve-out in the voice plan —
simulated fan tweets, not narrator prose or in-character dialogue. Kept
the lowercase/casual tweet conceit throughout; punched up the energy
*within* that register (added intensifiers, repeated words for emphasis,
occasional all-caps for shouted lines, more idiomatic phrasing) rather
than converting it to reporter voice or capitalizing it into normal prose.

- All of `SHOW_TWEETS`, `MATCH_TWEETS`, `TITLE_CHANGE_TWEETS`,
  `GIMMICK_DEBUT_TWEETS`, `GIMMICK_PAIRING_TWEETS`, and
  `GIMMICK_RELAUNCH_TWEETS` rewritten. `FAN_HANDLES` untouched — those are
  identifiers, not prose. All placeholders (`{winner}` `{loser}` `{best}`
  `{worst}` `{champ}` `{title}` `{promotion}` `{name}` `{gimmick}`)
  preserved.
- Caught a genuine Phase 2a Americanization miss in the same pass:
  `'apologising'` → `'apologizing'` in one contrarian-tone tweet.
- `CROWD_VERDICTS` rewritten, with one exception:
  `fanReaction.test.ts`'s `'reads the room'` test asserts
  `crowdVerdict(75)` with an exact `toBe('They loved it.')` — the initial
  rewrite changed that string and broke the test, caught immediately on
  the first suite run. Per the standing "re-express tests, never
  re-baseline them" rule, the fix was to restore the literal string,
  not touch the test — the other four `CROWD_VERDICTS` entries and every
  tweet pool were free to change since nothing else in the suite
  constrains exact fan-voice text.
- Verified: `tsc --noEmit` clean; full suite 145 files / 2825 tests
  passing after the one-line revert above; `npm run sim` and
  `npm run build` both clean.

## Phase 2h: UI-layer prose, hype-reporter voice

The last sweep of the voice project — full-sentence empty states, tooltips, and onboarding copy hardcoded
directly in `src/ui/screens/*.tsx` and shared components, done last so it matches the register the data-file
passes had already locked in.

- Swept every screen and shared component under `src/ui/` for hardcoded full-sentence prose (grepped for
  long quoted sentences and `<p className>` blocks, then manually triaged each hit). Rewrote genuine narrator
  prose — empty states, tooltips, dialogue-panel copy, onboarding text — in the hype voice across
  `LegacyScreen.tsx`, `RankingsScreen.tsx`, `Stories.tsx`, `RosterScreen.tsx`, `OfficeScreen.tsx` (by far the
  largest single file, ~30 separate strings), `PromotionScreen.tsx`, `BiddingWar.tsx`, `BookingScreen.tsx`,
  `Nav.tsx`'s `MORE` screen blurbs, `NewGameScreen.tsx`, `SecretsScreen.tsx`, `FileTransfer.tsx`,
  `FreeAgentsScreen.tsx`, `RivalRosterScreen.tsx`, `CrucibleScreen.tsx`, `DarkMatchSlots.tsx`,
  `Supershow.tsx`, `FinanceScreen.tsx`, `Cup.tsx`, `ResidencyDeal.tsx`, `TitleBuilder.tsx`,
  `TerritoriesScreen.tsx`, `SheetScreen.tsx`, `RecordsScreen.tsx`, `WrestlerEditor.tsx`, `PromoSlots.tsx`,
  `CalendarStrip.tsx`.
- Left alone, per the plan's explicit scope line ("Short UI chrome... stays out of scope"): button labels,
  stat names, short instructional fragments ("Pick one partner."), and every field already sourced from a
  `data/*.ts` file rewritten in an earlier sub-phase (venue/perk/production blurbs rendered as-is by these
  screens needed no second touch).
- Left alone deliberately, on the same solemnity exception as Phase 2c: the two death-adjacent lines in
  `OfficeScreen.tsx` (the title-memorial panel) and `FreeAgentsScreen.tsx` ("died in this company's ring") —
  same class as `mortality.ts`/`epitaph.ts`.
- **Found and fixed a genuine gap from earlier phases**: `data/worldPresets.ts` — the four starting-scenario
  blurbs shown on the very first screen of the game — was never in the original file inventory for Phase 2a
  or 2e, so it was still carrying both the old spare voice and two literal British spellings (`armoury`,
  `rumour`) that Phase 2a's sweep should have caught. Rewritten in full: hype voice plus the Americanization
  fix, discovered via a live-app screenshot during this phase's verification pass rather than a grep, which is
  the reason a browser pass earns its place in the verification bar even for a "just prose" phase.
  `worldPresets.test.ts` only asserts string lengths, not exact content, so this was a zero-test-risk fix.
- Verified: `tsc --noEmit` clean; full suite 145 files / 2825 tests passing with zero test changes needed;
  `npm run sim` and `npm run build` both clean; a live dev-server + Playwright pass through the new-game flow
  (all three steps) and into the Booking and Roster screens confirmed every rewritten string renders without
  truncation or layout breakage, and is what caught the `worldPresets.ts` miss above.

This closes out the full hype-reporter voice project (Phases 2a-2h). The two deliberate carve-outs from the
original plan stand as documented in their own phases: `data/gimmicks.ts`/`data/groupGimmicks.ts` stay
first-person in-character voice (Phase 2f), and `data/fanVoices.ts` stays in its lowercase tweet register
(Phase 2g). Death-adjacent content across the whole codebase stays in the sober register it started in.

## Named the game, and gave it a real front door

The game had no name and booted straight into the three-step new-game wizard — no branding, no way to turn
motion off, nowhere to manage a save without already being mid-game. Fixed all three, plus a real bug found
along the way.

- **Named it**: Rival Promotions — Wrestling Booker Edition. `index.html`'s `<title>` and the single-file
  build script's hardcoded (and stale — leftover "TAW") title both updated. *(Renamed again, see below.)*
- **`src/ui/screens/TitleScreen.tsx`** (new) — the actual entry point now. Shows the logo (user-supplied art;
  vetted for trademark issues before use — an earlier draft reproduced WWE's championship-belt logo elements
  and was rejected and regenerated), then `Continue` (only when `savedGameSummary()` finds a save, showing the
  promotion name and week), `New Promotion`, and `Settings`. The logo is framed as a deliberate plaque
  (rounded corners, hairline gold border, shadow) rather than trying to fake transparency against its flat
  charcoal source background — a mask-based fade was tried first and just made the hard edge fuzzy instead of
  gone.
- **`src/ui/screens/SettingsScreen.tsx`** (new) — reachable from the title screen before a save exists, and
  from the in-game More list once one is running. Same component either way; the save-file import/export
  section (`FileTransfer`) simply doesn't render without a `world`. Covers: reduce-motion toggle, erase-save
  (with a confirm and no undo), and an about/credits block.
- **`src/ui/reducedMotion.ts`** (new) — localStorage-backed override on top of the OS
  `prefers-reduced-motion` signal, read by both `TitleScreen` and `App.tsx` before applying the settle-in
  animation added in the design-system pass.
- **`App.tsx`** — pre-world routing is now a small local state machine (`title` / `newGame` / `settings`)
  instead of a bare `if (!world) return <NewGameScreen />`. `settings` added to `Nav.tsx`'s `Screen` union and
  `MORE` list so it's reachable mid-game too.
- **Real bug found and fixed, pre-existing and not introduced by this pass**: `NewGameScreen.tsx`'s root
  div had no background color. It happened to be invisible before because nothing else rendered before a
  world existed except this screen — but it meant the heading and body copy were pale text on the browser's
  white default the entire time, not the dark background every screenshot of it seemed to show once other
  dark UI elements filled most of the viewport. Caught via a direct Playwright screenshot + a
  `getComputedStyle` check on `body`/`html` (both transparent) while verifying the new `SettingsScreen`, which
  had the identical bug from being written the same way. Both now set `min-h-screen bg-neutral-950` on their
  root, the same as `TitleScreen`.
- **Asset-inlining bug found and fixed**: the title logo (a ~360KB JPEG) was imported with a `?inline` query
  suffix, following the sprite atlas's apparent convention — but `?inline` does not actually force base64
  inlining in the installed Vite version (5.4.21). Every atlas sheet inlines only because each one happens to
  sit under Vite's default 4KB auto-inline threshold; `?inline` on an asset above that threshold instead
  leaves a real `/assets/...jpg?inline` URL — hosted-fine (servers ignore the stray query string) but
  completely broken in the `npm run play` single-file output, which has no server to resolve that URL
  against. Fixed properly by raising `build.assetsInlineLimit` to 1MB in `vite.config.ts`, confirmed by
  grepping the built bundle for `data:image/jpeg;base64` (0 → 1 occurrence) and for a lingering `/assets/`
  reference (1 → 0) before and after. `scripts/single-file.mjs`'s comment, which incorrectly credited
  `?inline` for the atlas's inlining, corrected to name the real mechanism.
- Verified: `tsc --noEmit` clean; full suite 145 files / 2825 tests passing with zero test changes needed;
  `npm run sim`, `npm run build`, and `npm run play` all clean; a live dev-server + Playwright pass covering
  the title screen with and without a save, the full new-game flow, Settings from both entry points, and a
  page reload to confirm `Continue` correctly picks up a save written in a prior session.

---

## Equipment economy, Phase 1 of 5 — the Backyard start, and Festival as a venue

Player asked for a genuinely lowest starting point (ten wrestlers, five and five, almost no money,
a bad ring in a backyard) plus a much deeper equipment economy — ring tiers, barricade tiers, camera
tiers, truck upkeep, equipment-gated match types — building out from that floor. Full 5-phase plan
at the top of this session; this ships phase 1 alone, which the plan calls out as the one to land
before anything else, since later phases only matter once there is a genuinely bad starting ring to
improve on.

- **`engine/types.ts`**: `WorldPresetName` widened to add `'backyard'`. `WorldSettings` gets two new
  optional fields, `startingVenueId?: Id` and `startingTerritoryId?: Id` — unset for every existing
  preset, so nothing about the other four changes.
- **`data/venues.ts`**: two new venues. `backyardRing` — capacity 60, `rentalCost: 0`, `outdoor: true`,
  the worst production capacity and atmosphere in the list — is the actual floor `backyard` opens on.
  `festivalGrounds` — capacity 4,200, `outdoor: true`, a real mid-tier venue the player grows into by
  choice later through the ordinary venue picker, not a starting point for anyone.
- **`state/world.ts`**: `defaultShowSetup()` now checks `settings.startingVenueId`/`startingTerritoryId`
  first and only falls back to the existing algorithmic venue/territory derivation when either is unset
  — every existing preset takes the exact same path it always did. `backyardRing` is genuinely
  `outdoor: true` (a backyard has a sky over it) rather than faking it indoor to slip through
  `bestFittingVenue`'s indoor-only filter, since the new override makes that workaround unnecessary — a
  deliberate improvement on the plan's original literal suggestion.
- **`engine/world/settings.ts`**: the `backyard` `WORLD_PRESETS` entry — $8,000 cash (below Territory
  Days' $25,000, the new floor), 10-wrestler roster at an exact 5/5 split (`womensDivisionFloor: 5`,
  the max `divisionSplit` can support at this size), `tagTeamsMin: 3` so a real tag division still
  fits, rating 12 and following 10 (nobody outside the block has heard of you), pinned to
  `backyardRing` in `brambleHollow` (the smallest, most locally-loyal territory on the map),
  `chaosLevel` at the top of the scale.
- **`data/worldPresets.ts`**: matching `WORLD_PRESET_INFO` entry, plus a real stale-data bug fixed
  while touching the file — `sinkOrSwim`'s blurb said "Fourteen wrestlers" when the setting has always
  read 24.
- **`ui/screens/NewGameScreen.tsx`**: default preset selection changed from `standard` to `backyard`,
  per the player's explicit ask ("I want the default selection to be at the bottom") — `backyard` sits
  last in the picker (`WORLD_PRESET_INFO` is rendered in array order) and is now also the one selected
  on load.
- **Tests, re-expressed rather than weakened**: `backyard` cannot clear several of the existing
  cross-preset assertions in `worldPresets.test.ts` (`startingRosterSize >= 24` chief among them) —
  those assertions are real and correct for the other four presets, so per CLAUDE.md `backyard` gets
  its own `describe` block with its own re-expressed claims (exact roster size and split, exact tag
  team count, opens in `backyardRing`, is the lowest-cash/least-known/most-chaotic of the five)
  instead. The hardcoded `IDS` array and the existing four-preset tests are untouched. Two pre-existing
  tests broke from the new venue and needed re-expressing, not weakening: `venues.test.ts`'s
  `bestFittingVenue` fallback check assumed the first entry in `availableVenues()` was always the
  smallest *indoor* room, which stopped being true the moment an outdoor `backyardRing` sorted first —
  fixed to explicitly filter to indoor rooms, matching what `bestFittingVenue` itself actually falls
  back to. `residency.test.ts` compared residency rent against the cheapest venue's rental cost, which
  broke outright once that cheapest venue was free — fixed to compare against the cheapest *rentable*
  room, since a backyard nobody charges rent on was never "a room you could tour" in the sense that
  test meant.
- **Balance, checked live rather than asserted in a test** (CLAUDE.md: measure in a played save):
  played a full backyard opening through the actual UI. Ten wrestlers generated 5/5 as expected, the
  card required real triage to fill (`"Only 10 can work — not enough for a card of 6"`), and the first
  show ran live from Bramble Hollow with a starting rating of 12 exactly as configured. The auto-filled,
  no-roster-triage run went $867 into the red in week one — payroll for a full ten-person roster
  (~$8,800/wk) dwarfing anything a 60-seat yard can gross is real and expected, not a bug: wage
  generation isn't scaled to company rating anywhere in the codebase, for any preset, so the entire
  point of this starting position is that the player cannot actually afford the roster they opened
  with. Confirmed this is a real decision and not a guaranteed-loss cutscene by reading the fold logic
  in `store.ts`: `weeksInTheRed` only counts *consecutive* red weeks, resets to 0 the instant a week
  closes non-negative, the default grace period is 4 weeks, releasing an over-guaranteed contract
  costs real severance but plenty of the opening roster generates as "Free to cut," and the bank offers
  a loan before the grace period actually runs out. A player who triages the roster in week one or two
  can flip a week positive and reset the clock indefinitely; a player who does nothing folds inside a
  month — exactly the kind of harder, more interesting decision CLAUDE.md's own tie-break rule asks
  for, not the "twelve wrestlers on 8k, folded by week nine even playing perfectly" cutscene pattern it
  warns against.
- Verified: `tsc --noEmit` clean; full suite 145 files / 2,829 tests passing (2 pre-existing tests
  re-expressed as described above, zero baselines lowered); `npm run sim` clean; `npm run build` clean;
  a live dev-server + Playwright pass through the full new-game flow on `backyard` confirming the
  default selection, the roster size and split, the pinned venue and territory, and a full first show
  resolving end to end.

---

## Equipment economy, Phase 1 follow-up — real starter wages, and the day job that comes with them

Player follow-up on the Backyard preset above: "maybe the starting 10 should be paid much less...
no stars....just do what they love. maybe they have normal jobs and that could phase into some
problems? had to stay at work late, etc? but pay them very little but they get the promotion going."
This also happened to fix a real balance problem the live playtest in the entry above surfaced —
payroll for a full ten-person roster (~$8,800/wk) dwarfing anything a 60-seat yard could gross, which
was surviving on the "player must triage the roster" escape hatch alone. Real starter wages close most
of that gap directly, and the day-job wrinkle gives the underpaying itself a mechanical cost rather
than being a free lunch.

- **`engine/economy/contracts.ts`'s `askingRate`** was already fully driven by `WorldSettings`
  (`contractBaseWeeklyRate`, `contractRateRange`, `contractRateCurve`, `contractDrawWeight`,
  `contractCraftWeight`) — no new mechanism needed, just a preset that actually uses the knob. Added
  `contractBaseWeeklyRate: 15` and `contractRateRange: 300` to the `backyard` preset (defaults: 60 and
  2,200). A typical wrestler now asks for pocket change instead of several hundred a week, and the one
  genuine standout on a generated roster still visibly costs more than everybody else — the curve just
  now operates on much smaller numbers, so the relative signal ("this one might actually be worth
  something") survives even though the absolute numbers don't read as anybody's living.
- **`engine/types.ts` / `engine/world/settings.ts`**: two new `WorldSettings` fields,
  `dayJobWageThreshold` (150, default) and `dayJobAbsenceChance` (0.05/week, default) — global, not
  backyard-specific, so any future cheap signing anywhere in the game inherits the same rule rather than
  this being a preset flag bolted on the side.
- **`data/misfortunes.ts`**: `MisfortuneDefinition` gets an optional `dayJob?: boolean` field, and four
  new `kind: 'absence'` entries tagged with it — held late at the register, nobody could cover the
  shift, a called-in-sick cover story falling apart, out of PTO. Same voice, same shape as the existing
  absence pool (car trouble, missed flights, family emergencies), reusing 100% of the existing
  `MisfortuneDefinition`/weighted-draw/line-variety machinery rather than inventing a parallel one.
- **`engine/world/misfortune.ts`**: new `rollDayJobAbsence(wrestler, week, settings, usedLines)` —
  eligible only for a wrestler whose whole weekly ask (`contract.weeklyRate + contract.perAppearance`)
  sits under `dayJobWageThreshold`; anyone above it, or with no contract at all, returns `null` before
  anything is rolled. A deliberately *separate* gate from the existing `rollMisfortune`'s
  `misfortuneChanceHealthy` roll rather than one more entry competing for a slice of that already-rare
  pool — being underpaid is a standing fact about how somebody is paid, not bad luck, and CLAUDE.md's
  own precedent (`misfortuneChanceHealthy` vs `misfortuneChanceInjured` are already "two separate gates,
  because they are separate risks") argues for the same shape here, a third one.
  - **RNG-safety, the trap CLAUDE.md calls out by name**: seeded per-wrestler-per-week
    (`rngFromSeed(\`dayJob:${wrestler.id}:${week}\`)`) rather than drawn off the shared stream `rng`
    parameter every other roll in `resolveWeek` shares. The eligibility check runs *before* any roll —
    for the four existing presets, essentially every generated wrestler clears $150/wk, so the function
    returns `null` without ever touching randomness, shared or otherwise, and nothing about their
    behavior changes at all. But a stray cheap rookie could theoretically clear the bar even under
    default settings, and drawing from the shared stream in that case would have silently shifted every
    seeded roll downstream of them — confirmed this is not hypothetical, since even the *default* wage
    curve prices a genuinely weak rookie under $80/wk. Seeding from the entity instead makes the whole
    question moot.
- **`state/store.ts`**: wired into the same per-person weekly loop as the existing misfortune roll —
  `rollMisfortune(...) ?? rollDayJobAbsence(...)`, so the day job only gets a look when nothing else
  already took someone out of the building that week, and everything downstream (the newsfeed line, the
  mystery-opponent/no-show handling, the wire) is the exact same code path absences already went
  through — no new UI, no new consumer, a pure content addition to a pipeline that already existed.
- **Tests**: `misfortune.test.ts` gets a full `describe('the day job', …)` block (never fires above the
  wage threshold, never fires with no contract, never fires on top of an existing injury, fires at a
  real-but-bounded rate for an underpaid roster over a season, stable for the same wrestler/week pair,
  varies its line across weeks, leaves the dead and retired alone) plus one addition to the existing
  library-shape checks (every `dayJob` entry is an `absence`, and at least one exists).
  `worldPresets.test.ts`'s `backyard` block gets one more test: a 200-wrestler sample's mean
  `backyard` ask is under a quarter of the same sample's mean `standard` ask, and more than half of it
  actually clears into day-job territory — checked against the *other* preset's own live settings, not
  a hardcoded number, so it stays honest if either curve is retuned later.
- **Verified live, not just in tests** (CLAUDE.md: measure in a played save): a fresh backyard roster's
  weekly wage bill dropped from $8,835/wk (the number in the entry above) to $620/wk — individual rates
  ranged $15-215/wk. Played 20 simulated weeks through the actual UI (fill card, run show, repeat) and
  the day-job absence fired and read correctly in the write-up: *"Tex Zane's manager would not let the
  shift end on time, and there was no getting to the building after that. Delilah Duvall went out there
  instead."* — flowing through the existing mystery-opponent replacement system exactly as intended.
- Verified: `tsc --noEmit` clean; full suite 145 files / 2,838 tests passing (9 new, zero re-expressed,
  zero baselines touched); `npm run sim` clean; `npm run build` clean; the live playtest above.

---

## Equipment economy, continued — Phase A: the hiring loop

First phase of an expanded plan (`/root/.claude/plans/synthetic-plotting-planet.md`) growing out of two
more follow-up conversations: card size should be its own purchase, decoupled from venue and gear, and
every purchase in this whole system needs a real upside *and* every cheap tier a real, occasionally-visible
downside — not a number moving quietly, an actual thing that happens and gets its own sentence in the
write-up. This phase is the roster-side half: `backyard` stops auto-signing a full ten-person roster and
instead hands the player almost nothing, making the actual hiring the first real decision.

- **`engine/types.ts`**: new optional `WorldSettings` field, `startingPlayerRosterSize?: number` —
  unset for every preset except `backyard` (`2`). Every other preset is byte-for-byte unaffected;
  rivals are untouched, since they've always sized off the separate `rivalRosterSize()` function.
- **`state/world.ts`**: both roster-generation paths (the plan-based `buildPlannedPromotion` and the
  plain single-promotion procedural path — confirmed via research that the common "Surprise me,
  one promotion" flow actually runs the *procedural* path, not the planned one, so both genuinely
  needed the same fix) now read `settings.startingPlayerRosterSize ?? settings.startingRosterSize`
  for the player. `crownOpeningChampions`/`formTeams` were confirmed tolerant of a tiny 2-person
  roster before relying on it — both already degrade gracefully (fewer champions crowned, zero tag
  teams formed) rather than crashing; a 2-person, 1-and-1 divisionSplit roster plays fine from
  week one.
- **`engine/world/settings.ts`**: `backyard`'s `startingRosterSize: 10` is kept as the shape the
  *free-agent pool* is still tuned against (`womensDivisionFloor`, `tagTeamsMin`), now genuinely
  read through `generateFreeAgentPool` instead of the signed roster.
- **A real bug found live, not in a test**: with the seed roster this small, a fresh backyard
  free-agent pool put a **$1,275/wk manager next to $50/wk wrestlers**. Root cause:
  `engine/world/managerTalent.ts`'s `seedManagerTalent` prices a manager's weekly ask off
  `archetype.feePerShow * settings.managerTalentFeeToWage` — a flat, per-show fee
  ($300-$1,400 in `data/ringsidePool.ts`) that doesn't shrink with the rest of this economy the way
  `contractBaseWeeklyRate`/`contractRateRange` now do for ordinary wrestlers. Fixed the same way:
  `managerTalentFeeToWage: 0.15` added to the `backyard` preset (default stays 0.9 everywhere
  else), bringing the whole pool into a coherent $25-$250/wk range, confirmed live and locked with a
  new test comparing every manager's ask against the pool's most expensive wrestler.
- **`data/worldPresets.ts`**: `backyard`'s blurb/squeeze rewritten around hiring from a free-agent
  pool rather than "ten of you."
- **`ui/screens/NewGameScreen.tsx`**: the preset picker's "$X · N on the payroll" line now reads
  `startingPlayerRosterSize ?? startingRosterSize` — it would otherwise have kept claiming "10 on
  the payroll" for a preset that now hands you 2.
- **Tests, re-expressed rather than weakened**: `worldPresets.test.ts`'s old "starts exactly ten
  wrestlers, five and five" and "still fields a tag division" tests asserted against the *signed*
  roster, which is now deliberately tiny — per CLAUDE.md, re-expressed rather than deleted: one new
  test locks the signed seed (exactly 2, split 1 and 1), a second locks that the underlying claim is
  still true of the *free-agent pool* instead (real size, a real even-ish split, still tag-capable),
  plus the new manager-pricing regression test above.
- Verified: `tsc --noEmit` clean; full suite 145 files / 2,839 tests passing (re-expressed as
  described, zero baselines lowered); `npm run sim` clean; `npm run build` clean; a live
  dev-server + Playwright pass confirming the seed roster is 2, the free-agent pool reads as a
  coherent $25-$250/wk spread with real age/persona variety (a 20-year-old fresh out of the school,
  a 36-year-old journeyman, a 55-year-old "near the end, every night costs her"), and the game plays
  from week one without a crash on the tiny opening roster.

---

## Equipment economy, continued — Phase B: card size, its own purchase

Second phase of the expanded plan. Card size (how many matches a show has room for) becomes a real,
purchasable ladder — decoupled from the venue and from the ring/sound/lights production ladder on
purpose, so a promotion can be running out of the free backyard lot with a big card because that's
where the money went, or renting a real arena and still running a bare card because it hasn't bought
the room to book anything bigger yet. Confirmed via research before touching anything:
`segmentsPerTV` had zero existing coupling to venue capacity or the production ladder to untangle —
this is a clean, additive ladder, not a refactor.

- **New file `data/cardSize.ts`**: `CARD_SIZE_TIERS`, a three-tier replacement ladder (own one tier
  at a time, like the planned ring tiers) — **Backyard Card** (4 slots, free — what `backyard` opens
  on), **Local Card** (6 slots, $12,000 — today's flat global default, what every other preset opens
  on), **Regional Card** (8 slots, $48,000). `cardSizeTierById`/`nextCardSizeTier` mirror
  `engine/economy/production.ts`'s `haulageById`/`nextHaulage` exactly.
- **`engine/types.ts`**: new optional `startingCardSizeTierId?: Id` — unset for every preset except
  `backyard` (`'backyardCard'`).
- **`state/world.ts`**: `World` gets a new `cardSizeTierId: Id` field, same single-tier-scalar shape
  as the existing `haulageId`. New exported `cardSizeFor(kind, world)` reads the owned tier's slot
  count for a TV/house show, or the untouched `settings.segmentsPerPPV` for a PPV — this ladder does
  not reach PPV size. Both places that used to build a card off `settings.segmentsPerTV` directly
  (world creation, and `store.ts`'s weekly rebuild) now go through it. Rivals are deliberately
  unaffected — `engine/world/rivalBooking.ts` still reads `settings.segmentsPerTV` straight, since
  nothing the player buys should touch anyone else's show.
- **`state/slices/showAndProduction.ts`**: new `buyCardSizeTier` action, one tier at a time and
  upwards only — same shape as the existing `buyHaulage`. Takes effect on the next card built, same
  as every other purchase (this week's card is already dealt).
- **UI**: new "Card size" tab on `FinanceScreen.tsx`, same visual language as the production ladder
  (owned/next/locked styling, a note on what's blocking an out-of-reach tier).
- **A real bug found live, not in a test**: the "locked" note under an unreachable tier always said
  "Needs {the currently-owned tier} first," which is only correct for the *immediately next* tier —
  two rungs up it read as nonsense ("Regional Card... Needs Backyard Card first" while Backyard Card
  was already owned). Fixed to reference the tier directly below the one being described.
- **Confirmed, not assumed**: `BookingScreen.tsx`'s "Run the show" already has no fill-requirement
  guard and show resolution already skips under-filled segments — a small, all-optional starter card
  already worked with zero changes needed. This phase is purely about making the slot count itself a
  purchase.
- **Tests**: new `data/cardSize.test.ts` (ordering, pricing, blurb coverage, `nextCardSizeTier`
  stepping and its unknown-id fallback). `worldPresets.test.ts` gets two more tests: `backyard` opens
  on `'backyardCard'` with a real 4-segment card, and — added to the shared four-preset block — all
  four original presets still open on `'localCard'` with a 6-segment card, unchanged by the new field
  existing.
- Verified: `tsc --noEmit` clean; full suite 146 files / 2,847 tests passing (10 new, zero
  re-expressed, zero baselines touched); `npm run sim` clean; `npm run build` clean; a live
  dev-server + Playwright pass confirming `backyard` opens with a real 4-slot card, buying up to
  Regional Card on a cash-flush save correctly charges the price and updates "tonight's card," and
  the new slot count only takes hold starting the *following* week's card, not the one already dealt.

---

## Equipment economy, continued — Phase C: wiring the dead safety fields into the real math

Third phase of the expanded plan, and the foundational one D-F build on. Research at planning time
found three fields that were fully computed and never consumed anywhere: `ProductionRung.effects
.injuryReduction` (and the same field on System A's `ringUpgrade`/`trainingFacility` assets and the
`medicalStaff` show extra), `incidentReduction` (`steelBarricades`, `security`), and `tvRating`
(`cameras`, `productionTruck`). A better ring bought nothing safer; steel barricades stopped nothing;
a better camera did nothing to the number it claimed to improve. This phase makes all three real,
with no new content — it is pure plumbing, and the highest-leverage change in the whole plan because
D, E, and F all reference this wiring rather than duplicating it.

- **`engine/economy/production.ts`**: new exported `equipmentSafetyEffects(ownedAssetIds,
  productionRungs, extraIds)` — a small, side-effect-free aggregator that reads *both* production
  systems at once (System A's one-time asset shop and System B's ordered ladder, still unresolved as
  two parallel systems per the original research, but both readable by one consumer now) and folds
  every `injuryReduction`/`incidentReduction` it finds into two multiplicative stacks, same shape as
  the existing "shields stack but never reach certainty" rule (`1 - (1-a)(1-b)`, never 1). Deliberately
  built as its own minimal function rather than hoisting the existing ~50-line wear/venue-fit-filtered
  `ownedAssets` computation in `store.ts`, because that block runs *after* match simulation in
  `resolveWeek`'s execution order and this needs to run before it — an honest, documented
  simplification (unworn effect values) rather than a bigger refactor the phase didn't need.
- **`engine/sim/simulateMatch.ts`**: new optional `equipmentInjuryReduction` field on
  `SimulateMatchContext`, folded into both places `injuryMultiplier` is assembled (the finish roll and
  the returned result — confirmed via direct grep that `rollCasualty` is called from *four* places in
  `store.ts` — competitor, guest referee, referee, manager — and only the competitor one layered on
  extra terms of its own; inserting here reaches all four in one change instead of four separate ones).
- **`engine/sim/incidents.ts`**: new optional `incidentReduction` on `IncidentContext`, multiplied
  straight into the incident-roll odds.
- **`engine/world/tvRatings.ts`**: new optional `tvRatingBonus` on `RatingEntrant`, added into the
  rating computation before the existing ceiling/floor clamp — so `cameras`/`productionTruck`'s bonus
  can push a rating up but never past `tvRatingCeiling` or below zero.
- **`state/store.ts`**: the player's per-segment `simulateMatch` call, incident roll, and
  `computeTvRatings` call all now feed the real computed values in. A rival promotion's own incident
  roll (a separate call site, main-event only) is deliberately left untouched — a rival's odds are
  never reduced by the *player's* barricades or security, which the original draft of this change
  got wrong before it was caught and fixed pre-test-run (see below).
- **`state/storeHelpers.ts`**: `incidentContextFor`'s `match` parameter gains an optional
  `incidentReduction?: number`, computed at each call site rather than inside the helper itself —
  the helper is shared by both the player's call and the rival's, and computing it unconditionally
  inside would have leaked the player's equipment into the rival's roll.
- **A bug caught before it ever reached a test run**: the first draft of the `storeHelpers.ts` change
  computed `incidentReduction` unconditionally from `world.ownedAssetIds` inside `incidentContextFor`
  itself. Since that helper backs *both* the player's and a rival's incident roll, it would have
  quietly given every rival promotion the player's own barricades and security. Caught on review of
  the two call sites before running anything, and fixed by moving the computation out to the call
  site and defaulting the new field to 0 — the rival's call site is untouched, exactly as before this
  field existed.
- **Also found while finishing the read of `SHOW_EXTRAS`**: `medicalStaff` declares an
  `injuryReduction` of its own, not just the `incidentReduction` the initial plan assumed was its only
  effect — added to the injury stack alongside the incident one rather than left dead a second time.
- **Tests**: `engine/economy/production.test.ts` gets a new `equipmentSafetyEffects` describe block (7
  tests: zero-zero baseline, folds the ladder the same as `productionEffects` alone, System A's assets
  stack on top, `steelBarricades`/`security` both feed `incidentReduction` and stack without reaching
  1, `medicalStaff` feeds `injuryReduction`, everything stacked together still never reaches certainty,
  unrecognized ids are ignored). `engine/sim/simulateMatch.test.ts` gets 2 (a 50% reduction halves
  `injuryMultiplier` exactly; omitting the field behaves identically to passing 0).
  `engine/sim/incidents.test.ts` gets 2 (a 2,000-iteration Monte Carlo comparison showing
  `incidentReduction` measurably cuts the roll rate; omitting it matches passing 0 in lockstep on the
  same seed). New file `engine/world/tvRatings.test.ts` (7 tests, since none existed before: empty
  when nobody's broadcasting, `tvRatingBonus` is genuinely additive, never pushes past the ceiling or
  below zero, share still sums to ~100 across broadcasters, a better show and a bigger name still earn
  a bigger share).
- **Verified live, not just at the pure-function level** (CLAUDE.md: measure in a played save): a
  `tools/probe.mjs`-style balance pass, same seeds played twice — once with nothing bought, once with
  the whole production ladder, top-tier haulage, every System A safety asset, and every safety show
  extra bought before week one. 8 seeds × 40 weeks, 1,872 matches either way: injuries per match fell
  from 3.79% bare to 1.34% fully equipped (a 64.8% reduction), and incidents fell from 14 to 4 across
  the same run. The dead fields are no longer dead.
- Verified: `tsc --noEmit` clean; full suite 147 files / 2,865 tests passing (13 new, zero
  re-expressed, zero baselines touched); `npm run sim` clean; `npm run build` clean; the live balance
  pass above. No UI changed in this phase, so no separate UI playtest was needed on top of it.

---

## Equipment economy, continued — Phase D: the hardware gives out

Fourth phase of the expanded plan. Before this, `data/casualties.ts`'s injury pool was generic —
knees, ribs, concussions — and a Ladder Match's flat `injuryMult: 2.0` carried none of the specific
thing that makes a ladder match dangerous: the ladder itself. This phase gives the ring's actual
hardware its own voice, and makes the *quality* of that hardware — not just whether the stipulation
was booked at all — a real, felt risk, building directly on Phase C's `equipmentInjuryReduction`
wiring rather than duplicating it.

- **`data/casualties.ts`**: `InjuryCause` gets a new optional `stipulationIds?: string[]` — undefined
  means always eligible (every existing cause, unchanged), a list restricts a cause to specific
  stipulations, because "the ladder buckled" makes no sense outside a ladder match. Three new causes:
  `ladderGaveWay` (gated to `ladder`), `cageGaveWay` (gated to `steelCage`), `tableNoBreak` (gated to
  `tables`/`flamingTables`) — each with two PG-toned lines describing the actual gear failing, not a
  generic injury that happened to occur in that match type. `causesFor()` takes an optional
  `stipulationId` parameter and filters on it.
- **`engine/sim/casualties.ts`**: `CasualtyContext` gets a matching optional `stipulationId?: string |
  null`, threaded into both `causesFor()` calls (`rollCasualty`, `stoppageCasualty`).
- **`engine/types.ts`**: `Stipulation` gets a new optional `hardwareGearSensitive?: boolean`, set on
  `steelCage`, `ladder`, `tables`, and `flamingTables` in `data/stipulations.ts` — data-driven rather
  than a hardcoded id list buried in the sim, matching CLAUDE.md's own "no magic numbers in engine/"
  rule.
- **`engine/sim/simulateMatch.ts`**: new `hardwareGearRisk` term — `1 + (1 -
  equipmentInjuryReduction) * settings.hardwareGearRiskAtWorst` when the booked stipulation is
  `hardwareGearSensitive`, `1` otherwise — folded into both `injuryMultiplier` assemblies alongside
  Phase C's equipment term. This is deliberately *on top of* the general ring/mat safety Phase C
  already wired in, not a replacement for it: a promotion with the best gear still carries real
  extra risk in a ladder/cage/tables match (per CLAUDE.md's own "never fully safe" rule, and TAW's
  own non-negotiable #1 that a system that can hurt somebody never gets switched off entirely), while
  a promotion on the bottom of the production ladder carries a lot more.
- **`state/store.ts`**: all five `rollCasualty`/`stoppageCasualty` call sites (competitor, guest
  referee, referee, manager, and the injury-stoppage roll) now pass `stipulationId: stipulation?.id ??
  null` — the same `stipulation` variable already in scope from the segment's own resolution, so
  every hardware-gated cause is reachable from every role that could plausibly suffer one.
  `engine/sim/darkMatch.ts`'s two casualty calls were checked and deliberately left unchanged — dark
  matches carry `stipulation: null` by design (no stipulation ever runs there), so they were already
  correctly excluded from hardware-gated causes without needing an edit.
- **`engine/world/settings.ts`**: new `hardwareGearRiskAtWorst: 0.5` — at zero equipment safety, a
  hardware-sensitive stipulation is half again as dangerous as its flat `injuryMult` alone says;
  shrinks toward (never to) nothing as the production ladder climbs.
- **Tests**: `engine/sim/casualties.test.ts` gets a gating test (the three new causes never surface
  outside their own stipulation, including under an *unrelated* stipulation, and each surfaces
  correctly under its own) plus two end-to-end tests threading a real `stipulationId` through
  `rollCasualty` itself rather than only `causesFor` directly (3,000-roll Monte Carlo: a ladder match
  eventually reaches `ladderGaveWay`; a steel cage match never does). The pre-existing "gives every
  cause a name and more than one way to say it" test already covers the three new causes' line
  variety and PG tone, since it iterates the whole `INJURY_CAUSES` array. `engine/sim/
  simulateMatch.test.ts` gets two: a hardware-sensitive stipulation is measurably riskier than an
  identical non-hardware one on bare gear (exact ratio locked to `1 + hardwareGearRiskAtWorst`), and
  better equipment shrinks that gap without ever erasing it.
- **Verified live, not just at the pure-function level** (CLAUDE.md: measure in a played save): a
  probe forcing the opening slot into a Ladder Match every single week (`setSegmentStipulation`), same
  8 seeds × 40 weeks played twice — once bare, once fully equipped. 320 ladder matches either way:
  somebody got hurt in that match 19.1% of the time bare, 5.0% of the time fully equipped — a real,
  large, felt difference from owning better gear, not a number moving quietly in a table nobody reads.
- Verified: `tsc --noEmit` clean; full suite 147 files / 2,870 tests passing (5 new, zero
  re-expressed, zero baselines touched); `npm run sim` clean; `npm run build` clean; the live balance
  pass above. No UI changed in this phase either — the new content flows through the same
  write-up pipeline every other injury already uses.

---

## Equipment economy, continued — Phase E: pyro can burn somebody on the way to the ring

Fifth phase of the expanded plan. Pyro's upside (rating, attendance) was already real; this phase
gives it the downside half the player explicitly asked for — "pyro could burn a wrestler on the way
to the ring... just because it's PG rated doesn't mean things don't happen." Modeled directly on
`sim/ringcraft.ts`'s `rollBotch()`, the established template for a per-match roll with its own risk
formula, its own line, and a flag the caller folds into the general injury chain.

- **New file `engine/sim/pyro.ts`**: `rollPyroBurn(rng, workers, pyroActive, equipmentInjuryReduction,
  settings)` — returns `null` outright unless `pyroActive` is true, so a promotion that never fires
  pyro never rolls this at all, ever. When it can fire, the odds are `settings.pyroBurnChance * (1 -
  equipmentInjuryReduction)` — reusing Phase C's plumbing rather than inventing a separate pyro-gear
  tier, the same honest-simplification call made in Phase C and D. A random participant catches it,
  a PG line says so, and a separate roll (`pyroBurnInjuryShare`) decides whether it also leaves a real
  mark or was just a scare — deliberately rare and deliberately minor when it lands, "a scorch, not a
  catastrophe" per the file's own framing.
- **`engine/types.ts`**: `MatchBeatKind` gets a new `'pyroBurn'` case, its own kind for the same
  reason `'botch'` has one — the write-up needs to be able to tell "a spot went wrong" from "the
  production gear went wrong." Four new `WorldSettings` fields: `pyroBurnChance` (0.015 base),
  `pyroBurnInjuryShare` (0.35 — most pyro mishaps are just a scare), `pyroBurnRatingCost` (3, smaller
  than a botch's 5, since this is an entrance mishap rather than a blown spot in the match itself),
  `pyroBurnInjuryMultiplier` (2.5, smaller than a botch's 3.5).
- **`engine/sim/simulateMatch.ts`**: new optional `pyroActive?: boolean` on `SimulateMatchContext`.
  `rollPyroBurn` is rolled in the same place and the same way `rollBotch` already is — after the
  finish is decided, so it only ever affects the *final* rating and injury multiplier, never the
  injury-stoppage odds that decided the finish itself. Its beat slots in next to `botchBeat` in the
  beats array; its rating cost stacks with a botch's the same way two real things happening in one
  match should.
- **`state/store.ts`**: the player's `simulateMatch` call now computes `pyroActive` from either
  production system — `world.productionRungs.includes('pyro')` (System B's rung, a standing purchase
  that fires every show once owned) or `world.showSetup.extraIds.includes('pyroCharges')` (System A's
  per-show charges, bought fresh each time). Either one means tonight's entrances have real fire in
  them.
- **Tests**: new `engine/sim/pyro.test.ts` (6 tests, same shape as `ringcraft.test.ts`'s botch
  coverage: never fires without `pyroActive`, never fires with nobody in the match, fires sometimes
  and rarely when active, better equipment cuts the rate without ever erasing it, names who caught it
  with no leftover `{who}`, leaves a real mark sometimes and just a scare the rest of the time).
  `engine/sim/simulateMatch.test.ts` gets 2 more: never produces a `pyroBurn` beat without
  `pyroActive` (including the omitted-field case), and reliably can produce one — with real
  text — when it's true.
- **Verified live, not just at the pure-function level** (CLAUDE.md: measure in a played save): bought
  the whole production ladder up to the pyro rung on a fresh save and played 121 weeks. 8 real
  pyro-burn beats appeared in the actual show write-ups, e.g. *"Judge Junie did not get clear of the
  pyro in time on the way to that ring, and everybody in the building saw it happen."* and *"A charge
  went off closer to the entrance than it should have, and Toxic Stormfront caught more of that heat
  than anybody wanted."* — real names, real PG-toned lines, exactly as asked.
- Verified: `tsc --noEmit` clean; full suite 148 files / 2,878 tests passing (8 new, zero
  re-expressed, zero baselines touched); `npm run sim` clean; `npm run build` clean; the live
  playthrough above. No UI changed in this phase — pyro was already purchasable before this; this
  phase only gives what's already bought a real downside.

---

## Equipment economy, continued — Phase F: the feed can drop, and a match nobody at home saw

Sixth and final phase of the expanded plan. The most structurally new piece: gives a specific match a
real "did this air" flag for the first time, and makes losing the feed cost the people in that match
something real — "even crappy cameras can lose connection and therefore fans at home miss matches. a
missed match on tv hurts the wrestlers during that match," per the player's own framing at the top of
this plan.

- **New file `engine/sim/broadcast.ts`**: `rollBroadcastDropout(rng, eligibleSlots,
  equipmentInjuryReduction, settings)` — once per show, not once per match ("a feed does not drop
  twice independently in one night in any believable way"), returns which match slot the feed dropped
  during or `null` if it held. Odds are `settings.broadcastDropoutChance * (1 -
  equipmentInjuryReduction)`, the same equipment-quality plumbing Phase C wired up and Phases D and E
  already reused. `broadcastDropoutLine(rng, matchDescription)` supplies the "technical difficulties"
  write-up sentence — confirmed via the original research that zero flavor text for this existed
  anywhere in the game before this phase.
- **`engine/world/wire.ts`**: new `WireKind` case, `'broadcast'` — its own category rather than folding
  into `'misfortune'` or `'houseShow'`, both of which mean something more specific already. The
  `WIRE_KIND_LABELS` map is a `Record<WireKind, ...>`, so the compiler itself refused to build until a
  label was added — and `wire.test.ts`'s own exhaustiveness test (the guard against "a kind with no
  sentence is a silent change") caught the missing sample before anything ran.
- **`state/store.ts`**: once per show, before the card loop runs, computes which match slots are real
  (2+ sides, real participants — the same filter the existing rating tally already applies) and rolls
  `rollBroadcastDropout` against them. Inside the loop, the flagged segment's participants get the
  same treatment `sim/darkMatch.ts` already gives a genuine dark match: their popularity gain from
  `computeAftermath` is scaled by the existing `settings.darkMatchPopularityShare`, and a `'broadcast'`
  wire line names the match and says what happened. At `computeShowRating`, the flagged slot's rating
  *and* its slot weight are both dropped from the arrays entirely — not scored 0. That distinction
  matters: 0 is what an unfilled segment gets (§13's own deliberate harshness for a thin card), and a
  match that happened and was good is not that; excluding it from both arrays means the show is judged
  only on what actually aired, exactly like a genuine dark match, which was never part of the weighted
  arrays to begin with.
- **A real, live-only bug, caught by the balance pass and nowhere else**: the first version seeded the
  once-per-show roll from `world.promotion.id`, following the file's own convention of keying a roll to
  the entity it concerns. But there is exactly one player promotion per save, always the same id — so
  every save that will ever be played would have rolled a dropout on the *identical* week numbers,
  regardless of its actual seed. A unit test testing the pure `rollBroadcastDropout` function in
  isolation could never have caught this (it takes an `Rng`, not a promotion id); it only showed up
  once played through the real store across multiple seeds, where the "bare" and "fully-equipped"
  rates came out identical and the per-seed dropout count was suspiciously exact (4 out of 40 weeks,
  every single seed). Fixed by keying on `` `${world.settings.seed}-broadcastDropout-${world.week}` ``
  instead — the pattern every other per-week roll in `store.ts` already uses (`` `${world.settings.seed}
  -catastrophe-${world.week}` `` and half a dozen others), which this roll should have matched from the
  start rather than reaching for the `rngFromSeed`-from-an-entity pattern that fits a *person*-scoped
  roll (`dayJobAbsence`'s `blame:${person.id}:${week}`) but not a *world*-scoped one.
- **Tests**: new `engine/sim/broadcast.test.ts` (6 tests: never drops with nothing eligible, drops
  sometimes and rarely when there is, better gear cuts the rate without erasing it, only ever picks an
  actually-eligible slot, names the match with no leftover `{match}`, varies its line). New test in
  `engine/economy/showRating.test.ts` locking in the exact distinction the store-level fix depends on:
  excluding a slot from both arrays is not the same as scoring it 0, and produces a materially higher
  rating for the same underlying show. `wire.test.ts` gets a new sample for the `'broadcast'` kind,
  required by its own exhaustiveness check.
- **Verified live, not just at the pure-function level** (CLAUDE.md: measure in a played save — this is
  the phase where that rule actually paid for itself): 8 seeds × 40 weeks, bare vs. fully-equipped.
  After the seed-key fix: 16 dropouts on bare gear vs. 13 equipped (out of 328 weeks each, in line with
  the ~5% base rate scaled by the modest reduction the ladder alone provides), and a dropout week's
  mean show rating (50.7) landed close to the overall mean (52.3) rather than being artificially
  tanked — confirming the exclude-don't-zero mechanism actually works live, not just in the isolated
  arithmetic test. Sample write-up lines pulled straight from the run: *"Technical difficulties knocked
  the broadcast dark right in the middle of Delilah Blythe and Doyle Kavanagh, and nobody watching at
  home saw a second of it."* and *"The feed went down during Marshal Reid and Nova Applewhite and never
  came back before the bell. Anybody who tuned in missed the whole thing."*
- Verified: `tsc --noEmit` clean; full suite 149 files / 2,885 tests passing (7 new, zero re-expressed,
  zero baselines touched); `npm run sim` clean; `npm run build` clean; the live balance pass above,
  including the seed-key bug found and fixed mid-verification. No UI changed in this phase.

---

This closes the six-phase equipment economy plan (`/root/.claude/plans/synthetic-plotting-planet.md`):
Phase A rebuilt the hiring loop around a tiny seed and a real free-agent pool; Phase B made card size
its own purchase; Phase C wired the dead `injuryReduction`/`incidentReduction`/`tvRating` fields into
the real math; Phases D, E, and F built new, genuinely felt downsides on top of that wiring — hardware
giving out, pyro burns, and a broadcast that can drop — matching the standing rule that started the
whole plan: every purchase needs a real upside, and every cheap tier needs a real, occasionally-visible
downside.

---

## Prop lifecycle & consequence system, Phase 1 — real, countable match hardware

Grew out of a follow-up request, prompted directly by the player: every prop in wrestling — rings,
ladders, cages, tables, cameras, pyro, the truck — should have a real 0-100% lifespan, some ownable in
multiple units each tracked separately, with a real cap and real "magic" to owning more than one, with
breakage odds climbing as condition drops, and a felt consequence when it actually breaks mid-match (a
draw; a vacated title if a belt was on the line). Confirmed via research before writing any code: no
literal ladder, cage, or table prop existed anywhere in the codebase — the existing "production ladder"
(`engine/economy/production.ts`) is an abstract quality-tier system, and a Ladder/Cage/Tables
*stipulation* had zero physical-prop requirement wired to it. This is Phase 1 of a larger plan (see the
plan file); it ships the biggest genuinely-missing piece — the literal match hardware — plus the plumbing
the later phases (pyro condition, camera condition, truck breakdown, gear-hurt-someone-backstage) will
reuse. **Additive, not a retrofit**: `ownedAssetIds`/`AssetCondition` (System A, one-time shop) and
`productionRungs`/`HAULAGE` (System B, ordered ladder) model single-owned house capital; a ladder, a
cage, a table are a different category — consumable, countable, multi-unit match props — so this phase
adds a new, parallel system rather than bending either existing one to fit.

- **New file `data/matchProps.ts`**: `MatchPropFamily` (`ladder` maxUnitsOwned 6/maxUnitsInMatch 4,
  `steelCage` 2/1, `tables` 10/4 — shared by `tables` and `flamingTables`) and `MatchPropTier`, three
  per family cheap-to-expensive (`ladderWood`/`ladderAluminum`/`ladderProSpec`,
  `cageRentedPanels`/`cageTouringRig`, `tableFolding`/`tableBanquetReinforced`), each with its own
  `idleWearPerShow`/`useWearPerMatch`/`qualityFactor`. Lookup helpers: `familyById`, `tierById`,
  `tiersForFamily`, `familyForStipulation`.
- **New file `engine/economy/matchProps.ts`**: `OwnedPropUnit` (per-unit `condition`, `showsOwned`,
  `timesUsed`) plus the same taper-curve/failure-threshold/repair-for-a-fraction idiom
  `economy/showBudget.ts`'s `AssetCondition` already established, applied per unit instead of per asset
  type: `newPropUnit`, `idleWearUnit`, `useWearUnit` (now takes an optional `wearMultiplier`, see
  below), `unitHasFailed`, `unitConditionLabel`, `propRepairCost`, `repairPropUnit`,
  `ownedUnitsForFamily`, `usableUnitsForFamily`. `unitBreakChance` scales with tier quality and
  condition; `aggregateBreakChance` stacks several units in play the same way `productionEffects()`
  stacks `injuryReduction` (`1 - product(1 - x_i)`, so more units in play is a real, compounding cost);
  `spectacleBonus` gives diminishing-returns rating upside for more units in one match — the mechanical
  answer to "4 ladders could put on a heck of a ladder match... there is magic to having certain
  amounts."
- **`World`/`Segment`/`WorldSettings`**: `World.ownedPropUnits: OwnedPropUnit[]` (schema bump 58→59,
  hard reset on old saves per this codebase's existing no-migration convention); `Segment.gearUnitIds?:
  Id[]` (which owned units are assigned to tonight's match); six new settings
  (`propFailureThreshold`, `propRepairCostFraction`, `propBreakChanceAtWorst`,
  `equipmentFailureWeightScale`, `gearUnitsSpectacleBonusPerExtra`, `gearUnitsSpectacleBonusCurve`).
- **Use-vs-idle wear, live in `resolveWeek`**: every owned unit either takes `useWearUnit` (assigned to
  a segment tonight) or `idleWearUnit` (sitting in storage) — the direct, literal answer to "a ladder
  deteriorates faster during a match than if it's not used." Because the *rate itself* is tier data, a
  cheap wooden ladder visibly ages faster than a pro-spec one even sitting untouched in storage.
- **The booking gate — "you cannot book a Ladder Match without a ladder," the first time
  `stipulationRequirementsMet()` has ever checked ownership at all.** `Stipulation` gets
  `gearFamilyId`/`minGearUnits`, set on the four `hardwareGearSensitive` stipulations.
  `StipulationCheckContext.ownedGearUnits` feeds the check. Deliberately **not** a hard block, matching
  every other `stipulationRequirementsMet` failure already in the game: a booker can still put "Ladder
  Match" on a card owning zero ladders, and it costs the same flat `-8` mismatched-stipulation rating
  term it always did — the game states the cost, it does not refuse the decision.
- **Unit selection**: new `setSegmentGearUnits(slot, unitIds)` action, capped at `maxUnitsInMatch`,
  cleared automatically whenever the segment's stipulation changes family.
  `ui/screens/BookingScreen.tsx` renders owned units of the right family as toggle chips (tier name +
  condition label) once a hardware-sensitive stipulation is picked, with a plain caption ("more ladders
  is a bigger spectacle. It's also more that can go wrong tonight") rather than a warning.
- **Mid-match breakage → draw → title vacate.** New `FinishType` case `'equipmentFailure'`, wired through
  every exhaustive `Record<FinishType, ...>` site the compiler caught (`narrative.ts`'s
  `FINISH_LINES`, `matchRating.ts`'s `FINISH_SATISFACTION` at `-6`, `ShowResults.tsx`'s `FINISH_TEXT`),
  plus real per-stipulation `finishFlavor` on all four hardware-sensitive stipulations (e.g. ladder:
  *"the ladder gave way underneath both of them, and there was no honest way to call a winner out of
  that."*). `isDrawFinish()` and `titleCanChangeHands()` both include it, so it behaves like a real draw
  and never quietly lets a champion retain. **New file `engine/sim/gearFailure.ts`**: `rollGearFailure`,
  modeled directly on `sim/pyro.ts`'s `rollPyroBurn` — weighted toward whichever assigned unit is worn
  worst, named in the write-up, only ever rolled once `rollFinish`'s single existing weighted pick has
  already landed on `equipmentFailure` (no new RNG draw — the finish weight is folded into the same
  call every match already makes). Reachability requires the stipulation's `gearFamilyId` to be set —
  never surfaces on a match nothing was booked into.
  `simulateMatch.ts`'s `hardwareGearRisk` now prefers a real per-unit `gearUnitRisk` (worst condition
  among tonight's assigned units) over the general ring/mat proxy when one is supplied, answering the
  explicit ask that injury risk track the *specific* prop, not just the abstract production tier.
- **`state/store.ts` title-outcome intercept — a real bug found and fixed before it shipped.** The
  existing `isUnificationMatch` branch runs before the `!outcome.changed` check and falls back to
  `result.winnerWrestlerIds`, which is empty on a draw — so an equipment-failure unification match would
  have called `commitTitleChange(world, index, [])` without an explicit intercept. Fixed by checking
  `result.finish === 'equipmentFailure'` first and calling the existing `stripTitle(world, title,
  'vacatedByEquipmentFailure')` primitive (new `TitleReignEndMethod` literal), pushing a `wire('title',
  ..., world.week + 1, 'lead')` item (stamped past the increment per this file's own wire-timing trap),
  then `continue`-ing before the unification logic ever runs.
- **Two more real bugs, found by direct review rather than the original design pass — both fixed before
  shipping.** `engine/sim/commentary.ts`'s `factsOf()` would have added `'titleRetained'` for an
  equipment-failure vacate (titles present, `titleChanged` false, `championName` still set from before
  the match — exactly the shape that used to mean "the champion kept it"). Fixed by gating
  `'titleRetained'` on `ctx.finish !== 'equipmentFailure'` and adding a new `'titleVoided'` fact with its
  own `CLOSERS` line. `ui/screens/ShowResults.tsx`'s title header showed neither "new champion" nor any
  vacate indication for this finish; it now shows "— vacated" alongside the existing "— new champion"
  state.
- **Buy/repair, `ui/screens/PromotionScreen.tsx`**: new "Match hardware — tracked unit by unit" section,
  one card per family showing owned-count-vs-cap, each individually owned unit with its own condition
  label and a per-unit repair button, and a buy button per tier (disabled at the family's cap or when
  unaffordable). New store actions `buyPropUnit`/`repairPropUnit`
  (`state/slices/showAndProduction.ts`, alongside the existing production-asset trio).
- **Player follow-up, mid-build: "flaming tables would probably burn them up."** Correct, and the
  original design missed it — `tables` and `flamingTables` shared the same family/tiers/wear rate, so a
  table that is *actually on fire* wore out identically to one that just got broken. Added
  `Stipulation.gearWearMultiplier?: number` (defaults to 1), set to `5` on `flamingTables` only,
  threaded through both `useWearUnit`'s new optional `wearMultiplier` parameter (post-match wear) and
  the `gearFailureChance` computed for `simulateMatch`'s context (mid-match break odds) — a table in a
  Flaming Tables match is both far more likely to give out in the match itself and, if it survives,
  comes out of the night far more damaged. At the tier numbers shipped, a cheap folding table
  (`useWearPerMatch: 40`) is fully consumed in a single Flaming Tables booking; a reinforced banquet
  table (`useWearPerMatch: 18`) barely survives one.
- **Tests**: new `engine/economy/matchProps.test.ts` (20 tests: wear rates differ by tier, use vs. idle,
  the wear-multiplier override, failure threshold and condition labels, repair cost/repair, break-chance
  stacking never reaching certainty, spectacle bonus's diminishing returns). New
  `engine/sim/gearFailure.test.ts` (5 tests: never fires on empty input, always names an assigned unit,
  weighted toward the worst-condition one, never empty text). `data/stipulations.test.ts`'s gear-gate
  tests (from the booking-gate step above). `engine/sim/finish.test.ts` gets 2 more: never reaches
  `equipmentFailure` without an explicit weight, reaches it — more often at higher weight — once one is
  supplied. `engine/sim/titleMatch.test.ts` gets a case confirming `titleCanChangeHands` is false for
  this finish. `engine/sim/simulateMatch.test.ts` gets 5 more: worn-vs-fresh specific-unit risk, the gap
  shrinking but never vanishing across three condition levels, the specific-unit term moving the number
  even against an excellent general ring (not just re-reading the same proxy twice), never reaching
  `equipmentFailure` without a `gearFamilyId` on the stipulation however high the break chance, and
  reaching it — with the correct unit named — once one is set. `engine/sim/commentary.test.ts` gets 2
  more, guarding the exact bug found above: `'titleRetained'` never fires and `'titleVoided'` does for
  an equipment-failure finish with a title on the line; an ordinary non-title-changing finish still gets
  `'titleRetained'` as before. The existing "every fact has something to say about it" /
  "declares no fact the engine cannot set" exhaustiveness pair (guards against a fact with a line nobody
  ever plays) both extended to cover `'titleVoided'`.
- **Verified live, not just at the pure-function level** (CLAUDE.md: measure in a played save): a probe
  forced the opening slot into a Ladder Match every week (`setSegmentStipulation` + `setSegmentGearUnits`,
  repairing the assigned unit(s) whenever they failed so a broken cheap ladder does not just drop out of
  the sample), and forced a real singles title onto that same opener every week
  (`toggleSegmentTitle`) to exercise the vacate path directly rather than waiting for it to land there
  organically. 14 seeds × 40 weeks, once with a single cheap wooden ladder, once with four pro-spec
  ladders: 555 vs. 558 ladder matches, `equipmentFailure` landed 2.88% of the time on the cheap ladder
  vs. 1.79% on pro-spec gear — a real, directional difference from owning better gear, same shape as
  Phase D's. Condition after 40 weeks: the pro-spec run's assigned units averaged 77.4 vs. an untouched
  spare's 96.3 — used gear visibly wears faster than idle gear in an actual played save, not just in the
  isolated wear-tick math. Every equipment-failure title match across both runs produced the correct
  wire (*"The Southside Heavyweight Title is vacant tonight — the match for it never got a finish after
  the gear gave out, and the office isn't willing to call that a defence."*) and zero produced a
  "new champion" — the exact bug the store.ts intercept fix above exists to prevent, confirmed absent
  live across 1,113 combined ladder matches. Sample finish text: *"Quill Utley had Major Gus beat to the
  top when the ladder gave out from under both of them, and nobody ever got a hand on what was hanging
  up there."* The gear gate was never observed to actually block a booking (units were repaired in time
  every run), confirming the "warns, never blocks" design intent held up live as well as in the pure
  function.
- Verified: `tsc --noEmit` clean; full suite 151 files / 2,923 tests passing (33 new across six test
  files, zero re-expressed, zero baselines touched); `npm run sim` clean; `npm run build` clean; the live
  probe above.
- **Not part of Phase 1, sketched in the plan for later phases**: pyro gets real per-unit condition and
  a "hit a fan" incident variant; cameras get real condition (design fork: consumable prop vs. house-
  capital treatment, to be decided at the start of that phase); the truck can break down
  (`CatastropheKind = 'gearFailure'`, needs a genuinely-missing single "effective owned gear tonight"
  value the five current call sites each read independently); equipment can hurt somebody backstage,
  routed through the already-built, cause-agnostic `NoShowCall` mechanism.

---

## Renamed again: Pro Wrestling: Rival Booker Battle

Player supplied a new logo (a gold championship-belt mark reading "Pro Wrestling / Rival Booker
Battle") and asked for the name to change to match. Same four spots the original naming pass
(`docs/BACKLOG.md`'s "Named the game, and gave it a real front door") identified as the game's only
player-facing name surfaces, all updated together so nothing lagged behind:

- **`src/ui/assets/title-logo.jpg`** — swapped for the new art. Same flat dark background as the
  previous logo, so the existing "plaque" framing in `TitleScreen.tsx` (hairline gold border, rounded
  corners, shadow) needed no changes to still read correctly — confirmed with a live screenshot rather
  than assumed.
- **`src/ui/screens/TitleScreen.tsx`** — the logo `<img>`'s `alt` text updated to "Pro Wrestling: Rival
  Booker Battle".
- **`src/ui/screens/SettingsScreen.tsx`** — the About panel's name/badge pair updated from "Rival
  Promotions" / "Wrestling Booker Edition" to "Rival Booker Battle" / "Pro Wrestling", keeping the same
  name-plus-genre-badge layout the panel already used.
- **`index.html`** and **`scripts/single-file.mjs`** — both hardcoded `<title>` tags updated to "Pro
  Wrestling: Rival Booker Battle" (the single-file script's copy is a separate literal string, not
  generated from `index.html`, so it needs its own edit every time — same trap the original naming pass
  flagged when it found this one stale with a leftover "TAW" title).
- `package.json`'s `"name": "wrestling-booking-game"` deliberately left alone — an internal package
  slug, never shown to a player, not part of the original naming pass either.
- Verified: `tsc --noEmit` clean; `npm run build` clean, and grepping the built bundle confirms the new
  (larger) logo still inlines as a single `data:image/jpeg;base64` occurrence with zero lingering
  `/assets/title-logo` URL — the exact asset-inlining bug the original naming pass hit and fixed, re-
  checked here since the new file is a different size; `npm run play` clean, its `<title>` confirmed
  correct in the built single-file output. Live screenshots of both the title screen and Settings screen
  confirm the new logo renders correctly in its frame and both text surfaces read the new name.

---

## UX/navigation overhaul, Phase 1 — a real navigation stack, and one shared screen header

First of four phases (full plan: `/root/.claude/plans/synthetic-plotting-planet.md`). Grew out of the
player actually playing the built game and not being able to find their way around it — full context in
this file's "UX/navigation overhaul" entry above. Two research passes plus a design pass confirmed the
starting point: routing was a flat `useState<Screen>` in `App.tsx` with no history or params, and the only
precedent for passing an id into a screen was a one-off `repackaging: string | null` used solely by the
wrestler editor. This phase replaces that with the one mechanism every later phase (the wrestler-detail
screen in Phase 2, the `BookingScreen.tsx` split in Phase 3) builds on, and proves it works before anything
bigger is built on top of it.

- **`src/App.tsx`**: `const [screen, setScreen] = useState<Screen>('booking')` replaced with a small typed
  stack — `interface NavTarget { screen: Screen; params?: { wrestlerId?: Id } }`,
  `const [navStack, setNavStack] = useState<NavTarget[]>([{ screen: 'booking' }])`. Three functions replace
  the old single `navigate`: `goTo(target)` pushes (drill-down — a `WrestlerRow` tap, a card-slot tap in a
  later phase), `goBack()` pops (falls back to `{screen:'booking'}` defensively if the stack would go
  empty), `resetTo(screen)` replaces the whole stack with one entry (the bottom nav's five tabs and
  everything behind the More screen — lateral moves, not drill-downs, so none of them grow the stack or
  show a back arrow, exactly as before). No React Router, no URL, no history API — this stays a small typed
  stack matching the zero-framework grain of everything else in this codebase; at the depth this redesign
  needs (one or two levels), that's the right-sized tool, not an under-reaction.
- **The `key={screen}` trap — load-bearing, not cosmetic.** `<main key={screen}>` used to key React's
  remount purely on the flat screen id. Once a screen can navigate to another instance of itself (Phase 2's
  "tap a tag partner from inside a wrestler's detail screen, land on *their* detail screen"), keying on the
  screen id alone breaks: React sees the same key both times and won't remount, so the previous subject's
  data would silently linger. Fixed now, ahead of needing it, by deriving the key from the whole nav target
  — `` key={`${screen}:${params?.wrestlerId ?? ''}`} `` — and proven in this phase's own live pass (see
  Verified below) using the one param-carrying screen that exists today, the wrestler editor, repackaging
  two different wrestlers back to back.
- **`repackaging` folded into the new mechanism**, not left as a second, inconsistent pattern next to it.
  `RosterScreen`'s `onRepackage` now calls `goTo({screen:'editor', params:{wrestlerId}})` directly;
  `WrestlerEditor` reads `params?.wrestlerId` as an ordinary prop from `App.tsx`'s render body, same as
  before, just sourced from the stack instead of a dedicated `useState`.
- **New `src/ui/components/ScreenHeader.tsx`** — the first piece of "consistent chrome everywhere": a back
  arrow (calls whatever `onBack` it's given — always `goBack` in practice), a title that wraps rather than
  truncates (a first draft truncated to "Repackag…" on a phone-width screen with two buttons next to it —
  caught in the live screenshot pass below and fixed before shipping), an optional subtitle line, and an
  optional `right` slot for a small action cluster. Its own file rather than folded into `chrome.tsx` —
  that file's own header comment already declares "no screen invents its own panel any more" for the
  Panel/Tabs/Badge family, and a header-with-back-arrow is a new category of primitive, not a variant of an
  existing one.
- **Piloted on `src/ui/screens/WrestlerEditor.tsx`** — deliberately the only screen touched beyond
  `App.tsx` this phase, to prove the mechanism on the smallest possible surface before Phase 2 builds a
  real new screen on it. Its hand-rolled `<header><h1>...` block is replaced with `ScreenHeader`, and its
  separate "Cancel" button is folded into the header's own back arrow (they did the same thing — abandon
  without saving — so keeping both was two affordances for one action). A **real, deliberate side effect**:
  the sandbox editor (reached from the More list, no wrestler being repackaged) previously had no back
  button at all — `save()` and the Cancel/Save buttons only ever rendered when a subject existed, so the
  only way out was the bottom nav. It now gets `ScreenHeader`'s back arrow like every other screen, which
  correctly falls back to the booking screen via `goBack()`'s defensive default (confirmed live, see below)
  — a small, unambiguous improvement, not a scope change.
- **Tests**: none added or changed — this phase is pure UI/routing, and this codebase has no automated
  UI/component test layer at all (confirmed via `grep -rl data-testid **/*.test.ts*` returning nothing);
  every `data-testid` in the UI exists solely to support live click-through verification, which is what
  this phase's own verification pass is.
- **Verified live, not just at the pure-function level**: `npm run dev` + a real Playwright click-through.
  Repackaged wrestler A (Lars McCready), confirmed the editor's title read the full name; backed out via
  the new header, confirmed landing back on the roster; repackaged a *different* wrestler B (Lux Kincaid) —
  the concrete proof the stack-derived key fix works — and confirmed the editor showed B's name and
  portrait, not stale A data. Clicked through all five bottom-nav tabs plus two More-list screens (Free
  Agents, the sandbox Editor) and confirmed zero back arrows on any of them except the sandbox editor's new
  one, which correctly returned to the booking screen. The title-wrap bug above was caught and fixed during
  this same pass, before shipping.
- Verified: `tsc --noEmit` clean; full suite 151 files / 2,923 tests passing (zero changes, as expected for
  a pure UI/routing phase); `npm run build` clean; the live click-through above.
- **Not part of Phase 1**: the wrestler-detail screen, wiring `WrestlerRow` `onClick`s to it, and
  `RosterScreen.tsx`'s restructuring (Phase 2); the `BookingScreen.tsx` split into a card-overview screen, a
  roster-picker screen, and a tabbed match-setup screen (Phase 3); calendar linkage and a free-agent
  "new graduates" filter (Phase 4, both already confirmed small and low-risk in the plan). All fully
  specified in the plan file; none started here.

---

## UX/navigation overhaul, Phase 2 — a real wrestler-detail screen, reached from everywhere

Second of four phases (full plan: `/root/.claude/plans/synthetic-plotting-planet.md`). Built on Phase 1's
navigation stack without touching the mechanism itself — this phase is entirely new screens and wiring.
Kicked off by a bare "proceed" immediately after Phase 1 shipped, no fresh planning round.

- **New `src/ui/screens/WrestlerDetailScreen.tsx`**, reached via
  `goTo({screen:'wrestlerDetail', params:{wrestlerId}})` from every `WrestlerRow` in the app.
  `ScreenHeader` with the billed name as title; a portrait row (`PaperDoll size="large"`, injury badge,
  crown/nickname/alignment/age/former names/belts) with full non-compact `MiniStats` beside it; then two new
  tappable sections the game never had before — **tag partner(s)**, via the existing `teamOf(world.stables,
  wrestlerId)`, and **manager**, via the existing `representativeOf(world.representations, wrestlerId)` —
  each rendered as a compact `WrestlerRow` whose `onClick` pushes a *new* `wrestlerDetail` target for that
  person. Below that, everything that used to be crammed onto `RosterScreen.tsx`'s giant per-wrestler card
  moved here wholesale and unchanged in substance: notice-to-leave, staleness, shun/leave status, injury
  text, stances, the one-line relationship summary (`circleSummary`), career-status line, gimmick heat,
  manager's-own-book lines, discipline record, lineage, scout pitch, mood, reach/strongholds/home,
  ringcraft/likeability, motivation symbols, trait chips, `CareerLedger`, and contract line. One small
  enhancement beyond the plan's literal spec: the ally/enemy relationship chips are now tappable links to
  those wrestlers' own detail screens too, not just tag partners and managers — free, since the data and the
  `onNavigateWrestler` callback were already right there.
- **The four consequential action buttons — retire, role-change, release, repackage — moved here, off the
  roster row entirely**, exactly as flagged in the plan as a real, deliberate behavior change: releasing or
  retiring someone is now row → detail → action instead of one tap from the list. This is what makes
  `RosterScreen`'s row genuinely the same shared row used everywhere else — free agents' and rivals' rows
  obviously can't carry Retire/Release buttons, and now none of them have to be special-cased.
- **`src/ui/screens/RosterScreen.tsx` rewritten**, 992 lines down to ~275. Its giant-card grid is now a
  plain list of `WrestlerRow`s (`onClick` → detail); sort chips, the wage-total header, `TagTeamPanel`, and
  `MotivationKey` stay here as roster-wide tools. `alignmentOf` and the `PerkRow`/`AssignmentRow`/`BeltIcon`
  helpers moved to `WrestlerDetailScreen.tsx` with the content that needed them.
- **`onClick` wired into the `WrestlerRow` call sites that didn't have it**: `FreeAgentsScreen.tsx` and
  `RivalRosterScreen.tsx` both gained an optional `onNavigate` prop, threaded straight through. No
  `WrestlerRow` API changes were needed anywhere — its existing `onClick`/`trailing` props already covered
  this.
- **`BookingScreen.tsx`: the already-on-segment participant rows only**, per the plan — the roster-picker
  list (tap-anywhere-to-add) stays untouched until Phase 3 gives it its own screen. This surfaced a real
  layout problem the plan didn't anticipate: those rows already use `WrestlerRow`'s `trailing` slot for a ✕
  remove button, and `WrestlerRow` wraps everything — including `trailing` — inside its own `<button>` the
  moment `onClick` is passed, which would have nested a real `<button>` inside another real `<button>`.
  Fixed without touching `WrestlerRow`'s API: the row is wrapped in a plain `<div role="button" tabIndex={0}
  onClick={...}>` instead, and the inner ✕ button calls `e.stopPropagation()` so removing a wrestler no
  longer also navigates to their detail screen.
- **Tests**: none added or changed — still no automated UI/component test layer in this codebase; full
  suite (151 files / 2,923 tests) passes unchanged, consistent with this being pure UI/routing work with no
  engine or store logic touched.
- **Verified live**, `npm run dev` + Playwright, across every wiring site: Roster list → a wrestler's detail
  screen; from inside that screen, tapping a tag partner → *their* detail screen, confirmed by distinct
  rendered name/portrait/stats — the concrete proof, under real recursion this time (not just Phase 1's
  simpler single-param editor case), that the stack-derived remount key from Phase 1 actually holds; back →
  back → landing correctly on Roster; Free Agents list → detail; Rival Rosters list → detail; and a booking
  segment's already-on-card row → detail, with the ✕ remove button confirmed still working on its own
  without triggering navigation. Two rounds of test-script false negatives along the way turned out to be
  script assumptions, not app bugs (a `formTagTeam` call silently no-op'd against a wrestler who already had
  a real pre-existing partner in the starting roster; a toggle click assumed the first card slot started
  collapsed when it's open by default) — both traced to their actual cause and the script corrected rather
  than the app.
- Verified: `tsc --noEmit` clean; full suite 151 files / 2,923 tests passing (zero changes); `npm run build`
  clean; the live click-through above.
- **Not part of Phase 2**: the `BookingScreen.tsx` split into a card-overview screen, a roster-picker
  screen, and a tabbed match-setup screen (Phase 3, the biggest and riskiest of the four); calendar linkage
  and a free-agent "new graduates" filter (Phase 4, both already confirmed small and low-risk in the plan).
  Both fully specified in the plan file; neither started here.

---

## UX/navigation overhaul, desktop/Steam pivot — the shell, the booking flow, and three master-detail screens

Full plan: `/root/.claude/plans/synthetic-plotting-planet.md`. Started as Phase 3 of the phone-first overhaul
above (the `BookingScreen.tsx` split); mid-way through, the player redirected it outright: the game is not
phone-tailored, it is headed for Steam on a PC, and should use a real window's worth of space — "dedicate
full screens to different rosters...or parts. use the space" — instead of a single scrolling column.
Research into how this genre's respected desktop UIs actually look (Pro Wrestling Sim on Steam, explicitly
compared to "hockey and football management sims"; Football Manager's classic sidebar-plus-main-pane
layout; Total Extreme Wrestling's dense multi-panel booking screens) confirmed the direction: a persistent
always-visible navigation rail rather than hiding most destinations behind a second tap, and dense
multi-column layouts rather than a phone's forced one-thing-at-a-time stack. `wrestling-booking-game/CLAUDE.md`'s
framing changed from phone-first to desktop-first, Steam-bound, as an explicit, deliberate call, not a
casual rewording — phone/touch stop being a design target from here on.

- **The shell (`src/ui/components/Nav.tsx`, `src/App.tsx`)**: `BottomNav` (five tabs) and `MoreScreen`
  (fourteen items behind a second tap) are gone. A new `Sidebar` component shows all nineteen destinations
  at once, grouped (Tonight / Talent / Business / History / Admin), each with the one-line blurb `MoreScreen`
  used to justify its own existence — now sitting right there under the label instead, since a desktop
  window has the room a phone never did. `App.tsx`'s outer shell becomes a row (`Sidebar` beside a content
  column) instead of a column with a fixed bottom bar; the top status strip (promotion name/week/bank) is
  unchanged. **The navigation stack mechanism itself — `NavTarget`/`goTo`/`goBack`/`resetTo`, and the
  stack-derived remount key — needed zero changes.** It was built platform-agnostic in Phase 1, and every
  sidebar row calls `resetTo` exactly the way `BottomNav`'s tabs used to. `index.html`'s phone-locking
  viewport meta (`maximum-scale=1.0, user-scalable=no`) and `index.css`'s touch-target CSS (a `pointer:
  coarse` media block, load-bearing only under the old phone-first premise) are both removed. The eighteen
  `pb-24` bottom-nav-clearance classes scattered through every screen become `pb-6` — a mechanical sweep,
  no bottom bar to clear any more.
- **The booking flow, finished natively for desktop (this is what Phase 3 became)**: `BookingScreen.tsx`
  is trimmed to a true card overview — a two-column layout (`grid-cols-[1fr_320px]`), the card itself as a
  grid of slot tiles rather than a single-column accordion, and the six conditional notice panels (a cup
  invite, a supershow offer, a bidding war, live stories, what the crowd wants, belts on the clock) moved
  into a right-hand rail instead of stacking above the card — they already return `null` when nothing's
  relevant, so most weeks the rail simply isn't there. Tapping a slot tile always leaves the screen: to a
  new **`SlotRosterPicker.tsx`** (a wide two-pane picker — a dense, multi-column roster grid on the left, a
  sticky right rail showing both sides' current picks and the "Add here" toggle) if the slot isn't cast on
  both sides yet, or to a new **`MatchSetupScreen.tsx`** if it is. `MatchSetupScreen` drops the phone-era
  plan's tab bar (`Arena`/`Rules`/`Cast`/`Script`/`Play` compressed into tabs for lack of room) in favor of
  showing **Cast, Rules, and Stakes as three simultaneous columns** — everything about one match visible at
  once, closer to how a real match-booking form works than a tab-switching wizard. A new
  `src/ui/screens/segmentSummary.ts` holds the odds/stipulation/stakes/referee calculation shared by the
  card-overview tile and the match's own screen, so the two can never disagree about what a match is.
- **Roster, Free Agents, and The competition, rebuilt as master-detail** (a deliberate, player-directed
  extension of scope beyond the booking flow, in the same pass): each is now a list on the left and a full
  detail pane on the right, no navigation, no back button. `WrestlerDetailScreen.tsx`'s content — portrait,
  stats, tag partners/manager, every status line, `CareerLedger`, contract, and the four consequential
  actions (retire, role, release, repackage) — was extracted into a new shared `WrestlerDetailBody`
  (`src/ui/components/WrestlerDetail.tsx`), gated by a new `editable` flag so the actions render only for
  somebody actually on your own roster. `WrestlerDetailScreen.tsx` itself survives as a thin wrapper
  (`ScreenHeader` + the body, `editable` computed from `world.promotion.rosterIds.includes(w.id)` rather
  than assumed) — still the real destination for a name tapped from somewhere with no list of its own to
  embed the body in (a booking slot's cast, a tag partner outside whatever list is on screen).
  `RosterScreen.tsx`'s row taps now set a local selection instead of navigating, with the selection
  re-clamping to the top of the list whenever it points at nobody real any more (a re-sort, or somebody
  leaving via retire/release right there in the detail pane); tag-partner/ally taps inside the pane reselect
  in place if the target is on the same roster, or fall back to a real navigation otherwise.
  `FreeAgentsScreen.tsx` keeps its per-row Sign button on the compact left list (it shouldn't need a detail
  view first) and adds the free-agent-specific case for or against signing — asking rate, refusal reasons,
  weeks unsigned — as its own panel below the shared, read-only (`editable={false}`) body on the right.
  `RivalRosterScreen.tsx` keeps its company-picker chips and adds the same read-only master-detail split,
  dropping the belts/`CareerLedger` that used to repeat down every row now that the detail pane shows both.
- **Tests**: none added or changed — still no automated UI/component test layer in this codebase; full
  suite (151 files / 2,923 tests) passes unchanged, consistent with this being pure UI/routing/layout work
  with no engine or store logic touched.
- **Verified live**, `npm run dev` + Playwright at a real desktop viewport (1440×900): all eighteen sidebar
  destinations click through with nothing hidden and no crash; a fresh card's empty opener → the slot
  picker → Add → lands back on the card overview with the pick in place; a fully-cast slot (opener and main
  event both checked) → match setup, with a stipulation, a pace, and a title stake all toggled successfully
  across the three simultaneous columns, and "Add someone" correctly reopening the picker for that same
  slot; Roster's master-detail (selecting a second row updates the right pane; a role-change button in the
  pane works without leaving the screen); Free Agents' master-detail (selecting an agent shows the full
  read-out plus the sign panel); The competition's master-detail (switching companies and selecting one of
  their wrestlers, including a tappable tag partner). The one console warning seen across the whole pass was
  a missing favicon — a pre-existing, unrelated cosmetic gap, not a regression.
- Verified: `tsc --noEmit` clean; full suite 151 files / 2,923 tests passing (zero changes); `npm run build`
  clean; the live click-through above.
- **Not part of this pass**: every other screen (Office, Promotion, Territories, Finance, Rankings, The
  Sheet, Records, Legacy, The Crucible, Contact sheet, The quiet business, Settings, Show Results, New Game,
  Title, the wrestler Editor) keeps its current single-column phone-shaped layout for now, rendering with
  unused space to the right of it until a follow-up pass gets to them — an accepted, deliberate gap, not an
  oversight. Phase 4 (calendar "this week" indicator, a free-agent "new graduates" filter) remains
  unstarted, small, and unrelated to the pivot.

---

## UX/navigation overhaul, Phase 4 — a this-week calendar strip, and a free-agent reason filter

Last of the four phases from the original plan (`/root/.claude/plans/synthetic-plotting-planet.md`). Both
pieces were already fully scoped from the first research pass, well before the desktop pivot — small,
pure-UI, no engine changes — and stayed exactly that size once actually built.

- **Calendar**: `world.currentCard` is still confirmed a single flat array, not one per future week, so a
  literal "tap any date on the calendar, jump to that night's card" (the mDickie reference's original ask)
  is not buildable without a real future-scheduling data model — out of scope, as flagged from the start.
  The honest version: a new `ThisWeekStrip` component (`src/ui/components/CalendarStrip.tsx`, beside the
  existing schedule-configuration `CalendarStrip`) reuses the same engine-backed `calendarMonths` view the
  configuration screen already draws from, pulls out just the current week's seven nights, and renders them
  read-only — no `onClick`, nothing to tap — in the desktop booking screen's right-hand rail, above the six
  conditional notice panels. It reads real schedule data (a televised night, a house show, a dark night) the
  same way the Office screen's calendar does, so the two can never disagree about what's actually on this
  week. `OfficeScreen.tsx`'s own `CalendarStrip` (the tappable, schedule-editing one) is untouched.
- **Free agents**: a filter chip row above the master-detail list on `FreeAgentsScreen.tsx`, built entirely
  from data that already existed — `FreeAgent.reason: AvailabilityReason` and the `AVAILABILITY_LABELS` map
  (`src/engine/world/freeAgents.ts`) already distinguished `neverSigned` / `contractExpired` / `released` /
  `schoolGraduate` / `walkOn` / `returning`, stamped correctly at intake; nothing on the engine side needed
  to change. "All" plus one chip per reason actually present in the current pool (a reason nobody currently
  has, `walkOn` most weeks, doesn't clutter the row), each labelled with its live count. Filtering re-clamps
  the master-detail selection the same way a re-sort does elsewhere on this screen — the right pane never
  points at somebody the current filter has hidden.
- **Tests**: none added or changed — still no automated UI/component test layer in this codebase; full
  suite (151 files / 2,923 tests) passes unchanged, both pieces being pure UI reading data that was already
  there.
- **Verified live**, `npm run dev` + Playwright: the this-week strip renders the correct seven-night read-out
  for a fresh save (the televised night and a house-show night both marked correctly, matching the header
  text above the card); the free-agent filter chips' counts summed to the pool total, and selecting "Out of
  the school" correctly narrowed the list to exactly the three matching agents with the detail pane updating
  to the first of them.
- Verified: `tsc --noEmit` clean; full suite 151 files / 2,923 tests passing (zero changes); `npm run build`
  clean; the live check above.
- **This closes out the UX/navigation overhaul.** Everything in the original plan — the navigation stack,
  the wrestler-detail screen, the desktop/Steam shell and booking flow, master-detail for the three roster
  screens, and this phase — is shipped. What's left, as flagged throughout, is reflowing the rest of the
  screens for desktop (Office, Promotion, Territories, Finance, Rankings, The Sheet, Records, Legacy, The
  Crucible, Contact sheet, The quiet business, Settings, Show Results, New Game, Title, the wrestler
  Editor) — a real, separate pass, not started here.

## Match viewer — a live action window over an already-decided match

The player sketched this by hand: an optional "watch the match" screen — bottom third two commentators
trading live lines in a chat feed, top two-thirds a ring where wrestler portraits hold poses (never
animating their own shape) that get moved, rotated, and collided via CSS transforms to mimic what's
happening, with comic-style move-name callouts, "BAM!", and pinfall counts. Full plan:
`/root/.claude/plans/synthetic-plotting-planet.md`. **This does not touch §0's "the sim always picks the
winner, no scripted finishes, no re-sims."** The viewer only ever replays a `SegmentResult` already sitting
in `world.showHistory` — nothing here decides anything, the same way the existing prose write-up doesn't.

- **New `src/engine/sim/matchPlayback.ts`** — pure, no new RNG draws anywhere in it. `buildPlaybackTimeline
  (beats, sideA, sideB, winningSide)` turns the sim's prose-only `MatchBeat[]` into `PlaybackBeat[]` (kind,
  a `BeatPose`, an `actorId`/`targetId`, and — only on `signature`/`finish` beats — a `moveName` pulled from
  the actor's own `MoveSet`, never invented). Deliberately re-derives its own tiny copy of the "who's on
  top" flip rule `commentary.ts`'s `callTheMatch` already tracks (loser on top, flip at every `hopeSpot`,
  reset to the winner at `finish`) rather than touching or refactoring `callTheMatch` itself — that function
  turned out to be far more interwoven than expected once actually read (a line budget that can cut its
  beat loop short, an opener/stakes line before the loop and a closer after it belonging to no beat, and
  same-beat "comeback" replies pushing extra lines mid-beat), and extracting a clean per-beat state out of
  it safely would have been a much bigger, riskier change than this feature needed. The honest cost, stated
  plainly rather than quietly fallen short of: the ring visual and the commentary feed are *thematically*
  synced (both agree on who's on top at any point in the match) rather than *line-for-line* synced (a
  specific pose landing on the exact word "suplex").
- **`finishCallout(finish: FinishType)`** alongside it — every `FinishType` gets its own comic-style word
  ("1... 2... 3!", "TAPS OUT!", "COUNTED OUT!", "TIME LIMIT DRAW!", "IT BROKE!", and so on), held on screen
  once the last pose plays.
- **Multi-man is real, not stubbed** — the player asked for every match type including battle royals in the
  first pass, not just singles and tag. `CommentaryContext` (and now `matchPlayback.ts`, matching it on
  purpose) only ever models two corners even for a battle royal, so a multi-man match reduces to "the
  eventual winner" vs. "everyone else" for pose/momentum purposes — the same reduction commentary already
  uses, not a new one. One real, deliberate gap found while reading `narrative.ts`: `orderEliminations`
  (`engine/sim/battleRoyal.ts`) is not beat-timed data — `simulateMatch.ts` only ever feeds it into at most
  two flavor-text beats ("a name goes over partway through," "the field narrows to its final two") and
  never preserves it on `SegmentResult`. The viewer does not animate individual eliminations because the
  engine has nothing to time them against; every entrant sits around the ring for the whole match, the
  current beat's on-top/in-trouble pair is spotlighted at centre (rotating through the field by beat index),
  and the finish reveals the winner plainly. Teaching the sim to emit one real beat per elimination with a
  wrestler id is a legitimate future engine change, not this one.
- **New `src/ui/screens/MatchViewerScreen.tsx`** — reached by a new "▶ Watch" button per match on
  `ShowResults.tsx` (`onWatch`, threaded from `App.tsx` the same way `onContinue` already was), pushed via
  the existing nav stack (`NavTarget.params` gains `matchWeek`/`matchSlot`; `Nav.tsx` gains a `'matchViewer'`
  screen id) with the same defensive "not found" guard every other pushed screen uses for a stale ref. Ring
  layout is one circular arrangement for every match size — two entrants land at left/right, four at the
  corners of a diamond, more spread evenly around the perimeter (capped at 12 visible with a "+N more in the
  ring" chip beyond that) — so singles, tag, and battle royal never needed separate layout code. Each
  portrait sits in two nested wrappers: an outer one carrying its static ring position (so the maths never
  has to fight anything) and an inner one, remounted fresh every beat via a `key`, carrying the one-shot pose
  animation for that beat — `PaperDoll` itself is untouched, still just a `<canvas>` drawn once per prop
  change. Six new one-shot Tailwind keyframes (`ring-jostle`, `ring-whip`, `ring-strike`, `ring-surge`,
  `ring-slam`, `callout-pop`) follow the existing "nothing loops, nothing decorative" convention from
  `tailwind.config.js`'s original three — `ring-slam` deliberately ends mid-rotation so a finisher's target
  visibly lands upside down and stays that way until the next beat remounts them, which is exactly the
  "land upside down" the sketch asked for. The bottom-third commentary feed is a new, small, independent
  `setTimeout` reveal loop (same shape as `CallWindow`'s, a separate implementation rather than a shared or
  modified one, since `CallWindow` is used elsewhere and didn't need touching) rendering `SegmentResult
  .commentary` as alternating chat bubbles — play-by-play left, colour right, each "slightly below" the one
  before it, same as the player's own sketch — and paced independently from the ring so the two beat/line
  tickers roughly finish together without being locked to each other. No commentary team hired means no
  bottom third at all, not an empty one. A single "Skip to the finish" action jumps both tickers to the end
  at once; once both are done, the header's action swaps to "Back to results."
- **Tests**: `src/engine/sim/matchPlayback.test.ts` (7 tests, all pure/deterministic — no RNG in the module,
  so no seeding concerns) — the on-top flip and the winner-reset at finish, the full `BeatPose` mapping
  including the whip embellishment on every third `control` beat, that an environmental beat never gets an
  actor or target, that `moveName` is only ever set on `signature`/`finish` beats and only from the actor's
  own `MoveSet`, and that every `FinishType` earns a distinct callout.
- **Verified live**, `npm run dev` + Playwright at a desktop viewport: booked a genuine 6-way battle royal
  by hand (`setSegmentStipulation('battleRoyal')` + six `setSegmentParticipant` calls across six sides) plus
  an auto-filled singles match, ran the show, and watched both back — the battle royal's ring correctly laid
  out all six entrants in a circle, the finish held the spotlighted pair with one portrait visibly rotated
  upside down under "IT'S OVER!" and a "BAM!" flash; the singles match showed the two-tone commentary chat
  feed updating alongside the ring, "COUNTED OUT!" on that particular roll, and skip-to-finish correctly
  swapping in the "Back to results" action. No console errors either run.
- Verified: `tsc --noEmit` clean; full suite 152 files / 2,930 tests passing (+7 for the new module, zero
  changes elsewhere); `npm run build` clean; the live watch-throughs above.
- **Not part of this pass**: per-elimination beat timing for battle royals (needs a real engine change, see
  above); a scrub bar or pause control (skip-to-finish only, matching `CallWindow`'s existing convention);
  reflowing the rest of the game's screens for desktop (a separate, already-flagged pass).

---

## Real elimination and pinfall identity — the engine change the match viewer above deferred

Direct follow-up to that deferred item ("teaching the sim to emit one real beat per elimination with a
wrestler id is a legitimate future engine change, not this one"). The player's own words on being told the
gap existed: **"yes we must track it. and who gets pinned."** Two things were quietly never decided anywhere
in the sim before this: which specific wrestler goes out of a battle royal at each elimination (and who put
them there), and which specific wrestler takes the fall/tap/knockout at a finish when either side has more
than one member (a tag match, a battle royal's final two) — both silently defaulted to `sideMembers[0]`,
array position rather than a real decision.

- **`engine/types.ts`** — `MatchBeat` gains `actorId?: Id | null` / `targetId?: Id | null` (absent only for a
  genuinely actor-less beat — interference stays a known, documented gap, see below). `MatchBeatKind` gains
  `'elimination'`, its own kind rather than reusing `'control'`, since it carries real per-event identity a
  plain control beat doesn't.
- **`engine/sim/battleRoyal.ts`** — new `pickEliminators(order, sideMembers, week)`, sitting beside
  `orderEliminations` (left byte-for-byte untouched — this is a second, independent decision, not a revision
  of the first). For each elimination, seeds its own `rngFromSeed(\`eliminator:${eliminatedId}:${week}\`)`
  stream and picks uniformly from whoever is still active at that point in the order — never the eliminated
  side's own member, never the shared `rng` `simulateMatch.ts` threads through the winner/finish/rating rolls.
  Per root CLAUDE.md's own documented trap ("adding an RNG draw shifts every seeded roll after it"), this
  guarantees the new decision cannot shift a single existing seeded test or `docs/BALANCE.md` baseline.
- **`engine/sim/simulateMatch.ts`** — assembles a real `EliminationEvent[]` (`{eliminatedId, eliminatedName,
  eliminatorId, eliminatorName}`) from `pickEliminators`'s output, replacing the old name-only
  `eliminatedInOrder: string[][]`. Also decides, the same entity-seeded way (`pinned:${...ids}:${week}` /
  `pinner:${...ids}:${week}`), exactly one wrestler from the loser/winner side to be the one who actually
  took/gave the finish, even when that side has several members — a 1v1 match degenerates trivially to the
  only member, so nothing changes there. The free wins that already carried real identity but never wrote it
  onto their beat (`Botch.workerId`, `PyroBurn.workerId`, the caught-manager DQ) now stamp `actorId` too — no
  new decision, just no longer throwing away one that already existed. `SimulateMatchContext` gained a
  required `week: number` (all 4 real call sites — `store.ts`, `rivalBooking.ts`, `cupRun.ts`,
  `darkMatch.ts` — and the test fixture updated) purely so these new streams have something to seed from.
- **`engine/sim/narrative.ts`** — a small local `onTop`/`inTrouble` momentum tracker (the same flip-at-
  `hopeSpot`, reset-at-`finish` rule already independently duplicated in `commentary.ts` and
  `matchPlayback.ts` — a third small copy, deliberately not shared, for the reasons already accepted for the
  other two) stamps `actorId`/`targetId` on every beat as `generateBeats` writes it. **Text generation is
  completely unchanged** — `fill()`'s `{winner}`/`{loser}` placeholders still resolve off `winnerMembers[0]`/
  `loserMembers[0]` exactly as before, so the prose write-up reads the same; only the new, parallel id
  metadata (used for the match viewer's pose, not the sentence) reflects the real decision. Replaced the old
  two-beat battle-royal scheme with up to `ELIMINATION_BEATS_MAX = 4` real elimination beats, evenly sampled
  across the whole order rather than one beat per fall — a twenty-man field has nineteen eliminations, and
  the reel stays a highlight, not a play-by-play (§11.5). A slot is reserved so the existing "field narrows
  to its final two" milestone beat can't be crowded out by a full house of elimination beats.
- **`data/matchBeats.ts`** — `BATTLE_ROYAL_MIDDLE_BEATS` renamed `BATTLE_ROYAL_ELIMINATION_BEATS` (same
  lines, for when nobody clear did it); new `BATTLE_ROYAL_ELIMINATION_BY_BEATS` for when an eliminator is
  known, using both `{eliminated}` and a new `{eliminatedBy}` placeholder. `BATTLE_ROYAL_FINAL_BEATS`
  untouched.
- **`engine/sim/matchPlayback.ts` + `ui/screens/MatchViewerScreen.tsx`** — `buildPlaybackTimeline` now
  prefers a beat's own `actorId`/`targetId` (resolved against everyone in `sideA`/`sideB`) over the rotation
  guess, falling back to the guess only when a beat genuinely carries neither (interference, for now — see
  the match viewer entry above). New `'elimination'` pose plus a one-shot `ring-eliminated` keyframe. The
  screen tracks which wrestlers have been eliminated so far as `beatIndex` advances and renders their
  portrait greyed/shrunk with an "OUT" tag for every subsequent beat, instead of standing there
  indistinguishable from someone still in it; the finish pose now lands on the real decided pinned/pinner
  pair instead of array position zero.
- **Tests**: `narrative.test.ts`'s battle-royal assertions rewritten for the `eliminations`-driven scheme
  (real ids, a cap-respecting test for a 15-entrant field); new `pickEliminators` tests in
  `battleRoyal.test.ts` (deterministic per `(eliminatedId, week)`, never credits a side with eliminating
  itself, only ever picks someone still active at that point); `matchPlayback.test.ts` gained cases for a
  beat's own ids winning over the guess and the `'elimination'` pose; `simulateMatch.test.ts` gained a
  60-seed tag-match test confirming the pinned/pinner pair lands on the second-listed team member often
  enough to prove it isn't always position zero, and a battle-royal run asserting every `'elimination'` beat
  carries valid, resolvable ids.
- **Verified live**: booked a genuine 6-way battle royal by driving `window.__store` directly (the same
  precedent as the match-viewer entry above — the Card screen's roster picker hard-caps at 2 sides
  regardless of stipulation, a pre-existing UI limit this pass didn't touch), ran the show, and watched it —
  two named wrestlers (not the same two every time) visibly greyed out with an "OUT" tag one at a time as
  eliminations played, while the rest of the field stayed live; a 5-vs-1 handicap main event's finish landed
  the flip/upside-down pose on the actual loser rather than a guess. `tsc --noEmit` clean; full suite 152
  files / 2,941 tests passing (+30 for this change, zero unrelated regressions); `npm run build` clean.
- **Still not decided anywhere**: the interference/distraction beat only ever has a name
  (`ringside.ts`'s `RingsideOutcome.distractionBy`), no matching id field — unlike `caughtBy`/`caughtById`,
  there's no `distractionById` to stamp. Cheap-looking, but touches a subsystem nobody asked about this pass;
  left on the rotation-guess fallback, same as before.

### Follow-up: two visual bugs found reviewing the match viewer

Asked directly "do the commentator graphics, ring, and rest of the screen look good," so it got a real
look — 18 matches watched across 3 weeks, not just the elimination/pinfall scenarios above. Two real defects
turned up in `MatchViewerScreen.tsx`, both fixed:

- **The comic callout collided with the portrait it was about.** `1... 2... 3!`, `KNOCKED OUT!`, `THE REF
  STOPS IT!` and friends were centred across the whole ring panel (`inset-0` + `items-center`), and the
  spotlighted actor/target pull in to a tight radius (70px) right around that same centre — so the callout
  landed squarely on top of whoever it was calling out, covering their face, on essentially every finish.
  Moved it to a pinned strip along the top (`inset-x-0 top-4`) instead, clear of the whole ring circle, plus
  a faint backing so it stays legible over whatever's behind it.
- **A wrestler's name went upside down along with them.** `ring-slam` and `ring-eliminated` rotate a
  portrait a full 180° — the point, for a finisher's target or an elimination — but the animation class sat
  on the same wrapper as the name tag underneath, so the label rotated too and came out as unreadable mirror
  text. Split the wrapper: the animation now lives on an inner div around just the `PaperDoll`, the name tag
  is a sibling that never rotates. The grey/shrink/opacity treatment for an eliminated wrestler stays on the
  outer wrapper (so it still covers the label, which is correct — an eliminated name should read as faded,
  just not sideways).
- **Not fixed this pass, flagged in the answer to the question**: the ring itself has no visual identity at
  all (no ropes/mat/turnbuckles/crowd — wrestlers just float on the panel's plain dark background), long
  names hard-truncate illegibly, the commentators have no graphic beyond a colored name label, and the
  underlying commentary line pools (`data/commentaryLines.ts`) repeat noticeably for facts that are almost
  always true (a `poorMatch` + heel-leaning closer had exactly one line and fired in 7 of 18 watched
  matches; a bare `referee` colour line fired in 4 of 18) — plus a real bug where a debut line can print a
  wrestler's own name as their opponent's when they're the one sitting in `{sideB}`. None of that was asked
  for yet; noted here so it doesn't have to be rediscovered.
- Verified: `tsc --noEmit` clean, full suite 152 files / 2,941 tests passing (no test covered this — it's
  presentation, caught only by watching it), `npm run build` clean, live re-verification of a 6-way battle
  royal's elimination and finish poses confirming both the callout and the label sit correctly now.

### Follow-up: the four items flagged above ("go for it")

- **The ring now has a visual identity.** A mat, three concentric rope borders, and four corner
  turnbuckles, drawn under the wrestlers in `MatchViewerScreen.tsx`, sized to frame the spotlighted pair
  (radius 70) at the centre. Tinted to the promotion's own `theme.edge`/`theme.action` colours rather than a
  fixed color, so it reads as this company's ring, not a generic placeholder. Confirmed live on both a
  normal 2-sided match and a battle royal.
- **Long names no longer hard-truncate.** The name tag was a single-line `truncate` at 80px, which cut
  "Diamond Sundown" down to "Diamond Sun…". Widened to 110px and switched to `line-clamp-2` with
  `break-words`, so a long name wraps onto a second line instead of guessing at it.
- **The commentators now have a graphic, not just colored text.** A small circular avatar with their
  initials (derived from the name, no new data needed — `CommentaryTeam` still carries no portrait field)
  sits next to their name in the feed header and next to every one of their own chat bubbles, tinted to
  match their existing sky/amber bubble color.
- **The debut opponent-naming bug is fixed.** `commentary.ts`'s `filler()` used to resolve `{sideB}` as a
  fixed lookup regardless of which corner the debutant actually sat in, so a debut opener could read
  "Needles has never worked a match for this company, and starts against Needles" whenever the debutant
  happened to be `sideB`'s own first name. Added a dedicated `{debutantOpponent}` placeholder, resolved by
  finding which corner the debutant's name is actually in and naming the other one; the one template that
  combined `{debutant}` with `{sideB}` now uses it. New regression test in `commentary.test.ts` runs both
  placements (debutant on sideA, debutant on sideB) across 40 seeds each and confirms the opener never
  names the debutant as their own opponent either way.
- **Thinned-pool repeats reduced with more content, not new gating logic.** The `poorMatch` + heel-leaning
  `CLOSERS` line ("A win is a win...") was the *only* poor-match closer in the whole file and fired in 7 of
  18 watched matches; added 2 more heel lines, and — since face/analyst colour men had no poor-match closer
  at all before this — 3 face and 2 analyst lines, so those leanings get *something* to say about a bad
  match instead of silence. Added 3 more bare `needs: ['referee']` `COLOUR` lines (that pool had exactly 2)
  gated to different beat phases (`control`, `hopeSpot`/`signature`, `nearFall`/`signature`) so they don't
  all compete for the same slot.
- **Explicitly not touched, and not a bug**: a genuine multi-man match (3+ real sides — a true battle
  royal) gets no live commentary call at all, by design — this was already a deliberate, documented decision
  from an earlier session ("Multi-man live commentary stopped mislabeling the field," above in this file):
  `commentary.ts`'s whole vocabulary is built around exactly two corners, and reworking it to be N-way aware
  was scoped out as "a real, separate project." Worth restating plainly since it means the answer to "is the
  commentary entertaining" for a battle royal specifically is "there isn't any" — the highlight beats (now
  carrying real elimination/pinfall identity, see above) are what a battle royal gets instead.
- **Also found, not fixed**: adjacent-angle crowding in the ring when a field is large (5-6+) and one of two
  angularly-close entrants is spotlighted (pulled to radius 70) while its neighbor sits at the normal radius
  150 — their 120px portraits can visibly overlap. Pre-existing (present before this session's ring
  background made it easier to see), and fixing it properly means re-tuning the radius/spacing math across
  entrant counts, not a small change — left as a follow-up rather than guessed at here.
- Verified: `tsc --noEmit` clean; full suite 152 files / 2,942 tests passing (+1, the debut-opponent
  regression test); `npm run build` clean; live re-verification of both a normal 2-sided match (ring, full
  names, avatars, and the new referee/poor-match lines all visible together) and a 6-way battle royal
  (confirming it still renders correctly with no commentary panel, as designed).

### Follow-up: fixed the ring crowding — sides, not a shared circle

Player's own framing: "you can make the ring bigger. the profile pics don't have to stay in the ring. just a
general thing to look at. I'd rather they start on the sides anyway" — which is also just what the original
sketch actually asked for ("participant profile pics on the sides"). The circular layout from the first pass
put everyone, spotlighted or not, on one shared orbit around the ring; a spotlighted portrait pulled in tight
(radius 70) could land right on top of a same-side neighbour still sitting at the normal radius (150) a few
degrees away; the more entrants a battle royal had, the worse it got.

- **Replaced the circle with two rails and a centre stage.** `sideA` rests down a vertical rail on the left,
  `sideB` down one on the right (plain flex columns — no more per-wrestler angle/radius trig at all). Only
  whoever the current beat's `actorId`/`targetId` actually names ever leaves their rail, rendered instead in
  a small flex row pinned to `left-1/2 top-1/2` — dead centre over the ring regardless of how wide the panel
  is, which a fixed pixel offset from either rail couldn't have guaranteed. For a singles match this reduces
  to exactly what it always looked like (both wrestlers are the beat's actor/target on literally every beat,
  so the rails stay empty and both stand centre stage the whole match) — the fix only changes behaviour once
  a side actually has more than one member with somebody free to rest.
- **Size does the spotlight emphasis, not a CSS scale.** Resting portraits render at `bust` (80px); the
  active pair render at `large` (120px) — swapping the `PaperDoll` size prop, not `transform: scale()`, which
  matters because a scale transform on the same element as the pose animation (`ring-slam`, `ring-eliminated`,
  ...) would have fought it for control of `transform` the same way the upside-down-label bug did two passes
  ago.
- **The ring is bigger.** 300px β†’ 380px, since it no longer has to leave clearance for a field orbiting
  around it.
- **`data-testid="match-ring"` and the rest of the panel chrome are untouched** — this was purely the
  wrestler-positioning internals.
- Verified live: a 10-way battle royal (one side per entrant, so the field reduces to 1-vs-9 the same way
  every multi-man match does — see the two-corner note above) now shows every resting wrestler clearly
  stacked down the right rail with zero overlap, `OUT` tags legible on eliminated names sitting right there
  on the rail, and the active pair squarely centred on the enlarged ring at every beat including the finish;
  re-ran the normal 2-sided case too and confirmed it renders identically to before (both always centred,
  rails empty, nothing regressed). `tsc --noEmit` clean; full suite 152 files / 2,942 tests passing (no test
  covers this screen — presentation, caught only by watching it); `npm run build` clean.
