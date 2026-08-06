// Show results — §21. Locked rule: "Results appear at the end of the show,
// all at once. Not match by match." So this screen renders the completed
// show in one pass, and the player reads it.
//
// Each segment gets its highlight write-up (§11.5, 3-5 lines, never a
// play-by-play) and its rating breakdown panel, which is the one numeric
// surface in the game.

import { useGameStore } from '../../state/store';
import { sortWire, WIRE_KIND_LABELS } from '../../engine/world/wire';
import { stipulationById } from '../../data/stipulations';
import { incidentById } from '../../data/incidents';
import { showLede } from '../../engine/world/newsfeed';
import { billedAs } from '../../engine/generate/nickname';
import { Stars, BreakdownPanel, Money, HeatBadge } from '../components/display';
import { PaperDoll } from '../paperdoll/PaperDoll';
import type { FinishType, Show, Wrestler } from '../../engine/types';

const FINISH_TEXT: Record<FinishType, string> = {
  cleanPin: 'by pinfall',
  submission: 'by submission',
  knockout: 'by knockout',
  rollup: 'with a roll-up',
  interference: 'after interference',
  disqualification: 'by disqualification',
  countOut: 'by count-out',
  timeLimitDraw: 'time-limit draw',
  doubleKO: 'double knockout',
  refereeStoppage: 'referee stoppage',
  injuryStoppage: 'stopped through injury',
};

