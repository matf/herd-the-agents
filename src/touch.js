// Phones and tablets: the main input is a finger, not a mouse.
export const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches;

// The game is upright. On a touch device held sideways, cover it with "please hold your phone
// upright" and pause it.
export function watchOrientation(game) {
  if (!IS_TOUCH) return;
  const overlay = document.getElementById('rotate');
  const landscape = window.matchMedia('(orientation: landscape)');
  const check = () => {
    overlay.classList.toggle('show', landscape.matches);
    if (landscape.matches) game.pause();
    else game.resume();
  };
  landscape.addEventListener('change', check);
  check();
}

// Size the game box to exactly the visible screen, minus the iPhone's notch and home bar.
// Phones sometimes report the old size for a moment after turning or after the browser's bars
// slide away, so measure the visible area ourselves, again a few times after every change.
export function keepFitted(game) {
  const box = document.getElementById('game');
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.append(probe);

  const fit = () => {
    const vv = window.visualViewport;
    const width = vv ? vv.width : window.innerWidth;
    const height = vv ? vv.height : window.innerHeight;
    const s = getComputedStyle(probe);
    const [top, right, bottom, left] = ['Top', 'Right', 'Bottom', 'Left'].map(
      (side) => parseFloat(s[`padding${side}`]) || 0,
    );
    Object.assign(box.style, {
      top: `${top}px`,
      left: `${left}px`,
      width: `${Math.max(0, width - left - right)}px`,
      height: `${Math.max(0, height - top - bottom)}px`,
      right: 'auto',
      bottom: 'auto',
    });
    game.scale.refresh();
  };
  const fitSoon = () => {
    fit();
    for (const ms of [100, 300, 700, 1500]) setTimeout(fit, ms);
  };

  window.addEventListener('resize', fitSoon);
  window.addEventListener('orientationchange', fitSoon);
  window.visualViewport?.addEventListener('resize', fitSoon);
  fitSoon();
}
