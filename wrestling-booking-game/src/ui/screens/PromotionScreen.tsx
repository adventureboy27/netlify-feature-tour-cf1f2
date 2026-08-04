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

import { useMemo } from 'react';
import { useGameStore } from '../../state/store';
import { VENUES, venueById } from '../../data/venues';
import { PRODUCTION_ASSETS, SHOW_EXTRAS, productionAssetById, showExtraById } from '../../data/production';
import {
  computeShowCosts,
  computeAttendanceForShow,
  computeShowRevenue,
  turnedAway,
  sumEffect,
} from '../../engine/economy/showBudget';
import { weeklyWageBill } from '../../engine/economy/contracts';
import { Money } from '../components/display';

export function PromotionScreen() {
  const world = useGameStore((s) => s.world);
  const setVenue = useGameStore((s) => s.setVenue);
  const setTicketPrice = useGameStore((s) => s.setTicketPrice);
  const toggleExtra = useGameStore((s) => s.toggleShowExtra);
  const buyAsset = useGameStore((s) => s.buyProductionAsset);

  const projection = useMemo(() => {
    if (!world) return null;
    const venue = venueById(world.showSetup.venueId) ?? VENUES[0]!;
    const roster = world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean);
    const cardStrength = roster.length
      ? roster.reduce((sum, w) => sum + w.popularity, 0) / roster.length
      : 0;
    const demand = Math.max(0, Math.min(100, world.promotion.rating * 0.55 + cardStrength * 0.45));

    const ownedAssets = world.ownedAssetIds
      .map((id) => productionAssetById(id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .filter((a) => !a.minVenueCapacity || venue.capacity >= a.minVenueCapacity);
    const extras = world.showSetup.extraIds
      .map((id) => showExtraById(id))
      .filter((e): e is NonNullable<typeof e> => Boolean(e));
    const production = [...ownedAssets, ...extras];

    const attendanceCtx = {
      venue,
      ticketPrice: world.showSetup.ticketPrice,
      demand,
      attendanceMultiplier: sumEffect(production, 'attendanceMultiplier', 'multiply'),
      settings: world.settings,
    };
    const attendance = computeAttendanceForShow(attendanceCtx);
    const revenue = computeShowRevenue({
      attendance,
      ticketPrice: world.showSetup.ticketPrice,
      merchMultiplier: sumEffect(production, 'merchMultiplier', 'multiply'),
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
            Charge under the odds and you sell out cheap. Charge over it and the building looks empty on television.
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
            return (
              <button
                key={asset.id}
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
            );
          })}
        </div>
      </section>
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
