// The map, drawn.
//
// The territories screen was deliberately a list — twelve rows you can read
// beat a picture you have to pinch, and that is still true, so the list is
// still there underneath this. What a list cannot show is the thing the
// circuits made worth showing: that these towns are a *road*. Three towns you
// can drive between are a loop, four loops are the business, and where your
// reach is growing or receding across them is a shape rather than twelve
// separate numbers.
//
// Everything here is read from world state on render, so it is live by
// construction: following moves every week, towns change hands, and the map
// says so without anything having to keep it in sync.
//
// Inline SVG, no dependency, no images. The game ships as one offline file.

import { CIRCUITS } from '../../data/circuits';
import { territoryDefinitionById } from '../../data/territories';
import { followingOf } from '../../engine/world/territories';
import type { Id, Territory } from '../../engine/types';

/** One colour per loop, so a circuit reads as a route rather than three dots. */
const CIRCUIT_STROKE: Record<string, string> = {
  hardRoad: '#b45309',
  oldCountry: '#0e7490',
  bigRooms: '#7e22ce',
  highWire: '#be123c',
};

/**
 * Market size as a radius. Square-rooted because the eye reads a disc by its
 * area — linear scaling would make Harborline Metro twenty-six times the
 * width of Bramble Hollow rather than the five times it actually is.
 */
function radiusFor(capacity: number): number {
  return 2.1 + Math.sqrt(capacity) / 48;
}

export interface TerritoryMapProps {
  territories: readonly Territory[];
  playerPromotionId: Id;
  /** Where tonight's show is booked. Drawn as the one town with a marker. */
  runningTerritoryId: Id | null;
  selectedTerritoryId: Id | null;
  onSelect: (territoryId: Id) => void;
  /** Names for the ownership legend. */
  nameOf: (promotionId: Id | null) => string | null;
}

export function TerritoryMap({
  territories,
  playerPromotionId,
  runningTerritoryId,
  selectedTerritoryId,
  onSelect,
  nameOf,
}: TerritoryMapProps) {
  const placed = territories
    .map((t) => ({ territory: t, at: territoryDefinitionById(t.id) }))
    .filter((entry): entry is { territory: Territory; at: NonNullable<typeof entry.at> } => Boolean(entry.at));
  const positionOf = new Map(placed.map((p) => [p.territory.id, { x: p.at.x, y: p.at.y }]));

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
      <svg viewBox="0 0 100 104" className="w-full" role="img" aria-label="The territories">
        <defs>
          {/* Your reach. A soft halo rather than a ring, because reach is a
              thing that fades at the edges rather than stopping. */}
          <radialGradient id="reach">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* The loops, drawn first so the towns sit on top of them. */}
        {CIRCUITS.map((circuit) => {
          const points = circuit.territoryIds
            .map((id) => positionOf.get(id))
            .filter((p): p is { x: number; y: number } => Boolean(p));
          if (points.length < 2) return null;
          return (
            <polygon
              key={circuit.id}
              points={points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={CIRCUIT_STROKE[circuit.id] ?? '#404040'}
              fillOpacity={0.07}
              stroke={CIRCUIT_STROKE[circuit.id] ?? '#404040'}
              strokeOpacity={0.55}
              strokeWidth={0.5}
              strokeLinejoin="round"
            />
          );
        })}

        {placed.map(({ territory, at }) => {
          const following = followingOf(territory, playerPromotionId);
          const mine = territory.ownerPromotionId === playerPromotionId;
          const held = territory.ownerPromotionId !== null;
          const r = radiusFor(territory.capacity);
          const selected = territory.id === selectedTerritoryId;
          const running = territory.id === runningTerritoryId;

          return (
            <g
              key={territory.id}
              onClick={() => onSelect(territory.id)}
              // Keyboard focus gets a ring; a tap does not. The browser's
              // default outline on a <g> is a rectangle around the whole
              // group, which boxes in the label and clips its first letter.
              className="cursor-pointer outline-none [&:focus-visible>circle:last-of-type]:stroke-white"
              role="button"
              tabIndex={0}
              aria-label={`${territory.name}, ${nameOf(territory.ownerPromotionId) ?? 'unclaimed'}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelect(territory.id);
              }}
            >
              {/* How over you are here, as light. */}
              {following > 0 && (
                <circle cx={at.x} cy={at.y} r={r + (following / 100) * 9} fill="url(#reach)" />
              )}

              {/* An oversized transparent disc so a thumb can hit a small town. */}
              <circle cx={at.x} cy={at.y} r={Math.max(r + 3, 6)} fill="transparent" />

              <circle
                cx={at.x}
                cy={at.y}
                r={r}
                fill={mine ? '#059669' : held ? '#9f1239' : '#404040'}
                stroke={selected ? '#fafafa' : running ? '#34d399' : '#171717'}
                strokeWidth={selected || running ? 0.9 : 0.5}
              />

              {/* Tonight's town gets a ring, so the map answers "where am I
                  running this week" without reading anything. */}
              {running && (
                <circle
                  cx={at.x}
                  cy={at.y}
                  r={r + 2.2}
                  fill="none"
                  stroke="#34d399"
                  strokeWidth={0.6}
                  strokeDasharray="1.6 1.4"
                />
              )}

              {/* Labels near an edge run inward from the node rather than
                  centring on it — "Harborline Metro" centred on a town at
                  x=88 runs off the side of the map. */}
              <text
                x={at.x > 78 ? at.x + r : at.x < 22 ? at.x - r : at.x}
                y={at.y + r + 3.4}
                textAnchor={at.x > 78 ? 'end' : at.x < 22 ? 'start' : 'middle'}
                fill={selected ? '#fafafa' : '#a3a3a3'}
                fontSize={3}
                className="select-none"
              >
                {territory.name}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-neutral-800 px-2 py-1.5 text-[10px] text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" /> yours
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-800" /> somebody else&apos;s
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-neutral-700" /> unclaimed
        </span>
        <span>bigger dot, bigger market · the glow is how over you are</span>
      </div>
    </div>
  );
}
