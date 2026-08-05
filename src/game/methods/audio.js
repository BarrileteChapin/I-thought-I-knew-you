window.GameMethods = Object.assign(window.GameMethods || {}, {
  openRecorder() { this.setState({ recOpen: true, recPhase: 'intro', recIdx: 0, recBusy: false, recLevel: 0 }); },

  async recAllow() {
    if (this.state.recTrying) return;
    const nav = navigator.mediaDevices;
    const framed = window.self !== window.top;
    if (!nav || !nav.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      console.log('[mic] no getUserMedia / MediaRecorder on this device');
      this.setState({ recPhase: 'failed' });
      return;
    }
    const attempts = this.state.recAttempts + 1;
    this.setState({ recTrying: true, recAttempts: attempts });
    const settle = (patch) => setTimeout(() => this.setState(Object.assign({ recTrying: false }, patch)), 400);
    try {
      console.log('[mic] requesting, attempt ' + attempts + ', framed=' + framed);
      this._stream = await nav.getUserMedia({ audio: true });
      console.log('[mic] granted');
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      settle({ recPhase: 'record', recIdx: 0 });
      return;
    } catch (e) {
      console.log('[mic] failed: ' + e.name + ' — ' + e.message);
      if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') { settle({ recPhase: 'failed' }); return; }
      if (attempts >= 2) { console.log('[mic] two attempts failed, continuing without voice'); settle({ recPhase: 'failed' }); return; }
      settle({ recPhase: framed ? 'framed' : 'blocked' });
    }
  },

  recToggle() {
    if (this.state.recBusy) { this.stopClip(); return; }
    if (!this._stream) return;
    const chunks = [];
    const mr = new MediaRecorder(this._stream);
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        const buf = await this._ctx.decodeAudioData(await blob.arrayBuffer());
        this.clips.push(buf);
      } catch (e) {}
      const next = this.state.recIdx + 1;
      if (next >= this.REC_LINES.length) this.finishRecording();
      else this.setState({ recIdx: next, recBusy: false, recLevel: 0 });
    };
    this._rec = mr;
    mr.start();
    this.setState({ recBusy: true });
    let t = 0;
    this._lvl = setInterval(() => { t += 0.12; this.setState({ recLevel: 30 + Math.abs(Math.sin(t * 3)) * 60 }); }, 110);
  },

  stopClip() {
    clearInterval(this._lvl);
    try { this._rec.stop(); } catch (e) {}
  },

  concat(list, trims) {
    const ctx = this._ctx;
    const parts = list.map((b, i) => {
      const keep = trims && trims[i] ? Math.min(b.duration, trims[i]) : b.duration;
      return { buf: b, len: Math.floor(keep * b.sampleRate) };
    });
    const total = parts.reduce((n, p) => n + p.len, 0);
    const out = ctx.createBuffer(1, total, ctx.sampleRate);
    const dst = out.getChannelData(0);
    let o = 0;
    for (const p of parts) {
      const src = p.buf.getChannelData(0);
      for (let i = 0; i < p.len; i++) dst[o + i] = src[i];
      o += p.len;
    }
    return out;
  },

  addHiss(buf) {
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.max(-1, Math.min(1, d[i] + (Math.random() - 0.5) * 0.012));
    return buf;
  },

  finishRecording() {
    try {
      this._real = this.concat(this.clips);
      const c = this.clips;
      this._splice = this.addHiss(this.concat([c[2], c[0], c[1]], [null, c[0] ? c[0].duration * 0.42 : null, null]));
    } catch (e) {}
    try { if (this._stream) this._stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    this._stream = null;
    const inIntro = this.state.screen === 'introchat';
    this.setState(s => ({
      recOpen: false, recPhase: 'intro', recBusy: false, voiceSent: true, hasRecording: true,
      chat: inIntro ? s.chat : s.chat.concat([{ who: 'You', mine: true, kind: 'voice', dur: '0:10', audio: 'real', caption: 'You, reading it out.' }])
    }), () => { if (inIntro) this._it = setTimeout(() => this.introStep(), 800); });
    if (!inIntro) this.advance(1);
    this.log('— you sent your own voice');
  },

  playBuf(which) {
    const b = which === 'splice' ? this._splice : this._real;
    if (!b || !this._ctx) return;
    try {
      const src = this._ctx.createBufferSource();
      src.buffer = b;
      src.connect(this._ctx.destination);
      src.start();
    } catch (e) {}
  },

  deleteRecording() {
    this.wipeAudio();
    this.setState({ hasRecording: false });
  }
});
