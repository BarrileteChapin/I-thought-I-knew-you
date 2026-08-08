window.GameMethods = Object.assign(window.GameMethods || {}, {
  // Shared signals for ledger + finalCard (matches docs/ending-rules.html).
  endingSignals(st, s) {
    const chat = Object.assign({
      dm: 0, group: 0, questioning: 0, pile_on: 0, supportive: 0, neutral: 0
    }, (s.chat || {}));
    const checks = (s.sift.investigate || 0) + (s.sift.coverage || 0) + (s.sift.trace || 0);
    const dmCount = Math.max(s.dmAnswered || 0, chat.dm || 0);
    const publiclySupported = !st.samDead
      && chat.pile_on <= chat.supportive
      && (chat.supportive > 0 || (st.final && st.final.post === 'support')
        || (st.writeStatus === 'sent'
          && [1, 2, 3, 4, 5].filter(n => st.certainty[n] === 'confirmed').length >= 2));
    return {
      chat, checks, dmCount, publiclySupported,
      nicoleHigh: !st.samDead && st.sam >= 50,
      groupOk: st.group >= 35
    };
  },

  ledger(st, s) {
    const posts = st.postsWith + st.postsWithout;
    const { chat, checks, dmCount, publiclySupported } = this.endingSignals(st, s);
    const chances = Math.max(st.dmChances || 0, dmCount);
    const toneBits = [];
    if (chat.supportive) toneBits.push(chat.supportive + ' supportive');
    if (chat.questioning) toneBits.push(chat.questioning + ' questioning');
    if (chat.pile_on) toneBits.push(chat.pile_on + ' piling on');
    if (chat.neutral) toneBits.push(chat.neutral + ' other');
    return [
      { label: 'Fact-checks', value: checks === 0 ? 'none'
        : checks + (checks === 1 ? ' check' : ' checks')
          + (checks >= 4 ? ' — enough to know' : checks >= 2 ? ' — some of the picture' : '') },
      { label: 'Answered Nicole', value: dmCount === 0 ? 'never'
        : dmCount + ' of ' + chances + (chances === 1 ? ' chance' : ' chances') },
      { label: 'In the chats', value: toneBits.length ? toneBits.join(', ') : 'never typed' },
      { label: 'Spoke up in the group', value: posts === 0 ? 'never'
        : posts + (posts === 1 ? ' time — ' : ' times — ') + st.postsWith + ' with proof, ' + st.postsWithout + ' without' },
      { label: 'Stood with her in public', value: publiclySupported ? 'yes' : 'no' },
      { label: 'Reported the fake account', value: st.reportedFake ? 'yes' : 'no' },
      { label: 'Reported her real account', value: st.reportedWrong ? 'yes' : 'no' }
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

  endingCards() {
    const img = 'assets/ending_default.webp';
    return [
      { text: 'You waited for the truth. Then you spoke it aloud. She heard you twice.', image: img },
      { text: 'You told the truth to the room. The room grew quieter around you.', image: img },
      { text: 'You were the only one who knew. And you kept it between the two of you.', image: img },
      { text: 'A few words in the dark. None in the light.', image: img },
      { text: 'You found the crack in their story. You let them keep telling it.', image: img },
      { text: 'I thought I knew you, ' + this.name() + '.', image: img }
    ];
  },

  finalCard(st, s) {
    const cards = this.endingCards();
    const { checks, dmCount, publiclySupported, nicoleHigh, groupOk } = this.endingSignals(st, s);

    // 1 — investigated, stood up in public, kept Nicole, class still mostly ok
    if (checks >= 4 && publiclySupported && nicoleHigh && groupOk) return cards[0];
    // 2 — investigated, stood up in public, kept Nicole, but the class cooled on you
    if (checks >= 4 && publiclySupported && nicoleHigh) return cards[1];
    // 3 — investigated enough, stayed private: lots of DMs, Nicole still trusts you
    if (checks >= 2 && !publiclySupported && dmCount >= 3 && nicoleHigh) return cards[2];
    // 4 — investigated enough, some private contact, little public courage
    if (checks >= 2 && !publiclySupported && dmCount >= 1) return cards[3];
    // 5 — investigated, but did not turn that into care (public or private)
    if (checks >= 2) return cards[4];
    // 6 — else / little investigation
    return cards[5];
  }
});
