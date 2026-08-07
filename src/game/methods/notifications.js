window.GameMethods = Object.assign(window.GameMethods || {}, {
  // Headline shown in the social-media arrival toast, keyed by day — picked
  // to name that day's actual challenge (the reposted photo, the fake
  // account, the cloned voice) rather than just whichever post is newest.
  SOCIAL_HEADLINES: {
    2: { who: 'Hanna K', text: 'some people really show their true colours' },
    3: { who: 'Hanna K', text: 'so she made a second account. cool cool' },
    4: { who: 'Lea M', text: 'has ANYONE checked any of this' }
  },

  playPing(kind) {
    try {
      if (navigator.vibrate) {
        try { navigator.vibrate(kind === 'dm' ? [55, 45, 55, 45, 55] : kind === 'social' ? [40, 60, 40] : [55, 45, 55]); } catch (e) {}
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = this._pingCtx || (this._pingCtx = new Ctx());
      if (ctx.state === 'suspended') ctx.resume();
      const t0 = ctx.currentTime + 0.02;
      // two-note chime — DM rings a touch higher/brighter than the group ping,
      // social settles lower still so the three stay easy to tell apart
      const notes = kind === 'dm' ? [880, 1175] : kind === 'social' ? [523, 659] : [740, 988];
      // play the chime twice — a real phone double-buzzes for one notification
      [0, 1].forEach(rep => {
        const repStart = t0 + rep * 0.24;
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const start = repStart + i * 0.09;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(0.15, start + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(start); osc.stop(start + 0.19);
        });
      });
    } catch (e) {}
  },

  showMsgToast(who, text, kind, cb, avatarWho) {
    clearTimeout(this._msgToastHide); clearTimeout(this._msgToastClear);
    this.playPing(kind);
    const face = this.faceOf(avatarWho || (kind === 'dm' ? 'Nicole' : who));
    this.setState({ msgToast: { who, text, kind, avatar: face }, msgToastVisible: false }, () => {
      requestAnimationFrame(() => this.setState({ msgToastVisible: true }));
    });
    this._msgToastHide = setTimeout(() => {
      this.setState({ msgToastVisible: false });
      this._msgToastClear = setTimeout(() => { this.setState({ msgToast: null }); if (cb) cb(); }, 300);
    }, 2600);
  },

  // Small punch-in on the phone icon, so an arriving message visibly draws
  // the eye toward it — separate from the once-per-day room pan.
  pushCamera() {
    clearTimeout(this._camT);
    this.setState({ cameraPush: true });
    this._camT = setTimeout(() => this.setState({ cameraPush: false }), 900);
  },

  toastPreview(m) {
    if (m.text) return m.text.split('{name}').join(this.name());
    if (m.kind === 'video') return '📹 sent a video';
    if (m.kind === 'photo') return '📷 sent a photo';
    if (m.kind === 'shot') return '📷 sent a screenshot';
    if (m.kind === 'voice') return '🎤 sent a voice message';
    return (m.caption || '…').split('{name}').join(this.name());
  },

  // Fires the arrival toasts for whichever day just started — group first,
  // then the DM, matching however many (if any) actually landed that day.
  runDayArrival(groupMsgs, dmMsgs) {
    clearTimeout(this._n1); clearTimeout(this._n2);
    const firstGroup = (groupMsgs || []).find(m => !m.sys);
    const firstDm = (dmMsgs || [])[0];
    const doDm = (delay) => {
      if (!firstDm) return;
      const dt = this.toastPreview(firstDm);
      this._n2 = setTimeout(() => {
        this.pushCamera();
        this.showMsgToast('Nicole', dt, 'dm');
      }, delay);
    };
    if (!firstGroup) { doDm(1100); return; }
    const gt = this.toastPreview(firstGroup);
    this._n1 = setTimeout(() => {
      this.pushCamera();
      this.showMsgToast('10b 🍕', gt, 'group', () => doDm(700), firstGroup.who);
    }, 1100);
  },

  showSocToast(who, text) {
    clearTimeout(this._socToastHide); clearTimeout(this._socToastClear);
    this.playPing('social');
    this.setState({ socToast: { who, text }, socToastVisible: false }, () => {
      requestAnimationFrame(() => this.setState({ socToastVisible: true }));
    });
    this._socToastHide = setTimeout(() => {
      this.setState({ socToastVisible: false });
      this._socToastClear = setTimeout(() => this.setState({ socToast: null }), 300);
    }, 2600);
  },

  // Fires the social-media arrival hint for whichever day just started, when
  // there's new feed content — same room-entry trigger as runDayArrival, but
  // lands a beat later so it doesn't pop in on top of the message toasts.
  runSocialArrival(n) {
    clearTimeout(this._n3);
    const headline = this.SOCIAL_HEADLINES[n];
    if (!headline) return;
    const text = headline.text.split('{name}').join(this.name());
    this._n3 = setTimeout(() => this.showSocToast(headline.who, text), 1900);
  }
});
