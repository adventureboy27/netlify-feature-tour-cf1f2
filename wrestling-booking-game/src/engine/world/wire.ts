// The wire — everything that happened to anybody this week.
//
// CLAUDE.md's rule is that nothing happens to a person off-screen. That was
// true of injuries, which are reported under the match that caused them, and
// not true of very much else. An audit found the holes:
//
//   - Deaths, retirements and comebacks were collected into the year-end
//     digest. Somebody could die in March and the player would find out in
//     December, from a list.
//   - Tag teams and stables broke up silently. The partnership that headlined
//     your show in April was simply not a team in May.
//   - Rivals signed the wrestler you released and nobody said so. You found
//     out by seeing him in somebody else's main event, if you noticed at all.
//   - Contract expiries, releases and officials' comings and goings were on
//     an office tab, which is not the weekly highlights.
//   - Hall of Fame inductions and school graduations: year end only.
//
// So there is one wire now. Everything that changes a person appends a line
// to it as it happens, the results page prints it, and it clears at the start
// of the next week. If a system can change somebody, that system owes this
// file a sentence — and a test asserts every kind can produce one.

export type WireKind =
  | 'departure'
  | 'signing'
  | 'death'
  | 'retirement'
  | 'comeback'
  | 'team'
  | 'official'
  | 'weather'
  | 'honour'
  | 'debut'
  | 'title'
  /** Something that happened to somebody away from a ring. */
  | 'misfortune'
  /**
   * What a body did after the booker sent it out there hurt. Separate from
   * 'misfortune' because the company chose this one.
   */
  | 'injury'
  /** An arc the booker is running started, boiled over, ended or died. */
  | 'story'
  /** The nights on the road the cameras were not at. */
  | 'houseShow'
  /** The cameras were there and the feed still didn't hold. See sim/broadcast.ts. */
  | 'broadcast'
  /** A change to the shape of the business itself — a promotion bought, sold, or merged. */
  | 'business'
  /** Who's actually in charge somewhere — a founder's death, a succession, an heir taking over. */
  | 'ownership'
  /** A wrestler's deal — signed, broken, exposed, or exploited. */
  | 'contract'
  /** A signing, a departure, or a raid that's really about who's on which roster. */
  | 'talent';

/** How loudly the results page should say it. */
export type WireWeight = 'lead' | 'normal' | 'minor';

export interface WireItem {
  kind: WireKind;
  text: string;
  week: number;
  weight: WireWeight;
  /** Whose news it is, when it belongs to a company rather than the world. */
  promotionId?: string;
}

export const WIRE_KIND_LABELS: Record<WireKind, string> = {
  departure: 'Departure',
  signing: 'Signing',
  death: 'Obituary',
  retirement: 'Retirement',
  comeback: 'Comeback',
  team: 'Teams',
  official: 'Officials',
  honour: 'Honors',
  debut: 'Debut',
  title: 'Title',
  weather: 'The road',
  misfortune: 'The road',
  injury: 'The injury',
  story: 'The story',
  houseShow: 'On the road',
  broadcast: 'The broadcast',
  business: 'The business',
  ownership: 'Ownership',
  contract: 'Contracts',
  talent: 'Talent',
};

/**
 * Which lines matter most, for a page that shows the first handful.
 *
 * A death leads over a signing, and a signing leads over somebody's contract
 * running out — the same order a newsletter would use.
 */
const WEIGHT_ORDER: Record<WireWeight, number> = { lead: 0, normal: 1, minor: 2 };
const KIND_ORDER: WireKind[] = [
  'death',
  'retirement',
  // Above the belt and the story: a man who is not getting up is the night's
  // headline whatever else happened on the card.
  'injury',
  'comeback',
  'title',
  'story',
  'departure',
  'signing',
  'team',
  'honour',
  'debut',
  'official',
  'weather',
];

export function sortWire(items: readonly WireItem[]): WireItem[] {
  return [...items].sort((a, b) => {
    const byWeight = WEIGHT_ORDER[a.weight] - WEIGHT_ORDER[b.weight];
    if (byWeight !== 0) return byWeight;
    return KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
  });
}

/** Build one line. A helper so no caller can forget the week or the weight. */
export function wire(kind: WireKind, text: string, week: number, weight: WireWeight = 'normal'): WireItem {
  return { kind, text, week, weight };
}

// ------------------------------------------------------------- the phrasing
//
// Kept here rather than at the call sites so that the same event reads the
// same way wherever it is raised, and so the tests can check that none of
// them can produce an empty or unfinished sentence.

export function teamFormedLine(teamName: string, memberNames: readonly string[], week: number): WireItem {
  return wire('team', `${memberNames.join(' and ')} have started teaming as ${teamName}.`, week, 'minor');
}

export function teamSplitLine(teamName: string, memberNames: readonly string[], week: number): WireItem {
  return wire(
    'team',
    `${teamName} are finished. ${memberNames.join(' and ')} are going their own way.`,
    week,
    'normal',
  );
}

export function rivalSigningLine(name: string, promotionName: string, week: number): WireItem {
  return wire('signing', `${promotionName} have signed ${name}.`, week);
}

/** A nostalgic promoter's own signing announcement — see engine/world/nostalgia.ts. */
export function nostalgicSigningLine(name: string, promotionName: string, week: number): WireItem {
  return wire(
    'signing',
    `${promotionName} have brought back ${name} — "getting the band back together," is how they put it, and they mean every word.`,
    week,
  );
}

export function deathLine(name: string, age: number, cause: string, week: number): WireItem {
  return wire('death', `${name} has died at ${age}. ${cause}`, week, 'lead');
}

export function retirementLine(name: string, reason: string, week: number): WireItem {
  return wire('retirement', `${name} has retired. ${reason}`, week, 'lead');
}

export function comebackLine(name: string, week: number): WireItem {
  return wire('comeback', `${name} is coming out of retirement.`, week, 'lead');
}

export function inductionLine(name: string, week: number): WireItem {
  return wire('honour', `${name} has been inducted into the Hall of Fame.`, week);
}

export function debutLine(names: readonly string[], week: number): WireItem {
  const who = names.length === 1 ? names[0]! : `${names.length} graduates`;
  return wire('debut', `${who} came out of the school this week and turned professional.`, week, 'minor');
}

/**
 * The auction opening. A lead, because a star reaching the open market is the
 * biggest story the business has that week and the booker has a decision to
 * make about it.
 */
export function biddingOpenedLine(sentence: string, week: number): WireItem {
  return wire('signing', sentence, week, 'lead');
}

/** And where they ended up. */
export function biddingSettledLine(sentence: string, week: number): WireItem {
  return wire('signing', sentence, week, 'lead');
}

/**
 * A familiar surname coming back into the business — a lead, not a filler
 * line, because it is the only debut anybody outside the school cares about.
 *
 * The sentence itself is composed in career/lineage.ts, which is the only
 * place that knows whether the parent is retired, in the hall, or dead.
 */
export function secondGenerationLine(sentence: string, week: number): WireItem {
  return wire('debut', sentence, week, 'lead');
}
