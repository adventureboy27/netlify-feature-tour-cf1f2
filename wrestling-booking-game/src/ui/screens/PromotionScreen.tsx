// Staging the show, and running the business — §14.
//
// The venue is the week's biggest bet: rent is committed before anybody buys
// a ticket. The screen shows the projection so the bet is informed, not
// blind — but the projection is what the *model* expects, and the card you
// booked, the events of the week and plain variance all move it afterwards.
//
// Production splits into things you buy once and haul everywhere, and things
// you pay for again every single time. Owned gear shows its upkeep, because
// nothing is free once bought.

import { useMemo, useState } from 'react';
import { useGameStore } from '../../state/store';
import { VENUES, venueById } from '../../data/venues';
import { PRODUCTION_ASSETS, SHOW_EXTRAS, productionAssetById, showExtraById } from '../../data/production';
import {
  computeShowCosts,
  computeAttendanceForShow,
  computeShowRevenue,
  turnedAway,
  sumEffect,
  computeDemand,
  assetEffectiveness,
  assetHasFailed,
  conditionLabel,
  repairCost,
} from '../../engine/economy/showBudget';
import { weeklyWageBill } from '../../engine/economy/contracts';
import { followingOf } from '../../engine/world/territories';
import { identityOf, PROMOTION_ARCHETYPES } from '../../data/promotionIdentity';
import { titlesOf } from '../../data/titles';
import { stipulationById } from '../../data/stipulations';
import { Money } from '../components/display';
import { broadcasterById } from '../../data/broadcasters';
import { sponsorById } from '../../data/sponsors';
import { weeklyBroadcastIncome, broadcastVerdict } from '../../engine/economy/broadcast';
import { FileTransfer } from '../components/FileTransfer';
import { TitleBuilder } from '../components/TitleBuilder';
import { retiredTitlesOf } from '../../data/titles';
import { beltPrefix } from '../../data/promotionIdentity';
import type { TitleBlueprint } from '../../engine/types';

/** A belt the player is about to introduce, before they have typed anything. */
function blankTitleBlueprint(): TitleBlueprint {
  return {
    suffix: 'Championship',
    blurb: 'A new championship.',
    tier: 'secondary',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: null,
  };
}