export function ShowResults({ show, onContinue }: { show: Show; onContinue: () => void }) {
  const world = useGameStore((s) => s.world);
  if (!world) return null;

  // The announcer uses the nickname when there is one — that is the whole
  // point of having earned it.
  const wrestlerName = (id: string) => {
    const w = world.wrestlers[id];
    return w ? billedAs(w) : 'Someone';
  };
  const booked = show.segments.filter((s) => s.kind !== 'promo' && s.result !== null);
  const promos = show.segments.filter((s) => s.kind === 'promo' && s.promoResult);

  // What the night led with. Everything below is the detail behind it.
  const namesOf = (ids: readonly string[]) => ids.map(wrestlerName);
  const best = [...booked].sort((a, b) => b.result!.rating - a.result!.rating)[0];
  const lede = showLede({
    titleChanges: booked.flatMap((segment) =>
      segment.result!.titleChanged
        ? segment.titleIds
            .map((id) => world.titles.find((t) => t.id === id))
            .filter((t): t is NonNullable<typeof t> => Boolean(t))
            .map((title) => ({ titleName: title.name, championNames: namesOf(title.currentHolderIds) }))
        : [],
    ),
    incidents: [
      ...booked.map((segment) => segment.result!.incident?.headline).filter((h): h is string => Boolean(h)),
      // Somebody being carried out is the story of the night, whatever else
      // happened on it.
      ...booked.flatMap((segment) =>
        segment
          .result!.injuries.filter((hurt) => hurt.outFor.includes('months') || hurt.outFor.includes('indefinitely'))
          .map((hurt) => `${hurt.name} is ${hurt.outFor}. ${hurt.text}`),
      ),
    ],
    bestMatch: best
      ? {
          winnerNames: namesOf(best.result!.winnerWrestlerIds),
          loserNames: namesOf(
            best.participants
              .filter((p) => !best.result!.winnerWrestlerIds.includes(p.wrestlerId))
              .map((p) => p.wrestlerId),
          ),
          stars: best.result!.stars,
        }
      : null,
    showRating: show.showRating,
    showStars: show.showStars,
    settings: world.settings,
  });

  return (
    <div className="p-3 pb-24 text-neutral-100">
      <header className="mb-4 rounded border border-neutral-800 bg-neutral-900 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            {show.type === 'ppv' && (
              <div className="text-[10px] uppercase tracking-wide text-amber-500">Pay-per-view</div>
            )}
            <h1 className={`text-base font-semibold ${show.type === 'ppv' ? 'text-amber-400' : ''}`}>
              {show.name ?? `Week ${show.week} — results`}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <Stars stars={show.showStars} />
              <span className="text-xs text-neutral-500">show rating</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onContinue}
            className="shrink-0 rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Next week
          </button>
        </div>

        <ul className="mt-3 flex flex-col gap-1" data-testid="show-lede">
          {lede.map((item) => (
            <li
              key={item.text}
              className={`text-sm leading-snug ${
                item.kind === 'titleChange'
                  ? 'font-medium text-amber-400'
                  : item.kind === 'incident'
                    ? 'text-rose-300'
                    : 'text-neutral-300'
              }`}
            >
              {item.text}
            </li>
          ))}
        </ul>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          <Stat label="Attendance" value={show.attendance.toLocaleString()} />
          <Stat label="Gate" value={<Money amount={show.gate} />} />
          <Stat label="Payroll" value={<Money amount={-show.payroll} />} />
          <Stat label="Bank" value={<Money amount={world.promotion.bankBalance} />} />
          {show.type === 'ppv' && (
            <>
              <Stat label="Buys" value={(show.buys ?? 0).toLocaleString()} />
              <Stat label="From buys" value={<Money amount={show.buyRevenue ?? 0} />} />
            </>
          )}
        </dl>
      </header>

      <div className="flex flex-col gap-3">
        {booked.map((segment) => {
          const result = segment.result!;
          const stipulation = segment.stipulation ? stipulationById(segment.stipulation) : null;
          const winners = result.winnerWrestlerIds.map(wrestlerName);
          const losers = segment.participants
            .filter((p) => !result.winnerWrestlerIds.includes(p.wrestlerId))
            .map((p) => world.wrestlers[p.wrestlerId])
            .filter((w): w is Wrestler => Boolean(w));

          return (
            <article key={segment.slot} className="rounded border border-neutral-800 bg-neutral-900 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm">
                    {segment.participants
                      .map((p) => wrestlerName(p.wrestlerId))
                      .join(result.winnerSide === null ? ' vs ' : ' vs ')}
                  </div>
                  {stipulation && <div className="text-[11px] text-sky-400">{stipulation.name}</div>}
                  {/* Who counted it, named beside the match the way a boxing
                      card names its referee before the bell. */}
                  {result.officialName && (
                    <div className="text-[11px] text-neutral-500">Referee: {result.officialName}</div>
                  )}
                  {segment.titleIds.length > 0 && (
                    <div className="text-[11px] text-amber-400">
                      {segment.titleIds
                        .map((id) => world.titles.find((t) => t.id === id)?.name)
                        .filter(Boolean)
                        .join(' & ')}
                      {result.titleChanged && <span className="ml-1 font-bold">— NEW CHAMPION</span>}
                    </div>
                  )}
                </div>
                <Stars stars={result.stars} />
              </div>

              <p className="mb-2 text-sm text-neutral-300">
                {result.winnerSide === null ? (
                  <>Went to a {FINISH_TEXT[result.finish]}.</>
                ) : (
                  <>
                    <span className="font-medium text-emerald-400">{winners.join(' & ')}</span> beat{' '}
                    {losers.map((w) => w.name).join(' & ')} {FINISH_TEXT[result.finish]}.
                  </>
                )}
              </p>

              {result.beats.filter((b) => b.significant).length > 0 && (
                <ul className="mb-2 flex flex-col gap-0.5 border-l-2 border-neutral-800 pl-3 text-xs text-neutral-400">
                  {result.beats
                    .filter((b) => b.significant)
                    .map((beat, i) => (
                      <li key={i}>{beat.text}</li>
                    ))}
                </ul>
              )}

              {/* What the official missed. Same rule as the injuries below:
                  if a cheap referee changed the match, the match says so, by
                  name, rather than the player wondering why the finish was
                  odd. */}
              {(result.refereeMisses ?? []).length > 0 && (
                <div className="mb-2 flex flex-col gap-1">
                  {(result.refereeMisses ?? []).map((miss, i) => (
                    <div
                      key={`${miss.refereeId}-${i}`}
                      data-testid={`referee-miss-${miss.refereeId}`}
                      className="rounded border border-sky-900/60 bg-sky-950/20 px-2 py-1.5"
                    >
                      <div className="text-[10px] uppercase tracking-wide text-sky-500">The official</div>
                      <p className="text-xs text-neutral-200">{miss.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Nothing happens to a person off-screen — CLAUDE.md. If
                  somebody got hurt in this match, this is where the player
                  finds out, not by spotting an icon on a roster card later. */}
              {result.injuries.length > 0 && (
                <div className="mb-2 flex flex-col gap-1">
                  {result.injuries.map((hurt, i) => (
                    <div
                      key={`${hurt.wrestlerId}-${i}`}
                      data-testid={`injury-${hurt.wrestlerId}`}
                      className="rounded border border-amber-900/60 bg-amber-950/20 px-2 py-1.5"
                    >
                      <div className="text-[10px] uppercase tracking-wide text-amber-500">
                        {hurt.role === 'competitor' ? 'Injury' : `Injury — ${hurt.role === 'manager' ? 'manager' : 'official'}`}
                      </div>
                      <p className="text-xs text-neutral-200">{hurt.text}</p>
                      <p className="text-[11px] text-neutral-500">{hurt.name} is {hurt.outFor}.</p>
                    </div>
                  ))}
                </div>
              )}

              {/* After the beats, because it is what happened next. */}
              {result.incident && (
                <div
                  data-testid={`incident-${segment.slot}`}
                  className="mb-2 rounded border border-rose-900/60 bg-rose-950/20 px-2 py-1.5"
                >
                  <div className="text-[10px] uppercase tracking-wide text-rose-400">
                    {incidentById(result.incident.id)?.kind ?? 'What happened next'}
                  </div>
                  <p className="text-xs text-neutral-200">{result.incident.headline}</p>
                </div>
              )}

              <details>
                <summary className="cursor-pointer text-[11px] text-neutral-500 hover:text-neutral-300">
                  Why it rated what it did
                </summary>
                <div className="mt-2">
                  <BreakdownPanel breakdown={result.ratingBreakdown} rating={result.rating} />
                </div>
              </details>
            </article>
          );
        })}

        {booked.length === 0 && (
          <p className="rounded border border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-neutral-500">
            You ran a show with nothing on it. The rating reflects that.
          </p>
        )}
      </div>

      {promos.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-300">On the microphone</h2>
          <div className="flex flex-col gap-1.5">
            {promos.map((slot, i) => (
              <article
                key={i}
                data-testid={`promo-result-${i}`}
                className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[11px] font-medium text-neutral-400">
                    {slot.promoSpeakerId ? wrestlerName(slot.promoSpeakerId) : 'Somebody'}
                  </span>
                  <Stars stars={Math.max(0.5, Math.round((slot.promoResult!.quality / 20) * 2) / 2)} />
                </div>
                <p className="text-xs text-neutral-200">{slot.promoResult!.text}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <FanReaction />
      <TheWire />
      <AroundTheBusiness />
      <ElsewhereTonight />
      <RivalryDigest />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

/**
 * What the fans made of it.
 *
 * Deliberately not a scoreboard — the show already has a star rating. This is
 * the *texture* of that rating: who they thought carried it, who they want
 * gone, and what they are asking for next week. There is always somebody
 * disagreeing with the room, because there always is.
 */
function FanReaction() {
  const world = useGameStore((s) => s.world);
  if (!world?.lastFanReaction) return null;
  const { verdict, tweets } = world.lastFanReaction;

  return (
    <section className="mt-4">
      <h2 className="mb-1 text-sm font-medium text-neutral-300">The fans</h2>
      <p className="mb-2 text-[11px] text-neutral-500">{verdict}</p>
      <div className="flex flex-col gap-1">
        {tweets.map((tweet) => (
          <article
            key={tweet.handle}
            data-testid={`tweet-${tweet.handle}`}
            className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[11px] font-medium text-sky-400">@{tweet.handle}</span>
              <span className="shrink-0 text-[10px] text-neutral-600">
                {tweet.likes >= 1000 ? `${(tweet.likes / 1000).toFixed(1)}k` : tweet.likes} ♥
              </span>
            </div>
            <p className="text-xs text-neutral-200">{tweet.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * The things nobody booked, from everywhere. The player's own are already
 * inline under the match they happened in — this is the rest of the business,
 * because a partnership breaking up in somebody else's main event is news the
 * week it happens, not a thing you find out about from a rankings table
 * three months later.
 */
function AroundTheBusiness() {
  const world = useGameStore((s) => s.world);
  if (!world) return null;
  const elsewhere = world.lastIncidents.filter((entry) => entry.promotionId !== world.promotion.id);
  if (elsewhere.length === 0) return null;

  return (
    <section className="mt-4">
      <h2 className="mb-2 text-sm font-medium text-neutral-300">Around the business</h2>
      <div className="flex flex-col gap-1.5">
        {elsewhere.map((entry) => (
          <article
            key={`${entry.promotionId}-${entry.incident.id}`}
            data-testid={`elsewhere-incident-${entry.promotionId}`}
            className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[11px] font-medium text-neutral-400">{entry.promotionName}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-rose-400">
                {incidentById(entry.incident.id)?.kind}
              </span>
            </div>
            <p className="text-xs text-neutral-200">{entry.incident.headline}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * Everything that happened to anybody this week.
 *
 * The results page used to cover the card and nothing else, so a death, a
 * retirement, a team splitting up or a rival signing the man you released all
 * went unmentioned until — at best — the December digest. This is the section
 * that keeps CLAUDE.md's promise for all of it.
 */
function TheWire() {
  const world = useGameStore((s) => s.world);
  if (!world || world.weeklyNews.length === 0) return null;
  const items = sortWire(world.weeklyNews);

  return (
    <section className="mt-4">
      <h2 className="mb-2 text-sm font-medium text-neutral-300">This week in the business</h2>
      <div className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <article
            key={`${item.kind}-${i}`}
            data-testid={`wire-${item.kind}`}
            className={`rounded border px-2 py-1.5 ${
              item.weight === 'lead'
                ? 'border-amber-900/60 bg-amber-950/20'
                : 'border-neutral-800 bg-neutral-900'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wide text-neutral-500">
              {WIRE_KIND_LABELS[item.kind]}
            </div>
            <p className={`text-xs ${item.weight === 'lead' ? 'text-amber-200' : 'text-neutral-200'}`}>
              {item.text}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * What everybody else ran. The player never sees another promotion's full
 * card — you find out what the competition did the way a real booker did, by
 * hearing what the main event was and what it drew.
 */
function ElsewhereTonight() {
  const world = useGameStore((s) => s.world);
  if (!world || world.rivalShows.length === 0) return null;

  const shows = [...world.rivalShows].sort((a, b) => b.showRating - a.showRating);

  return (
    <section className="mt-4">
      <h2 className="mb-2 text-sm font-medium text-neutral-300">Elsewhere tonight</h2>
      <div className="flex flex-col gap-1.5">
        {shows.map((show) => {
          const promotion = world.rivals.find((r) => r.id === show.promotionId);
          const mainEvent = show.matches[show.matches.length - 1];
          if (!promotion || !mainEvent) return null;

          const names = mainEvent.participantIds.map((id) => world.wrestlers[id]?.name ?? '?');
          const changed = show.matches.flatMap((m) =>
            m.titleOutcomes.filter((o) => o.changed).map((o) => world.titles.find((t) => t.id === o.titleId)),
          );

          return (
            <div
              key={show.promotionId}
              data-testid={`rival-show-${show.promotionId}`}
              className="rounded border border-neutral-800 bg-neutral-900 p-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-medium">{promotion.name}</span>
                <Stars stars={show.showStars} />
              </div>
              <div className="truncate text-[11px] text-neutral-500">{names.join(' vs ')}</div>
              {changed.map(
                (title) =>
                  title && (
                    <div key={title.id} className="text-[11px] text-amber-400">
                      New {title.name}:{' '}
                      {title.currentHolderIds.map((id) => world.wrestlers[id]?.name).filter(Boolean).join(' & ')}
                    </div>
                  ),
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** What the night did to the feuds — the part that carries into next week. */
function RivalryDigest() {
  const world = useGameStore((s) => s.world);
  if (!world) return null;

  const live = world.rivalries.filter((r) => r.resolvedWeek === null && (r.heat > 0 || r.shootHeat > 0));
  if (live.length === 0) return null;

  return (
    <section className="mt-4">
      <h2 className="mb-2 text-sm font-medium text-neutral-300">Running feuds</h2>
      <div className="flex flex-col gap-1.5">
        {live.map((rivalry) => {
          const people = rivalry.participantIds.map((id) => world.wrestlers[id]).filter((w): w is Wrestler => Boolean(w));
          return (
            <div key={rivalry.id} className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-900 p-2">
              <div className="flex -space-x-2">
                {people.map((w) => (
                  <PaperDoll key={w.id} appearance={w.appearance} gender={w.gender} alignment={w.alignment} size="thumb" />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs">{people.map((w) => w.name).join(' vs ')}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                  <HeatBadge heat={rivalry.heat} shootHeat={rivalry.shootHeat} />
                  {rivalry.origin === 'shoot' && (
                    <span className="text-[10px] text-neutral-600">not your idea</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

