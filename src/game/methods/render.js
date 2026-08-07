window.GameMethods = Object.assign(window.GameMethods || {}, {
  renderVals() {
    const st = this.state, d = this.day();
    // Map camelCase token → var(--c-token). Source of truth is styles/design-system.css.
    const C = new Proxy({}, {
      get(_t, key) {
        if (typeof key !== 'string') return undefined;
        const css = '--c-' + key.replace(/[A-Z]/g, (ch) => '-' + ch.toLowerCase());
        return 'var(' + css + ')';
      }
    });
    const acc = this.props.accent || this.cssColor('accent');
    const morning = st.day === 3 && st.phase === 'morning';
    const lampDim = morning ? 0 : (st.day === 4 ? 0.45 : 1);

    const dmNew = st.dm.filter(m => !m.mine && !m.sys && m.today).length;
    const msgsRaw = st.tab === 'group' ? st.chat : st.dm;
    const msgs = msgsRaw.map((m, i) => ({
      id: i, who: m.who, text: ((m.text || m.caption || '…')).split('{name}').join(this.name()),
      isNewMark: st.newMarkAt !== null && i === st.newMarkAt,
      caption: (m.caption || '').split('{name}').join(this.name()), dur: m.dur || '0:14',
      justify: m.mine ? 'flex-end' : 'flex-start',
      bg: m.sys ? 'transparent' : (m.mine ? C.accentSoft : C.panel),
      rule: m.sys ? '2px solid ' + C.muted : (m.mine ? '2px solid ' + C.accent : '0'),
      showWho: !m.mine && !m.sys,
      whoColor: this.whoColorOf(m.who),
      textColor: m.sys ? C.muted : C.ink,
      isSys: !!m.sys, rowDisplay: m.sys ? 'none' : 'flex',
      mineFemale: !!m.mine && st.playerAvatar === 'female', mineMale: !!m.mine && st.playerAvatar === 'male',
      theirs: !m.mine && !m.sys, avatar: this.faceOf(m.who),
      isVideo: m.kind === 'video', isPhoto: m.kind === 'photo', isVoice: m.kind === 'voice', isTypedShot: m.kind === 'typedshot',
      isShot: m.kind === 'shot', isProfileShot: m.shot === 'profile', isCommentShot: m.shot === 'comment',
      openShot: () => { this.setState({ shotOpen: 'fake', sawFake: true }); this.maybeCompare('fake'); },
      openPhoto: () => this.setState({ shotOpen: 'photo' }),
      lightBg: m.sys ? C.washWarm : (m.mine ? C.accentWash : C.white),
      lightWho: this.whoColorOf(m.who),
      lightText: m.sys ? C.muted : C.ink,
      radius: m.mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
      isText: !m.kind, tick: m.mine && !m.old ? (m.unsent ? '✓' : '✓✓') : '',
      play: () => { if (m.audio) this.playBuf(m.audio); }
    }));

    const tier = this.samTier();
    const phoneChecks = d.checks.filter(c => c.where === 'phone' && !st.done[c.id]);
    const acts = [];
    const A = (id, label, extra) => acts.push(Object.assign({ id, label }, extra || {}));
    if (st.tab === 'group') {
      if (st.day === 4 && st.apology) {
        A('sharesorry', 'Forward the apology to the other groups');
        A('leavesorry', 'Say the apology is fake too');
      }
      if (st.day === 3 && st.phase === 'clip') {
        // the group is silent tonight
      } else if (st.day === 3) {
        A('openfake', 'Open the account · 2 min');
        A('openreal', 'Open her real account · 2 min');
        A('reportmenu', 'Report an account');
        A('askwhich', 'Post: “has anyone checked which is which?”');
        A('postfake', 'Post: “the new one is fake, her real one is still up”');
        A('forward', 'Forward the screenshot');
        A('react', 'React 💀');
      } else {
        A('forward', 'Forward it');
        A('react', 'React 💀');
        A('askchecked', 'Post: “has anyone actually checked this?”');
        A('callfake', 'Post: “that\'s fake”');
        A('defend', 'Post: “this isn\'t okay. leave her alone.”');
      }
      phoneChecks.filter(c => c.thread !== 'dm').forEach(c => A(c.id, c.label + ' · ' + c.cost + ' min', { check: c }));
    } else {
      (this.DM_OPTIONS[st.day] || []).forEach(o => {
        if (st.day === 3 && !!o.clip !== (st.phase === 'clip')) return;
        if (o.clip && !st.clipBack) return;
        if (o.needs && st.certainty[o.needs] !== 'confirmed') return;
        A(o.id, o.label, { dmOpt: o });
      });
      phoneChecks.filter(c => c.thread === 'dm').forEach(c => A(c.id, c.label + ' · ' + c.cost + ' min', { check: c }));
    }
    const phoneActions = acts.map(a => ({
      label: a.label, used: !!st.used[a.id], op: st.used[a.id] ? 0.45 : 1,
      bg: st.used[a.id] ? '#E8E8E8' : 'rgba(27,79,224,.05)',
       run: () => { if (!st.used[a.id]) { this.setState({ actionsOpen: false }); this.doAction(a); } }
    }));

    const mk = c => ({
      item: c.item || st.day,
      label: c.label, costLabel: c.cost + ' min', done: !!st.done[c.id], result: c.result,
      op: st.done[c.id] ? 0.5 : 1, run: () => this.runCheck(c)
    });
    const compChecks = d.checks.filter(c => c.where === 'computer');
    const revCheck = compChecks.find(c => c.id.indexOf('rev') > -1);
    const aiCheck = compChecks.find(c => c.id === 'd4ai');
    const checks = compChecks.map(mk);
    const playerChecks = compChecks.filter(c => c !== revCheck && c !== aiCheck).map(mk);
    const aiChecks = aiCheck ? [mk(aiCheck)] : [];
    const itemName = { 1: 'IMG_4471.mp4', 2: 'nicole_party.jpg', 3: 'clip_you.m4a', 4: 'voice_nicole.m4a' }[st.day];
    const all = this.allDays();
    const rows = [
      { day: 1, item: 1, kind: 'video', who: 'Hanna', spec: '0:15', caption: 'Nicole, filmed at a party: “…she' + "'" + 's honestly the most pathetic person in our year.”' },
      { day: 2, item: 2, kind: 'image', who: 'Hanna', spec: '1024 × 1024' },
      { day: 3, item: 3, kind: 'shot', name: 'screenshot_2847.png', who: 'Hanna', spec: 'image' },
      { day: 3, item: 5, gate: st.clipBack, kind: 'audio', name: 'clip_you.m4a', who: 'Nicole', when: 'Wednesday, 10:15pm', spec: '0:09' },
      { day: 4, kind: 'audio', name: 'voice_nicole_old_1.m4a', who: 'Nicole', when: 'Two weeks ago', spec: '0:22' },
      { day: 4, kind: 'audio', name: 'voice_nicole_old_2.m4a', who: 'Nicole', when: 'Last week', spec: '0:08' },
      { day: 4, kind: 'audio', name: 'voice_nicole.m4a', who: 'Hanna', spec: '0:22' },
      { day: 4, kind: 'audio', name: 'voice_nicole_2.m4a', who: 'Hanna', spec: '0:31' }
    ].concat(st.saved.map(s => ({
      day: s.day, item: 3, kind: 'image', savedKind: s.kind, name: s.name,
      who: s.from, when: (all[s.day] || {}).dayName || '', savedFrom: true, spec: 'image'
    }))).filter(r => r.day <= st.day && r.gate !== false).map((r, i) => {
      const src = all[r.day] || {};
      const when = r.when || ((src.dayName || '') + ', ' + this.fmt(src.start || 0));
      return {
        idx: i, day: r.day, item: r.item || r.day, kind: r.kind,
        name: r.name || src.deskTitle || '',
        meta: r.savedFrom ? (when + ' · saved from ' + r.who) : (when + ' · sent by ' + r.who),
        spec: r.spec, caption: r.caption || '', savedKind: r.savedKind || '',
        isGardenThumb: r.savedKind === 'garden', isCraftThumb: r.savedKind === 'craft',
        kindLabel: r.kind === 'image' ? 'image' : r.kind === 'shot' ? 'image' : r.kind,
        hasThumb: r.kind === 'image' && !r.savedKind, isVideoThumb: r.kind === 'video', isShotThumb: r.kind === 'shot',
        isAudio: r.kind === 'audio',
        isShotFake: r.kind === 'shot' && (r.name || '').indexOf('real') === -1,
        isShotReal: r.kind === 'shot' && (r.name || '').indexOf('real') > -1,
        unseen: !st.seen[i],
        noThumb: r.kind !== 'image' && r.kind !== 'video' && r.kind !== 'shot',
        open: () => { const seen = Object.assign({}, this.state.seen); seen[i] = true; this.setState({ mediaOpen: i, seen, zoom: false }); },
        draggable: r.kind === 'image' || r.kind === 'video',
        drag: () => this.setState({ dragItem: i })
      };
    });
    const mediaRows = rows.slice().reverse();
    const openRow = (st.mediaOpen !== null && rows[st.mediaOpen]) || { day: -1, item: -1, kind: '', name: '', meta: '', spec: '', savedKind: '' };
    const openItemChecks = playerChecks.filter(c => c.item === openRow.item);
    const revDone = revCheck ? !!st.done[revCheck.id] : true;
    const HITS = {
      1: [],
      2: [
        { source: 'social · @nicole_kruger', date: 'Posted 14 July, last year', quote: 'laura' + "'" + 's birthday 🎂', kind: 'image', goto: 'old10' }
      ],
      3: [],
      4: [],
      5: []
    };
    const AI = {
      'IMG_4471.mp4': { score: 96, len: '0:15 of video', rows: [
        { label: 'Generation artefacts', value: 'none detected', pct: '4%' },
        { label: 'Frame consistency', value: 'consistent', pct: '96%' },
        { label: 'Compression signature', value: 'consistent', pct: '93%' },
        { label: 'Audio-visual sync', value: 'natural', pct: '95%' }
      ] },
      'nicole_party.jpg': { score: 99, len: '1 image', rows: [
        { label: 'Generation artefacts', value: 'none detected', pct: '1%' },
        { label: 'Pixel-level consistency', value: 'consistent', pct: '99%' },
        { label: 'Compression signature', value: 'consistent', pct: '97%' },
        { label: 'Metadata', value: 'intact', pct: '99%' }
      ] },
      'nicole_garden.jpg': { score: 8, len: '1 image', hint: true, rows: [
        { label: 'Generation artefacts', value: 'detected', pct: '88%' },
        { label: 'Pixel-level consistency', value: 'irregular', pct: '24%' },
        { label: 'Compression signature', value: 'inconsistent', pct: '19%' },
        { label: 'Metadata', value: 'missing', pct: '6%' }
      ] },
      'nicole_craft.jpg': { score: 91, len: '1 image', rows: [
        { label: 'Generation artefacts', value: 'none detected', pct: '7%' },
        { label: 'Pixel-level consistency', value: 'consistent', pct: '93%' },
        { label: 'Compression signature', value: 'consistent', pct: '91%' },
        { label: 'Metadata', value: 'intact', pct: '95%' }
      ] },
      'nicole_party_repost.jpg': { score: 99, len: '1 image' },
      'screenshot_2847.png': { score: 91, len: '820 × 1180 image' },
      'clip_you.m4a': { score: 95, len: '0:14 of audio' },
      'voice_nicole.m4a': { score: 97, len: '0:22 of audio' },
      'voice_nicole_2.m4a': { score: 96, len: '0:31 of audio' },
      'voice_nicole_old_1.m4a': { score: 98, len: '0:22 of audio' },
      'voice_nicole_old_2.m4a': { score: 98, len: '0:08 of audio' }
    };
    const aiRow = st.aiPickIdx !== null ? rows[st.aiPickIdx] : null;
    const aiData = aiRow ? (AI[aiRow.name] || { score: 96, len: 'file' }) : null;
    const verdictOf = (n) => n >= 85 ? 'Authentic' : n >= 40 ? 'Inconclusive' : 'Likely generated';
    const NAME = this.name();
    const A_ = [
      { handle: '@n.krueger', name: 'Nicole K.', img: 'assets/av-nicole.webp', fake: true },
      { handle: '@nicole_kruger', name: 'Nicole Kruger', img: 'assets/av-nicole.webp', real: true },
      { handle: '@nele.b', name: 'Nele B', img: 'assets/av-nele.webp' },
      { handle: '@mia.h', name: 'Mia H', img: 'assets/av-mia.webp' },
      { handle: '@lea.m', name: 'Lea M', img: 'assets/av-lea.webp' },
      { handle: '@hanna.k', name: 'Hanna K', img: 'assets/av-hanna.webp' },
      { handle: '@benito_', name: 'Benito', img: 'assets/av-benito.webp' }
    ];
    const av = h => window.__R((A_.find(x => x.handle === h) || {}).img || 'assets/av-mia.webp');
    const nm = h => (A_.find(x => x.handle === h) || {}).name || h;
    const P = (id, handle, ago, text, extra) => Object.assign({
      id, handle, ago, text, name: nm(handle), avatar: av(handle), likes: 0, replies: 0
    }, extra || {});
    const R = (h, t) => ({ handle: h, text: t, avatar: av(h) });
    let feedPosts = [
      P('d1a', '@nele.b', '35m', 'why is monday like this', { likes: 4, replies: 1, thread: [
        R('@hanna.k', 'four more days of it')
      ] }),
      P('d1b', '@mia.h', '2h', 'practice run for friday', { likes: 31, replies: 6, thread: [
        R('@hanna.k', 'that is a LOT of icing'), R('@nele.b', 'save me a corner piece'), R('@lea.m', 'i would die for this cake')
      ] }),
      P('d1c', '@nicole_kruger', '5h', 'if anyone finds my blue water bottle it is my whole personality', { likes: 18, replies: 3, thread: [
        R('@mia.h', 'it' + "'" + 's in the sports hall, i' + "'" + 've seen it twice'),
        R('@nele.b', 'it lives there now'),
        R('@hanna.k', 'get a new one at this point')
      ] }),
      P('d1d', '@hanna.k', '7h', 'the chemistry homework is fake news', { likes: 9, replies: 2, thread: [
        R('@nele.b', 'i wrote something and moved on'), R('@lea.m', 'question 4 is not real')
      ] }),
      P('d1e', '@lea.m', '9h', '3 songs on repeat for four days straight, send help', { likes: 6, replies: 1, thread: [
        R('@mia.h', 'which three')
      ] }),
      P('d1f', '@benito_', '1d', 'new headphones 🎧', { likes: 5, replies: 0 }),
      P('d1g', '@nicole_kruger', '1d', 'does anyone actually understand question 4 or are we all faking', { likes: 22, replies: 7, thread: [
        R('@hanna.k', 'faking. obviously faking'), R('@nele.b', 'i wrote something and moved on')
      ] }),
      P('d1h', '@mia.h', '1d', 'cedar street, friday, be there', { likes: 27, replies: 4, thread: [
        R('@nele.b', 'wouldn' + "'" + 't miss it'), R('@lea.m', 'what do you want as a present')
      ] }),
      P('old1', '@nicole_kruger', '3d', 'first swim of the year, water was a mistake', { profileOnly: true, likes: 21, replies: 3 }),
      P('old2', '@nicole_kruger', '7d', 'my brother has decided he plays the drums now', { profileOnly: true, likes: 15, replies: 4 }),
      P('old3', '@nicole_kruger', '9d', 'revision plan day one: made a revision plan', { profileOnly: true, likes: 30, replies: 6 }),
      P('old4', '@nicole_kruger', '14d', 'someone in this house keeps moving my charger', { profileOnly: true, likes: 12, replies: 2 }),
      P('old5', '@nicole_kruger', '21d', 'four hours of volleyball and i can' + "'" + 't lift my arms', { profileOnly: true, likes: 24, replies: 5 }),
      P('old6', '@nicole_kruger', '32d', 'new notebook. this time i' + "'" + 'll keep it tidy', { profileOnly: true, likes: 18, replies: 3 }),
      P('old7', '@nicole_kruger', '60d', 'it' + "'" + 's been raining since tuesday and i' + "'" + 'm losing it', { profileOnly: true, likes: 9, replies: 1 }),
      P('old8', '@nicole_kruger', '120d', 'finally finished the book. took me since january', { profileOnly: true, likes: 16, replies: 2 }),
      P('old9', '@nicole_kruger', '210d', 'cannot believe how early it gets dark now', { profileOnly: true, likes: 11, replies: 2 }),
      P('old10', '@nicole_kruger', '364d', 'laura' + "'" + 's birthday 🎂', { profileOnly: true, likes: 34, replies: 8, photo: true, dated: '14 July, last year', thread: [
        R('@benito_', 'that cake was structural')
      ] }),
      P('old11', '@nicole_kruger', '368d', 'sports hall smells like feet as usual', { profileOnly: true, likes: 8, replies: 1 }),
      P('old12', '@nicole_kruger', '380d', 'day one of the summer holidays, already bored', { profileOnly: true, likes: 19, replies: 3 }),
      P('old13', '@nicole_kruger', '390d', 'end of term. finally.', { profileOnly: true, likes: 17, replies: 2 }),
      P('old14', '@nicole_kruger', '400d', 'revision playlist is just three songs', { profileOnly: true, likes: 12, replies: 1 })
    ];
    feedPosts.forEach(p => { p.day = 1; });
    if (st.day >= 2) {
      feedPosts = [
        P('d2a', '@hanna.k', '1h', 'some people really show their true colours', { likes: 41, replies: 12, thread: [
          R('@nele.b', 'right?'), R('@lea.m', 'who are we talking about')
        ] }),
        P('d2b', '@nele.b', '2h', 'funny how everyone' + "'" + 's suddenly so shocked', { likes: 8, replies: 3, thread: [
          R('@hanna.k', 'what does that mean'), R('@lea.m', 'nele??')
        ] }),
        P('d2c', '@lea.m', '4h', 'can everyone calm down for one second', { likes: 3, replies: 0 }),
        P('d2d', '@mia.h', '6h', 'not doing this today', { likes: 14, replies: 2, thread: [
          R('@hanna.k', 'same honestly')
        ] })
      ].map(p => { p.day = 2; return p; }).concat(feedPosts);
    }
    if (st.day >= 3) {
      feedPosts = [
        P('f1', '@n.krueger', '12m', NAME + ' doesn' + "'" + 't even like Spiderman lol', { likes: 47, replies: 14, thread: [
          R('@nele.b', '😭😭'), R('@hanna.k', 'she' + "'" + 's not wrong'), R('@lea.m', '?? this doesn' + "'" + 't sound like her')
        ] }),
        P('f5', '@n.krueger', '4h', 'Spending the afternoon in the garden really underscores the importance of slowing down 🌿 At its core, it' + "'" + 's about finding small moments of calm in a busy week.', { garden: true, likes: 61, replies: 8 }),
        P('f6', '@n.krueger', '6h', 'Delving into a little creative project this evening ✨ There' + "'" + 's something pivotal about making things with your own hands. A key takeaway: patience really is everything 💛', { craft: true, likes: 55, replies: 12 }),
        P('d3a', '@hanna.k', '30m', 'so she made a second account. cool cool', { likes: 29, replies: 8, thread: [
          R('@mia.h', 'those are her old photos'), R('@nele.b', 'the account is 2 days old. just saying.')
        ] }),
        P('f2', '@n.krueger', '1h', 'mia' + "'" + 's cake is always dry, someone had to say it', { likes: 52, replies: 9, thread: [
          R('@mia.h', 'wow ok'), R('@hanna.k', 'nicole what')
        ] }),
        P('f3', '@n.krueger', '2h', 'hanna talks about people the second they leave the room', { likes: 44, replies: 11, thread: [
          R('@hanna.k', 'excuse me??'), R('@nele.b', 'lol')
        ] }),
        P('d3b', '@nele.b', '3h', 'so fake..', { likes: 4, replies: 2, thread: [
          R('@hanna.k', 'what is'), R('@lea.m', 'say more?')
        ] }),
        P('d3c', '@lea.m', '5h', 'has anyone actually asked her', { likes: 2, replies: 1, thread: [
          R('@hanna.k', 'asked her what')
        ] }),
        P('d3d', '@mia.h', '7h', 'friday is still happening. please be normal.', { likes: 19, replies: 3, thread: [
          R('@nele.b', 'no promises'), R('@hanna.k', 'i' + "'" + 'll behave')
        ] })
      ].map(p => { p.day = 3; return p; }).concat(feedPosts);
    }
    if (st.day >= 4) {
      feedPosts = [
        P('d4a', '@n.krueger', '40m', 'some of you need to hear this', { likes: 38, replies: 16, thread: [
          R('@hanna.k', 'mask fully off'), R('@mia.h', 'what is going on')
        ] }),
        P('d4b', '@hanna.k', '2h', 'i don' + "'" + 't know what to believe anymore', { likes: 21, replies: 6, thread: [
          R('@mia.h', 'nobody does'), R('@nele.b', 'that' + "'" + 's usually the idea')
        ] }),
        P('d4c', '@nele.b', '3h', 'i' + "'" + 've seen this exact thing happen before', { likes: 7, replies: 3, thread: [
          R('@lea.m', 'where'), R('@hanna.k', 'to who??')
        ] }),
        P('d4d', '@nele.b', '3h', 'and it always ends the same way', { likes: 5, replies: 1, thread: [
          R('@lea.m', 'nele what do you know')
        ] }),
        P('d4e', '@lea.m', '5h', 'has ANYONE checked any of this', { likes: 2, replies: 0 }),
        P('d4f', '@benito_', '6h', '🎧', { likes: 3, replies: 0 })
      ].map(p => { p.day = 4; return p; }).concat(feedPosts);
    }
    const mins = (a) => { const n = parseFloat(a); return a.indexOf('m') > -1 ? n : a.indexOf('h') > -1 ? n * 60 : n * 1440; };
    feedPosts = feedPosts.map(p => {
      const age = (st.day - (p.day || 1)) * 1440 + mins(p.ago);
      const days = Math.floor(age / 1440);
      return Object.assign({}, p, {
        age,
        ago: days === 0 ? p.ago : days === 1 ? 'yesterday'
          : days <= 6 ? days + ' days ago'
          : p.dated ? p.dated : days >= 300 ? 'last year' : Math.round(days / 7) + ' weeks ago'
      });
    }).sort((a, b) => a.age - b.age);
    if (st.reported) feedPosts = feedPosts.filter(p => p.handle !== '@nicole_kruger');
    if (st.tool === 'social' && this._feedLog !== st.day + '/' + st.reported) {
      this._feedLog = st.day + '/' + st.reported;
      console.log('[feed] day', st.day, '· posts', feedPosts.length,
        '· fake', feedPosts.filter(p => p.handle === '@n.krueger').length,
        '· real', feedPosts.filter(p => p.handle === '@nicole_kruger').length,
        '· fake gate day>=3:', st.day >= 3, '· real removed:', st.reported);
    }
    const PROFILES = {
      '@nicole_kruger': { handle: '@nicole_kruger', name: 'Nicole Kruger', img: 'assets/av-nicole.webp',
        bio: 'not everything is about you 🖤', posts: '52', followers: '349', following: '42',
        joined: 'Joined September 2022', dead: st.reported },
      '@n.krueger': { handle: '@n.krueger', name: 'Nicole K.', img: 'assets/av-nicole.webp',
        bio: 'not everything is about you 🖤', posts: '6', followers: '42', following: '12',
        joined: 'Joined this week' },
      '@nele.b': { handle: '@nele.b', name: 'Nele B', img: 'assets/av-nele.webp', bio: 'here for the food', posts: '208', followers: '190', following: '204', joined: 'Joined March 2022' },
      '@mia.h': { handle: '@mia.h', name: 'Mia H', img: 'assets/av-mia.webp', bio: 'cedar street', posts: '340', followers: '277', following: '250', joined: 'Joined June 2021' },
      '@hanna.k': { handle: '@hanna.k', name: 'Hanna K', img: 'assets/av-hanna.webp', bio: 'you had to be there', posts: '511', followers: '302', following: '333', joined: 'Joined January 2022' },
      '@lea.m': { handle: '@lea.m', name: 'Lea M', img: 'assets/av-lea.webp', bio: '', posts: '96', followers: '141', following: '160', joined: 'Joined April 2022' },
      '@benito_': { handle: '@benito_', name: 'Benito', img: 'assets/av-benito.webp', bio: '', posts: '64', followers: '150', following: '88', joined: 'Joined November 2021' }
    };
    const socTab = st.socTab || 'feed';
    const prof = st.socProfileKey ? PROFILES[st.socProfileKey] : null;
    const openPost = st.socPostId ? feedPosts.find(p => p.id === st.socPostId) : null;
    const NAME_HITS = {
      'nicole_garden.jpg': [{ source: 'social · @n.krueger', date: 'Posted today', kind: 'garden', goto: 'f5' }],
      'nicole_craft.jpg': [{ source: 'social · @n.krueger', date: 'Posted today', kind: 'craft', goto: 'f6' }],
      'nicole_party_repost.jpg': [{ source: 'social · @nicole_kruger', date: 'Posted 14 July, last year', quote: 'laura' + "'" + 's birthday 🎂', kind: 'image', goto: 'old10' }]
    };
    const pickRow = st.pickIdx !== null ? rows[st.pickIdx] : null;
    const pickHits = pickRow ? (NAME_HITS[pickRow.name] || HITS[pickRow.day] || []) : [];


    const s = st.stats;
    const dayClutter = st.day;
    const savedGame = st.screen === 'title' ? this.readSavedGame() : null;
    const endCard = this.finalCard(st, s);
    const endSig = this.endingSignals(st, s);
    const checkBarPct = Math.min(100, Math.round(100 * endSig.checks / 4));
    const careBarPct = endSig.publiclySupported ? 100
      : endSig.dmCount >= 3 ? 66
      : endSig.dmCount >= 1 ? 33
      : 0;

    const cineScene = this.CINE_SCENES[st.cineIdx] || this.CINE_SCENES[0] || {};

    return {
      isCinematic: st.screen === 'cinematic',
      cineGate: st.cinePhase !== 'playing',
      cinePlaying: st.cinePhase === 'playing',
      cineImgSrc: cineScene.img,
      cineImgHeight: cineScene.height,
      cineObjX: cineScene.objX,
      cineObjY: cineScene.objY,
      // cineActive is a tiny state machine: false (just cut, snapped to the
      // scene's start frame) -> true (panning, in focus) -> 'exit' (still
      // holding the panned position, but fading/blurring out ahead of the
      // next cut). Only `true` is fully in-focus; both other stages render
      // hidden/blurred so the cut itself is never seen.
      cinePanX: st.cineActive ? cineScene.panXEnd : cineScene.panXStart,
      cineScale: st.cineActive ? cineScene.scaleEnd : cineScene.scaleStart,
      cineTransDur: st.cineActive ? ((cineScene.dur || 9000) / 1000 - 0.4) + 's' : '0s',
      cineImgOp: st.cineActive === true ? 1 : 0,
      cineImgBlur: st.cineActive === true ? '0px' : '14px',
      cineCaption: cineScene.caption || '',
      cineCaptionOp: st.cineActive ? 1 : 0,
      cineFlashOp: st.cineFlash ? 1 : 0,
      cineMuteLabel: st.cineMuted ? '🔇' : '🔈',
      beginCinematic: () => this.beginCinematic(),
      skipCinematic: () => this.skipCinematic(),
      toggleCineMute: () => this.toggleCineMute(),
      isTitle: st.screen === 'title', isRoom: st.screen === 'room' || st.screen === 'phone', isPhone: st.screen === 'phone',
      onHome: st.dev === null, onApp: st.dev !== null,
      screenBg: st.dev === null
        ? 'center / cover no-repeat url("assets/class_10b.webp"), var(--c-accent)'
        : C.white,
      statusColor: C.ink,
      homeBarColor: C.inkMuted,
      goHome: () => this.setState({ dev: null, threadOpen: null }),
      apps: [
        { key: 'chats', label: 'Message', icon: 'assets/icons/app-chats.svg', badge: st.unread > 0 ? st.unread : 0 },
        { key: 'gallery', label: 'Photo Gallery', icon: 'assets/icons/app-gallery.svg', badge: 0 },
        { key: 'fact', label: 'Fact Checker', icon: 'assets/icons/app-fact.svg', badge: 0 },
        { key: 'social', label: 'Social Media', icon: 'assets/icons/app-social.svg', badge: 0 }
      ].map(a => ({
        label: a.label, badge: a.badge, icon: a.icon,
        go: () => this.setState({
          dev: a.key, threadOpen: null,
          tool: a.key === 'gallery' ? 'player' : a.key === 'social' ? 'social' : a.key === 'fact' ? (this.state.tool === 'ai' ? 'ai' : 'search') : this.state.tool,
          mediaOpen: null, socTab: 'feed', socProfileKey: null, socPostId: null,
          galleryNew: a.key === 'gallery' ? false : this.state.galleryNew
        })
      })),
      onChats: st.dev === 'chats', onDeviceTool: st.dev !== 'chats' && st.dev !== null,
      onChatList: st.dev === 'chats' && st.threadOpen === null,
      onThread: st.dev === 'chats' && st.threadOpen !== null,
      showShared: st.threadOpen === 'group',
      backToChats: () => {
        const k = st.threadOpen;
        const lastRead = Object.assign({}, st.lastRead);
        if (k) lastRead[k] = (k === 'group' ? st.chat : st.dm).length;
        this.setState({ threadOpen: null, actionsOpen: false, lastRead, newMarkAt: null, showNewPill: false });
      },
      showNewPill: st.showNewPill,
      onMsgScroll: () => {
        const el = this.msgRef.current;
        if (!el) return;
        const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        this._atBottom = bottom;
        if (bottom && this.state.showNewPill) this.setState({ showNewPill: false });
      },
      jumpToBottom: () => {
        const el = this.msgRef.current;
        if (el) el.scrollTop = el.scrollHeight;
        this._atBottom = true;
        this.setState({ showNewPill: false });
      },
      threads: [
        { key: 'group', name: '10b 🍕', avatar: 'assets/class_10b.webp', sub: d.threadSub,
          preview: this.preview(st.chat), unread: st.groupUnread, hasUnread: st.groupUnread > 0 },
        { key: 'dm', name: 'Nicole', avatar: 'assets/av-nicole.webp', sub: tier === 'gone' ? 'last seen Wednesday' : 'online',
          preview: this.preview(st.dm), unread: dmNew, hasUnread: dmNew > 0 }
      ].map(t => Object.assign(t, {
        open: () => {
          const list = t.key === 'group' ? this.state.chat : this.state.dm;
          const read = (this.state.lastRead || {})[t.key];
          this._pendingScroll = true;
          this._atBottom = true;
          this._lastLen = list.length;
          this.setState({
            threadOpen: t.key, tab: t.key, actionsOpen: false, showNewPill: false,
            newMarkAt: typeof read === 'number' && read >= 0 && read < list.length ? read : null,
            openedGroup: t.key === 'group' ? true : this.state.openedGroup,
            groupUnread: t.key === 'group' ? 0 : this.state.groupUnread,
            unread: t.key === 'group' ? 0 : this.state.unread
          });
        }
      })),
      navTabs: [
        { key: 'chats', tile: C.accent, label: 'Message', badge: st.unread > 0 ? st.unread : 0, dot: false, flash: st.chatFlash },
        { key: 'gallery', tile: C.accent, label: 'Gallery', badge: 0, dot: st.galleryNew },
        { key: 'fact', tile: C.accent, label: 'Fact Check', badge: 0, dot: false },
        { key: 'social', tile: C.accent, label: 'Social', badge: 0, dot: false }
      ].map(n => ({
        label: n.label, badge: n.badge, dot: n.dot,
        swatch: st.dev === n.key ? n.tile : C.inkGhost,
        color: n.flash ? C.danger : (st.dev === n.key ? C.ink : C.inkFaint),
        go: () => this.setState({
          dev: n.key,
          tool: n.key === 'gallery' ? 'player' : n.key === 'social' ? 'social' : n.key === 'fact' ? (this.state.tool === 'ai' ? 'ai' : 'search') : this.state.tool,
          mediaOpen: null, galleryNew: n.key === 'gallery' ? false : this.state.galleryNew
        })
      })),
      isFinal: st.screen === 'final',
      clockLabel: (this.props.showClock ?? true) ? this.fmt(st.min) : '',
      dayName: d.dayName.toUpperCase(), nightOpacity: 0, morningWash: 0,
      roomBg: this.roomBgFor(st.day, st.phase),
      isMorningRoom: st.day === 3 && st.phase === 'morning',
      isEveningRoom: !(st.day === 3 && st.phase === 'morning'),
      dayStrip: ['Mon', 'Tue', 'Wed', 'Thu'].map((label, i) => ({
        label,
        op: i + 1 === st.day ? 1 : i + 1 < st.day ? 0.4 : 0.15,
        rule: i + 1 === st.day ? '2px solid ' + C.accent : '2px solid transparent'
      })),
      anyReason: st.reason || '', anyReasonOp: (st.flashSam || st.flashGroup) && st.reason ? 1 : 0,
      lampGlow: 0.55 * lampDim, lampDesk: 0.4 * lampDim, lampFloor: 0.3 * lampDim, lampWall: 0.26 * lampDim,
      hasGlass: dayClutter >= 2, hasCable: dayClutter >= 3, hasMess: dayClutter >= 4,
      unread: st.unread, hasUnread: st.unread > 0, dmUnread: st.tab !== 'dm' && st.dm.length > 0,
      dmUnreadCount: dmNew,
      buzzAnim: st.unread > 0 ? 'buzz .55s ease-in-out infinite' : 'none',
      msgToastShown: !!st.msgToast,
      msgToastOpacity: st.msgToastVisible ? 1 : 0,
      msgToastY: st.msgToastVisible ? '0px' : '-14px',
      msgToastWho: st.msgToast ? st.msgToast.who : '',
      msgToastText: st.msgToast ? st.msgToast.text : '',
      msgToastAvatar: st.msgToast ? (st.msgToast.avatar || this.faceOf(st.msgToast.kind === 'dm' ? 'Nicole' : 'Hanna')) : '',
      msgToastLeft: (st.day === 3 && st.phase === 'morning') ? 'var(--hot-toast-am-l)' : 'var(--hot-toast-l)',
      msgToastTop: (st.day === 3 && st.phase === 'morning') ? 'var(--hot-toast-am-t)' : 'var(--hot-toast-t)',
      msgToastTipLeft: (st.day === 3 && st.phase === 'morning') ? 'auto' : '38px',
      msgToastTipRight: (st.day === 3 && st.phase === 'morning') ? '38px' : 'auto',
      sceneScale: st.cameraPush ? 1.045 : 1,
      pushVignetteOp: st.cameraPush ? 0.32 : 0,
      dayPanY: st.dayEnter ? '-52px' : '0px',
      dayPanScale: st.dayEnter ? 1.05 : 1,
      dayPanOp: st.dayEnter ? 0.55 : 1,
      photoUp: st.photoUp, photoBg: st.photoUp ? C.ink : C.panel,
      confirmSleepOpen: st.confirmSleep,
      sleepTitle: st.day === 4
        ? 'That' + "'" + 's the week. Go to sleep?'
        : (st.day === 3 && st.phase === 'morning')
          ? 'Go to school?'
          : 'Go to sleep?',
      sleepConfirmLabel: (st.day === 3 && st.phase === 'morning') ? 'Go' : 'Sleep',
      threadTitle: st.tab === 'group' ? '10b 🍕' : 'Nicole',
      threadSub: st.tab === 'group' ? d.threadSub : (tier === 'gone' ? 'last seen Wednesday' : tier === 'low' ? 'typing…' : 'online'),
      sharedLine: 'Shared in ' + st.sharedCount + ' chats.',
      memberLine: st.tab === 'group'
        ? (st.day >= 3 ? this.name() + ', Hanna, Mia, Lea, Benito…'
                       : this.name() + ', Nicole, Hanna, Mia, Lea, Benito…') : '',
      tabGroupBg: st.tab === 'group' ? C.warmSoft : 'transparent',
      tabDmBg: st.tab === 'dm' ? C.warmSoft : 'transparent',
      samBar: (st.samDead ? 100 : Math.max(0, st.sam)) + '%', groupBar: st.group + '%', samGone: false,
      shotOpen: st.shotOpen, shotIsFake: st.shotOpen === 'fake', shotIsReal: st.shotOpen === 'real', shotIsPhoto: st.shotOpen === 'photo',
      photoShotCaption: 'Sent by Hanna, ' + this.fmt(this.allDays()[2].start) + '. ' + this.allDays()[2].deskTitle,
      closeShot: () => this.setState({ shotOpen: null }),
      reportOpen: st.reportOpen,
      reportCancel: () => this.setState({ reportOpen: false }),
      reportNew: () => this.doReport('new'), reportOld: () => this.doReport('old'), reportBoth: () => this.doReport('both'),
       dmGhostTyping: st.tab === 'dm' && st.dmGhostTyping,
       chatTyping: st.chatBusy || (st.tab === 'dm' && st.dmGhostTyping),
      dmSilenceLine: st.tab === 'dm' && tier === 'gone'
        ? (st.day <= 4 ? 'She hasn' + "'" + 't opened this since Wednesday.' : 'Still nothing.') : '',
      samColor: st.samDead ? C.inkMuted : this.barStatusColor(st.sam), groupColor: this.barStatusColor(st.group),
      samOpacity: st.flashSam ? 1 : (st.samDead ? 0.55 : 0.9),
      tipSamOpen: st.tip === 'sam', tipGroupOpen: st.tip === 'group',
      tipOpen: st.tip !== null,
      tipTitle: st.tip === 'sam' ? 'Friendship with Nicole' : 'Popularity in 10b',
      tipLine1: st.tip === 'sam' ? 'How much Nicole trusts you.' : 'What the class thinks of you.',
      tipLine2: st.tip === 'sam'
        ? 'Falls if you ignore her or forward things about her — and if it empties, she stops replying for good.'
        : 'Rises if you go along with them, falls if you contradict them without proof.',
      roomScroller: (el) => {
        if (!el) return;
        this._room = el;
        if (this._roomX === undefined) this._roomX = Math.max(0, 240 - el.clientWidth / 2 + 120);
        el.scrollLeft = this._roomX;
        el.onscroll = () => { this._roomX = el.scrollLeft; };
      },
      tipSam: () => this.setState({ tip: 'sam' }), tipGroup: () => this.setState({ tip: 'group' }),
      tipOff: () => this.setState({ tip: null }),
      tipSamTap: () => this.setState(s => ({ tip: s.tip === 'sam' ? null : 'sam' })),
      tipGroupTap: () => this.setState(s => ({ tip: s.tip === 'group' ? null : 'group' })),
      samStateLine: st.samDead ? 'Right now: she has stopped replying.'
        : st.sam >= 60 ? 'Right now: she answers you straight away.'
        : st.sam >= 35 ? 'Right now: she still answers, but not straight away.'
        : 'Right now: she' + "'" + 's reading your messages and not replying.',
      groupStateLine: st.group >= 70 ? 'Right now: they think you' + "'" + 're one of them.'
        : st.group >= 35 ? 'Right now: nobody has a problem with you.'
        : 'Right now: two people have started replying to you differently.',
      samDeadElsewhere: st.samDead && st.screen !== 'room' && st.screen !== 'title',
      groupOpacity: st.flashGroup ? 1 : 0.9,
      msgRef: this.msgRef, msgs, phoneActions, checks, noChecks: checks.length === 0,
      deskLabel: d.deskLabel, deskTitle: d.deskTitle, browserUrl: d.url, deskHasPhoto: st.day === 2,
      onSearch: st.dev === 'fact' && st.tool === 'search', onAi: st.dev === 'fact' && st.tool === 'ai',
      onFactTab: st.dev === 'fact',
      segSearchBg: st.tool === 'search' ? C.white : 'transparent',
      segAiBg: st.tool === 'ai' ? C.white : 'transparent',
      segSelfBg: st.tool === 'self' ? C.white : 'transparent',
      segSelfWeight: st.tool === 'self' ? 600 : 400,
      onSelf: st.dev === 'fact' && st.tool === 'self',
      toolSelf: () => this.setState({ tool: 'self' }),
      selfGroups: [
        { title: 'Photos', items: [
          'Start with the hands. Fingers are the thing image generators get wrong most often, so count them, then look at where the hand meets the wrist.',
          'Read anything written in the picture. Signs, labels and logos come out as letters that look right until you actually try to read them.',
          'Look past the main subject. Whoever is standing in the background got the least attention, and their faces are usually the first thing to fall apart.',
          'Follow the shadows. If two things in the same room throw them in different directions, the room was never real.'
        ] },
        { title: 'Video', items: [
          'Watch the outline of the face, where skin meets hair. In generated video that edge never quite sits still.',
          'Wait for something to pass in front — a hand, a glass, someone walking past. That' + "'" + 's the moment it usually breaks.',
          'Watch the mouth with the sound off, then on. Generated lips make roughly the right movements without making the right shapes.',
          'Notice the blinking. It comes too rarely, too regularly, or not at all.'
        ] },
        { title: 'Voice', items: [
          'Listen for the room. A real recording has an echo, some distance, a chair creaking somewhere. Cloned audio is usually clean in a way nothing recorded on a phone ever is.',
          'Listen for breathing. People take a breath in the middle of a sentence without thinking about it, and clones tend not to.',
          'Listen to the rhythm. Every word carries the same weight, and the sentences all end the same way.'
        ] },
        { title: 'Writing', items: [
          'Generated text is fluent but oddly formal. Watch for words like delve, underscore, pivotal, realm and harness, and for openers like “at its core” or “a key takeaway is”.',
          'It also never quite sounds like the person. Someone who writes in lowercase without punctuation doesn' + "'" + 't suddenly produce balanced sentences with a neat conclusion.'
        ] },
        { title: 'And still', items: [
          'Most of what misleads people was never generated. It' + "'" + 's real footage with the beginning cut off, or a real photo from a different day. Nothing on this page will catch that.'
        ] }
      ].map(g => ({ title: g.title, items: g.items.map((t, i) => ({ text: t, gap: i === 0 ? '16px' : '14px' })) })),
      segSearchWeight: st.tool === 'search' ? 600 : 400,
      segAiWeight: st.tool === 'ai' ? 600 : 400,
      onList: st.dev === 'gallery',
      onViewer: st.dev === 'gallery' && st.mediaOpen !== null,
      playerCols: 'minmax(280px,420px) 1fr',
      media: mediaRows,
      galleryCells: (() => {
        const byDay = {};
        rows.forEach(r => { (byDay[r.day] = byDay[r.day] || []).push(r); });
        const out = [];
        Object.keys(byDay).map(Number).sort((a, b) => b - a).forEach(dn => {
          const items = byDay[dn];
          out.push({ isHeader: true, isTile: false, day: ((all[dn] || {}).dayName || '').toUpperCase(), count: items.length + (items.length === 1 ? ' item' : ' items') });
          items.slice().reverse().forEach(it => out.push(Object.assign({ isHeader: false, isTile: true }, it)));
        });
        return out;
      })(),
      gallerySections: (() => {
        const byDay = {};
        rows.forEach(r => { (byDay[r.day] = byDay[r.day] || []).push(r); });
        return Object.keys(byDay).map(Number).sort((a, b) => b - a).map(dn => ({
          day: ((all[dn] || {}).dayName || '').toUpperCase(),
          count: byDay[dn].length + (byDay[dn].length === 1 ? ' item' : ' items'),
          items: byDay[dn].slice().reverse()
        }));
      })(),
      openName: openRow.name, openMeta: openRow.meta, openSpec: openRow.spec,
      openCaption: openRow.caption || '',
      openIsShotFake: openRow.kind === 'shot' && (openRow.name || '').indexOf('real') === -1,
      openIsShotReal: openRow.kind === 'shot' && (openRow.name || '').indexOf('real') > -1,
      zoomScale: st.zoom ? 2.1 : 1,
      toggleZoom: () => this.setState(s => ({ zoom: !s.zoom })),
      waveBars: Array.from({ length: 28 }, (_, i) => ({ h: (16 + Math.abs(Math.sin(i * 1.7)) * 66).toFixed(0) + 'px' })),
      playOpen: () => this.playBuf('real'),
      vTouchStart: (e) => { const t = e.touches && e.touches[0]; if (t) this._vt = { x: t.clientX, y: t.clientY }; },
      vTouchEnd: (e) => {
        const t = e.changedTouches && e.changedTouches[0];
        if (!t || !this._vt) return;
        const dx = t.clientX - this._vt.x, dy = t.clientY - this._vt.y;
        this._vt = null;
        if (Math.abs(dy) > 70 && Math.abs(dy) > Math.abs(dx)) { if (dy > 0) this.setState({ mediaOpen: null }); return; }
        if (Math.abs(dx) < 55) return;
        const cur = this.state.mediaOpen, next = dx < 0 ? cur + 1 : cur - 1;
        if (next < 0 || next >= rows.length) return;
        const seen = Object.assign({}, this.state.seen); seen[next] = true;
        this.setState({ mediaOpen: next, seen, zoom: false });
      },
      openIsVideo: openRow.kind === 'video',
      openIsImage: openRow.kind === 'image' && !openRow.savedKind,
      openIsGarden: openRow.savedKind === 'garden', openIsCraft: openRow.savedKind === 'craft',
      toastOn: st.toast,
      feedImgOpen: !!st.feedImg,
      feedImgIsGarden: st.feedImg === 'garden', feedImgIsCraft: st.feedImg === 'craft', feedImgIsParty: st.feedImg === 'party',
      feedImgName: { garden: 'nicole_garden.jpg', craft: 'nicole_craft.jpg', party: 'nicole_party_repost.jpg' }[st.feedImg] || '',
      closeFeedImg: () => this.setState({ feedImg: null }),
      saveFeedImg: () => { if (st.feedImg) this.saveImage(st.feedImg); },
      openIsAudio: openRow.kind === 'audio', openIsShot: openRow.kind === 'shot',
      openChecks: openRow.day === st.day ? openItemChecks : [],
      openNoChecks: !(openRow.day === st.day && openItemChecks.length),
      closeMedia: () => this.setState({ mediaOpen: null }),
      archive: [
        { day: 1, kind: 'video', note: 'Forwarded by Hanna. 15 seconds.' },
        { day: 2, kind: 'photo', thumb: true, note: 'Posted by Hanna.' },
        { day: 3, kind: 'shot', name: 'screenshot_2847.png', note: 'Sent by Hanna.' },
        { day: 4, kind: 'audio', note: st.voiceSent ? 'Sent to you by Nicole. 14 seconds.' : 'Sent to you by Nicole. A screenshot of something you typed.' },
        { day: 4, kind: 'audio', note: 'Forwarded by Hanna. 22 seconds.' },
        { day: 4, kind: 'audio', name: 'voice_nicole_2.m4a', note: 'Forwarded by Hanna. 31 seconds.' }
      ].filter(a => a.day <= st.day).map(a => {
        const src = this.allDays()[a.day] || {};
        return {
          name: a.name || src.deskTitle || '', note: a.note, kind: a.kind,
          when: (src.dayName || '') + ', ' + this.fmt(src.start || 0),
          hasThumb: !!a.thumb, noThumb: !a.thumb
        };
      }),
      tabPlayerBg: st.tool === 'player' ? C.accentSoft : 'transparent',
      tabSearchBg: st.tool === 'search' ? C.accentSoft : 'transparent',
      tabSocialBg: st.tool === 'social' ? C.accentSoft : 'transparent',
      onSocial: st.dev === 'social',
      toolSocial: () => this.setState({ tool: 'social' }),
      socNav: [
        { key: 'feed', icon: 'assets/icons/soc-feed.svg' },
        { key: 'search', icon: 'assets/icons/soc-search.svg' },
        { key: 'messages', icon: 'assets/icons/soc-messages.svg' },
        { key: 'profile', icon: 'assets/icons/soc-profile.svg' }
      ].map(n => ({
        icon: n.icon,
        off: n.key === 'search' || n.key === 'messages',
        rule: socTab === n.key ? C.accent : 'transparent',
        op: (n.key === 'search' || n.key === 'messages') ? 0.35 : (socTab === n.key ? 1 : 0.4),
        go: () => { if (n.key !== 'search' && n.key !== 'messages') this.setState({ socTab: n.key, socProfileKey: null, socPostId: null }); }
      })),
      socMine: socTab === 'profile' && !st.socProfileKey,
      myName: this.name(),
      myHandle: '@' + (this.name() || 'you').toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      socFeed: socTab === 'feed' && !st.socProfileKey && !st.socPostId,
      socEmpty: false,
      socProfile: !!st.socProfileKey,
      socPost: !st.socProfileKey && socTab !== 'profile' && !!st.socPostId,
      feed: feedPosts.filter(p => !p.profileOnly).map(p => ({
        name: p.name, handle: p.handle, ago: p.ago, text: p.text,
        hasText: !!p.text,
        likes: p.likes, replies: p.replies, avatar: p.avatar || p.img,
        hasPhoto: !!p.photo, isGarden: !!p.garden, isCraft: !!p.craft, dated: p.dated || '',
        openGarden: () => this.setState({ feedImg: 'garden' }),
        openCraft: () => this.setState({ feedImg: 'craft' }),
        openParty: () => this.setState({ feedImg: 'party' }),
        tappable: p.handle === '@nicole_kruger' || p.handle === '@n.krueger',
        inert: !(p.handle === '@nicole_kruger' || p.handle === '@n.krueger'),
        cursor: (p.handle === '@nicole_kruger' || p.handle === '@n.krueger') ? 'pointer' : 'default',
        openProfile: () => {
          this.setState({ socProfileKey: p.handle, socPostId: null, socTab: 'feed' });
          if (p.handle === '@n.krueger') { this.setState({ sawFake: true }); this.maybeCompare('fake'); }
          if (p.handle === '@nicole_kruger' && !st.reported) { this.setState({ sawReal: true }); this.maybeCompare('real'); }
        },
        openPost: () => this.setState({ socPostId: p.id, socProfileKey: null, socTab: 'feed' })
      })),
      profDead: !!(prof && prof.dead), profLive: !!(prof && !prof.dead),
      profMenuOpen: st.profMenuOpen, reportReasonOpen: st.reportReasonOpen, reportToast: st.reportToast,
      profReported: !!(st.socProfileKey && st.reportedAccounts[st.socProfileKey]),
      profNotReported: !(st.socProfileKey && st.reportedAccounts[st.socProfileKey]),
      openProfMenu: () => this.openProfMenu(), closeProfMenu: () => this.closeProfMenu(),
      openReportReason: () => this.openReportReason(),
      chooseReasonImpersonation: () => this.chooseReasonImpersonation(), chooseReasonHarassment: () => this.chooseReasonHarassment(), chooseReasonOther: () => this.chooseReasonOther(),
      profName: prof ? prof.name : '', profHandle: prof ? prof.handle : '',
      profBio: prof ? prof.bio : '', profAvatar: window.__R((prof && (prof.img || prof.avatar)) || 'assets/av-mia.webp'),
      profPosts: prof ? prof.posts : '', profFollowers: prof ? prof.followers : '',
      profFollowing: prof ? prof.following : '', profJoined: prof ? prof.joined : '',
      profPostList: prof ? feedPosts.filter(p => p.handle === prof.handle).map(p => ({
        id: p.id, text: p.text || '[photo]', ago: p.ago, likes: p.likes, replies: p.replies,
        hasPhoto: !!p.photo, isGarden: !!p.garden, isCraft: !!p.craft, dated: p.dated || '',
        openGarden: () => this.setState({ feedImg: 'garden' }),
        openCraft: () => this.setState({ feedImg: 'craft' }),
        openParty: () => this.setState({ feedImg: 'party' })
      })) : [],
      postName: openPost ? openPost.name : '', postHandle: openPost ? openPost.handle : '',
      postAgo: openPost ? openPost.ago : '', postText: openPost ? (openPost.text || '[photo]') : '',
      postAvatar: window.__R((openPost && (openPost.avatar || av(openPost.handle))) || 'assets/av-nicole.webp'),
      postHasPhoto: !!(openPost && (openPost.photo || openPost.garden || openPost.craft)), postDated: (openPost && openPost.dated) || '',
      postOpenProfile: () => { if (!openPost) return; this.setState({ socProfileKey: openPost.handle, socPostId: null, socTab: 'feed' }); if (openPost.handle === '@n.krueger') { this.setState({ sawFake: true }); this.maybeCompare('fake'); } if (openPost.handle === '@nicole_kruger' && !st.reported) { this.setState({ sawReal: true }); this.maybeCompare('real'); } },
      postIsGarden: !!(openPost && openPost.garden), postIsCraft: !!(openPost && openPost.craft), postIsParty: !!(openPost && openPost.photo),
      postOpenGarden: () => this.setState({ feedImg: 'garden' }), postOpenCraft: () => this.setState({ feedImg: 'craft' }), postOpenParty: () => this.setState({ feedImg: 'party' }),
      postLikes: openPost ? openPost.likes : 0,
      postReplyCount: openPost ? openPost.replies : 0,
      postReplies: (openPost && openPost.thread ? openPost.thread : []).map((r, i) => Object.assign({}, r, {
        name: nm(r.handle), avatar: r.avatar || av(r.handle),
        ago: ['4h', '3h', '2h'][i] || '1h', likes: [2, 1, 4, 3][i] || 1
      })),
      backToFeed: () => this.setState({ socProfileKey: null, socPostId: null, socTab: 'feed' }),
      tabAiBg: st.tool === 'ai' ? C.accentSoft : 'transparent',
      aiDead: false, aiOp: 1,
      playerChecks, aiChecks,
      mediaLen: st.day === 1 ? '0:15' : st.day === 4 ? '0:22' : '—',
      scrubPct: st.day === 1 || st.day === 4 ? '38%' : '0%',
      scrubLabel: st.day === 1 ? '0:06' : st.day === 4 ? '0:08' : '—',
      dropBorder: st.dragItem ? C.accent : C.muted,
      dropBg: st.dragItem ? C.accentFaint : 'transparent',
      noPick: st.pickIdx === null, hasPick: st.pickIdx !== null,
      pickName: pickRow ? pickRow.name : '', pickMeta: pickRow ? pickRow.meta : '',
      pickIsImage: !!pickRow && pickRow.kind === 'image' && !pickRow.savedKind,
      pickIsGarden: !!pickRow && pickRow.savedKind === 'garden',
      pickIsCraft: !!pickRow && pickRow.savedKind === 'craft',
      searchIdle: !!pickRow && !st.searched[pickRow.name],
      pickIsVideo: !!pickRow && pickRow.kind === 'video',
      searchDone: !!pickRow && !!st.searched[pickRow.name],
      searchOp: pickRow && st.searched[pickRow.name] ? 0.45 : 1,
      searchHits: pickHits.map(h => ({
        source: h.source, date: h.date, quote: h.quote || '', hasQuote: !!h.quote,
        hasThumb: h.kind === 'image', isGardenHit: h.kind === 'garden', isCraftHit: h.kind === 'craft', isVideo: h.kind === 'video',
        open: () => {
          if (!h.goto) return;
          this._scrollToPost = h.goto;
          this.setState({ dev: 'social', tool: 'search', socTab: 'feed', socProfileKey: null, socPostId: h.goto, mediaOpen: null });
        }
      })),
      hitCount: pickHits.length === 1 ? '1 match found.' : pickHits.length + ' matches found.',
      hasHits: !!pickRow && !!st.searched[pickRow.name] && pickHits.length > 0,
      noHits: !!pickRow && !!st.searched[pickRow.name] && pickHits.length === 0,
      searchDeadEnd: (revCheck && revCheck.effect === 'none' && revCheck.result.indexOf('No matches found.') === 0)
        ? revCheck.result.slice('No matches found.'.length).trim()
        : 'This file doesn' + "'" + 't appear anywhere else online.',
      pickerOpen: st.pickerOpen,
      noAiPick: st.aiPickIdx === null, hasAiPick: st.aiPickIdx !== null,
      aiPickName: aiRow ? aiRow.name : '', aiPickMeta: aiRow ? aiRow.meta : '',
      aiPickIsImage: !!aiRow && (aiRow.kind === 'image' || aiRow.kind === 'shot') && !aiRow.savedKind,
      aiPickIsGarden: !!aiRow && aiRow.savedKind === 'garden',
      aiPickIsCraft: !!aiRow && aiRow.savedKind === 'craft',
      aiPickIsVideo: !!aiRow && aiRow.kind === 'video',
      aiPickIsAudio: !!aiRow && aiRow.kind === 'audio',
      aiIdle: st.aiStage === 'idle', aiRunning: st.aiStage === 'running', aiResult: st.aiStage === 'done',
      aiPct: Math.round((st.aiStep / 3) * 100) + '%',
      aiSteps: ['Decoding file…', 'Comparing against known generation patterns…', 'Scoring…'].slice(0, st.aiStep).map(l => ({ label: l })),
      aiScore: aiData ? aiData.score + '%' : '',
      aiVerdict: aiData ? verdictOf(aiData.score) : '',
      aiConfidence: aiData ? (aiData.score >= 85 ? 'High confidence' : (aiData.score < 40 ? 'Low confidence in authenticity' : 'Moderate confidence')) : '',
      aiRows: (aiData && aiData.rows) || [
        { label: 'Generation artefacts', value: 'none detected', pct: '4%' },
        { label: 'Spectral consistency', value: 'consistent', pct: '96%' },
        { label: 'Compression signature', value: 'consistent', pct: '93%' }
      ],
      aiFooter: aiData ? 'Analysed ' + aiData.len + ' · model v4.2' : '',
      runAnalyse: () => {
        if (!aiRow || st.aiStage === 'running') return;
        this.setState({ aiStage: 'running', aiStep: 1 });
        clearTimeout(this._ai1); clearTimeout(this._ai2); clearTimeout(this._ai3);
        this._ai1 = setTimeout(() => this.setState({ aiStep: 2 }), 1000);
        this._ai2 = setTimeout(() => this.setState({ aiStep: 3 }), 2000);
        this._ai3 = setTimeout(() => {
          this.setState({ aiStage: 'done' });
          if (aiData && aiData.hint) this.bumpHint(3, 'hint', 'ai-' + aiRow.name);
          this.advance(2);
          this.log('— you ran the AI checker');
        }, 3000);
      },
      openPicker: () => this.setState({ pickerOpen: true, pickerMode: 'search' }),
      openAiPicker: () => this.setState({ pickerOpen: true, pickerMode: 'ai' }),
      closePicker: () => this.setState({ pickerOpen: false }),
      stopClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); },
      pickerRows: mediaRows.map(r => {
        const ok = r.kind === 'image' || r.kind === 'video';
        return {
          name: r.name, meta: r.meta,
          hasThumb: r.hasThumb, isGardenThumb: r.isGardenThumb, isCraftThumb: r.isCraftThumb,
          isVideoThumb: r.isVideoThumb, noThumb: r.noThumb, kindLabel: r.kindLabel,
          disabled: st.pickerMode === 'ai' ? false : !ok,
          op: (st.pickerMode === 'ai' || ok) ? 1 : 0.4,
          cursor: (st.pickerMode === 'ai' || ok) ? 'pointer' : 'default',
          hover: (st.pickerMode === 'ai' || ok) ? ('background:' + C.frame + ';') : '',
          right: st.pickerMode === 'ai' ? '' : (ok ? (st.searched[r.name] ? 'searched' : '') : 'Images and video only'),
          disabledForMode: st.pickerMode === 'ai' ? false : !ok,
          choose: () => {
            if (this.state.pickerMode === 'ai') this.setState({ aiPickIdx: r.idx, pickerOpen: false, aiStage: 'idle', aiStep: 0 });
            else if (ok) this.setState({ pickIdx: r.idx, pickerOpen: false });
          }
        };
      }),
      runSearch: () => {
        if (!pickRow || st.searched[pickRow.name]) return;
        const searched = Object.assign({}, this.state.searched); searched[pickRow.name] = true;
        this.setState({ searched });
        if (NAME_HITS[pickRow.name] && pickRow.savedKind) {
          this.bumpHint(3, 'hint', 'rev-' + pickRow.name);
          this.advance(8);
        } else if (revCheck && pickRow.day === st.day && !st.done[revCheck.id]) this.runCheck(revCheck);
        else this.advance(8);
      },
      onDragOver: (e) => { if (e && e.preventDefault) e.preventDefault(); },
      onDropSearch: (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (st.dragItem !== null) this.setState({ pickIdx: st.dragItem, dragItem: null });
        else this.setState({ pickerOpen: true, pickerMode: 'search' });
      },
      onDropAi: (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (st.dragItem !== null) this.setState({ aiPickIdx: st.dragItem, dragItem: null, aiStage: 'idle', aiStep: 0 });
        else this.setState({ pickerOpen: true, pickerMode: 'ai' });
      },
      toolPlayer: () => this.setState({ tool: 'player', mediaOpen: null }),
      toolSearch: () => this.setState({ tool: 'search' }),
      toolAi: () => this.setState({ tool: 'ai' }),
       fading: st.fading,
       loading: !!st.loading, loadingLabel: st.loading || '', loadingPct: Math.min(100, st.loadingPct) + '%',
       writeInOpen: st.writeIn && st.threadOpen === 'group',
       chatComposerOpen: st.threadOpen !== null && !st.writeIn,
       chatDraft: st.chatDraft || '',
       chatBusy: !!st.chatBusy,
       chatStatus: st.llmStatus || '',
       chatStatusOpen: !!st.llmStatus,
       chatPlaceholder: st.tab === 'dm' ? 'Message Nicole...' : 'Message the group...',
       chatBudgetLabel: st.tab === 'dm' ? ('DM messages left: ' + st.chatDmLeft) : ('Group messages left: ' + st.chatGroupLeft),
       chatSendLabel: st.chatBusy ? '...' : 'Send',
       chatSendDisabled: !!st.chatBusy || !(st.chatDraft || '').trim() || (st.tab === 'dm' ? st.chatDmLeft <= 0 || tier === 'gone' : st.chatGroupLeft <= 0),
       chatSendOpacity: (!!st.chatBusy || !(st.chatDraft || '').trim() || (st.tab === 'dm' ? st.chatDmLeft <= 0 || tier === 'gone' : st.chatGroupLeft <= 0)) ? 0.45 : 1,
       chatGuideOpen: !!st.actionsOpen,
       chatGuideLine1: st.tab === 'dm'
         ? 'Type your own messages to Nicole — she replies in her own words.'
         : 'Type your own messages in the group — people reply in their own words.',
       chatGuideLine2: 'You only get a few messages a day. Use them carefully.',
       chatGuideLine3: st.tab === 'dm'
         ? 'What you say can raise or lower how much she trusts you.'
         : 'What you say can raise or lower how the class sees you — and how Nicole feels about you.',
       chatGuideExample: (() => {
         const dmEx = {
           1: 'Example: “I don’t believe it. What actually happened?”',
           2: 'Example: “Are you okay? Tim posted a photo of you.”',
           3: st.phase === 'clip'
             ? 'Example: “That’s my voice, but I never said that.”'
             : 'Example: “There’s an account going round with your name on it.”',
           4: 'Example: “That voice message isn’t you. I can show you why.”'
         };
         const groupEx = {
           1: 'Example: “Has anyone actually checked if this is real?”',
           2: 'Example: “That’s from last July — this isn’t okay.”',
           3: st.phase === 'clip'
             ? 'Example: “I’m not talking in here tonight.”'
             : 'Example: “Has anyone checked which account is which?”',
           4: st.apology
             ? 'Example: “Should we forward her apology to the other groups?”'
             : 'Example: “That voice note doesn’t sound like her.”'
         };
         const ex = (st.tab === 'dm' ? dmEx : groupEx)[st.day];
         return ex || (st.tab === 'dm'
           ? 'Example: “Are you okay? I saw what they posted.”'
           : 'Example: “Has anyone actually checked if this is real?”');
       })(),
       tipChatTap: () => this.setState(s => ({ actionsOpen: !s.actionsOpen })),
       onChatDraft: (e) => this.setState({ chatDraft: (e && e.target && e.target.value || '').slice(0, 160) }),
       onChatKey: (e) => { if (e && e.key === 'Enter' && !e.shiftKey) { e.preventDefault && e.preventDefault(); this.sendChatMessage(); } },
       sendChat: () => this.sendChatMessage(),
       writeText: st.writeText,
      onWrite: (e) => this.setState({ writeText: (e.target.value || '').slice(0, 400) }),
      sendWrite: () => this.sendWrite(),
      deleteWrite: () => this.setState({ writeIn: false, writeStatus: 'deleted', screen: 'room', dev: null, threadOpen: null }),
      isStanding: st.screen === 'end' && st.endStep === 1,
      isWriteBack: st.screen === 'end' && st.endStep === 2,
      writeBackHasText: st.writeStatus !== null && !!(st.writeText || '').trim(),
      writeBackText: (st.writeText || '').trim(),
      writeBackLine: st.writeStatus === 'sent' ? 'You wrote this, and you sent it.'
        : (st.writeStatus === 'deleted' && (st.writeText || '').trim()) ? 'You wrote this, and you deleted it.'
        : 'You didn' + "'" + 't write anything.',
      isLedger: st.screen === 'end' && st.endStep === 3,
      isOmissions: st.screen === 'end' && st.endStep === 4,
      isMoves: st.screen === 'end' && st.endStep === 5,
      isLastCard: st.screen === 'end' && st.endStep === 6,
      isInvitation: st.screen === 'end' && st.endStep === 7,
      showEndBack: st.screen === 'end' && st.endStep > 1,
      alwaysTrue: true,
      nextSection: () => {
        const n = this.state.endStep + 1;
        console.log('[endingScreen] ' + this.state.endStep + ' → ' + n);
        this.setState({ endStep: n });
        if (n === 6) { this.setState({ replayShown: false }); setTimeout(() => this.setState({ replayShown: true }), 3000); }
      },
      prevSection: () => {
        const n = Math.max(1, this.state.endStep - 1);
        console.log('[endingScreen] ' + this.state.endStep + ' → ' + n);
        this.setState({ endStep: n });
      },
      dmCloseSub: (st.samDead ? 'locked' : st.sam < 35 ? 'low' : 'high') === 'locked' ? 'last seen Wednesday' : 'last seen Thursday',
      dmCloseMsgs: st.dm.slice(-8).map((m, k) => ({
        id: k, who: m.who, text: (m.text || m.caption || '').split('{name}').join(this.name()),
        justify: m.mine ? 'flex-end' : 'flex-start',
        bg: m.sys ? 'transparent' : (m.mine ? C.inkSoft : C.panel),
        rule: m.mine ? '2px solid ' + C.accent : '0',
        showWho: !m.mine && !m.sys, whoColor: this.whoColorOf(m.who)
      })).concat(st.dmCloseExtra ? [{
        id: 999, who: 'Nicole', text: st.dmCloseExtra.text, justify: 'flex-start',
        bg: C.panel, rule: '0', showWho: true, whoColor: this.whoColorOf('Nicole')
      }] : []),
      dmCloseTyping: st.dmCloseTyping, dmCloseReady: st.dmCloseReady,
      dmCloseLine: (st.samDead ? 'locked' : st.sam < 35 ? 'low' : 'high') === 'locked' ? 'She hasn' + "'" + 't opened this since Wednesday.'
        : (st.samDead ? 'locked' : st.sam < 35 ? 'low' : 'high') === 'low' ? 'She read it. She didn' + "'" + 't answer.' : '',
      groupStandingLine: st.group < 35 ? 'Two people stopped replying to you this week.'
        : st.group >= 65 ? 'Nobody in the group has anything against you.' : '',
      ledger: this.ledger(st, s),
      checkingLabel: endSig.checks === 0 ? 'No fact-checks'
        : endSig.checks + (endSig.checks === 1 ? ' fact-check' : ' fact-checks')
          + (endSig.checks >= 4 ? ' — heavy' : endSig.checks >= 2 ? ' — medium' : ''),
      reactingLabel: endSig.publiclySupported ? 'Stood with her in public'
        : endSig.dmCount >= 3 ? 'Only spoke in private'
        : endSig.dmCount >= 1 ? 'A few private words'
        : 'Stayed quiet',
      checkingBar: checkBarPct + '%',
      reactingBar: careBarPct + '%',
      omissions: this.omissions(st),
      moves: this.moves(s),
      siftLine: (s.sift.investigate + s.sift.coverage + s.sift.trace) === 0
        ? 'You didn' + "'" + 't check anything this week. Almost nobody does. That' + "'" + 's what the week was built on.'
        : 'These four moves have a name. They' + "'" + 're called SIFT, and they work on anything, not just this.',
      finalCard: endCard.text,
      endCardImage: endCard.image || 'assets/nicole_sad_bg.webp',
      replayShown: st.replayShown,
      playReal: () => this.playBuf('real'), playSplice: () => this.playBuf('splice'),
      recOpen: st.recOpen, recIntro: st.recPhase === 'intro', recFailed: st.recPhase === 'failed',
      recBlocked: st.recPhase === 'blocked', recFramed: st.recPhase === 'framed',
      recTrying: st.recTrying, recTryOp: st.recTrying ? 0.6 : 1,
      recAskLabel: st.recTrying ? 'Asking…' : 'Use my microphone',
      recRetryLabel: st.recTrying ? 'Asking…' : 'Try again',
      reloadPage: () => window.location.reload(),
      openInTab: () => window.open(window.location.href, '_blank'),
      recLine: st.recPhase === 'record' ? this.REC_LINES[st.recIdx] : '',
      recProgress: 'Line ' + (st.recIdx + 1) + ' of ' + this.REC_LINES.length,
      recBtnLabel: st.recBusy ? 'stop' : 'hold',
      recBtnBg: st.recBusy ? C.accent : C.accent,
      recLevel: (st.recBusy ? st.recLevel : 0) + '%',
      recAllow: () => this.recAllow(), recToggle: () => this.recToggle(),
      recDecline: () => {
        this.wipeAudio();
        const inIntro = st.screen === 'introchat';
        this.setState(s2 => ({ recOpen: false, recPhase: 'intro', voiceSent: false, used: Object.assign({}, s2.used, { sendvoice: true }) }),
          () => { if (inIntro) this._it = setTimeout(() => this.introStep(), 500); });
      },
      hasRecording: st.hasRecording, deleteRecording: () => this.deleteRecording(),


      start: () => this.setState({ screen: 'name', nameDraft: '' }, () => { const el = this.nameRef.current; if (el) el.focus(); }),
      hasSave: !!savedGame,
      savePlayerName: this.savedPlayerName(savedGame),
      savePlayerAvatar: this.savedPlayerAvatar(savedGame),
      saveProgressLabel: this.describeSave(savedGame),
      continueGame: () => this.continueGame(),
      startOver: () => this.startOver(),
      isNameEntry: st.screen === 'name', nameDraft: st.nameDraft, nameRef: this.nameRef,
      onNameChange: (e) => this.setState({ nameDraft: e.target.value.replace(/[^A-Za-z \-]/g, '').slice(0, 16) }),
      onNameKey: (e) => { if (e.key === 'Enter') this.submitName(); },
      submitName: () => this.submitName(),
      pickFemale: () => this.setState({ playerAvatar: 'female' }),
      pickMale: () => this.setState({ playerAvatar: 'male' }),
      noAvatar: !st.playerAvatar, enterOp: st.playerAvatar ? 1 : 0.45,
      femaleRing: st.playerAvatar === 'female' ? '0 0 0 3px ' + C.accent : 'none',
      maleRing: st.playerAvatar === 'male' ? '0 0 0 3px ' + C.accent : 'none',
      femaleLift: st.playerAvatar === 'female' ? '-2px' : '0px',
      maleLift: st.playerAvatar === 'male' ? '-2px' : '0px',
      meIsFemale: st.playerAvatar !== 'male', meIsMale: st.playerAvatar === 'male',
      isHowTo: st.screen === 'howto', leaveHowTo: () => this.leaveHowTo(),
      skipIntro: () => { clearTimeout(this._it); this.showDayCard(1); },
      isIntroText: st.screen === 'introtext', introReady: st.introReady,
      advanceIntro: () => this.advanceIntro(),
      isIntroChat: st.screen === 'introchat',
      isDayCard: st.screen === 'daycard',
      dayCardKicker: 'Day ' + (st.pendingDay || 1) + ' · ' + (st.pendingDay === 3
        ? (st.cardPhase === 'clip' ? 'that evening' : 'the account')
        : ({ 1: 'the video', 2: 'the photo', 4: 'the voice' }[st.pendingDay] || '')),
      dayCardDay: st.cardDayName || '', dayCardWhen: st.cardWhen || '',
      introLines: this.BACKSTORY.slice(0, st.introLine).map(t => ({ text: t })),
      introRef: this.introRef, introTyping: st.introTyping,
      introTypingJustify: (this.P_LOG[st.introMsg] || {}).mine ? 'flex-end' : 'flex-start',
      introTypingBg: (this.P_LOG[st.introMsg] || {}).mine ? C.inkSoft : C.panel,
      introTypingRule: (this.P_LOG[st.introMsg] || {}).mine ? '2px solid ' + C.accent : '0',
      introMsgs: this.P_LOG.slice(0, st.introMsg).map((m, i) => ({
        id: i, who: m.who, text: ((m.text || m.caption || '…')).split('{name}').join(this.name()),
        isVoice: m.kind === 'voice', isTextOnly: m.kind !== 'voice', dur: m.dur || '0:10',
        isSys: !!m.sys, rowDisplay: m.sys ? 'none' : 'flex',
      mineFemale: !!m.mine && st.playerAvatar === 'female', mineMale: !!m.mine && st.playerAvatar === 'male',
        theirs: !m.mine && !m.sys, avatar: this.faceOf(m.who),
        justify: m.mine ? 'flex-end' : 'flex-start',
        bg: m.mine ? C.inkSoft : C.panel,
        rule: m.mine ? '2px solid ' + C.accent : '0',
        showWho: !m.mine && !m.sys, whoColor: this.whoColorOf(m.who),
        lightBg: m.sys ? C.washWarm : (m.mine ? C.accentWash : C.white),
        lightWho: this.whoColorOf(m.who),
        lightText: m.sys ? C.muted : C.ink,
        radius: m.mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px'
      })),
      barsShown: st.day >= 1 ? 1 : 0,

      openPhone: () => {
        this.setState({ dev: null, threadOpen: null, actionsOpen: false, screen: 'phone' });
        if (tier === 'gone' && !st.ghostTypedToday) {
          this.setState({ ghostTypedToday: true });
          setTimeout(() => this.setState({ dmGhostTyping: true }), 1400);
          setTimeout(() => this.setState({ dmGhostTyping: false }), 4400);
        }
      },
      backToTitle: () => { this.saveGame(); this.setState({ screen: 'title', confirmSleep: false }); },

      backToRoom: () => {
        const owed = st.dm.some(m => !m.mine && !m.sys && m.today);
        if (st.screen === 'phone' && st.tab === 'dm' && !st.dmAnsweredToday
            && !st.onReadCharged && tier !== 'gone' && owed) {
          this.setState(s => ({ onReadCharged: true, dm: s.dm.concat([{ who: 'System', sys: true, text: 'Seen ' + this.fmt(s.min) }]) }));
          this.rel(-10, 0, null);
          this.log('— you left her on read');
        }
        this.setState(s => ({ screen: 'room', actionsOpen: false, ignored: s.screen === 'phone' && s.openedGroup && !s.actedToday }));
      },
      tabGroup: () => this.setState({ tab: 'group', actionsOpen: false, openedGroup: true }),
      tabDm: () => this.setState({ tab: 'dm', actionsOpen: false }),
      flipPhoto: () => this.setState({ photoUp: !st.photoUp }),
      askSleep: (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        const s0 = this.state;
        if (s0.day === 4 && s0.writeStatus === null) {
          this.setPhase('finalMessage');
          this.setState({ screen: 'phone', dev: 'chats', threadOpen: 'group', writeIn: true, min: 23 * 60 + 20, unread: 0 });
          return;
        }
        console.log('[bed] confirm on day ' + s0.day + ', writeStatus=' + s0.writeStatus);
        this.setState({ confirmSleep: true });
      },
      cancelSleep: () => this.setState({ confirmSleep: false }),
      doSleep: () => this.endDay(),
      restart: () => this.setState({
        screen: 'title', day: 1, min: this.DAYS[1].start, done: {}, used: {},
        hints: { 1: [], 2: [], 3: [], 4: [], 5: [] }, certainty: { 1: 'unchecked', 2: 'unchecked', 3: 'unchecked', 4: 'unchecked', 5: 'unchecked' },
        credibility: 0, credibilityLost: false, voiceSent: false, reason: '',
        pStage: -1, introLine: 0, introMsg: 0, introTyping: false, introReady: false, samSilent: false,
        dmCloseTyping: false, dmCloseExtra: null, dmCloseReady: false, variant: Math.floor(Math.random() * 2),
        replayShown: false, postedWed: false,
        recOpen: false, recPhase: 'intro', recIdx: 0, recBusy: false, recLevel: 0, hasRecording: false, recTrying: false, recAttempts: 0, recTrying: false, recAttempts: 0,
        minCheck: 0, minReact: 0, postsWith: 0, postsWithout: 0, dmChances: 0, endStep: 1, gamePhase: 'playing',
        apology: false, reported: false, clipBack: false, phase: 'evening', sharedCount: 3,
        profMenuOpen: false, reportReasonOpen: false, reportToast: false, reportedAccounts: {}, reportedFake: false,
        actedToday: false, openedGroup: false, ignored: false, dmAnsweredToday: false,
        shareTick: 0, shareHalved: false, fading: false, tool: 'player', socTab: 'feed', socProfileKey: null, socPostId: null, mediaOpen: null, seen: {}, zoom: false, dev: null, threadOpen: null, galleryNew: false, chatFlash: false,
        writeIn: false, writeText: '', writeStatus: null, chatDraft: '', chatBusy: false, actionsOpen: false, chatGroupLeft: 4, chatDmLeft: 3, llmUsedReplies: [], llmReplySeed: 0,
        dragItem: null, pickIdx: null, pickerOpen: false, pickerMode: 'search', searched: {}, aiPickIdx: null, aiStage: 'idle', aiStep: 0, actionLog: [], reactionTimes: [],
        final: { post: null, fwd: null, tell: null }, sam: 50, group: 50, pushIdx: 0, flashSam: false, flashGroup: false, samDead: false,
        stats: { forwards: 0, reacts: 0, checks: 0, fast: 0, dmAnswered: 0, believed: 0, dismissed: 0, stopped: 0, fastest: null, sift: { investigate: 0, coverage: 0, trace: 0 }, chat: { dm: 0, group: 0, questioning: 0, pile_on: 0, supportive: 0, neutral: 0 } }
      })
    };
  }
});
