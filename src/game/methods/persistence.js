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
      dmGhostTyping: false, introTyping: false, confirmSleep: false, fading: false,
      msgToast: null, msgToastVisible: false, cameraPush: false, dayEnter: false,
      cinePhase: 'gate', cineIdx: 0, cineActive: false, cineFlash: false,
      playingAudioKey: null, ttsStatus: 'idle', ttsProgress: 0, cloneAudioSrc: null, cloneAudioDuration: 0
    });
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

  hasSavedGame() {
    return !!this.readSavedGame();
  },

  clearSavedGame() {
    try { localStorage.removeItem(this.SAVE_KEY); } catch (e) {}
  },

  // Full wipe used by Start over / Replay. Anything not listed here is left
  // alone (refs, content tables). Pass `overrides` for screen-specific fields.
  freshGameState(overrides) {
    return Object.assign({
      screen: 'title', day: 1, min: this.DAYS[1].start, unread: 0, photoUp: true,
      cinePhase: 'gate', cineIdx: 0, cineActive: false, cineMuted: false, cineFlash: false,
      msgToast: null, msgToastVisible: false, cameraPush: false, dayEnter: false,
      tab: 'group', confirmSleep: false, chat: [], dm: [], sharedCount: 3, playingAudioKey: null,
      ttsStatus: 'idle', ttsProgress: 0, cloneAudioSrc: null, cloneAudioDuration: 0,
      hints: { 1: [], 2: [], 3: [], 4: [], 5: [] },
      certainty: { 1: 'unchecked', 2: 'unchecked', 3: 'unchecked', 4: 'unchecked', 5: 'unchecked' },
      done: {}, used: {}, loading: null, loadingPct: 0, credibility: 0,
      credibilityLost: false, actedToday: false, openedGroup: false, ignored: false,
      dmAnsweredToday: false, shareTick: 0, shareHalved: false, fading: false,
      tool: 'player', socTab: 'feed', socProfileKey: null, socPostId: null,
      mediaOpen: null, seen: {}, zoom: false, dev: null, threadOpen: null,
      galleryNew: false, chatFlash: false,
      lastRead: { group: 0, dm: 0 }, newMarkAt: null, showNewPill: false,
      writeIn: false, writeText: '', writeStatus: null, dragItem: null, pickIdx: null,
      pickerOpen: false, pickerMode: 'search', searched: {}, aiPickIdx: null,
      aiStage: 'idle', aiStep: 0, actionLog: [], reactionTimes: [],
      arrival: 0, reactedToday: false, samSilent: false, apology: false,
      reported: false, clipBack: false, phase: 'evening', groupUnread: 0,
      final: { post: null, fwd: null, tell: null },
      sam: 50, group: 50, pushIdx: 0, flashSam: false, flashGroup: false,
      samDead: false, reason: '',
      voiceSent: false, pStage: -1, introLine: 0, introMsg: 0, introTyping: false,
      introReady: false, pendingDay: 1, cardPhase: 'evening', cardDayName: '',
      cardWhen: '', variant: Math.floor(Math.random() * 2),
      playerName: 'Alex', nameDraft: '', playerAvatar: null,
      dmCloseTyping: false, dmCloseExtra: null, dmCloseReady: false, replayShown: false,
      dmGhostTyping: false, ghostTypedToday: false, onReadCharged: false,
      shotOpen: null, sawFake: false, sawReal: false, reportOpen: false,
      reportChoice: null, reportedWrong: false, tip: null,
      profMenuOpen: false, reportReasonOpen: false, reportToast: false,
      reportedAccounts: {}, reportedFake: false,
      saved: [], toast: false, feedImg: null,
      recOpen: false, recPhase: 'intro', recIdx: 0, recBusy: false, recLevel: 0,
      hasRecording: false, recTrying: false, recAttempts: 0,
      minCheck: 0, minReact: 0, postsWith: 0, postsWithout: 0, dmChances: 0,
      endStep: 1, gamePhase: 'playing', postedWed: false,
      stats: {
        forwards: 0, reacts: 0, checks: 0, fast: 0, dmAnswered: 0, claimed: 0,
        dismissed: 0, stopped: 0, fastest: null,
        sift: { investigate: 0, coverage: 0, trace: 0 },
        chat: { dm: 0, group: 0, questioning: 0, pile_on: 0, supportive: 0, neutral: 0 }
      }
    }, overrides || {});
  },

  saveGame() {
    // Don't persist pre-game screens — Start over lands on name entry, and
    // saving there would recreate a Continue slot with leftover/fresh junk.
    const early = { title: 1, name: 1, howto: 1, cinematic: 1 };
    if (early[this.state.screen]) return;
    try {
      const payload = { v: 1, savedAt: Date.now(), state: this.sanitizeForSave(this.state) };
      localStorage.setItem(this.SAVE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('[save] could not write to localStorage', e);
    }
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

  savedPlayerAvatar(saved) {
    if (!saved) return 'assets/av-player-female.webp';
    return saved.playerAvatar === 'male'
      ? 'assets/av-player-male.webp'
      : 'assets/av-player-female.webp';
  },

  continueGame() {
    const saved = this.readSavedGame();
    if (!saved) return;
    this.setState(saved, () => this.resumeAfterLoad());
  },

  startOver() {
    clearTimeout(this._saveTimer);
    clearTimeout(this._it);
    clearTimeout(this._dc);
    this.clearSavedGame();
    this.wipeAudio();
    this.setState(this.freshGameState({ screen: 'name', nameDraft: '' }), () => {
      const el = this.nameRef.current;
      if (el) el.focus();
    });
  }
});
