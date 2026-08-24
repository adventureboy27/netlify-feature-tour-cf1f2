// The map.
//
// This screen was deliberately a list and no picture: on a phone, twelve rows
// you can read beat a map you have to pinch, and a row says all four things
// the player needs — where they are over, where they are forgotten, who holds
// what, and what each town wants. That reasoning still holds, so the rows are
// still here and still carry the detail.
//
// What changed is that the towns became a road. Circuits (data/circuits.ts)
// group them into touring loops, and a loop is a shape — you cannot see from
// a list that your reach covers one corner of the business and stops, or that
// a rival holds every town on the route you were about to expand into. So the
// map sits above the list as the overview, and the list stays as the detail.
//
// Following is a bar, not a number (CLAUDE.md: stats as bars, never numbers).
// The house record is a number because it is a record, and records are numbers.

import { useState } from 'react';
import { useGameStore } from '../../state/store';
import { TerritoryMap } from '../components/TerritoryMap';
import { circuitForTerritory } from '../../data/circuits';
import { followingOf, venueFitsTerritory } from '../../engine/world/territories';
import { territoryDefinitionById } from '../../data/territories';
import { venueById } from '../../data/venues';
import type { TerritoryPreferenceTag } from '../../engine/types';

const TAG_LABELS: Record<TerritoryPreferenceTag, string> = {
  faces: 'good guys',
  heels: 'villains',
  hardcore: 'hardcore',
  technical: 'technical',
  highFlying: 'high-flying',
  womensWrestling: 'women’s',
  longMatches: 'long matches',
  starPower: 'star power',
};

export function TerritoriesScreen() {
  const world = useGameStore((s) => s.world);
  const setTerritory = useGameStore((s) => s.setTerritory);
  // Tapping the map selects a town to read about; it does not book a show
  // there. Moving the whole promotion to another state on a mis-tap is not a
  // thing the player should be able to do with one thumb.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!world) return null;

  const nameOf = (id: string | null) => {
    if (id === null) return null;
    if (id === world.promotion.id) return 'You';
    return world.rivals.find((r) => r.id === id)?.name ?? null;
  };
  const venue = venueById(world.showSetup.venueId);
  const selected = selectedId ? (world.territories.find((t) => t.id === selectedId) ?? null) : null;
  const selectedCircuit = selected ? circuitForTerritory(selected.id) : undefined;

  return (
    <div className="p-3 pb-24 text-neutral-100">
      <h1 className="mb-1 text-base font-semibold">The territories</h1>
      <p className="mb-2 text-[11px] text-neutral-500">
        Every single town remembers you separately, and forgets you a little more every week you are not there.
      </p>

      <TerritoryMap
        territories={world.territories}
        playerPromotionId={world.promotion.id}
        runningTerritoryId={world.showSetup.territoryId}
        selectedTerritoryId={selectedId}
        onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
        nameOf={nameOf}
      />

      {selected && (
        <div className="mt-2 rounded-lg border border-neutral-700 bg-neutral-900 p-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold">{selected.name}</span>
            <span className="shrink-0 text-[10px] text-neutral-500">
              {selectedCircuit ? selectedCircuit.name : 'off the map'}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] italic leading-snug text-neutral-500">
            {territoryDefinitionById(selected.id)?.blurb}
          </p>
          <button
            type="button"
            data-testid="map-run-here"
            onClick={() => setTerritory(selected.id)}
            disabled={world.showSetup.territoryId === selected.id}
            className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            {world.showSetup.territoryId === selected.id ? 'Running here this week' : `Run this week in ${selected.name}`}
          </button>
        </div>
      )}

      <h2 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
        Town by town
      </h2>

      <div className="flex flex-col gap-2">
        {world.territories.map((territory) => {
          const definition = territoryDefinitionById(territory.id);
          const running = world.showSetup.territoryId === territory.id;
          const following = followingOf(territory, world.promotion.id);
          const owner = nameOf(territory.ownerPromotionId);
          const record = world.attendanceRecords[territory.id];
          const tooBig = venue ? !venueFitsTerritory(venue.capacity, territory.capacity) : false;

          const likes = Object.entries(territory.preferenceWeights)
            .filter(([, weight]) => (weight ?? 0) > 0)
            .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
            .map(([tag]) => TAG_LABELS[tag as TerritoryPreferenceTag]);
          const dislikes = Object.entries(territory.preferenceWeights)
            .filter(([, weight]) => (weight ?? 0) < 0)
            .sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0))
            .map(([tag]) => TAG_LABELS[tag as TerritoryPreferenceTag]);

          return (
            <button
              key={territory.id}
              type="button"
              data-testid={`territory-${territory.id}`}
              onClick={() => setTerritory(territory.id)}
              className={`rounded border p-2 text-left ${
                running ? 'border-emerald-500 bg-emerald-950/40' : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{territory.name}</span>
                <span className="shrink-0 text-[10px] text-neutral-500">
                  {territory.capacity.toLocaleString()} market
                </span>
              </div>

              {/* How over you are here. */}
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded bg-neutral-800">
                  <div
                    className={`h-full ${following > 60 ? 'bg-emerald-500' : following > 25 ? 'bg-amber-500' : 'bg-neutral-600'}`}
                    style={{ width: `${following}%` }}
                  />
                </div>
                <span className="shrink-0 text-[10px] text-neutral-500">
                  {following <= 0 ? 'never been' : following > 75 ? 'a stronghold' : following > 40 ? 'known here' : 'a hard sell'}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px]">
                {owner ? (
                  <span className={owner === 'You' ? 'text-emerald-400' : 'text-rose-400'}>
                    {owner === 'You' ? 'You hold this town' : `${owner} holds this town`}
                  </span>
                ) : (
                  <span className="text-neutral-600">Unclaimed</span>
                )}
                {record && (
                  <span className="text-neutral-600">record {record.attendance.toLocaleString()}</span>
                )}
                {territory.revenueMult >= 1.15 && <span className="text-amber-400">pays well</span>}
                {territory.revenueMult <= 0.85 && <span className="text-neutral-600">pays badly</span>}
              </div>

              <div className="mt-1 text-[10px] text-neutral-500">
                {likes.length > 0 && <span className="text-neutral-400">wants {likes.join(', ')}</span>}
                {likes.length > 0 && dislikes.length > 0 && <span> · </span>}
                {dislikes.length > 0 && <span>will not sit through {dislikes.join(', ')}</span>}
              </div>

              {definition && <div className="mt-1 text-[10px] italic text-neutral-600">{definition.blurb}</div>}

              {running && tooBig && (
                <div className="mt-1 text-[10px] text-amber-400">
                  Your building is bigger than this market. It will not fill.
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
