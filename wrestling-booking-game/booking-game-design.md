# Wrestling Booking Game — Design Specification

**Version:** 1.3 — build-ready
**Purpose:** Complete design spec to hand to Claude Code as the build reference.


---

## 0. How to build this — read first

This document is a **design specification**, not a task list. It describes what
the game is, not the order in which to write it. This section is the working
agreement.

### The one-paragraph version

A phone-first, offline, browser-based wrestling promotion management game. The
player books shows and never watches matches — the simulation decides every
outcome from stats, styles, condition, and whatever the player did to influence
it beforehand. Results arrive as a short highlight write-up. The game runs for
simulated decades, with a roster that ages, declines, retires, dies, and is
replaced.

### Working agreement

1. **Build in milestone order (§23).** Do not start systems from later
   milestones because they seem interesting. M2 must be playable before M3
   begins.
2. **`engine/` is pure.** No React, no state store, no DOM, no `Date.now()`,
   no `Math.random()` — use the seeded RNG. Every simulation function is a pure
   function of `(state, settings, rng)`.
3. **No magic numbers in `engine/`.** Every constant in this document is a
   default that lives in `WorldSettings` (§5) or a data file. If a number is
   hardcoded in a formula, that's a bug.
4. **Build the balance harness in M0, not later (§2).** Balance cannot be tuned
   by hand on a system this interconnected.
5. **When this document is ambiguous, pick the option that produces a harder
   decision for the player, and leave a `// DESIGN:` comment explaining the
   choice.** Do not stall waiting for clarification on small things.
6. **When this document conflicts with itself, the later section wins**, and
   flag it.
7. **Write tests for the sim, not the UI.** Rating calculation, odds, stat
   changes, contract evaluation, event eligibility — these are where bugs hide
   and where they're cheap to catch.
8. **Data over code.** Events, gimmicks, move names, name parts, territories,
   stipulations, and styles all live in `data/` as typed arrays, so content can
   be added without touching logic.

### Never change these without asking

These are locked design decisions. Several are counterintuitive and will look
like bugs or omissions. They are not.

| Locked | Why |
|---|---|
| The sim always picks the winner | No scripted finishes, no re-sims, no overrides. This is the game's core. |
| Odds are shown as words, never percentages | "Heavy favorite," not 78%. Numbers turn booking into arithmetic. |
| The game never warns the player | No "are you sure?" on bad bookings. Finding out is the point. |
| Results appear at the end of the show, all at once | Not match by match. |
| The player never watches a match | Highlights only — 3-5 lines. This is the founding requirement. |
| Stats are shown as bars and trends, never numbers | Precision is engine-only. |
| Titles never change hands in cross-promotional matches | §16. |
| Singles titles are locked to their division | §3.1. Tag titles are not. |
| Booking is week to week | No storyline planner in v1. |
| Fully offline | No network calls anywhere. |

### Definition of done, per milestone

A milestone is complete when:

- Every system in it is reachable and usable from the phone UI
- The balance harness runs 20 simulated years without crashing, and its report
  is inside expected ranges
- The sim functions it introduced have unit tests
- A save from the previous milestone still loads (migrations written)
- It runs at the §2 performance budget on a mid-range phone

### Content to author (not just code)

These data files are real work and are easy to underestimate. Budget for them:

| File | Target volume |
|---|---|
| `data/names.ts` | 400+ first names, 400+ surnames, 200+ epithet nouns/adjectives |
| `data/gimmicks.ts` | 40+ gimmicks with alignment lean, ceiling, territory fit, merch multiplier |
| `data/moves.ts` | Move name grammar plus 150+ components |
| `data/events/*.ts` | **150+ distinct events at v1**, each with 3-6 text variants, trigger conditions, cooldowns, and response options (§20) |
| `data/territories.ts` | 12 territories with capacity, preferences, revenue multipliers |
| `data/stipulations.ts` | 12+ stipulations per §9 |
| `data/styles.ts` | The 12×12 mesh matrix from §3.5 |
| `data/titles.ts` | Title naming grammar components |
| `data/highlights.ts` | Highlight sentence templates keyed by style and beat type |

The event library is the single largest content task and the one most
responsible for whether the game stays interesting past year five. Treat it as
ongoing work, not a one-time task.

### Where to start

1. Read §1 (concept), §2 (tech), §3 (data models), §23 (milestones).
2. Scaffold the project per §2.
3. Write `types.ts` from §3 in full, including every interface referenced
   anywhere in this document.
4. Write `WorldSettings` from §5 with all defaults.
5. Build the seeded RNG and the balance harness skeleton.
6. Then wrestler generation (§6), and print 300 of them to the console.

That is M0. Nothing renders yet, and that's correct.

---

## 1. Concept

A wrestling promotion management game. The player is the booker. They build show
cards, negotiate contracts, manage a roster, run storylines, and expand across
territories.

**The player never wrestles, and never picks who wins.** They set the
conditions — participants, rules, stipulations, card position, ringside
personnel, planted interference — and the simulation resolves the match. The
player can push the odds heavily in one direction, but the outcome is never
guaranteed.

### Design pillars

1. **Book conditions, not outcomes.** Every decision is a probability modifier
   the player can see. Certainty is never purchasable outright (see the
   Creative Control escape hatch, §13).
5. **Legible simulation.** Because the player doesn't watch matches, every
   result must be explainable. Each match produces both a numeric breakdown and
   generated play-by-play narrative.
6. **Distinct, disposable talent.** A generated roster with procedural
   appearance so every wrestler is visually recognizable, ages, declines, and is
   eventually replaced.
7. **Consistency over spikes.** Company rating gravitates toward show quality
   one notch per week. One great show doesn't save you; one bad month sinks you.

### Explicitly out of scope

- **Any in-ring gameplay, watching matches, or match rendering.** This is the
  design's founding complaint about the reference game: being made to watch or
  play the matches gets in the way of booking. Results arrive as a highlight
  write-up with portraits. Nothing in this game ever asks the player to sit
  through a match.
- Controls, cameras, move sets, or 3D anything
- Playing as an individual wrestler (no "wrestler career" mode)
- Real-world names, likenesses, or promotions

---

## 2. Technology

| Concern | Choice | Rationale |
|---|---|---|
| Platform | Web app, browser | Runs on phone and desktop, no install, fast iteration |
| Framework | React 18 + Vite | Component model fits screen-heavy UI |
| Language | TypeScript (strict) | Sim engine is formula-dense; types prevent silent errors |
| State | Zustand with immer | Single game-state store, simple persistence |
| Styling | Tailwind CSS | Fast layout iteration |
| Art | Inline SVG components | Procedural paper-dolls, no asset pipeline |
| Persistence | IndexedDB via `idb-keyval` | Save files grow large over simulated decades |
| RNG | Seeded `mulberry32` | Reproducible sims, debuggable, supports replay |

### Project structure

```
src/
  engine/           # Pure functions, zero React imports. Fully unit-testable.
    rng.ts          # Seeded RNG, dice helpers, gaussian, weighted pick
    generate/       # Wrestler, name, appearance, promotion, territory generation
    sim/            # match.ts, odds.ts, rating.ts, narrative.ts, injury.ts
    economy/        # attendance.ts, gate.ts, payroll.ts, expenses.ts
    world/          # aiPromotions.ts, contracts.ts, storylines.ts, owner.ts
    types.ts        # All shared interfaces
  state/            # Zustand store, save/load, migrations
  ui/
    screens/        # One folder per screen (§20)
    components/     # Shared widgets
    paperdoll/      # SVG layer components (§7)
  data/             # Static tables: name parts, archetypes, stipulations, territories
```

**Rule for Claude Code:** `engine/` must never import from `ui/` or `state/`.
The entire simulation must be runnable headless from a test harness.

### Performance budget

This game simulates decades. A 20-year save is roughly 1,000 weeks × 2 shows ×
~10 segments, across 300+ wrestlers in 6-8 promotions, with AI promotions
simulating their own cards every week.

- **A full week tick, including all AI promotions, must resolve in under 150ms
  on a mid-range phone.** AI shows skip narrative generation and use a reduced
  rating path.
- Save size target: **under 8MB at 20 simulated years**, achieved by
  compressing show history older than a year to summary rows and storing
  wrestlers as compact numeric records.
- Statistics are maintained incrementally as events occur, never recomputed by
  scanning history.
- The roster screen must render 60 paper-doll busts without jank — render
  sprites to cached canvases once and reuse the bitmaps.

### Balance test harness

A headless CLI (`npm run sim`) that runs N simulated years with an automated
booker and reports:

- Rating distribution — are 5-star matches appropriately rare?
- Popularity curves — does the world inflate or deflate over 20 years?
- Injury rates, retirement ages, career lengths
- Promotion solvency — how often does the player-equivalent go broke?
- Event frequency and repetition — did any event fire twice in its cooldown?
- Title reign lengths and turnover
- Whether AI promotions ever fold, and how often

**Balance is the hardest part of this game and cannot be tuned by hand.** Build
the harness at M0 and run it after every change to the sim.

---

## 3. Core data models

### Wrestler

```ts
interface Wrestler {
  id: string;
  name: string;              // Ring name
  nickname?: string;

  // Core stats, 0-100, matching the reference game
  popularity: number;        // Draw power, rating ceiling, crowd reaction
  strength: number;          // Power offense, dominance
  skill: number;             // Technique, counters, match quality
  agility: number;           // Speed, high spots
  stamina: number;           // Endurance, injury resistance, weekly recovery
  attitude: number;          // Backstage conduct, loyalty, morale stability
  charisma: number;          // Mic work / voice skill — see §3.9
  talent: number;            // 0-100 natural ability. Mostly hidden. See §3.8
  coachability: number;      // How fast they improve, and whether they take direction
  toughness: number;         // Injury resistance and willingness to take hits

  // Dynamic state
  health: number;            // 0-100. Physical condition. Below 60 = visibly hurt. 0 = out.
  energy: number;            // 0-100. Freshness. Drains with bookings and travel, not damage.
  morale: number;            // 0-100
  momentum: number;          // 0-100, recent win/loss/segment quality
  cardStatus: CardStatus;    // Where they belong on the card — see §3.6
  crowdReaction: number;     // -100..100, how fans ACTUALLY react vs booked alignment
  mood: Mood;                // Distinct from morale — see §20
  alignment: number;         // -100 (heel) .. +100 (face). |value| < 15 = tweener

  // Identity
  age: number;
  debutYear: number;
  gender: 'm' | 'f';
  weightLbs: number;         // Real number, drives weight-class eligibility
  weightTarget: number | null;  // Set when cutting or gaining — see §3.2
  heightIn: number;
  archetype: Archetype;      // Body/role tendency — drives stat generation
  style: WrestlingStyle;     // In-ring style — drives match chemistry, §3.5
  secondaryStyle?: WrestlingStyle;  // Hybrids; adds mesh flexibility
  gimmick: Gimmick;          // Named character concept, changeable — see §20
  isCreated: boolean;        // Player-made vs generated
  homeTerritoryId: string;
  appearance: Appearance;    // §7

  // Employment
  promotionId: string | null;   // null = free agent / wrestling school
  contract: Contract | null;
  role: StaffRole;           // wrestler | manager | referee | announcer
                             // | roadAgent | trainer | owner  — see §20

  // History
  record: { wins: number; losses: number; draws: number };
  titleReigns: TitleReignRecord[];
  injury: Injury | null;
  careerHighPopularity: number;
}
```

### Archetypes

Each archetype biases generated stats and determines which stipulations suit
the wrestler. Stat biases are additive modifiers applied after the base roll.

| Archetype | Str | Skl | Agi | Sta | Favored stipulations | Notes |
|---|---|---|---|---|---|---|
| Powerhouse | +18 | −6 | −14 | +4 | No-DQ, Last Man Standing | Poor in long time limits |
| Technician | −6 | +20 | 0 | +6 | Submission, Iron Man, 60-min | Best long-match performer |
| High Flyer | −12 | +4 | +22 | −4 | Ladder, Multi-man, Cruiser | Higher injury rate |
| Brawler | +10 | −2 | −4 | +8 | Hardcore, Street Fight | Thrives without rules |
| Showman | −4 | +2 | +6 | 0 | Any; +pop growth | Best promo performer |
| Monster | +24 | −12 | −18 | +10 | Squash, Handicap | Rating penalty in long matches |
| Veteran | 0 | +14 | −10 | −6 | Any | Ages faster, high attitude |
| Rookie | 0 | −10 | +4 | +6 | Undercard | High growth rate |

### Contract

```ts
interface Contract {
  type: ContractType;        // See below
  weeklyRate: number;        // Paid per appearance
  weeksRemaining: number;
  totalWeeks: number;
  clauses: Clause[];
  signedYear: number;
}

type ContractType =
  | 'fullTime'         // Available every week
  | 'partTime'         // Available every other week
  | 'perAppearance'    // No retainer; paid only when booked, can decline
  | 'developmental'    // School contract, cheap, trains but rarely appears
  | 'legends';         // Special appearances only, 4-6 times a year

type Clause =
  | 'ironClad'         // Cannot be released without full buyout
  | 'noCompete'        // On release, goes to school, cannot sign with rivals for 12 wks
  | 'titlePush'        // Complains if not holding a title within 12 weeks
  | 'creativeControl'  // Player cannot script their loss; they can veto stipulations
  | 'nepotism'         // Must appear on every show or morale drops hard
  | 'immediateStart'   // No delay before debut
  | 'incentive'        // +25% fee for main event, +50% for title matches
  | 'downside'         // Paid 50% of rate even when not booked
  | 'creativeFreedom'  // Chooses own alignment; player cannot force turns
  | 'payPerView'       // Double fee on PPV events
  | 'healthInsurance'  // Promotion pays all medical bills; refusing costs morale
  | 'guaranteedDates'  // Must be booked N times per month or paid anyway
  | 'travelCovered'    // Promotion pays their travel on territory tours
  | 'merchandiseCut'   // They take a % of their merch; costs the promotion
  | 'noHardcore'       // Cannot be booked in violence level 3+ stipulations
  | 'noJobbing'        // Cannot lose to anyone 20+ popularity below them
  | 'releaseClause'    // They can walk at any time for a fixed buyout
  | 'partTime'         // Half the appearance fee, but only available 1 wk in 3
  | 'exclusivity'      // Cannot work for any other promotion
  | 'trainerRole'      // Doubles as a trainer: +stat growth for rookies
  | 'rematchClause';   // Automatic title rematch if they lose the belt
```

### Title

```ts
interface Title {
  id: string;
  promotionId: string;
  name: string;
  tier: 'world' | 'secondary' | 'tertiary' | 'tag' | 'trios' | 'hardcore'
      | 'television' | 'cruiserweight';
  division: 'mens' | 'womens' | 'open';   // LOCKED at creation, see §3.1
  weightClass: WeightClass;               // See §3.2 — may be 'open'
  lineageProtected: boolean;              // Cannot change hands in cross-promo matches
  vacant: boolean;
  prestige: number;          // 0-100, moves with the caliber of its holders
  currentHolderIds: string[];
  reignStartWeek: number;
  history: TitleReignRecord[];
  colorway: { strap: string; plate: string };
}
```

### 3.1 Divisions and title naming

**Every title is named.** Titles are generated per promotion from a naming
grammar and are fully renameable by the player at any time.

```
[Promotion prefix?] + [Scope] + [Qualifier?] + [Rank]

Scope:      World, International, Global, Intercontinental, National,
            Continental, Universal, Pan-American, Openweight
Qualifier:  Heavyweight, Junior Heavyweight, Cruiserweight, Television,
            Hardcore, Tag Team, Trios, Women's
Rank:       Championship, Title
```

Examples the generator should produce: *World Heavyweight Championship*,
*International Television Title*, *Women's Global Championship*, *Junior
Heavyweight Championship*, *World Tag Team Championship*. Each gets a generated
belt colorway and can be redesigned in the editor.

**Title count is a promotion's identity.** There is no fixed number. A stripped-
back promotion might run one world title and nothing else, and be respected for
it. Another might carry nine belts across five weight classes. Both are valid,
and AI promotions are generated with varying counts and philosophies so the
world feels differentiated — one is known for its cruiserweight division,
another has no tag division at all.

A new promotion starts with 2-4 titles depending on roster size, and can
**create new titles at any time** (costs money to commission the belt, starts
at low prestige, and needs a tournament or a marquee match to establish it) or
**retire** one. Every title can be **renamed by the booker at any time**,
though renaming a prestigious title costs some of its prestige — the lineage
carries over but the fans need time to accept the new name.

### 3.2 Weight classes

```ts
type WeightClass =
  | 'open'              // Any weight
  | 'lightweight'       // under 190 lbs
  | 'juniorHeavy'       // 190 - 215
  | 'lightHeavy'        // 215 - 240
  | 'heavyweight'       // 240 - 275
  | 'superHeavy'        // 275+
  | 'custom';           // Booker-defined lbs range
```

Titles may be assigned any class, including a **custom lbs range** the booker
defines. A promotion can build its identity around a division — a company known
for its light heavyweight championship draws different talent and different
territory reactions than one that only crowns giants.

Weight class eligibility is enforced at booking time: a wrestler outside the
range cannot be added to that title match.

### Weight changes — a real cost in time

A booker can ask a wrestler to move classes. This is not instant.

```
maxChangePerWeek = 8 lbs (cutting) | 6 lbs (gaining)
```

- While cutting or gaining, the wrestler is **unavailable for all bookings**.
  A 20 lb cut costs roughly 2-3 weeks of their availability.
- The request runs the same refusal check as any other (§18) — attitude,
  coachability, ego, and clauses. Some flatly refuse.
- Cutting weight costs stamina and toughness temporarily (−6 each, recovering
  over 4 weeks) and raises injury risk for 6 weeks after. Gaining costs agility
  (−5) but adds strength (+4), and those changes are permanent-ish.
- Aggressive repeated cuts damage long-term health and shorten careers.
- Wrestlers also drift in weight naturally with age, and may cross a class
  boundary on their own — potentially making a champion ineligible for the belt
  they hold, which forces a decision.

### Vacant titles

A title becomes vacant when a champion **dies, has their contract expire, is
released, retires, or suffers a long-term injury** — or when the booker strips
them deliberately.

The booker decides how it's filled, with no restriction:

- A tournament of any size
- A single match between two chosen contenders
- A battle royal or multi-man match
- Simply awarding it to someone (fast, but costs the title prestige and annoys
  the locker room)
- Leaving it vacant indefinitely — the belt loses 3 prestige per week, but a
  long vacancy makes the eventual crowning match a bigger event

Vacancy and how it was resolved is recorded permanently in the title's lineage.

### 3.3 Move sets and finishers

The highlight write-ups name real moves, so every wrestler needs a move set.

```ts
interface MoveSet {
  finisher: Move;            // The one that ends matches
  secondaryFinisher?: Move;  // Unlocked by skill, used as a near-fall
  signatures: Move[];        // 2-4 recognizable spots
  style: MoveStyle;          // power | technical | aerial | strike | brawl
}

interface Move {
  name: string;              // Generated or player-named
  type: 'slam' | 'suplex' | 'submission' | 'strike' | 'aerial' | 'driver'
      | 'stunner' | 'powerbomb' | 'clothesline';
  damage: number;            // Feeds finish selection in the sim
  risk: number;              // Injury contribution to both parties
  crowdPop: number;          // Rating contribution when it lands
}
```

Move names are generated from a grammar (`[Adjective?] [BodyPart/Concept]
[MoveNoun]` — "Crimson Driver," "Steel Trap," "Backbreaker Bomb") and are fully
**renameable by the player**. A finisher's `crowdPop` grows the more it wins
matches — a protected finisher becomes an event in itself, and a finisher that
keeps failing to end matches loses its aura.

High-risk finishers (aerial, driver) do more damage and pop the crowd harder
but carry real injury risk to both wrestlers. The booker can ask a wrestler to
change or retire a move — the same refusal check applies.

### 3.4 Gimmicks and staleness

A gimmick is a named character concept independent of archetype: *Grizzled
Veteran, Cult Leader, Corporate Stooge, Backwoods Brawler, Luchador, Rich Snob,
Silent Monster, Party Animal, Conspiracy Theorist, Failed Athlete, Prodigy,
Mercenary, Preacher, Rockstar, Biker, Everyman.*

Each gimmick has:
- An **alignment lean** (some only work as heel, some only as face)
- **Popularity ceiling and growth rate** — a great gimmick raises the ceiling
- **Territory fit** — some regions love a luchador, some don't
- **Merch appeal multiplier**

**Gimmick freshness decays.** Every gimmick starts at 100 and loses roughly
0.8/week, faster with heavy TV exposure and faster still if the wrestler is
losing. Below 50, the wrestler stops gaining popularity. Below 25, they start
losing it and will complain in the office.

Refreshing an act:
- **Repackage** (new gimmick, new look, new name) — resets freshness to 100 but
  costs 20% of current popularity and needs the wrestler's buy-in
- **A turn** — heel to face or back, resets freshness to 85
- **A big feud or title run** — a hot rivalry restores freshness naturally
- **Time away** — an injury or a written-off absence restores 2/week

This is the system that prevents a decades-long save from stagnating with the
same twelve acts. It forces the booker to keep reinventing.

### 3.5 Wrestling styles and how they mesh

**Style is separate from archetype.** Archetype describes what a wrestler *is*
(body type, career stage, stat tendencies). Style describes how they *work*, and
it is the single biggest driver of whether two wrestlers produce a good match.

```ts
type WrestlingStyle =
  | 'bruiser'        // Stiff, physical, grinding
  | 'technical'      // Mat wrestling, holds, counters
  | 'highFlyer'      // Aerial, fast, spectacular
  | 'powerhouse'     // Slams, throws, dominance
  | 'striker'        // Kicks and strikes, MMA-flavored
  | 'luchador'       // Rapid-fire lucha exchanges, ropes work
  | 'submission'     // Limb targeting, methodical destruction
  | 'hardcore'       // Weapons, blood, plunder
  | 'showman'        // Crowd work, comedy, character over workrate
  | 'giant'          // Immobile monster, short dominant matches
  | 'allRounder'     // Adaptable, no strong preference
  | 'oldSchool';     // Slow build, psychology, heat segments
```

Each style carries: preferred match length, stat weighting in the sim, injury
profile, territory appeal, and archetype affinity.

### The style mesh matrix

Two styles in a match produce a **mesh score** from −12 to +12, applied directly
to the match rating. This is the mechanic that makes booking a *craft* rather
than a popularity sort — two 80-popularity wrestlers with clashing styles will
produce a worse match than two 60s who fit together.

|  | Bruiser | Technical | HighFlyer | Powerhouse | Striker | Luchador | Submission | Hardcore | Showman | Giant | OldSchool |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Bruiser** | +4 | +6 | +7 | +5 | +9 | +2 | +5 | +8 | +1 | +6 | +8 |
| **Technical** | +6 | +11 | +6 | +3 | +5 | +5 | +12 | −8 | +1 | −4 | +9 |
| **HighFlyer** | +7 | +6 | +8 | +11 | +6 | +10 | +2 | +4 | +3 | +12 | +4 |
| **Powerhouse** | +5 | +3 | +11 | −6 | +4 | +9 | +2 | +5 | +3 | −9 | +6 |
| **Striker** | +9 | +5 | +6 | +4 | +7 | +4 | +8 | +3 | 0 | +5 | +5 |
| **Luchador** | +2 | +5 | +10 | +9 | +4 | +9 | +1 | −2 | +4 | +10 | +1 |
| **Submission** | +5 | +12 | +2 | +2 | +8 | +1 | −3 | −10 | −2 | −3 | +8 |
| **Hardcore** | +8 | −8 | +4 | +5 | +3 | −2 | −10 | +6 | +2 | +4 | +1 |
| **Showman** | +1 | +1 | +3 | +3 | 0 | +4 | −2 | +2 | −5 | +2 | +5 |
| **Giant** | +6 | −4 | +12 | −9 | +5 | +10 | −3 | +4 | +2 | −12 | +5 |
| **OldSchool** | +8 | +9 | +4 | +6 | +5 | +1 | +8 | +1 | +5 | +5 | +7 |

The logic behind the extremes, which the player should be able to intuit:

- **Giant vs High Flyer (+12)** — David and Goliath is the oldest great match in
  wrestling. Same for Powerhouse vs High Flyer.
- **Technical vs Submission (+12)** — two mat wrestlers telling a limb story.
- **Giant vs Giant (−12), Powerhouse vs Powerhouse (−6)** — two immovable
  objects produce a slow, ugly match.
- **Submission vs Hardcore (−10)** — one is trying to work a hold while the
  other is swinging a chair. Nothing connects.
- **Showman vs Showman (−5)** — two acts, no match.

`secondaryStyle` lets a hybrid take the better of the two mesh scores at 70%
weight, which is what makes all-rounders and hybrids quietly valuable — they
make everyone else look good.

### Multi-man matches

Mesh is computed pairwise across all participants and averaged, so one badly
clashing style drags a whole six-man down.

### Style also affects

- **Preferred match length**: Giants and Powerhouses lose rating past 15
  minutes; Technical and Old School gain up to 30; High Flyers peak around 18.
- **Injury profile**: High Flyer and Hardcore carry the highest base injury
  rates; Old School and Showman the lowest.
- **Territory appeal**: territory preferences (§4) key directly off style.
- **Stat weighting in the sim** (§11.1) is selected by style, not just rules.

### Changing style

A wrestler can be trained into a new style — it takes **10-16 weeks of
dedicated training**, during which they're available but working below their
level (−8 rating on their matches). Success depends on coachability, age, and
whether the new style suits their body (a 300-pound powerhouse will not become
a luchador).

Style also **drifts naturally with age**: high flyers become bruisers or
technical wrestlers as their knees go, strikers become old-school workers. This
is a natural, automatic transition around ages 33-38 that the player can accept
or fight.

