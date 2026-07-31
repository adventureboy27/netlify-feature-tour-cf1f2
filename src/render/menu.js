/**
 * DOM overlays for level select and the end-of-level screen — kept out of the canvas/WebGL
 * entirely, same as hud.js. No persistence yet (docs/BUILD-ORDER.md M10 "save state"): the
 * unlock curve lives in memory for the session and resets on reload.
 */
export function createMenu(el, { levelCount, onSelect, onEndless }) {
  let highestUnlocked = 0;

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
    highestUnlocked = Math.max(highestUnlocked, Math.min(levelCount - 1, n));
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
