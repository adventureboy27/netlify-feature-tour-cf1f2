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
import { fireSaleEligible, fireSaleValue } from '../../engine/economy/fireSale';
import { MATCH_PROP_FAMILIES, tiersForFamily } from '../../data/matchProps';
import { ownedUnitsForFamily, unitConditionLabel, unitHasFailed, propRepairCost } from '../../engine/economy/matchProps';
import { weeklyWageBill } from '../../engine/economy/contracts';
import { followingOf } from '../../engine/world/territories';
import { identityOf, PROMOTION_ARCHETYPES } from '../../data/promotionIdentity';
import { PromotionMark } from '../components/PromotionMark';
import { resizeToDataUrl } from '../paperdoll/photoUpload';
import { fanTasteHighlights } from '../../engine/world/fanTaste';
import { STYLE_LABEL } from '../../data/styles';
import { titlesOf } from '../../data/titles';
import { stipulationById } from '../../data/stipulations';
import { Money } from '../components/display';
import { broadcasterById } from '../../data/broadcasters';
import { sponsorById } from '../../data/sponsors';
import { weeklyBroadcastIncome, broadcastVerdict } from '../../engine/economy/broadcast';
import { FileTransfer } from '../components/FileTransfer';
import { VenuePicker } from '../components/VenuePicker';
import { ResidencyDeal } from '../components/ResidencyDeal';
import { Stands } from '../components/Stands';
import { TitleBuilder, blankTitleBlueprint } from '../components/TitleBuilder';
import { factionHeat, factionStanding } from '../../engine/world/faction';
import { retiredTitlesOf } from '../../data/titles';
import { beltPrefix } from '../../data/promotionIdentity';
import type { TitleBlueprint } from '../../engine/types';

