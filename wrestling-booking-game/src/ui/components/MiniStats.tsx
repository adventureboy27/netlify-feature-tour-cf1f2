// A whole wrestler, at a glance, under their face.
//
// The only stat readout in the game was StatBar: a full word ("Popularity",
// "Mic work") in a fixed twenty-unit column beside a bar, eight of them in a
// two-column grid to the *right* of the portrait, and only on the big roster
// card. Every picker and row everywhere else showed a face and nothing else.
// So choosing who to book meant reading prose, and comparing two people meant
// scrolling between two cards.
//
// This is the compact form, and it answers the six things a booker asks about
// somebody before anything else — is he champion, is he hurt, is he tired,
// how does he feel about me, which way does he go, and how long have I got
// him for — and then the meters.
//
// Letters label, they never grade. §0 is explicit that stats are bars and
// trend arrows and never numbers, and a letter grade is a number wearing a
// hat: B+ is 78 and everybody reading it knows that. So POP names the meter
// and the bar carries the value, which keeps the whole thing inside the rule
// and still lets you compare two people without reading a sentence.
//
// Contract weeks are the one number here, deliberately. It is a fact with a
// date attached rather than a rating — the same licence the roster card
// already takes, and "12w" is the answer to a question no bar can give.

import { contractUrgency } from '../../engine/economy/contracts';
import { popularityIn, reachLabel, reachOf } from '../../engine/career/reach';
import { moodBand, moodLabel } from '../../engine/career/morale';
import type { Id, Title, Wrestler, WorldSettings } from '../../engine/types';

/** Label, full name for the tooltip, and where to read it off a wrestler. */
const METERS: readonly { key: string; title: string; of: (w: Wrestler) => number; tone?: 'health' }[] = [
  { key: 'POP', title: 'Popularity — how over they are', of: (w) => w.popularity },
  { key: 'STR', title: 'Strength', of: (w) => w.strength },
  { key: 'SKL', title: 'Skill — ring work', of: (w) => w.skill },
  { key: 'AGI', title: 'Agility', of: (w) => w.agility },
  { key: 'STA', title: 'Stamina', of: (w) => w.stamina },
  { key: 'MIC', title: 'Mic work — talking', of: (w) => w.charisma },
  { key: 'MOM', title: 'Momentum — which way they are trending', of: (w) => w.momentum },
  { key: 'CON', title: 'Condition — how healthy they are', of: (w) => w.health, tone: 'health' },
];

function barColour(pct: number, tone?: 'health'): string {
  if (tone !== 'health') return 'bg-sky-500';
  if (pct >= 70) return 'bg-emerald-500';
  if (pct >= 40) return 'bg-amber-500';
  return 'bg-rose-500';
}

