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
    const fake = which === 'new' || which === 'both';
    this.setState(s => ({
      reportOpen: false, reportChoice: which,
      reportedWrong: s.reportedWrong || wrong,
      reportedFake: s.reportedFake || fake,
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
    const endingId = this.finalCardId(s, s.stats || {});
    console.log('[ending] entering, tier=' + t + ', ending=' + endingId);
    this.unlockEnding(endingId);
    clearTimeout(this._e1); clearTimeout(this._e2); clearTimeout(this._e3);
    this.setState({ screen: 'end', endStep: 1, confirmSleep: false, writeIn: false,
      notebookOpen: false, pendingAfterNotebook: false, endingId,
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
    const counts = [
      s.stopped || 0,
      (s.sift && s.sift.investigate) || 0,
      (s.sift && s.sift.coverage) || 0,
      (s.sift && s.sift.trace) || 0
    ];
    return this.notebookMilCells().map((cell, i) => Object.assign({}, cell, {
      value: w(counts[i])
    }));
  },

  endingDefs() {
    const fallback = 'assets/ending_default.webp';
    const name = this.name ? this.name() : 'Alex';
    return [
      { id: 'spoke-aloud', title: 'Spoke it aloud', text: 'You waited for the truth. Then you spoke it aloud. She heard you twice.', image: fallback },
      { id: 'told-the-room', title: 'Told the room', text: 'You told the truth to the room. The room grew quieter around you.', image: 'assets/ending_2.webp' },
      { id: 'kept-private', title: 'Kept it private', text: 'You were the only one who knew. And you kept it between the two of you.', image: 'assets/ending_3.webp' },
      { id: 'words-in-dark', title: 'Words in the dark', text: 'A few words in the dark. None in the light.', image: 'assets/ending_4.webp' },
      { id: 'let-them-tell', title: 'Let them keep telling it', text: 'You found the crack in their story. You let them keep telling it.', image: 'assets/ending_5.webp' },
      { id: 'thought-i-knew', title: 'I thought I knew you', text: 'I thought I knew you, ' + name + '.', image: fallback }
    ];
  },

  endingCards() {
    return this.endingDefs();
  },

  // Diary-task stand-in for the old "checks >= 2" gate.
  diaryTasksSome(st) {
    return this.taskScore(st).done >= 2;
  },

  finalCardId(st, s) {
    const { dmCount, publiclySupported, nicoleHigh, groupOk } = this.endingSignals(st, s);
    const allTasks = this.tasksAllComplete(st);
    const someTasks = this.diaryTasksSome(st);
    // spoke-aloud absorbs former "perfect" (all diary tasks) + top social path.
    if (allTasks && publiclySupported && nicoleHigh && groupOk) return 'spoke-aloud';
    if (allTasks && publiclySupported && nicoleHigh) return 'told-the-room';
    if (allTasks) return 'spoke-aloud';
    if (someTasks && !publiclySupported && dmCount >= 3 && nicoleHigh) return 'kept-private';
    if (someTasks && !publiclySupported && dmCount >= 1) return 'words-in-dark';
    if (someTasks) return 'let-them-tell';
    return 'thought-i-knew';
  },

  finalCard(st, s) {
    const id = st.endingId || this.finalCardId(st, s);
    const defs = this.endingDefs();
    return defs.find(c => c.id === id) || defs[defs.length - 1];
  },

  // Spoke-aloud only: insert a truth-video beat before the polaroid card.
  END_STEP_TRUTH_VIDEO: 7,
  END_STEP_LAST_CARD: 8,

  showsEndingTruthVideo(st) {
    const s = st || this.state;
    const id = s.endingId || this.finalCardId(s, s.stats || {});
    return id === 'spoke-aloud';
  },

  advanceEndingSection(delta) {
    let n = this.state.endStep + delta;
    if (n === this.END_STEP_TRUTH_VIDEO && !this.showsEndingTruthVideo()) n += delta;
    n = Math.max(1, n);
    console.log('[endingScreen] ' + this.state.endStep + ' → ' + n);
    this.setState({ endStep: n });
    if (n === this.END_STEP_LAST_CARD) {
      this.setState({ replayShown: false });
      setTimeout(() => this.setState({ replayShown: true }), 3000);
    }
  }
});
