const DAY3_CLONE_TEXT = 'I think Nicole is just jealous of Nele. She loves gossiping as well.';

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
      recOpen: false, recPhase: 'intro', recBusy: false, voiceSent: true,
      chat: inIntro ? s.chat : s.chat.concat([{ who: 'You', mine: true, kind: 'voice', dur: '0:10', audio: 'real', caption: 'You, reading it out.' }])
    }), () => { if (inIntro) this._it = setTimeout(() => this.introStep(), 800); });
    if (!inIntro) this.advance(1);
    this.log('— you sent your own voice');
    this.prepareVoiceClone();
  },

  prepareVoiceClone() {
    if (!this._real || !window.PocketTtsAdapter) return;
    if (this._ttsPreparePromise) return this._ttsPreparePromise;
    const run = (this._ttsRun || 0) + 1;
    this._ttsRun = run;
    this.setState({ ttsStatus: 'loading', ttsProgress: 0 });
    this._ttsPreparePromise = (async () => {
      try {
        if (!this._tts) this._tts = new window.PocketTtsAdapter();
        if (!this._tts.ready) {
          await this._tts.load((info) => {
            if (run !== this._ttsRun || !info || !info.total) return;
            const progress = Math.max(0, Math.min(100, Math.round(info.loaded * 100 / info.total)));
            this.setState({ ttsStatus: 'loading', ttsProgress: progress });
          });
          console.info('[tts] model loaded', {
            language: this._tts.language,
            sampleRate: this._tts.sampleRate,
            voiceCloning: this._tts.voiceCloning,
          });
        }
        if (run !== this._ttsRun) return;
        this.setState({ ttsStatus: 'cloning', ttsProgress: 100 });
        this._ttsVoice = await this._tts.cloneVoice(this._real.getChannelData(0), this._real.sampleRate);
        if (run !== this._ttsRun) return;
        this.setState({ ttsStatus: 'ready' });
        if (this.state.day === 3 && this.state.phase === 'clip') this.generateDay3Voice();
      } catch (e) {
        if (run === this._ttsRun) this.setState({ ttsStatus: 'failed', ttsProgress: 0 });
        console.warn('[tts] voice clone unavailable', e);
      }
    })().finally(() => {
      if (this._ttsPreparePromise) this._ttsPreparePromise = null;
    });
    return this._ttsPreparePromise;
  },

  generateDay3Voice() {
    if (this._ttsGeneratePromise) return this._ttsGeneratePromise;
    if (this.state.cloneAudioSrc) return null;
    if (!this._ttsVoice) {
      this.prepareVoiceClone();
      return null;
    }
    const run = this._ttsRun || 0;
    this.setState({ ttsStatus: 'generating' });
    this._ttsGeneratePromise = (async () => {
      try {
        const chunks = [];
        const clip = (this.DAY_YOU.dm || []).find((message) => message.audio === 'clone');
        const text = (clip && clip.ttsText) || DAY3_CLONE_TEXT;
        const metrics = await this._tts.generate(text, this._ttsVoice, (chunk) => chunks.push(chunk.slice()));
        if (!chunks.length || run !== this._ttsRun) throw new Error('Pocket TTS returned no audio');
        const blob = window.PocketTtsAudio.chunksToWavBlob(chunks, this._tts.sampleRate);
        if (this._ttsAudioUrl) URL.revokeObjectURL(this._ttsAudioUrl);
        this._ttsAudioUrl = URL.createObjectURL(blob);
        this.setState({
          cloneAudioSrc: this._ttsAudioUrl,
          cloneAudioDuration: metrics.audioDuration || 0,
          ttsStatus: 'ready',
        });
      } catch (e) {
        if (run === this._ttsRun) this.setState({ ttsStatus: 'failed' });
        console.warn('[tts] Day 3 generation failed', e);
      }
    })().finally(() => {
      if (this._ttsGeneratePromise) this._ttsGeneratePromise = null;
    });
    return this._ttsGeneratePromise;
  },

  audioDurationLabel(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    return '0:' + String(total).padStart(2, '0');
  },

  toggleChatAudio(key, message) {
    if (this.state.playingAudioKey === key) {
      this.stopAudio();
      return;
    }
    if (message.audioSrc) this.playFile(message.audioSrc, key);
    else if (message.audio && message.audio !== 'clone') this.playBuf(message.audio, key);
  },

  stopAudio(updateState) {
    const shouldUpdate = updateState !== false;
    const file = this._fileAudio;
    this._fileAudio = null;
    if (file) {
      file.onended = null;
      file.onerror = null;
      try { file.pause(); file.currentTime = 0; } catch (e) {}
      try { file.removeAttribute('src'); file.load(); } catch (e) {}
    }

    const buffer = this._bufferSource;
    this._bufferSource = null;
    if (buffer) {
      buffer.onended = null;
      try { buffer.stop(); } catch (e) {}
    }

    if (shouldUpdate && this.state.playingAudioKey !== null) {
      this.setState({ playingAudioKey: null });
    }
  },

  playFile(src, key) {
    if (!src) return;
    this.stopAudio();
    let audio = null;
    try {
      audio = new Audio(src);
      this._fileAudio = audio;
      audio.preload = 'auto';
      const clear = () => {
        if (this._fileAudio !== audio) return;
        this._fileAudio = null;
        if (this.state.playingAudioKey === key) this.setState({ playingAudioKey: null });
      };
      audio.onended = clear;
      audio.onerror = clear;
      this.setState({ playingAudioKey: key || null });
      const playing = audio.play();
      if (playing && typeof playing.catch === 'function') playing.catch(clear);
    } catch (e) {
      if (this._fileAudio === audio) this._fileAudio = null;
      if (this.state.playingAudioKey === key) this.setState({ playingAudioKey: null });
    }
  },

  playBuf(which, key) {
    const b = which === 'splice' ? this._splice : this._real;
    if (!b || !this._ctx) return;
    this.stopAudio();
    let source = null;
    try {
      source = this._ctx.createBufferSource();
      source.buffer = b;
      source.connect(this._ctx.destination);
      this._bufferSource = source;
      const clear = () => {
        if (this._bufferSource !== source) return;
        this._bufferSource = null;
        if (this.state.playingAudioKey === key) this.setState({ playingAudioKey: null });
      };
      source.onended = clear;
      this.setState({ playingAudioKey: key || null });
      source.start();
    } catch (e) {
      if (this._bufferSource === source) this._bufferSource = null;
      if (this.state.playingAudioKey === key) this.setState({ playingAudioKey: null });
    }
  }

});