export function PromotionScreen() {
  const world = useGameStore((s) => s.world);
  const setVenue = useGameStore((s) => s.setVenue);
  const setTicketPrice = useGameStore((s) => s.setTicketPrice);
  const toggleExtra = useGameStore((s) => s.toggleShowExtra);
  const buyAsset = useGameStore((s) => s.buyProductionAsset);
  const repair = useGameStore((s) => s.repairProductionAsset);

  const projection = useMemo(() => {
    if (!world) return null;
    const venue = venueById(world.showSetup.venueId) ?? VENUES[0]!;
    const roster = world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean);
    const cardStrength = roster.length
      ? roster.reduce((sum, w) => sum + w.popularity, 0) / roster.length
      : 0;
    // The town the show is actually staged in, and how over the promotion is
    // there. The projection used to omit this and quietly assume a neutral
    // following of 50, so it disagreed with the show it was projecting.
    const town = world.territories.find((t) => t.id === world.showSetup.territoryId) ?? world.territories[0]!;
    const following = followingOf(town, world.promotion.id);
    const demand = computeDemand(
      world.promotion.rating,
      world.promotion.recentShowQuality,
      cardStrength,
      world.settings,
      following,
    );

    const ownedAssets = world.ownedAssetIds
      .map((id) => productionAssetById(id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .filter((a) => !a.minVenueCapacity || venue.capacity >= a.minVenueCapacity)
      .filter((a) => {
        const state = world.assetConditions.find((c) => c.assetId === a.id);
        return !state || assetEffectiveness(state, world.settings) > 0;
      });
    const extras = world.showSetup.extraIds
      .map((id) => showExtraById(id))
      .filter((e): e is NonNullable<typeof e> => Boolean(e));
    const production = [...ownedAssets, ...extras];

    const attendanceCtx = {
      venue,
      ticketPrice: world.showSetup.ticketPrice,
      demand,
      attendanceMultiplier: sumEffect(production, 'attendanceMultiplier', 'multiply'),
      territoryFollowing: following,
      settings: world.settings,
    };
    const attendance = computeAttendanceForShow(attendanceCtx);
    const revenue = computeShowRevenue({
      attendance,
      ticketPrice: world.showSetup.ticketPrice,
      merchMultiplier: sumEffect(production, 'merchMultiplier', 'multiply'),
      // The preview reads the card as neutral on gimmicks and cuts — it is a
      // projection of the room, not of who ends up booked in it.
      gimmickMerchMultiplier: 1,
      merchCutShare: 0,
      revenuePerHead: sumEffect(production, 'revenuePerHead'),
      averagePopularity: cardStrength,
      settings: world.settings,
    });
    const costs = computeShowCosts({
      venue,
      ownedAssets,
      extras,
      rosterSize: roster.length,
      settings: world.settings,
    });
    const wages = weeklyWageBill(roster);

    return {
      venue,
      attendance,
      turnedAway: turnedAway(attendanceCtx),
      revenue,
      costs,
      wages,
      net: revenue.total - costs.total - wages,
    };
  }, [world]);

  if (!world || !projection) return null;
  const { venue } = projection;

  return (
    <div className="p-3 pb-24 text-neutral-100">
      <h1 className="mb-3 text-base font-semibold">The promotion</h1>

      <IdentityPanel />

      {/* ---- projection ------------------------------------------------ */}
      <section className="mb-4 rounded border border-neutral-800 bg-neutral-900 p-3">
        <h2 className="mb-2 text-sm font-medium">If you ran the show tonight</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          <Stat label="Attendance" value={`${projection.attendance.toLocaleString()} / ${venue.capacity.toLocaleString()}`} />
          <Stat label="Gate" value={<Money amount={projection.revenue.gate} />} />
          <Stat label="Merchandise" value={<Money amount={projection.revenue.merch} />} />
          <Stat label="Show costs" value={<Money amount={-projection.costs.total} />} />
          <Stat label="Wages" value={<Money amount={-projection.wages} />} />
          <Stat label="Projected net" value={<Money amount={projection.net} />} />
        </dl>
        {projection.turnedAway > 0 && (
          <p className="mt-2 text-[11px] text-amber-400">
            {projection.turnedAway.toLocaleString()} more people want in than this building holds. You are leaving money
            on the table.
          </p>
        )}
        {projection.net < 0 && (
          <p className="mt-2 text-[11px] text-rose-400">
            This show loses money. Rent is committed whether they turn up or not.
          </p>
        )}
      </section>

      {/* ---- who is paying for all this -------------------------------- */}
      <BroadcastPanel />

      {/* ---- getting things in and out --------------------------------- */}
      <FileTransfer />

      {/* ---- venue ----------------------------------------------------- */}
      <section className="mb-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-300">Venue — rented every show</h2>
        <div className="flex flex-col gap-1">
          {VENUES.map((v) => {
            const locked = world.promotion.rating < v.minCompanyRating;
            const selected = world.showSetup.venueId === v.id;
            return (
              <button
                key={v.id}
                type="button"
                data-testid={`venue-${v.id}`}
                disabled={locked}
                onClick={() => setVenue(v.id)}
                className={`flex items-center gap-2 rounded border p-2 text-left text-xs ${
                  selected
                    ? 'border-emerald-500 bg-emerald-950/40'
                    : locked
                      ? 'border-neutral-900 bg-neutral-950 opacity-40'
                      : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{v.name}</div>
                  <div className="text-[10px] text-neutral-500">{locked ? 'Will not rent to you yet' : v.blurb}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div>{v.capacity.toLocaleString()} seats</div>
                  <div className="text-neutral-500">
                    <Money amount={v.rentalCost} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---- ticket price ---------------------------------------------- */}
      <section className="mb-4 rounded border border-neutral-800 bg-neutral-900 p-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="flex justify-between">
            <span>Ticket price</span>
            <span className="font-mono text-neutral-300">${world.showSetup.ticketPrice}</span>
          </span>
          <input
            type="range"
            min={1}
            max={120}
            value={world.showSetup.ticketPrice}
            onChange={(e) => setTicketPrice(Number(e.target.value))}
            className="accent-emerald-500"
          />
          <span className="text-[11px] text-neutral-500">
            Charge under the odds and you sell out cheap. Charge over it and the building looks empty on television —
            and the town remembers what it was charged long after the night is over.
          </span>
        </label>
      </section>

      {/* ---- per-show extras ------------------------------------------- */}
      <section className="mb-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-300">Tonight only — paid every time</h2>
        <div className="grid gap-1 sm:grid-cols-2">
          {SHOW_EXTRAS.map((extra) => {
            const missingRig = extra.requiresAsset && !world.ownedAssetIds.includes(extra.requiresAsset);
            const selected = world.showSetup.extraIds.includes(extra.id);
            return (
              <button
                key={extra.id}
                type="button"
                data-testid={`extra-${extra.id}`}
                disabled={Boolean(missingRig)}
                onClick={() => toggleExtra(extra.id)}
                className={`flex items-start gap-2 rounded border p-2 text-left text-xs ${
                  selected
                    ? 'border-emerald-500 bg-emerald-950/40'
                    : missingRig
                      ? 'border-neutral-900 bg-neutral-950 opacity-40'
                      : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{extra.name}</div>
                  <div className="text-[10px] text-neutral-500">
                    {missingRig
                      ? `Needs ${productionAssetById(extra.requiresAsset!)?.name}`
                      : extra.blurb}
                  </div>
                </div>
                <span className="shrink-0 text-neutral-400">
                  <Money amount={extra.cost} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---- capital purchases ------------------------------------------ */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-300">Bought once — travels to every show</h2>
        <div className="grid gap-1 sm:grid-cols-2">
          {PRODUCTION_ASSETS.map((asset) => {
            const owned = world.ownedAssetIds.includes(asset.id);
            const affordable = world.promotion.bankBalance >= asset.cost;
            const tooBig = asset.minVenueCapacity && venue.capacity < asset.minVenueCapacity;
            const condition = world.assetConditions.find((c) => c.assetId === asset.id);
            const fixCost = condition ? repairCost(condition, asset.cost, world.settings) : 0;

            return (
              <div key={asset.id} className="flex flex-col gap-1">
              <button
                type="button"
                data-testid={`asset-${asset.id}`}
                disabled={owned || !affordable}
                onClick={() => buyAsset(asset.id)}
                className={`flex items-start gap-2 rounded border p-2 text-left text-xs ${
                  owned
                    ? 'border-sky-800 bg-sky-950/30'
                    : affordable
                      ? 'border-neutral-800 bg-neutral-900 hover:border-neutral-600'
                      : 'border-neutral-900 bg-neutral-950 opacity-50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {asset.name}
                    {owned && <span className="ml-1 text-sky-400">owned</span>}
                  </div>
                  <div className="text-[10px] text-neutral-500">{asset.blurb}</div>
                  {owned && (
                    <div className="text-[10px] text-neutral-600">
                      upkeep <Money amount={asset.upkeepPerShow} /> per show
                      {condition && (
                        <span
                          className={`ml-1 ${
                            assetHasFailed(condition, world.settings)
                              ? 'text-rose-400'
                              : condition.condition < 40
                                ? 'text-amber-500'
                                : 'text-neutral-500'
                          }`}
                        >
                          · {conditionLabel(condition, world.settings)}
                        </span>
                      )}
                      {tooBig && <span className="ml-1 text-amber-500">· too big for this venue</span>}
                    </div>
                  )}
                </div>
                {!owned && (
                  <span className="shrink-0 text-neutral-400">
                    <Money amount={asset.cost} />
                  </span>
                )}
              </button>
              {owned && fixCost > 0 && (
                <button
                  type="button"
                  data-testid={`repair-${asset.id}`}
                  disabled={world.promotion.bankBalance < fixCost}
                  onClick={() => repair(asset.id)}
                  className={`rounded px-2 py-1 text-[11px] ${
                    world.promotion.bankBalance >= fixCost
                      ? 'bg-amber-900/60 text-amber-200 hover:bg-amber-800/60'
                      : 'bg-neutral-900 text-neutral-600'
                  }`}
                >
                  Repair · <Money amount={fixCost} />
                </button>
              )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/**
 * Who you are. Editable until the first show goes out — after that the belts
 * have a lineage and the name on them is the name you have.
 */
function IdentityPanel() {
  const world = useGameStore((s) => s.world);
  const setIdentity = useGameStore((s) => s.setPromotionIdentity);
  const [draftName, setDraftName] = useState<string | null>(null);

  if (!world) return null;
  const locked = world.showHistory.length > 0;
  const identity = identityOf(world.promotion.identity);
  const name = draftName ?? world.promotion.name;
  const belts = titlesOf(world.titles, world.promotion.id);
  const retireTitle = useGameStore((s) => s.retireTitle);
  const editTitle = useGameStore((s) => s.editTitle);

  return (
    <section className="mb-4 rounded border border-neutral-800 bg-neutral-900 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Who you are</h2>
        <span className="text-[10px] text-neutral-600">
          {locked ? 'Set — your belts have a lineage now' : 'Changeable until your first show'}
        </span>
      </div>

      <input
        type="text"
        value={name}
        disabled={locked}
        data-testid="promotion-name"
        onChange={(e) => setDraftName(e.target.value)}
        onBlur={() => {
          if (draftName !== null) setIdentity(draftName, world.promotion.identity);
          setDraftName(null);
        }}
        className="mb-2 w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm disabled:opacity-60"
      />

      <div className="mb-2 flex flex-wrap gap-1">
        {PROMOTION_ARCHETYPES.map((archetype) => {
          const option = identityOf(archetype);
          const selected = world.promotion.identity === archetype;
          return (
            <button
              key={archetype}
              type="button"
              disabled={locked}
              data-testid={`identity-${archetype}`}
              onClick={() => setIdentity(world.promotion.name, archetype)}
              className={`rounded px-2 py-1 text-[11px] ${
                selected
                  ? 'bg-emerald-600 text-white'
                  : locked
                    ? 'bg-neutral-900 text-neutral-600'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <p className="mb-2 text-[11px] text-neutral-400">{identity.knownFor}.</p>

      <ul className="flex flex-col gap-1">
        {belts.map((belt) => {
          const holders = belt.currentHolderIds.map((id) => world.wrestlers[id]?.name).filter(Boolean);
          return (
            <li key={belt.id} className="flex items-start gap-2 rounded bg-neutral-950 p-1.5 text-[11px]">
              <span
                className="mt-0.5 h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: belt.colorway.plate }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                {/* Editable in place. A belt can be renamed for its twentieth
                    anniversary or when the company outgrows the name it
                    opened with — what it cannot do is change division or
                    tier, which would rewrite the reigns already on it. */}
                <input
                  type="text"
                  aria-label={`${belt.name} name`}
                  data-testid={`belt-rename-${belt.id}`}
                  defaultValue={belt.name}
                  onBlur={(e) => editTitle(belt.id, { name: e.target.value })}
                  className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 font-medium hover:border-neutral-800 focus:border-neutral-700 focus:bg-neutral-900"
                />
                <input
                  type="text"
                  aria-label={`What the ${belt.name} is for`}
                  defaultValue={belt.blurb}
                  onBlur={(e) => editTitle(belt.id, { blurb: e.target.value })}
                  className="mt-0.5 w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-neutral-500 hover:border-neutral-800 focus:border-neutral-700 focus:bg-neutral-900"
                />
                {belt.signatureStipulationId && (
                  <span className="block px-1 text-amber-500/80">
                    Defended under {stipulationById(belt.signatureStipulationId)?.name ?? belt.signatureStipulationId}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right text-neutral-400">
                {holders.length > 0 ? holders.join(' & ') : <span className="text-neutral-600">vacant</span>}
              </span>
              <button
                type="button"
                data-testid={`retire-belt-${belt.id}`}
                onClick={() => retireTitle(belt.id)}
                title="Retire it. The lineage stays."
                className="shrink-0 rounded border border-neutral-800 px-1.5 py-1 text-[10px] text-neutral-500 hover:border-amber-800 hover:text-amber-400"
              >
                Retire
              </button>
            </li>
          );
        })}
      </ul>

      <TitleWorkshop />
    </section>
  );
}

/**
 * Adding a belt, and bringing an old one back.
 *
 * A promotion's championships change over thirty years — a company introduces
 * a women's division, retires a tag belt nobody was using, brings back
 * something from its own history for an anniversary. Retiring is deliberately
 * not deleting: the lineage stays, the records still read it, and it can come
 * back. That is the whole difference between retiring a title and pretending
 * it never existed.
 */
function TitleWorkshop() {
  const world = useGameStore((s) => s.world);
  const createTitle = useGameStore((s) => s.createTitle);
  const unretireTitle = useGameStore((s) => s.unretireTitle);
  const [drafts, setDrafts] = useState<TitleBlueprint[]>([]);
  if (!world) return null;

  const retired = retiredTitlesOf(world.titles, world.promotion.id);

  return (
    <div className="mt-3 border-t border-neutral-800 pt-3">
      {retired.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-neutral-500">Retired championships</div>
          <ul className="flex flex-col gap-1">
            {retired.map((belt) => {
              const reigns = belt.history.length;
              const last = belt.history[belt.history.length - 1];
              const lastHolder = last?.holderIds.map((id) => world.wrestlers[id]?.name).filter(Boolean).join(' & ');
              return (
                <li key={belt.id} className="flex items-start gap-2 rounded bg-neutral-950 p-1.5 text-[11px]">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-neutral-400">{belt.name}</span>
                    <span className="block text-neutral-600">
                      {reigns} {reigns === 1 ? 'reign' : 'reigns'}
                      {lastHolder && ` · last held by ${lastHolder}`}
                    </span>
                  </span>
                  <button
                    type="button"
                    data-testid={`unretire-belt-${belt.id}`}
                    onClick={() => unretireTitle(belt.id)}
                    className="shrink-0 rounded border border-neutral-800 px-1.5 py-1 text-[10px] text-neutral-400 hover:border-emerald-800 hover:text-emerald-400"
                  >
                    Bring it back
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {drafts.length === 0 ? (
        <button
          type="button"
          data-testid="new-belt"
          onClick={() => setDrafts([blankTitleBlueprint()])}
          className="rounded border border-neutral-700 px-3 py-2 text-xs text-neutral-300 hover:border-neutral-500"
        >
          Introduce a new championship
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <TitleBuilder
            belts={drafts}
            prefix={beltPrefix(world.promotion.name)}
            onChange={setDrafts}
            maxBelts={1}
          />
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="create-belt"
              onClick={() => {
                for (const draft of drafts) {
                  if (draft.suffix.trim()) createTitle({ ...draft, suffix: draft.suffix.trim() });
                }
                setDrafts([]);
              }}
              className="rounded bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Introduce it
            </button>
            <button
              type="button"
              onClick={() => setDrafts([])}
              className="rounded border border-neutral-800 px-3 py-2 text-xs text-neutral-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
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
 * Television and sponsors.
 *
 * Both are shown with their conditions attached and how close each one is to
 * breaking, because that is the only part the player can act on. The fee is
 * the reward; the conditions are the actual system, and burying them would
 * make losing a deal feel arbitrary rather than earned.
 */
function BroadcastPanel() {
  const world = useGameStore((s) => s.world);
  const dropSponsor = useGameStore((s) => s.dropSponsor);
  if (!world) return null;

  const deal = world.broadcastDealId ? broadcasterById(world.broadcastDealId) : null;
  const sponsors = world.sponsorIds.map((id) => sponsorById(id)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  // What the slot did last week. The network's money follows it, so the
  // panel shows the number, the verdict and what it is currently worth.
  const tvRating = world.tvHistory[0]?.results.find((r) => r.promotionId === world.promotion.id)?.rating ?? 0;
  const weekly = weeklyBroadcastIncome(deal ?? null, sponsors, tvRating, world.settings);
  const verdict = broadcastVerdict(deal ?? null, tvRating);

  const breachOn = (key: string) => world.breachWeeks[key] ?? 0;
  const grace = world.settings.broadcastWeeksOfGrace;

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-neutral-300">Television and sponsors</h2>
        <span className="text-xs text-neutral-500">
          <Money amount={weekly} /> a week
        </span>
      </div>

      {!deal && sponsors.length === 0 ? (
        <p className="text-xs text-neutral-500">
          Nobody is paying you to be on television and nobody wants their name on the banner. Both come with a company
          rating.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {deal && (
            <div
              data-testid={`deal-${deal.id}`}
              className={`rounded border p-2 ${
                breachOn(deal.id) > 0 ? 'border-rose-800 bg-rose-950/20' : 'border-neutral-800 bg-neutral-900'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-medium">{deal.name}</span>
                <span className="shrink-0 text-[11px] text-emerald-400">
                  <Money amount={weeklyBroadcastIncome(deal, [], tvRating, world.settings)} />
                </span>
              </div>
              {/* Half the fee rides on the rating you actually delivered
                  against the one they signed you expecting, so the panel says
                  which way it is going and what the guarantee was. */}
              {verdict && (
                <div
                  className={`text-[10px] ${
                    verdict === 'Beating the deal'
                      ? 'text-emerald-400'
                      : verdict === 'Meeting the deal'
                        ? 'text-neutral-500'
                        : 'text-amber-400'
                  }`}
                >
                  {verdict} · guarantee <Money amount={deal.weeklyFee} />
                </div>
              )}
              {deal.demands.map((demand) => (
                <div key={demand.kind} className="text-[10px] text-neutral-500">
                  {demand.text}
                </div>
              ))}
              {breachOn(deal.id) > 0 && (
                <div className="mt-1 text-[10px] text-rose-400">
                  In breach {breachOn(deal.id)}w — {grace - breachOn(deal.id)} until they pull the show
                </div>
              )}
            </div>
          )}

          {sponsors.map((sponsor) => (
            <div
              key={sponsor.id}
              data-testid={`sponsor-${sponsor.id}`}
              className={`rounded border p-2 ${
                breachOn(sponsor.id) > 0 ? 'border-rose-800 bg-rose-950/20' : 'border-neutral-800 bg-neutral-900'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-medium">{sponsor.name}</span>
                <span className="shrink-0 text-[11px] text-emerald-400">
                  <Money amount={sponsor.weeklyFee} />
                </span>
              </div>
              {sponsor.conditions.map((condition) => (
                <div key={condition.kind} className="text-[10px] text-neutral-500">
                  {condition.text}
                </div>
              ))}
              <div className="mt-1 flex items-center justify-between gap-2">
                {breachOn(sponsor.id) > 0 ? (
                  <span className="text-[10px] text-rose-400">
                    In breach {breachOn(sponsor.id)}w — {grace - breachOn(sponsor.id)} until they walk
                  </span>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  data-testid={`drop-sponsor-${sponsor.id}`}
                  onClick={() => dropSponsor(sponsor.id)}
                  className="shrink-0 rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400 hover:bg-neutral-700"
                >
                  End it
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
