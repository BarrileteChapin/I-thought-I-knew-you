window.GameMethods = Object.assign(window.GameMethods || {}, {
  submitName() {
    if (!this.state.playerAvatar) return;
    const n = (this.state.nameDraft || '').trim().slice(0, 16);
    this.setState({
      playerName: n || 'Alex', screen: 'howto', introLine: 0, introMsg: 0, introReady: false,
      variant: Math.floor(Math.random() * 2)
    });
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
      this._it = setTimeout(() => this.setState({ fading: true }), 2800);
      this._it = setTimeout(() => this.showDayCard(1), 4000);
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