### 3.6 Card status and the push hierarchy

```ts
type CardStatus = 'mainEventer' | 'upperMidcard' | 'midcard' | 'lowerCard'
                | 'enhancement' | 'prospect';
```

Card status is **assigned by the booker**, not derived. It sets expectations in
both directions and is the missing link the rating formula's `jobberDrag` term
depends on:

- Booking someone **below** their status: morale −6, and if it persists they ask
  about it in the office. Repeated, it's a burial and they'll want out.
- Booking someone **above** their status: no morale penalty (everyone wants the
  spot), but the rating takes a hit if their popularity can't carry it. This is
  the `jobberDrag` penalty — pushing an unready wrestler into the main event
  produces a bad match and a bad show.
- Status can be raised or lowered at will; **lowering it is an office
  conversation**, and nobody accepts a demotion happily.
- Popularity drifts toward the level implied by status over time, so a push
  genuinely works — slowly, and only if the matches deliver.

Status also drives AI promotions' poaching targets and contract expectations.

### 3.7 Crowd reaction vs booked alignment

`alignment` is what the booker *says* they are. `crowdReaction` is how the fans
actually respond, and the two drift apart on their own.

- A charismatic heel who keeps winning great matches drifts positive — fans
  start cheering him regardless of the booking.
- A face who's shoved down the audience's throat with unearned pushes drifts
  negative.
- When the gap exceeds 50 points for 6+ weeks, the game surfaces it: *the fans
  have decided.* The booker can go with it (a free, organic turn that resets
  gimmick freshness to 90 and adds popularity) or fight it (the wrestler's
  segments take a −6 rating penalty until the gap closes or the booker relents).

This is one of the best sources of unplanned story in real wrestling, and it
costs almost nothing to implement.

### 3.9 Voice skill

`charisma` is displayed as **Mic Work** and is a headline attribute, not a
secondary one — it is ranked, tracked, and leaderboarded alongside popularity.

What it drives:

- **Promo and interview quality** — the primary input, ahead of popularity
- **How fast popularity grows** from talking segments rather than matches
- **Manager value** — a manager's mic work is most of their worth
- **Merchandise** — catchphrases sell shirts; high charisma adds a merch multiplier
- **Conversion to announcer** — a viable second career
- **Crowd reaction drift** (§3.7) — great talkers get cheered regardless of
  which side they're booked on, which is how unplanned face turns start

The **Best Talkers** leaderboard sits in the Database next to the popularity
rankings. Discovering that your fourth-best wrestler is your best talker should
change how you book him — put him on the mic, pair him with a silent monster,
or convert him to a manager and let him carry someone else's act.

A wrestler with high mic work and low in-ring stats is a legitimate build, not
a failure state. So is the reverse — which is what managers exist to solve.

### 3.8 Talent — the hidden variable

**Talent is what separates two rookies with identical stat bars.** It is a
single 0-100 number that governs a wrestler's ceiling and how fast they climb
toward it.

```
potentialPerStat = clamp(currentStat + (talent - 40) * 0.9 + gaussian(0, 8), 5, 99)
growthRate       = 0.4 + (talent / 100) * 1.2
```

- **Mostly hidden.** The player never sees the number. What they see is a
  **scouting grade** — a letter (D through A+) with a margin of error that
  narrows the more the wrestler works and the more money is spent scouting.
- A 65-popularity wrestler with 85 talent is a future world champion nobody
  else has noticed. A 65-popularity wrestler with 25 talent is exactly what he
  will always be. **They look identical on the roster screen.**
- Talent affects: how much stat gain a wrestler gets from every match and
  training session, how high their ceiling sits, how well they adapt to a style
  change, and how gracefully they age.
- High talent + low coachability is the classic frustrating prospect: enormous
  ability, won't listen, improves at a fraction of what he should.
- Low talent + high charisma is entirely viable — a limited worker who is a
  massive draw. The game should never treat talent as the only thing that
  matters.

Talent is fixed at generation and never changes. This is the reason to gamble
on unproven school graduates, and the reason a rival signing your castoff can
turn them into a main eventer.

### Division rules — LOCKED

- The **women's division has its own separate titles**, on the same tiers as
  the men's (world, secondary, tag).
- **Intergender matches are allowed** as normal bookings.
- **Singles titles stay locked to the division they were created with.** A
  men's singles title cannot be won by a woman, and vice versa — this is
  enforced at booking time, not left to the sim. A wrestler outside the title's
  division simply cannot be added to that title match.
- **Tag titles are the exception**: a mixed-gender team *can* win the tag
  titles. Tag championships default to `division: 'open'`.
- The player may create a title with `division: 'open'` deliberately (a true
  openweight championship), and territory preferences respond to it —
  some regions love it, some reject it.
- `womensDivision` in settings controls whether women's titles are generated at
  world creation at all; the intergender and tag rules above are constant.

`prestige` drifts each week toward the popularity of its current holder(s), at
2 points/week. A vacant title loses 3 prestige/week. Title prestige feeds the
match rating bonus and the attendance draw.

### Rivalry

```ts
interface Rivalry {
  id: string;
  participantIds: string[];
  heat: number;              // 0-100
  startWeek: number;
  lastAdvancedWeek: number;
  matchesContested: number;
  blowoffBooked: boolean;
}
```

Heat decays 3/week if not advanced. Heat above 70 unlocks grudge stipulations.
Resolving a rivalry with a decisive blowoff converts heat into a popularity
bonus for the winner.

### How rivalries start

Four routes, all valid:

1. **The booker declares it** — book a promo with the "start a feud" topic, or
   simply put two wrestlers together and keep doing it.
2. **Real-life relationships** — a breakup, a betrayal, a backstage fight, a
   friend signing with a rival. These generate rivalries the player didn't ask
   for, sometimes between people they never intended to pair.
3. **Repeat matches** — two wrestlers meeting three times in a short span
   organically generates a rivalry at heat proportional to how good those
   matches were.
4. **Emergent incidents** — a stiff shot, an injury caused, a run-in, a title
   screwjob.

### Heat requires reception — the crucial rule

**Heat is not granted by booking; it is earned by reaction.** Every heat gain
above is multiplied by how well the segment landed:

```
heatMultiplier = clamp((segmentRating - 35) / 40, 0.0, 1.6)
```

A 1-star promo between two wrestlers nobody cares about generates almost no
heat no matter how many times the player books it. A 4-star match between two
over talents generates a great deal. **It isn't a rivalry if nobody cares** —
the player cannot manufacture a main-event feud out of two jobbers by force of
booking alone. They have to get the participants over first.

Rivalry heat is also displayed with a crowd-interest label ("nobody's biting,"
"they're starting to care," "white hot") rather than a raw number.

### Show / Segment

```ts
interface Show {
  id: string;
  promotionId: string;
  week: number;              // Absolute week index since game start
  type: 'tvTaping' | 'ppv' | 'houseShow' | 'charity';
  territoryId: string;
  segments: Segment[];       // 6 for TV, 10 for PPV, 4 for house/charity
  attendance: number;
  ticketPrice: number;
  gate: number;
  payroll: number;
  showRating: number;        // 0-100 internal
  showStars: number;         // 0.5-5.0 displayed
  broadcast: boolean;
}

interface Segment {
  slot: number;              // 0 = opener ... last = main event
  kind: 'match' | 'promo' | 'interview' | 'angle';
  subjectId?: string;        // For interviews: who is being elevated
  participants: SegmentRole[];
  rules: MatchRules;         // §9
  stipulation: StipulationId | null;
  titleIds: string[];        // Titles on the line
  deckStacking: DeckStacking; // §10
  result: SegmentResult | null;
}

interface SegmentRole {
  wrestlerId: string;
  side: number;              // 0, 1, 2... for teams; -1 for non-competitors
  role: 'competitor' | 'manager' | 'referee' | 'announcer' | 'lumberjack';
}
```

### Promotion

```ts
interface Promotion {
  id: string;
  name: string;
  isPlayer: boolean;
  rating: number;            // 0-100 — the TV ratings ladder position
  bankBalance: number;
  rosterIds: string[];
  titleIds: string[];
  ownedTerritoryIds: string[];
  homeTerritoryId: string;
  styleProfile: StyleProfile; // Promotion identity — see below
  bookingCredibility: number; // 0-100, §13
  reputation: number;         // 0-100 locker room reputation, §19
  ownerId: string;           // A Wrestler record with role 'owner'
}
```

---

## 4. World structure

**`StyleProfile`** defines a promotion's identity and is chosen by the player at
world creation:

```ts
interface StyleProfile {
  preferredStyles: WrestlingStyle[];   // Who they sign and push
  violenceTolerance: number;           // 0-100, hardcore appetite
  workrateVsStarPower: number;         // 0 = pure workrate, 100 = pure charisma
  divisionFocus: ('mens'|'womens'|'tag'|'cruiser')[];
  promoHeavy: boolean;                 // Talk-driven vs match-driven shows
}
```

It affects which free agents want to sign, which territories respond, which
sponsors approach, and how AI promotions book. Two promotions with opposite
profiles competing for the same territory is a good rivalry.

- **12 territories** on a world map (see `data/territories.ts`). Each has:
  `following` per promotion (0-100), `capacity` (2,000-18,000), `revenueMult`
  (0.8-1.4), and `preferences` — a set of weighted likes/dislikes drawn from:
  faces, heels, hardcore, technical, high-flying, women's wrestling, long
  matches, star power.
- **6-8 promotions**, one player-controlled. AI promotions run their own shows
  weekly (simulated abstractly, §16), climb or fall in rating, and compete for
  talent and territory.
- **Wrestling school** — the free agent pool and the lifeblood of a decades-long
  save. Released talent lands here, and **new trainees appear randomly every
  few weeks**, unannounced and unscouted. Their stats, gimmicks, coachability,
  and attitude all vary wildly — most are useless, a few are future main
  eventers, and the player can only tell by signing them cheap and finding out.
  Roughly 40 present at any time. Scouting a trainee costs money and reveals
  their stats within a margin of error that narrows with what you spend.
- **Target roster size: 35.** Over 45 or under 22 triggers owner complaints and
  morale problems.

---

## 5. World creation and settings

Every number in this spec is a **default, not a constant**. The game opens with
a world-creation screen, and all of it lives in a `WorldSettings` object that
the engine reads rather than hardcoding. Anything tuned in this document should
be reachable from here.

### Presets

Four one-tap presets that write the underlying values, plus **Custom**:

| Preset | Starting cash | Roster | Rivals | Chaos | Notes |
|---|---|---|---|---|---|
| Territory Days | $25,000 | 18 | 7 | High | Scrappy, cash-poor, brutal |
| Standard | $75,000 | 30 | 6 | Normal | The intended experience |
| Big Money | $400,000 | 40 | 5 | Low | Sandbox, build a super-promotion |
| Sink or Swim | $8,000 | 12 | 8 | Very high | Survival mode |

### Settings groups

**Money and economy**

```ts
startingCash: number;              // $5,000 - $2,000,000, default 75,000
startingCompanyRating: number;     // 30 - 90, default 55
weeklyExpenseRate: number;         // 0% - 5% of net worth, default 2%
expenseCapPctOfRevenue: number;    // 0-100%, default 50%
ticketPriceBase: number;           // default $4
ticketPricePerSegment: number;     // default $1
salaryInflation: number;           // 0-3% per simulated year, default 1%
bankruptcyGraceWeeks: number;      // 0 = instant, default 4
tvDealsEnabled: boolean;           // default true
arenaTiersEnabled: boolean;        // default true
```

**Roster and talent**

```ts
startingRosterSize: number;        // 8 - 60, default 30
targetRosterSize: number;          // drives owner complaints, default 35
freeAgentPoolSize: number;         // default 40
talentQualityCurve: number;        // -2 .. +2, shifts every generated stat mean
starDensity: number;               // 0-1, how many main-eventers exist, default 0.07
womensDivision: 'off' | 'separate' | 'intergender';  // default 'separate'
agingEnabled: boolean;             // default true
deathsEnabled: boolean;            // default true
retirementEnabled: boolean;        // default true
regenerateTalent: boolean;         // replace departures, default true
```

**Contracts** (see §15 for the full negotiation model)

```ts
contractLengthMin: number;         // weeks, default 12
contractLengthMax: number;         // weeks, default 104
contractLengthDefault: number;     // default 52
allowedClauses: Clause[];          // any clause can be disabled world-wide
clauseAvailability: 'all' | 'starsOnly' | 'none';
buyoutsEnabled: boolean;
poachingAggression: number;        // 0-2, how hard rivals raid you, default 1
demandStrictness: number;          // 0-2, how hard talent negotiates, default 1
```

**Booking and simulation**

```ts
// outcomeMode is LOCKED to 'simulated'. Not a setting.
resimAllowed: false;               // LOCKED. Reloading a save is the only redo.
warningsEnabled: false;            // LOCKED. The game never warns you.
oddsClampMin: number;              // default 0.08
oddsClampMax: number;              // default 0.92
simVariance: number;               // stdev on the rating roll, default 6.5
segmentsPerTV: number;             // default 6
segmentsPerPPV: number;            // default 10
broadcastWindowTV: number;         // minutes, default 120
broadcastWindowPPV: number;        // default 180
ratingLadderStepPerWeek: number;   // default 1 (2 after PPV)
defaultMatchLength: number;        // minutes, default 12
houseShowsEnabled: boolean;        // default true
tournamentsEnabled: boolean;       // default true
promoSlotsPerCard: number;         // default 2
```

**Chaos**

```ts
chaosLevel: number;                // 0 - 3, ONE slider for everything.
                                   // Scales event frequency, injury rate, and
                                   // shock severity together. No per-category
                                   // toggles — one dial, clearly labeled.
ownerMandatesEnabled: boolean;
ownerPatience: number;             // strikes before firing, default 3
```

**World**

```ts
rivalPromotionCount: number;       // 2 - 12, default 6
territoryCount: number;            // 6 - 20, default 12
startingTerritories: number;       // default 1
startingYear: number;              // default current
seed: string;                      // manual entry for reproducible worlds
rivalsCanGoBankrupt: boolean;      // default true
secondGenerationEnabled: boolean;  // default true — wrestlers' kids debut later
relationshipsEnabled: boolean;     // default true (romance, families, feuds)
hallOfFameEnabled: boolean;        // default true
```

### Starting position

*LOCKED:* the player starts as a **new promotion trying to grow** — not
inheriting an established company. At world creation the player:

1. Names the promotion and picks its colors, logo style, and home territory
2. Chooses a starting style profile (this biases which talent will want to sign
   and which territories respond)
3. Sets starting cash and roster size from the settings above
4. Signs an initial roster from the school and the free agent pool, within
   budget — the first real decision of the game
5. Creates their booker character (appearance, name, and whether they intend to
   appear on shows)
6. Optionally creates wrestlers by hand to seed into the world

Established rival promotions already exist and are already bigger. Growth from
the bottom is the arc.

### Rules for implementation

- `WorldSettings` is written once at world creation and stored in the save.
- A **Settings** screen allows editing a safe subset mid-game (chaos frequency,
  aging, deaths, autosave, display options). Economy and world-shape values are
  locked after creation to keep records meaningful.
- Every engine function takes settings as a parameter. No magic numbers anywhere
  in `engine/`.
- Custom presets can be saved and re-used.
- **Multiple independent worlds** run side by side, each with its own save,
  settings, seed, and records. The world select screen shows each one's
  promotion, year, rating, and bank balance.

---

## 6. Wrestler generation

### Name generation

Two-part markov-ish assembly from curated word lists in `data/names.ts`:
- **Pattern A (60%):** `[FirstName] [LastName]` — e.g. "Buddy Buchanan"
- **Pattern B (25%):** `[EpithetNoun]` or `[Adjective][Noun]` — e.g. "Midwinter",
  "Boomtown", "Needles"
- **Pattern C (15%):** `[Title] [Name]` — e.g. "Sergeant Acer", "Major Merc"

Reject any generated name matching a real wrestler blocklist in
`data/blocklist.ts`. Reject duplicates within the active world.

### Stat rolls

1. Pick a **tier** by weighted roll: jobber 30%, midcarder 45%, upper 18%,
   main eventer 7%.
2. Base stat mean by tier: jobber 38, midcarder 55, upper 70, main eventer 82.
3. Each stat = `clamp(gaussian(mean, 10) + archetypeModifier, 5, 99)`.
4. `popularity` is rolled separately: `gaussian(tierMean - 5, 14)` — talent and
   fame are correlated but deliberately imperfect. Underrated workers and
   overpushed charisma acts both exist and are interesting to book.
5. Age: `gaussian(30, 7)` clamped 19-52. Rookies skew 19-25, veterans 35-52.
6. Alignment: 45% face, 45% heel, 10% tweener.

### Aging and progression (weekly)

- Under 27: stats drift up. `+gaussian(0.06, 0.04)` per week on skill/stamina,
  weighted by match count that week.
- 27-34: stable, small drift toward archetype ideal.
- 35+: `strength`, `agility`, `stamina` decline `gaussian(0.09, 0.05)`/week,
  accelerating past 42. `skill` continues rising slowly (ring IQ).
- Retirement roll each year after age 38, probability
  `(age - 38) * 0.06 + (1 - health/100) * 0.2`.
- When roster or school population drops below threshold, generate replacements.

---

## 7. Paper-doll appearance system

No image assets. Every wrestler renders as a layered **pixel-art** sprite drawn
from an integer trait vector — crisp, chunky, high-contrast, rendered to a
canvas at a low internal resolution and scaled with nearest-neighbor so it
stays sharp. This is the visual identity of the game. The bar is: *every
wrestler is instantly tellable apart, and the roster screen looks good.*

Wrestlers can be **generated or created by the player**, using the same trait
system and the same editor.

```ts
interface Appearance {
  skinTone: number;          // 0-11 index into palette
  build: number;             // 0-5: slim, athletic, thick, heavy, massive, tall
  height: number;            // 0-4, scales the whole rig
  hairStyle: number;         // 0-23, includes bald
  hairColor: number;         // 0-11
  facialHair: number;        // 0-11
  faceShape: number;         // 0-7
  eyes: number;              // 0-7
  attireTop: number;         // 0-15: bare, singlet, tee, jacket, vest...
  attireBottom: number;      // 0-15: trunks, tights, pants, jeans...
  boots: number;             // 0-9
  mask: number;              // 0-11, 0 = none
  accessory: number;         // 0-15: elbow pads, wrist tape, chains, hat
  glasses: number;           // 0-9, 0 = none (shades, specs, visor)
  shirt: number;             // 0-15, worn over the torso layer
  tattoos: number;           // 0-11
  beltStyle: number;         // Championship belt look when they hold one
  primaryColor: number;      // 0-19 palette index
  secondaryColor: number;    // 0-19
  accentColor: number;       // 0-19
}
```

### Render layer order (back to front)

1. Shadow ellipse
2. Rear arm
3. Legs (build-scaled) → tights/pants layer → boots
4. Torso (build-scaled) → attire bottom overlap → attire top
5. Front arm → accessory (wrist/elbow)
6. Neck → head (faceShape) → face features (eyes, mouth)
7. Facial hair
8. Hair (drawn over head; suppressed if mask ≠ 0)
9. Mask
10. Headwear accessory
11. Championship belt (auto-added when the wrestler holds a title)

### Requirements

- Two React components: `<PaperDoll size="full|bust|thumb" />`. The `thumb`
  variant is a head-and-shoulders bust used in roster grids and card slots and
  must stay legible at 48px.
- Heel/face palette shift: a subtle desaturation/warm-cool shift applied at the
  container level, not baked into traits.
- Appearance generation must guarantee visual distinctness: when generating a
  roster, reject a candidate whose trait vector is within Hamming distance 3 of
  an existing roster member's.
- **The appearance editor ships in v1**, not as a stretch goal — it powers both
  player-created wrestlers and mid-game look changes (§20). Every trait above is
  editable: hair, facial hair, body type, shirts, pants, boots, glasses, masks,
  accessories, tattoos, and all three color slots with a full palette.

---

## 8. The weekly loop

The game advances one week at a time. A week resolves in this order:

1. **Advance calendar.** Increment week counter. Roll year boundaries.
2. **Health & morale tick.** Each wrestler recovers `stamina / 4` health.
   Injuries count down. Morale adjusts for booking usage (§14).
3. **The office.** The roster comes to you before a single thing is booked.
   See §8.1 — this is a centerpiece of the week, not a notification list.
4. **Travel decision.** Player may charter to an adjacent territory or stay.
5. **Book the card.** The player fills segments (§9, §10). This is the main
   interaction and has no time pressure.
6. **Run the show.** Segments resolve in card order with a reveal animation
   (§21). Attendance builds visibly segment by segment.
7. **Post-show accounting.** Gate, payroll, expenses, ratings movement, title
   changes, popularity shifts, injuries, momentum, rivalry heat.
8. **World tick.** AI promotions run their shows, ratings recalculate globally,
   free agents move, aging and generation run.
9. **News screen.** Generated headlines summarizing everything above.

### 8.1 The office — talent comes to you

*This is one of the best things about the reference game and it is a headline
feature here.* At the start of every week, **before any booking happens**,
wrestlers, staff, the owner, and sponsors line up outside the booker's office.
The player works through the queue one person at a time, and each conversation
demands a decision that can't be deferred forever.

Typical week: 2-6 visitors, scaling with roster size, morale volatility, and
the chaos slider. A calm, well-paid, well-booked roster produces a quiet week.

**What they come in for:**

| Request | Typical options |
|---|---|
| "I want a title shot" | Grant it · promise it for next month · refuse · offer a #1 contender's match |
| "I want a raise" | Give it · partial · refuse · offer a clause instead of money |
| "Why am I not on TV?" | Book them this week · explain and eat the morale hit · release them |
| "I want to turn heel/face" | Approve · refuse · counter with a different direction |
| "I hate my gimmick" | Change it · make them keep it · let them pick |
| "I won't work with him" | Honor it · override it (morale cost) · try to broker peace |
| "My friend just signed with a rival" | Sympathize · sign the friend back · nothing |
| "I want out of my contract" | Release · buy them off · hold them to it |
| "I want to team with X" | Form the team · refuse |
| "I want to be a manager now" | Convert their role · refuse |
| "I think I'm done" | Accept retirement · talk them into one more year |
| "He's been stiffing me in the ring" | Discipline the other guy · dismiss it |
| "I want to move up the card" | Push them · tell them to earn it |
| "I need time off" | Grant it · deny it (morale and injury risk) |
| "I'm ready to come back early" | See the injury rules below |

Refusing is always allowed and sometimes correct — but every refusal costs
morale, and refusing the same person repeatedly turns a productive worker into
a problem. Granting everything bankrupts you and wrecks the card. **The office
is where most of the game's actual decisions live.**

Non-wrestlers use the office too: referees complaining about a wrestler who
won't work safely, road agents flagging a bad match on last week's card, the
owner delivering a mandate face to face, a sponsor making a demand.

### Show schedule

**Two shows every week.** *LOCKED:*

| Week type | Shows | Notes |
|---|---|---|
| Normal week | House show + TV taping | House show is small, cheap, low-stakes |
| PPV week (once a month) | TV taping + PPV | No house show — the roster can't take three |

- **House show** — 4 segments, 90-minute window, small venue, no broadcast, so
  no effect on the TV ladder. Pure gate revenue plus a chance to build
  territory following, work in rookies, and let two wrestlers develop match
  chemistry away from the cameras. Also drains energy, so loading it up before
  a PPV is a real mistake.
- **TV taping** — 6 segments, 120-minute window, drives the TV ladder,
  sponsorships, and network deals.
- **PPV** — 10 segments, 180-minute window, double ladder impact, highest
  ticket prices, the payoff show for every rivalry built that month.

Both shows in a week are booked before the week resolves. Booking the same
wrestler on the house show and the TV taping is allowed and sometimes correct,
but it compounds energy drain and injury risk.

### The drama curve

Shows are evaluated against an expected shape, not just an average: a strong
opener, a deliberate dip, escalating quality through the middle, and the best
match of the night in the main event. Matching that curve grants up to +8 show
rating. A card that peaks in the middle and limps to the finish is penalized
even if the individual match ratings are good.

---

## 9. Match setup — the booking levers

Every segment the player books exposes these controls. The reference game's
Rules screen is the model; each option is a real simulation input, not flavor.

### Rules

```ts
interface MatchRules {
  preset: 'singles' | 'tag' | 'sixMan' | 'triple' | 'fatal4' | 'battleRoyal'
        | 'handicap' | 'gauntlet' | 'tornado';
  format: 'individuals' | 'teams' | 'elimination';
  ruleStrictness: 'strict' | 'lenient' | 'none';   // DQ enforcement
  aim: 'firstFall' | 'twoOfThree' | 'ironMan' | 'lastStanding' | 'firstBlood'
     | 'submissionOnly' | 'escape';
  falls: 'pinsAndSubs' | 'pinsOnly' | 'subsOnly' | 'knockout' | 'anyMeans';
  timeLimit: 0 | 5 | 10 | 15 | 20 | 30 | 60;       // 0 = no limit
  stoppage: 'none' | 'referee' | 'doctor' | 'towel';
  countOuts: 'normal' | 'slow' | 'none';
  reward: 'none' | 'defendTitles' | 'titleShot' | 'contract' | 'stipulation';
}
```

### Stipulations

Stipulations sit on top of rules and carry their own rating and risk profile.
Each has: `ratingBonus`, `violenceLevel` (feeds hardcore saturation),
`injuryMult`, `heatRequirement`, `archetypeFit[]`, `popRequirement`.

