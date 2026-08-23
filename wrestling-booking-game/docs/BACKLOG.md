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
