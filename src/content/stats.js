/**
 * Persistent player + opponent-roster records (localStorage, same pattern as render/menu.js's
 * level-unlock save). Never blocks play if storage is unavailable — a stats write failing
 * silently degrades to "stats don't persist," not a broken game.
 */
const KEY = 'taw:stats:v1';

function emptyRecord() {
  return {
    gamesPlayed: 0, wins: 0, losses: 0,
    bestTopSpeed: 0, longestSurvivalTurns: 0, mostDamageSurvived: 0,
    deathCauses: {}
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { player: emptyRecord(), roster: {} };
    const parsed = JSON.parse(raw);
    return {
      player: { ...emptyRecord(), ...parsed.player },
      roster: parsed.roster ?? {}
    };
  } catch {
    return { player: emptyRecord(), roster: {} };
  }
}

function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode, quota, ... */ }
}

export function getStats() {
  return load();
}

// participants: [{ number, isPlayer, won, alive, cause, topSpeed, damage, survivedTurns }]
// one entry per marble that was in the level, including the player. Returns the updated
// store so the caller (main.js) can render an end-of-round summary without a second read.
export function recordGame(participants) {
  const data = load();
  for (const p of participants) {
    const rec = p.isPlayer ? data.player : (data.roster[p.number] ??= emptyRecord());
    rec.gamesPlayed++;
    if (p.won) rec.wins++; else rec.losses++;
    rec.bestTopSpeed = Math.max(rec.bestTopSpeed, p.topSpeed);
    rec.longestSurvivalTurns = Math.max(rec.longestSurvivalTurns, p.survivedTurns);
    rec.mostDamageSurvived = Math.max(rec.mostDamageSurvived, p.damage);
    if (p.cause) rec.deathCauses[p.cause] = (rec.deathCauses[p.cause] ?? 0) + 1;
  }
  save(data);
  return data;
}