| Stipulation | Rating bonus | Violence | Injury mult | Requires |
|---|---|---|---|---|
| Steel Cage | +6 | 2 | 1.4 | heat ≥ 40 |
| Ladder | +9 | 3 | 2.0 | avg agility ≥ 60 |
| Hardcore / No-DQ | +7 | 4 | 1.9 | — |
| Street Fight | +6 | 4 | 1.8 | heat ≥ 50 |
| Last Man Standing | +8 | 4 | 2.1 | heat ≥ 60 |
| Iron Man | +10 | 1 | 1.2 | avg stamina ≥ 70, time ≥ 30 |
| Submission Match | +5 | 1 | 1.3 | avg skill ≥ 60 |
| Hair vs Hair | +11 | 2 | 1.2 | heat ≥ 75 |
| Mask vs Mask | +12 | 2 | 1.2 | heat ≥ 75, both masked |
| Loser Leaves | +11 | 2 | 1.3 | heat ≥ 80 |
| Battle Royal | +4 | 2 | 1.5 | ≥ 8 participants |
| Squash (scripted) | −6 | 1 | 0.8 | pop gap ≥ 35 |

Booking a stipulation whose requirements aren't met is allowed but incurs a
"doesn't make sense" penalty of −8 rating and −5 morale for participants.

### Non-match segments

### Promo slots

**Every card carries two dedicated promo slots** that do not consume match
spots. The player casts them and picks the topic:

| Topic | Effect |
|---|---|
| Start a feud | Creates a rivalry at 25 heat between the parties |
| Continue a feud | +14 heat to an existing rivalry |
| Challenge to a match | Creates a rivalry and formally announces a stipulation for a future show |
| Hype an upcoming match | +6 rating to that match when it happens, +attendance |
| Advertise the promotion | +territory following, +sponsorship value |
| Championship address | +title prestige, +champion popularity |
| Call out the locker room | High risk: +heat with several wrestlers, morale swing |
| Debut / return | Introduces a signing, popularity boost |
| Retirement speech | Closes a career, roster-wide morale bump |
| Invasion promo | Send someone to a rival's territory to steal following — scales with charisma |
| Contract signing | Sets up a PPV match, +heat, brawl chance |

Promo quality is driven by **charisma** first and popularity second — this is
where a great talker who can't work becomes valuable, and where a manager
mouthpiece earns their pay. A wrestler can be booked for both a promo and a
match on the same card, at extra energy cost.

### Interviews — putting someone else over

Distinct from a promo. A promo is the wrestler speaking for themselves, usually
confrontationally. An **interview** is a wrestler, manager, or champion being
questioned by an announcer, and its primary function is **to elevate a
subject** — which may be someone other than the person talking.

| Interview type | Subject | Effect |
|---|---|---|
| Hype a debut | The newcomer | +8 popularity to the debutant before they ever wrestle |
| Put over an opponent | The other wrestler | +5 popularity to them, +credibility to the coming match |
| Champion's address | The speaker | +title prestige, +popularity |
| Manager speaks for a client | The client | Client gets the popularity gain at the *manager's* mic-work rating |
| Post-match reaction | The winner | Converts a good match into popularity more efficiently |
| Contract signing / challenge | Both | +heat, brawl chance |
| Reflect on a career | The speaker | Freshness restore, morale bump, sets up a retirement arc |
| Address an injury absence | The absent wrestler | Slows popularity decay while they're out |
| Introduce a new gimmick | The speaker | Softens the popularity cost of a repackage |

**The manager mouthpiece is the key mechanic.** A silent monster with 20 mic
work who cannot talk his way out of a paper bag can be paired with a manager
who has 85, and the interview rates off the *manager's* charisma while the
popularity goes to the wrestler. This is the single most efficient way to get a
great worker with no promo ability over, and it is the whole reason meaningful
managers exist in this design.

Interviews are cheaper than matches in every sense: half the appearance fee,
minimal energy, no injury risk, short airtime (3-5 minutes). Their rating
ceiling is lower than a good match, so a card stuffed with them rates poorly —
but used well, they are how popularity gets manufactured without burning bodies.

### Tournaments

A tournament can be declared on any card. The player chooses the field size (4,
8, 16) and the entrants; the bracket seeds by popularity or randomly. Rounds
can be spread across multiple shows or run in one night. Tournaments generate
their own heat, and the final carries a rating bonus scaling with field size.

### Segment types

- **Promo** — one aggressor, one or more targets, plus a topic. Advances or
  creates rivalries, and flips alignment: **the aggressor turns heel, the
  target turns face** (each shifts 25 points toward that pole) if they were not
  already opposed. Turns happen **both ways**: the player can order one directly
  (subject to the refusal checks in §18), and the world produces them
  unprompted through promos, betrayals, faction splits, and chaos events. Rated on the popularity and momentum of those involved.
  Nonsensical promos (no relationship, no stakes) penalize the show.
- **Angle** — beatdowns, contract signings, championship presentations,
  debuts, returns, retirements. Cheaper than matches (half fee), no injury risk,
  but rating ceiling is capped at 3.5 stars.

### Broadcast time budget

Segment count alone isn't the constraint — **airtime is**. Each show has a hard
broadcast window the card must fit inside.

| Show type | Window | Segments |
|---|---|---|
| TV taping | 120 minutes | 6 |
| PPV | 180 minutes | 10 |
| House show | 90 minutes | 4 |
| Charity / special | 100 minutes | 6 |

Every segment consumes minutes: matches take their scheduled length plus 4
minutes of entrances and aftermath; promos take 4-8; angles take 3-6. Entrances
scale with popularity — a main eventer eats an extra 2 minutes just walking to
the ring.

Consequences of misjudging it:

*LOCKED: time is a real constraint but a gentle one.* Nothing gets cut, nothing
gets cancelled — the show just runs long or short and the presentation suffers.

- **Overrun** — −0.4 show rating per minute over, capped at −6. Under a network
  deal, a chronic overrunner (4+ weeks) gets a warning, then a small fine.
- **Underrun** — −0.3 show rating per unfilled minute beyond a 10-minute grace
  window, capped at −5.

The point is to make a 60-minute Iron Man a real decision — it eats half your
broadcast — without ever punishing the player with a cancelled match.

This turns match length into a real currency: a 30-minute Iron Man match in the
main event means the undercard has to be tight, and a bloated card of long
matches leaves nothing for promos to build next week's rivalries.

---

## 10. Stacking the deck

This is the signature system. The player influences the outcome without
choosing it. Each lever shifts the odds differential by the number of points
below — but **the player never sees a percentage.** The UI shows a descriptive
band that updates as levers toggle:

| Internal probability | Displayed as |
|---|---|
| 0.08 - 0.20 | "Long shot" |
| 0.21 - 0.35 | "Underdog" |
| 0.36 - 0.46 | "Slight edge against" |
| 0.47 - 0.53 | "Dead even" |
| 0.54 - 0.64 | "Slight edge" |
| 0.65 - 0.79 | "Favored" |
| 0.80 - 0.92 | "Heavy favorite" |

Individual levers are described the same way — "a manager at ringside helps a
little," "a run-in at the finish helps a lot" — never itemized numerically.
The exact figures in this document are engine internals only.

```ts
interface DeckStacking {
  favoredSideIndex: number | null;   // Who the player is trying to protect
  assignedReferee: RefereeAssignment | null;
  ringsideManagers: { wrestlerId: string; forSide: number }[];
  plannedRunIn: RunIn | null;
  lumberjacks: string[];
  preMatchAngle: 'none' | 'beatdown' | 'hype' | 'sneakAttack';
  instructions: MatchInstruction;
}

interface RunIn {
  wrestlerId: string;
  forSide: number;
  timing: 'early' | 'late' | 'finish';
  cost: number;              // Half the wrestler's appearance fee
}

type MatchInstruction =
  | 'callItInTheRing'        // No modifier, no risk
  | 'protectTheChampion'     // +6 to champion, −4 rating (formulaic)
  | 'goAllOut'               // +10 rating, injury mult ×1.5, health cost ×1.6
  | 'keepItShort'            // −5 rating, health cost ×0.5, injury ×0.6
  | 'makeHimLookStrong'      // +12 to favored side, −6 rating (squash-flavored)
  | 'giveHimTheRub';         // Loser retains popularity, winner gains less
```

### Odds modifiers table

| Lever | Odds shift (percentage points) | Cost / risk |
|---|---|---|
| Crooked referee (aligned) | +12 | 15% chance exposed → −10 rating, referee fired |
| Manager at ringside | +7 | Half appearance fee |
| Second manager (same side) | +3 (diminishing) | Half fee, −3 rating (overbooked) |
| Run-in, early | +9 | Half fee; 25% chance backfires (−9 instead) |
| Run-in, late | +14 | Half fee; 20% backfire; DQ if rules strict |
| Run-in, at finish | +18 | Half fee; forces DQ finish under strict rules |
| Pre-match beatdown | +11 | Target loses 12 health; −6 their morale |
| Lumberjacks (stacked) | +8 | Fees for each; +4 rating |
| Opponent booked twice same night | +10 | −8 rating on both their matches |
| Opponent injured/low health | up to +20 | Injury risk ×1.7 for them |
| Stipulation archetype mismatch | +6 to the fitting archetype | −4 rating |
| Home territory advantage | +5 | Free |
| Title on the line (champion) | +4 | Free |
| `makeHimLookStrong` instruction | +12 | −6 rating |

**Hard clamp:** final win probability is always clamped to **[8%, 92%]**. No
combination of levers produces a certainty. This is the rule that makes the
game work — the player is always gambling.

### No escape hatch

Earlier drafts included a "script the finish" override. **It is cut.** The
simulation decides, always. The player's only recourse against a result they
hate is to book their way out of it next week — and that constraint is the
whole game.

---

## 11. The simulation engine

### 11.1 Composite strength

For each competitor:

```
base = 0.35*popularity + 0.25*skill + 0.15*strength + 0.15*agility + 0.10*stamina

healthFactor   = 0.50 + 0.50 * (health / 100)
momentumFactor = 0.90 + 0.20 * (momentum / 100)
ageFactor      = age > 36 ? 1 - (age - 36) * 0.012 : 1.0

kayfabe = base * healthFactor * momentumFactor * ageFactor
```

Rules reweight the composite before comparison:

| Rule condition | Adjustment |
|---|---|
| `timeLimit >= 30` or `ironMan` | stamina weight ×2.2, strength weight ×0.6 |
| `timeLimit <= 5` | strength weight ×1.8, stamina weight ×0.4 |
| `ruleStrictness === 'none'` | strength weight ×1.5, skill weight ×0.7 |
| `aim === 'submissionOnly'` | skill weight ×2.0 |
| `aim === 'firstBlood'` | strength weight ×1.6, popularity weight ×0.7 |
| Ladder / high-spot stips | agility weight ×1.9 |
| Battle royal / multi-man | popularity weight ×1.4 (stars get protected) |

### 11.2 Win probability

```
delta = kayfabeA - kayfabeB
pRaw  = 1 / (1 + exp(-delta / 8))
p     = pRaw + (sum of deck-stacking shifts for side A) / 100
p     = clamp(p, 0.08, 0.92)
```

For multi-man matches, compute a softmax over all competitors' kayfabe scores
with a temperature of 9, then apply stacking shifts, then renormalize and clamp
each participant to [0.03, 0.85].

### 11.3 Finish type

Once the winner is drawn, roll the finish:

| Finish | Base weight | Modifiers |
|---|---|---|
| Clean pin | 40 | +15 if `strict` rules |
| Submission | 15 | ×3 if winner is Technician; 0 if `pinsOnly` |
| Knockout | 8 | ×2 if `violenceLevel >= 3` |
| Rollup / flash | 8 | ×2.5 if the underdog won (upset) |
| Interference finish | 6 | replaced by run-in outcome if one was planted |
| Disqualification | 6 | ×3 under `strict` + interference; 0 if `none` |
| Count-out | 5 | 0 if `countOuts === 'none'` |
| Time limit draw | 4 | only if `timeLimit > 0`; ×3 if closely matched |
| Double KO / no contest | 2 | ×2 if `violenceLevel >= 4` |
| Referee stoppage | 3 | requires `stoppage !== 'none'` |

Non-decisive finishes (DQ, count-out, draw) reduce popularity transfer to 30%
of normal and add +12 rivalry heat — they're a legitimate booking tool for
protecting talent while building a feud.

### 11.4 Match rating

Rating is computed on a 0-100 scale, then converted to stars.

```
avgPop       = mean(popularity of competitors)
avgWorkrate  = mean(0.45*skill + 0.30*agility + 0.25*stamina)
avgCondition = mean(health) / 100

popComponent    = (avgPop / 100) * 42
workComponent   = (avgWorkrate / 100) * 24 * (0.7 + 0.3 * avgCondition)

chemistry:
  + 13  if the match has both a face and a heel involved
  +  0  if all same alignment, and -6 penalty
  + (rivalryHeat / 100) * 12
  + (titlePrestige / 100) * 8   if titles are on the line
  + 4 if PPV

balance:
  + 11 * (1 - abs(pFinal - 0.5) * 2)      // close odds rate better
  (exception: a 'squash' stipulation inverts this — lopsided is correct)

styleMesh         = pairwise mesh score from §3.5, −12 to +12
                    (averaged across all participants in multi-man matches)
stipulationBonus  = per §9 table
instructionMod    = per §10 table
territoryFit      = ±6 based on the territory's preference weights

penalties:
  - pairChemistry: +2 per prior meeting between these opponents, max +10
                   (they learn each other's timing — familiarity is an ASSET)
  - overexposure: -4 per meeting in the last 6 weeks beyond the second, max -14
                  (the fans, not the wrestlers, are the ones who get tired)
  - hardcoreSaturation: -(saturation/100) * 12
  - boredom: if timeLimit or expected length exceeds what avgPop supports,
             -(excess) * 0.8   (unpopular talent cannot hold a long match)
  - mismatchedStipulation: -8 if requirements unmet
  - jobberDrag: -5 if any competitor's popularity is 25+ below the segment's
                slot expectation

randomness = gaussian(0, 6.5)     // the "off night" / "they clicked" factor

rating = clamp(sum of all above, 3, 100)
stars  = round(rating / 20 * 2) / 2   // half-star granularity, 0.5 to 5.0
```

**Hardcore saturation** is a promotion-level counter, 0-100. Each segment adds
`violenceLevel * 6`; it decays 8/week. This reproduces the diminishing returns
on weapons from the reference game.

### 11.5 Narrative generation

Because the player never watches the match, every segment must produce readable
play-by-play. The engine emits a `beats[]` array during simulation and a
template system renders it into 4-8 sentences.

Beats are generated from the simulated flow: opening exchange, control
segment, hope spot, near-fall (count varies with rating), signature move,
interference (if any), finish. Templates are keyed by archetype, so a
Powerhouse's control segment reads differently from a High Flyer's.

Additionally, each segment produces a **rating breakdown panel** listing every
contributing term with its numeric value. This is non-negotiable: the player
must always be able to see exactly why a match got the stars it got.

---

## 12. Post-match consequences and the stat economy

### Popularity transfer

```
gap    = winnerPop - loserPop
base   = 2.5
slotMultiplier   = [0.7, 0.8, 1.0, 1.2, 1.5, 2.2]  // by card position
decisiveness     = clean finish 1.0 | dirty 0.6 | non-decisive 0.3
upsetBonus       = gap < 0 ? min(abs(gap) * 0.08, 4) : 0
titleChangeBonus = 4 if a title changed hands
ppvMultiplier    = 1.8 on PPV

winnerGain = (base + upsetBonus + titleChangeBonus) * slotMult * decisiveness * ppvMult
loserLoss  = winnerGain * 0.55 * (gap > 0 ? 1.3 : 0.7)
```

The `giveHimTheRub` instruction halves `loserLoss`. Losing to a much more
popular opponent in a well-rated match can actually *raise* the loser's
popularity — this is how the player builds midcarders and must be discoverable.

### Health, injury, momentum

```
healthCost = 8 + violenceLevel * 4 + (matchLength / 10) * 3
             × instructionMultiplier
             × (1.4 for the loser)

injuryChance = 0.022 * stipulationInjuryMult
             * (1 + (100 - stamina) / 100)
             * (1 + (100 - health) / 140)
             * (age > 35 ? 1.3 : 1.0)
             * instructionMultiplier
```

Injury severity roll: minor (1-3 weeks) 60%, moderate (4-10 weeks) 30%,
severe (11-30 weeks) 8%, career-threatening (31-60 weeks, permanent stat loss)
2%.

### Rehab and the early return

An injured wrestler is unavailable and rehabbing. As the clock runs down, the
game shows their recovery honestly: weeks remaining and current condition.

**Within the final 3 weeks of a rehab, they can come back early** — either
because the wrestler asks in the office, or because the booker asks them to.
It is always a gamble:

| Weeks early | Effective stat penalty | Re-injury risk multiplier |
|---|---|---|
| 1 week early | −8% across physical stats | ×2.2 |
| 2 weeks early | −16% | ×3.4 |
| 3 weeks early | −25% | ×5.0 |

A re-injury from an early return is rolled one severity tier worse than normal
and carries a real chance of permanent stat loss or a forced retirement. The
wrestler's `toughness` and `attitude` determine whether they volunteer for it,
and whether they resent being asked.

This exists to create a specific, recurring, genuinely hard decision: your
world champion is two weeks from healthy and the PPV is Sunday.

Momentum: `+8` for a decisive win, `+4` for a dirty win, `−7` for a loss,
`±(stars − 3) * 2` from the match quality regardless of outcome. Decays 4/week
toward 50.

### Rivalry heat

- Match between rivals: `+6`, or `+12` if the finish was non-decisive
- Promo advancing the rivalry: `+10`
- Beatdown angle: `+14`
- Decisive blowoff in a grudge stipulation: rivalry ends, winner gets
  `heat * 0.12` popularity


---

## 12.5. The stat economy

Every stat in this game moves. This section defines exactly how, because the
whole feel of a decades-long save depends on getting these rates right.

### Governing principles

1. **Nothing moves fast except popularity, morale, and momentum.** Physical and
   technical stats are measured in fractions of a point per week. A wrestler
   who gains 10 skill in a year has had a hell of a year.
2. **Soft caps.** Every gain is scaled by headroom: `actualGain = rawGain *
   (potential - current) / 40`, clamped to 0 at or above potential. Improvement
   slows dramatically as a wrestler approaches their ceiling.
3. **Hidden potential.** Each wrestler is generated with a per-stat `potential`
   (their ceiling) and a `growthRate`. Two rookies with identical visible stats
   can have completely different futures. Potential is never shown, only
   inferred from how fast they actually improve — this is what makes signing
   unscouted school graduates a gamble worth taking.
4. **Everything decays.** Gains are opposed by drift so the world doesn't
   inflate over twenty simulated years. A stat left unexercised drifts down.
5. **Displayed as bars, not numbers.** The player sees segmented bars and
   trend arrows (rising, steady, declining), not `74`. Precision is engine-only.

### Popularity — the volatile one

| Raises | Amount |
|---|---|
| Winning a match | +2.5 base, ×card position (0.7 opener to 2.2 main event), ×1.8 on PPV |
| Upset win over a bigger name | up to +4 extra |
| Winning a title | +4, plus ongoing drift toward title prestige |
| High-rated segment regardless of outcome | +(stars − 3) × 1.5 |
| Losing a great match to a much bigger star | up to +1.5 (the rub) |
| Strong promo | +1 to +3, scaled by charisma |
| Merch selling well | +0.3/week |
| Outside media (§20) | +8 to +20 |
| Winning an annual award | +6 |
| Cross-promotional win | ×2.2 amplifier |

