// Saving the game.
//
// The whole point of a promotion is that it runs for decades, so a save has
// to survive closing the tab. Everything lives in localStorage — no network,
// no accounts, no cloud (CLAUDE.md: fully offline).
//
// The World is plain data by construction, so JSON round-trips it as-is. The
// only thing outside it is the RNG's position in its stream, which is saved
// alongside so a reloaded game keeps rolling from where it stopped instead of
// replaying the same "random" week.

import type { World } from './world';

const SLOT_KEY = 'wbg.save.v1';
// Bumped when the World gains state a running save cannot be without — v2
// added the year record the end-of-year awards are judged on, which cannot be
// reconstructed from a mid-year save.
// Bumped whenever the World shape gains a field the code then dereferences
// without a guard. Version 3 shipped mid-development and then grew
// staffManagers, releaseRequests, contractNews, weeklyNews and thisYear
// without a bump — a save from that window would load (the version matched)
// and then throw on the first `world.weeklyNews.filter`. There is no
// migration path by design: a mismatched save is refused with a message,
// which is honest, and far better than loading one that explodes later.
// Version 5 dropped refereeNews and contractNews in favour of the single
// weeklyNews wire.
//
// Version 6 is not a shape change but a world change: territory capacities
// are baked into the save, and the two biggest markets grew so the top of the
// venue ladder could be booked at all. A version-5 save would keep its old
// map and play it against the new buildings — a world that never existed.
//
// Version 7 adds ratingLadderAnchors and audienceLoyalCore to WorldSettings,
// both of which the code reads without a guard — a version-6 save would pass
// the version check and then throw on the first show it resolved.
//
// Version 8 splits Contract into weeklyRate + perAppearance and adds the
// division/tag-team/retainer settings. A version-7 save has no perAppearance
// on any contract, so every wrestler would silently work for free.
//
// Version 9 adds a climate to every territory, pendingMemoriam to the world,
// and the weather settings. A version-8 save has no climate on its towns, so
// the weather roll would find nothing eligible anywhere and the year would be
// silent forever.
//
// Version 10 adds pendingWeatherCall/weatherChoice and the forecast settings.
//
// Version 11 puts a defence clock on every belt (lastDefendedWeek, the interim
// holder fields), clearedToWorkHurt on every wrestler, pendingChampionCall on
// the world, and the freshness and circuit settings. A version-10 save has no
// lastDefendedWeek, which reads as 0 — every belt in the company would be
// stripped as undefended on the first week it loaded.
//
// Version 12 adds secretSignings to the world, the confrontation fields on a
// segment, and the freshness/circuit/confrontation/faction settings. A
// version-11 save has no secretSignings array, which the weekly tick iterates
// without a guard.
//
// Version 13 reshapes a SecretSigning entirely — it is now a handshake with
// somebody whose rival deal is running out rather than a contract held while
// he works for two companies, so signedWeek/leakedWeek became
// agreedWeek/freeWeek/signedWeek/blownWeek. It also stakes the whole thing on
// rival contracts having staggered, ticking terms, which a version-12 save
// does not: every rival deal in one would sit at the same 104 weeks forever
// and nobody in the business would ever come free.
//
// Version 14 adds moraleNote and moraleLastDelta to Wrestler and the whole
// morale settings block. A version-13 save has neither, so the mood face
// would read undefined for every person on the roster.
//
// Version 15 adds world.storylines and the storyline settings block. A
// version-14 save has no array, which the weekly tick iterates without a
// guard.
//
// Version 16 adds regionalPopularity to Wrestler and gives everybody a real
// homeTerritoryId. A version-15 save has neither: every wrestler in it would
// carry the literal string 'territory-unassigned' as a hometown, so nobody
// would ever get a hometown pop, and the whole reach system would read every
// town as a strange one forever.
//
// Version 17 adds the second-generation settings block and Wrestler.lineage.
// A version-16 save has none of the settings, so `rollParent` would compare
// a peak popularity against undefined on every graduate and the whole
// eligibility check would silently answer false forever — the feature would
// be off in old saves and on in new ones, with nothing to tell them apart.
//
// Version 18 adds pendingBiddingWar/lastBiddingWar to the world and the whole
// bidding settings block. A version-17 save has neither: the weekly tick
// dereferences the pending war without a guard, and every weight the auction
// scores offers on would read undefined, so the first star to reach the open
// market would settle on NaN.
//
// Version 19 reshapes a BiddingWar (it gains a round counter and the reason a
// wrestler sent the room away), adds Wrestler.grudges, and replaces the flat
// ally/enemy bid weights with the market-value and relationship-pricing
// settings. A version-18 save would price every offer against undefined.
//
// Version 20 puts the announced minimum on a BiddingWar and replaces the
// hidden walk-away share with it, along with the hunger and big-swing
// settings. A version-19 save has no minimum on a war in flight, so every bid
// in it would be compared against undefined.
//
// Version 21 adds Contract.perks and the perk settings. The field is optional
// and reads correctly as "none" on an old contract, but the settings are not:
// a version-20 save would compare against an undefined resentment scale on
// every wrestler, every week.
//
// Version 22 caps the school's intake age and adds the walk-on settings and
// the 'walkOn' availability reason. A version-21 save has no walkOn* settings,
// so the yearly intake would generate a batch of people with an undefined age
// range.
//
// Version 23 adds Wrestler.hype and the hype settings. Every scouting read in
// the game now goes through that field rather than the hidden `talent`, so a
// version-22 save would have the whole business valuing everybody at
// undefined.
//
// Version 24 adds the new-promotion settings and changes what
// `workingPopulation` counts, plus smaller starting rosters and pools. A
// version-23 save has none of the newPromotion* settings, so the weekly roll
// would compare a headcount against undefined and never open anything — the
// business would go back to folding its way to nothing.
// Version 34 covers two rounds of work at once, because the first of them
// forgot to bump and that is exactly the failure this counter exists to stop.
// The financials added World.statements, productionRungs and haulageId, all
// three dereferenced without a guard — a version-32 save would have loaded
// cleanly and then thrown on the first `world.statements.push` of the first
// week it resolved. This round adds ShowSetup.standIds, read the same way when
// the night's tables are added up, and World.residency (guarded, but it
// travels with the rest).
// Version 35 narrows the Clause union from twenty-two entries to thirteen —
// the nine removed were never offered, granted or read — and adds World.grudges,
// which resolveWeek dereferences without a guard.
// Version 36 adds Wrestler.selfPreservation and Wrestler.injuryHistory. The
// first is defaulted where it is read, but the history is appended to without
// a guard the moment anybody gets hurt.
//
// Version 44 adds World.currentDarkMatches and the darkMatch* settings. A
// version-43 save has no array, which the card builder and the weekly tick
// both index into without a guard.
//
// Version 45 removes illegal tampering entirely — a rival could go after
// somebody still under contract to you, and the player could go after
// somebody else's. World.tamperingOffers is renamed World.approachOffers and
// drops its now-single-valued `kind`; World.poachingOffers (dead — nothing
// ever wrote to it), World.signingBanWeeks, World.suspensionWeeks and
// World.tamperingOffenses are gone. A version-44 save has the old field
// names and shapes, which the weekly tick and the contracts screen would
// both misread.
//
// Version 46 lets a creative event branch into a follow-up decision instead
// of always resolving in one tick. World.pendingEvent gains currentNodeId
// and history to track which node is showing and the scrollback of what was
// already said and chosen. A version-45 save has neither, so a booker mid a
// branching conversation when they saved would resume on an undefined node.
//
// Version 47 adds World.pendingNoShowCall and World.noShowChoice — the
// business-wide catastrophe system's mystery-opponent decision (see
// engine/world/catastrophe.ts, engine/world/noShowCall.ts). A version-46
// save has neither field, so a booker mid an unanswered no-show call when
// they saved would resume with no way to ever answer it.
//
// Version 48 adds World.pendingTitleMemorial — what happens to a belt left
// with a dead champion (engine/world/titleMemorial.ts). A version-47 save
// has no such field.
//
// Version 49 adds World.pendingRivalMove — the reaction to a rival's
// shocking signing (engine/world/rivalMove.ts). A version-48 save has no
// such field.
//
// Version 50 adds World.pendingConfrontationCall — the decision on a
// confrontation that goes physical (engine/world/confrontationCall.ts).
// A version-49 save has no such field.
//
// (Wrestler.motivators, added alongside this comment, is NOT a schema bump.
// It is optional and every reader goes through motivatorsOf/hasMotivator in
// career/motivation.ts, both of which default a missing array to empty — a
// version-50 save loads fine and simply shows nobody with a motivator until
// natural roster turnover generates people who have one. A schema bump
// exists to stop a crash on old data, and there is no crash here to stop.)
//
// Version 51 adds World.loansTaken, World.solventWeeksSinceLastLoan,
// World.pendingLoanOffer and World.activeLoan — the player's own bankruptcy
// lifeline (engine/economy/loan.ts). Unlike motivators above, these are NOT
// optional: resolveWeek reads loansTaken and solventWeeksSinceLastLoan on
// every tick to decide whether to offer a loan, and a version-50 save has
// neither, so the comparison would run against undefined and either offer a
// loan nobody should still qualify for or never offer one again.
//
// Version 52 adds World.pendingBuyoutOffer — a rival's blind bulk offer for
// a slice of the roster while an active loan is running
// (engine/economy/buyout.ts). A version-51 save has no such field, and
// resolveWeek dereferences it every week to decide whether to roll a new
// offer.
//
// Version 53 adds World.solventWeeksSinceLastRelease — the cooldown clock
// for release stigma reaching ordinary negotiations
// (engine/economy/releaseStigma.ts), same shape as
// solventWeeksSinceLastLoan above. A version-52 save has no such field, and
// resolveWeek increments/resets it unconditionally every week.
//
// Version 54 adds World.renewalTalks — the renewal-window conversation
// (state/world.ts's RenewalTalk, opened at WorldSettings.renewalWindowWeeks
// rather than automatically at expiry). A version-53 save has no such
// field, and resolveWeek both iterates and pushes to it every week.
// (Wrestler.queuedContract, added alongside this, is NOT part of the bump —
// it is optional, and every read treats a missing field exactly like null.)
//
// Version 55 adds World.signingTalks — the "meet the booker" signing
// conversation (state/world.ts's SigningTalk), opened once per new signee.
// A version-54 save has no such field, and it is read unconditionally by
// the Office screen. (Wrestler.weeksIceCold, added alongside this for the
// forced cold-meeting flow, is NOT part of the bump — it is optional, and
// every read treats a missing field the same as 0.)
//
// Version 56 adds World.coldMeetings — the forced cold-meeting
// (state/world.ts's ColdMeeting), opened once an act has sat ice cold for
// coldMeetingTriggerWeeks running. A version-55 save has no such field,
// and resolveWeek both iterates and pushes to it every week.
//
// Version 57 adds World.pendingGimmickReactions — gimmick decisions
// (a debut, a pairing, a relaunch) queued for the fan-tweet feed
// (engine/world/fanReaction.ts's GimmickReactionSubject) and drained the
// next time the player's own show runs. A version-56 save has no such
// field, and resolveWeek both reads and clears it every show.
//
// Version 58 adds Promotion.fanTaste — what each promotion's crowd has
// actually come to want, by wrestling style (engine/world/fanTaste.ts),
// distinct from the fixed identity chosen at signing. A version-57 save's
// promotions have no such field, and resolveWeek both reads and drifts it
// for the player and every rival, every week.
const SCHEMA_VERSION = 58;

