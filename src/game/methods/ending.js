window.GameMethods = Object.assign(window.GameMethods || {}, {
  ledger(st, s) {
    const mins = n => n + (n === 1 ? ' minute' : ' minutes');
    const posts = st.postsWith + st.postsWithout;
    return [
      { label: 'Forwarded', value: s.forwards + (s.forwards === 1 ? ' thing' : ' things') },
      { label: 'Reacted', value: s.reacts + (s.reacts === 1 ? ' time' : ' times') },
      { label: 'Posted in the group', value: posts === 0 ? 'never'
        : posts + (posts === 1 ? ' time — ' : ' times — ') + st.postsWith + ' with proof, ' + st.postsWithout + ' without' },
      { label: 'Answered Nicole', value: s.dmAnswered + ' of ' + Math.max(s.dmAnswered, 4) + ' times' },
      { label: 'Reported her real account', value: st.reportedWrong ? 'yes' : 'no' },
      { label: 'Reported the fake account', value: st.reportedFake ? 'yes' : 'no' },
      { label: 'Fastest reaction', value: s.fastest === null ? '—' : s.fastest + (s.fastest === 1 ? ' second' : ' seconds') },
      { label: 'Time spent checking', value: mins(st.minCheck) },
      { label: 'Time spent reacting', value: mins(st.minReact) }
    ];
  },

  omissions(st) {
    const out = [];
    const D = st.done;
    if (!D.d1rev && !D.d2rev && !D.d3rev && !D.d4cmp) out.push({ text: 'You never looked for the original of anything. Originals existed.' });
    if (!D.d1mia && !D.d5where) out.push({ text: 'You never asked anyone who was there.' });
    if (!D.d3side) out.push({ text: 'You never compared the account to her real one. It was still up.' });
    if (!st.reportedWrong && !st.reportedFake) out.push({ text: 'You never reported either account. Both were reportable all week.' });
    if (!D.d5listen && !D.d4slow) out.push({ text: 'You never listened to the voice message twice.' });
    if (!out.length) out.push({ text: 'You checked all five. That' + "'" + 's rarer than it should be.' });
    return out;
  },

  doReport(which) {
    const wrong = which !== 'new';
    this.setState(s => ({
      reportOpen: false, reportChoice: which, reportedWrong: s.reportedWrong || wrong,
      actedToday: true, ignored: false,
      chat: s.chat.concat([{ who: 'You', mine: true, text: which === 'both' ? 'reported both' : which === 'new' ? 'reported the new one' : 'reported the old one' }])
    }));
    this.advance(2);
    this.rel(wrong ? -14 : 8, wrong ? 4 : -2, wrong ? '— you reported her real account' : '— you reported the fake');
  },

  maybeCompare(which) {
    const st = this.state;
    const sawFake = which === 'fake' || st.sawFake;
    const sawReal = which === 'real' || st.sawReal;
    if (sawFake && sawReal && st.day === 3 && !st.done.d3compare) {
      const done = Object.assign({}, st.done); done.d3compare = true;
      this.setState({ done });
      this.bumpHint(3, 'hint', 'd3compare');
    }
  },

  enterEnding() {
    this.setPhase('ending');
    const s = this.state;
    const t = s.samDead ? 'locked' : s.sam < 35 ? 'low' : 'high';
    console.log('[ending] entering, tier=' + t);
    clearTimeout(this._e1); clearTimeout(this._e2); clearTimeout(this._e3);
    this.setState({ screen: 'end', endStep: 1, confirmSleep: false, writeIn: false,
      dmCloseReady: t !== 'high', dmCloseTyping: t === 'high', dmCloseExtra: null });
    if (t === 'high') {
      this._e1 = setTimeout(() => this.setState({ dmCloseTyping: false }), 2600);
      this._e2 = setTimeout(() => this.setState({ dmCloseTyping: true }), 3400);
      this._e3 = setTimeout(() => this.setState({ dmCloseTyping: false, dmCloseReady: true,
        dmCloseExtra: { text: 'i saw what you posted. thank you.' } }), 6200);
    }
  },

  setPhase(p) {
    if (this.state.gamePhase === p) return;
    console.log('[gamePhase] ' + this.state.gamePhase + ' → ' + p + ' (day ' + this.state.day + ')');
    this.setState({ gamePhase: p });
  },

  sendWrite() {
    const st = this.state;
    const txt = (st.writeText || '').trim();
    if (!txt) { this.setState({ writeIn: false, writeStatus: 'deleted', screen: 'room', dev: null, threadOpen: null }); return; }
    const confirmed = [1, 2, 3, 4, 5].filter(n => st.certainty[n] === 'confirmed').length;
    let replies, dGroup;
    if (st.credibilityLost) {
      replies = [{ who: 'Hanna', text: 'you' + "'" + 've said a lot of things this week' }];
      dGroup = -8;
    } else if (confirmed >= 2) {
      replies = [
        { who: 'Lea', text: 'finally' },
        { who: 'Lea', text: 'i thought that too all week' },
        { who: 'Hanna', text: '...ok wait' },
        { who: 'Mia', text: 'sure' }
      ];
      dGroup = 10;
    } else {
      replies = [{ who: 'Mia', text: 'ok??' }];
      dGroup = -4;
    }
    this.setState(s => ({
      writeIn: false, writeStatus: 'sent', actedToday: true, ignored: false,
      chat: s.chat.concat([{ who: 'You', mine: true, text: txt }])
    }));
    this.log('— you wrote something and sent it');
    this.rel(0, dGroup, dGroup > 0 ? '— you showed proof' : '— you said it without proof');
    replies.forEach((r, i) => {
      setTimeout(() => this.setState(s => ({ chat: s.chat.concat([r]) })), 900 + i * 1100);
    });
    setTimeout(() => this.setState({ screen: 'room', dev: null, threadOpen: null }), 900 + replies.length * 1100 + 900);
  },

  moves(s) {
    const w = n => n === 0 ? 'never' : n === 1 ? 'once' : n === 2 ? 'twice' : 'most times';
    return [
      { label: 'Stopped before reacting', value: w(s.stopped) },
      { label: 'Looked at who was posting', value: w(s.sift.investigate) },
      { label: 'Asked someone who was there', value: w(s.sift.coverage) },
      { label: 'Found the original', value: w(s.sift.trace) }
    ];
  },

  finalCard(st, s) {
    const checks = s.sift.investigate + s.sift.coverage + s.sift.trace;
    // Swap these paths when per-result art is ready.
    const img1 = 'assets/nicole_sad_bg.webp';
    const img2 = 'assets/nicole_sad_bg.webp';
    const img3 = 'assets/nicole_sad_bg.webp';
    const img4 = 'assets/nicole_sad_bg.webp';
    const img5 = 'assets/nicole_sad_bg.webp';
    if (st.final.post === 'support' && checks >= 3) {
      return { text: 'She checked it. She learned that from you.', image: img1 };
    }
    if (checks >= 4 && st.group < 40) {
      return { text: 'Being right isn' + "'" + 't a resource. Being reliably right is.', image: img2 };
    }
    if (checks >= 2 && st.final.post !== 'support' && s.dmAnswered > 0) {
      return { text: 'You knew by Tuesday. It changed nothing.', image: img3 };
    }
    if (s.dmAnswered > 0 && st.final.post !== 'support') {
      return { text: 'She knew. Nobody else did.', image: img4 };
    }
    return { text: 'I thought I knew you, ' + this.name() + '.', image: img5 };
  }
});
