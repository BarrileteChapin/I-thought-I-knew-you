window.GameMethods = Object.assign(window.GameMethods || {}, {
  setLlmStatus(message) {
    const text = String(message || '');
    if (text) console.log('[chat-llm] ' + text);
    this.setState({ llmStatus: text });
  },

  chatContextSection(publicOnly) {
    const source = String((window.GameData && window.GameData.chatContext) || '');
    let heading = null;
    const clipNight = this.state.day === 3 && this.state.phase === 'clip';
    if (clipNight) {
      if (publicOnly) {
        heading = /(^|\n)#\s*3\.[^\n]*\(clip\)[^\n]*\(public\)/i.exec(source);
      }
      if (!heading) heading = /(^|\n)#\s*3\.[^\n]*\(clip\)/i.exec(source);
    }
    if (!heading && publicOnly) {
      heading = new RegExp('(^|\\n)#\\s*' + this.state.day + '\\.[^\\n]*\\(public\\)', 'i').exec(source);
    }
    if (!heading) heading = new RegExp('(^|\\n)#\\s*' + this.state.day + '\\.', 'i').exec(source);
    if (!heading) return source.replace(/\s+/g, ' ').trim().slice(0, 700);
    const start = heading.index;
    const next = source.indexOf('\n# ', start + heading[0].length);
    return source.slice(start, next < 0 ? source.length : next).replace(/\s+/g, ' ').trim().slice(0, 700);
  },

  // Day-3 evening after the clone DM is not the fake-account beat.
  chatTopicKey() {
    if (this.state.day === 3 && this.state.phase === 'clip') return 'clip';
    return this.state.day;
  },

  chatRecentContext(tab) {
    const list = tab === 'dm' ? this.state.dm : this.state.chat;
    return list.filter(m => !m.sys).slice(-7, -1).map(m => {
      const text = (m.text || m.caption || '').replace(/\s+/g, ' ').trim().split('{name}').join(this.name());
      return text ? m.who + ': ' + text : '';
    }).filter(Boolean).join(' | ').slice(-600);
  },

  chatTone(text) {
    const t = String(text || '').toLowerCase();
    if (/\b(don'?t|dont|never|can'?t|cant|stop)\s+(trust|believe)/.test(t)) return 'pile_on';
    if (/\b(check|checked|source|maybe|could|cut|whole|posted|last summer|last july|one year|six fingers|bot|clean|audio|room|breath|which is which|actually checked|original|compare|proof|evidence)\b/.test(t)) return 'questioning';
    if (/\b(support|believe|believed|trust|innocent|sorry|defend|leave her alone|not okay|are you (ok|okay|alright)|i believe|with you|on your side|isn'?t okay|isnt okay)\b/.test(t)) return 'supportive';
    if (/\b(pathetic|liar|deserve|cancel|shame|exposed|caught|no shame)\b/.test(t)) return 'pile_on';
    if (/\b(fake|real)\b/.test(t) && /\b(she|her|nicole)\b/.test(t) && !/\b(not|isn'?t|isnt|account)\b/.test(t)) return 'pile_on';
    return 'neutral';
  },

  // Tally free-text chat for ending / ledger (replaces preset option outcomes).
  recordChatBehaviour(tab, text) {
    const tone = this.chatTone(text);
    const cert = this.state.certainty[this.state.day];
    this.setState(s => {
      const stats = JSON.parse(JSON.stringify(s.stats || {}));
      const chat = Object.assign({
        dm: 0, group: 0, questioning: 0, pile_on: 0, supportive: 0, neutral: 0
      }, stats.chat || {});
      if (tab === 'dm') {
        chat.dm += 1;
        stats.dmAnswered = (stats.dmAnswered || 0) + 1;
      } else {
        chat.group += 1;
      }
      chat[tone] = (chat[tone] || 0) + 1;
      stats.chat = chat;

      const patch = { stats };
      if (tab === 'group' && (tone === 'supportive' || tone === 'pile_on')) {
        if (cert === 'confirmed') patch.postsWith = (s.postsWith || 0) + 1;
        else {
          patch.postsWithout = (s.postsWithout || 0) + 1;
          if (tone === 'supportive') patch.credibilityLost = true;
        }
      }
      if (tab === 'group' && tone === 'supportive') {
        patch.final = Object.assign({}, s.final, { post: 'support' });
      }
      return patch;
    });

    if (tab === 'dm') {
      if (tone === 'supportive') this.rel(8, 0, '— you stood with her');
      else if (tone === 'pile_on') this.rel(-10, 0, '— you turned on her');
      else if (tone === 'questioning') this.rel(5, 0, '— you asked her');
      else this.rel(3, 0, '— you answered her');
    } else if (tone === 'supportive') {
      if (cert === 'confirmed') this.rel(4, -3, '— you backed her with proof');
      else this.rel(2, -8, '— you said it without proof');
    } else if (tone === 'pile_on') {
      this.rel(-8, 6, '— you joined in');
    } else if (tone === 'questioning') {
      this.rel(2, -2, '— you questioned it');
    }
    return tone;
  },

  chatFocus(text) {
    return {
      questioning: 'question the evidence without deciding too quickly',
      pile_on: 'react to the accusation and defend the group position',
      supportive: 'push back on the group and support Nicole',
      neutral: 'respond naturally to the player without inventing a new fact'
    }[this.chatTone(text)];
  },

  chatExample(who) {
    return {
      Nicole: { player: 'everyone thinks it was you', reply: 'please listen to me, that is not what happened' },
      Mia: { player: 'that proves she did it', reply: 'wait, did anyone actually check the original' },
      Hanna: { player: 'maybe we should ask her first', reply: 'why are you defending her again' },
      Lea: { player: 'we should slow down', reply: 'then show us what actually proves it' }
    }[who] || { player: 'this looks strange', reply: 'what are we actually looking at' };
  },

  chatReplyWho(tab, text) {
    if (tab === 'dm') return 'Nicole';
    const named = /\b(hanna|lea|mia|benito)\b/i.exec(String(text || ''));
    if (named) return named[1][0].toUpperCase() + named[1].slice(1);
    const tone = this.chatTone(text);
    if (tone === 'questioning') return 'Mia';
    if (tone === 'pile_on') return 'Hanna';
    if (tone === 'supportive') return 'Lea';
    const pool = ['Mia', 'Hanna', 'Lea'];
    return pool[(this.state.llmReplySeed || 0) % pool.length];
  },

  // Cheap video-topic pre-filter (day 1 follow-ups after the check is done).
  d1VideoTopic(text) {
    const t = String(text || '').toLowerCase();
    return /(video|clip|the full|full video|whole thing|see (the|it|more)|show (me|us|the|it)|send|share|more of|(is there|any) more|what (actually )?happened|prove it|longer|original)/.test(t);
  },

  // Ask the local model whether the player wants the full Day-1 video.
  // Falls back to keywords when the model is not ready or fails.
  async d1VideoIntent(text) {
    if (!this._llmReady || !this._wllama) return this.d1VideoRequest(text);
    const line = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    try {
      const result = await this._wllama.createChatCompletion({
        messages: [
          { role: 'system', content: 'You are deciding if one message in a teen class group chat asks to see the full video of Nicole at the party. The full video shows what really happened: Nicole was repeating what someone else said. Answer with exactly one word: yes or no. Yes means the player wants the video, the clip, or more of what happened in it. No means the message only asks something else, like who was at the party.' },
          { role: 'user', content: 'Recent chat: ' + (this.chatRecentContext('group') || 'none') + '. Message to judge: "' + line + '"' }
        ],
        max_tokens: 4,
        temperature: 0,
        top_k: 40,
        top_p: 0.9,
        penalty_repeat: 1,
        seed: 0,
        stop: ['\n']
      });
      const out = String(this.extractChatText(result) || '').toLowerCase();
      if (/\byes\b/.test(out)) return true;
      if (/\bno\b/.test(out)) return false;
    } catch (e) {
      console.warn('[chat-llm] video intent failed; using keyword fallback', e);
    }
    return this.d1VideoRequest(text);
  },

  sendD1Video() {
    this.setState(s => ({ d1VideoSent: true }));
    setTimeout(() => {
      this.setState(
        s => ({ chat: s.chat.concat([{ who: 'Mia', kind: 'video', full: true, caption: 'hold on. Here is the full video' }]) }),
        () => this.applyIncomingReply('group')
      );
    }, 900);
  },

  chatVoice(who) {
    return {
      Nicole: 'personal, worried, direct, lowercase, and like a real fifteen-year-old texting quickly',
      Hanna: 'certain, dismissive, anti-Nicole, lowercase, and quick to pile on',
      Lea: 'skeptical and blunt, usually against Nicole, but less confident than Hanna',
      Mia: 'uncertain and curious; ask what was actually checked and allow doubt',
      Benito: 'very brief and evasive; he knows more than he says and avoids answering'
    }[who] || 'casual, lowercase teen group-chat language';
  },

  chatPromptMessages(who, playerText, tab, seed) {
    const day = this.day();
    const context = this.chatContextSection(tab !== 'dm');
    const recent = this.chatRecentContext(tab) || 'No earlier messages in this thread.';
    const line = String(playerText || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    const seedLine = String(seed || '').replace(/\s+/g, ' ').trim().slice(0, 100);
    const focus = this.chatFocus(playerText);
    const example = this.chatExample(who);
    const privateRule = tab === 'dm'
      ? 'This is a private message to Nicole. Answer the exact player message in first person. Do not greet, welcome, or give vague reassurance. The player can only send text — never ask them to send a photo, video, clip, or voice note.'
      : 'This is the class group chat. Reply as one participant, not as a narrator. The player can only send text — never ask them to send a photo, video, clip, or voice note.';
    const nicoleState = who === 'Nicole'
      ? ({
          high: 'Nicole trusts the player and is open but worried.',
          ok: 'Nicole is guarded and brief.',
          low: 'Nicole is hurt, distant, and curt.'
        })[this.samTier()] || ''
      : '';
    const clipNight = this.state.day === 3 && this.state.phase === 'clip';
    const topicLine = clipNight
      ? 'Topic tonight: Nicole DMed a voice note that sounds like the player. Stay on that voice note — not the fake account from earlier today.'
      : ('Topic today: ' + (day.name || day.deskTitle) + '. Stay on this topic.');
    const system = [
      'You are ' + who + ' in a realistic teen chat.',
      'Day ' + this.state.day + ': ' + (day.dayName || day.name || day.deskTitle || 'the current rumor') + '.',
      topicLine,
      'Voice: ' + this.chatVoice(who) + '.',
      privateRule,
      nicoleState,
      'Use only these facts. Do not invent events or reveal everything at once.',
      'Reply directly to the player. Never narrate the player, the conversation, or the scene.',
      'Never say "the player", "the user", "the voice", "the conversation", or "as if".',
      'Do not answer with only agreement. Write one natural lowercase message, maximum 14 words.',
      'Day facts: ' + context,
      'Recent: ' + recent
    ].filter(Boolean).join(' ');
    return [
      { role: 'system', content: system },
      { role: 'user', content: 'Player said: "' + example.player + '"\nFocus: ' + this.chatFocus(example.player) + '\nWrite a new reply as ' + who + '.' },
      { role: 'assistant', content: example.reply },
      { role: 'user', content: [
        'Player said: "' + line + '"',
        'Focus: ' + focus + '.',
        'Rewrite this idea in your own words, changing at least half the words, and use the recent chat above as context (do not repeat it): "' + seedLine + '"',
        'Write a NEW direct reply as ' + who + '. Do not repeat the player and do not copy the idea verbatim.'
      ].join('\n') }
    ];
  },

  extractChatText(result) {
    if (!result) return '';
    if (typeof result === 'string') return result;
    const choice = result.choices && result.choices[0];
    if (!choice) return '';
    if (choice.message && choice.message.content != null) return String(choice.message.content);
    if (choice.text != null) return String(choice.text);
    return '';
  },

  cleanChatText(text, who) {
    let value = String(text || '');
    const cut = value.search(/<\|im_end\|>|<\|im_start\|>|\n###/i);
    if (cut > 0) value = value.slice(0, cut);
    value = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)[0] || value;
    value = value.replace(/^(Nicole|Hanna|Lea|Mia|Benito|assistant|system)\s*[:,]\s*/i, '');
    value = value.replace(/["`]/g, '').replace(/\s+/g, ' ').trim();
    const stop = value.search(/[.!?](?:\s|$)/);
    if (stop > 6 && stop < 140) value = value.slice(0, stop + 1);
    value = value.toLowerCase().slice(0, 140);
    if (value.length === 140) {
      const lastSpace = value.lastIndexOf(' ');
      if (lastSpace > 0) value = value.slice(0, lastSpace);
    }
    return value;
  },

  chatReplyReason(text, playerText, who, seed) {
    const value = String(text || '').trim();
    if (!value || value.length < 4 || value.length > 140) return 'length';
    if (/\b(as an ai|language model|cannot assist|dear user|system message)\b/i.test(value)) return 'assistant language';
    if (/\b(the player|the user|players|player's|the conversation|the scene|the message|the voice|as if|we can see|this suggests)\b/i.test(value)) return 'narration';
    if (this.wordCount(value) > 18) return 'too long';
    if (this.wordCount(value) < 3) return 'too short';
    const a = value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const b = String(playerText || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (a === b || (a.length > 10 && (a.indexOf(b) > -1 || b.indexOf(a) > -1))) return 'echo';
    const aWords = a.split(' ').filter(Boolean);
    const bSet = new Set(b.split(' ').filter(Boolean));
    let run = 0;
    let maxRun = 0;
    let runMaxLen = 0;
    let maxRunMaxLen = 0;
    for (const w of aWords) {
      if (bSet.has(w)) {
        run++;
        if (w.length > runMaxLen) runMaxLen = w.length;
        if (run > maxRun) { maxRun = run; maxRunMaxLen = runMaxLen; }
      } else {
        run = 0;
        runMaxLen = 0;
      }
    }
    if (maxRun >= 4 || (maxRun === 3 && maxRunMaxLen >= 5)) return 'echo';
    if (/^(i agree|agree|okay|ok|sure|yes|no|exactly|fair|right|same|lol|idk|meh|whatever|k|haha|lmfao)$/i.test(a)) return 'generic';
    const seedNorm = String(seed || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (seed && a === seedNorm) return 'same as seed';
    if (/\b(i'?ve realized|straightforward and clear|a clear indication|the first sentence|in conclusion|the statement shows|as a response to)\b/i.test(value)) return 'abstract';
    if (who === 'Nicole') {
      if (/\b(glad you could join|welcome|nice to meet|good to see|join us|its just me|it's just me|dont worry|don't worry)\b/i.test(value)) return 'vague Nicole';
      if (!/\b(but|because|check|proof|prove|clip|video|photo|picture|account|voice|audio|room|party|said|happened|not|did|was|is|think|know|evidence|whole|original|listen|believe)\b/i.test(value)) return 'vague Nicole';
    }
    const history = (this.state.llmUsedReplies || []).slice();
    if (this.chatReplyIsRepeated(value, history)) return 'repeated';
    if ((who === 'Hanna' || who === 'Lea') && /\b(she'?s innocent|she is innocent|believe her|support her|not her fault)\b/i.test(value)) return 'wrong stance';
    if (who === 'Mia' && /\b(obviously|definitely|no question|everyone knows)\b/i.test(value)) return 'too certain for Mia';
    const dayWords = {
      1: 'video|clip|cut|whole|party|said|record|check|source',
      2: 'photo|picture|party|summer|posted|date|birthday',
      3: 'account|photo|picture|fake|real|bot|finger|writing',
      clip: 'voice|audio|record|sunday|said|sound|note|mine|clone|fake|listen',
      4: 'voice|audio|room|breath|clean|record|sound|pause'
    }[this.chatTopicKey()] || 'check|proof|source';
    if (this.wordCount(value) <= 5 && !new RegExp('\\b(' + dayWords + ')\\b', 'i').test(value) && !/[?]/.test(value)) return 'off-topic';
    return '';
  },

  chatReplyIsRepeated(text, previous) {
    const normalise = value => String(value || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const current = normalise(text);
    if (!current) return true;
    const currentWords = new Set(current.split(' ').filter(word => word.length > 2));
    return (previous || []).some(old => {
      const prior = normalise(old);
      if (!prior) return false;
      if (prior === current) return true;
      const priorWords = new Set(prior.split(' ').filter(word => word.length > 2));
      let shared = 0;
      currentWords.forEach(word => { if (priorWords.has(word)) shared++; });
      return shared >= 3 && shared / Math.max(1, Math.min(currentWords.size, priorWords.size)) >= 0.7;
    });
  },

  validChatText(text, playerText, who, seed) {
    return !this.chatReplyReason(text, playerText, who, seed);
  },

  wordCount(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
  },

  nicoleSeedReply(text) {
    const tone = this.chatTone(text);
    const seeds = {
      1: {
        questioning: ['that clip is cut at both ends, please check the whole video', 'that is only the middle of what i said, the rest changes everything'],
        pile_on: ['i did not say that like this, ask mia what she remembers', 'mia was right there, ask her what i actually said'],
        supportive: ['thank you, i just need someone to check the full video', 'thank you, you are the first one to question it'],
        neutral: ['i know the clip looks bad, but both ends are cut', 'you only got the middle, you are missing the rest']
      },
      2: {
        questioning: ['that photo is from last summer, not last night', 'check the date on that photo, it is from lauras birthday'],
        pile_on: ['i was in my room, that picture is from lauras birthday', 'i was not even there last night, that photo is old'],
        supportive: ['thank you, the old post shows when that photo was taken', 'thank you, check the date on the original post'],
        neutral: ['i did not go out last night, the photo is from july', 'that photo is from the summer, everyone knows that']
      },
      3: {
        questioning: ['that account is not mine, compare it with my real profile', 'check my real account, i never deleted anything'],
        pile_on: ['someone copied my photos and made that account', 'that account is fake, someone stole my pictures'],
        supportive: ['thank you, my real account is still there with four years of posts', 'thank you, look at my real account, everything is still there'],
        neutral: ['that is not my account, i deleted nothing', 'i never deleted anything, that account is not mine']
      },
      clip: {
        questioning: ['then why does that recording sound exactly like you', 'you sent a note on sunday, this uses the same voice'],
        pile_on: ['dont lie to me, that is your voice', 'i know how you sound'],
        supportive: ['if someone faked it then who, because it sounds like you', 'then prove where that voice note came from'],
        neutral: ['i thought we were friends', 'why would you say that about me']
      },
      4: {
        questioning: ['my real voice has room noise and breathing, that note does not', 'compare it with my real voice notes, that one is too clean'],
        pile_on: ['that is not how my voice sounds when i record on my phone', 'my voice does not sound like that, the recording is fake'],
        supportive: ['thank you, listen to the breathing in my real notes', 'thank you, compare it with a real note i sent you'],
        neutral: ['the fake note is too clean, real recordings have room noise', 'that message sounds weird, my phone recordings have noise']
      }
    };
    return (seeds[this.chatTopicKey()] || seeds[1])[tone] || seeds[1].neutral;
  },

  groupSeedReply(who, text) {
    const tone = this.chatTone(text);
    const seeds = {
      1: {
        Mia: {
          questioning: 'wait did anyone check the whole video or just the clip',
          pile_on: 'okay but that still does not prove everything',
          supportive: 'maybe we should ask her before deciding',
          neutral: 'did someone actually watch the whole video'
        },
        Hanna: {
          questioning: 'why are you suddenly investigating this now',
          pile_on: 'be serious, that is obviously her',
          supportive: 'sure, but where is the proof',
          neutral: 'we all saw the same thing'
        },
        Lea: {
          questioning: 'okay but what are we actually looking at',
          pile_on: 'i mean, it does look bad',
          supportive: 'maybe someone should ask her first',
          neutral: 'this chat is getting weird'
        },
        Benito: {
          questioning: 'i wasnt really watching',
          pile_on: 'i am not saying anything',
          supportive: 'leave me out of this',
          neutral: 'i wasnt paying attention'
        }
      },
      2: {
        Mia: {
          questioning: 'has anyone checked when that photo was actually posted',
          pile_on: 'okay but that still feels weird',
          supportive: 'that could be from a different night though',
          neutral: 'does someone have the original post'
        },
        Hanna: {
          questioning: 'we already checked enough, the photo is real',
          pile_on: 'the photo proves she was there, stop defending her',
          supportive: 'then show us the date it was taken',
          neutral: 'no one is buying that'
        },
        Lea: {
          questioning: 'wait, when was that picture taken',
          pile_on: 'i cannot defend that part',
          supportive: 'we should not pile on before checking the date',
          neutral: 'i genuinely dont know anymore'
        },
        Benito: {
          questioning: 'i dont remember',
          pile_on: 'why are you asking me',
          supportive: 'dont drag me into this',
          neutral: 'i wasnt paying attention'
        }
      },
      3: {
        Mia: {
          questioning: 'does anyone think that account looks off',
          pile_on: 'okay but the writing does not sound like her',
          supportive: 'maybe compare it with her real profile',
          neutral: 'i am not sure what to believe'
        },
        Hanna: {
          questioning: 'it looks real, why are you questioning it',
          pile_on: 'that account is obviously hers, everyone saw it',
          supportive: 'prove it is fake then',
          neutral: 'this is getting ridiculous'
        },
        Lea: {
          questioning: 'something about that account feels weird',
          pile_on: 'it does look pretty authentic though',
          supportive: 'we should check her real profile first',
          neutral: 'can we take a minute'
        },
        Benito: {
          questioning: 'no idea',
          pile_on: 'not my problem',
          supportive: 'i have nothing to say',
          neutral: 'why would i know'
        }
      },
      clip: {
        Mia: {
          questioning: 'wait is the group even talking about a voice note tonight',
          pile_on: 'okay but that sounds messy',
          supportive: 'maybe keep that in dms',
          neutral: 'i am lost, what happened'
        },
        Hanna: {
          questioning: 'why are you bringing private drama in here',
          pile_on: 'if someone sent a voice note own it',
          supportive: 'then sort it with her privately',
          neutral: 'this chat is quiet for a reason'
        },
        Lea: {
          questioning: 'did something happen in dms',
          pile_on: 'i dont want to get involved in that',
          supportive: 'maybe talk to nicole directly',
          neutral: 'tonight feels off'
        },
        Benito: {
          questioning: 'dont know',
          pile_on: 'not my business',
          supportive: 'leave me out',
          neutral: 'why ask me'
        }
      },
      4: {
        Mia: {
          questioning: 'wait, does that voice actually sound like her',
          pile_on: 'okay but voices can be faked now',
          supportive: 'maybe we should compare it with her old voice notes',
          neutral: 'something about that voice is off'
        },
        Hanna: {
          questioning: 'why does it matter, the voice message says enough',
          pile_on: 'that is her voice, stop making excuses',
          supportive: 'then show us what is different',
          neutral: 'why would anyone believe that'
        },
        Lea: {
          questioning: 'that voice sounds too clean to be honest',
          pile_on: 'i mean, it does sound like her',
          supportive: 'real voice notes have background noise, this one does not',
          neutral: 'i dont know what to think anymore'
        },
        Benito: {
          questioning: 'didnt hear it',
          pile_on: 'stop asking me',
          supportive: 'i dont get involved',
          neutral: 'why would i know'
        }
      }
    };
    const day = seeds[this.chatTopicKey()] || seeds[1];
    const char = day[who];
    return (char && char[tone]) || null;
  },

  chatBank() {
    return {
      Nicole: {
        questioning: ['i dont know how to prove it to you', 'please look at the whole thing first', 'wait, that is not the whole story', 'can you ask mia what she remembers'],
        pile_on: ['that is not what happened', 'you know me better than this', 'i did not say it like that', 'please stop deciding this without asking me'],
        supportive: ['thank you, i honestly needed someone to listen', 'i swear there is more to it', 'i knew you might actually understand', 'please dont leave me alone with this'],
        neutral: ['i dont even know where to start explaining', 'everything looks worse the more people share it', 'please just give me a chance to explain', 'i keep rereading the messages and i feel sick']
      },
      Mia: {
        questioning: ['wait did anyone actually check that', 'does someone have the full version', 'what happened before and after this clip', 'can we check where that came from', 'can someone show us the full version', 'what did she actually say before and after that', 'does anyone have the original clip', 'maybe we should check the source first'],
        pile_on: ['okay but that still feels weird', 'can we not decide this in one second', 'that proves less than everyone thinks', 'why are we so certain already', 'okay that does look bad for her', 'but can we be sure that is the whole story', 'that feels too quick to decide', 'i get why everyone is angry though'],
        supportive: ['maybe we should actually ask her', 'this does not prove what everyone thinks', 'i think we should slow down', 'someone needs to check the original', 'we should at least hear her side', 'this does not add up to me', 'can someone check the original first', 'i am not convinced it was her'],
        neutral: ['i dont know, something is off here', 'has anyone checked the original', 'i am not sure what to believe', 'there has to be more context', 'wait, what are we even looking at', 'can we see the full thing first', 'i feel like we are missing something', 'this all happened so fast']
      },
      Hanna: {
        questioning: ['why are we suddenly investigating this now', 'it looks pretty clear to me', 'what exactly are you trying to prove', 'we already checked enough', 'we have seen enough already', 'why would she delete it if it was nothing', 'you keep looking for reasons to doubt', 'everyone else already decided'],
        pile_on: ['be serious, that is obviously her', 'why are you defending her', 'everyone saw what she did', 'she cannot keep getting away with this', 'she knew exactly what she was doing', 'dont fall for her excuses again', 'typical, she always has a story', 'we should not even be discussing this'],
        supportive: ['sure, but where is the proof', 'that does not change what she said', 'you always make excuses for her', 'then show us something real', 'yeah right, and the video was faked too', 'you say that about everything', 'she has had every chance to explain', 'give me one real reason to believe her'],
        neutral: ['no one is buying that', 'we all saw the same thing', 'this is getting ridiculous', 'why would anyone believe that', 'this is not hard to figure out', 'we all saw what happened', 'she will just deny it anyway', 'stop making it complicated']
      },
      Lea: {
        questioning: ['okay, but what are we actually looking at', 'maybe wait before making it worse', 'does anyone have proof of that', 'i want to see the original first', 'but like, what are we actually judging', 'has anyone looked at the whole thing', 'i just want to see the original', 'are we sure about the timeline'],
        pile_on: ['i mean, it does look bad', 'that is a lot to explain', 'i cannot defend that part', 'why does her story keep changing', 'okay that is hard to explain away', 'she keeps changing her story', 'that part i cannot defend', 'it really does not look good'],
        supportive: ['i dont know if we should keep doing this', 'maybe someone should ask her first', 'this feels unfair without the full story', 'we should not pile on yet', 'we should slow down a bit', 'maybe hear her side first', 'this feels too fast to me', 'i dont think we should decide like this'],
        neutral: ['this chat is getting weird', 'i genuinely dont know anymore', 'something about this feels wrong', 'can we take a minute', 'honestly i dont know what to think', 'can we just take a second', 'this whole thing is a mess', 'i need to see the original first']
      },
      Benito: {
        questioning: ['i dont know anything', 'why would i know', 'i wasnt really watching', 'i dont remember'],
        pile_on: ['i am not saying anything', 'leave me out of this', 'dont drag me into this', 'not my problem'],
        supportive: ['i have nothing to say', 'i dont get involved', 'dont ask me', 'i wasnt paying attention'],
        neutral: ['i wasnt paying attention', 'i wasnt really watching', 'why would i know', 'i dont remember']
      }
    };
  },

  pickChatSeed(who, text, variant) {
    const tone = this.chatTone(text);
    const usedList = this.state.llmUsedReplies || [];
    const unseen = line => !this.chatReplyIsRepeated(line, usedList);
    const playerNorm = String(text || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const echoesPlayer = line => {
      const n = String(line || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
      return !!n && !!playerNorm && (n === playerNorm || (n.length > 10 && (n.indexOf(playerNorm) > -1 || playerNorm.indexOf(n) > -1)));
    };
    if (who === 'Nicole') {
      const daySeeds = this.nicoleSeedReply(text);
      const fresh = daySeeds.filter(line => unseen(line) && !echoesPlayer(line));
      if (fresh.length) return fresh[(this.state.llmReplySeed + (variant || 0)) % fresh.length];
    } else if (!variant) {
      const dayLine = this.groupSeedReply(who, text);
      if (dayLine && unseen(dayLine) && !echoesPlayer(dayLine)) return dayLine;
    }
    const bank = this.chatBank();
    const choices = (bank[who] || bank.Mia)[tone] || bank.Mia.neutral;
    const safeChoices = choices.filter(line => !echoesPlayer(line));
    const fresh = safeChoices.filter(unseen);
    const pool = fresh.length ? fresh : safeChoices;
    if (!pool.length) return 'i need a second to think';
    return pool[(this.state.llmReplySeed + (variant || 0)) % pool.length];
  },

  recordChatSeed(line) {
    this.setState(s => ({
      llmUsedReplies: (s.llmUsedReplies || []).concat([line]).slice(-60),
      llmReplySeed: (s.llmReplySeed || 0) + 1
    }));
  },

  fallbackChatReply(who, text, variant, seed) {
    let first = null;
    for (let v = variant || 0; v < (variant || 0) + 5; v++) {
      const line = this.pickChatSeed(who, text, v);
      if (!first) first = line;
      if (!this.chatReplyReason(line, text, who, seed)) {
        this.recordChatSeed(line);
        return line;
      }
    }
    this.recordChatSeed(first);
    return first;
  },

  async generateChatReply(who, text, tab) {
    if (!this._llmReady || !this._wllama) {
      const seed = this.fallbackChatReply(who, text);
      console.log('[chat-llm] reply fallback (' + who + '): ' + seed);
      return seed;
    }
    const seed = this.pickChatSeed(who, text, 0);
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const result = await this._wllama.createChatCompletion({
          messages: this.chatPromptMessages(who, text, tab, seed),
          max_tokens: 32,
          temperature: attempt === 0 ? 0.4 : attempt === 1 ? 0.7 : 0.95,
          top_k: 40,
          top_p: 0.9,
          penalty_repeat: 1.1,
          seed: (this.state.llmReplySeed || 0) * 7 + attempt,
          stop: ['\n']
        });
        const reply = this.cleanChatText(this.extractChatText(result), who);
        const reason = this.chatReplyReason(reply, text, who, seed);
        if (!reason) {
          this.recordChatSeed(reply);
          console.log('[chat-llm] reply accepted (model' + (attempt ? ', retry' : '') + ') ' + who + ': ' + reply);
          return reply;
        }
        console.log('[chat-llm] rejected model reply (' + reason + ') ' + who + ': ' + JSON.stringify(reply) + (attempt === 2 ? '; falling back' : '; retrying'));
      }
      const fallback = this.fallbackChatReply(who, text, 1, seed);
      console.log('[chat-llm] using fallback after retries ' + who + ': ' + fallback);
      return fallback;
    } catch (error) {
      console.warn('[chat-llm] generation failed; using fallback for ' + who, error);
      this.setLlmStatus('Generation failed; using offline replies');
      return this.fallbackChatReply(who, text, 1, seed);
    }
  },

  async sendChatMessage() {
    const st = this.state;
    const tab = st.tab === 'dm' ? 'dm' : 'group';
    const draft = tab === 'dm' ? st.chatDmDraft : st.chatGroupDraft;
    const text = String(draft || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    const left = tab === 'dm' ? st.chatDmLeft : st.chatGroupLeft;
    if (!text || st.chatBusy || left <= 0) return;
    if (tab === 'dm' && this.samTier() === 'gone') return;

    const generation = (this._chatGeneration || 0) + 1;
    this._chatGeneration = generation;
    const mine = { who: 'You', mine: true, text };
    const remaining = tab === 'dm'
      ? { chatDmLeft: left - 1, chatDmDraft: '' }
      : { chatGroupLeft: left - 1, chatGroupDraft: '' };
    this.setState(Object.assign({}, remaining, {
      chatBusy: true, actedToday: true, ignored: false,
      dmAnsweredToday: tab === 'dm' ? true : st.dmAnsweredToday,
      llmStatus: this._llmReady ? 'Replying...' : 'Model loading; using a fallback if needed'
    }));
    this.recordChatBehaviour(tab, text);
    const askMatch = this.maybeCompleteAskTasksFromChat(tab, text);
    this.advance(2);
    if (tab === 'dm') this.setState(s => ({ dm: s.dm.concat([mine]) }));
    else this.setState(s => ({ chat: s.chat.concat([mine]) }));

    await new Promise(resolve => setTimeout(resolve, 220));
    if (generation !== this._chatGeneration) return;
    const who = (askMatch && askMatch.id === 'd1mia') ? 'Mia' : this.chatReplyWho(tab, text);
    let wantVideo = false;
    let replyText;
    if (askMatch && askMatch.id === 'd1mia') {
      wantVideo = this.state.day === 1 && !this.state.d1VideoSent
        ? await this.d1VideoIntent(text)
        : false;
      if (generation !== this._chatGeneration) return;
      replyText = wantVideo
        ? 'one sec'
        : String(askMatch.result || '').split(':').slice(1).join(':').trim();
    } else {
      replyText = await this.generateChatReply(who, text, tab);
    }
    if (generation !== this._chatGeneration) return;

    if (tab === 'dm') {
      const samMessage = this.samReply(replyText);
      if (samMessage) samMessage.generated = true;
      const reply = this.pushSamReply(samMessage);
      if (reply) {
        this.setState(
          s => ({ dm: s.dm.concat([reply]) }),
          () => this.applyIncomingReply('dm')
        );
      }
    } else {
      this.setState(
        s => ({ chat: s.chat.concat([{ who, text: replyText, generated: true }]) }),
        () => this.applyIncomingReply('group')
      );
      if (wantVideo) {
        this.sendD1Video();
      } else if (this.state.day === 1 && !this.state.d1VideoSent && this.d1VideoTopic(text)) {
        const followVideo = await this.d1VideoIntent(text);
        if (generation !== this._chatGeneration) return;
        if (followVideo) this.sendD1Video();
      }
    }
    const keepError = /offline|failed/i.test(String(this.state.llmStatus || ''));
    this.setState({ chatBusy: false, llmStatus: keepError ? this.state.llmStatus : '' });
    this.log(tab === 'dm' ? '— you texted Nicole' : '— you texted the group');
  },

  async fetchModelBlob(url, label) {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit', redirect: 'follow' });
    if (!response.ok) throw new Error(label + ' HTTP ' + response.status);
    const total = Number(response.headers.get('content-length')) || 229312224;
    if (!response.body || !response.body.getReader) return response.blob();
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;
    let lastLogged = -10;
    while (true) {
      const step = await reader.read();
      if (step.done) break;
      chunks.push(step.value);
      loaded += step.value.length;
      const pct = Math.min(99, Math.round((loaded / total) * 100));
      if (pct >= lastLogged + 10) {
        lastLogged = pct - (pct % 10);
        this.setLlmStatus('Downloading model... ' + pct + '%');
      }
    }
    return new Blob(chunks, { type: 'application/octet-stream' });
  },

  // Persist GGUF in Cache API so reloads skip the ~220MB download.
  // Survives Start over / Replay (those only clear SAVE_KEY + game state).
  // Bump the cache name only when the GGUF file itself changes.
  LLM_MODEL_CACHE: 'ithoughtiknewyou-llm-v1',
  LLM_MODEL_CACHE_URL: 'https://local.cache/llm/LFM2.5-350M-Q4_K_M.gguf',
  LLM_MODEL_MIN_BYTES: 1000000,

  async openLlmModelCache() {
    if (typeof caches === 'undefined' || !caches.open) return null;
    try {
      return await caches.open(this.LLM_MODEL_CACHE);
    } catch (e) {
      console.warn('[chat-llm] cache open failed', e);
      return null;
    }
  },

  async readCachedModelBlob() {
    const cache = await this.openLlmModelCache();
    if (!cache) return null;
    try {
      const hit = await cache.match(this.LLM_MODEL_CACHE_URL);
      if (!hit) return null;
      const blob = await hit.blob();
      if (!blob || blob.size < this.LLM_MODEL_MIN_BYTES) return null;
      return blob;
    } catch (e) {
      console.warn('[chat-llm] cache read failed', e);
      return null;
    }
  },

  async writeCachedModelBlob(blob) {
    if (!blob || blob.size < this.LLM_MODEL_MIN_BYTES) return;
    const cache = await this.openLlmModelCache();
    if (!cache) return;
    try {
      await cache.put(this.LLM_MODEL_CACHE_URL, new Response(blob, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(blob.size)
        }
      }));
      console.log('[chat-llm] model cached (' + Math.round(blob.size / 1048576) + ' MB)');
    } catch (e) {
      console.warn('[chat-llm] cache write failed', e);
    }
  },

  async loadModelBlob(modelUrls) {
    this.setLlmStatus('Checking cached model...');
    const cached = await this.readCachedModelBlob();
    if (cached) {
      this.setLlmStatus('Loading cached model...');
      return cached;
    }

    let blob = null;
    let lastError = null;
    for (const url of modelUrls) {
      try {
        blob = await this.fetchModelBlob(url, 'model');
        if (blob && blob.size > this.LLM_MODEL_MIN_BYTES) break;
        throw new Error('model too small');
      } catch (error) {
        lastError = error;
        console.warn('[chat-llm] model fetch failed', url, error);
        blob = null;
      }
    }
    if (!blob) throw lastError || new Error('model download failed');
    this.setLlmStatus('Saving model for next time...');
    await this.writeCachedModelBlob(blob);
    return blob;
  },

  async importWllama() {
    const urls = [
      'https://cdn.jsdelivr.net/npm/@wllama/wllama@3.5.1/esm/index.js',
      'https://unpkg.com/@wllama/wllama@3.5.1/esm/index.js',
      'https://esm.sh/@wllama/wllama@3.5.1/esm/index.js'
    ];
    const wasmUrl = 'https://cdn.jsdelivr.net/npm/@wllama/wllama@3.5.1/esm/wasm/wllama.wasm';
    let lastError = null;
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      this.setLlmStatus('Loading runtime... (' + (i + 1) + '/' + urls.length + ')');
      try {
        const mod = await import(/* @vite-ignore */ url);
        if (mod && mod.Wllama) return { Wllama: mod.Wllama, wasmUrl };
      } catch (error) {
        lastError = error;
        console.warn('[chat-llm] runtime import failed', url, error);
      }
    }
    throw lastError || new Error('Could not import Wllama');
  },

  createWllama(Wllama, wasmUrl) {
    const quietWarn = /multi-thread|single-thread|special_eos|munmap|n_ctx_per_seq|n_ctx_train|prompt_save|update_slots|context checkpoint|lack of cache|SWA|hybrid\/recurrent|speculative/i;
    return new Wllama({ default: wasmUrl }, {
      parallelDownloads: 1,
      // We own the GGUF Cache API; allow Wllama to reuse its wasm/assets offline too.
      allowOffline: true,
      logger: {
        debug: () => {},
        log: () => {},
        warn: (...args) => {
          const message = args.map(String).join(' ');
          if (!quietWarn.test(message)) console.warn('[wllama]', ...args);
        },
        error: (...args) => console.error('[wllama]', ...args)
      }
    });
  },

  ensureLlm(force) {
    if (!this.LLM_CHAT_ENABLED) return Promise.resolve(null);
    if (this._llmReady && this._wllama) return Promise.resolve(this._wllama);
    if (this._llmLoading) return this._llmLoading;
    if (this._llmFailed && !force) return Promise.resolve(null);

    this._llmFailed = false;
    this._llmLoading = (async () => {
      try {
        const loaded = await this.importWllama();
        const useGpu = typeof navigator !== 'undefined' && !!navigator.gpu;
        let wllama = this.createWllama(loaded.Wllama, loaded.wasmUrl);
        const modelUrls = [
          'https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF/resolve/main/LFM2.5-350M-Q4_K_M.gguf',
          'https://hf-mirror.com/LiquidAI/LFM2.5-350M-GGUF/resolve/main/LFM2.5-350M-Q4_K_M.gguf'
        ];
        const blob = await this.loadModelBlob(modelUrls);

        this.setLlmStatus(useGpu ? 'Starting model with WebGPU...' : 'Starting model...');
        const isolatedContext = typeof crossOriginIsolated === 'boolean' && crossOriginIsolated;
        const nThreads = isolatedContext
          ? Math.min(4, Math.max(2, Number(navigator.hardwareConcurrency) || 2))
          : 1;
        try {
          await wllama.loadModel([blob], {
            n_threads: nThreads,
            n_ctx: 1024,
            n_gpu_layers: useGpu ? 99 : 0,
            embeddings: false
          });
        } catch (error) {
          if (!useGpu) throw error;
          console.warn('[chat-llm] WebGPU load failed; retrying CPU', error);
          this.setLlmStatus('Starting CPU model...');
          wllama = this.createWllama(loaded.Wllama, loaded.wasmUrl);
          await wllama.loadModel([blob], {
            n_threads: nThreads,
            n_ctx: 1024,
            n_gpu_layers: 0,
            embeddings: false
          });
        }
        this.setLlmStatus('Warming up...');
        try {
          await wllama.createChatCompletion({
            messages: [{ role: 'user', content: 'Say exactly: ok noted' }],
            max_tokens: 6,
            temperature: 0.3,
            top_k: 8,
            top_p: 0.85
          });
        } catch (error) {
          console.warn('[chat-llm] warmup skipped', error);
        }
        this._wllama = wllama;
        this._llmReady = true;
        this._llmFailed = false;
        this.setLlmStatus('Chat model ready');
        setTimeout(() => {
          if (this.state.llmStatus === 'Chat model ready') this.setState({ llmStatus: '' });
        }, 2500);
        return wllama;
      } catch (error) {
        this._llmReady = false;
        this._llmFailed = true;
        this._wllama = null;
        const why = error && (error.message || error.name) ? String(error.message || error.name).slice(0, 110) : 'blocked or offline';
        this.setLlmStatus('LLM offline: ' + why);
        console.warn('[chat-llm] unavailable', error);
        return null;
      } finally {
        this._llmLoading = null;
      }
    })();
    return this._llmLoading;
  },

  retryLlm() {
    this._llmFailed = false;
    this._llmReady = false;
    this._wllama = null;
    return this.ensureLlm(true);
  },

  // Never call from Start over / Replay — only for model upgrades or explicit debug.
  async clearLlmModelCache() {
    if (typeof caches === 'undefined' || !caches.delete) return false;
    try {
      return await caches.delete(this.LLM_MODEL_CACHE);
    } catch (e) {
      console.warn('[chat-llm] cache delete failed', e);
      return false;
    }
  }
});
