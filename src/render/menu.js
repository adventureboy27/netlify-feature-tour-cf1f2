/**
 * DOM overlays for level select and the end-of-level screen — kept out of the canvas/WebGL
 * entirely, same as hud.js. Unlock progress is persisted to localStorage (docs/BUILD-ORDER.md
 * M10 "save state") so it survives a reload; a bad/missing/corrupt value just falls back to 0
 * rather than ever throwing, since this is a nice-to-have, not something worth breaking on.
 */
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

  function render() {
    el.innerHTML = '';

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

export function createEndOverlay(el, { onNext, onMenu }) {
  function show(winner, hasNext) {
    el.innerHTML = '';
    el.style.display = 'flex';

    const msg = document.createElement('h2');
    msg.textContent = winner.isPlayer ? 'You win' : 'You lose';
    el.appendChild(msg);

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
