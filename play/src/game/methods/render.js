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

    const dmNew = this.unreadFrom(st.dm, (st.lastRead || {}).dm);
    const groupListUnread = this.unreadFrom(st.chat, (st.lastRead || {}).group);
    const chatUnreadTotal = groupListUnread + dmNew;
    const msgsRaw = st.tab === 'group' ? st.chat : st.dm;
    const msgs = msgsRaw.map((m, i) => {
      const audioKey = st.tab + ':' + i;
      // Prefer live TTS. While TTS is still running, keep audio:'clone' so play
      // waits instead of jumping to splice / static fallback early.
      const clonePlay = m.audio === 'clone'
        ? (st.cloneAudioSrc
          ? { mode: 'file', src: st.cloneAudioSrc }
          : (this.isDay3ClonePending()
            ? null
            : (this._splice ? { mode: 'buf', which: 'splice' } : null)))
        : null;
      const playbackMessage = clonePlay
        ? (clonePlay.mode === 'file'
          ? Object.assign({}, m, { audioSrc: clonePlay.src })
          : Object.assign({}, m, { audio: clonePlay.which }))
        : m;
      const clonePending = m.audio === 'clone' && !st.cloneAudioSrc && this.isDay3ClonePending();
      const isPlaying = m.kind === 'voice' && st.playingAudioKey === audioKey;
      const duration = m.audio === 'clone' && st.cloneAudioDuration
        ? this.audioDurationLabel(st.cloneAudioDuration) : (m.dur || '0:04');
      return {
        id: i, who: m.who, text: ((m.text || m.caption || '…')).split('{name}').join(this.name()),
        isNewMark: st.newMarkAt !== null && i === st.newMarkAt,
        caption: (m.caption || '').split('{name}').join(this.name()), dur: duration,
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
        isFullVideo: m.kind === 'video' && !!m.full,
        isShortVideo: m.kind === 'video' && !m.full,
        videoSpec: m.full ? 'video · 0:22' : 'video · 0:06',
        isShot: m.kind === 'shot',
        isShotFake: m.kind === 'shot' && m.shot !== 'left' && m.shot !== 'real',
        isShotLeft: m.kind === 'shot' && m.shot === 'left',
        isProfileShot: m.shot === 'profile', isCommentShot: m.shot === 'comment',
        openShot: () => {
          if (m.shot === 'left') {
            this.setState({ shotOpen: 'left' });
            return;
          }
          if (m.shot === 'real') {
            this.setState({ shotOpen: 'real', sawReal: true });
            this.maybeCompare('real');
            return;
          }
          this.setState({ shotOpen: 'fake', sawFake: true });
          this.maybeCompare('fake');
        },
        openPhoto: () => this.setState({ shotOpen: 'photo' }),
        lightBg: m.sys ? C.washWarm : (m.mine ? C.accentWash : C.white),
        lightWho: this.whoColorOf(m.who),
        lightText: m.sys ? C.muted : C.ink,
        radius: m.mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        isText: !m.kind, tick: m.mine && !m.old ? (m.unsent ? '✓' : '✓✓') : '',
        isPlaying, isStopped: !isPlaying,
        voiceUnavailable: false,
        voiceOpacity: clonePending ? 0.55 : 1,
        voiceLabel: clonePending ? 'Generating…' : (isPlaying ? 'Stop voice note' : 'Play voice note'),
        togglePlay: () => this.toggleChatAudio(audioKey, playbackMessage)
      };
    });

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
    const itemName = {
      1: 'IMG_4471.mp4',
      2: 'nicole_party.jpg',
      3: this.clipFileName(),
      4: this.day4VoiceFileName()
    }[st.day];
    const all = this.allDays();
    const recordingName = this.recordingFileName();
    const clipName = this.clipFileName();
    const day4VoiceName = this.day4VoiceFileName();
    const rows = [
      // Needed for clip-night d4cmp: hear clone + Sunday original side by side.
      { day: 0, item: 0, kind: 'audio', name: recordingName, who: 'You', when: 'Sunday evening', spec: '0:10', gate: !!st.voiceSent, playReal: true },
      { day: 1, item: 1, kind: 'video', who: 'Hanna', spec: '0:06' },
      { day: 1, item: 1, kind: 'video', name: 'IMG_4471_full.mp4', who: 'Mia', spec: '0:22', gate: !!st.d1VideoSent, videoFull: true },
      // Same Nicole DMs as intro dmHistory (before the Monday banner).
      { day: 1, kind: 'audio', name: 'voice_message_0708.m4a', who: 'Nicole', when: 'Saturday evening', spec: '0:17', audioSrc: 'assets/audios/1-first_audio.wav' },
      { day: 1, kind: 'audio', name: 'voice_message_0709.m4a', who: 'Nicole', when: 'Sunday evening', spec: '0:04', audioSrc: 'assets/audios/1-second_audio.wav' },
      { day: 2, item: 2, kind: 'image', who: 'Hanna', spec: '1024 × 1024' },
      { day: 3, item: 3, kind: 'shot', name: 'screenshot_2847.png', who: 'Hanna', spec: 'image' },
      { day: 3, item: 5, gate: st.clipBack, kind: 'audio', name: clipName, who: 'Nicole', when: 'Wednesday, 10:15pm',
        spec: st.cloneAudioDuration ? this.audioDurationLabel(st.cloneAudioDuration) : '0:04' },
      { day: 4, kind: 'audio', name: day4VoiceName, who: 'Hanna', spec: '0:11', audioSrc: 'assets/audios/4-first_audio.wav' }
    ].concat(st.saved.map(s => ({
      day: s.day, item: 3, kind: 'image', savedKind: s.kind, name: s.name,
      who: s.from, when: (all[s.day] || {}).dayName || '', savedFrom: true, spec: 'image'
    }))).filter(r => r.day <= st.day && r.gate !== false).map((r, i) => {
      const src = all[r.day] || {};
      const when = r.when || ((src.dayName || '') + ', ' + this.fmt(src.start || 0));
      const name = r.name || src.deskTitle || '';
      const seenKey = this.gallerySeenKey(Object.assign({}, r, { name }));
      return {
        idx: i, day: r.day, item: r.item || r.day, kind: r.kind,
        name,
        meta: r.playReal
          ? (when + ' · your voice note')
          : (r.savedFrom ? (when + ' · saved from ' + r.who) : (when + ' · sent by ' + r.who)),
        spec: r.spec, caption: r.caption || '', savedKind: r.savedKind || '',
        playReal: !!r.playReal,
        audioSrc: r.audioSrc || '',
        videoFull: !!r.videoFull,
        seenKey,
        isGardenThumb: r.savedKind === 'garden', isCraftThumb: r.savedKind === 'craft',
        isPartyThumb: r.savedKind === 'party',
        kindLabel: r.kind === 'image' ? 'image' : r.kind === 'shot' ? 'image' : r.kind,
        hasThumb: r.kind === 'image' && !r.savedKind,
        isVideoThumb: r.kind === 'video' && !r.videoFull,
        isVideoFullThumb: r.kind === 'video' && !!r.videoFull,
        isShotThumb: r.kind === 'shot',
        isAudio: r.kind === 'audio',
        isShotFake: r.kind === 'shot' && (r.name || '').indexOf('real') === -1,
        isShotReal: r.kind === 'shot' && (r.name || '').indexOf('real') > -1,
        unseen: !st.seen[seenKey],
        noThumb: r.kind !== 'image' && r.kind !== 'video' && r.kind !== 'shot',
        open: () => {
          const seen = Object.assign({}, this.state.seen);
          seen[seenKey] = true;
          this.setState({ mediaOpen: i, seen, zoom: false });
        },
        draggable: r.kind === 'image' || r.kind === 'video',
        drag: () => this.setState({ dragItem: i })
      };
    });
    const mediaRows = rows.slice().reverse();
    const viewingMedia = st.screen === 'phone' && st.dev === 'gallery' && st.mediaOpen !== null && !!rows[st.mediaOpen];
    const openRow = viewingMedia
      ? rows[st.mediaOpen]
      : { day: -1, item: -1, kind: '', name: '', meta: '', spec: '', caption: '', savedKind: '', videoFull: false };
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
      'IMG_4471.mp4': { score: 96, len: '0:06 of video', rows: [
        { label: 'Generation artefacts', value: 'none detected', pct: '4%' },
        { label: 'Frame consistency', value: 'consistent', pct: '96%' },
        { label: 'Compression signature', value: 'consistent', pct: '93%' },
        { label: 'Audio-visual sync', value: 'natural', pct: '95%' }
      ] },
      'IMG_4471_full.mp4': { score: 97, len: '0:22 of video', rows: [
        { label: 'Generation artefacts', value: 'none detected', pct: '3%' },
        { label: 'Frame consistency', value: 'consistent', pct: '97%' },
        { label: 'Compression signature', value: 'consistent', pct: '94%' },
        { label: 'Audio-visual sync', value: 'natural', pct: '96%' }
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
      'nicole_party_repost.jpg': { score: 99, len: '1 image', rows: [
        { label: 'Generation artefacts', value: 'none detected', pct: '1%' },
        { label: 'Pixel-level consistency', value: 'consistent', pct: '99%' },
        { label: 'Compression signature', value: 'consistent', pct: '97%' },
        { label: 'Metadata', value: 'intact', pct: '99%' }
      ] },
      'screenshot_2847.png': { score: 91, len: '820 × 1180 image' },
      [clipName]: { score: 95, len: (st.cloneAudioDuration ? this.audioDurationLabel(st.cloneAudioDuration) : '0:04') + ' of audio' },
      [recordingName]: { score: 99, len: '0:10 of audio' },
      [day4VoiceName]: { score: 97, len: '0:11 of audio' },
      'voice_message_0708.m4a': { score: 98, len: '0:17 of audio' },
      'voice_message_0709.m4a': { score: 98, len: '0:04 of audio' }
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
        R('@benito_', 'why are you not answering my calls')
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
      // Wednesday morning (~7:20): second-account drama is fresh.
      // Wednesday night / later: those same posts must read as from this morning, not “30m ago”.
      const d3Night = st.day > 3 || (st.day === 3 && st.phase !== 'morning');
      const a = (morningAgo, nightAgo) => (d3Night ? nightAgo : morningAgo);
      feedPosts = [
        P('f5', '@n.krueger', a('11h', '18h'), 'Spending time in the garden really underscores the importance of slowing down 🌿 At its core, it' + "'" + 's about finding small moments of calm in a busy week.', { garden: true, likes: 61, replies: 8 }),
        P('f6', '@n.krueger', a('13h', '20h'), 'Delving into a little creative project ✨ There' + "'" + 's something pivotal about making things with your own hands. A key takeaway: patience really is everything 💛', { craft: true, likes: 55, replies: 12 }),
        P('d3a', '@hanna.k', a('30m', '14h'), 'so she made a second account. cool cool', { likes: 29, replies: 8, thread: [
          R('@mia.h', 'those are her old photos'), R('@nele.b', 'the account is only a few days old. just saying.')
        ] }),
        P('f2', '@n.krueger', a('1h', '15h'), 'lea only agrees with hanna because she' + "'" + 's scared of her, everyone sees it', { likes: 52, replies: 9, thread: [
          R('@mia.h', 'wow ok'), R('@hanna.k', 'nicole what')
        ] }),
        P('f3', '@n.krueger', a('2h', '16h'), 'hanna talks about people the second they leave the room', { likes: 44, replies: 11, thread: [
          R('@hanna.k', 'excuse me??'), R('@nele.b', 'lol')
        ] }),
        P('d3b', '@nele.b', a('3h', '16h'), 'so fake..', { likes: 4, replies: 2, thread: [
          R('@hanna.k', 'what is'), R('@lea.m', 'say more?')
        ] }),
        P('d3c', '@lea.m', a('5h', '17h'), 'has anyone actually asked her', { likes: 2, replies: 1, thread: [
          R('@hanna.k', 'asked her what')
        ] }),
        P('d3d', '@mia.h', a('7h', '19h'), 'friday is still happening. please be normal.', { likes: 19, replies: 3, thread: [
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
        joined: 'Joined September 2022', email: 'n***k@g***.com', accountAge: 'Account created 4 years ago', dead: st.reported },
      '@n.krueger': { handle: '@n.krueger', name: 'Nicole K.', img: 'assets/av-nicole.webp',
        bio: 'not everything is about you 🖤', posts: '6', followers: '42', following: '12',
        joined: 'Joined this week', email: 'b****o@g***.com', accountAge: 'Account created 4 days ago' },
      '@nele.b': { handle: '@nele.b', name: 'Nele B', img: 'assets/av-nele.webp', bio: 'here for the food', posts: '208', followers: '190', following: '204', joined: 'Joined March 2022' },
      '@mia.h': { handle: '@mia.h', name: 'Mia H', img: 'assets/av-mia.webp', bio: 'cedar street', posts: '340', followers: '277', following: '250', joined: 'Joined June 2021' },
      '@hanna.k': { handle: '@hanna.k', name: 'Hanna K', img: 'assets/av-hanna.webp', bio: 'you had to be there', posts: '511', followers: '302', following: '333', joined: 'Joined January 2022' },
      '@lea.m': { handle: '@lea.m', name: 'Lea M', img: 'assets/av-lea.webp', bio: '', posts: '96', followers: '141', following: '160', joined: 'Joined April 2022' },
      '@benito_': { handle: '@benito_', name: 'Benito', img: 'assets/av-benito.webp', bio: '', posts: '64', followers: '150', following: '88', joined: 'Joined November 2021' }
    };
    const socTab = st.socTab || 'feed';
    const prof = st.socProfileKey ? PROFILES[st.socProfileKey] : null;
    const openPost = st.socPostId ? feedPosts.find(p => p.id === st.socPostId) : null;
    const seePost = (id) => {
      const key = 'soc:' + id;
      if (this.state.seen[key]) return;
      const seen = Object.assign({}, this.state.seen); seen[key] = true;
      this.setState({ seen });
    };
    const NAME_HITS = {
      'nicole_garden.jpg': [{ source: 'social · @n.krueger', date: 'Posted today', kind: 'garden', goto: 'f5' }],
      'nicole_craft.jpg': [{ source: 'social · @n.krueger', date: 'Posted today', kind: 'craft', goto: 'f6' }],
      'nicole_party_repost.jpg': [{ source: 'social · @nicole_kruger', date: 'Posted 14 July, last year', quote: 'laura' + "'" + 's birthday 🎂', kind: 'image', goto: 'old10' }]
    };
    const pickRow = st.pickIdx !== null ? rows[st.pickIdx] : null;
    const pickHits = pickRow ? (NAME_HITS[pickRow.name] || HITS[pickRow.day] || []) : [];
    const socialUnseenCount = feedPosts.filter(p => !p.profileOnly && p.day === st.day && !st.seen['soc:' + p.id]).length;
    this._socialFeedIds = feedPosts.filter(p => !p.profileOnly && p.day === st.day).map(p => p.id);
    const socialSeenPatch = () => {
      const seen = Object.assign({}, this.state.seen);
      let changed = false;
      (this._socialFeedIds || []).forEach(id => {
        const key = 'soc:' + id;
        if (seen[key]) return;
        seen[key] = true;
        changed = true;
      });
      return changed ? { seen } : {};
    };
    const leaveSocialPatch = () => (this.state.dev === 'social' ? socialSeenPatch() : {});


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
    const roomBg = this.roomBgFor(st.day, st.phase, !!st.phoneOpenedToday);
    const roomBgReady = st.roomBgReadySrc === roomBg;
    const notebookGot = this.notebookGotItems(st, st.notebookDayKey);
    const notebookFills = this.notebookVerdictFills(st, st.notebookDayKey);
    const notebookTabs = this.notebookDayTabs(st);
    const notebookShowReflection = this.notebookShowReflection(st);
    const notebookVerdictEditable = notebookShowReflection && !this.isPastDiaryKey(st, st.notebookDayKey);
    const notebookVerdictReadonly = notebookShowReflection && !notebookVerdictEditable;
    const notebookContinueBlocked = st.notebookMode === 'sleep' && !this.sleepVerdictReady(st);
    this.maybeAutoUnlockTodayHint(st);
    const notebookShowShelf = st.notebookSection === 'shelf';
    const notebookShowIntro = st.notebookSection === 'intro';
    const notebookShowMap = st.notebookSection === 'map';
    const notebookShowDay = st.notebookSection === 'day';
    const relationMap = notebookShowMap ? this.relationMapView(st) : {
      nodes: [], edges: [], notes: [], legend: [], focusFacts: [],
      hasFocus: false, noFocus: true, focusName: '', focusEmpty: true, hint: ''
    };

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
      cineMuteIcon: st.cineMuted ? 'assets/icons/speaker-x.svg' : 'assets/icons/speaker-high.svg',
      cineMuteTitle: st.cineMuted ? 'Unmute' : 'Mute',
      beginCinematic: () => this.beginCinematic(),
      skipCinematic: () => this.skipCinematic(),
      toggleCineMute: () => this.toggleCineMute(),
      isTitle: st.screen === 'title', isRoom: st.screen === 'room' || st.screen === 'phone', isPhone: st.screen === 'phone',
      phoneAnimMod: st.phoneClosing ? 'is-closing' : '',
      onHome: st.dev === null, onApp: st.dev !== null,
      screenBg: st.dev === null
        ? 'center / cover no-repeat url("assets/class_10b.webp"), var(--c-accent)'
        : C.white,
      statusColor: C.ink,
      homeBarColor: C.inkMuted,
      goHome: () => this.setState(Object.assign({
        dev: null, threadOpen: null, socInfoOpen: false
      }, leaveSocialPatch(), this.flushOpenThreadRead())),
      apps: [
        { key: 'chats', label: 'Message', icon: 'assets/icons/app-chats.svg', badge: chatUnreadTotal, dot: false },
        { key: 'gallery', label: 'Photo Gallery', icon: 'assets/icons/app-gallery.svg', badge: 0, dot: false },
        { key: 'fact', label: 'Fact Checker', icon: 'assets/icons/app-fact.svg', badge: 0, dot: false },
        { key: 'social', label: 'Social Media', icon: 'assets/icons/app-social.svg', badge: socialUnseenCount, dot: false }
      ].map(a => ({
        label: a.label, badge: a.badge, icon: a.icon, dot: a.dot,
        isChats: a.key === 'chats', isGallery: a.key === 'gallery',
        isFact: a.key === 'fact', isSocial: a.key === 'social',
        go: () => {
          this.stopAudio();
          this.setState(Object.assign({
            dev: a.key, threadOpen: null, socInfoOpen: false,
            tool: a.key === 'gallery' ? 'player' : a.key === 'social' ? 'social' : a.key === 'fact' ? (this.state.tool === 'ai' ? 'ai' : 'search') : this.state.tool,
            mediaOpen: null, socTab: 'feed', socProfileKey: null, socPostId: null,
            galleryNew: a.key === 'gallery' ? false : this.state.galleryNew
          }, (this.state.dev === 'social' && a.key !== 'social') ? socialSeenPatch() : {}));
        }
      })),
      onChats: st.dev === 'chats', onDeviceTool: st.dev !== 'chats' && st.dev !== null,
      onChatList: st.dev === 'chats' && st.threadOpen === null,
      onThread: st.dev === 'chats' && st.threadOpen !== null,
      backToChats: () => {
        this.stopAudio();
        const k = st.threadOpen;
        const lastRead = Object.assign({}, st.lastRead);
        if (k) lastRead[k] = (k === 'group' ? st.chat : st.dm).length;
        this.setState(Object.assign({
          threadOpen: null, actionsOpen: false, lastRead, newMarkAt: null, showNewPill: false
        }, this.chatUnreadPatch(st.chat, st.dm, lastRead)));
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
          preview: this.preview(st.chat), unread: groupListUnread, hasUnread: groupListUnread > 0 },
        { key: 'dm', name: 'Nicole', avatar: 'assets/av-nicole.webp', sub: tier === 'gone' ? 'last seen Wednesday' : 'online',
          preview: this.preview(st.dm), unread: dmNew, hasUnread: dmNew > 0 }
      ].map(t => Object.assign(t, {
        open: () => {
          this.stopAudio();
          const list = t.key === 'group' ? this.state.chat : this.state.dm;
          const read = (this.state.lastRead || {})[t.key];
          this._pendingScroll = true;
          this._atBottom = true;
          this._lastLen = list.length;
          const lastRead = Object.assign({}, this.state.lastRead, { [t.key]: list.length });
          this.setState(Object.assign({
            threadOpen: t.key, tab: t.key, actionsOpen: false, showNewPill: false, socInfoOpen: false,
            newMarkAt: typeof read === 'number' && read >= 0 && read < list.length ? read : null,
            openedGroup: t.key === 'group' ? true : this.state.openedGroup,
            lastRead
          }, this.chatUnreadPatch(this.state.chat, this.state.dm, lastRead)));
        }
      })),
      navTabs: [
        { key: 'chats', tile: C.accent, label: 'Message', badge: chatUnreadTotal, dot: false, flash: st.chatFlash },
        { key: 'gallery', tile: C.accent, label: 'Gallery', badge: 0, dot: st.galleryNew },
        { key: 'fact', tile: C.accent, label: 'Fact Check', badge: 0, dot: false },
        { key: 'social', tile: C.accent, label: 'Social', badge: 0, dot: false }
      ].map(n => ({
        label: n.label, badge: n.badge, dot: n.dot,
        swatch: st.dev === n.key ? n.tile : C.inkGhost,
        color: n.flash ? C.danger : (st.dev === n.key ? C.ink : C.inkFaint),
        go: () => this.setState(Object.assign({
          dev: n.key, socInfoOpen: false,
          tool: n.key === 'gallery' ? 'player' : n.key === 'social' ? 'social' : n.key === 'fact' ? (this.state.tool === 'ai' ? 'ai' : 'search') : this.state.tool,
          mediaOpen: null, galleryNew: n.key === 'gallery' ? false : this.state.galleryNew
        }, (this.state.dev === 'social' && n.key !== 'social') ? socialSeenPatch() : {})),
      })),
      isFinal: st.screen === 'final',
      clockLabel: (this.props.showClock ?? true) ? this.fmt(st.min) : '',
      dayName: d.dayName.toUpperCase(), nightOpacity: 0, morningWash: 0,
      roomBg,
      roomBgReady,
      roomBgLoading: !roomBgReady,
      roomBgReadyOp: roomBgReady ? 1 : 0,
      roomHotspotsOpen: !!st.phoneOpenedToday && roomBgReady,
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
      unread: chatUnreadTotal, hasUnread: chatUnreadTotal > 0, dmUnread: st.tab !== 'dm' && dmNew > 0,
      dmUnreadCount: dmNew,
      buzzAnim: chatUnreadTotal > 0 ? 'buzz .55s ease-in-out infinite' : 'none',
      msgToastShown: this.FORCE_ROOM_TOAST ? (st.screen === 'room') : !!st.msgToast,
      msgToastOpacity: (this.FORCE_ROOM_TOAST && st.screen === 'room') || st.msgToastVisible ? 1 : 0,
      msgToastY: (this.FORCE_ROOM_TOAST && st.screen === 'room') || st.msgToastVisible ? '0px' : '-14px',
      msgToastWho: (st.msgToast && st.msgToast.who) || (this.FORCE_ROOM_TOAST ? '10b 🍕' : ''),
      msgToastText: (st.msgToast && st.msgToast.text) || (this.FORCE_ROOM_TOAST ? 'yo WHAT' : ''),
      msgToastAvatar: (st.msgToast && (st.msgToast.avatar || this.faceOf(st.msgToast.kind === 'dm' ? 'Nicole' : 'Hanna')))
        || (this.FORCE_ROOM_TOAST ? this.faceOf('Hanna') : ''),
      msgToastLeft: (st.day === 3 && st.phase === 'morning') ? 'var(--hot-toast-am-l)' : 'var(--hot-toast-l)',
      msgToastTop: (st.day === 3 && st.phase === 'morning') ? 'var(--hot-toast-am-t)' : 'var(--hot-toast-t)',
      msgToastTipLeft: (st.day === 3 && st.phase === 'morning') ? 'auto' : '38px',
      msgToastTipRight: (st.day === 3 && st.phase === 'morning') ? '38px' : 'auto',
      socToastShown: this.FORCE_ROOM_TOAST ? (st.screen === 'room') : !!st.socToast,
      socToastOpacity: (this.FORCE_ROOM_TOAST && st.screen === 'room') || st.socToastVisible ? 1 : 0,
      socToastY: (this.FORCE_ROOM_TOAST && st.screen === 'room') || st.socToastVisible ? '0px' : '-14px',
      socToastWho: (st.socToast && st.socToast.who) || (this.FORCE_ROOM_TOAST ? 'Hanna K' : ''),
      socToastText: (st.socToast && st.socToast.text) || (this.FORCE_ROOM_TOAST ? 'some people really show their true colours' : ''),
      socToastLeft: (st.day === 3 && st.phase === 'morning') ? 'var(--hot-soc-toast-am-l)' : 'var(--hot-soc-toast-l)',
      socToastTop: (st.day === 3 && st.phase === 'morning') ? 'var(--hot-soc-toast-am-t)' : 'var(--hot-soc-toast-t)',
      socToastTipLeft: (st.day === 3 && st.phase === 'morning') ? 'auto' : '38px',
      socToastTipRight: (st.day === 3 && st.phase === 'morning') ? '38px' : 'auto',
      sceneScale: st.cameraPush ? 1.045 : 1,
      pushVignetteOp: st.cameraPush ? 0.32 : 0,
      dayPanY: st.dayEnter ? '-52px' : '0px',
      dayPanScale: st.dayEnter ? 1.05 : 1,
      dayPanOp: st.dayEnter ? 0.55 : 1,
      photoUp: st.photoUp, photoBg: st.photoUp ? C.ink : C.panel,
      confirmSleepOpen: st.confirmSleep,
      sleepTitle: st.day === 4
        ? 'That' + "'" + 's the week.\nGo to sleep?'
        : (st.day === 3 && st.phase === 'morning')
          ? 'Go to school?'
          : 'Go to sleep?',
      sleepConfirmLabel: (st.day === 3 && st.phase === 'morning') ? 'Go' : 'Sleep',
      threadTitle: st.tab === 'group' ? '10b 🍕' : 'Nicole',
      threadSub: st.tab === 'group' ? d.threadSub : (tier === 'gone' ? 'last seen Wednesday' : tier === 'low' ? 'typing…' : 'online'),
      showTtsStatus: st.day === 3 && st.phase === 'clip' && st.ttsStatus !== 'idle' && st.ttsStatus !== 'ready',
      ttsStatusLabel: st.ttsStatus === 'loading'
        ? 'Preparing your voice clone… ' + st.ttsProgress + '%'
        : st.ttsStatus === 'cloning' ? 'Learning your voice…'
          : st.ttsStatus === 'generating' ? 'Generating the voice note…'
            : 'Voice clone unavailable — using the local fallback.',
      memberLine: st.tab === 'group'
        ? (st.day >= 3 ? this.name() + ', Hanna, Mia, Lea, Benito…'
                       : this.name() + ', Nicole, Hanna, Mia, Lea, Benito…') : '',
      tabGroupBg: st.tab === 'group' ? C.warmSoft : 'transparent',
      tabDmBg: st.tab === 'dm' ? C.warmSoft : 'transparent',
      samBar: (st.samDead ? 100 : Math.max(0, st.sam)) + '%', groupBar: st.group + '%', samGone: false,
      shotOpen: !!(st.shotOpen && (st.screen === 'phone' || st.screen === 'room')),
      shotIsFake: st.shotOpen === 'fake', shotIsReal: st.shotOpen === 'real',
      shotIsLeft: st.shotOpen === 'left',
      shotIsPhoto: st.shotOpen === 'photo',
      photoShotCaption: 'Sent by Hanna, ' + this.fmt(this.allDays()[2].start) + '. ' + this.allDays()[2].deskTitle,
      closeShot: () => this.setState({ shotOpen: null }),
      reportOpen: st.reportOpen,
      reportCancel: () => this.setState({ reportOpen: false }),
      reportNew: () => this.doReport('new'), reportOld: () => this.doReport('old'), reportBoth: () => this.doReport('both'),
       dmGhostTyping: st.tab === 'dm' && st.dmGhostTyping,
       chatTyping: (st.chatBusy && st.chatBusyTab === (st.tab === 'dm' ? 'dm' : 'group')) || (st.tab === 'dm' && st.dmGhostTyping),
      dmSilenceLine: st.tab === 'dm' && tier === 'gone'
        ? (st.day <= 4 ? 'She hasn' + "'" + 't opened this since Wednesday.' : 'Still nothing.') : '',
      samColor: st.samDead ? C.inkMuted : this.barStatusColor(st.sam), groupColor: this.barStatusColor(st.group),
      samOpacity: st.flashSam ? 1 : (st.samDead ? 0.55 : 0.9),
      tipSamOpen: st.tip === 'sam', tipGroupOpen: st.tip === 'group',
      tipOpen: st.tip !== null,
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
      deskLabel: d.deskLabel, deskTitle: this.evidenceDeskTitle(d), browserUrl: this.evidenceDeskUrl(d), deskHasPhoto: st.day === 2,
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
          'Most of what misleads people was never generated. It' + "'" + 's real footage with both ends cut off, or a real photo from a different day. Nothing on this page will catch that.'
        ] }
      ].map(g => ({ title: g.title, items: g.items.map((t, i) => ({ text: t, gap: i === 0 ? '16px' : '14px' })) })),
      segSearchWeight: st.tool === 'search' ? 600 : 400,
      segAiWeight: st.tool === 'ai' ? 600 : 400,
      onList: st.dev === 'gallery',
      onViewer: st.screen === 'phone' && st.dev === 'gallery' && st.mediaOpen !== null,
      playerCols: 'minmax(280px,420px) 1fr',
      media: mediaRows,
      galleryCells: (() => {
        const dayLabel = (dn) => dn === 0 ? 'SUNDAY' : (((all[dn] || {}).dayName || '').toUpperCase());
        const byDay = {};
        rows.forEach(r => { (byDay[r.day] = byDay[r.day] || []).push(r); });
        const out = [];
        Object.keys(byDay).map(Number).sort((a, b) => b - a).forEach(dn => {
          const items = byDay[dn];
          out.push({ isHeader: true, isTile: false, day: dayLabel(dn), count: items.length + (items.length === 1 ? ' item' : ' items') });
          items.slice().reverse().forEach(it => out.push(Object.assign({ isHeader: false, isTile: true }, it)));
        });
        return out;
      })(),
      gallerySections: (() => {
        const dayLabel = (dn) => dn === 0 ? 'SUNDAY' : (((all[dn] || {}).dayName || '').toUpperCase());
        const byDay = {};
        rows.forEach(r => { (byDay[r.day] = byDay[r.day] || []).push(r); });
        return Object.keys(byDay).map(Number).sort((a, b) => b - a).map(dn => ({
          day: dayLabel(dn),
          count: byDay[dn].length + (byDay[dn].length === 1 ? ' item' : ' items'),
          items: byDay[dn].slice().reverse()
        }));
      })(),
      openName: openRow.name, openMeta: openRow.meta, openSpec: openRow.spec,
      openCaption: viewingMedia ? (openRow.caption || '') : '',
      openIsShotFake: viewingMedia && openRow.kind === 'shot' && (openRow.name || '').indexOf('real') === -1,
      openIsShotReal: viewingMedia && openRow.kind === 'shot' && (openRow.name || '').indexOf('real') > -1,
      zoomScale: st.zoom ? 2.1 : 1,
      toggleZoom: () => this.setState(s => ({ zoom: !s.zoom })),
      waveBars: Array.from({ length: 28 }, (_, i) => ({ h: (16 + Math.abs(Math.sin(i * 1.7)) * 66).toFixed(0) + 'px' })),
      playOpen: () => this.playGalleryOpen(openRow),
      openAudioPlaying: viewingMedia && openRow.kind === 'audio'
        && st.playingAudioKey === this.galleryAudioKey(openRow) && !st.audioPaused,
      openAudioStopped: !(viewingMedia && openRow.kind === 'audio'
        && st.playingAudioKey === this.galleryAudioKey(openRow) && !st.audioPaused),
      vTouchStart: (e) => { const t = e.touches && e.touches[0]; if (t) this._vt = { x: t.clientX, y: t.clientY }; },
      vTouchEnd: (e) => {
        const t = e.changedTouches && e.changedTouches[0];
        if (!t || !this._vt) return;
        const dx = t.clientX - this._vt.x, dy = t.clientY - this._vt.y;
        this._vt = null;
        if (Math.abs(dy) > 70 && Math.abs(dy) > Math.abs(dx)) {
          if (dy > 0) { this.stopAudio(); this.setState({ mediaOpen: null }); }
          return;
        }
        if (Math.abs(dx) < 55) return;
        const cur = this.state.mediaOpen, next = dx < 0 ? cur + 1 : cur - 1;
        if (next < 0 || next >= rows.length) return;
        const seen = Object.assign({}, this.state.seen);
        const nextKey = rows[next] && rows[next].seenKey;
        if (nextKey) seen[nextKey] = true;
        this.stopAudio();
        this.setState({ mediaOpen: next, seen, zoom: false });
      },
      openIsVideo: viewingMedia && openRow.kind === 'video',
      openIsVideoShort: viewingMedia && openRow.kind === 'video' && !openRow.videoFull,
      openIsVideoFull: viewingMedia && openRow.kind === 'video' && !!openRow.videoFull,
      openIsImage: viewingMedia && openRow.kind === 'image' && !openRow.savedKind,
      openIsGarden: viewingMedia && openRow.savedKind === 'garden',
      openIsCraft: viewingMedia && openRow.savedKind === 'craft',
      openIsParty: viewingMedia && openRow.savedKind === 'party',
      toastOn: st.toast,
      feedImgOpen: !!st.feedImg,
      feedImgIsGarden: st.feedImg === 'garden', feedImgIsCraft: st.feedImg === 'craft', feedImgIsParty: st.feedImg === 'party',
      feedImgName: { garden: 'nicole_garden.jpg', craft: 'nicole_craft.jpg', party: 'nicole_party_repost.jpg' }[st.feedImg] || '',
      closeFeedImg: () => this.setState({ feedImg: null }),
      saveFeedImg: () => { if (st.feedImg) this.saveImage(st.feedImg); },
      openIsAudio: viewingMedia && openRow.kind === 'audio', openIsShot: viewingMedia && openRow.kind === 'shot',
      openChecks: [],
      openNoChecks: true,
      closeMedia: () => { this.stopAudio(); this.setState({ mediaOpen: null }); },
      archive: [
        { day: 1, kind: 'video', note: 'Forwarded by Hanna. 6 seconds.' },
        { day: 1, kind: 'video', name: 'IMG_4471_full.mp4', note: 'Sent by Mia. 22 seconds.', gate: !!st.d1VideoSent },
        { day: 2, kind: 'photo', thumb: true, note: 'Posted by Hanna.' },
        { day: 3, kind: 'shot', name: 'screenshot_2847.png', note: 'Sent by Hanna.' },
        { day: 4, kind: 'audio', name: clipName, note: st.voiceSent ? 'Sent to you by Nicole. ' + (st.cloneAudioDuration ? Math.round(st.cloneAudioDuration) : 4) + ' seconds.' : 'Sent to you by Nicole. A screenshot of something you typed.' },
        { day: 4, kind: 'audio', name: day4VoiceName, note: 'Forwarded by Hanna. 11 seconds.' }
      ].filter(a => a.day <= st.day && a.gate !== false).map(a => {
        const src = this.allDays()[a.day] || {};
        return {
          name: a.name || this.evidenceDeskTitle(src) || '', note: a.note, kind: a.kind,
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
         go: () => { if (n.key !== 'search' && n.key !== 'messages') this.setState({ socTab: n.key, socProfileKey: null, socPostId: null, socInfoOpen: false }); }
      })),
      socMine: socTab === 'profile' && !st.socProfileKey,
      myName: this.name(),
      myHandle: '@' + (this.name() || 'you').toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      socFeed: socTab === 'feed' && !st.socProfileKey && !st.socPostId,
      socEmpty: false,
      socProfile: !!st.socProfileKey && !st.socPostId,
      socPost: !!st.socPostId,
      feed: (() => {
        const visible = feedPosts.filter(p => !p.profileOnly);
        const todayCount = visible.filter(p => p.day === st.day).length;
        const rowsOut = visible.map(p => ({
          isRow: true, isDivider: false,
          name: p.name, handle: p.handle, ago: p.ago, text: p.text,
          hasText: !!p.text,
          likes: p.likes, replies: p.replies, avatar: p.avatar || p.img,
          hasPhoto: !!p.photo, isGarden: !!p.garden, isCraft: !!p.craft, dated: p.dated || '',
          unseen: p.day === st.day && !st.seen['soc:' + p.id],
          openGarden: () => { seePost(p.id); this.setState({ feedImg: 'garden' }); },
          openCraft: () => { seePost(p.id); this.setState({ feedImg: 'craft' }); },
          openParty: () => { seePost(p.id); this.setState({ feedImg: 'party' }); },
          tappable: p.handle === '@nicole_kruger' || p.handle === '@n.krueger',
          inert: !(p.handle === '@nicole_kruger' || p.handle === '@n.krueger'),
          cursor: (p.handle === '@nicole_kruger' || p.handle === '@n.krueger') ? 'pointer' : 'default',
          openProfile: () => {
            seePost(p.id);
            this.setState({ socProfileKey: p.handle, socPostId: null, socInfoOpen: false, socTab: 'feed' });
            if (p.handle === '@n.krueger') { this.setState({ sawFake: true }); this.maybeCompare('fake'); }
            if (p.handle === '@nicole_kruger' && !st.reported) { this.setState({ sawReal: true }); this.maybeCompare('real'); }
          },
          openPost: () => { seePost(p.id); this.setState({ socPostId: p.id, socProfileKey: null, socInfoOpen: false, socTab: 'feed' }); }
        }));
        if (todayCount > 0 && todayCount < rowsOut.length) {
          rowsOut.splice(todayCount, 0, { isRow: false, isDivider: true });
        }
        return rowsOut;
      })(),
      profDead: !!(prof && prof.dead), profLive: !!(prof && !prof.dead),
      profInfoOpen: !!st.socInfoOpen,
      openProfInfo: () => this.setState({ socInfoOpen: true, profMenuOpen: false, reportReasonOpen: false }),
      closeProfInfo: () => this.setState({ socInfoOpen: false }),
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
       profEmail: prof ? prof.email : '', profAccountAge: prof ? prof.accountAge : '',
       profPostList: prof ? feedPosts.filter(p => p.handle === prof.handle).map(p => ({
         id: p.id, text: p.text || '[photo]', ago: p.ago, likes: p.likes, replies: p.replies,
         hasPhoto: !!p.photo, isGarden: !!p.garden, isCraft: !!p.craft, dated: p.dated || '',
         openPost: () => this.setState({ socPostId: p.id, socInfoOpen: false }),
         openGarden: () => this.setState({ feedImg: 'garden' }),
         openCraft: () => this.setState({ feedImg: 'craft' }),
         openParty: () => this.setState({ feedImg: 'party' })
      })) : [],
      postName: openPost ? openPost.name : '', postHandle: openPost ? openPost.handle : '',
      postAgo: openPost ? openPost.ago : '', postText: openPost ? (openPost.text || '[photo]') : '',
      postAvatar: window.__R((openPost && (openPost.avatar || av(openPost.handle))) || 'assets/av-nicole.webp'),
      postHasPhoto: !!(openPost && (openPost.photo || openPost.garden || openPost.craft)), postDated: (openPost && openPost.dated) || '',
       postOpenProfile: () => { if (!openPost) return; this.setState({ socProfileKey: openPost.handle, socPostId: null, socInfoOpen: false, socTab: 'feed' }); if (openPost.handle === '@n.krueger') { this.setState({ sawFake: true }); this.maybeCompare('fake'); } if (openPost.handle === '@nicole_kruger' && !st.reported) { this.setState({ sawReal: true }); this.maybeCompare('real'); } },
      postIsGarden: !!(openPost && openPost.garden), postIsCraft: !!(openPost && openPost.craft), postIsParty: !!(openPost && openPost.photo),
      postOpenGarden: () => this.setState({ feedImg: 'garden' }), postOpenCraft: () => this.setState({ feedImg: 'craft' }), postOpenParty: () => this.setState({ feedImg: 'party' }),
      postLikes: openPost ? openPost.likes : 0,
      postReplyCount: openPost ? openPost.replies : 0,
      postReplies: (openPost && openPost.thread ? openPost.thread : []).map((r, i) => Object.assign({}, r, {
        name: nm(r.handle), avatar: r.avatar || av(r.handle),
        ago: ['4h', '3h', '2h'][i] || '1h', likes: [2, 1, 4, 3][i] || 1
      })),
       backToFeed: () => {
         if (this.state.socPostId) {
           this.setState({ socPostId: null, socInfoOpen: false });
           return;
         }
         this.setState({ socProfileKey: null, socPostId: null, socInfoOpen: false, socTab: 'feed' });
       },
      tabAiBg: st.tool === 'ai' ? C.accentSoft : 'transparent',
      aiDead: false, aiOp: 1,
      playerChecks, aiChecks,
      mediaLen: st.day === 1 ? '0:06' : st.day === 4 ? '0:11' : '—',
      scrubPct: (viewingMedia && openRow.kind === 'audio')
        ? (st.audioScrubPct || '0%')
        : (st.day === 1 || st.day === 4 ? '38%' : '0%'),
      scrubLabel: (viewingMedia && openRow.kind === 'audio')
        ? (st.audioScrubLabel || '0:00')
        : (st.day === 1 ? '0:06' : st.day === 4 ? '0:08' : '—'),
      dropBorder: st.dragItem ? C.accent : C.muted,
      dropBg: st.dragItem ? C.accentFaint : 'transparent',
      noPick: st.pickIdx === null, hasPick: st.pickIdx !== null,
      pickName: pickRow ? pickRow.name : '', pickMeta: pickRow ? pickRow.meta : '',
      pickIsImage: !!pickRow && pickRow.kind === 'image' && !pickRow.savedKind,
      pickIsGarden: !!pickRow && pickRow.savedKind === 'garden',
      pickIsCraft: !!pickRow && pickRow.savedKind === 'craft',
      pickIsParty: !!pickRow && pickRow.savedKind === 'party',
      searchIdle: !!pickRow && !st.searched[pickRow.name],
      pickIsVideo: !!pickRow && pickRow.kind === 'video' && !pickRow.videoFull,
      pickIsVideoFull: !!pickRow && pickRow.kind === 'video' && !!pickRow.videoFull,
      searchDone: !!pickRow && !!st.searched[pickRow.name],
      searchOp: pickRow && st.searched[pickRow.name] ? 0.45 : 1,
      searchHits: pickHits.map(h => ({
        source: h.source, date: h.date, quote: h.quote || '', hasQuote: !!h.quote,
        hasThumb: h.kind === 'image', isGardenHit: h.kind === 'garden', isCraftHit: h.kind === 'craft', isVideo: h.kind === 'video',
        open: () => {
          if (!h.goto) return;
          this._scrollToPost = h.goto;
           this.setState({ dev: 'social', tool: 'search', socTab: 'feed', socProfileKey: null, socPostId: h.goto, socInfoOpen: false, mediaOpen: null });
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
      aiPickIsImage: !!aiRow && aiRow.kind === 'image' && !aiRow.savedKind,
      aiPickIsShotFake: !!aiRow && aiRow.kind === 'shot' && (aiRow.name || '').indexOf('real') === -1,
      aiPickIsShotReal: !!aiRow && aiRow.kind === 'shot' && (aiRow.name || '').indexOf('real') > -1,
      aiPickIsGarden: !!aiRow && aiRow.savedKind === 'garden',
      aiPickIsCraft: !!aiRow && aiRow.savedKind === 'craft',
      aiPickIsParty: !!aiRow && aiRow.savedKind === 'party',
      aiPickIsVideo: !!aiRow && aiRow.kind === 'video' && !aiRow.videoFull,
      aiPickIsVideoFull: !!aiRow && aiRow.kind === 'video' && !!aiRow.videoFull,
      aiPickIsAudio: !!aiRow && aiRow.kind === 'audio',
      aiIdle: st.aiStage === 'idle' && !(aiRow && st.aiChecked[aiRow.name]),
      aiRunning: st.aiStage === 'running',
      aiResult: st.aiStage === 'done' || !!(aiRow && st.aiChecked[aiRow.name] && st.aiStage !== 'running'),
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
        if (!aiRow || st.aiStage === 'running' || st.aiChecked[aiRow.name]) return;
        this.setState({ aiStage: 'running', aiStep: 1 });
        clearTimeout(this._ai1); clearTimeout(this._ai2); clearTimeout(this._ai3);
        this._ai1 = setTimeout(() => this.setState({ aiStep: 2 }), 1000);
        this._ai2 = setTimeout(() => this.setState({ aiStep: 3 }), 2000);
        this._ai3 = setTimeout(() => {
          const aiChecked = Object.assign({}, this.state.aiChecked);
          aiChecked[aiRow.name] = true;
          this.setState({ aiStage: 'done', aiChecked });
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
          isPartyThumb: r.isPartyThumb,
          isVideoThumb: r.isVideoThumb, isVideoFullThumb: r.isVideoFullThumb,
          isShotFake: r.isShotFake, isShotReal: r.isShotReal,
          noThumb: r.noThumb, kindLabel: r.kindLabel,
          disabled: st.pickerMode === 'ai' ? false : !ok,
          op: (st.pickerMode === 'ai' || ok) ? 1 : 0.4,
          cursor: (st.pickerMode === 'ai' || ok) ? 'pointer' : 'default',
          hover: (st.pickerMode === 'ai' || ok) ? ('background:' + C.frame + ';') : '',
          right: st.pickerMode === 'ai'
            ? (st.aiChecked[r.name] ? 'checked' : '')
            : (ok ? (st.searched[r.name] ? 'searched' : '') : 'Images and video only'),
          disabledForMode: st.pickerMode === 'ai' ? false : !ok,
          choose: () => {
            if (this.state.pickerMode === 'ai') {
              const checked = !!this.state.aiChecked[r.name];
              this.setState({
                aiPickIdx: r.idx, pickerOpen: false,
                aiStage: checked ? 'done' : 'idle',
                aiStep: checked ? 3 : 0
              });
            } else if (ok) this.setState({ pickIdx: r.idx, pickerOpen: false });
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
        if (st.dragItem !== null) {
          const dropped = rows[st.dragItem];
          const checked = !!(dropped && st.aiChecked[dropped.name]);
          this.setState({
            aiPickIdx: st.dragItem, dragItem: null,
            aiStage: checked ? 'done' : 'idle',
            aiStep: checked ? 3 : 0
          });
        } else this.setState({ pickerOpen: true, pickerMode: 'ai' });
      },
      toolPlayer: () => this.setState({ tool: 'player', mediaOpen: null }),
      toolSearch: () => this.setState({ tool: 'search' }),
      toolAi: () => this.setState({ tool: 'ai' }),
       fading: st.fading,
       loading: !!st.loading, loadingLabel: st.loading || '', loadingPct: Math.min(100, st.loadingPct) + '%',
       writeInOpen: st.writeIn && st.threadOpen === 'group',
       chatComposerOpen: st.threadOpen !== null && !st.writeIn,
       chatDraft: (st.tab === 'dm' ? st.chatDmDraft : st.chatGroupDraft) || '',
       chatBusy: !!st.chatBusy,
       chatStatus: st.llmStatus || '',
       chatStatusOpen: !!st.llmStatus,
       chatPlaceholder: st.tab === 'dm' ? 'Message Nicole...' : 'Message the group...',
       chatBudgetLabel: st.tab === 'dm' ? ('DM messages left: ' + st.chatDmLeft) : ('Group messages left: ' + st.chatGroupLeft),
       chatSendLabel: st.chatBusy ? '...' : 'Send',
       chatSendDisabled: !!st.chatBusy || !((st.tab === 'dm' ? st.chatDmDraft : st.chatGroupDraft) || '').trim() || (st.tab === 'dm' ? st.chatDmLeft <= 0 || tier === 'gone' : st.chatGroupLeft <= 0),
       chatSendOpacity: (!!st.chatBusy || !((st.tab === 'dm' ? st.chatDmDraft : st.chatGroupDraft) || '').trim() || (st.tab === 'dm' ? st.chatDmLeft <= 0 || tier === 'gone' : st.chatGroupLeft <= 0)) ? 0.45 : 1,
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
           2: 'Example: “Wait — when was this even taken?”',
           3: st.phase === 'clip'
             ? 'Example: “I’m not talking in here tonight.”'
             : 'Example: “Has anyone checked which account is which?”',
           4: st.apology
             ? 'Example: “Should we forward her apology to the other groups?”'
             : 'Example: “Did anyone get this straight from her?”'
         };
         const ex = (st.tab === 'dm' ? dmEx : groupEx)[st.day];
         return ex || (st.tab === 'dm'
           ? 'Example: “Are you okay? I saw what they posted.”'
           : 'Example: “Has anyone actually checked if this is real?”');
       })(),
       tipChatTap: () => this.setState(s => ({ actionsOpen: !s.actionsOpen })),
       onChatDraft: (e) => {
         const value = (e && e.target && e.target.value || '').slice(0, 160);
         if (this.state.tab === 'dm') this.setState({ chatDmDraft: value });
         else this.setState({ chatGroupDraft: value });
       },
       onChatKey: (e) => { if (e && e.key === 'Enter' && !e.shiftKey) { e.preventDefault && e.preventDefault(); this.sendChatMessage(); } },
       sendChat: () => this.sendChatMessage(),
       writeText: st.writeText,
      onWrite: (e) => this.setState({ writeText: (e.target.value || '').slice(0, 400) }),
      sendWrite: () => this.sendWrite(),
      deleteWrite: () => {
        this.setState({ writeIn: false, writeStatus: 'deleted' });
        this.closePhone();
      },
      isStanding: st.screen === 'end' && this.normalizeEndStep(st.endStep, st) === 1,
      isWriteBack: st.screen === 'end' && this.normalizeEndStep(st.endStep, st) === 2,
      isVerdictReview: st.screen === 'end' && this.normalizeEndStep(st.endStep, st) === 3,
      writeBackHasText: st.writeStatus !== null && !!(st.writeText || '').trim(),
      writeBackText: (st.writeText || '').trim(),
      writeBackLine: st.writeStatus === 'sent' ? 'You wrote this, and you sent it.'
        : (st.writeStatus === 'deleted' && (st.writeText || '').trim()) ? 'You wrote this, and you deleted it.'
        : 'You didn' + "'" + 't write anything.',
      isLedger: st.screen === 'end' && this.normalizeEndStep(st.endStep, st) === 4,
      isOmissions: st.screen === 'end' && this.normalizeEndStep(st.endStep, st) === 5,
      isMoves: st.screen === 'end' && this.normalizeEndStep(st.endStep, st) === 6,
      isTruthVideo: st.screen === 'end' && this.normalizeEndStep(st.endStep, st) === 7 && this.showsEndingTruthVideo(st),
      isLastCard: st.screen === 'end' && this.normalizeEndStep(st.endStep, st) === 8,
      isEndScreen: st.screen === 'end',
      showEndBack: st.screen === 'end' && this.normalizeEndStep(st.endStep, st) > 1,
      alwaysTrue: true,
      nextSection: () => this.advanceEndingSection(1),
      prevSection: () => this.advanceEndingSection(-1),
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
      endingVerdictRows: this.endingVerdictRows(st),
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
      endCardImage: endCard.image || 'assets/ending_default.webp',
      endCardCaptionMod: (endCard.text || '').length <= 42 ? 'is-short' : '',
      replayShown: st.replayShown,
      playReal: () => this.playRealVoice('debug-real'), playSplice: () => this.playBuf('splice'),
      recOpen: st.recOpen, recIntro: st.recPhase === 'intro', recFailed: st.recPhase === 'failed',
      recBlocked: st.recPhase === 'blocked', recFramed: st.recPhase === 'framed',
      recTrying: st.recTrying, recTryOp: st.recTrying ? 0.6 : 1,
      recAskLabel: st.recTrying ? 'Asking…' : 'Use my microphone',
      recRetryLabel: st.recTrying ? 'Asking…' : 'Try again',
      reloadPage: () => window.location.reload(),
      openInTab: () => window.open(window.location.href, '_blank'),
      recLine: st.recPhase === 'record' ? this.REC_LINES[st.recIdx] : '',
      recProgress: 'Line ' + (st.recIdx + 1) + ' of ' + this.REC_LINES.length,
      recBtnLabel: st.recBusy ? 'stop' : 'record',
      recBtnBg: st.recBusy ? C.accent : C.accent,
      recRecording: st.recBusy,
      recLevel: (st.recBusy ? st.recLevel : 0) + '%',
      recAllow: () => this.recAllow(), recToggle: () => this.recToggle(),
      recDecline: () => this.skipRecording(),
      skipRecording: () => this.skipRecording(),
      start: () => this.beginExperience('start'),
      hasSave: !!savedGame,
      savePlayerName: this.savedPlayerName(savedGame),
      savePlayerAvatar: this.savedPlayerAvatar(savedGame),
      saveProgressLabel: this.describeSave(savedGame),
      continueGame: () => this.beginExperience('continue'),
      startOver: () => this.beginExperience('startOver'),
      showTitleCast: st.screen === 'title',
      titleLpMod: [
        st.screen === 'title' ? 'is-title' : 'is-play',
        st.titleLeaving ? 'is-leaving' : ''
      ].filter(Boolean).join(' '),
      titleLeadParts: this.titleLeadParts(st.titleLeadShown),
      titleCaretOn: st.screen === 'title' && !st.titleLeaving,
      openEndingsGallery: () => this.openEndingsGallery(),
      closeEndingsGallery: () => this.closeEndingsGallery(),
      endingsGalleryOpen: !!st.endingsGalleryOpen,
      endingsGalleryMod: st.endingsGalleryClosing ? 'is-closing' : '',
      endingsUnlockedCount: Object.keys(st.unlockedEndings || {}).length,
      endingsTotalCount: this.endingDefs().length,
      hasUnlockedEnding: Object.keys(st.unlockedEndings || {}).length > 0,
      endingGalleryRows: this.endingDefs().map(def => {
        const unlocked = !!(st.unlockedEndings && st.unlockedEndings[def.id]);
        return {
          id: def.id,
          title: unlocked ? def.title : '???',
          body: unlocked ? def.text : 'Keep playing to unlock this ending.',
          // Locked endings always use the placeholder — unique art is a spoiler.
          image: unlocked
            ? (def.image || 'assets/ending_default.webp')
            : 'assets/ending_default.webp',
          unlocked,
          locked: !unlocked,
          cardMod: unlocked ? 'is-unlocked' : 'is-locked',
          opacity: unlocked ? 1 : 0.55
        };
      }),
      notebookOpen: !!st.notebookOpen,
      notebookAnimClass: st.notebookAnim ? 'is-opening' : '',
      notebookBookClass: notebookShowShelf ? 'is-shelf' : '',
      notebookDateDay: this.taskDayLabel(st.notebookDayKey),
      notebookSleepMode: st.notebookMode === 'sleep',
      notebookShowShelf,
      notebookShowIntro,
      notebookShowMap,
      notebookShowDay,
      notebookShowReflection,
      notebookVerdictEditable,
      notebookVerdictReadonly,
      notebookHasTabs: notebookShowDay && notebookTabs.length > 1,
      notebookTabs,
      notebookShelfBooks: this.notebookShelfBooks(),
      notebookMilCells: this.notebookMilCells(),
      relationMap,
      rmapNodes: relationMap.nodes,
      rmapEdges: relationMap.edges,
      rmapNotes: relationMap.notes,
      rmapLegend: relationMap.legend,
      rmapHasFocus: relationMap.hasFocus,
      rmapNoFocus: relationMap.noFocus,
      rmapFocusName: relationMap.focusName,
      rmapFocusFacts: relationMap.focusFacts,
      rmapFocusEmpty: relationMap.focusEmpty,
      rmapHint: relationMap.hint,
      notebookShowLead: st.notebookMode !== 'sleep',
      notebookLeadText: (() => {
        if (notebookShowReflection && this.isPastDiaryKey(st, st.notebookDayKey)) {
          if (st.notebookDayKey === 3) return 'Looking back at that morning.';
          return 'Looking back at that night.';
        }
        if (st.day === 3 && st.phase === 'morning') {
          return 'Things I still need to look into before I go.';
        }
        return 'Things I still need to look into before I sleep.';
      })(),
      notebookRows: this.notebookRows(st, st.notebookDayKey),
      notebookGot,
      nbSetReal: () => this.setVerdict(st.notebookDayKey, 'real'),
      nbSetFake: () => this.setVerdict(st.notebookDayKey, 'fake'),
      nbSetContext: () => this.setVerdict(st.notebookDayKey, 'context'),
      nbRealClass: notebookFills.nbRealClass,
      nbFakeClass: notebookFills.nbFakeClass,
      nbContextClass: notebookFills.nbContextClass,
      closeNotebook: () => this.closeNotebook(),
      openNotebook: () => this.openNotebookManual(),
      hintsOpen: !!st.hintsOpen,
      hintsRows: this.hintsRows(st),
      hintAvailable: this.hintAvailable(st),
      openHints: () => this.openHints(),
      closeHints: () => this.closeHints(),
      notebookContinueLabel: st.notebookMode === 'sleep'
        ? (st.day === 4 ? 'Continue' : 'Next day')
        : (notebookShowShelf ? 'Close' : 'Back'),
      notebookContinueDisabled: notebookContinueBlocked,
      notebookContinueOp: notebookContinueBlocked ? 0.45 : 1,
      isNameEntry: st.screen === 'name',
      isAvatarEntry: st.screen === 'avatar',
      nameDraft: st.nameDraft, nameRef: this.nameRef,
      onNameChange: (e) => this.setState({ nameDraft: e.target.value.replace(/[^A-Za-z \-']/g, '').slice(0, 16) }),
      onNameKey: (e) => { if (e.key === 'Enter') this.confirmName(); },
      confirmName: () => this.confirmName(),
      submitAvatar: () => this.submitAvatar(),
      pickFemale: () => this.setState({ playerAvatar: 'female' }),
      pickMale: () => this.setState({ playerAvatar: 'male' }),
      noAvatar: !st.playerAvatar, enterOp: st.playerAvatar ? 1 : 0.45,
      femaleRing: st.playerAvatar === 'female' ? '0 0 0 3px ' + C.accent : 'none',
      maleRing: st.playerAvatar === 'male' ? '0 0 0 3px ' + C.accent : 'none',
      femaleLift: st.playerAvatar === 'female' ? '-2px' : '0px',
      maleLift: st.playerAvatar === 'male' ? '-2px' : '0px',
      femaleAvSize: st.playerAvatar === 'female' ? '136px' : '112px',
      maleAvSize: st.playerAvatar === 'male' ? '136px' : '112px',
      femaleAvRadius: st.playerAvatar === 'female' ? '68px' : '56px',
      maleAvRadius: st.playerAvatar === 'male' ? '68px' : '56px',
      meIsFemale: st.playerAvatar !== 'male', meIsMale: st.playerAvatar === 'male',
      isHowTo: st.screen === 'howto', leaveHowTo: () => this.leaveHowTo(),
      skipIntro: () => this.skipIntro(),
      isIntroText: st.screen === 'introtext', introReady: st.introReady,
      advanceIntro: () => this.advanceIntro(),
      isIntroChat: st.screen === 'introchat',
      isDayCard: st.screen === 'daycard',
      dayCardKicker: 'Day ' + (st.pendingDay || 1),
      dayCardDay: st.cardDayName || '',
      dayCardWhen: String(st.cardWhen || '').replace(/(am|pm)$/i, ' $1'),
      dayCardMarks: (() => {
        const n = st.pendingDay || 1;
        const isWedMorning = n === 3 && st.cardPhase !== 'clip';
        const isWedNight = n === 3 && st.cardPhase === 'clip';
        // Fill through: Mon 1, Tue 2, Wed night 3, Thu 4. Wed morning = half on 3rd.
        const filledThrough = n <= 1 ? 0 : n === 2 ? 1 : isWedNight ? 2 : n >= 4 ? 3 : -1;
        return [0, 1, 2, 3, 4].map(i => {
          let mod = 'is-future';
          if (isWedMorning) {
            if (i < 2) mod = 'is-past';
            else if (i === 2) mod = 'is-half';
          } else if (i < filledThrough) {
            mod = 'is-past';
          } else if (i === filledThrough) {
            mod = 'is-current';
          }
          return { id: i, mod };
        });
      })(),
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
        radius: m.mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        isPlaying: m.kind === 'voice' && st.playingAudioKey === ('intro:' + i),
        togglePlay: () => this.toggleChatAudio('intro:' + i, m)
      })),
      barsShown: st.day >= 1 ? 1 : 0,

      openPhone: () => {
        this.openPhone({ dev: null, threadOpen: null });
        if (tier === 'gone' && !st.ghostTypedToday) {
          this.setState({ ghostTypedToday: true });
          setTimeout(() => this.setState({ dmGhostTyping: true }), 1400);
          setTimeout(() => this.setState({ dmGhostTyping: false }), 4400);
        }
      },
      backToTitle: () => {
        // Capture ending progress before leaving — title screens skip auto-save.
        this.saveGame();
        clearTimeout(this._phoneClose);
        this.setState({
          screen: 'title',
          phoneClosing: false,
          titleLeaving: false,
          titleLeadShown: '',
          titleLeadDone: false,
          confirmSleep: false,
          mediaOpen: null,
          shotOpen: null,
          feedImg: null,
          reportOpen: false,
          pickerOpen: false,
          truthVideoPlaying: false,
          dev: null,
          threadOpen: null
        });
      },

      backToRoom: () => this.closePhone(),
      phoneEdgeSwipeStart: (e) => {
        const t = e && e.touches && e.touches[0];
        if (t) {
          this._phoneEdgeSwipe = { x: t.clientX, y: t.clientY };
          return;
        }
        if (e && e.button != null && e.button !== 0) return;
        if (e && e.clientX == null) return;
        this._phoneEdgeSwipe = { x: e.clientX, y: e.clientY };
        if (this._phoneEdgeMouseUp) {
          window.removeEventListener('mouseup', this._phoneEdgeMouseUp);
        }
        this._phoneEdgeMouseUp = (ev) => {
          window.removeEventListener('mouseup', this._phoneEdgeMouseUp);
          this._phoneEdgeMouseUp = null;
          const start = this._phoneEdgeSwipe;
          this._phoneEdgeSwipe = null;
          if (!start || !ev) return;
          const dx = ev.clientX - start.x;
          const dy = ev.clientY - start.y;
          if (dy > 72 && dy > Math.abs(dx) * 1.2) this.closePhone();
        };
        window.addEventListener('mouseup', this._phoneEdgeMouseUp);
      },
      phoneEdgeSwipeEnd: (e) => {
        const start = this._phoneEdgeSwipe;
        this._phoneEdgeSwipe = null;
        const t = e && e.changedTouches && e.changedTouches[0];
        if (!start || !t) return;
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (dy > 72 && dy > Math.abs(dx) * 1.2) this.closePhone();
      },
      tabGroup: () => this.setState({ tab: 'group', actionsOpen: false, openedGroup: true }),
      tabDm: () => this.setState({ tab: 'dm', actionsOpen: false }),
      flipPhoto: () => this.setState({ photoUp: !st.photoUp }),
      askSleep: (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        const s0 = this.state;
        if (s0.day === 4 && s0.writeStatus === null) {
          this.setPhase('finalMessage');
          this.openPhone({
            dev: 'chats',
            threadOpen: 'group',
            writeIn: true,
            min: 23 * 60 + 20,
            unread: 0
          });
          return;
        }
        console.log('[bed] confirm on day ' + s0.day + ', writeStatus=' + s0.writeStatus);
        this.setState({ confirmSleep: true });
      },
      cancelSleep: () => this.setState({ confirmSleep: false }),
      doSleep: () => this.endDay(),
      restart: () => {
        const meta = this.readMeta();
        this.clearSavedGame();
        // Keep chat LLM cache + in-memory model across Replay (same as Start over).
        this.setState(this.freshGameState({
          screen: 'title',
          unlockedEndings: meta.unlockedEndings || {}
        }), () => {
          if (this.LLM_CHAT_ENABLED) this.ensureLlm(false);
        });
      }
    };
  }
});
