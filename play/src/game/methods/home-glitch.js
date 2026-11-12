window.GameMethods = Object.assign(window.GameMethods || {}, {
  HOME_GLITCH_MQ: '(min-width: 768px)',

  // Staggered slideshow behind the title shell (PC).
  HOME_GLITCH_POOL: [
    'assets/class_10b.webp',
    'assets/nicole_sad_bg.webp',
    'assets/nicole-garden.webp',
    'assets/nicole_party.webp',
    'assets/screenshot-fake.webp',
    'assets/logo.png'
  ],

  isHomeGlitchDesktop() {
    try {
      return !!(window.matchMedia && window.matchMedia(this.HOME_GLITCH_MQ).matches);
    } catch (e) {
      return false;
    }
  },

  homeGlitchLayer() {
    return document.getElementById('g-home-glitch-layer');
  },

  setHomeGlitchChrome(on) {
    const layer = this.homeGlitchLayer();
    if (layer) {
      layer.hidden = !on;
      layer.classList.toggle('is-on', !!on);
      layer.setAttribute('aria-hidden', on ? 'false' : 'true');
    }
    const lp = document.querySelector('.g-lp');
    if (lp) lp.classList.toggle('has-home-glitch', !!on);
  },

  syncHomeGlitch() {
    const onTitle = this.state.screen === 'title' && this.isHomeGlitchDesktop();
    if (!onTitle) {
      this.teardownHomeGlitch();
      return;
    }
    // Keep the layer mounted while leaving so CSS can fade it out.
    if (this.state.titleLeaving) {
      this.stopHomeGlitchCycle();
      return;
    }
    this.setHomeGlitchChrome(true);
    if (this._homeGlitch) return;
    requestAnimationFrame(() => this.mountHomeGlitch());
  },

  preloadHomeGlitchPool() {
    const list = this.HOME_GLITCH_POOL || [];
    return Promise.all(list.map((src) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(src);
      img.onerror = () => resolve(src);
      img.src = src;
    })));
  },

  waitImgReady(img) {
    if (!img) return Promise.reject(new Error('missing img'));
    if (img.complete && img.naturalWidth > 0) return Promise.resolve(img);
    return new Promise((resolve, reject) => {
      img.addEventListener('load', () => resolve(img), { once: true });
      img.addEventListener('error', () => reject(new Error('img load failed')), { once: true });
    });
  },

  // Base = demo-1 glitch; `pixel` = demo-4 pixelation burst.
  homeGlitchMode(side) {
    const modes = this._homeGlitchMode || (this._homeGlitchMode = { left: 'glitch', right: 'glitch' });
    return modes[side] || 'glitch';
  },

  setHomeGlitchMode(side, mode) {
    if (!this._homeGlitchMode) this._homeGlitchMode = { left: 'glitch', right: 'glitch' };
    this._homeGlitchMode[side] = mode;
  },

  homeGlitchOptions(target, side, mode) {
    const isLeft = side !== 'right';
    const usePixel = (mode || this.homeGlitchMode(side)) === 'pixel';
    if (usePixel) {
      const shapes = ['square', 'circle', 'diamond'];
      return {
        target: target,
        intensity: 1.9,
        aspectCorrection: true,
        interaction: {
          enabled: true,
          shape: 'square',
          customSize: '40vw',
          customUrl: 'assets/logo.svg',
          velocity: false,
          effects: {
            pixelation: ['pixelSize'],
            crt: [],
            glitch: []
          }
        },
        effects: {
          pixelation: {
            enabled: true,
            pixelSize: 28 + Math.floor(Math.random() * 24),
            pixelShape: shapes[Math.floor(Math.random() * shapes.length)],
            bitDepth: Math.random() < 0.25 ? '8-bit' : 'none',
            dithering: Math.random() < 0.55 ? 'bayer' : 'none',
            pixelDirection: 'square'
          },
          crt: { enabled: false },
          glitch: { enabled: false }
        }
      };
    }
    return {
      target: target,
      intensity: 3.0,
      aspectCorrection: true,
      interaction: {
        enabled: true,
        shape: 'square',
        customSize: '40vw',
        customUrl: 'assets/logo.svg',
        velocity: false,
        effects: {
          pixelation: ['pixelSize'],
          crt: [
            'chromaticAberration',
            'phosphorGlow',
            'curvature',
            'scanlines'
          ],
          glitch: [
            'rgbShift',
            'lineDisplacement',
            'bitCrushing',
            'signalDropout',
            'syncErrors',
            'interferenceLines',
            'frameGhosting',
            'stutterFreeze',
            'datamoshing'
          ]
        }
      },
      effects: {
        pixelation: {
          enabled: true,
          pixelSize: 7,
          pixelShape: 'square',
          bitDepth: 'none',
          dithering: 'none',
          pixelDirection: 'square'
        },
        crt: {
          enabled: true,
          preset: 'computer-monitor',
          curvature: 6,
          lineDirection: isLeft ? 'left' : 'right',
          lineMovement: true,
          lineSpeed: isLeft ? 0.28 : 0.38
        },
        glitch: {
          enabled: true,
          rgbShift: 0,
          digitalNoise: isLeft ? 0.14 : 0.18,
          lineDisplacement: 0,
          bitCrushDepth: 0,
          signalDropoutFreq: 0.03,
          signalDropoutSize: 0.4,
          syncErrorFreq: isLeft ? 0.07 : 0.1,
          syncErrorAmount: 0.141,
          interferenceSpeed: isLeft ? 3.8 : 5.2,
          interferenceIntensity: 1,
          frameGhostAmount: 0.68,
          stutterFreq: 0.4,
          datamoshStrength: 2
        }
      }
    };
  },

  applyHomeGlitchMode(side, mode) {
    this.setHomeGlitchMode(side, mode);
    const inst = this._homeGlitch && this._homeGlitch[side];
    if (!inst || typeof inst.updateOptions !== 'function') return;
    const patch = this.homeGlitchOptions(null, side, mode);
    try {
      inst.updateOptions({
        intensity: patch.intensity,
        interaction: patch.interaction,
        effects: patch.effects
      });
    } catch (e) {
      console.warn('[home-glitch] mode update failed', e);
    }
  },

  homeGlitchImgId(side) {
    return side === 'right' ? 'g-home-glitch-r' : 'g-home-glitch-l';
  },

  cleanupHomeGlitchSide(side) {
    const inst = this._homeGlitch;
    if (inst && inst[side]) {
      try {
        if (typeof inst[side].cleanup === 'function') inst[side].cleanup();
      } catch (e) {
        console.warn('[home-glitch] side cleanup failed', e);
      }
      inst[side] = null;
    }
    // Drop any orphan canvases glitchGL left behind after a hard cut.
    const pane = document.querySelector('.g-home-glitch-pane.is-' + (side === 'right' ? 'right' : 'left'));
    if (!pane) return;
    Array.prototype.slice.call(pane.querySelectorAll('canvas, [data-glitch-target]')).forEach((node) => {
      try { node.remove(); } catch (e) {}
    });
  },

  mountHomeGlitchSide(side) {
    const id = this.homeGlitchImgId(side);
    const img = document.getElementById(id);
    if (!img) return null;
    return window.glitchGL(this.homeGlitchOptions('#' + id, side, this.homeGlitchMode(side)));
  },

  flashHomeGlitchPane(side) {
    const pane = document.querySelector('.g-home-glitch-pane.is-' + (side === 'right' ? 'right' : 'left'));
    if (!pane) return;
    pane.classList.remove('is-cutting');
    // Retrigger CSS animation.
    void pane.offsetWidth;
    pane.classList.add('is-cutting');
    clearTimeout(pane._cutT);
    pane._cutT = setTimeout(() => pane.classList.remove('is-cutting'), 140);
  },

  nextHomeGlitchSrc(side) {
    const pool = this.HOME_GLITCH_POOL;
    if (!pool || !pool.length) return 'assets/class_10b.webp';
    const state = this._homeGlitchCycle || (this._homeGlitchCycle = {
      leftSrc: pool[0],
      rightSrc: pool[Math.min(2, pool.length - 1)]
    });
    const srcKey = side === 'right' ? 'rightSrc' : 'leftSrc';
    const otherSrc = side === 'right' ? state.leftSrc : state.rightSrc;
    const selfSrc = state[srcKey];
    const choices = pool.filter((src) => src !== otherSrc && src !== selfSrc);
    const bag = choices.length ? choices : pool.filter((src) => src !== otherSrc);
    const src = (bag.length ? bag : pool)[Math.floor(Math.random() * (bag.length || pool.length))];
    state[srcKey] = src;
    return src;
  },

  homeGlitchSwapDelay(side) {
    // Occasional quick follow-up cut — keep rare so it doesn't chatter.
    if (Math.random() < 0.06) return 420 + Math.floor(Math.random() * 380);
    if (side === 'right') return 4200 + Math.floor(Math.random() * 2800);
    return 2800 + Math.floor(Math.random() * 2200);
  },

  stopHomeGlitchCycle() {
    const timers = this._homeGlitchTimers;
    this._homeGlitchTimers = null;
    if (!timers) return;
    if (timers.left) clearTimeout(timers.left);
    if (timers.right) clearTimeout(timers.right);
    if (timers.sync) clearTimeout(timers.sync);
    if (timers.mode) clearTimeout(timers.mode);
    if (timers.modeHold) clearTimeout(timers.modeHold);
  },

  scheduleHomeGlitchSide(side) {
    if (!this._homeGlitchTimers) this._homeGlitchTimers = { left: null, right: null, sync: null, mode: null, modeHold: null };
    if (this._homeGlitchTimers[side]) clearTimeout(this._homeGlitchTimers[side]);
    const run = this._homeGlitchMountRun || 0;
    this._homeGlitchTimers[side] = setTimeout(() => {
      if (run !== this._homeGlitchMountRun) return;
      this.advanceHomeGlitchSide(side).finally(() => {
        if (run !== this._homeGlitchMountRun) return;
        if (!this._homeGlitch) return;
        this.scheduleHomeGlitchSide(side);
      });
    }, this.homeGlitchSwapDelay(side));
  },

  scheduleHomeGlitchSyncHit() {
    if (!this._homeGlitchTimers) this._homeGlitchTimers = { left: null, right: null, sync: null, mode: null, modeHold: null };
    if (this._homeGlitchTimers.sync) clearTimeout(this._homeGlitchTimers.sync);
    const run = this._homeGlitchMountRun || 0;
    // Occasional both-sides hard cut — reads like a signal drop.
    const delay = 14000 + Math.floor(Math.random() * 12000);
    this._homeGlitchTimers.sync = setTimeout(() => {
      if (run !== this._homeGlitchMountRun || !this._homeGlitch) return;
      Promise.all([
        this.advanceHomeGlitchSide('left'),
        this.advanceHomeGlitchSide('right')
      ]).finally(() => {
        if (run !== this._homeGlitchMountRun || !this._homeGlitch) return;
        this.scheduleHomeGlitchSyncHit();
      });
    }, delay);
  },

  scheduleHomeGlitchModeSwap() {
    if (!this._homeGlitchTimers) this._homeGlitchTimers = { left: null, right: null, sync: null, mode: null, modeHold: null };
    if (this._homeGlitchTimers.mode) clearTimeout(this._homeGlitchTimers.mode);
    if (this._homeGlitchTimers.modeHold) clearTimeout(this._homeGlitchTimers.modeHold);
    const run = this._homeGlitchMountRun || 0;
    // Mostly glitch; occasionally drop into demo-4 pixelation for a beat.
    const delay = 7000 + Math.floor(Math.random() * 8000);
    this._homeGlitchTimers.mode = setTimeout(() => {
      if (run !== this._homeGlitchMountRun || !this._homeGlitch) return;

      const both = Math.random() < 0.35;
      const sides = both ? ['left', 'right'] : [Math.random() < 0.5 ? 'left' : 'right'];
      sides.forEach((side) => {
        this.applyHomeGlitchMode(side, 'pixel');
      });

      // Hold pixel look briefly, then snap back to glitch.
      const hold = 900 + Math.floor(Math.random() * 1600);
      this._homeGlitchTimers.modeHold = setTimeout(() => {
        if (run !== this._homeGlitchMountRun || !this._homeGlitch) return;
        sides.forEach((side) => {
          this.applyHomeGlitchMode(side, 'glitch');
        });
        this.scheduleHomeGlitchModeSwap();
      }, hold);
    }, delay);
  },

  startHomeGlitchCycle() {
    this.stopHomeGlitchCycle();
    this._homeGlitchMode = { left: 'glitch', right: 'glitch' };
    this.scheduleHomeGlitchSide('left');
    this.scheduleHomeGlitchSide('right');
    this.scheduleHomeGlitchSyncHit();
    this.scheduleHomeGlitchModeSwap();
  },

  advanceHomeGlitchSide(side) {
    if (!this._homeGlitch) return Promise.resolve();
    if (this.state.screen !== 'title' || this.state.titleLeaving || !this.isHomeGlitchDesktop()) {
      return Promise.resolve();
    }
    if (this._homeGlitchBusy && this._homeGlitchBusy[side]) return Promise.resolve();
    if (!this._homeGlitchBusy) this._homeGlitchBusy = { left: false, right: false };
    this._homeGlitchBusy[side] = true;

    const img = document.getElementById(this.homeGlitchImgId(side));
    if (!img) {
      this._homeGlitchBusy[side] = false;
      return Promise.resolve();
    }
    const src = this.nextHomeGlitchSrc(side);
    // Soft cut only sometimes — every swap flashing reads as noise.
    if (Math.random() < 0.28) this.flashHomeGlitchPane(side);

    // Preload next frame while the current canvas stays up, then hard-cut.
    const probe = new Image();
    probe.src = src;
    return this.waitImgReady(probe).then(() => {
      if (!this._homeGlitch) return;
      if (this.state.screen !== 'title' || this.state.titleLeaving) return;
      this.cleanupHomeGlitchSide(side);
      img.src = src;
      return this.waitImgReady(img).then(() => {
        if (!this._homeGlitch) return;
        if (this.state.screen !== 'title' || this.state.titleLeaving) return;
        try {
          this._homeGlitch[side] = this.mountHomeGlitchSide(side);
        } catch (e) {
          console.warn('[home-glitch] remount failed', e);
        }
      });
    }).catch((e) => {
      console.warn('[home-glitch] swap failed', e);
    }).finally(() => {
      if (this._homeGlitchBusy) this._homeGlitchBusy[side] = false;
    });
  },

  mountHomeGlitch() {
    if (this._homeGlitch) return;
    if (this.state.screen !== 'title' || this.state.titleLeaving || !this.isHomeGlitchDesktop()) return;
    if (typeof window.glitchGL !== 'function' || typeof window.THREE === 'undefined') {
      console.warn('[home-glitch] glitchGL/THREE missing');
      return;
    }

    this._homeGlitchMountRun = (this._homeGlitchMountRun || 0) + 1;
    const run = this._homeGlitchMountRun;
    const pool = this.HOME_GLITCH_POOL;
    this._homeGlitchCycle = {
      leftSrc: pool[0],
      rightSrc: pool[Math.min(2, pool.length - 1)]
    };

    this.preloadHomeGlitchPool().then(() => {
      if (run !== this._homeGlitchMountRun) return;
      const leftImg = document.getElementById('g-home-glitch-l');
      const rightImg = document.getElementById('g-home-glitch-r');
      if (!leftImg || !rightImg) return;
      leftImg.src = this._homeGlitchCycle.leftSrc;
      rightImg.src = this._homeGlitchCycle.rightSrc;
      return Promise.all([this.waitImgReady(leftImg), this.waitImgReady(rightImg)]);
    }).then(() => {
      if (run !== this._homeGlitchMountRun) return;
      if (this._homeGlitch) return;
      if (this.state.screen !== 'title' || this.state.titleLeaving || !this.isHomeGlitchDesktop()) return;

      try {
        this._homeGlitch = {
          left: this.mountHomeGlitchSide('left'),
          right: this.mountHomeGlitchSide('right')
        };
        this.startHomeGlitchCycle();
        console.info('[home-glitch] ready');
      } catch (e) {
        console.warn('[home-glitch] init failed', e);
        this._homeGlitch = null;
      }
    }).catch((e) => {
      console.warn('[home-glitch] images not ready', e);
    });
  },

  teardownHomeGlitch() {
    this._homeGlitchMountRun = (this._homeGlitchMountRun || 0) + 1;
    this.stopHomeGlitchCycle();
    const inst = this._homeGlitch;
    this._homeGlitch = null;
    this._homeGlitchCycle = null;
    this._homeGlitchMode = null;
    this.setHomeGlitchChrome(false);
    if (!inst) return;
    ['left', 'right'].forEach((key) => {
      try {
        if (inst[key] && typeof inst[key].cleanup === 'function') inst[key].cleanup();
      } catch (e) {
        console.warn('[home-glitch] cleanup failed', e);
      }
    });
  }
});
