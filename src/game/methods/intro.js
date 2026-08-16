window.GameMethods = Object.assign(window.GameMethods || {}, {
  TITLE_LEAD: 'You are fifteen.\nYour room, your bed, your phone.\nNicole is in the class group chat tonight,\nand she is not going to be fine.',

  // Inclusive-exclusive ranges for the first "You" and "Nicole".
  titleLeadBoldRanges() {
    const full = this.TITLE_LEAD;
    const you = full.indexOf('You');
    const nicole = full.indexOf('Nicole');
    const ranges = [];
    if (you === 0) ranges.push({ start: 0, end: 3 });
    if (nicole >= 0) ranges.push({ start: nicole, end: nicole + 6 });
    return ranges;
  },

  titleLeadParts(shown) {
    const text = shown || '';
    if (!text) return [];
    const ranges = this.titleLeadBoldRanges();
    const isBold = (idx) => ranges.some(r => idx >= r.start && idx < r.end);
    const parts = [];
    let i = 0;
    while (i < text.length) {
      const bold = isBold(i);
      let j = i + 1;
      while (j < text.length && isBold(j) === bold) j += 1;
      parts.push({
        text: text.slice(i, j),
        bold,
        notBold: !bold
      });
      i = j;
    }
    return parts;
  },

  beginTitleLead() {
    clearTimeout(this._titleType);
    this._titleTypeGen = (this._titleTypeGen || 0) + 1;
    const gen = this._titleTypeGen;
    const full = this.TITLE_LEAD;
    this.setState({ titleLeadShown: '', titleLeadDone: false });
    this.startTitleWriteSfx();
    let i = 0;
    const tick = () => {
      if (gen !== this._titleTypeGen || this.state.screen !== 'title') return;
      i += 1;
      const done = i >= full.length;
      this.setState({
        titleLeadShown: full.slice(0, i),
        titleLeadDone: done
      });
      if (done) {
        this.stopTitleWriteSfx();
        return;
      }
      const ch = full.charAt(i - 1);
      const pause = ch === '\n' ? 280
        : (ch === '.' ? 220 : (ch === ',' ? 90 : 0));
      this._titleType = setTimeout(tick, 22 + Math.random() * 28 + pause);
    };
    this._titleType = setTimeout(tick, 420);
  },

  stopTitleLead() {
    clearTimeout(this._titleType);
    this._titleTypeGen = (this._titleTypeGen || 0) + 1;
    this.stopTitleWriteSfx();
  },

  beginExperience(mode) {
    if (this.state.titleLeaving) return;
    this.stopTitleLead();
    const desktop = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(min-width: 768px)').matches;
    const delay = desktop ? 560 : 0;
    this.setState({ titleLeaving: true, endingsGalleryOpen: false, endingsGalleryClosing: false });
    clearTimeout(this._titleLeave);
    this._titleLeave = setTimeout(() => {
      if (mode === 'continue') {
        this.setState({ titleLeaving: false });
        this.continueGame();
        return;
      }
      if (mode === 'startOver') {
        this.setState({ titleLeaving: false });
        this.startOver();
        return;
      }
      this.setState({
        titleLeaving: false,
        screen: 'name',
        nameDraft: '',
        playerAvatar: null,
        mediaOpen: null,
        shotOpen: null,
        feedImg: null,
        reportOpen: false,
        pickerOpen: false,
        dev: null,
        threadOpen: null
      }, () => {
        const el = this.nameRef.current;
        if (el) el.focus();
      });
    }, delay);
  },

  confirmName() {
    const n = (this.state.nameDraft || '').trim().slice(0, 16);
    this.setState({
      playerName: n || 'Alex',
      nameDraft: n || 'Alex',
      screen: 'avatar',
      playerAvatar: null
    });
  },

  submitAvatar() {
    if (!this.state.playerAvatar) return;
    this.setState({
      screen: 'howto', introLine: 0, introMsg: 0, introReady: false
    });
  },

  submitName() {
    this.confirmName();
  },

  leaveHowTo() {
    clearTimeout(this._it);
    this.setState({
      screen: 'cinematic', cineIdx: 0, cineActive: false, cineFlash: false,
      introMsg: 0, introTyping: false, introReady: false
    }, () => this.beginCinematic());
  },

  enterIntroChat() {
    clearTimeout(this._it);
    this.setState({
      screen: 'introchat', cinePhase: 'gate', cineIdx: 0, cineActive: false, cineFlash: false,
      introMsg: 0, introTyping: false, introReady: false
    });
    this._it = setTimeout(() => this.introStep(), 1200);
  },

  advanceIntro() {
    if (!this.state.introReady || this.state.screen !== 'introtext') return;
    this.enterIntroChat();
  },

  // Skip past chat chatter but never past the voice-note beat until recorded.
  skipIntro() {
    clearTimeout(this._it);
    const st = this.state;
    if (st.screen === 'introchat' && !st.voiceSent) {
      this.skipIntroToRecorder();
      return;
    }
    this.showDayCard(1);
  },

  skipIntroToRecorder() {
    clearTimeout(this._it);
    const stopIdx = this.P_LOG.findIndex(m => m.stop);
    const introMsg = stopIdx >= 0 ? stopIdx + 1 : this.P_LOG.length;
    this.setState({
      screen: 'introchat',
      introMsg,
      introTyping: false,
      fading: false,
      recOpen: false
    }, () => this.openRecorder());
  },

  runIntro() {
    const nextBack = () => {
      const n = this.state.introLine + 1;
      this.setState({ introLine: n });
      if (n < this.BACKSTORY.length) this._it = setTimeout(nextBack, 1200);
      else this._it = setTimeout(() => this.setState({ introReady: true }), 700);
    };
    this._it = setTimeout(nextBack, 900);
  },

  introStep() {
    const i = this.state.introMsg;
    if (i >= this.P_LOG.length) {
      this._it = setTimeout(() => this.setState({ fading: true }), 900);
      this._it = setTimeout(() => this.showDayCard(1), 1400);
      return;
    }
    const m = this.P_LOG[i];
    if (m.rec && !this.state.voiceSent) { this.setState(s => ({ introMsg: s.introMsg + 1 }), () => this.introStep()); return; }
    const show = () => {
      this.setState(s => ({ introMsg: s.introMsg + 1, introTyping: false }), () => {
        if (m.stop) { this._it = setTimeout(() => this.openRecorder(), 1200); return; }
        const nxt = this.P_LOG[i + 1];
        this._it = setTimeout(() => this.introStep(), m.pause ? 3600 : (nxt && nxt.slow ? 1600 : 1300));
      });
    };
    if (m.slow) { this.setState({ introTyping: true }); this._it = setTimeout(show, 2200); }
    else show();
  }
});
