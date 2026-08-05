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
    this.setState({ screen: 'introtext', introLine: 0, introReady: false }, () => this.runIntro());
  },

  advanceIntro() {
    if (!this.state.introReady || this.state.screen !== 'introtext') return;
    this.setState({ introReady: false, screen: 'introchat' });
    this.playIntroChat();
  },

  runIntro() {
    const nextBack = () => {
      const n = this.state.introLine + 1;
      this.setState({ introLine: n });
      if (n < this.BACKSTORY.length) this._it = setTimeout(nextBack, 1200);
      else this._it = setTimeout(() => this.setState({ introReady: true }), 700);
    };
    this.playIntroChat = () => { this._it = setTimeout(() => this.introStep(), 600); };
    this._it = setTimeout(nextBack, 900);
  },

  introStep() {
    const i = this.state.introMsg;
    if (i >= this.P_LOG.length) {
      this._it = setTimeout(() => this.setState({ fading: true }), 1800);
      this._it = setTimeout(() => this.showDayCard(1), 2600);
      return;
    }
    const m = this.P_LOG[i];
    if (m.rec && !this.state.voiceSent) { this.setState(s => ({ introMsg: s.introMsg + 1 }), () => this.introStep()); return; }
    const show = () => {
      this.setState(s => ({ introMsg: s.introMsg + 1, introTyping: false }), () => {
        if (m.stop) { this._it = setTimeout(() => this.openRecorder(), 700); return; }
        const nxt = this.P_LOG[i + 1];
        this._it = setTimeout(() => this.introStep(), m.pause ? 2200 : (nxt && nxt.slow ? 900 : 700));
      });
    };
    if (m.slow) { this.setState({ introTyping: true }); this._it = setTimeout(show, 1400); }
    else show();
  }
});
