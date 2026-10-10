/* Kuntechnology root-site visual effects. GSAP is loaded locally before this file. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mapPanel = $('#project-map');
  const glCanvas = $('#energy-field');
  const cards = $$('.project-card');
  const mapNodes = $$('.node-link');
  const mapCore = $('.map-core');
  const mapGlow = $('.map-core-glow');
  const search = $('#project-search');
  const filters = $$('.filter-btn');
  const gsap = window.gsap || null;
  const fx = window.__kuntechFx || (window.__kuntechFx = {});

  fx.gsap = Boolean(gsap);
  fx.gsapPaused = true;
  fx.reducedMotion = motionQuery.matches;
  fx.webgl = fx.webgl || { state: 'pending', frames: 0, animatedFrames: 0, paused: true };

  function setEngine(name, state, label) {
    const chip = document.getElementById(`${name}-engine`);
    const value = document.getElementById(`${name}-value`);
    if (chip) chip.dataset.state = state;
    if (value) value.textContent = label;
  }

  const hasCanvas2D = Boolean($('#field')?.getContext('2d'));
  if (hasCanvas2D) {
    fx.canvas = fx.canvas || { state: 'ready', frames: 0, paused: true };
    setEngine('canvas', motionQuery.matches ? 'static' : 'live', motionQuery.matches ? 'STATIC' : 'LIVE');
  } else {
    fx.canvas = { state: 'fallback', frames: 0, paused: true };
    setEngine('canvas', 'fallback', 'CSS BACKUP');
  }

  const vertexSource = `
    attribute vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_pointer;
    void main() {
      vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
      p += (u_pointer - 0.5) * 0.035;
      float r = length(p);
      float angle = atan(p.y, p.x);
      float sphereRadius = 0.275;
      float inside = 1.0 - smoothstep(sphereRadius - 0.012, sphereRadius + 0.006, r);
      float latitude = asin(clamp(p.y / sphereRadius, -1.0, 1.0));
      float longitudeLine = 1.0 - smoothstep(0.0, 0.075, abs(sin(angle * 15.0 + u_time * 0.10)));
      float latitudeLine = 1.0 - smoothstep(0.0, 0.070, abs(sin(latitude * 18.0 - u_time * 0.06)));
      float mesh = max(longitudeLine, latitudeLine * 0.72) * inside;
      float rim = exp(-abs(r - sphereRadius) * 42.0) * 0.42;
      float halo = exp(-r * 7.0) * 0.10;
      float scanY = sin(u_time * 0.34) * 0.17;
      float scan = exp(-abs(p.y - scanY) * 42.0) * inside * 0.10;
      float pulse = 0.5 + 0.5 * sin(u_time * 0.72);
      vec3 deep = vec3(0.018, 0.070, 0.145);
      vec3 cyan = vec3(0.20, 0.82, 0.98);
      vec3 violet = vec3(0.32, 0.24, 0.75);
      vec3 color = mix(deep, cyan, mesh * 0.82 + rim * 0.36 + scan);
      color += violet * inside * 0.16;
      float alpha = clamp(inside * (0.22 + mesh * 0.24 + pulse * 0.035) + rim + halo + scan, 0.0, 0.58);
      gl_FragColor = vec4(color, alpha);
    }
  `;

  let gl = null;
  let program = null;
  let vertexBuffer = null;
  let resolutionLocation = null;
  let timeLocation = null;
  let pointerLocation = null;
  let glReady = false;
  let glAttempted = false;
  let glFrame = 0;
  let glLastPaint = 0;
  let glInView = true;
  let glWidth = 0;
  let glHeight = 0;
  let pointerX = 0.5;
  let pointerY = 0.5;
  let mapObserver = null;

  function setWebGL(state, label, renderer = state) {
    if (mapPanel) mapPanel.dataset.renderer = renderer;
    fx.webgl.state = state;
    setEngine('webgl', state === 'live' ? 'live' : (state === 'fallback' || state === 'context-lost' ? 'fallback' : 'static'), label);
  }

  function stopWebGL() {
    if (glFrame) cancelAnimationFrame(glFrame);
    glFrame = 0;
    fx.webgl.paused = true;
  }

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('WebGL shader allocation failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || 'WebGL shader compilation failed';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function sizeWebGL() {
    if (!glReady || !gl || !mapPanel || !glCanvas) return;
    const rect = mapPanel.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const desiredDpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const pixelCap = Math.sqrt(900000 / (rect.width * rect.height));
    const dpr = Math.max(0.75, Math.min(desiredDpr, pixelCap));
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (width !== glWidth || height !== glHeight) {
      glWidth = width;
      glHeight = height;
      glCanvas.width = width;
      glCanvas.height = height;
      gl.viewport(0, 0, width, height);
      drawWebGL(0);
    }
  }

  function drawWebGL(timeSeconds) {
    if (!glReady || !gl) return;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(resolutionLocation, glCanvas.width, glCanvas.height);
    gl.uniform1f(timeLocation, timeSeconds);
    gl.uniform2f(pointerLocation, pointerX, pointerY);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    fx.webgl.frames += 1;
    if (timeSeconds > 0) fx.webgl.animatedFrames += 1;
  }

  function webGLCanRun() {
    return glReady && glInView && !document.hidden && !motionQuery.matches;
  }

  function renderWebGL(time) {
    if (!webGLCanRun()) {
      glFrame = 0;
      fx.webgl.paused = true;
      return;
    }
    if (time - glLastPaint >= 1000 / 30) {
      drawWebGL(time * 0.001);
      glLastPaint = time;
    }
    glFrame = requestAnimationFrame(renderWebGL);
  }

  function syncWebGL() {
    if (!glReady) return;
    if (!webGLCanRun()) {
      stopWebGL();
      if (motionQuery.matches) drawWebGL(0);
      return;
    }
    if (!glFrame) {
      fx.webgl.paused = false;
      glFrame = requestAnimationFrame(renderWebGL);
    }
  }

  function setupWebGL() {
    if (!mapPanel || !glCanvas) return false;
    const rect = mapPanel.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    glAttempted = true;
    try {
      const options = { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' };
      gl = glCanvas.getContext('webgl', options) || glCanvas.getContext('experimental-webgl', options);
      if (!gl) throw new Error('WebGL unavailable');
      const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
      const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
      program = gl.createProgram();
      if (!program) throw new Error('WebGL program allocation failed');
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.bindAttribLocation(program, 0, 'a_position');
      gl.linkProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'WebGL program link failed');
      vertexBuffer = gl.createBuffer();
      if (!vertexBuffer) throw new Error('WebGL buffer allocation failed');
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
      timeLocation = gl.getUniformLocation(program, 'u_time');
      pointerLocation = gl.getUniformLocation(program, 'u_pointer');
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      glReady = true;
      fx.webgl.frames = 0;
      fx.webgl.animatedFrames = 0;
      setWebGL('live', motionQuery.matches ? 'STATIC' : 'LIVE', 'webgl');
      glCanvas.style.opacity = '0.92';
      sizeWebGL();
      if (!mapObserver && 'IntersectionObserver' in window) {
        mapObserver = new IntersectionObserver(entries => {
          const entry = entries[0];
          glInView = Boolean(entry && entry.isIntersecting);
          syncWebGL();
        }, { threshold: 0.08 });
        mapObserver.observe(mapPanel);
      }
      syncWebGL();
      return true;
    } catch (_) {
      glReady = false;
      stopWebGL();
      if (program && gl) gl.deleteProgram(program);
      if (vertexBuffer && gl) gl.deleteBuffer(vertexBuffer);
      program = null;
      vertexBuffer = null;
      if (glCanvas) glCanvas.style.opacity = '0';
      setWebGL('fallback', 'CSS STATIC', 'fallback');
      return false;
    }
  }

  if (mapPanel && glCanvas) {
    glCanvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      glReady = false;
      stopWebGL();
      glCanvas.style.opacity = '0';
      setWebGL('context-lost', 'STATIC BACKUP', 'context-lost');
    });
    glCanvas.addEventListener('webglcontextrestored', () => {
      glReady = false;
      setupWebGL();
    });
    mapPanel.addEventListener('pointermove', event => {
      const rect = mapPanel.getBoundingClientRect();
      if (rect.width && rect.height) {
        pointerX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        pointerY = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      }
    }, { passive: true });
    mapPanel.addEventListener('pointerleave', () => { pointerX = 0.5; pointerY = 0.5; }, { passive: true });
    if (mapPanel.getBoundingClientRect().width) {
      setupWebGL();
    } else {
      setWebGL('static-mobile', 'MOBILE STATIC', 'static-mobile');
    }
    if ('ResizeObserver' in window) {
      const resizeObserver = new ResizeObserver(() => sizeWebGL());
      resizeObserver.observe(mapPanel);
    }
    window.addEventListener('resize', () => {
      if (!glReady && !glAttempted && mapPanel.getBoundingClientRect().width) setupWebGL();
      else { sizeWebGL(); syncWebGL(); }
    }, { passive: true });
  } else {
    setWebGL('fallback', 'CSS STATIC', 'fallback');
  }

  const hoverTweens = new WeakMap();
  const revealTweens = new WeakMap();
  let introTimeline = null;
  let corePulse = null;
  let revealObserver = null;
  let gsapStarted = false;

  function shouldAnimate() {
    return Boolean(gsap && !motionQuery.matches && !document.hidden);
  }

  function animateCardIn(card, delay = 0) {
    if (!shouldAnimate() || card.hidden) return;
    const rect = card.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    revealTweens.get(card)?.kill();
    const tween = gsap.fromTo(card,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.48, delay, ease: 'power2.out', overwrite: 'auto', onComplete: () => {
        gsap.set(card, { clearProps: 'opacity,transform' });
        revealTweens.delete(card);
      } }
    );
    revealTweens.set(card, tween);
  }

  function ensureRevealObserver() {
    if (revealObserver || !('IntersectionObserver' in window)) return;
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCardIn(entry.target);
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -5% 0px' });
    cards.forEach(card => revealObserver.observe(card));
  }

  function playGSAP() {
    if (!gsap || !shouldAnimate() || gsapStarted) return;
    gsapStarted = true;
    fx.gsapPaused = false;
    document.documentElement.dataset.gsap = 'ready';
    setEngine('gsap', 'live', 'READY');
    introTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
    introTimeline
      .fromTo('.hero-intro .eyebrow', { autoAlpha: 0, x: -12 }, { autoAlpha: 1, x: 0, duration: 0.48 }, 0)
      .fromTo('#page-title', { autoAlpha: 0, y: 23 }, { autoAlpha: 1, y: 0, duration: 0.72 }, 0.06)
      .fromTo('.hero-copy', { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.62 }, 0.16)
      .fromTo('.hero-actions', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.54 }, 0.25)
      .fromTo('.hero-facts', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 0.32)
      .fromTo('.map-panel', { autoAlpha: 0, scale: 0.965 }, { autoAlpha: 1, scale: 1, duration: 0.88 }, 0.1)
      .fromTo(mapNodes, { autoAlpha: 0, scale: 0.82, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 0.62, stagger: 0.085, ease: 'back.out(1.45)' }, 0.55);
    if (mapGlow) {
      corePulse = gsap.to(mapGlow, { scale: 1.08, opacity: 0.78, transformOrigin: '50% 50%', duration: 2.8, ease: 'sine.inOut', repeat: -1, yoyo: true });
    }
    ensureRevealObserver();
  }

  function stopGSAPForReducedMotion() {
    if (!gsap) return;
    if (introTimeline) introTimeline.kill();
    if (corePulse) corePulse.kill();
    introTimeline = null;
    corePulse = null;
    cards.forEach(card => {
      revealTweens.get(card)?.kill();
      const launch = $('.launch', card);
      if (launch) hoverTweens.get(launch)?.kill();
    });
    if (mapCore) hoverTweens.get(mapCore)?.kill();
    gsap.killTweensOf([mapGlow, mapCore, ...mapNodes, ...cards, ...cards.map(card => $('.launch', card)).filter(Boolean)].filter(Boolean));
    gsap.set(['.hero-intro > *', '.map-panel', '.node-link', '.map-core-glow', '.map-core', '.project-card', '.launch'], { clearProps: 'opacity,transform,visibility' });
    gsapStarted = false;
    fx.gsapPaused = true;
    document.documentElement.dataset.gsap = 'static';
    setEngine('gsap', 'static', 'STATIC');
  }

  if (gsap) {
    setEngine('gsap', motionQuery.matches ? 'static' : 'live', motionQuery.matches ? 'STATIC' : 'READY');
    document.documentElement.dataset.gsap = motionQuery.matches ? 'static' : 'ready';
    if (!motionQuery.matches && !document.hidden) playGSAP();
    if (cards.length) {
      const visibleState = new Map(cards.map(card => [card, !card.hidden]));
      const animateNewCards = () => requestAnimationFrame(() => {
        let order = 0;
        cards.forEach(card => {
          const visible = !card.hidden;
          if (visible && !visibleState.get(card)) animateCardIn(card, order++ * 0.045);
          visibleState.set(card, visible);
        });
      });
      filters.forEach(button => button.addEventListener('click', animateNewCards));
      search?.addEventListener('input', animateNewCards);
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && document.activeElement === search) animateNewCards();
      });
    }

    const coreFeedback = active => {
      if (!shouldAnimate() || !mapCore) return;
      hoverTweens.get(mapCore)?.kill();
      const tween = gsap.to(mapCore, { scale: active ? 1.11 : 1, transformOrigin: '50% 50%', duration: active ? 0.24 : 0.34, ease: active ? 'back.out(2)' : 'power2.out', overwrite: 'auto' });
      hoverTweens.set(mapCore, tween);
    };
    [...cards, ...mapNodes].forEach(item => {
      item.addEventListener('pointerenter', () => coreFeedback(true));
      item.addEventListener('pointerleave', () => coreFeedback(false));
      item.addEventListener('focus', () => coreFeedback(true));
      item.addEventListener('blur', () => coreFeedback(false));
    });
  } else {
    fx.gsapPaused = true;
    document.documentElement.dataset.gsap = 'fallback';
    setEngine('gsap', 'fallback', 'CSS ONLY');
  }

  function onMotionPreferenceChange() {
    fx.reducedMotion = motionQuery.matches;
    if (motionQuery.matches) {
      stopGSAPForReducedMotion();
      if (glReady) drawWebGL(0);
    } else if (!document.hidden) {
      if (gsap) playGSAP();
    }
    syncWebGL();
    if (fx.canvas) fx.canvas.paused = motionQuery.matches || document.hidden;
    setEngine('canvas', !hasCanvas2D ? 'fallback' : (motionQuery.matches ? 'static' : 'live'), !hasCanvas2D ? 'CSS BACKUP' : (motionQuery.matches ? 'STATIC' : 'LIVE'));
  }

  if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionPreferenceChange);
  else motionQuery.addListener?.(onMotionPreferenceChange);

  document.addEventListener('visibilitychange', () => {
    const paused = document.hidden || motionQuery.matches;
    if (gsap) {
      if (paused) {
        gsap.globalTimeline.pause();
        fx.gsapPaused = true;
      } else {
        if (!gsapStarted) playGSAP();
        gsap.globalTimeline.resume();
        fx.gsapPaused = false;
      }
    }
    syncWebGL();
    if (fx.canvas) fx.canvas.paused = paused;
  });

  window.addEventListener('pagehide', () => {
    stopWebGL();
    if (gsap) gsap.globalTimeline.pause();
  });
})();
