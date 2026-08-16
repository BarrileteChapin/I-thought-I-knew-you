window.GameMethods = Object.assign(window.GameMethods || {}, {
  fmt(min) {
    const m = ((min % 1440) + 1440) % 1440;
    let h = Math.floor(m / 60); const mm = String(m % 60).padStart(2, '0');
    const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12;
    return h + ':' + mm + ap;
  },

  day() {
    if (this.state.day === 3 && this.state.phase === 'clip') return this.DAY_YOU;
    const m = this.allDays(); return m[this.state.day] || m[1];
  },

  allDays() {
    return {
      1: this.DAYS[1],
      2: this.DAYS[2],
      3: this.DAYS[3],
      4: this.DAYS[4]
    };
  },

  // Room backdrop by calendar day / phase (webp art encodes time of day).
  // Until the phone is opened once that day, use the *_first still.
  roomBgFor(day, phase, phoneOpened) {
    let base = 'assets/room_main.webp';
    if (day === 1) base = 'assets/room_night.webp';       // Monday
    else if (day === 2) base = 'assets/room_main.webp';  // Tuesday
    else if (day === 3 && phase === 'morning') base = 'assets/room_morning.webp';
    else if (day === 3) base = 'assets/room_night.webp'; // Wednesday night / clip
    else if (day === 4) base = 'assets/room_main.webp';  // Thursday
    if (phoneOpened) return base;
    return base.replace(/\.webp$/, '_first.webp');
  },

  // Prefetch the room still; hotspots stay hidden until this src is ready.
  preloadRoomBg(src) {
    if (!src) return;
    if (this.state.roomBgReadySrc === src) return;
    if (this._roomBgLoadSrc === src) return;
    this._roomBgLoadSrc = src;
    const img = new Image();
    const done = () => {
      if (this._roomBgLoadSrc !== src) return;
      this._roomBgLoadSrc = null;
      if (this.state.roomBgReadySrc !== src) this.setState({ roomBgReadySrc: src });
    };
    img.onload = done;
    img.onerror = done;
    img.src = src;
    if (img.complete) done();
  },

  clamp(v) { return Math.max(0, Math.min(100, v)); },

  // Resolve a --c-* token to its computed value (needed when JS must parse hex).
  cssColor(token) {
    const name = token.startsWith('--') ? token : '--c-' + String(token).replace(/[A-Z]/g, (ch) => '-' + ch.toLowerCase());
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  },

  barColor(v, token) {
    const hex = (token && token[0] === '#') ? token : this.cssColor(token || 'accent');
    const grey = [138, 110, 122];
    const full = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    const t = Math.max(0, Math.min(1, v / 75));
    const c = full.map((n, i) => Math.round(grey[i] + (n - grey[i]) * t));
    return 'rgb(' + c.join(',') + ')';
  },

  /* Discrete bar status: danger <35, warning <65, else safe */
  barStatusColor(v) {
    if (v < 35) return 'var(--c-danger)';
    if (v < 65) return 'var(--c-warning)';
    return 'var(--c-safe)';
  },

  samTier(v) {
    const s = v === undefined ? this.state.sam : v;
    if (this.state.samDead || this.state.samSilent || s < 16) return 'gone';
    return s >= 70 ? 'high' : s >= 35 ? 'ok' : 'low';
  },

  name() { return this.state.playerName || 'Alex'; },

  // Safe token for diegetic download filenames (clip_Alex.m4a, etc.).
  fileSafeName(raw) {
    const s = String(raw == null ? this.name() : raw).trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return s || 'Alex';
  },

  // Sunday mic note the player recorded (before Monday). Mia's party is Fri 14th.
  recordingFileName() { return 'recording_0709.m4a'; },

  // Wednesday clone Nicole DMs — named after the player.
  clipFileName() { return 'clip_' + this.fileSafeName() + '.m4a'; },

  // Thursday forwarded “Nicole” voice — same family as her older voice_message_* notes.
  day4VoiceFileName() { return 'voice_message_0713.m4a'; },

  evidenceDeskTitle(dayObj) {
    if (dayObj === this.DAY_YOU) return this.clipFileName();
    if (dayObj === this.DAYS[4]) return this.day4VoiceFileName();
    return (dayObj && dayObj.deskTitle) || '';
  },

  evidenceDeskUrl(dayObj) {
    if (dayObj === this.DAY_YOU) return 'file:///downloads/' + this.clipFileName();
    if (dayObj === this.DAYS[4]) return 'file:///downloads/' + this.day4VoiceFileName();
    return (dayObj && dayObj.url) || '';
  },

  faceOf(who) {
    return window.__R({
      Nicole: 'assets/av-nicole.webp', Hanna: 'assets/av-hanna.webp', Lea: 'assets/av-lea.webp',
      Nele: 'assets/av-nele.webp', Benito: 'assets/av-benito.webp', Mia: 'assets/av-mia.webp',
      Tim: 'assets/av-hanna.webp'
    }[who] || 'assets/av-mia.webp');
  },

  /* CSS tokens: --c-who-* in styles/design-system.css */
  whoColorOf(who) {
    const slug = {
      Nicole: 'nicole', Hanna: 'hanna', Mia: 'mia', Lea: 'lea',
      Benito: 'benito', Nele: 'nele', Tim: 'hanna'
    }[who] || 'default';
    return 'var(--c-who-' + slug + ')';
  },

  preview(list) {
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (m.kind === 'video') return '📹 Video';
      if (m.kind === 'photo') return '📷 Photo';
      if (m.kind === 'shot') return '📷 Screenshot';
      if (m.kind === 'voice') return '🎤 Voice message';
      if (m.text) return (m.mine ? 'You: ' : (m.sys ? '' : m.who + ': ')) + m.text.split('{name}').join(this.name());
    }
    return '';
  },

  unreadFrom(list, lastReadLen) {
    const start = Math.max(0, Number(lastReadLen) || 0);
    return (list || []).slice(start).filter(m => !m.mine && !m.sys).length;
  },

  // Stable id for gallery "seen" dots (survives day changes and list growth).
  gallerySeenKey(row) {
    if (!row) return '';
    if (row.savedKind) return 'gal:saved:' + (row.name || row.savedKind);
    if (row.name) return 'gal:' + row.day + ':' + row.name;
    return 'gal:' + row.day + ':' + (row.kind || 'item') + ':' + (row.item != null ? row.item : '');
  },

  isViewingChat(tab) {
    const s = this.state;
    return s.screen === 'phone' && s.dev === 'chats' && s.threadOpen === tab;
  },

  // After incoming chat messages land: if that thread is open, mark read;
  // if closed, sync badge counts to messages past lastRead.
  applyIncomingReply(tab) {
    if (this.isViewingChat(tab)) {
      const list = tab === 'dm' ? this.state.dm : this.state.chat;
      this.setState(s => {
        const lastRead = Object.assign({}, s.lastRead, { [tab]: list.length });
        return Object.assign({ lastRead }, this.chatUnreadPatch(s.chat, s.dm, lastRead));
      });
      return;
    }
    this.setState(s => Object.assign(
      { chatFlash: true },
      this.chatUnreadPatch(s.chat, s.dm, s.lastRead)
    ));
    clearTimeout(this._cf);
    this._cf = setTimeout(() => this.setState({ chatFlash: false }), 900);
  },

  chatUnreadPatch(chat, dm, lastRead) {
    const lr = lastRead || {};
    const groupUnread = this.unreadFrom(chat, lr.group);
    const dmUnread = this.unreadFrom(dm, lr.dm);
    return { groupUnread, unread: groupUnread + dmUnread };
  },

  flushOpenThreadRead(st) {
    st = st || this.state;
    const k = st.threadOpen;
    if (!k || st.dev !== 'chats') return {};
    const list = k === 'group' ? st.chat : st.dm;
    const lastRead = Object.assign({}, st.lastRead, { [k]: list.length });
    return Object.assign({
      lastRead,
      newMarkAt: null,
      showNewPill: false
    }, this.chatUnreadPatch(st.chat, st.dm, lastRead));
  },

  openPhone(extra) {
    clearTimeout(this._phoneClose);
    this.setState(Object.assign({
      screen: 'phone',
      phoneClosing: false,
      phoneOpenedToday: true,
      actionsOpen: false,
      hintsOpen: false
    }, extra || {}));
  },

  closePhone() {
    if (this.state.screen !== 'phone' || this.state.phoneClosing) return;
    const st = this.state;
    const tier = this.samTier();
    const owed = st.dm.some(m => !m.mine && !m.sys && m.today);
    if (st.tab === 'dm' && !st.dmAnsweredToday && !st.onReadCharged && tier !== 'gone' && owed) {
      this.setState(s => ({
        onReadCharged: true,
        dm: s.dm.concat([{ who: 'System', sys: true, text: 'Seen ' + this.fmt(s.min) }])
      }));
      this.rel(-10, 0, null);
      this.log('— you left her on read');
    }
    this.setState(s => {
      const nextSeen = Object.assign({}, s.seen);
      if (s.dev === 'social') {
        (this._socialFeedIds || []).forEach(id => { nextSeen['soc:' + id] = true; });
      }
      return Object.assign({
        phoneClosing: true,
        actionsOpen: false,
        ignored: s.openedGroup && !s.actedToday,
        seen: nextSeen
      }, this.flushOpenThreadRead(s));
    });
    clearTimeout(this._phoneClose);
    this._phoneClose = setTimeout(() => {
      this.setState({ screen: 'room', phoneClosing: false, threadOpen: null });
    }, 300);
  }
});
