window.GameMethods = Object.assign(window.GameMethods || {}, {
  // Provisional daily tasks from existing check / DM / report actions.
  // kind 'done' → st.done[id]; kind 'flag' → truthy st[id].
  DAY_TASKS: {
    1: [
      { id: 'd1rev', label: 'Reverse-search the video', kind: 'done' },
      { id: 'd1mia', label: 'Ask someone who was at the party', kind: 'done' }
    ],
    2: [
      { id: 'd2rev', label: 'Reverse-search the photo', kind: 'done' },
      { id: 'd2sam', label: 'Ask Nicole about the photo', kind: 'done' }
    ],
    3: [
      { id: 'd3side', label: 'Compare the two accounts', kind: 'done' }
    ],
    clip: [
      { id: 'd4cmp', label: 'Compare the voice to the original', kind: 'done' }
    ],
    4: [
      { id: 'd5where', label: 'Ask the group where she was tonight', kind: 'done' },
      { id: 'd5listen', label: 'Listen to the voice twice', kind: 'done' }
    ]
  },

  TASK_DAY_ORDER: [1, 2, 3, 'clip', 4],

  // In-world diary dates for the week (Mia's party is Friday the 14th).
  DIARY_DATES: {
    1: { date: '10/07', day: 'Monday' },
    2: { date: '11/07', day: 'Tuesday' },
    3: { date: '12/07', day: 'Wednesday' },
    clip: { date: '12/07', day: 'Wednesday' },
    4: { date: '13/07', day: 'Thursday' }
  },

  taskDayKey(st) {
    const s = st || this.state;
    if (s.day === 3 && s.phase === 'clip') return 'clip';
    return s.day;
  },

  taskDayLabel(key) {
    return ({
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday morning',
      clip: 'Wednesday evening',
      4: 'Thursday'
    })[key] || '';
  },

  diaryDateParts(key) {
    const d = this.DIARY_DATES[key] || this.DIARY_DATES[1];
    return { day: d.day, date: d.date };
  },

  unlockedDiaryKeys(st) {
    const s = st || this.state;
    const cur = this.taskDayKey(s);
    const idx = this.TASK_DAY_ORDER.indexOf(cur);
    if (idx < 0) return [1];
    return this.TASK_DAY_ORDER.slice(0, idx + 1);
  },

  isPastDiaryKey(st, key) {
    const s = st || this.state;
    const cur = this.taskDayKey(s);
    const order = this.TASK_DAY_ORDER;
    return order.indexOf(key) >= 0 && order.indexOf(key) < order.indexOf(cur);
  },

  // Full diary page (got / did / think): sleep night, or reviewing a past night.
  notebookShowReflection(st) {
    const s = st || this.state;
    if (s.notebookSection !== 'day') return false;
    if (s.notebookMode === 'sleep') return true;
    return this.isPastDiaryKey(s, s.notebookDayKey);
  },

  // Swap files under assets/icons/mil/ — paths only change here.
  MIL_ICON_DIR: 'assets/icons/mil/',

  notebookMilCells() {
    const dir = this.MIL_ICON_DIR;
    return [
      {
        id: 'stop',
        icon: dir + 'stop.svg',
        title: 'Stop',
        body: 'Pause before you react or share.'
      },
      {
        id: 'source',
        icon: dir + 'source.svg',
        title: 'Investigate the source',
        body: 'Who sent this — and why?'
      },
      {
        id: 'coverage',
        icon: dir + 'coverage.svg',
        title: 'Find better coverage',
        body: 'Ask someone who was there.'
      },
      {
        id: 'trace',
        icon: dir + 'trace.svg',
        title: 'Trace it to the original',
        body: 'Where did it first appear, and when?'
      }
    ];
  },

  goNotebookIntro() {
    this.openNotebookBook('intro');
  },

  goNotebookMap() {
    this.openNotebookBook('map');
  },

  goNotebookReflection() {
    this.openNotebookBook('day');
  },

  openNotebookBook(section) {
    const unlocked = this.unlockedDiaryKeys();
    let key = this.state.notebookDayKey;
    if (section === 'day' && unlocked.indexOf(key) < 0) key = this.taskDayKey();
    this.stopAudio();
    this.setState({
      notebookSection: section,
      notebookDayKey: section === 'day' ? key : this.state.notebookDayKey,
      notebookMapFocus: section === 'map' ? null : this.state.notebookMapFocus,
      notebookAnim: true
    });
    clearTimeout(this._nbAnim);
    this._nbAnim = setTimeout(() => this.setState({ notebookAnim: false }), 700);
  },

  backToNotebookShelf() {
    if (this.state.notebookMode === 'sleep') return;
    this.stopAudio();
    this.setState({
      notebookSection: 'shelf',
      notebookMapFocus: null,
      notebookAnim: true
    });
    clearTimeout(this._nbAnim);
    this._nbAnim = setTimeout(() => this.setState({ notebookAnim: false }), 500);
  },

  notebookShelfBooks() {
    return [
      {
        id: 'day',
        title: 'Diary',
        cover: 'assets/book_1.webp',
        open: () => this.openNotebookBook('day')
      },
      {
        id: 'intro',
        title: 'Media Literacy Handbook',
        cover: 'assets/book_2.webp',
        open: () => this.openNotebookBook('intro')
      },
      {
        id: 'map',
        title: 'Album Class 10b',
        cover: 'assets/book_3.webp',
        open: () => this.openNotebookBook('map')
      }
    ].map(b => Object.assign(b, {
      cardClass: 'g-notebook-shelf-card'
    }));
  },

  // One hint per diary slot (Wed morning vs Wed evening are separate).
  // Reveals automatically once that slot's checklist is complete.
  DAY_HINTS: {
    1: {
      title: 'Day 1',
      body: 'Ask Mia — she was at the party too, and she might have the whole video.'
    },
    2: {
      title: 'Day 2',
      body: 'Check the comments under Nicole\'s social media post. Oh — and you can download photos from there too.'
    },
    3: {
      title: 'Day 3 — morning',
      body: 'Check the account details — who created the account.'
    },
    clip: {
      title: 'Day 3 — evening',
      body: 'Saw a news thing — new AI tools can clone a voice from just a short recording. Speaking of AI — someone said Benito won a school prize for some AI project last term.'
    },
    4: {
      title: 'Day 4',
      body: 'AI checkers aren\'t always right. Green doesn\'t mean true.'
    }
  },

  emptyNbHintsSeen() {
    return { 1: false, 2: false, 3: false, clip: false, 4: false };
  },

  hintSlotKey(st) {
    return this.taskDayKey(st);
  },

  dayHintReady(st, dayKey) {
    const s = st || this.state;
    const key = dayKey != null ? dayKey : this.hintSlotKey(s);
    const tasks = this.tasksForDay(key);
    if (!tasks.length) return false;
    return tasks.every(t => this.isTaskComplete(s, t));
  },

  // Checklist done for this slot → show hint.svg (resets each morning / evening).
  hintAvailable(st) {
    return this.dayHintReady(st);
  },

  maybeAutoUnlockTodayHint(st) {
    const s = st || this.state;
    const key = this.hintSlotKey(s);
    if (!this.dayHintReady(s, key)) return;
    if ((s.nbHintsSeen || {})[key]) return;
    clearTimeout(this._hintAuto);
    this._hintAuto = setTimeout(() => this.unlockHint(key), 0);
  },

  openHints() {
    this.maybeAutoUnlockTodayHint();
    this.setState({ hintsOpen: true, tip: null });
  },

  closeHints() {
    this.setState({ hintsOpen: false });
  },

  unlockHint(dayKey) {
    const key = dayKey != null ? dayKey : this.hintSlotKey();
    if (!this.DAY_HINTS[key]) return;
    if ((this.state.nbHintsSeen || {})[key]) return;
    if (!this.dayHintReady(this.state, key)) return;
    this.setState(s => ({
      nbHintsSeen: Object.assign({}, this.emptyNbHintsSeen(), s.nbHintsSeen || {}, { [key]: true })
    }));
  },

  hintsRows(st) {
    const s = st || this.state;
    const key = this.hintSlotKey(s);
    const def = this.DAY_HINTS[key];
    if (!def) return [];
    this.maybeAutoUnlockTodayHint(s);
    const seen = Object.assign({}, this.emptyNbHintsSeen(), s.nbHintsSeen || {});
    const ready = this.dayHintReady(s, key);
    const revealed = ready || !!seen[key];
    const locked = !revealed;
    return [{
      id: 'hint-' + key,
      title: def.title,
      body: def.body,
      revealed,
      locked,
      btnLabel: "Finish today's checklist to unlock this hint."
    }];
  },

  notebookTabLabel(key) {
    if (key === 'clip') return 'Wed eve';
    return ({
      1: 'Mon',
      2: 'Tue',
      3: 'Wed',
      4: 'Thu'
    })[key] || String(key);
  },

  notebookDayTabs(st) {
    const s = st || this.state;
    const unlocked = this.unlockedDiaryKeys(s);
    return unlocked.map(key => {
      const active = key === s.notebookDayKey;
      return {
        id: 'tab-' + key,
        label: this.notebookTabLabel(key),
        color: active ? '#2B2418' : '#8A7B5C',
        underline: active ? '#6B5D42' : 'transparent',
        active,
        go: () => this.setNotebookDayKey(key)
      };
    });
  },

  setNotebookDayKey(key) {
    const unlocked = this.unlockedDiaryKeys();
    if (unlocked.indexOf(key) < 0) return;
    this.stopAudio();
    this.setState({ notebookSection: 'day', notebookDayKey: key });
  },

  isTaskComplete(st, task) {
    if (!task) return false;
    if (task.kind === 'flag') return !!st[task.id];
    return !!(st.done && st.done[task.id]);
  },

  // Free-text chat → mark matching phone "ask" checks done (so Diary ticks).
  ASK_CHAT_MATCHERS: {
    d1mia(t) {
      return (/\bmia\b/.test(t) && /(party|there|said|happen|true|actually|what)/.test(t))
        || /(who was|anyone|were you).{0,24}(at |there|party)/.test(t)
        || /at (the|that) party/.test(t)
        || /(what (did |she |nicole ).{0,24}(say|said)|is that what)/.test(t);
    },
    d1jonas(t) {
      return /who (filmed|recorded|shot|took)|who'?s (filming|recording)/.test(t);
    },
    d2sam(t) {
      return /(photo|picture|\bpic\b|were you out|out last night|last night|is that you|that (photo|picture))/.test(t);
    },
    d3sam(t) {
      return /(account|profile|is that yours|is that you|did you (make|post|delete)|fake account)/.test(t);
    },
    d4when(t) {
      return /(when (was|were)|recorded|recording|tonight|sunday|voice ?note|same (one|recording|clip))/.test(t);
    },
    d5where(t) {
      return /where.{0,24}(nicole|she|her)/.test(t)
        || /(nicole|she|her).{0,24}(tonight|where)/.test(t)
        || (/anyone (actually )?know/.test(t) && /(nicole|she|her|tonight)/.test(t))
        || /where was/.test(t);
    }
  },

  matchAskCheckFromChat(tab, text) {
    const t = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!t) return null;
    const thread = tab === 'dm' ? 'dm' : 'group';
    const day = this.day();
    const checks = (day && day.checks) || [];
    for (let i = 0; i < checks.length; i++) {
      const c = checks[i];
      if (!c || c.where !== 'phone') continue;
      if ((c.thread || 'group') !== thread) continue;
      if (this.state.done && this.state.done[c.id]) continue;
      const match = this.ASK_CHAT_MATCHERS[c.id];
      if (match && match(t)) return c;
    }
    return null;
  },

  // Mark phone-check done + certainty/sift (no scripted reply — LLM already answered).
  maybeCompleteAskTasksFromChat(tab, text) {
    const c = this.matchAskCheckFromChat(tab, text);
    if (!c) return null;
    const st = this.state;
    if (st.done && st.done[c.id]) return null;
    const done = Object.assign({}, st.done); done[c.id] = true;
    const stats = JSON.parse(JSON.stringify(st.stats || {}));
    stats.checks = (stats.checks || 0) + 1;
    if (c.sift) {
      stats.sift = stats.sift || {};
      stats.sift[c.sift] = (stats.sift[c.sift] || 0) + 1;
    }
    if (!st.reactedToday) stats.stopped = (stats.stopped || 0) + 1;
    this.setState({ done, stats });
    this.bumpHint(c.item || this.state.day, c.effect, c.id);
    return c;
  },

  tasksForDay(key) {
    return (this.DAY_TASKS[key] || []).slice();
  },

  tasksAllComplete(st) {
    const s = st || this.state;
    return this.TASK_DAY_ORDER.every(key =>
      this.tasksForDay(key).every(t => this.isTaskComplete(s, t))
    );
  },

  taskScore(st) {
    const s = st || this.state;
    let done = 0, total = 0;
    this.TASK_DAY_ORDER.forEach(key => {
      this.tasksForDay(key).forEach(t => {
        total += 1;
        if (this.isTaskComplete(s, t)) done += 1;
      });
    });
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  },

  notebookRows(st, dayKey) {
    const s = st || this.state;
    const key = dayKey != null ? dayKey : this.taskDayKey(s);
    return this.tasksForDay(key).map(t => {
      const done = this.isTaskComplete(s, t);
      return {
        id: t.id,
        label: t.label,
        done,
        notDone: !done,
        mark: done ? '✓' : '',
        opacity: done ? 1 : 0.45
      };
    });
  },

  emptyVerdict() {
    return { 1: null, 2: null, 3: null, clip: null, 4: null };
  },

  emptyVerdictNote() {
    return { 1: '', 2: '', 3: '', clip: '', 4: '' };
  },

  setVerdict(dayKey, val) {
    const key = dayKey != null ? dayKey : this.state.notebookDayKey;
    this.setState(s => ({
      verdict: Object.assign({}, s.verdict || this.emptyVerdict(), { [key]: val })
    }));
  },

  setVerdictNote(dayKey, val) {
    const key = dayKey != null ? dayKey : this.state.notebookDayKey;
    this.setState(s => ({
      verdictNote: Object.assign({}, s.verdictNote || this.emptyVerdictNote(), {
        [key]: String(val || '').slice(0, 400)
      })
    }));
  },

  // Evidence shown in sleep-diary "What I got" (one item for the day being closed).
  notebookGotItems(st, dayKey) {
    const s = st || this.state;
    const key = dayKey != null ? dayKey : (s.notebookDayKey != null ? s.notebookDayKey : this.taskDayKey(s));
    const bars = Array.from({ length: 18 }, (_, i) => ({ h: (6 + ((i * 37) % 16)) + 'px' }));
    const when = this.taskDayLabel(key);
    const audioKey = 'nb-got-' + key;
    const playing = s.playingAudioKey === audioKey;

    if (key === 1) {
      return [{
        id: 'got-1',
        isVideo: true, isImage: false, isAudio: false,
        label: 'IMG_4471.mp4',
        meta: when + ' · sent by Hanna',
        caption: 'Nicole, filmed at a party.',
        bars: [],
        spec: '0:07',
        open: () => {}
      }];
    }
    if (key === 2) {
      return [{
        id: 'got-2',
        isVideo: false, isImage: true, isAudio: false,
        src: 'assets/nicole_party.webp',
        label: 'nicole_party.jpg',
        meta: when + ' · sent by Hanna',
        caption: '',
        bars: [],
        spec: '1024 × 1024',
        open: () => {}
      }];
    }
    if (key === 3) {
      return [{
        id: 'got-3',
        isVideo: false, isImage: true, isAudio: false,
        src: 'assets/screenshot-fake.webp',
        label: 'screenshot_2847.png',
        meta: when + ' · sent by Hanna',
        caption: '',
        bars: [],
        spec: 'image',
        open: () => this.setState({ shotOpen: 'fake' })
      }];
    }
    if (key === 'clip') {
      const src = s.cloneAudioSrc || null;
      const canPlay = !!src || !!this._splice;
      return [{
        id: 'got-clip',
        isVideo: false, isImage: false, isAudio: true,
        label: 'clip_you.m4a',
        meta: when + ' · sent by Nicole',
        caption: '',
        bars,
        spec: !canPlay
          ? (s.ttsStatus === 'failed' ? 'unavailable' : 'preparing')
          : (playing
            ? 'playing'
            : (s.cloneAudioDuration ? this.audioDurationLabel(s.cloneAudioDuration) : '0:09')),
        open: () => {
          if (this.state.playingAudioKey === audioKey) {
            this.stopAudio();
            return;
          }
          if (src) this.playFile(src, audioKey);
          else if (this._splice) this.playBuf('splice', audioKey);
        }
      }];
    }
    if (key === 4) {
      return [{
        id: 'got-4',
        isVideo: false, isImage: false, isAudio: true,
        label: 'voice_nicole.m4a',
        meta: when + ' · sent by Hanna',
        caption: '',
        bars,
        spec: playing ? 'playing' : '0:22',
        open: () => {
          if (this.state.playingAudioKey === audioKey) this.stopAudio();
          else this.playFile('assets/audios/4-first_audio.wav', audioKey);
        }
      }];
    }
    return [];
  },

  notebookVerdictFills(st, dayKey) {
    const s = st || this.state;
    const key = dayKey != null ? dayKey : s.notebookDayKey;
    const v = (s.verdict && s.verdict[key]) || null;
    const cls = (id) => 'g-notebook-verdict-opt' + (v === id ? ' is-on' : '');
    return {
      nbRealClass: cls('real'),
      nbFakeClass: cls('fake'),
      nbContextClass: cls('context')
    };
  },

  verdictLabel(id) {
    return ({
      real: 'Real',
      context: 'Real, but out of context',
      fake: 'Fake'
    })[id] || '';
  },

  // Ending recap rows (Mon–Thu media). Clip night keeps its own diary verdict but is not listed here.
  endingVerdictRows(st) {
    const s = st || this.state;
    const defs = [
      { key: 1, eyebrow: 'Monday · The video' },
      { key: 2, eyebrow: 'Tuesday · The photo' },
      { key: 3, eyebrow: 'Wednesday · The account' },
      { key: 4, eyebrow: 'Thursday · The voice' }
    ];
    const cls = (dayKey, id) => {
      const v = (s.verdict && s.verdict[dayKey]) || null;
      return 'g-end-verdict-opt' + (v === id ? ' is-on' : '');
    };
    return defs.map(d => ({
      id: 'ev-' + d.key,
      eyebrow: d.eyebrow,
      realClass: cls(d.key, 'real'),
      contextClass: cls(d.key, 'context'),
      fakeClass: cls(d.key, 'fake')
    }));
  },

  openNotebookManual() {
    this.setState({
      notebookOpen: true,
      notebookMode: 'manual',
      notebookSection: 'shelf',
      notebookDayKey: this.taskDayKey(),
      notebookMapFocus: null,
      notebookAnim: true,
      pendingAfterNotebook: false,
      hintsOpen: false
    });
    clearTimeout(this._nbAnim);
    this._nbAnim = setTimeout(() => this.setState({ notebookAnim: false }), 900);
  },

  openNotebookAfterSleep() {
    this.setState({
      notebookOpen: true,
      notebookMode: 'sleep',
      notebookSection: 'day',
      notebookDayKey: this.taskDayKey(),
      notebookAnim: true,
      pendingAfterNotebook: true,
      fading: false,
      hintsOpen: false
    });
    clearTimeout(this._nbAnim);
    this._nbAnim = setTimeout(() => this.setState({ notebookAnim: false }), 900);
  },

  sleepVerdictReady(st) {
    const s = st || this.state;
    if (s.notebookMode !== 'sleep') return true;
    const key = this.taskDayKey(s);
    return !!(s.verdict && s.verdict[key]);
  },

  closeNotebook() {
    const st = this.state;
    const pending = st.pendingAfterNotebook;
    // Sleep reflection: need a verdict for tonight before advancing.
    if (pending && !this.sleepVerdictReady(st)) return;
    // From a book (manual), return to the shelf instead of leaving the desk.
    if (!pending && st.notebookMode === 'manual' && st.notebookSection !== 'shelf') {
      this.backToNotebookShelf();
      return;
    }
    this.stopAudio();
    this.setState({
      notebookOpen: false,
      notebookAnim: false,
      pendingAfterNotebook: false,
      notebookMode: null,
      notebookSection: 'shelf',
      notebookMapFocus: null
    });
    if (pending) this.advanceAfterNotebook();
  },

  advanceAfterNotebook() {
    const d = this.state.day;
    if (d === 3 && this.state.phase === 'morning') this.showDayCard(3, 'clip');
    else if (d === 4) this.enterEnding();
    else this.showDayCard(d + 1);
  }
});
