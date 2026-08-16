const DAY3_CLONE_TEXT = 'I think Nicole is just jealous of Nele. She loves gossiping as well.';

window.GameMethods = Object.assign(window.GameMethods || {}, {
  openRecorder() {
    this.setState({
      recOpen: true, recPhase: 'intro', recIdx: 0, recBusy: false, recLevel: 0,
      recPending: true, recTrying: false, recAttempts: 0
    });
  },

  async recAllow() {
    if (this.state.recTrying) return;
    const nav = navigator.mediaDevices;
    const framed = window.self !== window.top;
    const secure = typeof window.isSecureContext === 'boolean'
      ? window.isSecureContext
      : (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');
    const getUserMedia = nav && (nav.getUserMedia
      ? nav.getUserMedia.bind(nav)
      : (nav.webkitGetUserMedia ? nav.webkitGetUserMedia.bind(nav) : null));
    if (!secure || !getUserMedia || typeof window.MediaRecorder === 'undefined') {
      console.log('[mic] unavailable', { secure, hasGum: !!getUserMedia, hasMR: typeof window.MediaRecorder !== 'undefined' });
      // Insecure HTTP / missing API — not the same as "no hardware mic".
      this.setState({ recPhase: framed ? 'framed' : 'blocked' });
      return;
    }
    const attempts = this.state.recAttempts + 1;
    this.setState({ recTrying: true, recAttempts: attempts });
    const settle = (patch) => setTimeout(() => this.setState(Object.assign({ recTrying: false }, patch)), 400);
    try {
      console.log('[mic] requesting, attempt ' + attempts + ', framed=' + framed);
      this._stream = await getUserMedia({ audio: true });
      console.log('[mic] granted');
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      settle({ recPhase: 'record', recIdx: 0, recAttempts: 0 });
      return;
    } catch (e) {
      const name = (e && e.name) || '';
      console.log('[mic] failed: ' + name + ' — ' + (e && e.message));
      // Permission / policy — keep asking; do not claim the device has no mic.
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
        settle({ recPhase: framed ? 'framed' : 'blocked' });
        return;
      }
      // Some Android builds mis-report denial as NotFoundError before a prompt.
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        if (attempts < 2) {
          settle({ recPhase: framed ? 'framed' : 'blocked' });
          return;
        }
        settle({ recPhase: 'failed' });
        return;
      }
      if (attempts >= 3) {
        console.log('[mic] repeated failures, offering typed fallback');
        settle({ recPhase: 'failed' });
        return;
      }
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
    const voiceMsg = {
      who: 'You', mine: true, kind: 'voice', dur: '0:10', audio: 'real',
      caption: 'You, reading it out.'
    };
    this.setState(s => ({
      recOpen: false, recPhase: 'intro', recBusy: false, recPending: false, voiceSent: true,
      // Keep the Sunday note in group history (day 1 also reseeds from P_LOG when voiceSent).
      chat: s.chat.some(m => m.mine && m.audio === 'real')
        ? s.chat
        : s.chat.concat([voiceMsg])
    }), () => { if (inIntro) this._it = setTimeout(() => this.introStep(), 800); });
    if (!inIntro) this.advance(1);
    this.log('— you sent your own voice');
    this.persistPlayerVoice();
    this.prepareVoiceClone();
  },

  // Leave the mic sheet without a recording (permission blocked, no mic, or user skip).
  skipRecording() {
    this.wipeAudio();
    this.clearPersistedPlayerVoice();
    const inIntro = this.state.screen === 'introchat';
    this.setState(s => ({
      recOpen: false,
      recPhase: 'intro',
      recBusy: false,
      recPending: false,
      voiceSent: false,
      used: Object.assign({}, s.used, { sendvoice: true })
    }), () => {
      if (inIntro) this._it = setTimeout(() => this.introStep(), 500);
    });
    if (!inIntro) this.advance(1);
    this.log('— you skipped the voice note');
  },

  // Survive reload: keep the player's Sunday mic buffers in IndexedDB (not localStorage).
  VOICE_DB_NAME: 'ithoughtiknewyou-voice-v1',
  VOICE_STORE: 'buffers',

  ensureAudioCtx() {
    if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this._ctx;
  },

  audioBufferToWavBlob(buf) {
    if (!buf || !window.PocketTtsAudio || !window.PocketTtsAudio.chunksToWavBlob) return null;
    return window.PocketTtsAudio.chunksToWavBlob([buf.getChannelData(0)], buf.sampleRate);
  },

  openVoiceDb() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('indexedDB unavailable'));
        return;
      }
      const req = indexedDB.open(this.VOICE_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.VOICE_STORE)) {
          db.createObjectStore(this.VOICE_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('voice db open failed'));
    });
  },

  idbReq(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('idb request failed'));
    });
  },

  idbTxDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('idb tx failed'));
      tx.onabort = () => reject(tx.error || new Error('idb tx aborted'));
    });
  },

  async persistPlayerVoice() {
    if (!this._real) return;
    try {
      const realBlob = this.audioBufferToWavBlob(this._real);
      if (!realBlob) return;
      const spliceBlob = this._splice ? this.audioBufferToWavBlob(this._splice) : null;
      const db = await this.openVoiceDb();
      const tx = db.transaction(this.VOICE_STORE, 'readwrite');
      const store = tx.objectStore(this.VOICE_STORE);
      store.put({ id: 'real', blob: realBlob });
      if (spliceBlob) store.put({ id: 'splice', blob: spliceBlob });
      else store.delete('splice');
      await this.idbTxDone(tx);
      try { db.close(); } catch (e) {}
    } catch (e) {
      console.warn('[voice] persist failed', e);
    }
  },

  async restorePlayerVoice() {
    if (this._real) return true;
    if (!this.state.voiceSent) return false;
    try {
      const db = await this.openVoiceDb();
      const tx = db.transaction(this.VOICE_STORE, 'readonly');
      const store = tx.objectStore(this.VOICE_STORE);
      const realRec = await this.idbReq(store.get('real'));
      const spliceRec = await this.idbReq(store.get('splice'));
      await this.idbTxDone(tx);
      try { db.close(); } catch (e) {}
      if (!realRec || !realRec.blob) return false;
      this.ensureAudioCtx();
      const realAb = await realRec.blob.arrayBuffer();
      this._real = await this._ctx.decodeAudioData(realAb.slice(0));
      if (spliceRec && spliceRec.blob) {
        const spliceAb = await spliceRec.blob.arrayBuffer();
        this._splice = await this._ctx.decodeAudioData(spliceAb.slice(0));
      }
      if (!this.state.cloneAudioSrc) this.prepareVoiceClone();
      return !!this._real;
    } catch (e) {
      console.warn('[voice] restore failed', e);
      return false;
    }
  },

  ensurePlayerVoice() {
    if (this._real) return Promise.resolve(true);
    if (!this.state.voiceSent) return Promise.resolve(false);
    if (this._voiceRestorePromise) return this._voiceRestorePromise;
    this._voiceRestorePromise = this.restorePlayerVoice().finally(() => {
      this._voiceRestorePromise = null;
    });
    return this._voiceRestorePromise;
  },

  async clearPersistedPlayerVoice() {
    try {
      const db = await this.openVoiceDb();
      const tx = db.transaction(this.VOICE_STORE, 'readwrite');
      tx.objectStore(this.VOICE_STORE).clear();
      await this.idbTxDone(tx);
      try { db.close(); } catch (e) {}
    } catch (e) {
      console.warn('[voice] clear failed', e);
    }
  },

  playRealVoice(key) {
    if (this._real) {
      this.playBuf('real', key);
      return;
    }
    this.ensurePlayerVoice().then(ok => {
      if (ok && this._real) this.playBuf('real', key);
    });
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

  // Clone → in-memory splice → avatar-matched static default.
  day3CloneFallbackSrc() {
    const gender = this.state.playerAvatar === 'male' ? 'male' : 'female';
    return 'assets/audios/clip_you_fallback_' + gender + '.mp3';
  },

  isDay3CloneFallbackSrc(src) {
    return src === 'assets/audios/clip_you_fallback_female.mp3'
      || src === 'assets/audios/clip_you_fallback_male.mp3';
  },

  resolveDay3ClonePlay() {
    if (this.state.cloneAudioSrc) return { mode: 'file', src: this.state.cloneAudioSrc };
    if (this._splice) return { mode: 'buf', which: 'splice' };
    return { mode: 'file', src: this.day3CloneFallbackSrc() };
  },

  playDay3Clone(key) {
    const playResolved = () => {
      const resolved = this.resolveDay3ClonePlay();
      if (resolved.mode === 'file') this.playFile(resolved.src, key);
      else this.playBuf(resolved.which, key);
    };
    if (this.state.cloneAudioSrc || this._splice) {
      playResolved();
      return;
    }
    // After reload, splice may still be on disk even if TTS clone is not.
    this.ensurePlayerVoice().then(() => playResolved());
  },

  toggleChatAudio(key, message) {
    if (this.state.playingAudioKey === key) {
      this.stopAudio();
      return;
    }
    if (message.audioSrc) this.playFile(message.audioSrc, key);
    else if (message.audio === 'real') this.playRealVoice(key);
    else if (message.audio === 'clone') this.playDay3Clone(key);
    else if (message.audio) this.playBuf(message.audio, key);
  },

  formatAudioTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ':' + String(r).padStart(2, '0');
  },

  clearAudioScrubWatch() {
    if (this._audioScrubTimer) {
      clearInterval(this._audioScrubTimer);
      this._audioScrubTimer = null;
    }
  },

  startAudioScrubWatch() {
    this.clearAudioScrubWatch();
    this.tickAudioScrub();
    this._audioScrubTimer = setInterval(() => this.tickAudioScrub(), 100);
  },

  tickAudioScrub() {
    const file = this._fileAudio;
    if (file) {
      const dur = file.duration;
      const t = file.currentTime || 0;
      const pct = (isFinite(dur) && dur > 0) ? Math.min(100, (t / dur) * 100) : 0;
      const nextPct = pct.toFixed(1) + '%';
      const nextLabel = this.formatAudioTime(t);
      if (nextPct !== this.state.audioScrubPct || nextLabel !== this.state.audioScrubLabel) {
        this.setState({ audioScrubPct: nextPct, audioScrubLabel: nextLabel });
      }
      return;
    }
    if (this._bufferSource && this._bufferPlayStarted != null) {
      const dur = this._bufferPlayDuration || 0;
      const offset = this._bufferOffset || 0;
      const t = Math.min(dur, offset + (performance.now() - this._bufferPlayStarted) / 1000);
      const pct = dur > 0 ? Math.min(100, (t / dur) * 100) : 0;
      const nextPct = pct.toFixed(1) + '%';
      const nextLabel = this.formatAudioTime(t);
      if (nextPct !== this.state.audioScrubPct || nextLabel !== this.state.audioScrubLabel) {
        this.setState({ audioScrubPct: nextPct, audioScrubLabel: nextLabel });
      }
    }
  },

  resetAudioScrub(updateState) {
    this.clearAudioScrubWatch();
    this._bufferPlayStarted = null;
    this._bufferPlayDuration = 0;
    this._bufferOffset = 0;
    this._bufferWhich = null;
    if (updateState === false) return;
    if (this.state.audioScrubPct !== '0%' || this.state.audioScrubLabel !== '0:00' || this.state.audioPaused) {
      this.setState({ audioScrubPct: '0%', audioScrubLabel: '0:00', audioPaused: false });
    }
  },

  galleryAudioKey(row) {
    if (!row || row.kind !== 'audio') return null;
    if (row.playReal) return 'gallery-sunday';
    if (row.audioSrc) return 'gallery:' + (row.name || 'audio');
    if (row.item === 5) return 'gallery-clip';
    return 'gallery:' + (row.name || 'audio');
  },

  pauseGalleryAudio() {
    const file = this._fileAudio;
    if (file && !file.paused) {
      try { file.pause(); } catch (e) {}
      this.clearAudioScrubWatch();
      this.tickAudioScrub();
      this.setState({ audioPaused: true });
      return;
    }
    if (this._bufferSource) {
      const elapsed = (performance.now() - this._bufferPlayStarted) / 1000;
      this._bufferOffset = Math.min(this._bufferPlayDuration || 0, (this._bufferOffset || 0) + elapsed);
      const source = this._bufferSource;
      this._bufferSource = null;
      source.onended = null;
      try { source.stop(); } catch (e) {}
      this.clearAudioScrubWatch();
      const t = this._bufferOffset || 0;
      const dur = this._bufferPlayDuration || 0;
      const pct = dur > 0 ? Math.min(100, (t / dur) * 100) : 0;
      this.setState({
        audioPaused: true,
        audioScrubPct: pct.toFixed(1) + '%',
        audioScrubLabel: this.formatAudioTime(t)
      });
    }
  },

  resumeGalleryAudio() {
    const file = this._fileAudio;
    if (file) {
      const playing = file.play();
      if (playing && typeof playing.catch === 'function') {
        playing.catch(() => this.stopAudio());
      }
      this.setState({ audioPaused: false });
      this.startAudioScrubWatch();
      return;
    }
    const which = this._bufferWhich;
    const b = which === 'splice' ? this._splice : this._real;
    const key = this.state.playingAudioKey;
    if (!b || !this._ctx || !key) {
      this.stopAudio();
      return;
    }
    const offset = this._bufferOffset || 0;
    if (offset >= b.duration) {
      this.stopAudio();
      return;
    }
    let source = null;
    try {
      source = this._ctx.createBufferSource();
      source.buffer = b;
      source.connect(this._ctx.destination);
      this._bufferSource = source;
      const clear = () => {
        if (this._bufferSource !== source) return;
        this._bufferSource = null;
        this.resetAudioScrub(false);
        if (this.state.playingAudioKey === key) {
          this.setState({ playingAudioKey: null, audioPaused: false, audioScrubPct: '0%', audioScrubLabel: '0:00' });
        }
      };
      source.onended = clear;
      this._bufferPlayStarted = performance.now();
      this._bufferPlayDuration = b.duration;
      source.start(0, offset);
      this.setState({ audioPaused: false });
      this.startAudioScrubWatch();
    } catch (e) {
      if (this._bufferSource === source) this._bufferSource = null;
      this.stopAudio();
    }
  },

  playGalleryOpen(row) {
    const key = this.galleryAudioKey(row);
    if (!key) return;
    if (this.state.playingAudioKey === key) {
      if (this.state.audioPaused) this.resumeGalleryAudio();
      else this.pauseGalleryAudio();
      return;
    }
    if (row.playReal) {
      this.playRealVoice(key);
      return;
    }
    if (row.audioSrc) {
      this.playFile(row.audioSrc, key);
      return;
    }
    if (row.item === 5) {
      this.playDay3Clone(key);
      return;
    }
    this.playBuf('real', key);
  },

  stopAudio(updateState) {
    const shouldUpdate = updateState !== false;
    this.clearAudioScrubWatch();
    this._bufferPlayStarted = null;
    this._bufferPlayDuration = 0;
    this._bufferOffset = 0;
    this._bufferWhich = null;

    const file = this._fileAudio;
    this._fileAudio = null;
    if (file) {
      file.onended = null;
      file.onerror = null;
      file.ontimeupdate = null;
      try { file.pause(); file.currentTime = 0; } catch (e) {}
      try { file.removeAttribute('src'); file.load(); } catch (e) {}
    }

    const buffer = this._bufferSource;
    this._bufferSource = null;
    if (buffer) {
      buffer.onended = null;
      try { buffer.stop(); } catch (e) {}
    }

    if (shouldUpdate) {
      const needsClear = this.state.playingAudioKey !== null
        || this.state.audioPaused
        || this.state.audioScrubPct !== '0%'
        || this.state.audioScrubLabel !== '0:00';
      if (needsClear) {
        this.setState({
          playingAudioKey: null,
          audioPaused: false,
          audioScrubPct: '0%',
          audioScrubLabel: '0:00'
        });
      }
    }
  },

  startTitleWriteSfx() {
    this.stopTitleWriteSfx();
    try {
      const audio = new Audio('assets/freesound_community-writing-on-paper-29376.mp3');
      audio.loop = true;
      audio.volume = 0.28;
      audio.preload = 'auto';
      this._titleWriteAudio = audio;
      const playing = audio.play();
      if (playing && typeof playing.catch === 'function') {
        playing.catch(() => {
          if (this._titleWriteAudio === audio) this._titleWriteAudio = null;
        });
      }
    } catch (e) {
      this._titleWriteAudio = null;
    }
  },

  stopTitleWriteSfx() {
    const audio = this._titleWriteAudio;
    this._titleWriteAudio = null;
    if (!audio) return;
    try { audio.pause(); audio.currentTime = 0; } catch (e) {}
    try { audio.removeAttribute('src'); audio.load(); } catch (e) {}
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
        this.resetAudioScrub(false);
        if (this.state.playingAudioKey === key) {
          this.setState({
            playingAudioKey: null,
            audioPaused: false,
            audioScrubPct: '0%',
            audioScrubLabel: '0:00'
          });
        }
      };
      audio.onended = clear;
      audio.onerror = clear;
      audio.ontimeupdate = () => {
        if (this._fileAudio === audio) this.tickAudioScrub();
      };
      this.setState({ playingAudioKey: key || null, audioPaused: false, audioScrubPct: '0%', audioScrubLabel: '0:00' });
      this.startAudioScrubWatch();
      const playing = audio.play();
      if (playing && typeof playing.catch === 'function') playing.catch(clear);
      if (src === this.state.cloneAudioSrc || this.isDay3CloneFallbackSrc(src)) {
        this.markVoiceHeard('clone');
      }
      this.markDay4VoicePlay(src);
    } catch (e) {
      if (this._fileAudio === audio) this._fileAudio = null;
      this.resetAudioScrub(false);
      if (this.state.playingAudioKey === key) {
        this.setState({ playingAudioKey: null, audioPaused: false, audioScrubPct: '0%', audioScrubLabel: '0:00' });
      }
    }
  },

  playBuf(which, key) {
    let b = which === 'splice' ? this._splice : this._real;
    if (!b) {
      if (which === 'real') {
        this.ensurePlayerVoice().then(() => {
          if (this._real) this.playBuf('real', key);
        });
        return;
      }
      if (which === 'splice') {
        this.ensurePlayerVoice().then(() => {
          if (this._splice) this.playBuf('splice', key);
          else this.playFile(this.day3CloneFallbackSrc(), key);
        });
        return;
      }
      return;
    }
    if (!this._ctx) this.ensureAudioCtx();
    if (!this._ctx) return;
    this.stopAudio();
    b = which === 'splice' ? this._splice : this._real;
    if (!b) return;
    let source = null;
    try {
      source = this._ctx.createBufferSource();
      source.buffer = b;
      source.connect(this._ctx.destination);
      this._bufferSource = source;
      this._bufferWhich = which;
      this._bufferOffset = 0;
      this._bufferPlayDuration = b.duration || 0;
      this._bufferPlayStarted = performance.now();
      const clear = () => {
        if (this._bufferSource !== source) return;
        this._bufferSource = null;
        this.resetAudioScrub(false);
        if (this.state.playingAudioKey === key) {
          this.setState({
            playingAudioKey: null,
            audioPaused: false,
            audioScrubPct: '0%',
            audioScrubLabel: '0:00'
          });
        }
      };
      source.onended = clear;
      this.setState({ playingAudioKey: key || null, audioPaused: false, audioScrubPct: '0%', audioScrubLabel: '0:00' });
      this.startAudioScrubWatch();
      source.start();
      if (which === 'real') this.markVoiceHeard('original');
      else if (which === 'splice') this.markVoiceHeard('clone');
    } catch (e) {
      if (this._bufferSource === source) this._bufferSource = null;
      this.resetAudioScrub(false);
      if (this.state.playingAudioKey === key) {
        this.setState({ playingAudioKey: null, audioPaused: false, audioScrubPct: '0%', audioScrubLabel: '0:00' });
      }
    }
  },

  // Clip-night diary: play both the clone and the Sunday original → d4cmp.
  markVoiceHeard(kind) {
    const st = this.state;
    const heardClone = kind === 'clone' || st.heardCloneVoice;
    const heardOriginal = kind === 'original' || st.heardOriginalVoice;
    const patch = {};
    if (kind === 'clone' && !st.heardCloneVoice) patch.heardCloneVoice = true;
    if (kind === 'original' && !st.heardOriginalVoice) patch.heardOriginalVoice = true;
    const inClip = st.clipBack || (st.day === 3 && st.phase === 'clip');
    if (inClip && heardClone && heardOriginal && !st.done.d4cmp) {
      patch.done = Object.assign({}, st.done, { d4cmp: true });
    }
    if (!Object.keys(patch).length) return;
    this.setState(patch);
    if (patch.done) {
      this.bumpHint(5, 'confirm', 'd4cmp');
      this.log('— you compared the voice to the original');
    }
  },

  // Thursday diary: play Hanna's forwarded Nicole voice twice → d5listen.
  DAY4_VOICE_SRC: 'assets/audios/4-first_audio.wav',

  markDay4VoicePlay(src) {
    if (src !== this.DAY4_VOICE_SRC) return;
    const st = this.state;
    if (st.day !== 4) return;
    const plays = (st.day4VoicePlays || 0) + 1;
    const patch = { day4VoicePlays: plays };
    if (plays >= 2 && !st.done.d5listen) {
      patch.done = Object.assign({}, st.done, { d5listen: true });
    }
    this.setState(patch);
    if (patch.done) {
      this.bumpHint(4, 'hint', 'd5listen');
      this.log('— you listened to the voice twice');
    }
  }

});
