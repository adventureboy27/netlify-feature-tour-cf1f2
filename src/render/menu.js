/**
 * DOM overlays for level select and the end-of-level screen — kept out of the canvas/WebGL
 * entirely, same as hud.js. Unlock progress is persisted to localStorage (docs/BUILD-ORDER.md
 * M10 "save state") so it survives a reload; a bad/missing/corrupt value just falls back to 0
 * rather than ever throwing, since this is a nice-to-have, not something worth breaking on.
 */
import { getStats } from '../content/stats.js';

const SAVE_KEY = 'taw:highestUnlocked';

function loadUnlocked() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function saveUnlocked(n) {
  try {
    localStorage.setItem(SAVE_KEY, String(n));
  } catch {
    // storage unavailable (private browsing, quota) — progress just won't persist
  }
}

export function createMenu(el, { levelCount, onSelect, onEndless }) {
  let highestUnlocked = loadUnlocked();
  let showingStats = false;

  function render() {
    el.innerHTML = '';
    if (showingStats) { renderStats(); return; }

    const title = document.createElement('h1');
    title.textContent = 'TAW';
    el.appendChild(title);

    const sub = document.createElement('p');
    sub.className = 'menu-sub';
    sub.textContent = 'Five marbles, one board, last one rolling wins.';
    el.appendChild(sub);

    const grid = document.createElement('div');
    grid.className = 'level-grid';
    for (let i = 0; i < levelCount; i++) {
      const btn = document.createElement('button');
      btn.textContent = String(i + 1);
      btn.className = 'level-btn';
      btn.disabled = i > highestUnlocked;
      if (!btn.disabled) btn.addEventListener('click', () => onSelect(i));
      grid.appendChild(btn);
    }
    el.appendChild(grid);

    if (highestUnlocked >= levelCount - 1) {
      const endless = document.createElement('button');
      endless.textContent = 'Endless';
      endless.className = 'level-btn endless-btn';
      endless.addEventListener('click', onEndless);
      el.appendChild(endless);
    }

    const statsBtn = document.createElement('button');
    statsBtn.textContent = 'Stats';
    statsBtn.className = 'level-btn wide-btn';
    statsBtn.addEventListener('click', () => { showingStats = true; render(); });
    el.appendChild(statsBtn);
  }

  // "keep stats, victories, losses... for the user's marble too" — the player's career
  // record plus every recurring opponent (content/roster.js) faced so far, most-played first.
  function renderStats() {
    const { player, roster } = getStats();

    const title = document.createElement('h1');
    title.textContent = 'Stats';
    el.appendChild(title);

    const you = document.createElement('p');
    you.className = 'menu-sub';
    you.textContent = `You: ${player.wins}W – ${player.losses}L over ${player.gamesPlayed} games`
      + (player.gamesPlayed ? ` · top speed ${player.bestTopSpeed.toFixed(2)} · longest run ${player.longestSurvivalTurns} turns` : '');
    el.appendChild(you);

    const entries = Object.entries(roster).sort((a, b) => b[1].gamesPlayed - a[1].gamesPlayed).slice(0, 12);
    if (entries.length) {
      const list = document.createElement('div');
      list.className = 'round-stats';
      for (const [number, rec] of entries) {
        const row = document.createElement('div');
        row.className = 'round-stats-row';
        row.textContent = `#${number}: ${rec.wins}W – ${rec.losses}L over ${rec.gamesPlayed} games`;
        list.appendChild(row);
      }
      el.appendChild(list);
    } else {
      const none = document.createElement('p');
      none.className = 'menu-sub';
      none.textContent = 'No opponents faced yet.';
      el.appendChild(none);
    }

    const back = document.createElement('button');
    back.textContent = 'Back';
    back.className = 'level-btn wide-btn';
    back.addEventListener('click', () => { showingStats = false; render(); });
    el.appendChild(back);
  }

  function unlock(n) {
    const next = Math.max(highestUnlocked, Math.min(levelCount - 1, n));
    if (next !== highestUnlocked) {
      highestUnlocked = next;
      saveUnlocked(highestUnlocked);
    }
  }

  function show() {
    el.style.display = 'flex';
    render();
  }

  function hide() {
    el.style.display = 'none';
  }

  return { show, hide, unlock };
}

const CAUSE_LABEL = {
  burned: 'burned', drowned: 'drowned', fell: 'fell', shattered: 'shattered',
  crushed: 'crushed', 'knocked out': 'knocked out'
};

export function createEndOverlay(el, { onNext, onMenu }) {
  // round: { participants, stats } from main.js's win handler (content/stats.js shape) —
  // optional so callers that don't have it yet (there shouldn't be any) still get a screen.
  function show(winner, hasNext, round) {
    el.innerHTML = '';
    el.style.display = 'flex';

    const msg = document.createElement('h2');
    msg.textContent = winner.isPlayer ? 'You win' : `You lose — marble #${winner.number} wins`;
    el.appendChild(msg);

    if (round) {
      const career = document.createElement('p');
      career.className = 'menu-sub';
      career.textContent = `Your record: ${round.stats.player.wins}W – ${round.stats.player.losses}L`;
      el.appendChild(career);

      const table = document.createElement('div');
      table.className = 'round-stats';
      const ranked = [...round.participants].sort((a, b) => {
        if (a.won !== b.won) return a.won ? -1 : 1;
        return b.survivedTurns - a.survivedTurns;
      });
      for (const p of ranked) {
        const row = document.createElement('div');
        row.className = 'round-stats-row';
        const who = p.isPlayer ? 'You' : `#${p.number}`;
        const result = p.won ? 'won' : `out — ${CAUSE_LABEL[p.cause] ?? p.cause ?? 'unresolved'}`;
        row.textContent = `${who}: ${result} · turn ${p.survivedTurns} · top speed ${p.topSpeed.toFixed(2)} · damage ${Math.round(p.damage * 100)}%`;
        if (p.isPlayer) row.classList.add('round-stats-row--player');
        table.appendChild(row);
      }
      el.appendChild(table);
    }

    if (hasNext) {
      const next = document.createElement('button');
      next.textContent = 'Next Level';
      next.className = 'level-btn wide-btn';
      next.addEventListener('click', onNext);
      el.appendChild(next);
    }

    const menu = document.createElement('button');
    menu.textContent = 'Level Select';
    menu.className = 'level-btn wide-btn';
    menu.addEventListener('click', onMenu);
    el.appendChild(menu);
  }

  function hide() {
    el.style.display = 'none';
  }

  return { show, hide };
}
