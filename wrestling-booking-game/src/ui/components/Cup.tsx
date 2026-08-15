// The Crucible: the invitation, and the morning after.
//
// The invitation states the fee, the field and the pot, and says nothing at all
// about your chances — §0, and doubly so here. You are paying a lot of money
// for a bracket you do not control, in which your best name can go out in the
// first round to somebody from a company you have never worked with.

import { useGameStore } from '../../state/store';
import { CUP_NAME, CUP_TROPHY } from '../../engine/world/cup';

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function CupPanel() {
  const world = useGameStore((s) => s.world);
  const answer = useGameStore((s) => s.answerCupEntry);
  const dismiss = useGameStore((s) => s.dismissCupResult);

  const invite = world?.pendingCupEntry ?? null;
  const result = world?.lastCup ?? null;

  if (result) {
    const ourWinner = result.winnerPromotionId === world!.promotion.id;
    return (
      <div
        className={`mb-3 rounded border p-3 ${
          ourWinner ? 'border-emerald-600 bg-emerald-950/30' : 'border-neutral-700 bg-neutral-900'
        }`}
      >
        <div className="text-[10px] uppercase tracking-wide text-neutral-400">
          {CUP_NAME} · {result.year}
        </div>
        <h2
          className={`mt-0.5 text-sm font-semibold ${
            ourWinner ? 'text-emerald-300' : 'text-neutral-200'
          }`}
        >
          {result.line}
        </h2>
        <p className="mt-1 text-[11px] text-neutral-400">
          {result.winnerName} carries {CUP_TROPHY} until somebody takes it off them.
        </p>

        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <Stat label="Pot" value={money(result.purse.pot)} />
          <Stat label="Rounds" value={`${result.rounds}`} />
          <Stat label={`${result.winnerName} took`} value={money(result.purse.wrestlerShare)} />
          <Stat
            label={`${result.winnerPromotionName} took`}
            value={money(result.purse.companyShare)}
          />
        </div>

        <div className="mt-2 max-h-40 overflow-y-auto rounded bg-neutral-950/60 p-2">
          {result.bouts
            .slice()
            .reverse()
            .map((bout, i) => {
              const loser = bout.winnerId === bout.aId ? bout.bId : bout.aId;
              return (
                <div key={`${bout.round}-${i}`} className="flex justify-between gap-2 py-0.5 text-[10px]">
                  <span className="text-neutral-500">{bout.roundLabel}</span>
                  <span className="truncate text-neutral-300">
                    {world!.wrestlers[bout.winnerId]?.name ?? '—'}
                    <span className="text-neutral-600"> def. </span>
                    {world!.wrestlers[loser]?.name ?? '—'}
                  </span>
                </div>
              );
            })}
        </div>

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

  if (!invite) return null;

  const canAfford = (world?.promotion.bankBalance ?? 0) >= invite.fee;

  return (
    <div className="mb-3 rounded border border-emerald-600 bg-emerald-950/25 p-3">
      <div className="text-[10px] uppercase tracking-wide text-emerald-300/80">
        {CUP_NAME} · {invite.year}
      </div>
      <h2 className="mt-0.5 text-sm font-semibold text-emerald-200">
        One bracket. One winner. The Iron Crown for a year.
      </h2>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <Stat label="Entry" value={money(invite.fee)} />
        <Stat label="Already in" value={`${invite.likelyField} companies`} />
        <Stat label="You may enter" value={`${invite.slotsEach} ${invite.slotsEach === 1 ? 'name' : 'names'}`} />
        <Stat label="Pot" value={money(invite.estimatedPot)} />
      </div>

      <p className="mt-2 text-[11px] text-neutral-400">
        Half the pot to the winner, half to the company that owns them. The whole card is the
        bracket and no titles are on it. The more companies buy in, the fewer names each of them
        brings.
      </p>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={!canAfford}
          onClick={() => answer(true)}
          className={`flex-1 rounded px-3 py-2 text-xs font-semibold ${
            canAfford ? 'bg-emerald-600 text-black' : 'bg-neutral-800 text-neutral-600'
          }`}
        >
          {canAfford ? 'Pay the entry' : 'You cannot cover it'}
        </button>
        <button
          type="button"
          onClick={() => answer(false)}
          className="flex-1 rounded bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-300"
        >
          Sit it out
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