| Lowers | Amount |
|---|---|
| Losing | −(winner's gain × 0.55), worse if they were favored |
| Not booked at all | −0.8/week, accelerating after 3 weeks |
| Gimmick freshness below 50 | gains stop; below 25, −0.5/week |
| Bad segments | −(3 − stars) × 1.2 |
| Age past 38 | −0.15/week, steepening |
| Long injury absence | −0.6/week away |
| Cross-promotional loss | ×2.2 amplifier |
| Repackaging | −20% immediately |

### Strength

| Raises | Rate |
|---|---|
| Assigned strength training | +0.25/week (costs energy and money) |
| Weight gain | +4 permanent per class moved up |
| Natural growth, age 19-28 | +0.08/week |
| Powerhouse/Monster archetype | ×1.4 on all gains |

| Lowers | Rate |
|---|---|
| Age 33+ | −0.10/week, −0.22 past 42 |
| Weight cut | −2 per class moved down |
| Injury layoff | −0.3/week while out |
| Untrained for 12+ weeks | −0.05/week drift |

### Skill — the one that keeps growing

| Raises | Rate |
|---|---|
| Working a match | +0.10, doubled if the opponent's skill exceeds theirs by 15+ |
| Long matches (20+ min) | +0.15 extra |
| Assigned skill training | +0.20/week |
| Working under a trainer/road agent | ×1.5 on all skill gains |
| High coachability | ×(0.6 + coachability/100) on all gains |
| Training abroad | +8 over the trip |
| Age 30-40 | small bonus — ring IQ compounds |

| Lowers | Rate |
|---|---|
| Age 45+ | −0.06/week |
| No matches for 8+ weeks | −0.08/week (ring rust) |
| Returning from long injury | −4 immediately, recovered over 8 weeks |

### Agility

| Raises | Rate |
|---|---|
| Youth, age 19-26 | +0.10/week |
| Assigned conditioning | +0.18/week |
| Weight cut | +3 per class moved down |
| High Flyer archetype | ×1.4 |

| Lowers | Rate |
|---|---|
| Age 29+ | −0.12/week, −0.25 past 38 |
| Weight gain | −5 per class moved up |
| Any leg or back injury | −3 permanent per severe occurrence |
| Accumulated career matches | −0.02/week after 400 matches |

### Stamina

| Raises | Rate |
|---|---|
| Working matches regularly | +0.08/week when booked 2+ times |
| Assigned conditioning | +0.20/week |
| Long matches | +0.12 extra |
| Going vegan / lifestyle events | +4 one-off |

| Lowers | Rate |
|---|---|
| Age 34+ | −0.11/week |
| Weight cut (temporary) | −6, recovering over 4 weeks |
| Injury layoff | −0.35/week while out |
| Chronic overbooking | −0.15/week if worked 3+ times weekly for a month |

### Attitude — the social stat

| Raises | Amount |
|---|---|
| Requests granted in the office | +2 each |
| Being pushed and winning | +1/week during a push |
| Paid fairly relative to peers | +0.5/week |
| A locker room leader present | +0.3/week roster-wide |
| Consistent, fair discipline | +0.4/week roster-wide |
| Mentorship from a veteran | +1.5/week for the protégé |

| Lowers | Amount |
|---|---|
| Requests refused | −2 each, compounding on repeats |
| Buried — losing repeatedly in low spots | −1.5/week |
| Paid below peers | −1/week |
| Punished unfairly, or a popular teammate punished | −2 |
| Released friends, or a friend signing elsewhere | −4 |
| Substance problems | −3/week untreated |

### Charisma

Rises +0.15 per promo performed (×1.6 if the promo rated well), +0.10/week with
a podcast or media project, +2 permanent from a successful repackage. Falls
−0.05/week if they haven't cut a promo in 8 weeks, and −0.10/week past age 50.

### Coachability and toughness

**Coachability** is near-fixed: −0.05/week past age 33, and −0.1/week whenever
popularity exceeds 85 (ego). It never rises except through a humbling event
(a bad injury, a demotion accepted gracefully).

**Toughness** rises +0.4 per hardcore-stipulation match survived and +0.2 per
match worked injured. It falls −0.15/week past age 36 and −2 permanently per
severe injury.

### The dynamic four

| Stat | Recovers | Drains |
|---|---|---|
| **Health** | +stamina/4 per week resting; +stamina/8 if booked | 8 + violence×4 + length/10×3 per match; ×1.4 for the loser |
| **Energy** | +18/week resting, ×(0.6 + stamina/100) | −14 per match, −8 per promo, −6 per house show, −5 per territory traveled |
| **Momentum** | +8 decisive win, +4 dirty win, ±(stars−3)×2 | −7 per loss; decays 4/week toward 50 |
| **Morale** | See §15 table | See §15 table |

### Fatigue and burnout — working too many weeks in a row

Energy is not just a per-match drain. **Consecutive weeks worked accumulate**,
and a wrestler run every week for months will fall apart even if their health
bar looks fine.

```ts
consecutiveWeeksWorked: number;   // Resets on any week with no booking
fatigueDebt: number;              // 0-100, separate from energy
```

Each week worked adds fatigue debt:

```
weeklyDebt = 4 + (matchesThisWeek - 1) * 5
           + (longMatch ? 4 : 0) + (hardcoreMatch ? 5 : 0)
           + (traveled ? 3 : 0)
debt *= (1.6 - stamina/100)          // low-stamina workers accumulate faster
debt *= (age > 35 ? 1.35 : 1.0)
```

Fatigue debt recovers **only during weeks with no booking at all**, at
`10 + stamina/6` per week. Energy alone recovering is not enough — the wrestler
needs actual time off.

| Fatigue debt | Effect |
|---|---|
| 0-25 | Fresh. No penalty. |
| 26-45 | Slightly worn. −3 match rating. |
| 46-65 | Tired. −8 rating, injury risk ×1.4, stamina gains stop. |
| 66-80 | Badly worn. −15 rating, injury ×2.0, they ask for time off in the office. |
| 81-100 | **Burnout.** −25 rating, injury ×3.2, permanent stamina and toughness loss of 1 point per week in this state, and a real chance they simply refuse to work or hand in notice. |

**The design intent:** a booker cannot ride their six best wrestlers forever.
Depth is mandatory, not optional. Building a midcard exists as a strategy
because your main eventers physically cannot work 52 weeks a year.

Countermeasures the player has:
- Rest weeks — book them off entirely, accept the popularity decay
- Part-time contracts (§15) — half the exposure, half the accumulation
- House shows only, no TV, for a lighter week
- Interviews and promos instead of matches — almost no fatigue cost
- Writing them off TV with an injury angle for a month

Fatigue is visible to the player as a wear indicator on the roster screen, not
a number, and wrestlers mention it in the office before it becomes critical.

### Training

Each week the player may assign up to **three wrestlers** to a training focus:

| Focus | Raises | Notes |
|---|---|---|
| Strength | strength | Adds weight over time; may push them up a class |
| Conditioning | stamina, agility | The best all-round investment for young talent |
| Technical | skill | Slowest gains, but skill never stops mattering |
| Aerial | agility, skill | High injury risk during training |
| Striking | strength, toughness | Fast, physical, wears them down |
| Promo work | charisma | Needs a trainer or a manager on staff to be effective |
| Style conversion | changes `style` | 10-16 weeks, −8 rating on their matches throughout |
| Weight change | moves weight class | Unavailable entirely while cutting or gaining (§3.2) |

Training Costs money per wrestler per week
and drains energy, so a wrestler training hard is a wrestler wrestling worse.
Effectiveness scales with coachability, age, and whether a trainer is on staff.

This is the deliberate long game: the booker who invests in a 21-year-old with
hidden potential for two years gets a main eventer nobody else saw coming.

---

## 13. Show rating and the TV ladder

```
slotWeights (TV, 6 segments):  [1.0, 1.1, 1.25, 1.4, 1.7, 2.4]
slotWeights (PPV, 10 segments):[0.8, 0.9, 1.0, 1.1, 1.25, 1.4, 1.6, 1.9, 2.3, 3.0]

showRating = sum(segmentRating * slotWeight) / sum(allSlotWeights)
```

Unfilled segments count as rating 0 against the full denominator — a short card
is judged as if you'd filled it, exactly as in the reference game.

**The ladder.** Show stars map to a target company rating:

| Show stars | Target rating |
|---|---|
| 1★ | 60 |
| 2★ | 70 |
| 3★ | 80 |
| 4★ | 90 |
| 5★ | 100 |

Interpolate linearly for half-stars. The company rating moves **1 point per
week** toward the target, or **2 points** after a PPV. This makes consistency
the dominant strategy and makes a bad month genuinely expensive to climb out of.

All AI promotions run the same calculation, and the global ranking is a simple
sort by rating.

### Rankings and booking credibility

Each division maintains an automatic **contender ranking** (top 10) computed
from recent wins, opponent quality, popularity, and momentum. The player never
has to use it — but the fans do.

**Booking credibility** is a promotion-level stat, 0-100, that tracks whether
the booking makes sense:

| Credibility hit | Penalty |
|---|---|
| Title shot given to someone outside the top 10 | −4 |
| Title shot for someone on a losing streak | −6 |
| A champion who never defends (8+ weeks) | −5 |
| A wrestler who loses constantly still presented as a threat | −3/occurrence |
| Ignoring a #1 contender for 6+ weeks | −5 |
| A rivalry that never gets a blowoff | −4 |
| Same main event 4+ weeks running | −5 |

| Credibility gain | Bonus |
|---|---|
| Champion defends regularly against ranked contenders | +3 |
| A rivalry resolved decisively | +4 |
| A win streak rewarded with a title shot | +5 |
| Long-term booking paying off | +4 |

Credibility modifies attendance, buyrates, and the TV ladder by up to ±8%. It
is the mechanism that stops the optimal strategy from being "book the two most
popular wrestlers against each other every single week." The game never *warns*
about a credibility hit — the player sees the number move and works out why.

---

## 14. Finances

### Attendance

```
ticketPrice = 4 + (1 * segmentsBooked)      // $10 for a full TV, $14 for a full PPV

baseDraw = territoryFollowing * capacity/100
         * 0.33 * ((companyRating + championPopularity) / 200)

per segment:
  segmentDraw = capacity * (segmentStars / 5) * (avgSegmentPop / 100) * 0.075

attendance = min(baseDraw + sum(segmentDraw), capacity)
```

Only a third of the house is guaranteed by reputation; the rest is earned live.
The attendance counter should visibly tick up during the show reveal.

```
gate = attendance * ticketPrice * territoryRevenueMult
```

### Costs

```
appearanceFee = contract.weeklyRate
              * (role === 'competitor' ? 1.0 : 0.5)
              * (clause 'incentive' && mainEvent ? 1.25 : 1.0)
              * (clause 'payPerView' && isPPV ? 2.0 : 1.0)

payroll = sum(appearanceFee for everyone used)
        + sum(0.5 * rate for 'downside' clause holders not booked)

weeklyExpenses = netWorth * 0.02 * (1 + 0.1 * territoriesOwned)
```

**Cap:** total show expenses may never exceed 50% of show revenue (matching the
reference game's safety valve). Excess is deferred to the following week as
debt.

Other line items: medical bills for injuries, arena damage from hardcore
stipulations, contract buyouts, travel costs for chartering between territories,
talent development (paying to train a wrestler's stats).

### PPV buyrates

PPVs earn far more from buys than from the building. Buys are driven by the
month's build, not the night itself.

```
buyBase        = companyRating^1.6 * networkReachFactor
buildQuality   = mean rating of the TV segments that advanced this card's feuds
marqueeFactor  = heat of the top rivalry + prestige of titles defended
                 + combined popularity of the main event
noveltyFactor  = champion vs champion, first-time matchups, grudge stipulations
buys = buyBase * (0.5 + 0.5*buildQuality/100) * marqueeFactor * noveltyFactor
revenue = buys * pricePerBuy
```

The point: **a PPV is paid for by the four weeks of television before it.** A
booker who throws together a great card with no build gets a great rating and
poor revenue, which is exactly the lesson the game should teach.

Buyrate history is tracked and shown against previous events.

### Merchandise

Every wrestler generates merch revenue independently of the show, based on
popularity, gimmick appeal, alignment (faces outsell heels roughly 1.4:1),
recent momentum, title reigns, and how often they've been on TV.

```
weeklyMerch = (popularity^1.4) * gimmickAppeal * alignmentMult
            * (0.6 + 0.4 * momentum/100) * companyReachFactor
```

- **Per-wrestler merch sales are tracked and displayed** — career totals,
  weekly figures, and a promotion-wide leaderboard. Discovering that a
  midcarder outsells your champion is one of the best signals in the game, and
  it should change who you push.
- The `merchandiseCut` contract clause (0-25%) pays the wrestler a share. Stars
  demand it; granting it to someone who then becomes your top seller is a
  costly mistake you have to live with for the contract term.
- Merch dies fast when a wrestler is off TV, so shelving a top seller has an
  immediate revenue cost.

### Sponsorships

A third revenue stream, independent of the network. Sponsors approach the
promotion based on company rating, weekly attendance, and roster popularity,
and pay a flat weekly fee plus per-show bonuses.

| Sponsor tier | Requires | Weekly | Conditions |
|---|---|---|---|
| Local business | rating 45 | $2,500 | — |
| Regional brand | rating 62, avg attendance 2,000 | $12,000 | No severe hardcore |
| National consumer brand | rating 78 | $45,000 | Family-friendly: violence cap |
| Beer / energy drink | rating 70 | $38,000 | Prefers hardcore, hates squeaky-clean |
| Video game / apparel | rating 74 | $30,000 | Wants a marketable top star |

Sponsors carry **conditions that conflict with each other** — a family brand
and a beer brand won't both stay. Sponsor money is the difference between
solvent and broke in the midgame, and choosing which sponsor to keep is a real
identity decision for the promotion.

**Sponsors make demands, and they are not shy.** Periodically a sponsor issues
a request the player must accept or refuse:

- Change a specific wrestler's gimmick (the sponsor hates it)
- Fire a specific wrestler (bad publicity, an arrest, a lawsuit)
- Hire a specific free agent they want associated with the brand
- Feature a named wrestler in the main event for the next month
- Cut hardcore content below a threshold
- Add a women's title match to every PPV
- Run a show in a specific territory

Accepting pays a bonus and extends the deal. Refusing risks the sponsor
walking. This is the second voice in the player's ear alongside the owner, and
the two will sometimes want opposite things.

### Loans

When the balance drops below a threshold, a banker offers a rescue loan.

- Amount: up to 60% of the promotion's annual revenue
- **Repayable within 52 weeks**, with interest (default 12%)
- Miss the deadline and the promotion is forced into the fire sale below
- Only one active loan at a time; a second offer is refused after a default
- Taking a loan is visible to rivals, who bid more aggressively on your talent
  knowing you're squeezed

### Bankruptcy is a fire sale, not a game over

Going broke starts a **90-day survival window**, not an instant loss:

1. Loan offers appear (if none is already outstanding and defaulted)
2. **Sell contracts** — rival promotions bid for your talent. Fast cash, but
   you're gutting the roster that generates revenue, and the locker room knows.
3. **Cancel contracts** — cheaper than selling but requires severance, and
   `ironClad` holders must be paid in full
4. Downgrade venues, drop territories, cut staff roles, skip house shows
5. Emergency sponsor deals at humiliating terms

Only if the balance is still negative when the window closes does the promotion
fold. Clawing back from the brink should be one of the most memorable things
that can happen in a save.

### Buyouts and mergers

A wealthy promotion can move on a struggling rival.

- **Buyout** — purchase the promotion outright. You absorb their roster
  (contracts and all, including ones you can't afford), their titles, their
  territories, and their debts. Their fans do not automatically become yours,
  and their loyalists may resent you for years.
- **Merger** — a negotiated combination. Cheaper, but the other owner keeps a
  say: they become a second voice issuing mandates, and their champion is
  protected for a period.

Implications either way: a sudden payroll spike you may not survive, a bloated
roster far above the target size, redundant titles that must be unified or
retired, morale chaos as two lockers rooms merge, and a big one-off rating and
territory gain. Buying a rival to kill them is a legitimate and dangerous
strategy.

### The booker's own body

The player character is on the roster and **draws no salary** — but can be
booked like anyone else: in matches, in promos, as a run-in, or as a manager.
Doing so is free labor and a real temptation when money is tight, but the
booker ages, tires, and gets injured like anyone else, and a booker who books
himself into the main event every week is a morale disaster with the locker
room.

### TV rights deals

Gate money alone cannot sustain a promotion past the midgame. Networks are the
second revenue stream and the main long-term progression track.

| Tier | Requires rating | Weekly fee | Demands |
|---|---|---|---|
| None (self-distributed) | — | $0 | — |
| Local access | 55 | $6,000 | Run 4 shows/month |
| Regional cable | 68 | $22,000 | Maintain rating 65+ |
| National network | 80 | $70,000 | Maintain 75+, no severe hardcore |
| Premium global | 91 | $180,000 | Maintain 88+, PPV quarterly |

Networks are offered when the company crosses a rating threshold and sustains
it for 6 weeks. Each carries **demands** — miss them for 4 consecutive weeks
and the deal is downgraded or cancelled, which is a brutal financial cliff and
the game's main mid-to-late tension. A network may also impose content
restrictions (a hardcore saturation ceiling, a minimum women's-division
presence, a mandated timeslot in a specific territory) that constrain booking.

### Arena tiers

Within each territory, venue size is chosen per show and gated by drawing power.

| Venue | Capacity | Rent | Unlocks at |
|---|---|---|---|
| Armory / club | 800 | $1,200 | — |
| Community hall | 2,500 | $4,000 | Avg attendance 700 |
| Civic center | 6,000 | $11,000 | Avg attendance 2,200 |
| Arena | 12,000 | $30,000 | Avg attendance 5,500 |
| Stadium | 40,000 | $95,000 | PPV only, avg attendance 11,000 |

Booking a venue you can't fill is punishing: an arena at 20% capacity takes a
−10 show rating penalty for looking empty on television, on top of the rent.
Selling out gives +6 rating and a following boost in that territory.

**Bankruptcy:** balance below zero for 4 consecutive weeks = game over, with a
Hall of Fame style career summary.

---

## 15. Contracts, hiring, and firing

### Contract types

Type is the first thing negotiated, and it changes everything downstream.

| Type | Availability | Cost | Energy & aging | Popularity | Best for |
|---|---|---|---|---|---|
| **Full time** | Every week, both shows | Full rate | Normal drain, normal decline | Normal decay when unused | The core roster |
| **Part time** | Every other week only | ~60% of full rate | Half the energy drain; ages slower in career terms | Decays at half rate — absence keeps them special | Aging stars, big draws you want to protect, anyone whose act is stale |
| **Per appearance** | Whenever booked, but **can decline** | Paid per booking, ~130% of the per-week equivalent | Minimal | Normal | Cash-poor promotions, unproven talent |
| **Developmental** | Rare TV, mostly training | ~20% of full rate | Very low | Grows slowly | Prospects with hidden potential |
| **Legends** | 4-6 dates a year, PPVs and specials | Very high per date | Negligible | Barely decays — mystique | Retired greats and mainstream names |

**Part-time is a strategic tool, not just a discount.** A wrestler on TV every
week burns their gimmick freshness fast; the same wrestler appearing every other
week stays hot much longer and costs less. The trade is that half your weeks
you simply don't have them, and storylines have to work around it.

Wrestlers ask to move between types in the office — a 43-year-old with a bad
back asking to drop to part time is a common and reasonable request, and
refusing it accelerates their decline.

### Converting to other roles

Instead of releasing an aging or broken-down wrestler, the booker can offer a
role change. Wrestlers can be converted to **manager, referee, announcer, road
agent, or trainer** — and back again, though returning to the ring after a long
absence carries ring rust and injury risk.

| Conversion | What carries over | What's gained | What's lost |
|---|---|---|---|
| **→ Manager** | Full popularity, charisma, relationships | Long career extension, mouthpiece for a wrestler who can't talk, ringside deck-stacking, still takes bumps if you ask | No more matches; their in-ring stats decay |
| **→ Referee** | Attitude, skill | Cheap, stable, a crooked-ref lever | Popularity fades fast; fans forget them |
| **→ Announcer** | Charisma, popularity | Show-wide rating bonus, can be a heel authority figure | Removed from the active roster |
| **→ Road agent** | Skill | Raises the rating floor of the whole undercard | Invisible to fans |
| **→ Trainer** | Skill, coachability | Better school graduates, faster rookie growth | Off television entirely |

A beloved veteran converted to manager keeps drawing for years after their body
gives out — and a popular manager attached to a bland young wrestler is one of
the most efficient ways to get someone over.

Some wrestlers refuse a conversion outright (ego, or they think they have more
left), and some ask for it themselves in the office when they know it's time.

### The negotiation table

Negotiation is a live back-and-forth on a single screen. The player adjusts any
term; the wrestler's **satisfaction meter** updates in real time, alongside the
**cost to the promotion** per week. The player proposes; the target signs,
counters with specific changes, or walks.

Negotiable terms:

| Term | Range | Effect on satisfaction | Effect on cost |
|---|---|---|---|
| Weekly rate | $200 - $200,000 | Primary driver, compared to expectation and to roster peers | Direct |
| Contract length | 12 - 104 weeks (settings-bound) | Young talent wants short deals to re-price; veterans want long security | Locks the rate in against inflation |
| Signing bonus | $0 - 20× weekly rate | Strong immediate satisfaction, weak long-term | One-time |
| Downside guarantee | 0-100% of rate when unbooked | High satisfaction for midcarders | Paid weekly regardless of use |
| Health insurance | on/off | +18 satisfaction; refusing it is −12 and remembered | All medical bills, ~$3-40k per injury |
| Creative control | on/off | +25 for stars, meaningless to jobbers | Player cannot script their loss or force turns |
| Title push promise | on/off | +20, but −8/week once 12 weeks pass unfulfilled | Booking obligation |
| Guaranteed dates | 0-4 per month | +12 | Paid whether used or not |
| Travel covered | on/off | +8, +16 if outside their home territory | ~$400-1,500 per territory show |
| Merchandise cut | 0-25% | +10 at 10%, scaling | Reduces merch revenue |
| No hardcore | on/off | +14 for Technicians, 0 for Brawlers | Removes booking options |
| No jobbing | on/off | +16 for anyone popularity 60+ | Severe booking constraint |
| Exclusivity | on/off | −15 (they want outside work) | Blocks rivals using them |
| Release clause | buyout amount | +12 | They can leave any time |
| Part-time | on/off | +20 for age 40+ | Half fee, limited availability |
| Trainer role | on/off | +6 for Veterans | Small stipend, rookies grow faster |
| Rematch clause | on/off | +10 for current champions | Booking obligation on title loss |
| Iron clad | on/off | +22 | Full remaining term owed on release |
| No compete | on/off | −18 (they hate it) | Protects you from rivals |

**Satisfaction thresholds:** 75+ signs immediately · 55-74 signs after one
counter · 35-54 counters twice then walks · below 35 walks immediately.
`demandStrictness` in settings scales all thresholds.

Clauses the player grants are permanent for the contract term and are the main
source of mid-game regret — a `noJobbing` clause on a wrestler who then stops
drawing is exactly the kind of self-inflicted problem this game should produce.

**Renegotiation** is possible mid-term at a cost: the wrestler will only accept
strictly better terms, and opening negotiations at all reveals to them that
they have leverage (+10 to all future demands).

```
expectedRate = (popularity^1.35) * 0.9 * companyWealthFactor * marketFactor
```

- `companyWealthFactor` — richer promotions are expected to pay more
- `marketFactor` — rises if rival promotions are also bidding
- Comparison to peers: a wrestler who learns a lower-popularity roster-mate
  earns more will demand parity or take a morale hit

**Personal reservations** — beyond money, bigger stars raise objections the
player must overcome by adjusting the offer:

| Reservation | Satisfied by |
|---|---|
| "I won't be buried" | `titlePush` or `creativeControl` clause |
| "I'm not moving across the world" | Promotion owns their home territory |
| "Your company is going nowhere" | Company rating above their threshold |
| "I don't work with [enemy]" | That wrestler not on the roster |
| "I want my friend hired too" | `nepotism` clause, or signing the friend |
| "I'm not doing hardcore garbage" | Low promotion hardcore saturation |

### Renewals, poaching, releases

- Contracts auto-enter renewal negotiation at 4 weeks remaining. Ignore it and
  the wrestler hits free agency.
- AI promotions bid on your expiring talent, and on contracted talent via
  buyout offers. Accepting a buyout is free money but costs morale across the
  locker room ("he sold Whack Ax to the highest bidder").
- Releasing requires a severance discussion; `ironClad` requires paying out the
  full remaining term. `noCompete` sends them to the school, unavailable to
  rivals for 12 weeks.

### Morale

Weekly morale adjustments:

| Condition | Δ morale |
|---|---|
| Booked in a match | +3 |
| Booked in main event | +6 |
| Unused this week | −4 (−9 with `nepotism`) |
| Unused 3+ weeks running | −9 cumulative |
| Lost 3+ matches in a row | −7 |
| Won a title | +18 |
| Lost a title | −10 |
| Scripted to lose | −15 |
| `titlePush` unfulfilled after 12 weeks | −8/week |
| Paid below roster peers | −5/week |
| Company rating rising | +2 |

Low morale consequences at thresholds: 40 → complains publicly (news item),
25 → refuses a booking or no-shows, 12 → walks out / demands release, and at
any level below 30 a low-`attitude` wrestler may betray the player by leaking
plans to a rival or sandbagging a match (−12 rating, unannounced).

---

## 16. Rival promotions and the world

Each AI promotion runs weekly on an abstracted version of the same engine:

1. Select a card from its roster using a booking heuristic weighted by its
   `styleProfile` (star-driven, workrate-driven, hardcore, women's-focused,
   territorial).
2. Simulate segments with the same rating formula (cheaper: skip narrative
   generation).
3. Move its rating on the same ladder.
4. Act on the talent market — bid on free agents, attempt buyouts, poach.
5. Attempt territory expansion if wealthy and highly rated.
6. **Track solvency.** AI promotions have real balance sheets and can go under.
   A promotion below zero for 8 weeks folds: its titles are retired, its roster
   dumps into the school en masse, and its territories go up for grabs. Driving
   a rival out of business by taking their territories, poaching their stars,
   and beating them in invasions is the closest thing this game has to a win
   condition.

AI promotions must be *legible rivals* — the Database screen shows their
ratings, champions, rosters, and recent show results so the player can track
them.

### Territories

- Each territory tracks per-promotion `following` (0-100).
- Running a show there raises your following by `showStars * 1.6`; **not**
  running there decays it by 1.2/week.
- Setting a new attendance record in a territory claims it, if unclaimed.
- Running a show in a rival-owned territory is an **invasion**: it damages
  their following and may trigger a confrontation.

### Cross-promotional supershows

Two promotions agree to run a joint PPV. This is the highest-risk, highest-
reward event in the game, and it exists because both bookers want something and
neither controls the outcome.

#### Negotiating the deal

Either side can propose. The proposal is a package:

| Term | Range | Notes |
|---|---|---|
| Host territory | Any territory either side holds | Host gets a larger gate share and home advantage in matches |
| Gate split | 0-100% | The main lever. A weaker partner demands more to show up |
| Card size | 8-14 segments | Split between the promotions |
| Segment allocation | Who books how many | Not necessarily even |
| Named matches | Each side proposes pairings | Both must approve every match |
| Champion vs champion | Yes / no, per pairing | The marquee draw and the biggest gamble |
| Appearance guarantee | Flat fee to the smaller partner | Common when a big promotion wants a small one's star |
| Rematch / follow-up clause | Optional | Commits both sides to a second show |

**Titles never change hands.** This is a hard rule, enforced by
`lineageProtected`. Champion vs champion is allowed and encouraged — but the
belts stay where they started. What's at stake is credibility, not gold.

#### How AI bookers decide

Each AI promotion has a `coopAppetite` (0-100) derived from its owner
personality, its current standing, and its resentment toward the proposer:

- **Eager** (high appetite, lower-ranked): sees a chance to be seen on a bigger
  stage. Accepts generous terms, may propose these itself.
- **Cautious** (mid): accepts, but demands a favorable gate split, an
  appearance guarantee, or approval over every match involving its champion.
- **Dismissive** (low appetite, higher-ranked): refuses outright, or names a
  price so high it's an insult. May publicly turn you down, which is itself a
  news story and a morale hit.
- **Hostile** (high resentment from invasions or poaching): refuses and
  escalates.

An AI booker also protects its own stars: it will reject pairings where its
champion is badly outmatched, and it will try to feed you its midcard while
demanding your top names.

#### Stakes and amplification

Cross-promotional match results are amplified in both directions:

```
popularityMultiplier   = 2.2   // both winner gain and loser loss
moraleSwing            = ±14   // the winner's whole locker room lifts
companyRatingSwing     = based on the promotion's overall win/loss on the night
titlePrestigeSwing     = ±6 for a champion who wins or loses (belt unchanged)
```

- A champion who **loses** to a rival's champion doesn't drop the belt, but
  takes a heavy popularity and prestige hit and looks inferior for months. The
  fans and the sim both remember.
- A **midcarder who beats a rival's main eventer** gets a career-making boost
  far beyond a normal upset.
- The promotion that wins the night on aggregate gains company rating,
  territory following in the host region, and a roster-wide morale surge. The
  loser takes the reverse.

Because outcomes are simmed, **neither booker can guarantee anything.** Agreeing
to champion vs champion is a genuine gamble with your top act's credibility,
and that tension is the entire point of the system. Stacking the deck still
works, but so does theirs — and you don't get to see what they stacked.

#### Aftermath

- Wrestlers who faced each other across promotions form a cross-promotional
  rivalry that persists, generating heat for a future joint show or a poaching
  attempt.
- A successful supershow raises both promotions' ratings and makes a sequel
  easier to negotiate. A disastrous one (poor buyrate, bad matches, a botched
  finish) sours relations and lowers `coopAppetite` on both sides.
- Beating a rival badly on a joint show is one of the fastest ways to damage
  them commercially — and a legitimate step toward driving them under.

### Inter-promotional war

Triggered by repeated invasion. Resolves as a 6-match showdown with each side's
champions auto-entered (the player may substitute their own competitors, not
the rival's). Entertainment is not the goal here — every match is simmed for
pure competitive outcome, no rating bonuses. Match wins swing both promotions'
ratings; the winning side takes the territory outright regardless of attendance.

Each stolen territory raises a `resentment` value with that promotion, making
them refuse talent trades and bid more aggressively against you.

---

## 17. Owner mandates

The owner (a generated character with a personality profile) checks in roughly
every 4 weeks with a mandate. Failure has consequences; three failures triggers
a firing and a game over.

*LOCKED: the owner can and will fire you.* Three failed mandates ends the run.
This is a real threat, not a bluff, and the firing screen shows the full career
summary and any Hall of Fame inductions from your tenure.

Mandate types:

- Sign a specific named wrestler within N weeks
- Release a specific wrestler
- Put a specific title on a specific wrestler
- Reach a company rating of N
- Cut weekly payroll below $N
- Draw N fans to a single show
- Push a specific young talent (get them to popularity N)
- Expand to N territories, or reclaim a lost one
- Reduce hardcore saturation ("we're not a garbage promotion")
- Run a show in the owner's home territory

Rewards: cash injection, roster slot expansion, a clause waiver, or reduced
scrutiny. Penalties: budget cut, forced release, disapproval strike.

Owner personality (`traditionalist | showman | penny-pincher | hardcore |
star-chaser`) biases which mandates appear and which stipulations they dislike.

---

## 18. Relationships, teams, factions, and staff

The roster is a social network, not a list. This section is what makes a
decades-long save feel like a living locker room rather than a spreadsheet.

### Relationships

```ts
interface Relationship {
  aId: string; bId: string;
  type: 'friend' | 'enemy' | 'mentor' | 'protege' | 'sibling' | 'parentChild'
      | 'married' | 'dating' | 'divorced' | 'exPartner';
  strength: number;          // 0-100
  history: RelationshipEvent[];
}
```

- **Friends and enemies** form organically from shared bookings, tag teams,
  stiff matches, backstage incidents, and promo targets — and persist across
  promotions. A friend signing with a rival makes a wrestler unhappy for weeks.
- **Romantic relationships** form between roster members over time. Married and
  dating pairs boost each other's morale; a breakup or divorce creates lasting
  bad blood, and one party may flatly refuse to work with the other or demand
  the other be released.
- **Refusal to work** is a hard booking constraint, not a penalty. If someone
  refuses, the segment cannot be booked without a heavy morale cost.
- **Families.** Over a long save, wrestlers have children. Given enough
  simulated years, a second-generation wrestler can appear in the school with
  inherited stat tendencies and their parent's name recognition — a popularity
  head start and a built-in storyline.
- **Mentorship.** Veterans with the trainer role and high coachability students
  accelerate stat growth and form lasting bonds.

### Match chemistry

Separate from relationships. Every pair of wrestlers accumulates a chemistry
value from working together — good matches raise it, bad ones lower it. High
chemistry is worth up to +10 match rating. A pairing that clicks is a genuine
asset the player should discover and exploit, which is part of what house shows
are for.

Tag teams accumulate **team chemistry** the same way.

### Mood

Distinct from morale. Morale is about their standing with the promotion; mood
is their emotional state, driven by relationships and life events.

`mood: 'fired up' | 'content' | 'restless' | 'frustrated' | 'grieving' |
'distracted' | 'bitter' | 'motivated'`

Mood modifies match rating (±8), injury risk, promo quality, and how they react
to booking decisions. A grieving wrestler who just lost a friend to a rival
promotion is not going to have a career night.

### Tag teams and factions — v1, not later

```ts
interface Team {
  id: string; name: string;
  memberIds: string[];
  type: 'tagTeam' | 'faction' | 'stable';
  chemistry: number;
  popularity: number;        // The team draws independently of its members
  formedWeek: number;
  leaderId?: string;         // Factions
  record: Record;
}
```

Teams have their own names, popularity, momentum, entrance, records, and title
reigns. Factions can run interference for their members automatically, feud as
units, and split acrimoniously — a faction breakup is one of the strongest heat
generators in the game.

### Staff roles

Every non-wrestler is a real roster member with stats, a contract, a paper-doll,
and the ability to be injured or quit.

| Role | Key stats | Function |
|---|---|---|
| **Manager** | charisma, attitude | Ringside odds bump, cuts promos *for* wrestlers with low charisma, can be paid extra to take bumps in a match (real injury risk), adds heat to their client's feuds |
| **Referee** | skill, attitude | Match control, DQ enforcement. A crooked ref is a deck-stacking lever. Low-attitude refs make mistakes; refs can be exposed, injured, or bribed by rivals |
| **Announcer** | charisma | Small show-wide rating bonus; a great commentary team raises every match slightly. Can also be a heel authority figure in angles |
| **Road agent** | skill, attitude | Passive: raises the rating floor of matches involving low-skill workers. A great agent makes your undercard watchable |
| **Trainer** | skill, coachability | Accelerates stat growth for young talent; improves the quality of school graduates |

Managers are the most flexible: some are pure mouthpieces for a wrestler who
can't talk, some are physical and take hits, some are just a body at ringside.
They cost money, they get hurt, and losing a great manager hurts their client's
whole act.

### Talking to your talent

The player can approach any roster member to request a change:

| Request | They may refuse if... |
|---|---|
| Change ring name | Popular under the current name, high ego |
| Change look / gimmick | `creativeControl` or `creativeFreedom` clause, or they like it |
| Turn heel or face | `creativeFreedom` clause, or it clashes with their gimmick |
| Join a tag team or faction | They dislike a proposed member |
| Take a manager | They think they don't need one |
| Move up or down the card | Nobody agrees to move down |
| Change finisher / move set | Low coachability |
| Train a specific stat | Low coachability, low energy |

Every request runs a check against attitude, coachability, morale, popularity,
ego, and contract clauses. **Refusal is not free for either side** — a rejected
request costs the wrestler some morale and, if the player pushes anyway, can
sour their attitude for months. Asking too often is itself a morale drain.

---

## 19. Statistics, records, and the Hall of Fame

Statistics are a headline feature, not bookkeeping. A decades-long save should
produce an archive worth browsing.

**Scope discipline:** track a focused, meaningful set well rather than an
exhaustive one badly. Everything below is core; anything not listed is
explicitly out of v1.

### Tracked per wrestler

- Wins, losses, draws, and win percentage (career and per year)
- **Championships in full detail** — which title, exact reign length in days,
  who they won it from, who they lost it to, and the date of each change
- Biggest rivalries, with the opponent, duration, peak heat, and how it ended
- Age, debut year, years active, retirement date
- Career-high popularity and when it peaked
- Average match rating, best match, worst match
- Most frequent opponent and most frequent tag partner
- Merchandise sales, career and current
- Injuries suffered

### Tracked per promotion

Rating history by week, attendance records by territory, gate records, show
ratings, title lineages, roster turnover, territories held over time.

### Tracked per title

Full lineage — every holder in order, with reign lengths and how each reign
began and ended. Longest and shortest reigns. Most decorated holder.

### Records book

A browsable screen of superlatives, always current: longest reign, most title
wins, highest-rated match, biggest gate, longest winning streak, oldest active
competitor, most matches worked, best-selling merchandise act. Records broken
generate news headlines.

### Annual awards

Every simulated year closes with an awards night — a bookable ceremony show
that boosts morale and company rating, and gives a decades-long save a rhythm
and a scoreboard.

Categories: **Wrestler of the Year, Match of the Year, Feud of the Year, Tag
Team of the Year, Most Improved, Rookie of the Year, Best Talker, Biggest
Draw, Best Promotion (all companies), Comeback of the Year.**

Awards are computed from tracked stats across *all* promotions, so your talent
can lose Wrestler of the Year to a rival's star — a genuine motivator and a
morale event either way. Winners get a popularity and morale bump; being
snubbed after a big year costs morale and can trigger an office visit.

### Locker room reputation

The promotion carries a hidden-ish reputation with talent, built from the
booker's history: how often requests are granted, whether contracts are honored,
whether stars are protected, how discipline is handled, whether people are
released mid-storyline, injury rates.

Reputation affects: which free agents will sign and at what price, how hard
rivals can poach, how much benefit of the doubt the locker room gives in a bad
stretch, and whether the wrestling school's best graduates come to you first. A
promotion with a terrible reputation pays a premium for everything.

### Hall of Fame

Wrestlers become eligible 3 years after retirement. Induction is scored on
popularity peak, title reigns, average match rating, longevity, drawing power,
and memorable feuds — with a threshold the player can also override to induct
someone manually (a personal favorite, a friend of the owner, a controversial
pick). Inductions happen at an annual ceremony show, which is itself a bookable
event that boosts company rating and roster morale.

Deceased and retired wrestlers remain fully browsable in the Database forever.

---

## 20. Random events and chaos

The systems above produce a competent management sim. **This section is what
makes it feel like a wrestling promotion.** Without it, weeks blur together and
the roster reads as spreadsheet rows. Events should fire often enough that no
week is routine, and land hard enough that plans get wrecked.

### The event engine

Each week, after the show resolves, roll for events:

```
eventCount = 1 + poisson(0.7)                       // usually 1-3 per week
```

Draw from a weighted pool. Every event declares `triggerConditions`, a base
`weight`, and `weightModifiers` keyed to world state. A locker room brawl is
near-impossible on a high-morale roster and near-certain on a roster full of
low-attitude, low-morale talent who just lost their spots.

Most events present the player with a **response choice** — 2-4 options, each
with a different cost and risk. Ignoring a problem is always an available
option, and is sometimes correct.

### Category A — Health and injury oddities

| Event | Trigger | Effect |
|---|---|---|
| Freak backstage injury | Any wrestler | 2-8 weeks out, no match involved. Slips in the shower, falls off a truck, injures himself in a promo. |
| Blown knee in training | Low health, high age | 8-20 weeks, permanent −6 agility |
| Botched spot aftermath | Match with `goAllOut` | Both participants −20 health, one takes a concussion (3 weeks) |
| Refuses surgery | Injured wrestler | Returns 40% faster, but permanent −8 to a random stat |
| Insurance dispute | Injured wrestler with a contract | Player pays medical bills directly or morale −15 |
| Mystery illness | Any | Unavailable 1-6 weeks, no explanation given until they return |

### Category B — Locker room incidents

| Event | Trigger | Effect |
|---|---|---|
| Real fight backstage | Two wrestlers, low attitude, existing enemy relation | Both injured 1-4 weeks; roster morale −6; a news story that adds +25 rivalry heat if you lean into it |
| Hazing the rookie | Rookie archetype on roster | Rookie morale −20 unless the player intervenes; veteran attitude −10 if disciplined |
| Locker room leader emerges | High attitude, high popularity | Roster-wide +1 morale/week while employed |
| Political sandbagging | Low attitude, threatened by a rising talent | The rising talent's next match rates −14 with no explanation |
| Someone's teaching your business to a rival | Low morale | Rival promotion gains knowledge of your roster; poaching bids get sharper |
| Drug policy failure | Low attitude | 6-week suspension, or the player covers it up (risk of a scandal, −12 company rating) |

### Category C — Professionalism

| Event | Trigger | Effect |
|---|---|---|
| No-show | Morale < 30 | Their segment collapses on show night; the player must reshuffle live with a penalty |
| Shows up drunk | Low attitude | −25 to their match rating, injury risk ×2, or pull them and eat the empty slot |
| Shows up late | Any | Their match moves down the card automatically |
| Blows off the gimmick | `creativeFreedom` clause or low morale | Their alignment flips against the player's booking |
| Goes into business for himself | Low attitude, scripted to lose | Refuses the finish — the sim result is overridden in their favor |
| Injures an opponent stiffly | Low attitude, high strength | Opponent out 4-12 weeks; the victim's camp demands the offender be released |

### Category D — Ambition and politics

| Event | Trigger | Effect |
|---|---|---|
| Demands a title shot | Popularity ≥ 70, no recent title match | Grant within 4 weeks or −20 morale |
| Demands a raise | Popularity risen 15+ since signing | Renegotiate or morale decays weekly |
| Wants to turn heel/face | Any, weighted by momentum | Grant for +10 morale and a fresh direction, or refuse for −12 |
| Wants a manager or a partner | Showman archetype | Pairing grants +8 morale and a small rating bonus to both |
| Threatens to quit | Morale < 20 | Player negotiates, promotes them, or lets them walk |
| Rival makes a public offer | High popularity, contract < 10 weeks | Match the offer, or lose them at expiry |
| Refuses to work with a specific opponent | Enemy relation | Booking them together anyway: −18 rating, both morale −10 |

### Category E — Shocks

Rare, high-impact, unignorable.

| Event | Weight | Effect |
|---|---|---|
| Sudden retirement | Age 34+, low health or morale | Gone immediately, mid-storyline, mid-title-reign |
| Death | Very rare; age and health weighted | Roster morale −25, memorial show event, titles vacated |
| Walkout / faction defection | 2-4 wrestlers, low morale, same rival relation | They all sign with one rival promotion the same week |
| A rival promotion folds | AI promotion bankrupt | Its entire roster hits free agency at once — a feeding frenzy |
| Talent invasion | Rival resentment high | A rival's stars appear uninvited at your show; the player chooses to confront or exploit it |
| Building fire / venue disaster | Rare | Show cancelled, lost gate, insurance payout |
| Viral moment | High-rated segment | +12 popularity to the participants, +4 company rating |
| Championship belt stolen/lost | Any champion | Title vacated or a replacement belt commissioned at cost |

### Category F — Life happens

The texture of a real locker room. Most of these are not wrestling problems at
all, which is exactly why they land. Each presents 2-4 response options, and
the same event should produce different outcomes depending on who it happens to.

**Domestic and personal**

| Event | Effect |
|---|---|
| Getting married | Mood "content" for 8 weeks; wants a week off for the honeymoon |
| Having a baby | Wants reduced dates; morale +20 if granted, −25 if refused |
| Nasty divorce | Mood "distracted" for 12 weeks, −10 match rating, may need money |
| Caring for a sick parent | Requests time off, unavailable or distracted |
| Moved across the country | Wants to be booked closer to home; travel costs rise |
| Bought a bar / restaurant | Distracted, but throws a roster party (+morale) |
| Adopted a dog and won't stop talking about it | Harmless. +2 morale, roster amused |
| Wants to bring their kid to shows | Grant it for a mood boost; refuse for a small hit |

**Side hustles and delusions of grandeur**

| Event | Effect |
|---|---|
| Started a podcast | Charisma +4 over time, but shoots on the promotion occasionally |
| Wants to be a rapper | Demands a music-themed gimmick and entrance. Rating gamble |
| Cast in a movie | Unavailable 6-14 weeks, returns with +12 popularity |
| Landed a commercial | +popularity, sponsor happy, wants a raise |
| Wrote a memoir | Reveals backstage secrets, several roster relationships sour |
| Fitness influencer now | Popularity +8, but skips training, skill drift stalls |
| Wants to be a booker | Give them creative input for morale, or refuse |
| Convinced they should be champion right now | Classic. Grant, promise, or refuse |
| Bought a horse. A racehorse. Broke now. | Requests an advance on pay |

**Body and appearance**

| Event | Effect |
|---|---|
| Enormous new tattoo | Look changes; some sponsors object |
| Shaved their head | Popularity dips 3 then recovers; freshness +15 |
| Massive weight gain | Crosses a weight class, agility drops, may lose title eligibility |
| Got shredded in the offseason | Strength and agility up, popularity up |
| Terrible cosmetic surgery | Popularity −8, roster mocks them, morale −12 |
| Botched dye job | Purely cosmetic, brief news item, roster laughs |
| Grew an unbelievable beard | Freshness +10, merch bump |
| Lost their gear bag in transit | Works the show in borrowed gear, small rating hit |

**Travel and logistics**

| Event | Effect |
|---|---|
| Missed their flight | Misses the house show entirely |
| Visa denied | Cannot work certain territories for 8-20 weeks |
| Car wreck on the road | Injury roll plus vehicle costs |
| Rental car destroyed by a roster member | Someone has to pay. Who? |
| Stranded by a snowstorm | Half the card is late; show rating penalty |
| Food poisoning at the venue | 2-4 wrestlers perform badly or pull out |
| Lost passport | Missing 2 weeks |

**Legal and reputational**

| Event | Effect |
|---|---|
| Arrested | Suspension decision; sponsors react; news cycle |
| Bar fight caught on video | Popularity +6 with hardcore fans, sponsors furious |
| Sued for gimmick infringement | Legal costs and a forced repackage |
| Sued by a fan hurt at a show | Legal costs, insurance dispute |
| Failed a drug test | Suspension or cover-up (§20 Category B) |
| Public feud with a wrestling journalist | Free publicity, +popularity, owner unhappy |
| Said something awful on social media | Sponsor demands a firing |
| Accused by a rival of stealing their gimmick | Cross-promotional heat |

**Belief, ego, and nonsense**

| Event | Effect |
|---|---|
| Found religion | Refuses certain stipulations and storylines |
| Went vegan and won't shut up | Roster morale −2, their stamina +4 |
| Joined something that is definitely a cult | Mood erratic; may vanish for 6 weeks |
| Convinced the referee is out to get them | Refuses to work with that ref |
| Demands a bigger entrance / more pyro | Costs money, small rating boost |
| Insists on going last on every card | Ego problem; refusing costs morale |
| Started training a protégé without asking | New mentorship relationship appears |
| Learned a new style abroad | Stat shift: −strength, +skill and agility |
| Claims they were "buried" and posts about it | Fan sympathy, locker room split |

**Good things too**

| Event | Effect |
|---|---|
| Career-best match | Popularity +10, freshness restored, confidence |
| Went viral | +15 popularity for 6 weeks then partial decay |
| Fan-favorite moment with a sick child | Popularity +8, sponsors love it, morale +15 |
| Two wrestlers discover they click | Permanent chemistry bonus |
| A veteran takes a rookie under their wing | Rookie growth accelerates |
| Trainee graduates ahead of schedule | Better than advertised stats |
| Local hero returns home | Massive attendance boost in that territory |

### Outside opportunities — never one-sided

Media, side projects, and outside bookings are **not the wrestler's business
alone**. Almost every one of them cuts both ways, for the wrestler *and* for
the promotion, and the player has to weigh both columns.

The decision is always: *do I let them go do this?* And the answer is genuinely
non-obvious.

| Opportunity | Wrestler gains | Wrestler loses | Company gains | Company loses |
|---|---|---|---|---|
| **Movie / TV role** | +12-20 popularity, +6 charisma, mainstream credibility | Unavailable 6-14 weeks, −stamina and ring rust on return, freshness decays while away | Big popularity halo on return, +company rating, sponsor interest, new territory following | A top act gone for months, storylines orphaned, attendance dip |
| **Podcast** | +4 charisma over time, fan connection, side income | Distraction, may shoot on the promotion | Free weekly promotion, +territory following, recruiting tool | Occasional damaging comments, −owner approval, may leak plans |
| **Commercial / endorsement** | +8 popularity, income, wants a raise after | Ties them to a brand | Sponsor value up, mainstream visibility | They'll ask for a merch cut or raise |
| **Guest appearance for a rival promotion** | +popularity, cross-promotional heat | Fatigue, injury risk you don't control | Goodwill for a future supershow, exposure to their fans | Legitimizes the rival, and your star can lose over there |
| **Documentary about the promotion** | Featured talent +popularity | Time commitment | +company rating, +following everywhere, recruiting boost | Airs the locker room's problems; morale risk if it's honest |
| **Autobiography** | +popularity, income | Burns relationships | Free publicity | Several roster relationships sour, secrets out |
| **Video game / apparel licensing** | +merch, +popularity | — | Real revenue, sponsor tier unlock | Locks in a gimmick you may want to change |
| **Charity work / hospital visits** | +popularity, +morale, mood boost | Time | +company reputation, sponsor delight, locker room morale | Small time cost only — this one is nearly all upside |
| **Coaching at the school** | +respect, mentorship bonds, prepares a post-ring career | Less ring time, popularity drifts down | Better graduates, faster rookie growth, cheaper talent pipeline | Their own act cools |
| **Training abroad** | −strength, +8 skill, +6 agility, +freshness | Gone 8-16 weeks | Returns as a better worker with a new style the territory hasn't seen | Gone during a run, and rivals may sign them while they're out |
| **Fitness influencing** | +8 popularity, +merch | Skips real training, skill stalls | Sponsor interest, young fan reach | Their in-ring work quietly deteriorates |
| **Music project** | +charisma, +freshness, gimmick refresh | Ridicule if it flops (−popularity) | Novelty draw, crossover audience | Sponsor and owner may hate it |
| **Reality TV** | +18 popularity fast, decays faster | Credibility hit (−4 skill perception), −respect from the locker room | Huge short-term attendance and rating spike | The bump fades in ~12 weeks and the roster resents them |

**Design rules:**

1. Every opportunity has at least one real cost to each side. There are almost
   no free wins — charity work is the deliberate exception, and even that costs
   time.
2. Refusing is always available, always costs the wrestler morale, and
   sometimes costs the company an opportunity it needed.
3. The same opportunity is a different decision depending on *who* it lands on.
   A movie role for your world champion mid-title-reign is a crisis; the same
   role for a stale midcarder is a gift.
4. Some opportunities are offered **to the company**, not the wrestler — a
   documentary, a licensing deal — and the player chooses which talent to put
   forward, which is its own political decision the locker room notices.

### Keeping it from getting repetitive

This is a decades-long game. Repetition is the real failure mode, so the event
engine has explicit machinery against it:

1. **Per-event cooldowns.** Every event carries a `cooldownWeeks` (typically
   30-150) and a `perWrestlerCooldown`. The same event cannot recur globally or
   to the same person inside its window.
2. **Text variants.** Every event has 3-6 phrasings, and names, numbers, and
   details are slotted in, so even a repeat reads differently.
3. **Weighting by context.** Events are drawn against the actual world state —
   a wrestler who just won a title gets different events than one who's been
   off TV for a month. Most events are simply ineligible for most of the roster
   at any given time.
4. **Escalating rarity.** Events are tiered common / uncommon / rare / once-per-
   save. The rarest tier fires a handful of times in a decade and should feel
   like a story you remember.
5. **Event chains.** Roughly a third of events are the first beat of a
   multi-week arc rather than a one-off — an arrest becomes a court date
   becomes a verdict; a side hustle becomes a departure becomes a return. The
   player's early responses change how the chain resolves.
6. **No consecutive-week repeats of a category.** The same category can't fire
   twice in a row unless the chaos slider is at maximum.
7. **Content budget.** Target **150+ distinct events at v1**, growing after.
   The tables above are a starting seed, not the full list — treat authoring
   more of them as ongoing content work, and structure them as data files so
   new ones can be added without touching engine code.

### Events during a show

Rare — roughly one show in twelve — an event fires *while the card is running*
and the player must respond before results resolve:

- A wrestler refuses to go on unless paid a large bonus on the spot
- Someone doesn't show up at all and their slot needs filling from who's there
- A wrestler is hurt in an earlier segment and can't make their later one
- A backstage fight erupts between two people booked later that night
- A rival's talent appears uninvited

Each presents 2-4 immediate choices with real costs: pay the bonus, pull them
and eat the empty slot, push someone else into the spot unprepared, or send the
match out anyway with a wrestler who resents it.

### Discipline

The player's response toolkit for misconduct, available from any wrestler's
profile and offered directly on relevant events:

| Action | Effect |
|---|---|
| Let it slide | No cost now; repeat offenders get bolder, locker room notices |
| Private word | Small attitude improvement if morale is decent; nothing if not |
| Fine | Recovers some money, −morale, scales with the offense |
| Suspend (1-8 weeks) | Removes them from bookings, −morale, −popularity from absence |
| Demote down the card | −morale, but a real signal to the roster |
| Send home from a show | Immediate, costs you the segment |
| Release | Clean but expensive under `ironClad`, and they land with a rival |

Discipline is watched: consistently punishing misconduct raises roster-wide
attitude over time, while never punishing anything lets the locker room rot.
Punishing a popular wrestler unfairly costs morale across the board.

### When someone leaves mid-story

A wrestler quitting, dying, being released, or suffering a long injury in the
middle of an active rivalry or title reign is common, and the game handles it
explicitly rather than silently deleting the thread:

| Situation | Options offered |
|---|---|
| Champion leaves | Vacate the title (§3.1) or have them drop it before departure if there's time |
| Rivalry orphaned | Transfer the feud to a partner or protégé · write it off as a victory for the survivor · let it fade (credibility −4) |
| Tag partner leaves | Replace them, break up the team, or push the survivor as a singles act |
| Faction leader leaves | Promote a member, or the faction dissolves with a morale hit |
| Someone dies mid-feud | A memorial show and a tribute match are offered; declining costs significant morale |

Unresolved threads decay: an abandoned rivalry costs booking credibility, and
the roster notices when storylines just stop.

### Design rules for the event system

1. **Events must be legible.** Every one generates a news headline explaining
   what happened and why, and appears in the wrestler's profile history.
2. **Events must be exploitable.** A backstage brawl should be convertible into
   a hot feud. A rival folding should be a signing opportunity. The player who
   reads chaos well should profit from it.
3. **No unavoidable death spirals.** Events never fire in a combination that
   makes recovery mathematically impossible. Cap the total weekly severity.
4. **Frequency scales with roster instability.** A well-paid, well-booked,
   high-attitude roster is genuinely calmer. Managing morale is how the player
   buys down chaos — which makes morale management feel worth doing.

---

## 21. Screens

| Screen | Contents |
|---|---|
| **Calendar / Home** | Month strips with weekly slots (TV / PPV / past icons), company header bars (Rating, Champion, Talent, Age, Face-Heel Ratio, Territory %), payroll as "rate × headcount", bank balance, current venue and territory. Buttons: Roster, Map, Database, Card. |
| **Roster** | Grid of name plates. Color-coded: green face, purple heel, pink women's division, gray non-wrestler. Health as a red bar consuming the plate from the right. Belt icons under champions. Sortable by any stat, contract value, health, age, morale. Selecting shows the paper-doll, stat bars, and contract card ("$4,300 × 45 weeks · INCENTIVE"). |
| **Wrestler Profile** | Full paper-doll, stat bars, career record, title history, current rivalries, contract, morale and momentum, recent match log. Actions: book, negotiate, release, train, change gimmick. |
| **Card Builder** | Slot layout — Main Event on top, Mid Card, Under Card — matching the reference screenshot. Empty slots invite filling; filled slots show participants and post-show star rating. Drag to reorder. |
| **Match Setup** | Tabs: Rules · Cast · Stipulation · Stack the Deck. The Stack tab shows a fuzzy confidence band ("Slight edge," "Heavy favorite") updating as levers toggle. Never a percentage, never an itemized breakdown. |
| **Show Runner** | Results arrive as a completed card at the end of the night, not one match at a time. The full card renders with every result, star rating, and attendance figure at once; tapping any segment expands its play-by-play narrative and full rating breakdown. |
| **Show Summary** | Show stars, gate, payroll, net, rating movement, title changes, injuries, notable popularity swings. |
| **Finances** | Balance history chart, revenue and expense breakdown, payroll table by wrestler, projections. |
| **Titles** | Every belt with its holder, prestige, current reign length, and full lineage. |
| **Map** | World territory view. Ownership colors, following percentages, capacity, preferences, attendance records. Charter travel. |
| **Database** | All promotions ranked by rating, their champions and rosters, global popularity leaderboard, the records book, and the Hall of Fame (§19). Includes retired and deceased wrestlers permanently. |
| **Relationships** | Roster social map — friendships, enemies, couples, families, mentorships, tag teams, factions, and match chemistry ratings. |
| **Wrestler Editor** | Full pixel-art appearance editor for created wrestlers and mid-game look changes. |
| **World Creation** | Presets and the full settings tree (§5), including seed entry. |
| **Onboarding** | A guided first four weeks. Not a wall of text: the game runs a reduced roster and reduced systems, unlocking the office, contracts, chaos, territories, and cross-promotion over the first month. Skippable entirely. A dense management sim on a phone lives or dies on whether the first ten minutes make sense. |
| **News** | Weekly generated headlines: results, signings, injuries, complaints, rival activity, retirements, deaths, records broken. Also carries the **dirt sheet** — an independent pundit rating of your show that often disagrees with the internal number, praises workrate the crowd ignored, and buries your booking logic. Dirt sheet opinion nudges the smart-fan segment of your audience and gives the player an outside voice to argue with. |
| **Rankings** | Top 10 contenders per division, booking credibility, and which title shots the fans think are overdue. |
| **Inbox / Meetings** | Owner mandates, talent complaints, poaching bids, contract expirations. |

### Audio

Minimal. A single generic background track during show results, a crowd sting
for title changes and big upsets, and UI clicks. Toggleable, off by default on
mobile. No entrance themes, no commentary audio.

### Visual direction

**Modern, not retro.** The reference screenshots were shared for *content and
mechanics*, not art direction — do not imitate their worn-paper or 3D look. The
target is a clean, contemporary, high-contrast interface that happens to be
about wrestling: dense information laid out well, confident typography, strong
color coding. The only pixel art in the game is the wrestler sprites themselves,
which contrast deliberately against the clean UI.

**Phone-first, and it must be genuinely good on a phone** — not a desktop
layout squeezed down. Every screen is designed for a thumb: single-column,
tappable rows, bottom-anchored primary actions, no hover states, no dense
tables that require horizontal scrolling. Desktop gets the same layout with
more breathing room.

Card screens use **bust portraits**, not full-body sprites — space is at a
premium and portraits read better at a glance. Full-body sprites appear on the
wrestler profile and in the editor.

Star ratings, health/energy bars, and alignment colors are the three visual
languages that must be instantly parseable everywhere they appear.

**Accessibility is a real requirement, not a checkbox.** This design leans
heavily on color coding — face/heel green and purple, health in red — which
fails for a meaningful share of players. Every color-coded distinction must
also carry a shape, icon, or label: alignment gets a glyph as well as a color,
health gets a numeric or segmented indicator, star ratings get the numeral.
Provide a high-contrast mode, respect system text scaling, and never rely on
color alone to convey anything.

---

## 22. Persistence

- Single save slot per world. **Save and load is the entire requirement** — no
  export/import, no cloud sync, no account.
- Store in IndexedDB. Save after each week resolves.
- Save shape: `{ version, seed, week, wrestlers[], promotions[], titles[],
  territories[], rivalries[], shows[] (last 52 weeks in full, older summarized),
  records, inbox[], settings }`
- Include a `version` field and a migration chain from day one — this game
  will change shape repeatedly and saves spanning simulated decades are the
  whole point.
- Show history older than one year compresses to a summary row (date, type,
  territory, attendance, stars, main event) to keep saves bounded.

### Offline

*LOCKED: the game must work fully offline.* Ship it as an installable PWA with a
service worker caching the whole app shell. Nothing in the game requires a
network call — all generation, simulation, and storage is local. The player
should be able to install it to their phone home screen and play on a plane.

---

## 23. Build milestones

**M0 — Engine skeleton and test harness**
Types, `WorldSettings` with all defaults, seeded RNG, wrestler generation, name
generation. A headless script that
generates 300 wrestlers and prints them. No UI.

**M1 — Paper-doll and editor**
Pixel-art layer system, all trait ranges, three size variants, distinctness
check, and the full appearance editor for created wrestlers. A contact-sheet
page rendering 100 generated wrestlers.

Each milestone below lists what must work. The definition of done in §0 applies
to all of them.

**M2 — Core loop, playable**
Calendar, roster screen, card builder, match rules, the sim engine, star
ratings, rating breakdown, show ratings, the TV ladder, attendance, gate,
payroll. *This is the first genuinely playable version.*

**M3 — Consequences and the locker room**
Titles, champions, prestige, popularity transfer, injuries, health, energy,
momentum, morale, mood, aging, retirement, the wrestling school with random
trainee arrivals, tag teams and factions, staff roles, relationships and match
chemistry, statistics tracking.

**M4 — Stack the deck**
Managers, referee assignments, run-ins, pre-match angles, instructions, live
odds display, the scripted-finish escape hatch.

**M5 — The world**
Contracts, clauses, negotiation, poaching, releases, rivalries, promos,
alignment turns, AI promotions, the Database screen, owner mandates, TV rights
deals and arena tiers.

**M5.5 — Chaos**
The random event engine and all five event categories. Slot this immediately
after M5 rather than last: the events depend on morale, contracts, and rival
promotions existing, and the game is noticeably lifeless until they land.

**M6 — Territories and legacy**
Map, travel, following decay, attendance records, invasions, inter-promotional
war, territory preferences feeding match ratings.

Also in M6: the Hall of Fame, the records book, second-generation wrestlers,
and rival promotions folding.

**Post-v1 candidates:** multi-week storyline planner, custom promotion
creation, historical era presets, merchandise and licensing depth.

---

## 24. Open decisions

Things I've made a call on that are worth a second look before building:

1. ~~Charisma stat.~~ **RESOLVED — added**, along with coachability and
   toughness. A bad worker who's a great talker is now expressible.
2. ~~Tag teams and factions.~~ **RESOLVED — in from square one**, with their
   own popularity, chemistry, records, and titles. See §18.
3. ~~Booking in advance.~~ **RESOLVED — week by week.** The one exception is
   the "challenge to a match" promo topic, which announces a future match
   organically through a storyline rather than a planner.
4. **The clamp range.** [8%, 92%] is my proposed ceiling on stacking. Tighter
   (15/85) makes upsets common and the player feel powerless; looser (3/97)
   makes stacking near-deterministic and kills the tension. Worth tuning
   against real play.
5. ~~Difficulty / world size.~~ **RESOLVED** — fully exposed in §5 settings.
6. **Women's division.** Modeled as a title tier and a territory preference.
   Whether divisions are segregated or intergender is allowed is a
   world-creation setting. *Still open: your call on the default.*
7. ~~Picking winners.~~ **RESOLVED — the sim always decides.** No scripted
   finishes, no escape hatch, no re-sims. The scripted-finish system has been
   cut from §10 entirely.
8. **Match length.** Currently derived from `timeLimit` and stamina rather than
   set by the player. An explicit "give them 20 minutes" lever would be another
   good deck-stacking dial. *Recommendation: add as an instruction option.*### 11.5 Match highlights, not play-by-play

**The single most important rule in this document:** the player never watches a
match and never reads a full transcript of one. What they get is a **highlight
reel** — a short account of the moments that actually mattered.

The engine emits a `beats[]` array during simulation. Only beats flagged
`significant` are rendered. A typical write-up is 3-5 lines:

- How the match felt overall (one line on flow — a grind, a sprint, a
  back-and-forth, a squash, a mess)
- Any turning point that swung the outcome (a manager's distraction, a missed
  high spot, a wrestler gassing out)
- Interference or referee incidents, and what they changed
- The injury, if one occurred
- The finish, named — the actual finishing move and how it landed

Example shape (not literal copy):

> A stiff, plodding grind that never found its rhythm. Boston Blufly ran out of
> gas around the ten-minute mark. Geno White's manager pulled the referee out at
> the worst possible time, and Blufly hit the Backbreaker Driver on a man who
> never saw it coming.

**Images are welcome.** Portraits of the participants alongside the highlight
block, the belt if one was on the line, a visual marker for injury or
interference. What is *not* welcome is anything that resembles watching the
match happen.

Each segment also produces a **rating breakdown panel** listing every
contributing factor. This is non-negotiable: the player must always be able to
see exactly why a match got the stars it got.

---

## 12. Post-match consequences and the stat economy

### Popularity transfer

```
gap    = winnerPop - loserPop
base   = 2.5
slotMultiplier   = [0.7, 0.8, 1.0, 1.2, 1.5, 2.2]  // by card position
decisiveness     = clean finish 1.0 | dirty 0.6 | non-decisive 0.3
upsetBonus       = gap < 0 ? min(abs(gap) * 0.08, 4) : 0
titleChangeBonus = 4 if a title changed hands
ppvMultiplier    = 1.8 on PPV

winnerGain = (base + upsetBonus + titleChangeBonus) * slotMult * decisiveness * ppvMult
loserLoss  = winnerGain * 0.55 * (gap > 0 ? 1.3 : 0.7)
```

The `giveHimTheRub` instruction halves `loserLoss`. Losing to a much more
popular opponent in a well-rated match can actually *raise* the loser's
popularity — this is how the player builds midcarders and must be discoverable.

### Health, injury, momentum

```
healthCost = 8 + violenceLevel * 4 + (matchLength / 10) * 3
             × instructionMultiplier
             × (1.4 for the loser)

injuryChance = 0.022 * stipulationInjuryMult
             * (1 + (100 - stamina) / 100)
             * (1 + (100 - health) / 140)
             * (age > 35 ? 1.3 : 1.0)
             * instructionMultiplier
```

Injury severity roll: minor (1-3 weeks) 60%, moderate (4-10 weeks) 30%,
severe (11-30 weeks) 8%, career-threatening (31-60 weeks, permanent stat loss)
2%.

### Rehab and the early return

An injured wrestler is unavailable and rehabbing. As the clock runs down, the
game shows their recovery honestly: weeks remaining and current condition.

**Within the final 3 weeks of a rehab, they can come back early** — either
because the wrestler asks in the office, or because the booker asks them to.
It is always a gamble:

| Weeks early | Effective stat penalty | Re-injury risk multiplier |
|---|---|---|
| 1 week early | −8% across physical stats | ×2.2 |
| 2 weeks early | −16% | ×3.4 |
| 3 weeks early | −25% | ×5.0 |

A re-injury from an early return is rolled one severity tier worse than normal
and carries a real chance of permanent stat loss or a forced retirement. The
wrestler's `toughness` and `attitude` determine whether they volunteer for it,
and whether they resent being asked.

This exists to create a specific, recurring, genuinely hard decision: your
world champion is two weeks from healthy and the PPV is Sunday.

Momentum: `+8` for a decisive win, `+4` for a dirty win, `−7` for a loss,
`±(stars − 3) * 2` from the match quality regardless of outcome. Decays 4/week
toward 50.

### Rivalry heat

- Match between rivals: `+6`, or `+12` if the finish was non-decisive
- Promo advancing the rivalry: `+10`
- Beatdown angle: `+14`
- Decisive blowoff in a grudge stipulation: rivalry ends, winner gets
  `heat * 0.12` popularity


---

## 12.5. The stat economy

Every stat in this game moves. This section defines exactly how, because the
whole feel of a decades-long save depends on getting these rates right.

### Governing principles

1. **Nothing moves fast except popularity, morale, and momentum.** Physical and
   technical stats are measured in fractions of a point per week. A wrestler
   who gains 10 skill in a year has had a hell of a year.
2. **Soft caps.** Every gain is scaled by headroom: `actualGain = rawGain *
   (potential - current) / 40`, clamped to 0 at or above potential. Improvement
   slows dramatically as a wrestler approaches their ceiling.
3. **Hidden potential.** Each wrestler is generated with a per-stat `potential`
   (their ceiling) and a `growthRate`. Two rookies with identical visible stats
   can have completely different futures. Potential is never shown, only
   inferred from how fast they actually improve — this is what makes signing
   unscouted school graduates a gamble worth taking.
4. **Everything decays.** Gains are opposed by drift so the world doesn't
   inflate over twenty simulated years. A stat left unexercised drifts down.
5. **Displayed as bars, not numbers.** The player sees segmented bars and
   trend arrows (rising, steady, declining), not `74`. Precision is engine-only.

### Popularity — the volatile one

| Raises | Amount |
|---|---|
| Winning a match | +2.5 base, ×card position (0.7 opener to 2.2 main event), ×1.8 on PPV |
| Upset win over a bigger name | up to +4 extra |
| Winning a title | +4, plus ongoing drift toward title prestige |
| High-rated segment regardless of outcome | +(stars − 3) × 1.5 |
| Losing a great match to a much bigger star | up to +1.5 (the rub) |
| Strong promo | +1 to +3, scaled by charisma |
| Merch selling well | +0.3/week |
| Outside media (§20) | +8 to +20 |
| Winning an annual award | +6 |
| Cross-promotional win | ×2.2 amplifier |

| Lowers | Amount |
|---|---|
| Losing | −(winner's gain × 0.55), worse if they were favored |
| Not booked at all | −0.8/week, accelerating after 3 weeks |
| Gimmick freshness below 50 | gains stop; below 25, −0.5/week |
| Bad segments | −(3 − stars) × 1.2 |
| Age past 38 | −0.15/week, steepening |
| Long injury absence | −0.6/week away |
| Cross-promotional loss | ×2.2 amplifier |
| Repackaging | −20% immediately |

### Strength

| Raises | Rate |
|---|---|
| Assigned strength training | +0.25/week (costs energy and money) |
| Weight gain | +4 permanent per class moved up |
| Natural growth, age 19-28 | +0.08/week |
| Powerhouse/Monster archetype | ×1.4 on all gains |

| Lowers | Rate |
|---|---|
| Age 33+ | −0.10/week, −0.22 past 42 |
| Weight cut | −2 per class moved down |
| Injury layoff | −0.3/week while out |
| Untrained for 12+ weeks | −0.05/week drift |

### Skill — the one that keeps growing

| Raises | Rate |
|---|---|
| Working a match | +0.10, doubled if the opponent's skill exceeds theirs by 15+ |
| Long matches (20+ min) | +0.15 extra |
| Assigned skill training | +0.20/week |
| Working under a trainer/road agent | ×1.5 on all skill gains |
| High coachability | ×(0.6 + coachability/100) on all gains |
| Training abroad | +8 over the trip |
| Age 30-40 | small bonus — ring IQ compounds |

| Lowers | Rate |
|---|---|
| Age 45+ | −0.06/week |
| No matches for 8+ weeks | −0.08/week (ring rust) |
| Returning from long injury | −4 immediately, recovered over 8 weeks |

### Agility

| Raises | Rate |
|---|---|
| Youth, age 19-26 | +0.10/week |
| Assigned conditioning | +0.18/week |
| Weight cut | +3 per class moved down |
| High Flyer archetype | ×1.4 |

| Lowers | Rate |
|---|---|
| Age 29+ | −0.12/week, −0.25 past 38 |
| Weight gain | −5 per class moved up |
| Any leg or back injury | −3 permanent per severe occurrence |
| Accumulated career matches | −0.02/week after 400 matches |

### Stamina

| Raises | Rate |
|---|---|
| Working matches regularly | +0.08/week when booked 2+ times |
| Assigned conditioning | +0.20/week |
| Long matches | +0.12 extra |
| Going vegan / lifestyle events | +4 one-off |

| Lowers | Rate |
|---|---|
| Age 34+ | −0.11/week |
| Weight cut (temporary) | −6, recovering over 4 weeks |
| Injury layoff | −0.35/week while out |
| Chronic overbooking | −0.15/week if worked 3+ times weekly for a month |

### Attitude — the social stat

| Raises | Amount |
|---|---|
| Requests granted in the office | +2 each |
| Being pushed and winning | +1/week during a push |
| Paid fairly relative to peers | +0.5/week |
| A locker room leader present | +0.3/week roster-wide |
| Consistent, fair discipline | +0.4/week roster-wide |
| Mentorship from a veteran | +1.5/week for the protégé |

| Lowers | Amount |
|---|---|
| Requests refused | −2 each, compounding on repeats |
| Buried — losing repeatedly in low spots | −1.5/week |
| Paid below peers | −1/week |
| Punished unfairly, or a popular teammate punished | −2 |
| Released friends, or a friend signing elsewhere | −4 |
| Substance problems | −3/week untreated |

### Charisma

Rises +0.15 per promo performed (×1.6 if the promo rated well), +0.10/week with
a podcast or media project, +2 permanent from a successful repackage. Falls
−0.05/week if they haven't cut a promo in 8 weeks, and −0.10/week past age 50.

### Coachability and toughness

**Coachability** is near-fixed: −0.05/week past age 33, and −0.1/week whenever
popularity exceeds 85 (ego). It never rises except through a humbling event
(a bad injury, a demotion accepted gracefully).

**Toughness** rises +0.4 per hardcore-stipulation match survived and +0.2 per
match worked injured. It falls −0.15/week past age 36 and −2 permanently per
severe injury.

### The dynamic four

| Stat | Recovers | Drains |
|---|---|---|
| **Health** | +stamina/4 per week resting; +stamina/8 if booked | 8 + violence×4 + length/10×3 per match; ×1.4 for the loser |
| **Energy** | +18/week resting, ×(0.6 + stamina/100) | −14 per match, −8 per promo, −6 per house show, −5 per territory traveled |
| **Momentum** | +8 decisive win, +4 dirty win, ±(stars−3)×2 | −7 per loss; decays 4/week toward 50 |
| **Morale** | See §15 table | See §15 table |

### Fatigue and burnout — working too many weeks in a row

Energy is not just a per-match drain. **Consecutive weeks worked accumulate**,
and a wrestler run every week for months will fall apart even if their health
bar looks fine.

```ts
consecutiveWeeksWorked: number;   // Resets on any week with no booking
fatigueDebt: number;              // 0-100, separate from energy
```

Each week worked adds fatigue debt:

```
weeklyDebt = 4 + (matchesThisWeek - 1) * 5
           + (longMatch ? 4 : 0) + (hardcoreMatch ? 5 : 0)
           + (traveled ? 3 : 0)
debt *= (1.6 - stamina/100)          // low-stamina workers accumulate faster
debt *= (age > 35 ? 1.35 : 1.0)
```

Fatigue debt recovers **only during weeks with no booking at all**, at
`10 + stamina/6` per week. Energy alone recovering is not enough — the wrestler
needs actual time off.

| Fatigue debt | Effect |
|---|---|
| 0-25 | Fresh. No penalty. |
| 26-45 | Slightly worn. −3 match rating. |
| 46-65 | Tired. −8 rating, injury risk ×1.4, stamina gains stop. |
| 66-80 | Badly worn. −15 rating, injury ×2.0, they ask for time off in the office. |
| 81-100 | **Burnout.** −25 rating, injury ×3.2, permanent stamina and toughness loss of 1 point per week in this state, and a real chance they simply refuse to work or hand in notice. |

**The design intent:** a booker cannot ride their six best wrestlers forever.
Depth is mandatory, not optional. Building a midcard exists as a strategy
because your main eventers physically cannot work 52 weeks a year.

Countermeasures the player has:
- Rest weeks — book them off entirely, accept the popularity decay
- Part-time contracts (§15) — half the exposure, half the accumulation
- House shows only, no TV, for a lighter week
- Interviews and promos instead of matches — almost no fatigue cost
- Writing them off TV with an injury angle for a month

Fatigue is visible to the player as a wear indicator on the roster screen, not
a number, and wrestlers mention it in the office before it becomes critical.

### Training

Each week the player may assign up to **three wrestlers** to a training focus:

| Focus | Raises | Notes |
|---|---|---|
| Strength | strength | Adds weight over time; may push them up a class |
| Conditioning | stamina, agility | The best all-round investment for young talent |
| Technical | skill | Slowest gains, but skill never stops mattering |
| Aerial | agility, skill | High injury risk during training |
| Striking | strength, toughness | Fast, physical, wears them down |
| Promo work | charisma | Needs a trainer or a manager on staff to be effective |
| Style conversion | changes `style` | 10-16 weeks, −8 rating on their matches throughout |
| Weight change | moves weight class | Unavailable entirely while cutting or gaining (§3.2) |

Training Costs money per wrestler per week
and drains energy, so a wrestler training hard is a wrestler wrestling worse.
Effectiveness scales with coachability, age, and whether a trainer is on staff.

This is the deliberate long game: the booker who invests in a 21-year-old with
hidden potential for two years gets a main eventer nobody else saw coming.

---

## 13. Show rating and the TV ladder

```
slotWeights (TV, 6 segments):  [1.0, 1.1, 1.25, 1.4, 1.7, 2.4]
slotWeights (PPV, 10 segments):[0.8, 0.9, 1.0, 1.1, 1.25, 1.4, 1.6, 1.9, 2.3, 3.0]

showRating = sum(segmentRating * slotWeight) / sum(allSlotWeights)
```

Unfilled segments count as rating 0 against the full denominator — a short card
is judged as if you'd filled it, exactly as in the reference game.

**The ladder.** Show stars map to a target company rating:

| Show stars | Target rating |
|---|---|
| 1★ | 60 |
| 2★ | 70 |
| 3★ | 80 |
| 4★ | 90 |
| 5★ | 100 |

Interpolate linearly for half-stars. The company rating moves **1 point per
week** toward the target, or **2 points** after a PPV. This makes consistency
the dominant strategy and makes a bad month genuinely expensive to climb out of.

All AI promotions run the same calculation, and the global ranking is a simple
sort by rating.

### Rankings and booking credibility

Each division maintains an automatic **contender ranking** (top 10) computed
from recent wins, opponent quality, popularity, and momentum. The player never
has to use it — but the fans do.

**Booking credibility** is a promotion-level stat, 0-100, that tracks whether
the booking makes sense:

| Credibility hit | Penalty |
|---|---|
| Title shot given to someone outside the top 10 | −4 |
| Title shot for someone on a losing streak | −6 |
| A champion who never defends (8+ weeks) | −5 |
| A wrestler who loses constantly still presented as a threat | −3/occurrence |
| Ignoring a #1 contender for 6+ weeks | −5 |
| A rivalry that never gets a blowoff | −4 |
| Same main event 4+ weeks running | −5 |

| Credibility gain | Bonus |
|---|---|
| Champion defends regularly against ranked contenders | +3 |
| A rivalry resolved decisively | +4 |
| A win streak rewarded with a title shot | +5 |
| Long-term booking paying off | +4 |

Credibility modifies attendance, buyrates, and the TV ladder by up to ±8%. It
is the mechanism that stops the optimal strategy from being "book the two most
popular wrestlers against each other every single week." The game never *warns*
about a credibility hit — the player sees the number move and works out why.

---

## 14. Finances

### Attendance

```
ticketPrice = 4 + (1 * segmentsBooked)      // $10 for a full TV, $14 for a full PPV

baseDraw = territoryFollowing * capacity/100
         * 0.33 * ((companyRating + championPopularity) / 200)

per segment:
  segmentDraw = capacity * (segmentStars / 5) * (avgSegmentPop / 100) * 0.075

attendance = min(baseDraw + sum(segmentDraw), capacity)
```

Only a third of the house is guaranteed by reputation; the rest is earned live.
The attendance counter should visibly tick up during the show reveal.

```
gate = attendance * ticketPrice * territoryRevenueMult
```

### Costs

```
appearanceFee = contract.weeklyRate
              * (role === 'competitor' ? 1.0 : 0.5)
              * (clause 'incentive' && mainEvent ? 1.25 : 1.0)
              * (clause 'payPerView' && isPPV ? 2.0 : 1.0)

payroll = sum(appearanceFee for everyone used)
        + sum(0.5 * rate for 'downside' clause holders not booked)

weeklyExpenses = netWorth * 0.02 * (1 + 0.1 * territoriesOwned)
```

**Cap:** total show expenses may never exceed 50% of show revenue (matching the
reference game's safety valve). Excess is deferred to the following week as
debt.

Other line items: medical bills for injuries, arena damage from hardcore
stipulations, contract buyouts, travel costs for chartering between territories,
talent development (paying to train a wrestler's stats).

### PPV buyrates

PPVs earn far more from buys than from the building. Buys are driven by the
month's build, not the night itself.

```
buyBase        = companyRating^1.6 * networkReachFactor
buildQuality   = mean rating of the TV segments that advanced this card's feuds
marqueeFactor  = heat of the top rivalry + prestige of titles defended
                 + combined popularity of the main event
noveltyFactor  = champion vs champion, first-time matchups, grudge stipulations
buys = buyBase * (0.5 + 0.5*buildQuality/100) * marqueeFactor * noveltyFactor
revenue = buys * pricePerBuy
```

The point: **a PPV is paid for by the four weeks of television before it.** A
booker who throws together a great card with no build gets a great rating and
poor revenue, which is exactly the lesson the game should teach.

Buyrate history is tracked and shown against previous events.

### Merchandise

Every wrestler generates merch revenue independently of the show, based on
popularity, gimmick appeal, alignment (faces outsell heels roughly 1.4:1),
recent momentum, title reigns, and how often they've been on TV.

```
weeklyMerch = (popularity^1.4) * gimmickAppeal * alignmentMult
            * (0.6 + 0.4 * momentum/100) * companyReachFactor
```

- **Per-wrestler merch sales are tracked and displayed** — career totals,
  weekly figures, and a promotion-wide leaderboard. Discovering that a
  midcarder outsells your champion is one of the best signals in the game, and
  it should change who you push.
- The `merchandiseCut` contract clause (0-25%) pays the wrestler a share. Stars
  demand it; granting it to someone who then becomes your top seller is a
  costly mistake you have to live with for the contract term.
- Merch dies fast when a wrestler is off TV, so shelving a top seller has an
  immediate revenue cost.

### Sponsorships

A third revenue stream, independent of the network. Sponsors approach the
promotion based on company rating, weekly attendance, and roster popularity,
and pay a flat weekly fee plus per-show bonuses.

| Sponsor tier | Requires | Weekly | Conditions |
|---|---|---|---|
| Local business | rating 45 | $2,500 | — |
| Regional brand | rating 62, avg attendance 2,000 | $12,000 | No severe hardcore |
| National consumer brand | rating 78 | $45,000 | Family-friendly: violence cap |
| Beer / energy drink | rating 70 | $38,000 | Prefers hardcore, hates squeaky-clean |
| Video game / apparel | rating 74 | $30,000 | Wants a marketable top star |

Sponsors carry **conditions that conflict with each other** — a family brand
and a beer brand won't both stay. Sponsor money is the difference between
solvent and broke in the midgame, and choosing which sponsor to keep is a real
identity decision for the promotion.

**Sponsors make demands, and they are not shy.** Periodically a sponsor issues
a request the player must accept or refuse:

- Change a specific wrestler's gimmick (the sponsor hates it)
- Fire a specific wrestler (bad publicity, an arrest, a lawsuit)
- Hire a specific free agent they want associated with the brand
- Feature a named wrestler in the main event for the next month
- Cut hardcore content below a threshold
- Add a women's title match to every PPV
- Run a show in a specific territory

Accepting pays a bonus and extends the deal. Refusing risks the sponsor
walking. This is the second voice in the player's ear alongside the owner, and
the two will sometimes want opposite things.

### Loans

When the balance drops below a threshold, a banker offers a rescue loan.

- Amount: up to 60% of the promotion's annual revenue
- **Repayable within 52 weeks**, with interest (default 12%)
- Miss the deadline and the promotion is forced into the fire sale below
- Only one active loan at a time; a second offer is refused after a default
- Taking a loan is visible to rivals, who bid more aggressively on your talent
  knowing you're squeezed

### Bankruptcy is a fire sale, not a game over

Going broke starts a **90-day survival window**, not an instant loss:

1. Loan offers appear (if none is already outstanding and defaulted)
2. **Sell contracts** — rival promotions bid for your talent. Fast cash, but
   you're gutting the roster that generates revenue, and the locker room knows.
3. **Cancel contracts** — cheaper than selling but requires severance, and
   `ironClad` holders must be paid in full
4. Downgrade venues, drop territories, cut staff roles, skip house shows
5. Emergency sponsor deals at humiliating terms

Only if the balance is still negative when the window closes does the promotion
fold. Clawing back from the brink should be one of the most memorable things
that can happen in a save.

### Buyouts and mergers

A wealthy promotion can move on a struggling rival.

- **Buyout** — purchase the promotion outright. You absorb their roster
  (contracts and all, including ones you can't afford), their titles, their
  territories, and their debts. Their fans do not automatically become yours,
  and their loyalists may resent you for years.
- **Merger** — a negotiated combination. Cheaper, but the other owner keeps a
  say: they become a second voice issuing mandates, and their champion is
  protected for a period.

Implications either way: a sudden payroll spike you may not survive, a bloated
roster far above the target size, redundant titles that must be unified or
retired, morale chaos as two lockers rooms merge, and a big one-off rating and
territory gain. Buying a rival to kill them is a legitimate and dangerous
strategy.

### The booker's own body

The player character is on the roster and **draws no salary** — but can be
booked like anyone else: in matches, in promos, as a run-in, or as a manager.
Doing so is free labor and a real temptation when money is tight, but the
booker ages, tires, and gets injured like anyone else, and a booker who books
himself into the main event every week is a morale disaster with the locker
room.

### TV rights deals

Gate money alone cannot sustain a promotion past the midgame. Networks are the
second revenue stream and the main long-term progression track.

| Tier | Requires rating | Weekly fee | Demands |
|---|---|---|---|
| None (self-distributed) | — | $0 | — |
| Local access | 55 | $6,000 | Run 4 shows/month |
| Regional cable | 68 | $22,000 | Maintain rating 65+ |
| National network | 80 | $70,000 | Maintain 75+, no severe hardcore |
| Premium global | 91 | $180,000 | Maintain 88+, PPV quarterly |

Networks are offered when the company crosses a rating threshold and sustains
it for 6 weeks. Each carries **demands** — miss them for 4 consecutive weeks
and the deal is downgraded or cancelled, which is a brutal financial cliff and
the game's main mid-to-late tension. A network may also impose content
restrictions (a hardcore saturation ceiling, a minimum women's-division
presence, a mandated timeslot in a specific territory) that constrain booking.

### Arena tiers

Within each territory, venue size is chosen per show and gated by drawing power.

| Venue | Capacity | Rent | Unlocks at |
|---|---|---|---|
| Armory / club | 800 | $1,200 | — |
| Community hall | 2,500 | $4,000 | Avg attendance 700 |
| Civic center | 6,000 | $11,000 | Avg attendance 2,200 |
| Arena | 12,000 | $30,000 | Avg attendance 5,500 |
| Stadium | 40,000 | $95,000 | PPV only, avg attendance 11,000 |

Booking a venue you can't fill is punishing: an arena at 20% capacity takes a
−10 show rating penalty for looking empty on television, on top of the rent.
Selling out gives +6 rating and a following boost in that territory.

**Bankruptcy:** balance below zero for 4 consecutive weeks = game over, with a
Hall of Fame style career summary.

---

## 15. Contracts, hiring, and firing

### Contract types

Type is the first thing negotiated, and it changes everything downstream.

| Type | Availability | Cost | Energy & aging | Popularity | Best for |
|---|---|---|---|---|---|
| **Full time** | Every week, both shows | Full rate | Normal drain, normal decline | Normal decay when unused | The core roster |
| **Part time** | Every other week only | ~60% of full rate | Half the energy drain; ages slower in career terms | Decays at half rate — absence keeps them special | Aging stars, big draws you want to protect, anyone whose act is stale |
| **Per appearance** | Whenever booked, but **can decline** | Paid per booking, ~130% of the per-week equivalent | Minimal | Normal | Cash-poor promotions, unproven talent |
| **Developmental** | Rare TV, mostly training | ~20% of full rate | Very low | Grows slowly | Prospects with hidden potential |
| **Legends** | 4-6 dates a year, PPVs and specials | Very high per date | Negligible | Barely decays — mystique | Retired greats and mainstream names |

**Part-time is a strategic tool, not just a discount.** A wrestler on TV every
week burns their gimmick freshness fast; the same wrestler appearing every other
week stays hot much longer and costs less. The trade is that half your weeks
you simply don't have them, and storylines have to work around it.

Wrestlers ask to move between types in the office — a 43-year-old with a bad
back asking to drop to part time is a common and reasonable request, and
refusing it accelerates their decline.

### Converting to other roles

Instead of releasing an aging or broken-down wrestler, the booker can offer a
role change. Wrestlers can be converted to **manager, referee, announcer, road
agent, or trainer** — and back again, though returning to the ring after a long
absence carries ring rust and injury risk.

| Conversion | What carries over | What's gained | What's lost |
|---|---|---|---|
| **→ Manager** | Full popularity, charisma, relationships | Long career extension, mouthpiece for a wrestler who can't talk, ringside deck-stacking, still takes bumps if you ask | No more matches; their in-ring stats decay |
| **→ Referee** | Attitude, skill | Cheap, stable, a crooked-ref lever | Popularity fades fast; fans forget them |
| **→ Announcer** | Charisma, popularity | Show-wide rating bonus, can be a heel authority figure | Removed from the active roster |
| **→ Road agent** | Skill | Raises the rating floor of the whole undercard | Invisible to fans |
| **→ Trainer** | Skill, coachability | Better school graduates, faster rookie growth | Off television entirely |

A beloved veteran converted to manager keeps drawing for years after their body
gives out — and a popular manager attached to a bland young wrestler is one of
the most efficient ways to get someone over.

Some wrestlers refuse a conversion outright (ego, or they think they have more
left), and some ask for it themselves in the office when they know it's time.

### The negotiation table

Negotiation is a live back-and-forth on a single screen. The player adjusts any
term; the wrestler's **satisfaction meter** updates in real time, alongside the
**cost to the promotion** per week. The player proposes; the target signs,
counters with specific changes, or walks.

Negotiable terms:

| Term | Range | Effect on satisfaction | Effect on cost |
|---|---|---|---|
| Weekly rate | $200 - $200,000 | Primary driver, compared to expectation and to roster peers | Direct |
| Contract length | 12 - 104 weeks (settings-bound) | Young talent wants short deals to re-price; veterans want long security | Locks the rate in against inflation |
| Signing bonus | $0 - 20× weekly rate | Strong immediate satisfaction, weak long-term | One-time |
| Downside guarantee | 0-100% of rate when unbooked | High satisfaction for midcarders | Paid weekly regardless of use |
| Health insurance | on/off | +18 satisfaction; refusing it is −12 and remembered | All medical bills, ~$3-40k per injury |
| Creative control | on/off | +25 for stars, meaningless to jobbers | Player cannot script their loss or force turns |
| Title push promise | on/off | +20, but −8/week once 12 weeks pass unfulfilled | Booking obligation |
| Guaranteed dates | 0-4 per month | +12 | Paid whether used or not |
| Travel covered | on/off | +8, +16 if outside their home territory | ~$400-1,500 per territory show |
| Merchandise cut | 0-25% | +10 at 10%, scaling | Reduces merch revenue |
| No hardcore | on/off | +14 for Technicians, 0 for Brawlers | Removes booking options |
| No jobbing | on/off | +16 for anyone popularity 60+ | Severe booking constraint |
| Exclusivity | on/off | −15 (they want outside work) | Blocks rivals using them |
| Release clause | buyout amount | +12 | They can leave any time |
| Part-time | on/off | +20 for age 40+ | Half fee, limited availability |
| Trainer role | on/off | +6 for Veterans | Small stipend, rookies grow faster |
| Rematch clause | on/off | +10 for current champions | Booking obligation on title loss |
| Iron clad | on/off | +22 | Full remaining term owed on release |
| No compete | on/off | −18 (they hate it) | Protects you from rivals |

**Satisfaction thresholds:** 75+ signs immediately · 55-74 signs after one
counter · 35-54 counters twice then walks · below 35 walks immediately.
`demandStrictness` in settings scales all thresholds.

Clauses the player grants are permanent for the contract term and are the main
source of mid-game regret — a `noJobbing` clause on a wrestler who then stops
drawing is exactly the kind of self-inflicted problem this game should produce.

**Renegotiation** is possible mid-term at a cost: the wrestler will only accept
strictly better terms, and opening negotiations at all reveals to them that
they have leverage (+10 to all future demands).

```
expectedRate = (popularity^1.35) * 0.9 * companyWealthFactor * marketFactor
```

- `companyWealthFactor` — richer promotions are expected to pay more
- `marketFactor` — rises if rival promotions are also bidding
- Comparison to peers: a wrestler who learns a lower-popularity roster-mate
  earns more will demand parity or take a morale hit

**Personal reservations** — beyond money, bigger stars raise objections the
player must overcome by adjusting the offer:

| Reservation | Satisfied by |
|---|---|
| "I won't be buried" | `titlePush` or `creativeControl` clause |
| "I'm not moving across the world" | Promotion owns their home territory |
| "Your company is going nowhere" | Company rating above their threshold |
| "I don't work with [enemy]" | That wrestler not on the roster |
| "I want my friend hired too" | `nepotism` clause, or signing the friend |
| "I'm not doing hardcore garbage" | Low promotion hardcore saturation |

### Renewals, poaching, releases

- Contracts auto-enter renewal negotiation at 4 weeks remaining. Ignore it and
  the wrestler hits free agency.
- AI promotions bid on your expiring talent, and on contracted talent via
  buyout offers. Accepting a buyout is free money but costs morale across the
  locker room ("he sold Whack Ax to the highest bidder").
- Releasing requires a severance discussion; `ironClad` requires paying out the
  full remaining term. `noCompete` sends them to the school, unavailable to
  rivals for 12 weeks.

### Morale

Weekly morale adjustments:

| Condition | Δ morale |
|---|---|
| Booked in a match | +3 |
| Booked in main event | +6 |
| Unused this week | −4 (−9 with `nepotism`) |
| Unused 3+ weeks running | −9 cumulative |
| Lost 3+ matches in a row | −7 |
| Won a title | +18 |
| Lost a title | −10 |
| Scripted to lose | −15 |
| `titlePush` unfulfilled after 12 weeks | −8/week |
| Paid below roster peers | −5/week |
| Company rating rising | +2 |

Low morale consequences at thresholds: 40 → complains publicly (news item),
25 → refuses a booking or no-shows, 12 → walks out / demands release, and at
any level below 30 a low-`attitude` wrestler may betray the player by leaking
plans to a rival or sandbagging a match (−12 rating, unannounced).

---

## 16. Rival promotions and the world

Each AI promotion runs weekly on an abstracted version of the same engine:

1. Select a card from its roster using a booking heuristic weighted by its
   `styleProfile` (star-driven, workrate-driven, hardcore, women's-focused,
   territorial).
2. Simulate segments with the same rating formula (cheaper: skip narrative
   generation).
3. Move its rating on the same ladder.
4. Act on the talent market — bid on free agents, attempt buyouts, poach.
5. Attempt territory expansion if wealthy and highly rated.
6. **Track solvency.** AI promotions have real balance sheets and can go under.
   A promotion below zero for 8 weeks folds: its titles are retired, its roster
   dumps into the school en masse, and its territories go up for grabs. Driving
   a rival out of business by taking their territories, poaching their stars,
   and beating them in invasions is the closest thing this game has to a win
   condition.

AI promotions must be *legible rivals* — the Database screen shows their
ratings, champions, rosters, and recent show results so the player can track
them.

### Territories

- Each territory tracks per-promotion `following` (0-100).
- Running a show there raises your following by `showStars * 1.6`; **not**
  running there decays it by 1.2/week.
- Setting a new attendance record in a territory claims it, if unclaimed.
- Running a show in a rival-owned territory is an **invasion**: it damages
  their following and may trigger a confrontation.

### Cross-promotional supershows

Two promotions agree to run a joint PPV. This is the highest-risk, highest-
reward event in the game, and it exists because both bookers want something and
neither controls the outcome.

#### Negotiating the deal

Either side can propose. The proposal is a package:

| Term | Range | Notes |
|---|---|---|
| Host territory | Any territory either side holds | Host gets a larger gate share and home advantage in matches |
| Gate split | 0-100% | The main lever. A weaker partner demands more to show up |
| Card size | 8-14 segments | Split between the promotions |
| Segment allocation | Who books how many | Not necessarily even |
| Named matches | Each side proposes pairings | Both must approve every match |
| Champion vs champion | Yes / no, per pairing | The marquee draw and the biggest gamble |
| Appearance guarantee | Flat fee to the smaller partner | Common when a big promotion wants a small one's star |
| Rematch / follow-up clause | Optional | Commits both sides to a second show |

**Titles never change hands.** This is a hard rule, enforced by
`lineageProtected`. Champion vs champion is allowed and encouraged — but the
belts stay where they started. What's at stake is credibility, not gold.

#### How AI bookers decide

Each AI promotion has a `coopAppetite` (0-100) derived from its owner
personality, its current standing, and its resentment toward the proposer:

- **Eager** (high appetite, lower-ranked): sees a chance to be seen on a bigger
  stage. Accepts generous terms, may propose these itself.
- **Cautious** (mid): accepts, but demands a favorable gate split, an
  appearance guarantee, or approval over every match involving its champion.
- **Dismissive** (low appetite, higher-ranked): refuses outright, or names a
  price so high it's an insult. May publicly turn you down, which is itself a
  news story and a morale hit.
- **Hostile** (high resentment from invasions or poaching): refuses and
  escalates.

An AI booker also protects its own stars: it will reject pairings where its
champion is badly outmatched, and it will try to feed you its midcard while
demanding your top names.

#### Stakes and amplification

Cross-promotional match results are amplified in both directions:

```
popularityMultiplier   = 2.2   // both winner gain and loser loss
moraleSwing            = ±14   // the winner's whole locker room lifts
companyRatingSwing     = based on the promotion's overall win/loss on the night
titlePrestigeSwing     = ±6 for a champion who wins or loses (belt unchanged)
```

- A champion who **loses** to a rival's champion doesn't drop the belt, but
  takes a heavy popularity and prestige hit and looks inferior for months. The
  fans and the sim both remember.
- A **midcarder who beats a rival's main eventer** gets a career-making boost
  far beyond a normal upset.
- The promotion that wins the night on aggregate gains company rating,
  territory following in the host region, and a roster-wide morale surge. The
  loser takes the reverse.

Because outcomes are simmed, **neither booker can guarantee anything.** Agreeing
to champion vs champion is a genuine gamble with your top act's credibility,
and that tension is the entire point of the system. Stacking the deck still
works, but so does theirs — and you don't get to see what they stacked.

#### Aftermath

- Wrestlers who faced each other across promotions form a cross-promotional
  rivalry that persists, generating heat for a future joint show or a poaching
  attempt.
- A successful supershow raises both promotions' ratings and makes a sequel
  easier to negotiate. A disastrous one (poor buyrate, bad matches, a botched
  finish) sours relations and lowers `coopAppetite` on both sides.
- Beating a rival badly on a joint show is one of the fastest ways to damage
  them commercially — and a legitimate step toward driving them under.

### Inter-promotional war

Triggered by repeated invasion. Resolves as a 6-match showdown with each side's
champions auto-entered (the player may substitute their own competitors, not
the rival's). Entertainment is not the goal here — every match is simmed for
pure competitive outcome, no rating bonuses. Match wins swing both promotions'
ratings; the winning side takes the territory outright regardless of attendance.

Each stolen territory raises a `resentment` value with that promotion, making
them refuse talent trades and bid more aggressively against you.

---

## 17. Owner mandates

The owner (a generated character with a personality profile) checks in roughly
every 4 weeks with a mandate. Failure has consequences; three failures triggers
a firing and a game over.

*LOCKED: the owner can and will fire you.* Three failed mandates ends the run.
This is a real threat, not a bluff, and the firing screen shows the full career
summary and any Hall of Fame inductions from your tenure.

Mandate types:

- Sign a specific named wrestler within N weeks
- Release a specific wrestler
- Put a specific title on a specific wrestler
- Reach a company rating of N
- Cut weekly payroll below $N
- Draw N fans to a single show
- Push a specific young talent (get them to popularity N)
- Expand to N territories, or reclaim a lost one
- Reduce hardcore saturation ("we're not a garbage promotion")
- Run a show in the owner's home territory

Rewards: cash injection, roster slot expansion, a clause waiver, or reduced
scrutiny. Penalties: budget cut, forced release, disapproval strike.

Owner personality (`traditionalist | showman | penny-pincher | hardcore |
star-chaser`) biases which mandates appear and which stipulations they dislike.

---

## 18. Relationships, teams, factions, and staff

The roster is a social network, not a list. This section is what makes a
decades-long save feel like a living locker room rather than a spreadsheet.

### Relationships

```ts
interface Relationship {
  aId: string; bId: string;
  type: 'friend' | 'enemy' | 'mentor' | 'protege' | 'sibling' | 'parentChild'
      | 'married' | 'dating' | 'divorced' | 'exPartner';
  strength: number;          // 0-100
  history: RelationshipEvent[];
}
```

- **Friends and enemies** form organically from shared bookings, tag teams,
  stiff matches, backstage incidents, and promo targets — and persist across
  promotions. A friend signing with a rival makes a wrestler unhappy for weeks.
- **Romantic relationships** form between roster members over time. Married and
  dating pairs boost each other's morale; a breakup or divorce creates lasting
  bad blood, and one party may flatly refuse to work with the other or demand
  the other be released.
- **Refusal to work** is a hard booking constraint, not a penalty. If someone
  refuses, the segment cannot be booked without a heavy morale cost.
- **Families.** Over a long save, wrestlers have children. Given enough
  simulated years, a second-generation wrestler can appear in the school with
  inherited stat tendencies and their parent's name recognition — a popularity
  head start and a built-in storyline.
- **Mentorship.** Veterans with the trainer role and high coachability students
  accelerate stat growth and form lasting bonds.

### Match chemistry

Separate from relationships. Every pair of wrestlers accumulates a chemistry
value from working together — good matches raise it, bad ones lower it. High
chemistry is worth up to +10 match rating. A pairing that clicks is a genuine
asset the player should discover and exploit, which is part of what house shows
are for.

Tag teams accumulate **team chemistry** the same way.

### Mood

Distinct from morale. Morale is about their standing with the promotion; mood
is their emotional state, driven by relationships and life events.

`mood: 'fired up' | 'content' | 'restless' | 'frustrated' | 'grieving' |
'distracted' | 'bitter' | 'motivated'`

Mood modifies match rating (±8), injury risk, promo quality, and how they react
to booking decisions. A grieving wrestler who just lost a friend to a rival
promotion is not going to have a career night.

### Tag teams and factions — v1, not later

```ts
interface Team {
  id: string; name: string;
  memberIds: string[];
  type: 'tagTeam' | 'faction' | 'stable';
  chemistry: number;
  popularity: number;        // The team draws independently of its members
  formedWeek: number;
  leaderId?: string;         // Factions
  record: Record;
}
```

Teams have their own names, popularity, momentum, entrance, records, and title
reigns. Factions can run interference for their members automatically, feud as
units, and split acrimoniously — a faction breakup is one of the strongest heat
generators in the game.

### Staff roles

Every non-wrestler is a real roster member with stats, a contract, a paper-doll,
and the ability to be injured or quit.

| Role | Key stats | Function |
|---|---|---|
| **Manager** | charisma, attitude | Ringside odds bump, cuts promos *for* wrestlers with low charisma, can be paid extra to take bumps in a match (real injury risk), adds heat to their client's feuds |
| **Referee** | skill, attitude | Match control, DQ enforcement. A crooked ref is a deck-stacking lever. Low-attitude refs make mistakes; refs can be exposed, injured, or bribed by rivals |
| **Announcer** | charisma | Small show-wide rating bonus; a great commentary team raises every match slightly. Can also be a heel authority figure in angles |
| **Road agent** | skill, attitude | Passive: raises the rating floor of matches involving low-skill workers. A great agent makes your undercard watchable |
| **Trainer** | skill, coachability | Accelerates stat growth for young talent; improves the quality of school graduates |

Managers are the most flexible: some are pure mouthpieces for a wrestler who
can't talk, some are physical and take hits, some are just a body at ringside.
They cost money, they get hurt, and losing a great manager hurts their client's
whole act.

### Talking to your talent

The player can approach any roster member to request a change:

| Request | They may refuse if... |
|---|---|
| Change ring name | Popular under the current name, high ego |
| Change look / gimmick | `creativeControl` or `creativeFreedom` clause, or they like it |
| Turn heel or face | `creativeFreedom` clause, or it clashes with their gimmick |
| Join a tag team or faction | They dislike a proposed member |
| Take a manager | They think they don't need one |
| Move up or down the card | Nobody agrees to move down |
| Change finisher / move set | Low coachability |
| Train a specific stat | Low coachability, low energy |

Every request runs a check against attitude, coachability, morale, popularity,
ego, and contract clauses. **Refusal is not free for either side** — a rejected
request costs the wrestler some morale and, if the player pushes anyway, can
sour their attitude for months. Asking too often is itself a morale drain.

---

## 19. Statistics, records, and the Hall of Fame

Statistics are a headline feature, not bookkeeping. A decades-long save should
produce an archive worth browsing.

### Tracked per wrestler

Career and per-year: wins, losses, draws, win percentage, matches by type,
title reigns with exact day counts, longest reign, total days as champion,
career-high popularity and the week it peaked, average match rating, best and
worst match, most frequent opponent, most frequent partner, PPV record,
main-event count, attendance drawn, injuries suffered and caused, promos cut,
turns, teams and factions, feuds and their outcomes, earnings.

### Tracked per promotion

Rating history by week, attendance records by territory and venue, gate
records, title lineages, show ratings, best and worst shows, roster turnover,
signings and losses, wars won and lost, territories held over time.

### Tracked per title

Full lineage with reign lengths, prestige history, most decorated holder,
shortest and longest reigns, vacancies.

### Records book

A browsable screen of superlatives, live and always current: longest reign,
most title wins, highest-rated match ever, biggest gate, longest winning
streak, oldest active competitor, most matches worked, best drawing champion.
Records broken generate news headlines.

### Annual awards

Every simulated year closes with an awards night — a bookable ceremony show
that boosts morale and company rating, and gives a decades-long save a rhythm
and a scoreboard.

Categories: **Wrestler of the Year, Match of the Year, Feud of the Year, Tag
Team of the Year, Most Improved, Rookie of the Year, Best Talker, Biggest
Draw, Best Promotion (all companies), Comeback of the Year.**

Awards are computed from tracked stats across *all* promotions, so your talent
can lose Wrestler of the Year to a rival's star — a genuine motivator and a
morale event either way. Winners get a popularity and morale bump; being
snubbed after a big year costs morale and can trigger an office visit.

### Locker room reputation

The promotion carries a hidden-ish reputation with talent, built from the
booker's history: how often requests are granted, whether contracts are honored,
whether stars are protected, how discipline is handled, whether people are
released mid-storyline, injury rates.

Reputation affects: which free agents will sign and at what price, how hard
rivals can poach, how much benefit of the doubt the locker room gives in a bad
stretch, and whether the wrestling school's best graduates come to you first. A
promotion with a terrible reputation pays a premium for everything.

### Hall of Fame

Wrestlers become eligible 3 years after retirement. Induction is scored on
popularity peak, title reigns, average match rating, longevity, drawing power,
and memorable feuds — with a threshold the player can also override to induct
someone manually (a personal favorite, a friend of the owner, a controversial
pick). Inductions happen at an annual ceremony show, which is itself a bookable
event that boosts company rating and roster morale.

Deceased and retired wrestlers remain fully browsable in the Database forever.

---

## 20. Random events and chaos

The systems above produce a competent management sim. **This section is what
makes it feel like a wrestling promotion.** Without it, weeks blur together and
the roster reads as spreadsheet rows. Events should fire often enough that no
week is routine, and land hard enough that plans get wrecked.

### The event engine

Each week, after the show resolves, roll for events:

```
eventCount = 1 + poisson(0.7)                       // usually 1-3 per week
```

Draw from a weighted pool. Every event declares `triggerConditions`, a base
`weight`, and `weightModifiers` keyed to world state. A locker room brawl is
near-impossible on a high-morale roster and near-certain on a roster full of
low-attitude, low-morale talent who just lost their spots.

Most events present the player with a **response choice** — 2-4 options, each
with a different cost and risk. Ignoring a problem is always an available
option, and is sometimes correct.

### Category A — Health and injury oddities

| Event | Trigger | Effect |
|---|---|---|
| Freak backstage injury | Any wrestler | 2-8 weeks out, no match involved. Slips in the shower, falls off a truck, injures himself in a promo. |
| Blown knee in training | Low health, high age | 8-20 weeks, permanent −6 agility |
| Botched spot aftermath | Match with `goAllOut` | Both participants −20 health, one takes a concussion (3 weeks) |
| Refuses surgery | Injured wrestler | Returns 40% faster, but permanent −8 to a random stat |
| Insurance dispute | Injured wrestler with a contract | Player pays medical bills directly or morale −15 |
| Mystery illness | Any | Unavailable 1-6 weeks, no explanation given until they return |

### Category B — Locker room incidents

| Event | Trigger | Effect |
|---|---|---|
| Real fight backstage | Two wrestlers, low attitude, existing enemy relation | Both injured 1-4 weeks; roster morale −6; a news story that adds +25 rivalry heat if you lean into it |
| Hazing the rookie | Rookie archetype on roster | Rookie morale −20 unless the player intervenes; veteran attitude −10 if disciplined |
| Locker room leader emerges | High attitude, high popularity | Roster-wide +1 morale/week while employed |
| Political sandbagging | Low attitude, threatened by a rising talent | The rising talent's next match rates −14 with no explanation |
| Someone's teaching your business to a rival | Low morale | Rival promotion gains knowledge of your roster; poaching bids get sharper |
| Drug policy failure | Low attitude | 6-week suspension, or the player covers it up (risk of a scandal, −12 company rating) |

### Category C — Professionalism

| Event | Trigger | Effect |
|---|---|---|
| No-show | Morale < 30 | Their segment collapses on show night; the player must reshuffle live with a penalty |
| Shows up drunk | Low attitude | −25 to their match rating, injury risk ×2, or pull them and eat the empty slot |
| Shows up late | Any | Their match moves down the card automatically |
| Blows off the gimmick | `creativeFreedom` clause or low morale | Their alignment flips against the player's booking |
| Goes into business for himself | Low attitude, scripted to lose | Refuses the finish — the sim result is overridden in their favor |
| Injures an opponent stiffly | Low attitude, high strength | Opponent out 4-12 weeks; the victim's camp demands the offender be released |

### Category D — Ambition and politics

| Event | Trigger | Effect |
|---|---|---|
| Demands a title shot | Popularity ≥ 70, no recent title match | Grant within 4 weeks or −20 morale |
| Demands a raise | Popularity risen 15+ since signing | Renegotiate or morale decays weekly |
| Wants to turn heel/face | Any, weighted by momentum | Grant for +10 morale and a fresh direction, or refuse for −12 |
| Wants a manager or a partner | Showman archetype | Pairing grants +8 morale and a small rating bonus to both |
| Threatens to quit | Morale < 20 | Player negotiates, promotes them, or lets them walk |
| Rival makes a public offer | High popularity, contract < 10 weeks | Match the offer, or lose them at expiry |
| Refuses to work with a specific opponent | Enemy relation | Booking them together anyway: −18 rating, both morale −10 |

### Category E — Shocks

Rare, high-impact, unignorable.

| Event | Weight | Effect |
|---|---|---|
| Sudden retirement | Age 34+, low health or morale | Gone immediately, mid-storyline, mid-title-reign |
| Death | Very rare; age and health weighted | Roster morale −25, memorial show event, titles vacated |
| Walkout / faction defection | 2-4 wrestlers, low morale, same rival relation | They all sign with one rival promotion the same week |
| A rival promotion folds | AI promotion bankrupt | Its entire roster hits free agency at once — a feeding frenzy |
| Talent invasion | Rival resentment high | A rival's stars appear uninvited at your show; the player chooses to confront or exploit it |
| Building fire / venue disaster | Rare | Show cancelled, lost gate, insurance payout |
| Viral moment | High-rated segment | +12 popularity to the participants, +4 company rating |
| Championship belt stolen/lost | Any champion | Title vacated or a replacement belt commissioned at cost |

### Category F — Life happens

The texture of a real locker room. Most of these are not wrestling problems at
all, which is exactly why they land. Each presents 2-4 response options, and
the same event should produce different outcomes depending on who it happens to.

**Domestic and personal**

| Event | Effect |
|---|---|
| Getting married | Mood "content" for 8 weeks; wants a week off for the honeymoon |
| Having a baby | Wants reduced dates; morale +20 if granted, −25 if refused |
| Nasty divorce | Mood "distracted" for 12 weeks, −10 match rating, may need money |
| Caring for a sick parent | Requests time off, unavailable or distracted |
| Moved across the country | Wants to be booked closer to home; travel costs rise |
| Bought a bar / restaurant | Distracted, but throws a roster party (+morale) |
| Adopted a dog and won't stop talking about it | Harmless. +2 morale, roster amused |
| Wants to bring their kid to shows | Grant it for a mood boost; refuse for a small hit |

**Side hustles and delusions of grandeur**

| Event | Effect |
|---|---|
| Started a podcast | Charisma +4 over time, but shoots on the promotion occasionally |
| Wants to be a rapper | Demands a music-themed gimmick and entrance. Rating gamble |
| Cast in a movie | Unavailable 6-14 weeks, returns with +12 popularity |
| Landed a commercial | +popularity, sponsor happy, wants a raise |
| Wrote a memoir | Reveals backstage secrets, several roster relationships sour |
| Fitness influencer now | Popularity +8, but skips training, skill drift stalls |
| Wants to be a booker | Give them creative input for morale, or refuse |
| Convinced they should be champion right now | Classic. Grant, promise, or refuse |
| Bought a horse. A racehorse. Broke now. | Requests an advance on pay |

**Body and appearance**

| Event | Effect |
|---|---|
| Enormous new tattoo | Look changes; some sponsors object |
| Shaved their head | Popularity dips 3 then recovers; freshness +15 |
| Massive weight gain | Crosses a weight class, agility drops, may lose title eligibility |
| Got shredded in the offseason | Strength and agility up, popularity up |
| Terrible cosmetic surgery | Popularity −8, roster mocks them, morale −12 |
| Botched dye job | Purely cosmetic, brief news item, roster laughs |
| Grew an unbelievable beard | Freshness +10, merch bump |
| Lost their gear bag in transit | Works the show in borrowed gear, small rating hit |

**Travel and logistics**

| Event | Effect |
|---|---|
| Missed their flight | Misses the house show entirely |
| Visa denied | Cannot work certain territories for 8-20 weeks |
| Car wreck on the road | Injury roll plus vehicle costs |
| Rental car destroyed by a roster member | Someone has to pay. Who? |
| Stranded by a snowstorm | Half the card is late; show rating penalty |
| Food poisoning at the venue | 2-4 wrestlers perform badly or pull out |
| Lost passport | Missing 2 weeks |

**Legal and reputational**

| Event | Effect |
|---|---|
| Arrested | Suspension decision; sponsors react; news cycle |
| Bar fight caught on video | Popularity +6 with hardcore fans, sponsors furious |
| Sued for gimmick infringement | Legal costs and a forced repackage |
| Sued by a fan hurt at a show | Legal costs, insurance dispute |
| Failed a drug test | Suspension or cover-up (§20 Category B) |
| Public feud with a wrestling journalist | Free publicity, +popularity, owner unhappy |
| Said something awful on social media | Sponsor demands a firing |
| Accused by a rival of stealing their gimmick | Cross-promotional heat |

**Belief, ego, and nonsense**

| Event | Effect |
|---|---|
| Found religion | Refuses certain stipulations and storylines |
| Went vegan and won't shut up | Roster morale −2, their stamina +4 |
| Joined something that is definitely a cult | Mood erratic; may vanish for 6 weeks |
| Convinced the referee is out to get them | Refuses to work with that ref |
| Demands a bigger entrance / more pyro | Costs money, small rating boost |
| Insists on going last on every card | Ego problem; refusing costs morale |
| Started training a protégé without asking | New mentorship relationship appears |
| Learned a new style abroad | Stat shift: −strength, +skill and agility |
| Claims they were "buried" and posts about it | Fan sympathy, locker room split |

**Good things too**

| Event | Effect |
|---|---|
| Career-best match | Popularity +10, freshness restored, confidence |
| Went viral | +15 popularity for 6 weeks then partial decay |
| Fan-favorite moment with a sick child | Popularity +8, sponsors love it, morale +15 |
| Two wrestlers discover they click | Permanent chemistry bonus |
| A veteran takes a rookie under their wing | Rookie growth accelerates |
| Trainee graduates ahead of schedule | Better than advertised stats |
| Local hero returns home | Massive attendance boost in that territory |

### Outside opportunities — never one-sided

Media, side projects, and outside bookings are **not the wrestler's business
alone**. Almost every one of them cuts both ways, for the wrestler *and* for
the promotion, and the player has to weigh both columns.

The decision is always: *do I let them go do this?* And the answer is genuinely
non-obvious.

| Opportunity | Wrestler gains | Wrestler loses | Company gains | Company loses |
|---|---|---|---|---|
| **Movie / TV role** | +12-20 popularity, +6 charisma, mainstream credibility | Unavailable 6-14 weeks, −stamina and ring rust on return, freshness decays while away | Big popularity halo on return, +company rating, sponsor interest, new territory following | A top act gone for months, storylines orphaned, attendance dip |
| **Podcast** | +4 charisma over time, fan connection, side income | Distraction, may shoot on the promotion | Free weekly promotion, +territory following, recruiting tool | Occasional damaging comments, −owner approval, may leak plans |
| **Commercial / endorsement** | +8 popularity, income, wants a raise after | Ties them to a brand | Sponsor value up, mainstream visibility | They'll ask for a merch cut or raise |
| **Guest appearance for a rival promotion** | +popularity, cross-promotional heat | Fatigue, injury risk you don't control | Goodwill for a future supershow, exposure to their fans | Legitimizes the rival, and your star can lose over there |
| **Documentary about the promotion** | Featured talent +popularity | Time commitment | +company rating, +following everywhere, recruiting boost | Airs the locker room's problems; morale risk if it's honest |
| **Autobiography** | +popularity, income | Burns relationships | Free publicity | Several roster relationships sour, secrets out |
| **Video game / apparel licensing** | +merch, +popularity | — | Real revenue, sponsor tier unlock | Locks in a gimmick you may want to change |
| **Charity work / hospital visits** | +popularity, +morale, mood boost | Time | +company reputation, sponsor delight, locker room morale | Small time cost only — this one is nearly all upside |
| **Coaching at the school** | +respect, mentorship bonds, prepares a post-ring career | Less ring time, popularity drifts down | Better graduates, faster rookie growth, cheaper talent pipeline | Their own act cools |
| **Training abroad** | −strength, +8 skill, +6 agility, +freshness | Gone 8-16 weeks | Returns as a better worker with a new style the territory hasn't seen | Gone during a run, and rivals may sign them while they're out |
| **Fitness influencing** | +8 popularity, +merch | Skips real training, skill stalls | Sponsor interest, young fan reach | Their in-ring work quietly deteriorates |
| **Music project** | +charisma, +freshness, gimmick refresh | Ridicule if it flops (−popularity) | Novelty draw, crossover audience | Sponsor and owner may hate it |
| **Reality TV** | +18 popularity fast, decays faster | Credibility hit (−4 skill perception), −respect from the locker room | Huge short-term attendance and rating spike | The bump fades in ~12 weeks and the roster resents them |

**Design rules:**

1. Every opportunity has at least one real cost to each side. There are almost
   no free wins — charity work is the deliberate exception, and even that costs
   time.
2. Refusing is always available, always costs the wrestler morale, and
   sometimes costs the company an opportunity it needed.
3. The same opportunity is a different decision depending on *who* it lands on.
   A movie role for your world champion mid-title-reign is a crisis; the same
   role for a stale midcarder is a gift.
4. Some opportunities are offered **to the company**, not the wrestler — a
   documentary, a licensing deal — and the player chooses which talent to put
   forward, which is its own political decision the locker room notices.

### Keeping it from getting repetitive

This is a decades-long game. Repetition is the real failure mode, so the event
engine has explicit machinery against it:

1. **Per-event cooldowns.** Every event carries a `cooldownWeeks` (typically
   30-150) and a `perWrestlerCooldown`. The same event cannot recur globally or
   to the same person inside its window.
2. **Text variants.** Every event has 3-6 phrasings, and names, numbers, and
   details are slotted in, so even a repeat reads differently.
3. **Weighting by context.** Events are drawn against the actual world state —
   a wrestler who just won a title gets different events than one who's been
   off TV for a month. Most events are simply ineligible for most of the roster
   at any given time.
4. **Escalating rarity.** Events are tiered common / uncommon / rare / once-per-
   save. The rarest tier fires a handful of times in a decade and should feel
   like a story you remember.
5. **Event chains.** Roughly a third of events are the first beat of a
   multi-week arc rather than a one-off — an arrest becomes a court date
   becomes a verdict; a side hustle becomes a departure becomes a return. The
   player's early responses change how the chain resolves.
6. **No consecutive-week repeats of a category.** The same category can't fire
   twice in a row unless the chaos slider is at maximum.
7. **Content budget.** Target **150+ distinct events at v1**, growing after.
   The tables above are a starting seed, not the full list — treat authoring
   more of them as ongoing content work, and structure them as data files so
   new ones can be added without touching engine code.

### Events during a show

Rare — roughly one show in twelve — an event fires *while the card is running*
and the player must respond before results resolve:

- A wrestler refuses to go on unless paid a large bonus on the spot
- Someone doesn't show up at all and their slot needs filling from who's there
- A wrestler is hurt in an earlier segment and can't make their later one
- A backstage fight erupts between two people booked later that night
- A rival's talent appears uninvited

Each presents 2-4 immediate choices with real costs: pay the bonus, pull them
and eat the empty slot, push someone else into the spot unprepared, or send the
match out anyway with a wrestler who resents it.

### Discipline

The player's response toolkit for misconduct, available from any wrestler's
profile and offered directly on relevant events:

| Action | Effect |
|---|---|
| Let it slide | No cost now; repeat offenders get bolder, locker room notices |
| Private word | Small attitude improvement if morale is decent; nothing if not |
| Fine | Recovers some money, −morale, scales with the offense |
| Suspend (1-8 weeks) | Removes them from bookings, −morale, −popularity from absence |
| Demote down the card | −morale, but a real signal to the roster |
| Send home from a show | Immediate, costs you the segment |
| Release | Clean but expensive under `ironClad`, and they land with a rival |

Discipline is watched: consistently punishing misconduct raises roster-wide
attitude over time, while never punishing anything lets the locker room rot.
Punishing a popular wrestler unfairly costs morale across the board.

### When someone leaves mid-story

A wrestler quitting, dying, being released, or suffering a long injury in the
middle of an active rivalry or title reign is common, and the game handles it
explicitly rather than silently deleting the thread:

| Situation | Options offered |
|---|---|
| Champion leaves | Vacate the title (§3.1) or have them drop it before departure if there's time |
| Rivalry orphaned | Transfer the feud to a partner or protégé · write it off as a victory for the survivor · let it fade (credibility −4) |
| Tag partner leaves | Replace them, break up the team, or push the survivor as a singles act |
| Faction leader leaves | Promote a member, or the faction dissolves with a morale hit |
| Someone dies mid-feud | A memorial show and a tribute match are offered; declining costs significant morale |

Unresolved threads decay: an abandoned rivalry costs booking credibility, and
the roster notices when storylines just stop.

### Design rules for the event system

1. **Events must be legible.** Every one generates a news headline explaining
   what happened and why, and appears in the wrestler's profile history.
2. **Events must be exploitable.** A backstage brawl should be convertible into
   a hot feud. A rival folding should be a signing opportunity. The player who
   reads chaos well should profit from it.
3. **No unavoidable death spirals.** Events never fire in a combination that
   makes recovery mathematically impossible. Cap the total weekly severity.
4. **Frequency scales with roster instability.** A well-paid, well-booked,
   high-attitude roster is genuinely calmer. Managing morale is how the player
   buys down chaos — which makes morale management feel worth doing.

---

## 21. Screens

| Screen | Contents |
|---|---|
| **Calendar / Home** | Month strips with weekly slots (TV / PPV / past icons), company header bars (Rating, Champion, Talent, Age, Face-Heel Ratio, Territory %), payroll as "rate × headcount", bank balance, current venue and territory. Buttons: Roster, Map, Database, Card. |
| **Roster** | Grid of name plates. Color-coded: green face, purple heel, pink women's division, gray non-wrestler. Health as a red bar consuming the plate from the right. Belt icons under champions. Sortable by any stat, contract value, health, age, morale. Selecting shows the paper-doll, stat bars, and contract card ("$4,300 × 45 weeks · INCENTIVE"). |
| **Wrestler Profile** | Full paper-doll, stat bars, career record, title history, current rivalries, contract, morale and momentum, recent match log. Actions: book, negotiate, release, train, change gimmick. |
| **Card Builder** | Slot layout — Main Event on top, Mid Card, Under Card — matching the reference screenshot. Empty slots invite filling; filled slots show participants and post-show star rating. Drag to reorder. |
| **Match Setup** | Tabs: Rules · Cast · Stipulation · Stack the Deck. The Stack tab shows a fuzzy confidence band ("Slight edge," "Heavy favorite") updating as levers toggle. Never a percentage, never an itemized breakdown. |
| **Show Runner** | Results arrive as a completed card at the end of the night, not one match at a time. The full card renders with every result, star rating, and attendance figure at once; tapping any segment expands its play-by-play narrative and full rating breakdown. |
| **Show Summary** | Show stars, gate, payroll, net, rating movement, title changes, injuries, notable popularity swings. |
| **Finances** | Balance history chart, revenue and expense breakdown, payroll table by wrestler, projections. |
| **Titles** | Every belt with its holder, prestige, current reign length, and full lineage. |
| **Map** | World territory view. Ownership colors, following percentages, capacity, preferences, attendance records. Charter travel. |
| **Database** | All promotions ranked by rating, their champions and rosters, global popularity leaderboard, the records book, and the Hall of Fame (§19). Includes retired and deceased wrestlers permanently. |
| **Relationships** | Roster social map — friendships, enemies, couples, families, mentorships, tag teams, factions, and match chemistry ratings. |
| **Wrestler Editor** | Full pixel-art appearance editor for created wrestlers and mid-game look changes. |
| **World Creation** | Presets and the full settings tree (§5), including seed entry. |
| **Onboarding** | A guided first four weeks. Not a wall of text: the game runs a reduced roster and reduced systems, unlocking the office, contracts, chaos, territories, and cross-promotion over the first month. Skippable entirely. A dense management sim on a phone lives or dies on whether the first ten minutes make sense. |
| **News** | Weekly generated headlines: results, signings, injuries, complaints, rival activity, retirements, deaths, records broken. Also carries the **dirt sheet** — an independent pundit rating of your show that often disagrees with the internal number, praises workrate the crowd ignored, and buries your booking logic. Dirt sheet opinion nudges the smart-fan segment of your audience and gives the player an outside voice to argue with. |
| **Rankings** | Top 10 contenders per division, booking credibility, and which title shots the fans think are overdue. |
| **Inbox / Meetings** | Owner mandates, talent complaints, poaching bids, contract expirations. |

### Audio

Minimal. A single generic background track during show results, a crowd sting
for title changes and big upsets, and UI clicks. Toggleable, off by default on
mobile. No entrance themes, no commentary audio.

### Visual direction

**Modern, not retro.** The reference screenshots were shared for *content and
mechanics*, not art direction — do not imitate their worn-paper or 3D look. The
target is a clean, contemporary, high-contrast interface that happens to be
about wrestling: dense information laid out well, confident typography, strong
color coding. The only pixel art in the game is the wrestler sprites themselves,
which contrast deliberately against the clean UI.

**Phone-first, and it must be genuinely good on a phone** — not a desktop
layout squeezed down. Every screen is designed for a thumb: single-column,
tappable rows, bottom-anchored primary actions, no hover states, no dense
tables that require horizontal scrolling. Desktop gets the same layout with
more breathing room.

Card screens use **bust portraits**, not full-body sprites — space is at a
premium and portraits read better at a glance. Full-body sprites appear on the
wrestler profile and in the editor.

Star ratings, health/energy bars, and alignment colors are the three visual
languages that must be instantly parseable everywhere they appear.

**Accessibility is a real requirement, not a checkbox.** This design leans
heavily on color coding — face/heel green and purple, health in red — which
fails for a meaningful share of players. Every color-coded distinction must
also carry a shape, icon, or label: alignment gets a glyph as well as a color,
health gets a numeric or segmented indicator, star ratings get the numeral.
Provide a high-contrast mode, respect system text scaling, and never rely on
color alone to convey anything.

---

## 22. Persistence

- Single save slot per world. **Save and load is the entire requirement** — no
  export/import, no cloud sync, no account.
- Store in IndexedDB. Save after each week resolves.
- Save shape: `{ version, seed, week, wrestlers[], promotions[], titles[],
  territories[], rivalries[], shows[] (last 52 weeks in full, older summarized),
  records, inbox[], settings }`
- Include a `version` field and a migration chain from day one — this game
  will change shape repeatedly and saves spanning simulated decades are the
  whole point.
- Show history older than one year compresses to a summary row (date, type,
  territory, attendance, stars, main event) to keep saves bounded.

### Offline

*LOCKED: the game must work fully offline.* Ship it as an installable PWA with a
service worker caching the whole app shell. Nothing in the game requires a
network call — all generation, simulation, and storage is local. The player
should be able to install it to their phone home screen and play on a plane.

---

## 23. Build milestones

**M0 — Engine skeleton and test harness**
Types, `WorldSettings` with all defaults, seeded RNG, wrestler generation, name
generation. A headless script that
generates 300 wrestlers and prints them. No UI.

**M1 — Paper-doll and editor**
Pixel-art layer system, all trait ranges, three size variants, distinctness
check, and the full appearance editor for created wrestlers. A contact-sheet
page rendering 100 generated wrestlers.

Each milestone below lists what must work. The definition of done in §0 applies
to all of them.

**M2 — Core loop, playable**
Calendar, roster screen, card builder, match rules, the sim engine, star
ratings, rating breakdown, show ratings, the TV ladder, attendance, gate,
payroll. *This is the first genuinely playable version.*

**M3 — Consequences and the locker room**
Titles, champions, prestige, popularity transfer, injuries, health, energy,
momentum, morale, mood, aging, retirement, the wrestling school with random
trainee arrivals, tag teams and factions, staff roles, relationships and match
chemistry, statistics tracking.

**M4 — Stack the deck**
Managers, referee assignments, run-ins, pre-match angles, instructions, live
odds display, the scripted-finish escape hatch.

**M5 — The world**
Contracts, clauses, negotiation, poaching, releases, rivalries, promos,
alignment turns, AI promotions, the Database screen, owner mandates, TV rights
deals and arena tiers.

**M5.5 — Chaos**
The random event engine and all five event categories. Slot this immediately
after M5 rather than last: the events depend on morale, contracts, and rival
promotions existing, and the game is noticeably lifeless until they land.

**M6 — Territories and legacy**
Map, travel, following decay, attendance records, invasions, inter-promotional
war, territory preferences feeding match ratings.

Also in M6: the Hall of Fame, the records book, second-generation wrestlers,
and rival promotions folding.

**Post-v1 candidates:** multi-week storyline planner, custom promotion
creation, historical era presets, merchandise and licensing depth.

---

## 24. Open decisions

Things I've made a call on that are worth a second look before building:

1. ~~Charisma stat.~~ **RESOLVED — added**, along with coachability and
   toughness. A bad worker who's a great talker is now expressible.
2. ~~Tag teams and factions.~~ **RESOLVED — in from square one**, with their
   own popularity, chemistry, records, and titles. See §18.
3. ~~Booking in advance.~~ **RESOLVED — week by week.** The one exception is
   the "challenge to a match" promo topic, which announces a future match
   organically through a storyline rather than a planner.
4. **The clamp range.** [8%, 92%] is my proposed ceiling on stacking. Tighter
   (15/85) makes upsets common and the player feel powerless; looser (3/97)
   makes stacking near-deterministic and kills the tension. Worth tuning
   against real play.
5. ~~Difficulty / world size.~~ **RESOLVED** — fully exposed in §5 settings.
6. **Women's division.** Modeled as a title tier and a territory preference.
   Whether divisions are segregated or intergender is allowed is a
   world-creation setting. *Still open: your call on the default.*
7. ~~Picking winners.~~ **RESOLVED — the sim always decides.** No scripted
   finishes, no escape hatch, no re-sims. The scripted-finish system has been
   cut from §10 entirely.
8. **Match length.** Currently derived from `timeLimit` and stamina rather than
   set by the player. An explicit "give them 20 minutes" lever would be another
   good deck-stacking dial. *Recommendation: add as an instruction option.*
