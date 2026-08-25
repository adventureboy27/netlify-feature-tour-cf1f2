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
import { priceReactionLine } from '../../engine/economy/showBudget';
import { billedAs } from '../../engine/generate/nickname';
import { Stars, BreakdownPanel, Money, HeatBadge } from '../components/display';
import { Panel, SectionHead, Figure, BigStars, promotionTheme } from '../components/chrome';
import { Bout, VersusMark, type BoutSide } from '../components/Bout';
import { slotLabel } from '../cardLabels';
import { CallWindow } from '../components/CallWindow';
import { PaperDoll } from '../paperdoll/PaperDoll';
import type { FinishType, Show, Wrestler } from '../../engine/types';

const SHOW_TYPE_LABEL: Record<Show['type'], string> = {
  tvTaping: 'TV taping',
  ppv: 'Pay-per-view',
  houseShow: 'House show',
  charity: 'Charity show',
};

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
  escape: 'by escape',
  equipmentFailure: 'no-contest — the gear gave out',
};

export function ShowResults({
  show,
  onContinue,
  onWatch,
}: {
  show: Show;
  onContinue: () => void;
  /** Watch a decided match back — see `MatchViewerScreen`. */
  onWatch?: (slot: number) => void;
}) {
  const world = useGameStore((s) => s.world);
  if (!world) return null;

  // The announcer uses the nickname when there is one — that is the whole
  // point of having earned it.
  const wrestlerName = (id: string) => {
    const w = world.wrestlers[id];
    return w ? billedAs(w) : 'Someone';
  };
  const townName = world.territories.find((t) => t.id === show.territoryId)?.name ?? 'The town';
  const booked = show.segments.filter((s) => s.kind !== 'promo' && s.result !== null);
  const promos = show.segments.filter((s) => s.kind === 'promo' && s.promoResult);
  const confrontations = show.segments.filter((s) => s.kind === 'confrontation' && s.confrontationResult);

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

  const theme = promotionTheme(world.promotion.identity);

  return (
    <div className="p-3 pb-6 text-neutral-100">
      {/* The marquee.
          Everything below this is detail; this is the answer to the only
          question the player asked when they pressed the button. It used to
          be a 12px star string in the corner of a grey box the same size as
          the twenty grey boxes under it. */}
      <Panel elevation="hero" className={`overflow-hidden bg-gradient-to-b ${theme.wash} to-neutral-900`}>
        <div className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Week {show.week}
            <span className="mx-1.5 text-neutral-700">·</span>
            {show.type === 'ppv' ? (
              <span className="text-amber-500">Pay-per-view</span>
            ) : (
              SHOW_TYPE_LABEL[show.type]
            )}
            {/* An unnamed show puts the town in the headline instead, so the
                eyebrow does not say it twice. */}
            {show.name && (
              <>
                <span className="mx-1.5 text-neutral-700">·</span>
                {townName}
              </>
            )}
          </div>
          <h1 className={`mt-1 text-2xl font-bold leading-tight ${show.type === 'ppv' ? 'text-amber-300' : ''}`}>
            {show.name ?? `Live from ${townName}`}
          </h1>

          <div className="mt-3 flex items-end justify-between gap-3">
            <BigStars stars={show.showStars} />
            <button
              type="button"
              onClick={onContinue}
              className={`shrink-0 rounded-lg px-5 py-2.5 text-sm font-semibold text-white ${theme.action}`}
            >
              Next week →
            </button>
          </div>

          <ul className="mt-3 flex flex-col gap-1.5" data-testid="show-lede">
            {lede.map((item) => (
              <li
                key={item.text}
                className={`text-[15px] leading-snug ${
                  item.kind === 'titleChange'
                    ? 'font-semibold text-amber-300'
                    : item.kind === 'incident'
                      ? 'text-rose-300'
                      : 'text-neutral-300'
                }`}
              >
                {item.text}
              </li>
            ))}
          </ul>
        </div>

        {/* The night's money, on its own ground so it reads as a ledger
            rather than as four more sentences. */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-neutral-800 bg-neutral-950/60 px-4 py-3 sm:grid-cols-4">
          <Figure label="Attendance">{show.attendance.toLocaleString()}</Figure>
          <Figure label="Gate">
            <Money amount={show.gate} />
          </Figure>
          <Figure label="Payroll">
            <Money amount={-show.payroll} />
          </Figure>
          <Figure label="Bank">
            <Money amount={world.promotion.bankBalance} />
          </Figure>
          {show.type === 'ppv' && (
            <>
              <Figure label="Buys">{(show.buys ?? 0).toLocaleString()}</Figure>
              <Figure label="From buys">
                <Money amount={show.buyRevenue ?? 0} />
              </Figure>
            </>
          )}
        </dl>

        {/* What the town made of the price. After the fact, never before —
            the game does not talk anybody out of a decision, it just makes
            sure the cost is readable once it has been paid. */}
        {show.priceReaction && (
          <p
            data-testid="price-reaction"
            className={`border-t border-neutral-800 px-4 py-2 text-xs ${
              show.priceReaction === 'gouge'
                ? 'bg-red-950/30 text-red-300'
                : show.priceReaction === 'steep'
                  ? 'bg-amber-950/30 text-amber-300'
                  : 'text-neutral-500'
            }`}
          >
            {priceReactionLine(show.priceReaction, townName)}
          </p>
        )}
      </Panel>

      {/* Who was not in the building. Above the card, because it changed
          what the card was — and because a wrestler disappearing off a match
          without explanation is exactly what CLAUDE.md forbids. */}
      {(show.standIns ?? []).length > 0 && (
        <section data-testid="stand-ins">
          <SectionHead>Not in the building</SectionHead>
          <div className="flex flex-col gap-1.5">
            {(show.standIns ?? []).map((swap, i) => (
              <div key={i} className="rounded-lg border border-amber-900/60 bg-amber-950/20 px-2.5 py-2">
                <p className="text-xs text-neutral-200">{swap.reason}</p>
                <p className="mt-0.5 text-[11px] text-amber-300">
                  {swap.replacementName} went out there instead.
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <SectionHead hint={`${booked.length} ${booked.length === 1 ? 'match' : 'matches'}`}>The card</SectionHead>

      <div className="flex flex-col gap-3">
        {booked.map((segment) => {
          const result = segment.result!;
          const stipulation = segment.stipulation ? stipulationById(segment.stipulation) : null;
          const winners = result.winnerWrestlerIds.map(wrestlerName);
          const losers = segment.participants
            .filter((p) => !result.winnerWrestlerIds.includes(p.wrestlerId))
            .map((p) => world.wrestlers[p.wrestlerId])
            .filter((w): w is Wrestler => Boolean(w));

          // The corners, in side order, so the tableau matches the card.
          const sides: BoutSide[] = [...new Set(segment.participants.map((p) => p.side))]
            .filter((side) => side >= 0)
            .sort((a, b) => a - b)
            .map((side) => ({
              wrestlers: segment.participants
                .filter((p) => p.side === side && p.role === 'competitor')
                .map((p) => world.wrestlers[p.wrestlerId])
                .filter((w): w is Wrestler => Boolean(w)),
              won: result.winnerSide === null ? null : result.winnerSide === side,
            }))
            .filter((s) => s.wrestlers.length > 0);
          const titleNames = segment.titleIds
            .map((id) => world.titles.find((t) => t.id === id)?.name)
            .filter((n): n is string => Boolean(n));

          return (
            <Panel
              key={segment.slot}
              elevation="raised"
              className={`overflow-hidden ${result.titleChanged ? 'border-amber-700/70' : ''}`}
            >
              {/* The billing strip: where this sat on the card, what it was
                  for, and what it got. */}
              <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-950/60 px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                  {slotLabel(segment.slot, booked.length)}
                </span>
                {stipulation && <span className="truncate text-[11px] text-sky-400">{stipulation.name}</span>}
                <span className="ml-auto flex shrink-0 items-center gap-2">
                  {onWatch && (
                    <button
                      type="button"
                      data-testid={`watch-${segment.slot}`}
                      onClick={() => onWatch(segment.slot)}
                      className="rounded bg-neutral-800 px-2 py-1 text-[10px] font-semibold text-neutral-200 hover:bg-neutral-700"
                    >
                      ▶ Watch
                    </button>
                  )}
                  <Stars stars={result.stars} />
                </span>
              </div>

              {titleNames.length > 0 && (
                <div
                  className={`px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider ${
                    result.titleChanged
                      ? 'bg-amber-900/40 text-amber-200'
                      : result.finish === 'equipmentFailure'
                        ? 'bg-red-900/30 text-red-300'
                        : 'text-amber-500/80'
                  }`}
                >
                  {titleNames.join(' & ')}
                  {result.titleChanged && <span className="ml-1.5">— new champion</span>}
                  {result.finish === 'equipmentFailure' && <span className="ml-1.5">— vacated</span>}
                </div>
              )}

              <div className="px-3 pt-2">
                <Bout
                  sides={sides}
                  centre={
                    result.winnerSide === null ? <VersusMark>draw</VersusMark> : <VersusMark>def.</VersusMark>
                  }
                />
              </div>

              <div className="p-3 pt-2">
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

              {/* Who counted it, named beside the match the way a boxing card
                  names its referee before the bell. */}
              {result.officialName && (
                <p className="mb-2 text-[11px] text-neutral-500">Referee: {result.officialName}</p>
              )}

              {/* The call, if this was our show. A rival's night is a result
                  in a newspaper — nobody has a broadcast of it. */}
              {(result.commentary ?? []).length > 0 && (
                <CallWindow
                  lines={result.commentary ?? []}
                  matchLabel={`${winners.join(' & ')} vs ${losers.map((w) => w.name).join(' & ')}`}
                />
              )}

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
              </div>
            </Panel>
          );
        })}

        {booked.length === 0 && (
          <Panel className="p-6 text-center text-sm text-neutral-500">
            You ran a show with nothing on it. The rating reflects that.
          </Panel>
        )}
      </div>

      {promos.length > 0 && (
        <section>
          <SectionHead>On the microphone</SectionHead>
          <div className="flex flex-col gap-1.5">
            {promos.map((slot, i) => {
              const speaker = slot.promoSpeakerId ? world.wrestlers[slot.promoSpeakerId] : null;
              return (
                <Panel key={i} data-testid={`promo-result-${i}`} className="flex items-start gap-2 p-2">
                  {speaker && (
                    <PaperDoll
                      appearance={speaker.appearance}
                      gender={speaker.gender}
                      alignment={speaker.alignment}
                      size="thumb"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-neutral-300">
                        {speaker ? billedAs(speaker) : 'Somebody'}
                      </span>
                      <Stars stars={Math.max(0.5, Math.round((slot.promoResult!.quality / 20) * 2) / 2)} />
                    </div>
                    <p className="text-xs text-neutral-200">{slot.promoResult!.text}</p>
                  </div>
                </Panel>
              );
            })}
          </div>
        </section>
      )}

      {confrontations.length > 0 && (
        <section data-testid="confrontations">
          <SectionHead hint="two people and a microphone">Confrontations</SectionHead>
          <div className="flex flex-col gap-1.5">
            {confrontations.map((slot, i) => {
              const result = slot.confrontationResult!;
              const speaker = slot.promoSpeakerId ? world.wrestlers[slot.promoSpeakerId] : null;
              const opposite = slot.confrontationOppositeId
                ? world.wrestlers[slot.confrontationOppositeId]
                : null;
              return (
                <Panel key={i} data-testid={`confrontation-result-${i}`} className="overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-950/60 px-3 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                      {slot.confrontationVenue === 'backstage' ? 'Backstage' : 'In the ring'}
                    </span>
                    <span className="truncate text-[11px] text-sky-400">{result.twistLabel}</span>
                    <span className="ml-auto shrink-0">
                      <Stars stars={Math.max(0.5, Math.round((result.quality / 20) * 2) / 2)} />
                    </span>
                  </div>

                  {speaker && opposite && (
                    <div className="px-3 pt-2">
                      <Bout
                        sides={[
                          { wrestlers: [speaker], won: result.wonByName === speaker.name ? true : null },
                          { wrestlers: [opposite], won: result.wonByName === opposite.name ? true : null },
                        ]}
                        centre={<VersusMark>vs</VersusMark>}
                      />
                    </div>
                  )}

                  <p className="p-3 pt-2 text-sm leading-snug text-neutral-200">{result.text}</p>
                </Panel>
              );
            })}
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
    <section>
      <SectionHead hint={verdict}>The fans</SectionHead>
      <div className="flex flex-col gap-1">
        {tweets.map((tweet) => (
          <article
            key={tweet.handle}
            data-testid={`tweet-${tweet.handle}`}
            className="rounded-lg border-l-2 border-sky-800 bg-neutral-900/60 px-2.5 py-1.5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[11px] font-semibold text-sky-400">@{tweet.handle}</span>
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
    <section>
      <SectionHead>Around the business</SectionHead>
      <div className="flex flex-col gap-1.5">
        {elsewhere.map((entry) => (
          <article
            key={`${entry.promotionId}-${entry.incident.id}`}
            data-testid={`elsewhere-incident-${entry.promotionId}`}
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5"
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
    <section>
      <SectionHead>This week in the business</SectionHead>
      <div className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <article
            key={`${item.kind}-${i}`}
            data-testid={`wire-${item.kind}`}
            className={`rounded-lg border px-2.5 py-1.5 ${
              item.weight === 'lead'
                ? 'border-amber-800/70 bg-amber-950/30'
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
    <section>
      <SectionHead hint="what the competition ran">Elsewhere tonight</SectionHead>
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
              className="rounded-lg border border-neutral-800 bg-neutral-900 p-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-semibold">{promotion.name}</span>
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
    <section>
      <SectionHead hint="carries into next week">Running feuds</SectionHead>
      <div className="flex flex-col gap-1.5">
        {live.map((rivalry) => {
          const people = rivalry.participantIds.map((id) => world.wrestlers[id]).filter((w): w is Wrestler => Boolean(w));
          return (
            <div key={rivalry.id} className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-2">
              {/* Facing each other, because that is what a feud is. */}
              <div className="flex shrink-0">
                {people.map((w, i) => (
                  <PaperDoll
                    key={w.id}
                    appearance={w.appearance}
                    gender={w.gender}
                    alignment={w.alignment}
                    size="thumb"
                    flip={i > 0}
                  />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">{people.map((w) => w.name).join(' vs ')}</div>
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

