/* Lightweight pointer comet, liquid-link response, and accessible motion control. */
(() => {
  'use strict';

  const root = document.documentElement;
  const trailCanvas = document.getElementById('pointer-trails');
  const cursor = document.getElementById('custom-cursor');
  const spotlight = document.getElementById('spotlight');
  const pauseButton = document.getElementById('motion-toggle');
  const pauseLabel = pauseButton?.querySelector('.motion-label');
  const links = [...document.querySelectorAll('.index-link')];
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const poolSize = 36;
  const pool = Array.from({ length: poolSize }, () => ({ active: false }));
  const fx = window.__kuntechFx || (window.__kuntechFx = {});
  let context = null;
  let scale = 1;
  let poolIndex = 0;
  let raf = 0;
  let lastDraw = 0;
  let lastEmission = 0;
  let lastPointer = null;
  let pointerSeen = false;
  let manuallyPaused = false;
  let lastSpotlightUpdate = -Infinity;
  let spotlightTimer = 0;
  let pendingSpotlight = null;

  function clearSpotlight() {
    if (spotlightTimer) window.clearTimeout(spotlightTimer);
    spotlightTimer = 0;
    pendingSpotlight = null;
    root.dataset.spotlightActive = 'false';
    lastSpotlightUpdate = -Infinity;
  }

  function applySpotlight(point, now) {
    lastSpotlightUpdate = now;
    root.dataset.keyboardNavigation = 'false';
    root.style.setProperty('--spotlight-x', `${point.x}px`);
    root.style.setProperty('--spotlight-y', `${point.y}px`);
    root.dataset.spotlightActive = 'true';
  }

  function updateSpotlight(event, now) {
    if (!spotlight || !finePointer.matches || motion.matches || manuallyPaused || document.hidden) return;
    const point = { x: event.clientX, y: event.clientY };
    const delay = 1000 / 30 - (now - lastSpotlightUpdate);
    if (delay <= 0) {
      if (spotlightTimer) window.clearTimeout(spotlightTimer);
      spotlightTimer = 0;
      pendingSpotlight = null;
      applySpotlight(point, now);
      return;
    }
    pendingSpotlight = point;
    if (!spotlightTimer) {
      spotlightTimer = window.setTimeout(() => {
        spotlightTimer = 0;
        const latest = pendingSpotlight;
        pendingSpotlight = null;
        if (latest && finePointer.matches && !motion.matches && !manuallyPaused && !document.hidden) {
          applySpotlight(latest, performance.now());
        }
      }, delay);
    }
  }

  Object.assign(fx, {
    pointerTrailPoolSize: poolSize,
    pointerTrailActiveCount: 0,
    pointerTrailHighWatermark: 0,
    pointerTrailEmitted: 0
  });

  function resizeCanvas() {
    if (!trailCanvas || !context) return;
    const area = Math.max(1, innerWidth * innerHeight);
    scale = Math.min(devicePixelRatio || 1, 1.1, Math.sqrt(1100000 / area));
    trailCanvas.width = Math.max(1, Math.round(innerWidth * scale));
    trailCanvas.height = Math.max(1, Math.round(innerHeight * scale));
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, innerWidth, innerHeight);
  }

  function allowed() {
    return Boolean(context && finePointer.matches && !motion.matches && !manuallyPaused && !document.hidden);
  }

  function resetLinks() {
    for (const link of links) {
      link.style.setProperty('--impact', '0');
      link.style.setProperty('--collision-x', '0');
      link.style.setProperty('--collision-y', '0');
      link.style.setProperty('--link-glow-x', '50%');
      link.style.setProperty('--link-glow-y', '50%');
      link.classList.remove('is-liquid', 'is-colliding', 'is-pressed');
    }
  }

  function clearPointerEffects() {
    for (const particle of pool) particle.active = false;
    fx.pointerTrailActiveCount = 0;
    if (context && trailCanvas) context.clearRect(0, 0, innerWidth, innerHeight);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastPointer = null;
    lastEmission = 0;
    resetLinks();
    cursor?.classList.remove('is-near', 'is-press', 'is-visible');
    clearSpotlight();
    root.dataset.customCursor = 'false';
  }
  window.__kuntechClearPointerEffects = clearPointerEffects;

  function updateMotionButton() {
    if (!pauseButton) return;
    if (motion.matches) {
      pauseButton.disabled = true;
      pauseButton.setAttribute('aria-pressed', 'true');
      pauseButton.setAttribute('aria-label', '动态效果已按系统设置减少');
      if (pauseLabel) pauseLabel.textContent = '动态已减少';
      return;
    }
    pauseButton.disabled = false;
    pauseButton.setAttribute('aria-pressed', String(manuallyPaused));
    pauseButton.setAttribute('aria-label', manuallyPaused ? '恢复动态效果' : '暂停动态效果');
    if (pauseLabel) pauseLabel.textContent = manuallyPaused ? '恢复动态' : '暂停动态';
  }

  function updateAvailability() {
    updateMotionButton();
    if (!allowed()) clearPointerEffects();
  }

  function distanceToRect(x, y, rect) {
    const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
    const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
    return Math.hypot(dx, dy);
  }

  function updateLinkResponse(x, y) {
    let nearest = null;
    let bestDistance = Infinity;
    links.forEach((link, index) => {
      const rect = link.getBoundingClientRect();
      const distance = distanceToRect(x, y, rect);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = { link, index, rect };
      }
    });

    const influence = nearest ? Math.max(0, 1 - bestDistance / 92) : 0;
    const nearEnough = Boolean(nearest && bestDistance <= 42);
    cursor?.classList.toggle('is-near', nearEnough);

    links.forEach((link, index) => {
      let impact = 0;
      let pushX = 0;
      let pushY = 0;
      const active = Boolean(nearest && index === nearest.index && influence > 0);
      const adjacent = Boolean(nearest && Math.abs(index - nearest.index) === 1 && influence > 0);
      const rect = link.getBoundingClientRect();
      if (active) {
        impact = influence;
        const localX = Math.max(0, Math.min(rect.width, x - rect.left));
        const localY = Math.max(0, Math.min(rect.height, y - rect.top));
        link.style.setProperty('--link-glow-x', `${localX.toFixed(1)}px`);
        link.style.setProperty('--link-glow-y', `${localY.toFixed(1)}px`);
        pushX = -Math.sign(x - (rect.left + rect.width / 2)) * influence * 1.6;
        pushY = -Math.sign(y - (rect.top + rect.height / 2)) * influence * 2.2;
      } else if (adjacent) {
        impact = influence * .18;
        pushY = Math.sign(index - nearest.index) * influence * 4.2;
        link.style.setProperty('--link-glow-x', '50%');
        link.style.setProperty('--link-glow-y', '50%');
      } else {
        link.style.setProperty('--link-glow-x', '50%');
        link.style.setProperty('--link-glow-y', '50%');
      }
      link.style.setProperty('--impact', impact.toFixed(3));
      link.style.setProperty('--collision-x', pushX.toFixed(2));
      link.style.setProperty('--collision-y', pushY.toFixed(2));
      link.classList.toggle('is-liquid', active && nearEnough);
      link.classList.toggle('is-colliding', adjacent && nearEnough);
    });
  }

  function emitTrail(x, y, now) {
    if (lastPointer) {
      const dx = x - lastPointer.x;
      const dy = y - lastPointer.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= 7 && now - lastEmission >= 6) {
        const count = Math.min(5, Math.max(1, Math.floor(distance / 12)));
        const ux = dx / distance;
        const uy = dy / distance;
        for (let i = 1; i <= count; i++) {
          const t = i / (count + 1);
          const particle = pool[poolIndex];
          poolIndex = (poolIndex + 1) % poolSize;
          particle.active = true;
          particle.x = lastPointer.x + dx * t;
          particle.y = lastPointer.y + dy * t;
          particle.ux = ux;
          particle.uy = uy;
          particle.born = now;
          particle.life = 540 + Math.random() * 280;
          particle.drift = 20 + Math.random() * 38;
          particle.tail = 11 + Math.random() * 21;
          particle.radius = .9 + Math.random() * .95;
          particle.width = .8 + Math.random() * .85;
          particle.alpha = .48 + Math.random() * .38;
          fx.pointerTrailEmitted++;
        }
        lastEmission = now;
        scheduleDraw();
      }
    }
    lastPointer = { x, y };
  }

  function scheduleDraw() {
    if (!raf && allowed()) raf = requestAnimationFrame(drawTrail);
  }

  function drawTrail(now) {
    raf = 0;
    if (!allowed() || !context || !trailCanvas) {
      clearPointerEffects();
      return;
    }
    if (now - lastDraw < 1000 / 30) {
      raf = requestAnimationFrame(drawTrail);
      return;
    }
    lastDraw = now;
    context.clearRect(0, 0, innerWidth, innerHeight);
    let activeCount = 0;
    for (const particle of pool) {
      if (!particle.active) continue;
      const progress = Math.max(0, (now - particle.born) / particle.life);
      if (progress >= 1) {
        particle.active = false;
        continue;
      }
      activeCount++;
      const fade = Math.pow(1 - progress, 1.28) * particle.alpha;
      const drift = particle.drift * progress;
      const headX = particle.x - particle.ux * drift;
      const headY = particle.y - particle.uy * drift;
      const tailX = headX - particle.ux * particle.tail * (1 - progress * .32);
      const tailY = headY - particle.uy * particle.tail * (1 - progress * .32);
      const gradient = context.createLinearGradient(headX, headY, tailX, tailY);
      gradient.addColorStop(0, `rgba(220,246,255,${fade})`);
      gradient.addColorStop(.38, `rgba(143,211,243,${fade * .62})`);
      gradient.addColorStop(1, 'rgba(92,155,199,0)');
      context.beginPath();
      context.moveTo(headX, headY);
      context.lineTo(tailX, tailY);
      context.strokeStyle = gradient;
      context.lineWidth = particle.width * (1 - progress * .45);
      context.stroke();
      context.beginPath();
      context.arc(headX, headY, particle.radius * (1 - progress * .3), 0, Math.PI * 2);
      context.fillStyle = `rgba(220,246,255,${fade * .82})`;
      context.fill();
    }
    fx.pointerTrailActiveCount = activeCount;
    fx.pointerTrailHighWatermark = Math.max(fx.pointerTrailHighWatermark || 0, activeCount);
    if (activeCount) raf = requestAnimationFrame(drawTrail);
  }

  function handlePointerMove(event) {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    const now = performance.now();
    updateSpotlight(event, now);
    if (!allowed()) return;
    pointerSeen = true;
    root.dataset.keyboardNavigation = 'false';
    root.dataset.customCursor = 'true';
    cursor?.style.setProperty('--cursor-x', `${event.clientX}px`);
    cursor?.style.setProperty('--cursor-y', `${event.clientY}px`);
    cursor?.classList.add('is-visible');
    updateLinkResponse(event.clientX, event.clientY);
    emitTrail(event.clientX, event.clientY, now);
  }

  function handleClick(event, link) {
    const rect = link.getBoundingClientRect();
    const hasPointerPosition = event.detail > 0 && (event.clientX !== 0 || event.clientY !== 0);
    const x = hasPointerPosition ? event.clientX - rect.left : rect.width / 2;
    const y = hasPointerPosition ? event.clientY - rect.top : rect.height / 2;
    link.style.setProperty('--click-x', `${Math.max(0, Math.min(rect.width, x))}px`);
    link.style.setProperty('--click-y', `${Math.max(0, Math.min(rect.height, y))}px`);
    link.classList.remove('is-clicked');
    void link.offsetWidth;
    link.classList.add('is-clicked');
    if (cursor && allowed() && finePointer.matches) cursor.classList.add('is-press');
    window.setTimeout(() => {
      link.classList.remove('is-clicked', 'is-pressed');
      cursor?.classList.remove('is-press');
    }, 520);
  }

  function bindLinks() {
    links.forEach(link => {
      let wave = link.querySelector('.click-wave');
      if (!wave) {
        wave = document.createElement('span');
        wave.className = 'click-wave';
        wave.setAttribute('aria-hidden', 'true');
        link.insertBefore(wave, link.querySelector('.art-caption'));
      }
      let staticRing = link.querySelector('.click-static');
      if (!staticRing) {
        staticRing = document.createElement('span');
        staticRing.className = 'click-static';
        staticRing.setAttribute('aria-hidden', 'true');
        link.insertBefore(staticRing, link.querySelector('.art-caption'));
      }
      link.addEventListener('click', event => handleClick(event, link));
      link.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' && allowed()) {
          link.classList.add('is-pressed');
          cursor?.classList.add('is-press');
        }
      }, { passive: true });
      link.addEventListener('pointerup', () => link.classList.remove('is-pressed'), { passive: true });
      link.addEventListener('pointercancel', () => link.classList.remove('is-pressed'), { passive: true });
    });
  }

  function setManualPause(value) {
    if (motion.matches) return;
    manuallyPaused = Boolean(value);
    if (window.__kuntechSetMotionPaused) window.__kuntechSetMotionPaused(manuallyPaused);
    updateMotionButton();
    if (manuallyPaused) clearPointerEffects();
  }

  if (trailCanvas) {
    context = trailCanvas.getContext('2d', { alpha: true });
    resizeCanvas();
  }
  root.dataset.customCursor = 'false';
  root.dataset.keyboardNavigation = 'false';
  root.dataset.spotlightActive = 'false';
  root.dataset.motionStopped = 'false';
  bindLinks();
  updateMotionButton();
  updateAvailability();

  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  window.addEventListener('resize', resizeCanvas, { passive: true });
  window.addEventListener('blur', clearPointerEffects, { passive: true });
  window.addEventListener('mouseout', event => {
    if (!event.relatedTarget) clearPointerEffects();
  }, { passive: true });
  document.addEventListener('keydown', event => {
    if (event.key === 'Tab' || event.key.startsWith('Arrow')) {
      root.dataset.keyboardNavigation = 'true';
      cursor?.classList.remove('is-visible', 'is-near', 'is-press');
      clearSpotlight();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearPointerEffects();
  });
  pauseButton?.addEventListener('click', () => setManualPause(!manuallyPaused));

  const onMotionChange = () => {
    if (motion.matches) clearPointerEffects();
    updateAvailability();
  };
  const onPointerChange = () => {
    if (!finePointer.matches) clearPointerEffects();
    updateAvailability();
  };
  if (motion.addEventListener) motion.addEventListener('change', onMotionChange);
  else motion.addListener?.(onMotionChange);
  if (finePointer.addEventListener) finePointer.addEventListener('change', onPointerChange);
  else finePointer.addListener?.(onPointerChange);
})();
