// Tag-team and faction identities offered at the signing meeting alongside
// solo gimmicks (data/gimmicks.ts) — see docs/gimmicks-catalog-draft.md for
// the full character list this was drawn from. Each entry is a shared
// identity for a `Stable`, not mechanical stats: a group's popularity and
// growth still belong to its individual members. Adding a new one is just
// another array entry — nothing else in the signing flow needs to change.

import type { GroupGimmick } from '../engine/types';

export const GROUP_GIMMICKS: GroupGimmick[] = [
  { id: 'gtheWreckingCrew', name: 'The Wrecking Crew', kind: 'tagTeam', alignmentLean: 'heel', concept: 'Demolition/construction duo, matching hard hats, "condemned" as a shared finisher name.', promoLines: ['This whole building\'s coming down tonight.'] },
  { id: 'gcellBlock', name: 'Cell Block', kind: 'tagTeam', alignmentLean: 'heel', concept: 'Two former inmates, shared "did time together" backstory, genuine loyalty played as menace.', promoLines: ['We already survived worse than each other. What do you think you survive?'] },
  { id: 'gdoubleOrNothing', name: 'Double or Nothing', kind: 'tagTeam', alignmentLean: 'heel', concept: 'A gambler duo, cards-and-dice theming, "the house always wins" as a shared catchphrase.', promoLines: ['You bet on the wrong table.'] },
  { id: 'gtheLineCrew', name: 'The Line Crew', kind: 'tagTeam', alignmentLean: 'face', concept: 'Utility-worker duo, "we fix what\'s broken" blue-collar teamwork gimmick.', promoLines: ['Every outage gets restored eventually. You\'re the outage.'] },
  { id: 'gclosingTime', name: 'Closing Time', kind: 'tagTeam', alignmentLean: 'heel', concept: 'Two bouncers-turned-wrestlers, "we\'re the ones who throw you out" energy.', promoLines: ['We\'ve cleared out worse crowds than this one.'] },
  { id: 'gtheBoyScouts', name: 'The Boy Scouts', kind: 'tagTeam', alignmentLean: 'face', concept: 'Earnest, merit-badge theatrics played half for comedy, genuinely dangerous once it turns.', promoLines: ['We came prepared. Did you?'] },
  { id: 'gsuddenDeath', name: 'Sudden Death', kind: 'tagTeam', alignmentLean: 'heel', concept: 'Overtime-obsessed duo, insist every match should end in chaos, thrive in no-countout stipulations.', promoLines: ['Regulation\'s for cowards. We only do sudden death.'] },
  { id: 'gtheVacancy', name: 'The Vacancy', kind: 'tagTeam', alignmentLean: 'heel', concept: 'Motel-owner duo, "checked you in, we\'re checking you out" theming.', promoLines: ['Checkout was an hour ago. You\'re still here.'] },
  { id: 'gfreshInk', name: 'Fresh Ink', kind: 'tagTeam', alignmentLean: 'face', concept: 'Tattoo-parlor duo, matching new-ink entrances, loud and proud showmen.', promoLines: ['Every piece tells a story. Yours ends tonight.'] },
  { id: 'gtheForeclosure', name: 'The Foreclosure', kind: 'tagTeam', alignmentLean: 'heel', concept: 'Bank-repo duo, corporate menace, "we own everything eventually" theming.', promoLines: ['We already own the deed on this match.'] },
  { id: 'govertimeParking', name: 'Overtime Parking', kind: 'tagTeam', alignmentLean: 'face', concept: 'Meter-maid/valet duo played for comedy that turns genuinely tough.', promoLines: ['You\'re way past your time limit.'] },
  { id: 'gtheUnderstudies', name: 'The Understudies', kind: 'tagTeam', alignmentLean: 'heel', concept: 'A theater duo sharing the same "finally got billed" grudge as a pair.', promoLines: ['Two understudies is still a headline act. Watch.'] },
  { id: 'gsaltAndVinegar', name: 'Salt and Vinegar', kind: 'tagTeam', alignmentLean: 'face', concept: 'A loud, bickering duo whose in-fighting somehow makes them more dangerous, not less.', promoLines: ['We fight each other worse than we\'re about to fight you.'] },
  { id: 'gtheDeepFreeze', name: 'The Deep Freeze', kind: 'tagTeam', alignmentLean: 'heel', concept: 'Cold, silent, methodical duo — zero showmanship, maximum menace, built for a slow, suffocating match style.', promoLines: ['This ends quietly.'] },
  { id: 'groughhouse', name: 'Roughhouse', kind: 'tagTeam', alignmentLean: 'face', concept: 'Bar-brawl-style duo, genuinely enjoy the fight more than the win.', promoLines: ['We didn\'t come here for a wrestling match. We came for a bar fight.'] },
  { id: 'gtheOverdraft', name: 'The Overdraft', kind: 'tagTeam', alignmentLean: 'heel', concept: 'Debt-collector duo, "you owe us" theming applied to the whole card.', promoLines: ['Everybody in this building owes somebody. Tonight, you pay us.'] },
  { id: 'ghighBeams', name: 'High Beams', kind: 'tagTeam', alignmentLean: 'face', concept: 'A trucker/road duo, "we\'ve logged more miles than this whole card combined" swagger.', promoLines: ['We\'ve driven through worse weather than you.'] },
  { id: 'gtheOvertimeRule', name: 'The Overtime Rule', kind: 'tagTeam', alignmentLean: 'heel', concept: 'A sports-crossover duo, obsessed with making every match go the distance on their terms.', promoLines: ['Regulation doesn\'t apply to us. Never has.'] },
  { id: 'gstaticCling', name: 'Static Cling', kind: 'tagTeam', alignmentLean: 'heel', concept: 'A tech/media duo, "we already control what you see" theming.', promoLines: ['We wrote the story before you walked out here.'] },
  { id: 'gbarrelRoll', name: 'Barrel Roll', kind: 'tagTeam', alignmentLean: 'face', concept: 'A rodeo-and-derby duo, chaotic showmanship, genuinely reckless in-ring style.', promoLines: ['We don\'t slow down for anybody. Never have.'] },
  { id: 'gtheSecondOpinion', name: 'The Second Opinion', kind: 'tagTeam', alignmentLean: 'heel', concept: 'A medical-themed duo, unsettling clinical calm, finish opponents off with the same cold precision.', promoLines: ['We already agree on the diagnosis.'] },

  { id: 'gtheUnion', name: 'The Union', kind: 'stable', alignmentLean: 'face', concept: 'Blue-collar solidarity faction — every member reads as a different trade. Shared cause: "the locker room takes care of its own."', promoLines: [] },
  { id: 'gtheBoardroom', name: 'The Boardroom', kind: 'stable', alignmentLean: 'heel', concept: 'Corporate-raider faction — suits and lawyers. Shared cause: buying up the roster\'s contracts and loyalty.', promoLines: [] },
  { id: 'gcellBlockNine', name: 'Cell Block Nine', kind: 'stable', alignmentLean: 'heel', concept: 'A prison-yard faction, recruiting anyone with a "did-time" backstory.', promoLines: [] },
  { id: 'gtheCongregation', name: 'The Congregation', kind: 'stable', alignmentLean: 'heel', concept: 'Genuinely creepy — cult-adjacent, a group faith rather than one leader\'s personality.', promoLines: [] },
  { id: 'gtheReserves', name: 'The Reserves', kind: 'stable', alignmentLean: 'face', concept: 'A misfit faction of never-quite-made-it acts, banding together specifically because none of them got picked first.', promoLines: [] },
  { id: 'gtheMotorPool', name: 'The Motor Pool', kind: 'stable', alignmentLean: 'heel', concept: 'A biker-and-trucker faction, road gang energy, genuine menace in numbers.', promoLines: [] },
  { id: 'gtheDojo', name: 'The Dojo', kind: 'stable', alignmentLean: 'face', concept: 'A martial-discipline faction, "honor before everything" shared code — the one faction that actually polices its own members\' conduct.', promoLines: [] },
  { id: 'gtheWasteyard', name: 'The Wasteyard', kind: 'stable', alignmentLean: 'heel', concept: 'A scrap-and-salvage faction — "we take what\'s thrown away and make it dangerous" as the shared hook.', promoLines: [] },
  { id: 'gtheFrequency', name: 'The Frequency', kind: 'stable', alignmentLean: 'heel', concept: 'A media-and-tech faction — "we control the narrative" as the shared hook.', promoLines: [] },
  { id: 'glastRites', name: 'Last Rites', kind: 'stable', alignmentLean: 'heel', concept: 'Genuinely dark tone — a mystical faction with a shared "bad things happen around us" mythology.', promoLines: [] },
  { id: 'gtheBracket', name: 'The Bracket', kind: 'stable', alignmentLean: 'face', concept: 'A sports-crossover faction — competitive-athlete camaraderie, "we respect the game even when we\'re breaking your face" ethos.', promoLines: [] },
  { id: 'gtheUnderstudyCompany', name: 'The Understudy Company', kind: 'stable', alignmentLean: 'heel', concept: 'The full-troupe version of a theater company — showbiz-adjacent members who all spent years as somebody\'s opening act and are done being one.', promoLines: [] },
  { id: 'gopenRoad', name: 'Open Road', kind: 'stable', alignmentLean: 'face', concept: 'A trucker/biker/travel faction, built around the idea that none of them belong to any one territory.', promoLines: [] },
  { id: 'gtheColony', name: 'The Colony', kind: 'stable', alignmentLean: 'heel', concept: 'Genuinely eerie — a hive-minded faction, "we do not act alone, we act as one" collective-menace framing rather than any single leader\'s personality.', promoLines: [] },
  { id: 'glastCallLocal12', name: 'Last Call Local 12', kind: 'stable', alignmentLean: 'face', concept: 'A service-industry faction, genuine working-friends camaraderie — closest thing to a comic-relief faction that still wins clean.', promoLines: [] },
];

export function groupGimmickById(id: string): GroupGimmick | undefined {
  return GROUP_GIMMICKS.find((g) => g.id === id);
}

export function tagTeamGimmicks(): GroupGimmick[] {
  return GROUP_GIMMICKS.filter((g) => g.kind === 'tagTeam');
}

export function factionGimmicks(): GroupGimmick[] {
  return GROUP_GIMMICKS.filter((g) => g.kind === 'stable');
}
