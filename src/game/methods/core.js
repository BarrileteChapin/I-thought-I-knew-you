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

  applyVariant(day, key) {
    const set = this.VARIANTS[key];
    const v = set && set[this.state.variant];
    if (!v) return day;
    return Object.assign({}, day, {
      fake: v.fake,
      volunteer: v.volunteer || day.volunteer,
      checks: day.checks.map(c => v.results[c.id] ? Object.assign({}, c, { result: v.results[c.id] }) : c)
    });
  },

  allDays() {
    return {
      1: this.DAYS[1],
      2: this.applyVariant(this.DAYS[2], 2),
      3: this.applyVariant(this.DAYS[3], 3),
      4: this.applyVariant(this.DAYS[4], 4)
    };
  },

  // Room backdrop by calendar day / phase (webp art encodes time of day).
  roomBgFor(day, phase) {
    if (day === 1) return 'assets/room_night.webp';       // Monday
    if (day === 2) return 'assets/room_main.webp';        // Tuesday
    if (day === 3 && phase === 'morning') return 'assets/room_morning.webp';
    if (day === 3) return 'assets/room_night.webp';      // Wednesday night / clip
    if (day === 4) return 'assets/room_main.webp';        // Thursday
    return 'assets/room_main.webp';
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

  samTier(v) {
    const s = v === undefined ? this.state.sam : v;
    if (this.state.samDead || this.state.samSilent || s < 16) return 'gone';
    return s >= 70 ? 'high' : s >= 35 ? 'ok' : 'low';
  },

  name() { return this.state.playerName || 'Alex'; },

  faceOf(who) {
    return window.__R({
      Nicole: 'assets/av-nicole.webp', Hanna: 'assets/av-hanna.webp', Lea: 'assets/av-lea.webp',
      Nele: 'assets/av-nele.webp', Benito: 'assets/av-benito.webp', Mia: 'assets/av-mia.webp',
      Tim: 'assets/av-hanna.webp'
    }[who] || 'assets/av-mia.webp');
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
  }
});