function Meter({ label, title, value, tone }: { label: string; title: string; value: number; tone?: 'health' }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-1" title={title}>
      <span className="w-[22px] shrink-0 font-mono text-[8px] font-bold leading-none tracking-tight text-neutral-500">
        {label}
      </span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-800">
        <div className={`h-full rounded-full ${barColour(pct, tone)}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** One status pip. Small, glyph-first, and every one of them has a tooltip. */
function Pip({ children, tone, title }: { children: React.ReactNode; tone: string; title: string }) {
  return (
    <span
      title={title}
      className={`inline-flex h-[13px] shrink-0 items-center gap-[2px] rounded px-[3px] text-[8px] font-bold leading-none ${tone}`}
    >
      {children}
    </span>
  );
}

const ALIGNMENT: Record<string, { letter: string; word: string; tone: string }> = {
  face: { letter: 'F', word: 'Face — the crowd is meant to cheer', tone: 'bg-sky-950 text-sky-300' },
  heel: { letter: 'H', word: 'Heel — the crowd is meant to boo', tone: 'bg-rose-950 text-rose-300' },
  tweener: { letter: 'T', word: 'Tweener — could go either way', tone: 'bg-neutral-800 text-neutral-400' },
};

function alignmentOf(w: Wrestler): keyof typeof ALIGNMENT {
  if (w.alignment >= 15) return 'face';
  if (w.alignment <= -15) return 'heel';
  return 'tweener';
}

/**
 * The status strip: the six things you ask before you look at a single bar.
 *
 * Everything here is a real state the simulation already keeps. Nothing is
 * derived for display alone, so a pip is never a lie about what the engine
 * thinks.
 */
export function StatusPips({
  wrestler,
  settings,
  titles,
}: {
  wrestler: Wrestler;
  settings: WorldSettings;
  titles?: readonly Title[];
}) {
  const held = (titles ?? []).filter((t) => !t.vacant && t.currentHolderIds.includes(wrestler.id));
  const align = ALIGNMENT[alignmentOf(wrestler)]!;
  const band = moodBand(wrestler.morale, settings);
  const moodTone =
    band === 'delighted' || band === 'happy'
      ? 'bg-emerald-950 text-emerald-300'
      : band === 'content'
        ? 'bg-lime-950 text-lime-300'
        : band === 'restless'
          ? 'bg-amber-950 text-amber-300'
          : 'bg-rose-950 text-rose-300';
  const moodGlyph =
    band === 'delighted' || band === 'happy' ? '☺' : band === 'content' || band === 'restless' ? '•' : '☹';

  // Worn out is two different things and the player cares about both: tonight's
  // tank, and the debt that does not clear between shows.
  const spent = wrestler.energy <= settings.miniTiredEnergy;
  const worn = wrestler.fatigueDebt >= settings.miniWornFatigue;
  const deal = wrestler.contract;
  const urgency = contractUrgency(deal);

  return (
    <div className="flex flex-wrap items-center gap-[3px]">
      {/* In the belt's own colours, because a company with three titles
          should not have three identical gold pips. */}
      {held.map((belt) => (
        <span
          key={belt.id}
          title={`${belt.name} — champion`}
          className="inline-flex h-[13px] shrink-0 items-center rounded px-[3px] text-[8px] font-bold leading-none"
          style={{ backgroundColor: belt.colorway.plate, color: belt.colorway.strap }}
        >
          ★ CHAMP
        </span>
      ))}

      {wrestler.injury && (
        <Pip
          tone="bg-rose-900 text-rose-100"
          title={`${wrestler.injury.description} — out ${wrestler.injury.weeksRemaining}w`}
        >
          ✚ {wrestler.injury.weeksRemaining}w
        </Pip>
      )}

      {!wrestler.injury && (spent || worn) && (
        <Pip
          tone="bg-amber-950 text-amber-300"
          title={worn ? 'Worked into the ground — this does not clear overnight' : 'Low on energy tonight'}
        >
          {worn ? '☾ WORN' : '☾ TIRED'}
        </Pip>
      )}

      <Pip tone={moodTone} title={`${moodLabel(band)}${wrestler.moraleNote ? ` — ${wrestler.moraleNote}` : ''}`}>
        {moodGlyph}
      </Pip>

      <Pip tone={align.tone} title={align.word}>
        {align.letter}
      </Pip>

      {deal && (
        <Pip
          tone={
            urgency === 'Expiring'
              ? 'bg-rose-950 text-rose-300'
              : urgency === 'Running down'
                ? 'bg-amber-950 text-amber-300'
                : 'bg-neutral-800 text-neutral-400'
          }
          title={`${urgency} — ${deal.weeksRemaining} weeks left on the deal`}
        >
          {deal.weeksRemaining}w
        </Pip>
      )}
      {!deal && (
        <Pip tone="bg-neutral-800 text-neutral-500" title="No contract">
          —
        </Pip>
      )}
    </div>
  );
}

/**
 * The mini profile: status first, then the meters, then where they stand in
 * the town this card is actually in.
 *
 * The local line is the reason this exists rather than a smaller StatBar. POP
 * is a national number, and the only thing a booker needs on the night is
 * whether this man draws *here*.
 */
export function MiniStats({
  wrestler,
  settings,
  titles,
  territoryId,
  territoryName,
  /** Six meters instead of eight, for the tightest rows. */
  compact = false,
  /** Drop the status strip, where the caller already shows it. */
  showStatus = true,
}: {
  wrestler: Wrestler;
  settings: WorldSettings;
  titles?: readonly Title[];
  territoryId?: Id;
  territoryName?: string;
  compact?: boolean;
  showStatus?: boolean;
}) {
  const meters = compact ? METERS.slice(0, 6) : METERS;
  const here = territoryId ? popularityIn(wrestler, territoryId, settings) : null;
  const gap = here === null ? 0 : here - wrestler.popularity;
  const homeTown = wrestler.homeTerritoryId === territoryId;

  return (
    <div className="flex w-full flex-col gap-[3px]">
      {showStatus && <StatusPips wrestler={wrestler} settings={settings} titles={titles} />}

      <div className="flex w-full flex-col gap-[2px]">
        {meters.map((meter) => (
          <Meter key={meter.key} label={meter.key} title={meter.title} value={meter.of(wrestler)} tone={meter.tone} />
        ))}
      </div>

      {here !== null && (
        <div
          className="flex items-center gap-1"
          title={`What ${wrestler.name} is worth in ${territoryName ?? 'this town'}, against their national profile`}
        >
          <span className="w-[22px] shrink-0 font-mono text-[8px] font-bold leading-none tracking-tight text-amber-600">
            HRE
          </span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${here}%` }} />
          </div>
          {Math.abs(gap) >= 2 && (
            <span
              className={`shrink-0 text-[8px] ${gap > 0 ? 'text-emerald-400' : 'text-rose-400'}`}
              aria-label={gap > 0 ? 'better here' : 'worse here'}
            >
              {gap > 0 ? '▲' : '▼'}
            </span>
          )}
          {homeTown && (
            <span className="shrink-0 text-[8px] font-bold text-amber-400" title="This is their hometown">
              HOME
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** How far the name carries, in words. Sits under the meters on a full card. */
export function ReachLine({ wrestler, settings }: { wrestler: Wrestler; settings: WorldSettings }) {
  const reach = reachOf(wrestler, settings);
  const tone =
    reach === 'national'
      ? 'text-emerald-400'
      : reach === 'regional'
        ? 'text-sky-400'
        : reach === 'local'
          ? 'text-amber-400'
          : 'text-neutral-500';
  return <span className={`text-[10px] ${tone}`}>{reachLabel(reach)}</span>;
}
