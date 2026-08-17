# What is still open

Kept here rather than in a chat message so a cold session picks it up in one
read. Roughly in the order it is worth doing.

---

## Decisions waiting on the designer

**Tampering is a trap button.** Measured: about a 12% chance of getting a
gettable target and a 58% chance of being caught, escalating to losing your
television. The code comment says it is *meant* to be a last resort, so this may
be intended — but a button that is never the correct play is dead content
rather than a hard choice. Needs a call: leave it as a deliberate trap, or make
the odds a real, expensive option.

---

## Next up

**Undercard popularity decays with only a weak counter.** Somebody who is never
booked drifts down and the only thing pushing back is an appearances week,
which the office picks conservatively (`assignmentAppearancesBelowPop`). A deep
roster's lower card fades whatever the booker does. Wants measuring against
`--report development` before tuning.

**Set-point pairings can bottom somebody out.** Three people sat at 0 morale in
a measured save. They were long-idle, so it may be correct, but a Never
Satisfied plus No Time For The Office who is also not being booked has almost
no road back. Check whether it reads as unfair in play.

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
