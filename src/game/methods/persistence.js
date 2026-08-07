window.GameMethods = Object.assign(window.GameMethods || {}, {
  SAVE_KEY: 'ithoughtiknewyou:save:v1',

  // Fields that reflect an in-flight timer/animation rather than a player
  // choice. Persisting these as-is would leave a reloaded game stuck (no
  // timers survive a reload), so they are normalized to a safe idle value
  // before writing to storage.
  sanitizeForSave(state) {
    return Object.assign({}, state, {
      loading: null, loadingPct: 0,
      aiStage: 'idle', aiStep: 0,
      recOpen: false, recPhase: 'intro', recBusy: false, recLevel: 0, recTrying: false,
      dmGhostTyping: false, introTyping: false, confirmSleep: false, fading: false
    });
  },

  saveGame() {
    if (this.state.screen === 'title') return;
    try {
      const payload = { v: 1, savedAt: Date.now(), state: this.sanitizeForSave(this.state) };
      localStorage.setItem(this.SAVE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('[save] could not write to localStorage', e);
    }
  },

  scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.saveGame(), 400);
  },

  readSavedGame() {
    try {
      const raw = localStorage.getItem(this.SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.state || typeof parsed.state !== 'object') return null;
      return parsed.state;
    } catch (e) {
      console.warn('[save] could not read from localStorage', e);
      return null;
    }
  },

  clearSavedGame() {
    try { localStorage.removeItem(this.SAVE_KEY); } catch (e) {}
  },

  // Some screens are mid-way through a timer-driven sequence (a day card
  // about to flip into the room, the backstory still typing out, and so
  // on). Timers do not survive a reload, so pick the sequence back up once
  // the saved state has been applied.
  resumeAfterLoad() {
    const st = this.state;
    clearTimeout(this._it); clearTimeout(this._dc);
    if (st.screen === 'daycard') {
      this.startDay(st.pendingDay, st.cardPhase);
    } else if (st.screen === 'introtext' && !st.introReady) {
      this.runIntro();
    } else if (st.screen === 'introchat') {
      this._it = setTimeout(() => this.introStep(), 500);
    } else if (st.screen === 'end' && !st.dmCloseReady) {
      const tier = st.samDead ? 'locked' : st.sam < 35 ? 'low' : 'high';
      this.setState(tier === 'high'
        ? { dmCloseReady: true, dmCloseTyping: false, dmCloseExtra: { text: 'i saw what you posted. thank you.' } }
        : { dmCloseReady: true, dmCloseTyping: false });
    }
  },

  describeSave(saved) {
    if (!saved) return '';
    if (saved.screen === 'end' || saved.screen === 'final') {
      return 'Day ' + (saved.day || 4) + ': The ending';
    }
    if (saved.day === 3 && saved.phase === 'clip') return 'Day 3: The recording';
    const d = this.DAYS[saved.day] || this.DAYS[1];
    const timeWord = saved.phase === 'morning' ? 'morning' : 'night';
    return 'Day ' + saved.day + ': ' + d.dayName + ' ' + timeWord;
  },

  savedPlayerName(saved) {
    if (!saved) return '';
    return (saved.playerName || '').trim() || 'Alex';
  },

  continueGame() {
    const saved = this.readSavedGame();
    if (!saved) return;
    this.setState(saved, () => this.resumeAfterLoad());
  },

  startOver() {
    this.clearSavedGame();
    this.setState({ screen: 'name', nameDraft: '' }, () => {
      const el = this.nameRef.current;
      if (el) el.focus();
    });
  }
});
