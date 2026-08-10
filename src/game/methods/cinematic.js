window.GameMethods = Object.assign(window.GameMethods || {}, {
  // --- Opening cinematic -------------------------------------------------
  beginCinematic() {
    this.setState({ cinePhase: 'playing' });
    this.startAmbient();
    this.runCinematic();
  },

  // A small instrumental loop for the opening cinematic: a slow four-chord
  // pad (Am7 - Fmaj7 - Cmaj7 - G, a gentle vi-IV-I-V) for harmony, a bass
  // pulse on the root for a felt beat, and a plucked arpeggio riding on
  // top for melody — three parts so it reads as an actual short song
  // rather than a single held drone.
  startAmbient() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = this._pingCtx || (this._pingCtx = new Ctx());
      if (ctx.state === 'suspended') ctx.resume();

      const CHORDS = [
        [110.00, 130.81, 164.81, 196.00], // Am7  (A2 C3 E3 G3)
        [87.31, 110.00, 130.81, 164.81],  // Fmaj7 (F2 A2 C3 E3)
        [130.81, 164.81, 196.00, 246.94], // Cmaj7 (C3 E3 G3 B3)
        [98.00, 123.47, 146.83, 196.00]   // G     (G2 B2 D3 G3)
      ];
      const AMBIENT_GAIN = 0.4;
      this._ambientGain = AMBIENT_GAIN;
      this._ambientMuted = !!this.state.cineMuted;

      const master = ctx.createGain();
      master.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1100;
      filter.connect(master);
      master.connect(ctx.destination);
      master.gain.linearRampToValueAtTime(this._ambientMuted ? 0 : AMBIENT_GAIN, ctx.currentTime + 1.4);

      // Slow filter sweep so the pad breathes instead of sitting static.
      const lfo = ctx.createOscillator();
      lfo.type = 'sine'; lfo.frequency.value = 0.05;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
      lfo.start();

      const pad = CHORDS[0].map((f) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 0.14;
        osc.connect(g); g.connect(filter);
        osc.start();
        return osc;
      });

      this._ambientMaster = master;
      this._ambientOscs = pad;
      this._ambientLfo = lfo;
      this._ambientFilter = filter;

      const totalDur = (this.CINE_SCENES || []).reduce((sum, s) => sum + (s.dur || 0), 0) || 40000;
      const chordDur = totalDur / CHORDS.length;
      const beat = chordDur / 8; // ~8 bass pulses per chord

      let chordIdx = 0;
      const nextChord = () => {
        chordIdx = (chordIdx + 1) % CHORDS.length;
        const chord = CHORDS[chordIdx];
        pad.forEach((osc, i) => osc.frequency.linearRampToValueAtTime(chord[i], ctx.currentTime + 1.6));
        this._ambientChordT = setTimeout(nextChord, chordDur);
      };
      this._ambientChordT = setTimeout(nextChord, chordDur);

      // Slow bass pulse on the chord root, an octave below the pad —
      // gives the loop an actual felt beat instead of just a held wash.
      const bassPulse = () => {
        const root = CHORDS[chordIdx][0] / 2;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = root;
        const g = ctx.createGain();
        const t0 = ctx.currentTime;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(this._ambientMuted ? 0.0001 : 0.5, t0 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + (beat / 1000) * 0.9);
        osc.connect(g); g.connect(filter);
        osc.start(t0); osc.stop(t0 + beat / 1000);
        this._ambientBassT = setTimeout(bassPulse, beat);
      };
      this._ambientBassT = setTimeout(bassPulse, beat);

      // A plucked arpeggio running up then down through the current
      // chord, an octave (or two) above the pad — the melody riding on
      // top of the harmony and the bass pulse.
      let step = 0;
      const pattern = [0, 1, 2, 3, 2, 1];
      const pluck = () => {
        const chord = CHORDS[chordIdx];
        const idx = pattern[step % pattern.length];
        const octave = (Math.floor(step / pattern.length) % 2 === 0) ? 2 : 4;
        const freq = chord[idx] * octave;
        step++;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        const t0 = ctx.currentTime;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(this._ambientMuted ? 0.0001 : 0.32, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + (beat / 1000) * 1.4);
        osc.connect(g);
        if (typeof ctx.createStereoPanner === 'function') {
          const pan = ctx.createStereoPanner();
          pan.pan.value = (step % 2 === 0) ? -0.3 : 0.3;
          g.connect(pan); pan.connect(filter);
        } else {
          g.connect(filter);
        }
        osc.start(t0); osc.stop(t0 + (beat / 1000) * 1.5);
        this._ambientArpT = setTimeout(pluck, beat / 2);
      };
      this._ambientArpT = setTimeout(pluck, beat / 2);
    } catch (e) {}
  },

  stopAmbient() {
    try {
      clearTimeout(this._ambientChordT); clearTimeout(this._ambientBassT); clearTimeout(this._ambientArpT);
      if (this._ambientMaster && this._pingCtx) {
        const ctx = this._pingCtx;
        const now = ctx.currentTime;
        this._ambientMaster.gain.cancelScheduledValues(now);
        this._ambientMaster.gain.setValueAtTime(this._ambientMaster.gain.value, now);
        this._ambientMaster.gain.linearRampToValueAtTime(0, now + 1.1);
      }
      try { this._ambientLfo && this._ambientLfo.stop(); } catch (e) {}
      const oscs = this._ambientOscs;
      this._ambientOscs = null; this._ambientMaster = null; this._ambientLfo = null; this._ambientFilter = null;
      setTimeout(() => { (oscs || []).forEach(o => { try { o.stop(); } catch (e) {} }); }, 1200);
    } catch (e) {}
  },

  setAmbientMuted(muted) {
    this._ambientMuted = muted;
    try {
      if (this._ambientMaster && this._pingCtx) {
        const ctx = this._pingCtx;
        const now = ctx.currentTime;
        this._ambientMaster.gain.cancelScheduledValues(now);
        this._ambientMaster.gain.setValueAtTime(this._ambientMaster.gain.value, now);
        this._ambientMaster.gain.linearRampToValueAtTime(muted ? 0 : (this._ambientGain || 0.4), now + 0.4);
      }
    } catch (e) {}
  },

  runCinematic() {
    clearTimeout(this._cineT);
    clearTimeout(this._cineActivateT);
    clearTimeout(this._cineExitT);
    const scenes = this.CINE_SCENES;
    const preload = (src) => {
      if (!src) return;
      const im = new Image();
      im.src = src;
    };
    // Gives the fade/blur-in something to play over, and a moment for the
    // (multi-MB) frame to actually finish loading before the camera starts
    // panning — otherwise the pan can visibly start before the image does.
    const ENTER_DELAY = 400;
    // Fade/blur the current frame back out before the next cut, so the swap
    // itself always happens while the image is hidden (never a hard pop).
    const EXIT_DELAY = 400;
    const step = (i) => {
      if (i >= scenes.length) { this.finishCinematic(); return; }
      const dur = scenes[i].dur || 9000;
      preload((scenes[i + 1] || {}).img);
      this.setState({ cineIdx: i, cineActive: false });
      this._cineActivateT = setTimeout(() => this.setState({ cineActive: true }), ENTER_DELAY);
      this._cineExitT = setTimeout(() => this.setState({ cineActive: 'exit' }), Math.max(dur - EXIT_DELAY, ENTER_DELAY));
      this._cineT = setTimeout(() => step(i + 1), dur);
    };
    preload((scenes[0] || {}).img);
    step(0);
  },

  finishCinematic() {
    clearTimeout(this._cineT);
    clearTimeout(this._cineActivateT);
    clearTimeout(this._cineExitT);
    this.stopAmbient();
    this.setState({ cineFlash: true });
    this._cineT = setTimeout(() => this.enterIntroChat(), 380);
  },

  skipCinematic() {
    clearTimeout(this._cineT);
    clearTimeout(this._cineActivateT);
    clearTimeout(this._cineExitT);
    this.stopAmbient();
    this.enterIntroChat();
  },

  toggleCineMute() {
    this.setState(s => {
      const next = !s.cineMuted;
      this.setAmbientMuted(next);
      return { cineMuted: next };
    });
  }
});
