/* A local-only particle network drawn into the existing ambient canvas. */
(() => {
  'use strict';

  const TOKENS = Object.freeze({
    color: '238,245,251', linkColor: '211,228,241',
    radiusMin: .6, radiusMax: 1.8, alphaMin: .32, alphaMax: .66,
    desktopLinkAlpha: .24, mobileLinkAlpha: .62,
    desktopLinkWidth: .65, mobileLinkWidth: .9,
    desktopDistance: 168, mobileDistance: 148,
    desktopMin: 36, desktopMax: 72, desktopArea: 21000,
    mobileMin: 16, mobileMax: 24, mobileArea: 15000,
    glowScale: 5.5, maxGlows: 3, glowLifeMin: 1.5, glowLifeRange: 1.1,
    glowGapMin: .85, glowGapRange: 1.4, speedMin: 7, speedMax: 15,
    repelRadius: 126, repelStrength: 360, impulseMax: 70,
    impulseDamping: 4.2, maxDelta: .05, maxFrameDelta: .25
  });
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  class ParticleField {
    constructor(diagnostics = {}, glowRandom = Math.random) {
      this.fx = diagnostics;
      this.points = [];
      this.exclusions = [];
      this.width = this.height = 1;
      this.mobile = false;
      this.seed = 49271;
      this.motionSeed = 854191;
      this.glowRandom = glowRandom;
      this.pointer = null;
      this.lastTime = null;
      this.elapsed = 0;
      this.nextGlowAt = .5 + this.glowRandom() * .8;
      Object.assign(this.fx, {
        particleCount: 0, particleLinks: 0, particleGlows: 0, particleFrames: 0,
        particleRepelActive: false, particleRepelledCount: 0, particleRepelInteractions: 0,
        particleGlowsSpawned: 0, particleGlowHighWatermark: 0, particleVisibleGlows: 0
      });
    }

    random() {
      this.seed = this.seed * 16807 % 2147483647;
      return (this.seed - 1) / 2147483646;
    }

    motionRandom() {
      this.motionSeed = this.motionSeed * 16807 % 2147483647;
      return (this.motionSeed - 1) / 2147483646;
    }

    createPoint() {
      const point = {
        x: this.random() * this.width,
        y: this.random() * this.height,
        radius: TOKENS.radiusMin + Math.pow(this.random(), 1.8) * (TOKENS.radiusMax - TOKENS.radiusMin),
        alpha: TOKENS.alphaMin + this.random() * (TOKENS.alphaMax - TOKENS.alphaMin)
      };
      if (this.mobile && this.points.length < 6) {
        const anchors = [[.035,.28],[.082,.43],[.027,.59],[.959,.55],[.91,.70],[.967,.87]];
        const anchor = anchors[this.points.length];
        point.x = clamp((anchor[0] + (point.x / this.width - .5) * .012) * this.width, point.radius, this.width - point.radius);
        point.y = clamp((anchor[1] + (point.y / this.height - .5) * .025) * this.width, point.radius, this.height - point.radius);
      }
      const angle = this.motionRandom() * Math.PI * 2;
      const speed = TOKENS.speedMin + this.motionRandom() * (TOKENS.speedMax - TOKENS.speedMin);
      Object.assign(point, { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        ix: 0, iy: 0, glow: 0, glowAge: 0, glowLife: 0 });
      return point;
    }

    resize(width, height, mobile) {
      const oldWidth = this.width, oldHeight = this.height;
      if (this.points.length && this.mobile !== Boolean(mobile)) {
        this.points = [];
        this.seed = 49271;
        this.motionSeed = 854191;
      }
      this.width = Math.max(1, width);
      this.height = Math.max(1, height);
      this.mobile = Boolean(mobile);
      this.distance = this.mobile ? TOKENS.mobileDistance : TOKENS.desktopDistance;
      const area = this.width * this.height;
      const count = Math.round(this.mobile
        ? clamp(area / TOKENS.mobileArea, TOKENS.mobileMin, TOKENS.mobileMax)
        : clamp(area / TOKENS.desktopArea, TOKENS.desktopMin, TOKENS.desktopMax));
      this.points.forEach(point => {
        point.x = point.x / oldWidth * this.width;
        point.y = point.y / oldHeight * this.height;
      });
      this.points.length = Math.min(this.points.length, count);
      while (this.points.length < count) this.points.push(this.createPoint());
      for (const point of this.points) {
        const padX = Math.min(point.radius, this.width / 2), padY = Math.min(point.radius, this.height / 2);
        point.x = clamp(point.x, padX, this.width - padX);
        point.y = clamp(point.y, padY, this.height - padY);
      }
      this.clearPointer();
      this.resetClock();
      this.fx.particleCount = count;
      this.fx.particleLinkDistance = this.distance;
      this.fx.particleMobile = this.mobile;
    }

    setExclusions(rectangles) { this.exclusions = rectangles; }
    resetClock() { this.lastTime = null; }

    setPointer(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > this.width || y < 0 || y > this.height) { this.clearPointer(); return; }
      this.pointer = { x, y };
      this.fx.particleRepelActive = true;
    }

    clearPointer() {
      this.pointer = null;
      this.fx.particleRepelActive = false;
      this.fx.particleRepelledCount = 0;
    }

    suspend() {
      this.resetClock();
      this.clearPointer();
      for (const point of this.points) {
        point.ix = point.iy = point.glow = point.glowAge = point.glowLife = 0;
      }
      this.nextGlowAt = this.elapsed + .5 + this.glowRandom() * .8;
      this.fx.particleGlows = this.fx.particleVisibleGlows = 0;
    }

    advance(now) {
      if (!Number.isFinite(now)) return;
      if (this.lastTime === null) { this.lastTime = now; return; }
      const elapsed = clamp((now - this.lastTime) / 1000, 0, TOKENS.maxFrameDelta);
      this.lastTime = now;
      if (!elapsed) return;
      let remaining = elapsed;
      while (remaining > .000001) {
        const dt = Math.min(remaining, TOKENS.maxDelta);
        this.step(dt);
        remaining -= dt;
      }
      this.fx.particleFrames++;
      this.fx.particleLastDelta = elapsed;
    }

    step(dt) {
      this.elapsed += dt;
      const damping = Math.exp(-TOKENS.impulseDamping * dt);
      let repelled = 0, glows = 0;
      for (const point of this.points) {
        point.ix *= damping; point.iy *= damping;
        if (this.pointer) {
          let dx = point.x - this.pointer.x, dy = point.y - this.pointer.y;
          const squared = dx * dx + dy * dy;
          if (squared < TOKENS.repelRadius * TOKENS.repelRadius) {
            let distance = Math.sqrt(squared);
            if (distance < .001) { dx = 1; dy = 0; distance = 1; }
            const force = TOKENS.repelStrength * Math.pow(1 - distance / TOKENS.repelRadius, 2);
            point.ix += dx / distance * force * dt;
            point.iy += dy / distance * force * dt;
            const impulse = Math.hypot(point.ix, point.iy);
            if (impulse > TOKENS.impulseMax) {
              point.ix *= TOKENS.impulseMax / impulse;
              point.iy *= TOKENS.impulseMax / impulse;
            }
            repelled++;
          }
        }
        point.x += (point.vx + point.ix) * dt;
        point.y += (point.vy + point.iy) * dt;
        const padX = Math.min(point.radius, this.width / 2), padY = Math.min(point.radius, this.height / 2);
        const right = this.width - padX, bottom = this.height - padY;
        if (point.x < padX) {
          point.x = 2 * padX - point.x;
          point.vx = Math.abs(point.vx); point.ix = Math.abs(point.ix);
        } else if (point.x > right) {
          point.x = 2 * right - point.x;
          point.vx = -Math.abs(point.vx); point.ix = -Math.abs(point.ix);
        }
        if (point.y < padY) {
          point.y = 2 * padY - point.y;
          point.vy = Math.abs(point.vy); point.iy = Math.abs(point.iy);
        } else if (point.y > bottom) {
          point.y = 2 * bottom - point.y;
          point.vy = -Math.abs(point.vy); point.iy = -Math.abs(point.iy);
        }
        point.x = clamp(point.x, padX, right);
        point.y = clamp(point.y, padY, bottom);
        if (point.glowLife > 0) {
          point.glowAge += dt;
          if (point.glowAge >= point.glowLife) point.glow = point.glowLife = 0;
          else { point.glow = Math.pow(Math.sin(Math.PI * point.glowAge / point.glowLife), 1.8); glows++; }
        }
      }
      if (this.elapsed >= this.nextGlowAt) {
        if (glows < TOKENS.maxGlows) {
          const candidates = this.points.filter(point => !point.glowLife && point.visible !== false);
          if (candidates.length) {
            const point = candidates[Math.floor(this.glowRandom() * candidates.length) % candidates.length];
            point.glowAge = point.glow = 0;
            point.glowLife = TOKENS.glowLifeMin + this.glowRandom() * TOKENS.glowLifeRange;
            glows++; this.fx.particleGlowsSpawned++;
          }
        }
        this.nextGlowAt = this.elapsed + TOKENS.glowGapMin + this.glowRandom() * TOKENS.glowGapRange;
      }
      this.fx.particleRepelledCount = repelled;
      this.fx.particleRepelInteractions += repelled;
      this.fx.particleGlows = glows;
      this.fx.particleGlowHighWatermark = Math.max(this.fx.particleGlowHighWatermark, glows);
    }

    contains(x, y, rect) {
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    segmentHits(a, b, rect, offsetX, offsetY) {
      const x = a.x + offsetX, y = a.y + offsetY;
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.max(x, x + dx) < rect.left || Math.min(x, x + dx) > rect.right ||
          Math.max(y, y + dy) < rect.top || Math.min(y, y + dy) > rect.bottom) return false;
      let low = 0, high = 1;
      const edges = [[-dx, x - rect.left], [dx, rect.right - x], [-dy, y - rect.top], [dy, rect.bottom - y]];
      for (const [p, q] of edges) {
        if (p === 0) { if (q < 0) return false; }
        else {
          const t = q / p;
          if (p < 0) low = Math.max(low, t); else high = Math.min(high, t);
          if (low > high) return false;
        }
      }
      return true;
    }

    alphaForDistance(distance) {
      const maximum = this.mobile ? TOKENS.mobileLinkAlpha : TOKENS.desktopLinkAlpha;
      return maximum * Math.max(0, 1 - distance / this.distance);
    }

    draw(ctx, offsetX = 0, offsetY = 0) {
      let links = 0, visible = 0, visibleGlows = 0;
      ctx.save();
      ctx.lineWidth = this.mobile ? TOKENS.mobileLinkWidth : TOKENS.desktopLinkWidth;
      for (const point of this.points) {
        point.visible = !this.exclusions.some(rect => this.contains(point.x + offsetX, point.y + offsetY, rect));
        if (point.visible) visible++;
      }
      const limitSquared = this.distance * this.distance;
      for (let i = 0; i < this.points.length; i++) {
        const a = this.points[i];
        if (!a.visible) continue;
        for (let j = i + 1; j < this.points.length; j++) {
          const b = this.points[j];
          if (!b.visible) continue;
          const dx = a.x - b.x, dy = a.y - b.y, squared = dx * dx + dy * dy;
          if (squared >= limitSquared || this.exclusions.some(rect => this.segmentHits(a, b, rect, offsetX, offsetY))) continue;
          ctx.strokeStyle = `rgba(${TOKENS.linkColor},${this.alphaForDistance(Math.sqrt(squared))})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          links++;
        }
      }
      for (const point of this.points) {
        if (!point.visible) continue;
        if (point.glow > 0) {
          const radius = point.radius * TOKENS.glowScale;
          const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
          glow.addColorStop(0, `rgba(${TOKENS.color},${point.glow * .42})`);
          glow.addColorStop(1, `rgba(${TOKENS.color},0)`);
          ctx.fillStyle = glow;
          ctx.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
          visibleGlows++;
        }
        ctx.beginPath(); ctx.arc(point.x, point.y, point.radius * (1 + (point.glow || 0) * .16), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${TOKENS.color},${point.alpha + (1 - point.alpha) * (point.glow || 0)})`; ctx.fill();
      }
      ctx.restore();
      this.fx.particleLinks = links;
      this.fx.particleVisibleCount = visible;
      this.fx.particleVisibleGlows = visibleGlows;
    }
  }

  ParticleField.tokens = TOKENS;
  window.KuntechParticleField = ParticleField;
})();
