// The joint pay-per-view (§16): the offer, and the morning after.
//
// Two panels, both on the booking screen because that is where the booker
// already is when the week turns. The offer says what is on the table and what
// it is worth; §0 says the game does not warn you, so it states the terms and
// the upside and leaves the risk entirely unmentioned. You are agreeing to put
// your top act in a match you do not control.

import { useGameStore } from '../../state/store';

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function SupershowPanel() {
  const world = useGameStore((s) => s.world);
  const answer = useGameStore((s) => s.answerSupershow);
  const dismiss = useGameStore((s) => s.dismissSupershowResult);

  const offer = world?.pendingSupershow ?? null;
  const result = world?.lastSupershow ?? null;

  if (result) {
    const wonIt = result.verdict.margin > 0;
    const drew = result.verdict.margin === 0;
    return (
      <div
        className={`mb-3 rounded border p-3 ${
          drew
            ? 'border-neutral-700 bg-neutral-900'
            : wonIt
              ? 'border-emerald-700 bg-emerald-950/30'
              : 'border-red-800 bg-red-950/30'
        }`}
      >
        <div className="text-[10px] uppercase tracking-wide text-neutral-400">
          The joint show · with {result.partnerName}
        </div>
        <h2
          className={`mt-0.5 text-sm font-semibold ${
            drew ? 'text-neutral-200' : wonIt ? 'text-emerald-300' : 'text-red-300'
          }`}
        >
          {result.verdict.line}
        </h2>

        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <Stat label="Gate" value={money(result.purse.totalGate)} />
          <Stat label="Your end" value={money(result.purse.playerNet)} />
          <Stat label="Everybody on the card" value={money(result.purse.appearanceFee)} />
          <Stat label="Winners, on top" value={money(result.purse.winBonus)} />
        </div>

        <p className="mt-2 text-[11px] text-neutral-400">
          {Object.keys(result.payouts).length} people were paid. No titles changed hands — they
          never do on a card like this.
        </p>

        <button
          type="button"
          onClick={dismiss}
          className="mt-2 w-full rounded bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-200"
        >
          Done
        </button>
      </div>
    );
  }

  if (!offer) return null;

  const weeksLeft = Math.max(0, offer.expiresWeek - (world?.week ?? 0));

  return (
    <div className="mb-3 rounded border border-amber-700 bg-amber-950/25 p-3">
      <div className="text-[10px] uppercase tracking-wide text-amber-300/80">
        A joint pay-per-view
      </div>
      <h2 className="mt-0.5 text-sm font-semibold text-amber-200">
        {offer.partnerName} want to run with you
      </h2>
      <p className="mt-1 text-sm text-neutral-300">{offer.pitch}</p>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <Stat label="Card" value={`${offer.deal.cardSize} segments`} />
        <Stat label="Your share of the gate" value={`${Math.round(offer.deal.gateSplit * 100)}%`} />
        <Stat
          label="Hosting"
          value={offer.deal.hostPromotionId === world?.promotion.id ? 'You' : offer.partnerName}
        />
        <Stat
          label="Champion vs champion"
          value={offer.deal.championVsChampion ? 'Allowed' : 'They said no'}
        />
        {offer.deal.appearanceGuarantee > 0 && (
          <Stat label="Guarantee they want" value={money(offer.deal.appearanceGuarantee)} />
        )}
        <Stat label="You should clear" value={money(offer.estimatedNet)} />
      </div>

      <p className="mt-2 text-[11px] text-neutral-400">
        Both rosters, one card, and the belts stay where they are. They are on the table for{' '}
        {weeksLeft} more {weeksLeft === 1 ? 'week' : 'weeks'}.
      </p>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => answer(true)}
          className="flex-1 rounded bg-amber-600 px-3 py-2 text-xs font-semibold text-black"
        >
          Sign it
        </button>
        <button
          type="button"
          onClick={() => answer(false)}
          className="flex-1 rounded bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-300"
        >
          Pass
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="text-neutral-200">{value}</span>
    </div>
  );
}
