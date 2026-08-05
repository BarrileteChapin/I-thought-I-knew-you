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

  clamp(v) { return Math.max(0, Math.min(100, v)); },

  barColor(v, hex) {
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
      Nicole: 'assets/av-nicole.png', Hanna: 'assets/av-hanna.png', Lea: 'assets/av-lea.png',
      Nele: 'assets/av-nele.png', Benito: 'assets/av-benito.png', Mia: 'assets/av-mia.png',
      Tim: 'assets/av-hanna.png'
    }[who] || 'assets/av-mia.png');
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
