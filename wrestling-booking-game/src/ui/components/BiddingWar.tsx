// The bidding war, as the booker experiences it.
//
// Three states, one panel, sitting at the top of the booking screen because a
// star reaching the open market is the biggest thing on the card page that
// week:
//
//   invited   do you want in? Saying no is final.
//   bidding   compose one offer. No hint about whether it is enough.
//   settled   what everybody actually offered, and who won.
//
// What is deliberately NOT here: any indication of how likely you are to win.
// No bar, no words, no "they'll probably beat that". §0 says stats are bars
// and odds are words and the game never warns before a bad decision — and the
// whole point of a blind one-shot auction is that you are guessing. Showing
// the field's appetite would turn it into arithmetic.
//
// What IS here is everything you could work out yourself if you knew the
// person: their age, what they have been asking for, how banged up they are.
// The counter to a rival with deeper pockets is reading them better, so the
// screen shows you what there is to read.

import { useMemo, useState } from 'react';
import { useGameStore } from '../../state/store';
import { CLAUSE_LADDER, clauseLabel } from '../../engine/career/ego';
import { askingRate } from '../../engine/economy/contracts';
import { clauseAppeal, stanceToward } from '../../engine/economy/bidding';
import { moodLabel, moodBand } from '../../engine/career/morale';
import type { Clause } from '../../engine/types';
import { PaperDoll } from '../paperdoll/PaperDoll';

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export function BiddingWarPanel() {
  const world = useGameStore((s) => s.world);
  const answer = useGameStore((s) => s.answerBiddingInvitation);
  const submit = useGameStore((s) => s.submitBid);
  const dismiss = useGameStore((s) => s.dismissBiddingResult);

  const war = world?.pendingBiddingWar ?? null;
  const last = world?.lastBiddingWar ?? null;
  const subject = war ? world!.wrestlers[war.wrestlerId] : null;

  const base = useMemo(
    () => (subject && world ? askingRate(subject, world.settings) : 0),
    [subject, world],
  );

  const [rate, setRate] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [weeks, setWeeks] = useState(0);
  const [clauses, setClauses] = useState<Clause[]>([]);
  // The offer sheet opens at the asking rate, which is the one number the
  // office genuinely knows. Everything above it is the booker's guess.
  const [primed, setPrimed] = useState<string | null>(null);
  if (war && war.stage === 'bidding' && primed !== war.id) {
    setPrimed(war.id);
    // Opens at the number their people named, because that is the one figure
    // in this whole screen that is not a guess.
    setRate(war.minimum);
    setBonus(0);
    setWeeks(world!.settings.biddingMinWeeks * 2);
    setClauses([]);
  }

  if (!world) return null;

  // ---- the result, shown once ---------------------------------------------
  if (!war && last?.result) {
    const { war: settled, result } = last;
    const wonIt = result.winningPromotionId === world.promotion.id;
    return (
      <section
        data-testid="bidding-result"
        className={`mb-3 rounded border p-3 ${wonIt ? 'border-emerald-700 bg-emerald-950/30' : 'border-neutral-700 bg-neutral-900'}`}
      >
        <div className="text-[10px] uppercase tracking-wide text-neutral-400">
          {settled.reason === 'phenom' ? 'Out of the school' : 'The open market'}
        </div>
        <h2 className={`text-sm font-semibold ${wonIt ? 'text-emerald-300' : 'text-neutral-200'}`}>
          {wonIt ? `You signed ${settled.wrestlerName}` : `${result.winningPromotionName} signed ${settled.wrestlerName}`}
        </h2>
        <p className="mt-1 text-sm text-neutral-300">{result.swungIt}</p>

        {/* Every offer, revealed. This is the only moment the player ever sees
            what the room was actually willing to pay — and it is after the
            fact, which is the point. */}
        <div className="mt-2 flex flex-col gap-1">
          {result.allBids.map((bid) => {
            const won = bid.promotionId === result.winningPromotionId;
            return (
              <div
                key={bid.promotionId}
                className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded px-2 py-1 text-[11px] ${
                  won ? 'bg-emerald-950/60 text-emerald-200' : 'bg-neutral-950/60 text-neutral-400'
                }`}
              >
                <span className="font-medium">{bid.promotionName}</span>
                <span>{money(bid.weeklyRate)}/wk</span>
                {bid.signingBonus > 0 && <span>· {money(bid.signingBonus)} up front</span>}
                <span>· {bid.weeks}w</span>
                {bid.clauses.length > 0 && (
                  <span className="text-neutral-500">· {bid.clauses.map(clauseLabel).join(', ')}</span>
                )}
              </div>
            );
          })}
        </div>

        {result.vetoed.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            <div className="text-[10px] uppercase tracking-wide text-rose-400">Never in it</div>
            {result.vetoed.map((entry) => (
              <div key={entry.bid.promotionId} className="rounded bg-rose-950/40 px-2 py-1 text-[11px] text-rose-200/80">
                <span className="font-medium">{entry.bid.promotionName}</span> — {entry.reason}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={dismiss}
          className="mt-3 rounded bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700"
        >
          Right
        </button>
      </section>
    );
  }

  if (!war || !subject) return null;

  const bank = world.promotion.bankBalance;
  const weeklyOverAsk = base > 0 ? rate / base : 1;
  const myRoster = world.promotion.rosterIds
    .map((id) => world.wrestlers[id])
    .filter((w): w is NonNullable<typeof w> => Boolean(w));
  const stance = stanceToward(subject, world.promotion.id, myRoster, world.relationships, world.settings);

  // ---- the invitation -----------------------------------------------------
  if (war.stage === 'invited') {
    return (
      <section
        data-testid="bidding-invite"
        className="mb-3 rounded border border-amber-700 bg-amber-950/30 p-3"
      >
        {/* The one moment in the game that gets to be loud about it — a real
            star just hit the open market. Every other panel in this file
            leads with a quiet all-caps eyebrow; this one leads with the
            marquee. */}
        <div
          data-testid="bidding-war-banner"
          className="mb-2 text-center text-2xl font-extrabold uppercase tracking-widest text-amber-400 [text-shadow:0_0_12px_rgba(251,191,36,0.5)]"
        >
          Bidding War
        </div>
        <div className="text-[10px] uppercase tracking-wide text-amber-500">
          {war.round > 1
            ? 'They have sent the room away'
            : war.reason === 'phenom'
              ? 'The schools have turned out somebody'
              : war.reason === 'foldPickup'
                ? 'A folded promotion left this one loose'
                : 'A name has hit the open market'}
        </div>
        {war.reBidReason && (
          <p className="mt-1 rounded bg-rose-950/40 px-2 py-1 text-xs text-rose-200">{war.reBidReason}</p>
        )}
        <div className="mt-2 flex gap-3">
          <div className="shrink-0">
            <PaperDoll photoDataUrl={subject.photoDataUrl} name={subject.name} size="bust" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-amber-200">{subject.name}</h2>
            <p className="mt-1 text-sm text-amber-100">
              {war.reason === 'phenom'
                ? `${subject.age} years old, fresh out of the school this week, and already able to flat-out work. ${war.rivalIds.length} other companies want them badly.`
                : war.reason === 'foldPickup'
                  ? `${subject.name}'s promotion just closed its doors for good. ${war.rivalIds.length} other ${war.rivalIds.length === 1 ? 'company wants' : 'companies want'} them exactly as much as you do.`
                  : `${subject.name}'s deal is up and they are absolutely not re-signing quietly. ${war.rivalIds.length} other companies are already in on this.`}
            </p>
            <p className="mt-2 text-sm font-medium text-amber-200">
              Their people have named a number, loud and clear: nothing under {money(war.minimum)} a week even
              gets read.
            </p>
            <p className="mt-1 text-xs text-amber-300/90">
              How you get there — the rate, money up front, whatever else you put on the table — is entirely up
              to you. Everybody submits one offer, nobody sees anybody else&apos;s, and they pick. Stay out of
              this and you are out, full stop.
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            data-testid="bidding-join"
            onClick={() => answer(true)}
            className="rounded bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500"
          >
            Make an offer
          </button>
          <button
            type="button"
            data-testid="bidding-pass"
            onClick={() => answer(false)}
            className="rounded border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500"
          >
            Stay out of it
          </button>
        </div>
      </section>
    );
  }

  // ---- the offer sheet ----------------------------------------------------
  const available = CLAUSE_LADDER.filter((entry) => subject.ego >= entry.egoRequired);
  const weeklyClauseHint = (clause: Clause) => CLAUSE_LADDER.find((e) => e.clause === clause)?.cost ?? '';

  return (
    <section data-testid="bidding-sheet" className="mb-3 rounded border border-amber-700 bg-amber-950/20 p-3">
      <div
        data-testid="bidding-war-banner"
        className="mb-2 text-center text-2xl font-extrabold uppercase tracking-widest text-amber-400 [text-shadow:0_0_12px_rgba(251,191,36,0.5)]"
      >
        Bidding War
      </div>
      <div className="text-[10px] uppercase tracking-wide text-amber-500">Your one offer</div>
      <div className="mt-2 flex gap-3">
        <div className="shrink-0">
          <PaperDoll photoDataUrl={subject.photoDataUrl} name={subject.name} size="bust" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-amber-200">{subject.name}</h2>
          {/* Everything a booker could work out for themselves. Not a hint
              about the bid — a description of the person you are bidding on. */}
          <p className="text-[11px] text-neutral-400">
            {subject.age} years old · {moodLabel(moodBand(subject.morale, world.settings))}
            {subject.health < 60 && <span className="text-rose-300"> · carrying damage</span>}
            {subject.ego >= 70 && <span className="text-amber-300"> · knows what they are worth</span>}
          </p>
          <p className="mt-1 text-[11px] text-amber-300">
            Nothing under {money(war.minimum)} a week gets read.
          </p>
          {/* Who is in your building, and what it does to your price. Not a
              hint about the bid — a fact about the person, the kind any
              booker would know from a phone call. */}
          {stance.reason && (
            <p
              className={`mt-1 text-[11px] ${
                stance.stance === 'refuses'
                  ? 'font-medium text-rose-300'
                  : stance.stance === 'premium'
                    ? 'text-amber-300'
                    : 'text-emerald-300'
              }`}
            >
              {stance.stance === 'refuses' ? '✕ ' : stance.stance === 'discount' ? '✓ ' : '! '}
              {stance.reason}
              {stance.stance === 'discount' && ' — they would take less to be here'}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between text-xs text-neutral-300">
            <span>Weekly rate</span>
            <span className="font-mono text-amber-300">{money(rate)}</span>
          </span>
          <input
            type="range"
            data-testid="bid-rate"
            min={war.minimum}
            max={Math.max(war.minimum + 25, Math.round(base * 3))}
            step={25}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="accent-amber-500"
          />
          <span className="text-[10px] text-neutral-500">
            {rate <= war.minimum
              ? `Exactly the number they named.`
              : weeklyOverAsk >= 1.5
                ? 'Well over what they are asking.'
                : weeklyOverAsk >= 1.05
                  ? 'Above what they are asking.'
                  : 'About what they are asking.'}
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between text-xs text-neutral-300">
            <span>Signing bonus</span>
            <span className="font-mono text-amber-300">{money(bonus)}</span>
          </span>
          <input
            type="range"
            data-testid="bid-bonus"
            min={0}
            max={Math.max(1000, Math.min(bank, Math.round(base * 40)))}
            step={500}
            value={bonus}
            onChange={(e) => setBonus(Number(e.target.value))}
            className="accent-amber-500"
          />
          <span className="text-[10px] text-neutral-500">
            Paid the day they sign. You have {money(bank)}.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between text-xs text-neutral-300">
            <span>Length of deal</span>
            <span className="font-mono text-amber-300">{weeks} weeks</span>
          </span>
          <input
            type="range"
            data-testid="bid-weeks"
            min={world.settings.biddingMinWeeks}
            max={world.settings.biddingMaxWeeks}
            step={13}
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="accent-amber-500"
          />
        </label>

        {available.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-neutral-300">What else you are putting on the table</span>
            <div className="flex flex-col gap-1">
              {available.map((entry) => {
                const on = clauses.includes(entry.clause);
                // How much this particular person cares. Shown as a word,
                // never a number — and it is a read on *them*, not a read on
                // whether your offer beats the room.
                const appeal = clauseAppeal(entry.clause, subject, world.settings);
                const wants = appeal >= 0.66 ? 'wants this' : appeal >= 0.33 ? 'might like this' : 'is indifferent';
                return (
                  <button
                    key={entry.clause}
                    type="button"
                    data-testid={`bid-clause-${entry.clause}`}
                    onClick={() =>
                      setClauses((current) =>
                        current.includes(entry.clause)
                          ? current.filter((c) => c !== entry.clause)
                          : [...current, entry.clause],
                      )
                    }
                    className={`rounded border p-2 text-left ${
                      on ? 'border-amber-500 bg-amber-950/50' : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-neutral-200">{entry.label}</span>
                      <span
                        className={`shrink-0 text-[10px] ${
                          appeal >= 0.66 ? 'text-emerald-400' : appeal >= 0.33 ? 'text-amber-400' : 'text-neutral-600'
                        }`}
                      >
                        {wants}
                      </span>
                    </div>
                    <div className="text-[10px] text-rose-300/70">{weeklyClauseHint(entry.clause)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Still submittable. §0 says the game never stops the player making a
          bad decision — it just does not pretend the decision is a good one. */}
      <button
        type="button"
        data-testid="bid-submit"
        onClick={() => submit({ weeklyRate: rate, signingBonus: bonus, weeks, clauses })}
        className="mt-3 w-full rounded bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500"
      >
        Submit it
      </button>
      <p className="mt-1 text-center text-[10px] text-neutral-500">
        One shot, no do-overs. You find out right along with everybody else.
      </p>
    </section>
  );
}
