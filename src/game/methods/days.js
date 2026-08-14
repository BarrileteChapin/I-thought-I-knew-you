window.GameMethods = Object.assign(window.GameMethods || {}, {
  endDay() {
    const st = this.state;
    let dSam = 0, dGroup = 0;
    const hadDm = this.samTier() !== 'gone' && st.dm.some(m => !m.mine && !m.sys && m.today);
    let endReason = null;
    if (hadDm && !st.dmAnsweredToday) { dSam -= 18; this.log('— you left her waiting'); }
    if (!st.actedToday) { dSam -= 10; dGroup -= 10; this.share(8); this.log('— you did nothing'); }
    else if (st.openedGroup && st.ignored) { dSam -= 5; dGroup -= 5; this.log('— you scrolled past'); }
    this.setState({ confirmSleep: false, fading: true, notebookOpen: false, pendingAfterNotebook: false });
    this.rel(dSam, dGroup, endReason);
    setTimeout(() => {
      if (this.state.sam < 16) this.setState({ samDead: true, samSilent: true, sam: 0 });
      this.openNotebookAfterSleep();
    }, 700);
    setTimeout(() => this.setState({ fading: false }), 1600);
  },

  showDayCard(n, phase) {
    this.stopAudio();
    this.setState({ fading: false, continueResumeScreen: null });
    const ph = phase || (n === 3 ? 'morning' : 'evening');
    this.setState(Object.assign({ screen: 'daycard' }, this.dayCardViewFor(n, ph)));
    clearTimeout(this._dc);
    this._dc = setTimeout(() => this.startDay(n, ph), 1600);
  },

  startDay(n, phase) {
    this.stopAudio();
    const ph = phase || (n === 3 ? 'morning' : 'evening');
    const d = (n === 3 && ph === 'clip') ? this.DAY_YOU : this.allDays()[n];
    const st = this.state;
    const quietPhase = (n === 3 && ph === 'clip');
    const banner = d.dayName;
    let chat = quietPhase ? st.chat.slice()
      : (n === 1 ? this.P_LOG.filter(m => !m.rec || st.voiceSent).concat([{ who: 'System', sys: true, text: banner }])
        : st.chat.concat([{ who: 'System', sys: true, text: banner }])).concat(d.chat);
    let dm = (n === 1 ? this.DM_HISTORY.slice() : st.dm.slice().map(m => Object.assign({}, m, { today: false })))
      .concat(d.dm.map(m => Object.assign({}, m, { today: true })));
    let shared = n === 1 ? 3 : st.sharedCount + Math.round((ph === 'clip' && n === 3 ? 3 : (st.group >= 70 ? 9 : 6)) * (st.group >= 70 ? 1.5 : 1));
    if (n > 1 && st.group < 35 && !quietPhase) {
      chat = chat.concat([this.PUSHBACK[st.pushIdx % this.PUSHBACK.length]]);
    }
    if (n === 4) {
      chat = [
        st.voiceSent
          ? { who: 'Hanna', kind: 'voice', dur: '0:14', audio: 'splice', caption: 'Your voice: “Nicole' + String.fromCharCode(39) + 's — no I haven' + String.fromCharCode(39) + 't — with her, like always”' }
          : { who: 'Hanna', kind: 'typedshot', caption: 'A screenshot headed “{name}”, of what you typed on Sunday, cropped one line early.' },
        { who: 'Hanna', text: st.postsWith + st.postsWithout > 0 ? 'of course {name} would defend her' : 'from someone who was supposedly on her side' }
      ].concat(chat);
    }
    if (n > 1 && st.group >= 70 && !quietPhase) {
      dm = dm.concat([{ who: 'Hanna', text: 'sending you this first before it goes round' }]);
    }
    if (n > 1 && !quietPhase && st.sam >= 70 && d.volunteer && this.samTier() !== 'gone') {
      dm = dm.concat([{ who: 'Nicole', text: d.volunteer }]);
      this.setState(s => ({ dmChances: s.dmChances + 1 }));
      setTimeout(() => this.bumpHint(n, 'hint', 'vol' + n), 0);
    }
    const baseGroup = n === 1 ? this.P_LOG.filter(m => !m.rec || st.voiceSent).length + 1 : st.chat.length + 1;
    const newGroup = Math.max(0, chat.length - baseGroup);
    const newDm = dm.filter(m => m.today && !m.mine && !m.sys).length;
    this.setState({
      screen: 'room', day: n, phase: ph, min: d.start, chat, dm,
      clipBack: (n === 3 && ph === 'clip') ? true : st.clipBack,
      unread: quietPhase ? newDm : newGroup + newDm,
      groupUnread: quietPhase ? 0 : newGroup,
      tab: quietPhase ? 'dm' : 'group', used: {}, reactedToday: false,
      lastRead: { group: baseGroup, dm: st.dm.length },
      newMarkAt: null, showNewPill: false,
      actedToday: false, openedGroup: false, ignored: false, dmAnsweredToday: false, phoneOpenedToday: false, phoneClosing: false, playingAudioKey: null,
      shareTick: 0, shareHalved: false, tool: 'player', socTab: 'feed', socProfileKey: null, socPostId: null, socInfoOpen: false, mediaOpen: null, seen: {}, zoom: false, dev: null, threadOpen: null, galleryNew: false, chatFlash: false,
      writeIn: false, writeText: '', writeStatus: null, chatDraft: '', chatBusy: false, actionsOpen: false, chatGroupLeft: 5, chatDmLeft: 5,
      dragItem: null, pickIdx: null, pickerOpen: false, pickerMode: 'search', searched: {}, aiPickIdx: null, aiStage: 'idle', aiStep: 0,
      dmGhostTyping: false, ghostTypedToday: false, onReadCharged: false,
      shotOpen: null, sawFake: false, sawReal: false, reportOpen: false,
      arrival: Date.now(), confirmSleep: false, sharedCount: shared, reason: '',
      pushIdx: st.pushIdx + (st.group < 35 ? 1 : 0),
      msgToast: null, msgToastVisible: false, socToast: null, socToastVisible: false, cameraPush: false,
      hintsOpen: false,
      dayEnter: true
    }, () => {
      requestAnimationFrame(() => this.setState({ dayEnter: false }));
      this.runDayArrival(d.chat, d.dm);
      if (n === 3 && ph === 'clip') this.generateDay3Voice();
      if (n !== st.day) this.runSocialArrival(n);
    });
  }
});
