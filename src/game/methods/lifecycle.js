window.GameMethods = Object.assign(window.GameMethods || {}, {
  componentDidMount() {
    const meta = this.readMeta();
    if (meta && meta.unlockedEndings) {
      this.setState({ unlockedEndings: meta.unlockedEndings });
    }
    this._prevScreen = this.state.screen;
    if (this.state.screen === 'title') this.beginTitleLead();
    if (this.state.screen === 'room' || this.state.screen === 'phone') {
      this.preloadRoomBg(this.roomBgFor(this.state.day, this.state.phase, !!this.state.phoneOpenedToday));
    }
    if (this.LLM_CHAT_ENABLED) {
      console.log('[chat-llm] preloading chat model');
      this.ensureLlm(false);
    }
    this._bye = () => this.wipeAudio();
    window.addEventListener('pagehide', this._bye);
    this._keys = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.shiftKey && '12345'.indexOf(e.key) > -1) {
        const d = parseInt(e.key, 10);
        console.log('[dev] jump to day ' + d);
        clearTimeout(this._it);
        this.startDay(d);
        this.setState({ screen: 'room', fading: false });
        return;
      }
      if (e.key === 'E' && e.shiftKey) {
        console.log('[dev] jump to ending with current state');
        this.enterEnding();
        return;
      }
      if ((e.key === 'Enter' || e.key === ' ') && this.state.screen === 'howto') {
        e.preventDefault();
        this.leaveHowTo();
        return;
      }
      if ((e.key === 'Enter' || e.key === ' ') && this.state.screen === 'introtext' && this.state.introReady) {
        e.preventDefault();
        this.advanceIntro();
      }
    };
    window.addEventListener('keydown', this._keys);
    window.addEventListener('beforeunload', this._bye);
  },

  componentWillUnmount() {
    this._chatGeneration = (this._chatGeneration || 0) + 1;
    window.removeEventListener('pagehide', this._bye);
    window.removeEventListener('keydown', this._keys);
    window.removeEventListener('beforeunload', this._bye);
    clearTimeout(this._saveTimer);
    clearTimeout(this._titleLeave);
    clearTimeout(this._titleType);
    clearTimeout(this._endingsClose);
    clearTimeout(this._phoneClose);
    this.saveGame();
    this.wipeAudio();
    clearTimeout(this._n1); clearTimeout(this._n2);
    clearTimeout(this._msgToastHide); clearTimeout(this._msgToastClear);
    clearTimeout(this._camT); clearTimeout(this._cineT);
    this.stopAmbient();
  },

  wipeAudio() {
    try { if (this._stream) this._stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    this.stopTitleWriteSfx();
    this.stopAudio(false);
    this._ttsRun = (this._ttsRun || 0) + 1;
    this._ttsPreparePromise = null;
    this._ttsGeneratePromise = null;
    this._ttsVoice = null;
    try { if (this._tts) this._tts.destroy(); } catch (e) {}
    try { if (this._ttsAudioUrl) URL.revokeObjectURL(this._ttsAudioUrl); } catch (e) {}
    this._tts = null; this._ttsAudioUrl = null;
    this.clips = [];
    this._stream = null; this._rec = null; this._real = null; this._splice = null;
  },

  componentDidUpdate(prevProps) {
    this.scheduleSave();
    // Runtime only passes prevProps; track screen ourselves so title lead
    // restarts every time we return to the title screen.
    const prevScreen = this._prevScreen;
    this._prevScreen = this.state.screen;
    if (this.state.screen === 'title' && prevScreen !== 'title' && !this.state.titleLeaving) {
      this.beginTitleLead();
    }
    if (this.state.screen === 'room' || this.state.screen === 'phone') {
      this.preloadRoomBg(this.roomBgFor(this.state.day, this.state.phase, !!this.state.phoneOpenedToday));
    }
    if (this._scrollToPost && this.state.dev === 'social') {
      const want = this._scrollToPost;
      requestAnimationFrame(() => {
        const el = document.querySelector('[data-post="' + want + '"]');
        if (!el) return;
        this._scrollToPost = null;
        let box = el.parentElement;
        while (box && box.scrollHeight <= box.clientHeight + 4) box = box.parentElement;
        if (!box) return;
        const delta = el.getBoundingClientRect().top - box.getBoundingClientRect().top;
        box.scrollTop = Math.max(0, box.scrollTop + delta - 12);
      });
    }
    const ie = this.introRef.current;
    if (ie && this.state.screen === 'introchat') ie.scrollTop = ie.scrollHeight;
    const el = this.msgRef.current;
    if (el && this.state.screen === 'phone' && this.state.threadOpen !== null) {
      if (this._pendingScroll) {
        this._pendingScroll = false;
        requestAnimationFrame(() => {
          const box = this.msgRef.current;
          if (!box) return;
          const mark = box.querySelector('[data-newmark]');
          if (mark) {
            const delta = mark.getBoundingClientRect().top - box.getBoundingClientRect().top;
            box.scrollTop = Math.max(0, box.scrollTop + delta - 12);
          } else box.scrollTop = box.scrollHeight;
          this._atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
        });
      } else if (this._atBottom !== false) {
        el.scrollTop = el.scrollHeight;
      } else if (!this.state.showNewPill) {
        const len = (this.state.threadOpen === 'group' ? this.state.chat : this.state.dm).length;
        if (len > (this._lastLen || 0)) this.setState({ showNewPill: true });
      }
      this._lastLen = (this.state.threadOpen === 'group' ? this.state.chat : this.state.dm).length;
    }
  }
});