export function PromotionScreen() {
  const world = useGameStore((s) => s.world);
  const setVenue = useGameStore((s) => s.setVenue);
  const setTicketPrice = useGameStore((s) => s.setTicketPrice);
  const toggleExtra = useGameStore((s) => s.toggleShowExtra);
  const buyAsset = useGameStore((s) => s.buyProductionAsset);
  const repair = useGameStore((s) => s.repairProductionAsset);
  const sellAsset = useGameStore((s) => s.sellProductionAsset);
  const buyPropUnit = useGameStore((s) => s.buyPropUnit);
  const repairPropUnit = useGameStore((s) => s.repairPropUnit);

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
  const livingRivals = world.rivals.filter((r) => r.closedWeek === null);

  return (
    <div className="p-3 pb-6 text-neutral-100">
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
            {projection.turnedAway.toLocaleString()} more people want in than this building can even hold. You are
            leaving real money on the table.
          </p>
        )}
        {projection.net < 0 && (
          <p className="mt-2 text-[11px] text-rose-400">
            This show flat-out loses money. That rent is committed whether a single soul turns up or not.
          </p>
        )}
      </section>

      {/* ---- who is paying for all this -------------------------------- */}
      <BroadcastPanel />

      {/* ---- getting things in and out --------------------------------- */}
      <FileTransfer />

      <ResidencyDeal />

      {/* While a term is running the room is not a weekly choice, so the list
          is simply not offered — the deal above says why. */}
      {!world.residency && (
        <VenuePicker
          selectedId={world.showSetup.venueId}
          companyRating={world.promotion.rating}
          productionRungs={world.productionRungs}
          settings={world.settings}
          onSelect={setVenue}
        />
      )}

      <Stands />

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

      {/* ---- rival pricing ----------------------------------------------
          Display only — a rival's actual revenue is still the standing/form
          summary rivalEconomy.ts has always used, this never feeds it. Each
          rival's three numbers are drawn independently (engine/world/pricing.ts),
          so there is no pattern to read off — a company can undercut everybody
          at the door and still be robbing the merch table. */}
      <section className="mb-4 rounded border border-neutral-800 bg-neutral-900 p-3">
        <h2 className="mb-1 text-sm font-medium">What the competition charges</h2>
        <p className="mb-2 text-[11px] text-neutral-500">
          Nobody in this business prices the same way twice. A company cheap on the door can still gouge on
          shirts — there is no pattern here, only what each promoter decided this was worth.
        </p>
        {livingRivals.length === 0 ? (
          <p className="text-[11px] text-neutral-600">No other companies left standing.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th className="pb-1 pr-3 font-normal">Promotion</th>
                  <th className="pb-1 pr-3 font-normal">Ticket</th>
                  <th className="pb-1 pr-3 font-normal">Merch</th>
                  <th className="pb-1 font-normal">PPV buy</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-neutral-800 text-neutral-300">
                  <td className="py-1 pr-3">{world.promotion.name} (you)</td>
                  <td className="py-1 pr-3 font-mono">${world.showSetup.ticketPrice}</td>
                  <td className="py-1 pr-3 text-neutral-600">—</td>
                  <td className="py-1 text-neutral-600">—</td>
                </tr>
                {livingRivals.map((rival) => {
                  const pricing = world.rivalPricing[rival.id];
                  return (
                    <tr key={rival.id} className="border-t border-neutral-800 text-neutral-300">
                      <td className="py-1 pr-3">{rival.name}</td>
                      <td className="py-1 pr-3 font-mono">{pricing ? `$${pricing.ticketPrice}` : '—'}</td>
                      <td className="py-1 pr-3 font-mono">{pricing ? `$${pricing.merchPrice}` : '—'}</td>
                      <td className="py-1 font-mono">{pricing ? `$${pricing.ppvPrice}` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
            // Only ever offered mid-crisis — see economy/fireSale.ts.
            const canSell = owned && Boolean(world.activeLoan) && fireSaleEligible(asset);
            const saleValue = canSell ? fireSaleValue(asset, condition, world.settings) : 0;

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
              {canSell && (
                <button
                  type="button"
                  data-testid={`sell-${asset.id}`}
                  onClick={() => sellAsset(asset.id)}
                  className="rounded bg-rose-950/60 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-900/60"
                  title="Only on the table because this promotion is already borrowing hard just to stay open."
                >
                  Fire sale · <Money amount={saleValue} />
                </button>
              )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- match hardware ----------------------------------------------
          Ladders, cages, tables — countable, multi-unit, and each one wears
          out on its own. Different category from the capital purchases
          above: those are one-owned-or-not house gear, these are consumable
          props a stipulation actually needs. See data/matchProps.ts. */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-300">Match hardware — tracked unit by unit</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {MATCH_PROP_FAMILIES.map((family) => {
            const owned = ownedUnitsForFamily(world.ownedPropUnits, family.id);
            const atCap = owned.length >= family.maxUnitsOwned;

            return (
              <div key={family.id} className="rounded border border-neutral-800 bg-neutral-900 p-2">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-xs font-medium">{family.name}</span>
                  <span className="text-[10px] text-neutral-600">
                    {owned.length} / {family.maxUnitsOwned} owned
                  </span>
                </div>
                <div className="mb-2 text-[10px] text-neutral-500">{family.blurb}</div>

                {owned.length > 0 && (
                  <div className="mb-2 flex flex-col gap-1">
                    {owned.map((unit) => {
                      const tier = tiersForFamily(family.id).find((t) => t.id === unit.tierId);
                      if (!tier) return null;
                      const failed = unitHasFailed(unit, world.settings);
                      const fixCost = propRepairCost(unit, tier, world.settings);

                      return (
                        <div
                          key={unit.id}
                          className="flex items-center justify-between gap-2 rounded bg-neutral-950/60 px-2 py-1 text-[11px]"
                        >
                          <span className="min-w-0 truncate">
                            {tier.name}{' '}
                            <span className={failed ? 'text-rose-400' : unit.condition < 40 ? 'text-amber-500' : 'text-neutral-500'}>
                              · {unitConditionLabel(unit, world.settings)}
                            </span>
                          </span>
                          {fixCost > 0 && (
                            <button
                              type="button"
                              data-testid={`repair-prop-${unit.id}`}
                              disabled={world.promotion.bankBalance < fixCost}
                              onClick={() => repairPropUnit(unit.id)}
                              className={`shrink-0 rounded px-1.5 py-0.5 ${
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
                )}

                <div className="flex flex-col gap-1">
                  {tiersForFamily(family.id).map((tier) => {
                    const affordable = world.promotion.bankBalance >= tier.cost;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        data-testid={`buy-prop-${tier.id}`}
                        disabled={atCap || !affordable}
                        onClick={() => buyPropUnit(tier.id)}
                        title={tier.blurb}
                        className={`flex items-center justify-between gap-2 rounded border p-1.5 text-left text-[11px] ${
                          atCap || !affordable
                            ? 'border-neutral-900 bg-neutral-950 opacity-50'
                            : 'border-neutral-800 bg-neutral-950 hover:border-neutral-600'
                        }`}
                      >
                        <span className="min-w-0 truncate">{tier.name}</span>
                        <span className="shrink-0 text-neutral-400">
                          <Money amount={tier.cost} />
                        </span>
                      </button>
                    );
                  })}
                </div>
                {atCap && (
                  <div className="mt-1 text-[10px] text-neutral-600">
                    This is as many as the promotion can own. A broken one still counts until it's repaired.
                  </div>
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
  const setPromotionLogo = useGameStore((s) => s.setPromotionLogo);
  const [draftName, setDraftName] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  if (!world) return null;
  const locked = world.showHistory.length > 0;
  const identity = identityOf(world.promotion.identity);
  const name = draftName ?? world.promotion.name;
  const belts = titlesOf(world.titles, world.promotion.id);
  const retireTitle = useGameStore((s) => s.retireTitle);
  const editTitle = useGameStore((s) => s.editTitle);
  const logoDataUrl = world.promotion.logoDataUrl;

  async function handleLogoFile(file: File | null) {
    if (!file) return;
    try {
      setPromotionLogo(await resizeToDataUrl(file, 160));
      setLogoError(null);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'That file could not be used.');
    }
  }

  return (
    <section className="mb-4 rounded border border-neutral-800 bg-neutral-900 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Who you are</h2>
        <span className="text-[10px] text-neutral-600">
          {locked ? 'Set — your belts have a lineage now' : 'Changeable until your first show'}
        </span>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <PromotionMark name={name} archetype={world.promotion.identity} size="small" logoDataUrl={logoDataUrl} />
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
          className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm disabled:opacity-60"
        />
      </div>

      <div className="mb-2 flex items-center gap-2">
        <label className="cursor-pointer rounded bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700">
          {logoDataUrl ? 'Replace logo' : 'Upload logo'}
          <input
            type="file"
            accept="image/*"
            data-testid="promotion-logo-upload"
            className="hidden"
            onChange={(e) => {
              void handleLogoFile(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
        </label>
        {logoDataUrl && (
          <button
            type="button"
            data-testid="promotion-logo-remove"
            onClick={() => setPromotionLogo(null)}
            className="rounded bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700"
          >
            Remove logo
          </button>
        )}
        {logoError && <span className="text-[11px] text-rose-400">{logoError}</span>}
      </div>

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

      {/* What the house style says on the marquee (above) is not always what
          the room has actually developed a taste for lately — see
          engine/world/fanTaste.ts. Only speaks when there is genuinely
          something to say, same rule fitLabel and hypeLabel play by. */}
      {(() => {
        const { loved, cold } = fanTasteHighlights(world.promotion.fanTaste, world.settings);
        if (loved.length === 0 && cold.length === 0) return null;
        const join = (styles: typeof loved) =>
          styles.map((s) => STYLE_LABEL[s]).join(styles.length > 2 ? ', ' : ' and ');
        const parts: string[] = [];
        if (loved.length > 0) parts.push(`taken to ${join(loved)} wrestling`);
        if (cold.length > 0) parts.push(`gone cold on ${join(cold)}`);
        return (
          <p className="mb-2 text-[11px] text-sky-400/80">
            Lately the crowd has {parts.join(' — and ')}.
          </p>
        );
      })()}

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
      <Factions />
    </section>
  );
}

/**
 * The groups, and how big they have got.
 *
 * A stable used to be a tag team with extra members — shared colours, a
 * shared record, and no reason for anybody to care. What makes a faction
 * worth booking is that it can outgrow the company housing it, so the thing
 * worth showing is exactly that: how hot it is against how hot you are.
 *
 * Said in words, per §0. "Running the place" is a standing, not a number.
 */
function Factions() {
  const world = useGameStore((s) => s.world);
  if (!world) return null;

  const mine = world.stables.filter(
    (g) =>
      g.disbandedWeek === null &&
      g.memberIds.length >= 2 &&
      g.memberIds.some((id) => world.promotion.rosterIds.includes(id)),
  );
  if (mine.length === 0) return null;

  return (
    <div className="mt-3 border-t border-neutral-800 pt-3">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-neutral-500">Groups</div>
      <ul className="flex flex-col gap-1">
        {mine.map((faction) => {
          const heat = factionHeat(faction, world.wrestlers, world.settings);
          const standing = factionStanding(
            heat,
            faction.memberIds.length,
            world.promotion.rating,
            world.settings,
          );
          const names = faction.memberIds
            .map((id) => world.wrestlers[id]?.name)
            .filter(Boolean)
            .join(', ');
          return (
            <li
              key={faction.id}
              data-testid={`faction-${faction.id}`}
              className="rounded bg-neutral-950 p-1.5 text-[11px]"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{faction.name}</span>
                <span
                  className={
                    standing === 'out of control'
                      ? 'text-rose-400'
                      : standing === 'running the place'
                        ? 'text-amber-400'
                        : 'text-neutral-500'
                  }
                >
                  {standing}
                </span>
              </div>
              <div className="text-neutral-600">{names}</div>
              {standing === 'out of control' && (
                <div className="mt-0.5 text-rose-300/80">
                  Bigger than the company it is in. Everybody in it knows it, and it is showing up in what
                  they want.
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
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
          <TitleBuilder belts={drafts} prefix={beltPrefix(world.promotion.name)} onChange={setDrafts} />
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
          Nobody is paying you to be on television and not one sponsor wants their name on the banner. Both come
          with a company rating high enough to matter.
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