export interface SaveFile {
  schema: number;
  savedAtWeek: number;
  promotionName: string;
  rngState: number;
  world: World;
}

function storage(): Storage | null {
  try {
    // Private-mode Safari and locked-down browsers throw on access, not on use.
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function saveGame(world: World, rngState: number): boolean {
  const store = storage();
  if (!store) return false;

  const file: SaveFile = {
    schema: SCHEMA_VERSION,
    savedAtWeek: world.week,
    promotionName: world.promotion.name,
    rngState,
    world,
  };

  try {
    store.setItem(SLOT_KEY, JSON.stringify(file));
    return true;
  } catch {
    // Out of quota, or storage disabled mid-session. The game keeps running;
    // it just will not survive a reload, and the caller can say so.
    return false;
  }
}

export function loadGame(): SaveFile | null {
  const store = storage();
  if (!store) return null;

  const raw = store.getItem(SLOT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SaveFile;
    // A save from an older schema is not worth guessing at. Better to start
    // clean than to load a world with half its systems missing.
    if (parsed.schema !== SCHEMA_VERSION || !parsed.world) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** What is in the slot, without deserialising the whole world. */
export function savedGameSummary(): { promotionName: string; week: number } | null {
  const file = loadGame();
  return file ? { promotionName: file.promotionName, week: file.savedAtWeek } : null;
}

export function clearSave(): void {
  storage()?.removeItem(SLOT_KEY);
}

// ---------------------------------------------------------------------------
// Taking a save out of the browser
//
// A promotion that has run for thirty simulated years lives in one browser's
// localStorage, which is one cleared cache from gone. These two turn it into a
// file the player owns.

export function exportSave(world: World, rngState: number): string {
  const file: SaveFile = {
    schema: SCHEMA_VERSION,
    savedAtWeek: world.week,
    promotionName: world.promotion.name,
    rngState,
    world,
  };
  return JSON.stringify(file);
}

/**
 * Read a save file back. Returns null with a reason rather than throwing,
 * because the input is whatever the player picked off their disk.
 */
export function importSave(raw: string): { file: SaveFile } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'That file is not a save — it is not even JSON.' };
  }
  if (typeof parsed !== 'object' || parsed === null) return { error: 'That file does not contain a save.' };

  const file = parsed as Partial<SaveFile>;
  if (!file.world || typeof file.world !== 'object') return { error: 'That file has no world in it.' };
  if (file.schema !== SCHEMA_VERSION) {
    return {
      error: `That save is from a different version of the game (schema ${file.schema ?? 'unknown'}, this build reads ${SCHEMA_VERSION}).`,
    };
  }
  // A save missing the spine is not worth guessing at — better a clear refusal
  // than a world that half-loads and breaks three weeks later.
  const world = file.world as Partial<World>;
  if (!world.promotion || !world.wrestlers || typeof world.week !== 'number') {
    return { error: 'That save is incomplete.' };
  }
  return { file: file as SaveFile };
}

/** A filename that says what it is and when it was. */
export function saveFilename(world: World): string {
  const safe = world.promotion.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  const year = world.settings.startingYear + Math.floor(world.week / 52);
  return `${safe || 'promotion'}-${year}-week-${world.week}.wbg.json`;
}
