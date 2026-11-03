(() => {
  'use strict';

  const clock = document.getElementById('local-time');
  if (!clock) return;

  let timer;

  const render = () => {
    const now = new Date();
    const value = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map(part => String(part).padStart(2, '0'))
      .join(':');

    clock.textContent = value;
    clock.dateTime = value;
    clock.parentElement.hidden = false;
    timer = window.setTimeout(render, 1000 - (Date.now() % 1000));
  };

  const sync = () => {
    window.clearTimeout(timer);
    if (!document.hidden) render();
  };

  document.addEventListener('visibilitychange', sync);
  sync();
})();
