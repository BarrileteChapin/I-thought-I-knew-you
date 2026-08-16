window.GameMethods = Object.assign(window.GameMethods || {}, {
  // TEMP debug: inject the Day-3 “account unavailable” screenshot into group chat.
  // Flip to false when done looking. Safe to call repeatedly (no duplicate).
  FORCE_DEBUG_UNAVAILABLE_SHOT: false,

  UNAVAILABLE_SHOT_MSG: {
    who: 'Hanna', kind: 'shot', shot: 'left', caption: 'Screenshot — account gone.'
  },

  debugInjectUnavailableShot() {
    if (!this.FORCE_DEBUG_UNAVAILABLE_SHOT) return;
    this.setState(s => {
      if ((s.chat || []).some(m => m.kind === 'shot' && m.shot === 'left')) return {};
      return {
        chat: (s.chat || []).concat([Object.assign({}, this.UNAVAILABLE_SHOT_MSG)])
      };
    });
  },

  spend(kind, cost) { this.setState(s => ({ minCheck: s.minCheck + (kind === 'check' ? cost : 0), minReact: s.minReact + (kind === 'react' ? cost : 0) })); },

  advance(cost) {
    // Flash while away from chats, but don't invent badge counts — those follow lastRead.
    const away = this.state.screen === 'phone' && this.state.dev !== 'chats';
    if (away) {
      this.setState({ chatFlash: true });
      clearTimeout(this._cf);
      this._cf = setTimeout(() => this.setState({ chatFlash: false }), 900);
    }
    this.setState(s => {
      const tick = s.shareTick + cost;
      const per = 10 * (s.shareHalved ? 2 : 1) / (s.group >= 70 ? 1.5 : 1);
      const gained = Math.floor(tick / per);
      return {
        min: s.min + cost,
        shareTick: tick - gained * per,
        sharedCount: s.sharedCount + gained
      };
    }, () => this.scripted());
  },

  log(reason) {
    if (!reason) return;
    this.setState(s => ({ actionLog: s.actionLog.concat([{ day: s.day, min: s.min, reason: reason }]) }));
  },

  share(n) { this.setState(s => ({ sharedCount: s.sharedCount + n })); },

  saveImage(kind) {
    const meta = {
      garden: { name: 'nicole_garden.jpg', from: '@n.krueger' },
      craft: { name: 'nicole_craft.jpg', from: '@n.krueger' },
      party: { name: 'nicole_party_repost.jpg', from: '@nicole_kruger' }
    }[kind];
    if (!meta || this.state.saved.some(s => s.name === meta.name)) return;
    this.setState(s => ({ saved: s.saved.concat([{ kind, name: meta.name, from: meta.from, day: s.day }]), toast: true, galleryNew: true }));
    clearTimeout(this._toast);
    this._toast = setTimeout(() => this.setState({ toast: false }), 1600);
    this.advance(1);
  },

  markGalleryNew() { this.setState({ galleryNew: true }); },

  scripted() {
    const s = this.state;
    if (s.day === 3 && s.phase === 'morning' && !s.reported && s.min >= 8 * 60 + 10) {
      this.setState({
        reported: true,
        chat: s.chat.concat(this.allDays()[3].fake === false ? [
          { who: 'Hanna', text: 'reported. 30 of us. it\'s gone' },
          { who: 'Lea', text: 'she won\'t be able to say anything now' },
          { who: 'Mia', text: 'that was the point wasn\'t it' },
          Object.assign({}, this.UNAVAILABLE_SHOT_MSG)
        ] : [
          { who: 'Hanna', text: s.reportedWrong ? 'reported. 30 of us, ' + this.name() + ' too. it\'s gone' : 'reported. 30 of us. it\'s gone' },
          { who: 'Lea', text: 'guys that was her real one' },
          { who: 'Mia', text: 'wait' },
          Object.assign({}, this.UNAVAILABLE_SHOT_MSG),
          { who: 'Hanna', text: 'the other account is still posting though' }
        ])
      });
    }
    if (s.day === 4 && !s.apology && s.min >= 16 * 60 + 55) {
      this.setState({
        apology: true,
        chat: s.chat.concat([
          { who: 'Hanna', kind: 'voice', dur: '0:31', caption: 'Nicole\'s voice, flat: “I did say it. I\'m sorry. I\'ll leave everyone alone.”' },
          { who: 'Hanna', text: 'she admitted it' },
          { who: 'Mia', text: 'told you' }
        ])
      });
    }
  },

  bumpHint(dayKey, effect, id) {
    if (effect === 'none') return;
    this.setState(st => {
      const hints = Object.assign({}, st.hints);
      const cert = Object.assign({}, st.certainty);
      if (effect === 'confirm') cert[dayKey] = 'confirmed';
      else {
        if (hints[dayKey].indexOf(id) === -1) hints[dayKey] = hints[dayKey].concat([id]);
        if (cert[dayKey] !== 'confirmed') cert[dayKey] = hints[dayKey].length >= 2 ? 'confirmed' : 'hint';
      }
      return { hints, certainty: cert };
    });
  },

  runCheck(c) {
    const st = this.state;
    if (st.done[c.id]) return;
    const stats = JSON.parse(JSON.stringify(st.stats));
    stats.checks++;
    if (c.sift) stats.sift[c.sift]++;
    if (!st.reactedToday) stats.stopped++;
    this.setState({ stats, loading: c.label, loadingPct: 0 });
    let p = 0;
    const step = () => {
      p += 8 + Math.random() * 14;
      if (p >= 100) {
        const done = Object.assign({}, this.state.done); done[c.id] = true;
        this.setState({ loading: null, loadingPct: 0, done });
        this.bumpHint(c.item || this.state.day, c.effect, c.id);
        this.advance(c.cost);
        this.spend('check', c.cost);
        this.log('— you checked it yourself');
        this.setState({ actedToday: true, ignored: false });
      } else { this.setState({ loadingPct: p }); setTimeout(step, 90 + Math.random() * 90); }
    };
    setTimeout(step, 140);
  },

  reactTiming() {
    const st = this.state;
    if (st.reactedToday) return {};
    const secs = (Date.now() - st.arrival) / 1000;
    const stats = JSON.parse(JSON.stringify(st.stats));
    if (secs < 5) stats.fast++;
    const w = Math.round(secs);
    if (stats.fastest === null || w < stats.fastest) stats.fastest = w;
    return { reactedToday: true, stats };
  },

  samReply(text) {
    const tier = this.samTier();
    if (tier === 'gone') return null;
    if (this.state.sam < 30) return { who: 'Nicole', text: text.split('.')[0].split(',')[0], late: true };
    return { who: 'Nicole', text: text };
  },

  pushSamReply(reply) {
    if (!reply) return;
    if (reply.late) {
      this.setState(s => ({ min: s.min + 60 }));
      setTimeout(() => {
        this.setState(
          s => ({ dm: s.dm.concat([{ who: 'Nicole', text: reply.text, generated: !!reply.generated }]) }),
          () => this.applyIncomingReply('dm')
        );
      }, 900);
      return null;
    }
    return reply;
  },

  doAction(a) {
    const st = this.state, d = this.day(), cert = st.certainty[st.day];
    const patch = this.reactTiming();
    const stats = patch.stats || JSON.parse(JSON.stringify(st.stats));
    let chat = st.chat.slice(), dm = st.dm.slice();
    const used = Object.assign({}, st.used); used[a.id] = true;
    let credibility = st.credibility, dSam = 0, dGroup = 0;

    let cost = 1, reason = null, credLost = st.credibilityLost, halve = st.shareHalved;
    const dismissive = { who: 'Hanna', text: 'you said that last time too lol' };

    if (a.id === 'forward') {
      stats.forwards++; if (d.fake) stats.believed++;
      cost = 2; dSam = -15; dGroup = 8; this.share(4); reason = '— you forwarded it';
      chat = chat.concat([{ who: 'You', mine: true, text: 'forwarded' }, { who: 'Hanna', text: 'good, spread it' }]);
    } else if (a.id === 'react') {
      stats.reacts++; if (d.fake) stats.believed++;
      cost = 1; dSam = -8; dGroup = 4; this.share(1); reason = '— you reacted to it';
      chat = chat.concat([{ who: 'You', mine: true, text: '💀' }]);
    } else if (a.id === 'askchecked') {
      cost = 3; dGroup = -5; dSam = 6; reason = '— you questioned it in public';
      this.setState(s => ({ postsWithout: s.postsWithout + 1 }));
      chat = chat.concat([{ who: 'You', mine: true, text: 'has anyone actually checked this?' }, { who: 'Hanna', text: 'checked WHAT it\'s right there' }]);
      if (credLost) chat = chat.concat([dismissive]);
    } else if (a.id === 'callfake') {
      cost = 3;
      if (cert === 'confirmed') {
        dGroup = 10; dSam = 12; halve = true; reason = '— you showed proof';
        this.setState(s => ({ postsWith: s.postsWith + 1 }));
        chat = chat.concat([
          { who: 'You', mine: true, text: 'this is fake and I can show you why' },
          { who: 'Lea', text: 'ok that actually makes sense' },
          { who: 'Mia', text: 'whatever' }
        ]);
        if (credLost) chat = chat.concat([dismissive]);
        if (!d.fake) stats.dismissed++;
      } else {
        credibility = -1; credLost = true; dGroup = -12; reason = '— you said it without proof';
        this.setState(s => ({ postsWithout: s.postsWithout + 1 }));
        chat = chat.concat([
          { who: 'You', mine: true, text: 'that\'s fake' },
          { who: 'Hanna', text: 'source?' },
          { who: 'Mia', text: 'ok so you just decided that' }
        ]);
        if (!d.fake) stats.dismissed++;
      }
    } else if (a.id === 'defend') {
      cost = 3; dSam = 12; dGroup = -10; reason = '— you spoke up for her';
      this.setState(s => ({ postsWith: s.postsWith + (cert === 'confirmed' ? 1 : 0), postsWithout: s.postsWithout + (cert === 'confirmed' ? 0 : 1) }));
      chat = chat.concat([{ who: 'You', mine: true, text: 'this isn\'t okay. leave her alone.' }, { who: 'Lea', text: 'agree tbh' }, { who: 'Mia', text: 'lol' }]);
      if (credLost) chat = chat.concat([dismissive]);
    } else if (a.dmOpt) {
      const o = a.dmOpt;
      cost = 3; reason = o.reason;
      const gone = this.samTier() === 'gone';
      if (!gone) stats.dmAnswered++;
      dm = dm.concat([{ who: 'You', mine: true, text: o.say, unsent: gone }]);
      if (!gone) {
        const r = this.pushSamReply(this.samReply(o.reply));
        if (r) dm = dm.concat([r]);
        dSam = o.sam;
      }
      this.setState({ dmAnsweredToday: true });
    } else if (a.id === 'openfake') {
      cost = 2;
      this.setState({ shotOpen: 'profile' });
      setTimeout(() => this.bumpHint(3, 'hint', 'openfake'), 0);
    } else if (a.id === 'openreal') {
      cost = 2;
      chat = chat.concat([{ who: 'System', sys: true, text: '@nicole_kruger · joined 2022 · 412 posts · last post Monday' }]);
      setTimeout(() => this.bumpHint(3, 'hint', 'openreal'), 0);
    } else if (a.id === 'reportmenu') {
      this.setState({ reportOpen: true });
      return;
    } else if (a.id === 'askwhich') {
      cost = 3; dGroup = -5; dSam = 6; reason = '— you questioned it in public';
      this.setState(s => ({ postsWithout: s.postsWithout + 1 }));
      chat = chat.concat([{ who: 'You', mine: true, text: 'has anyone checked which is which?' }, { who: 'Hanna', text: 'they' + "'" + 're both hers' }]);
    } else if (a.id === 'postfake') {
      cost = 3;
      if (cert === 'confirmed') {
        dGroup = 10; dSam = 12; reason = '— you showed proof';
        this.setState(s => ({ postsWith: s.postsWith + 1 }));
        chat = chat.concat([
          { who: 'You', mine: true, text: 'the new one is fake, her real one is still up' },
          { who: 'Lea', text: 'thank you. that' + "'" + 's what i said' },
          { who: 'Mia', text: 'whatever' }
        ]);
      } else {
        credibility = -1; dGroup = -12; reason = '— you said it without proof';
        this.setState(s => ({ postsWithout: s.postsWithout + 1, credibilityLost: true }));
        chat = chat.concat([
          { who: 'You', mine: true, text: 'the new one is fake, her real one is still up' },
          { who: 'Hanna', text: 'source?' },
          { who: 'Mia', text: 'you haven' + "'" + 't even looked at it' }
        ]);
      }
    } else if (a.id === 'sendvoice') {
      this.openPhone();
      this.openRecorder();
      return;
    } else if (a.id === 'sharesorry') {
      stats.forwards++; stats.believed++; dSam = -15; dGroup = 10; cost = 2; reason = '— you forwarded the apology';
      chat = chat.concat([{ who: 'You', mine: true, text: 'forwarded the apology' }, { who: 'Hanna', text: 'sending to the year group' }]);
      this.setState(s => ({ sharedCount: s.sharedCount + 5 }));
    } else if (a.id === 'leavesorry') {
      dSam = 8; dGroup = -6; cost = 3; reason = '— you called the apology fake';
      chat = chat.concat([{ who: 'You', mine: true, text: 'that voice note is wrong too' }, { who: 'Lea', text: 'how do you know' }]);
    }

    const pc = a.check;
    if (pc) {
      const done = Object.assign({}, st.done); done[pc.id] = true;
      if (pc.sift) stats.sift[pc.sift]++;
      stats.checks++;
      if (!st.reactedToday) stats.stopped++;
      if (pc.thread === 'dm') stats.dmAnswered++;
      const who = pc.result.split(':')[0];
      const body = pc.result.split(': ').slice(1).join(': ');
      const said = { who: 'You', mine: true, text: pc.say || pc.label };
      if (pc.thread === 'dm') {
        const r = this.samReply(body);
        dm = dm.concat([said].concat(r ? [r] : []));
      } else {
        chat = chat.concat([said, { who: who, text: body }]);
        if (pc.id === 'd1mia') {
          chat = chat.concat([{ who: 'Mia', kind: 'video', full: true, caption: 'hold on. Here is the full video' }]);
        }
      }
      this.setState({ done });
      setTimeout(() => { this.bumpHint(pc.item || this.state.day, pc.effect, pc.id); this.advance(pc.cost); this.log('— you asked around'); }, 0);
      const lastRead = Object.assign({}, st.lastRead);
      if (st.dev === 'chats' && st.threadOpen === 'group') lastRead.group = chat.length;
      if (st.dev === 'chats' && st.threadOpen === 'dm') lastRead.dm = dm.length;
      this.setState(Object.assign({}, patch, {
        stats, chat, dm, used, credibility, actedToday: true, ignored: false, lastRead,
        dmAnsweredToday: pc.thread === 'dm' ? true : st.dmAnsweredToday
      }, this.chatUnreadPatch(chat, dm, lastRead)));
      return;
    }

    if (st.group < 35 && dGroup < 0) {
      chat = chat.concat([this.PUSHBACK[st.pushIdx % this.PUSHBACK.length]]);
      this.setState(s => ({ pushIdx: s.pushIdx + 1 }));
    }
    this.advance(cost);
    this.spend('react', cost);
    const lastRead = Object.assign({}, st.lastRead);
    if (st.dev === 'chats' && st.threadOpen === 'group') lastRead.group = chat.length;
    if (st.dev === 'chats' && st.threadOpen === 'dm') lastRead.dm = dm.length;
    this.setState(Object.assign({}, patch, {
      stats, chat, dm, used, credibility, credibilityLost: credLost, shareHalved: halve,
      actedToday: true, ignored: false, lastRead
    }, this.chatUnreadPatch(chat, dm, lastRead)));
    if (st.day === 2 && ['askchecked','callfake','defend','forward','react'].indexOf(a.id) > -1) this.setState({ postedWed: true });
    this.log(reason);
    if (dSam || dGroup) this.rel(dSam, dGroup, reason);
  }
});
