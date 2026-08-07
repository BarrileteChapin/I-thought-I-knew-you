window.GameMethods = Object.assign(window.GameMethods || {}, {
  playPing(kind) {
    try {
      if (navigator.vibrate) {
        try { navigator.vibrate(kind === 'dm' ? [55, 45, 55, 45, 55] : [55, 45, 55]); } catch (e) {}
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = this._pingCtx || (this._pingCtx = new Ctx());
      if (ctx.state === 'suspended') ctx.resume();
      const t0 = ctx.currentTime + 0.02;
      // two-note chime — DM rings a touch higher/brighter than the group ping
      const notes = kind === 'dm' ? [880, 1175] : [740, 988];
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

  showMsgToast(who, text, kind, cb) {
    clearTimeout(this._msgToastHide); clearTimeout(this._msgToastClear);
    this.playPing(kind);
    this.setState({ msgToast: { who, text, kind }, msgToastVisible: false }, () => {
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
      this.showMsgToast('10b 🍕', gt, 'group', () => doDm(700));
    }, 1100);
  }
});
