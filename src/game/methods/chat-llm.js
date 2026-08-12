window.GameMethods = Object.assign(window.GameMethods || {}, {
  setLlmStatus(message) {
    const text = String(message || '');
    if (text) console.log('[chat-llm] ' + text);
    this.setState({ llmStatus: text });
  },

  chatContextSection() {
    const source = String((window.GameData && window.GameData.chatContext) || '');
    const heading = new RegExp('(^|\\n)#\\s*' + this.state.day + '\\.', 'i').exec(source);
    if (!heading) return source.replace(/\s+/g, ' ').trim().slice(0, 700);
    const start = heading.index;
    const next = source.indexOf('\n# ', start + heading[0].length);
    return source.slice(start, next < 0 ? source.length : next).replace(/\s+/g, ' ').trim().slice(0, 700);
  },

  chatRecentContext(tab) {
    const list = tab === 'dm' ? this.state.dm : this.state.chat;
    return list.slice(-2).map(m => {
      const text = (m.text || m.caption || '').replace(/\s+/g, ' ').trim();
      return text ? m.who + ': ' + text : '';
    }).filter(Boolean).join(' | ').slice(-420);
  },

  chatTone(text) {
    const t = String(text || '').toLowerCase();
    if (/\b(check|checked|source|maybe|could|cut|whole|posted|last summer|last july|one year|six fingers|bot|clean|audio|room|breath|which is which|actually checked|original|compare|proof|evidence)\b/.test(t)) return 'questioning';
    if (/\b(support|believe|believed|innocent|sorry|defend|leave her alone|not okay|are you (ok|okay|alright)|i believe|with you|on your side|isn'?t okay|isnt okay)\b/.test(t)) return 'supportive';
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
      neutral: 'respond naturally without inventing a new fact'
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
    const tone = this.chatTone(text);
    if (tone === 'questioning') return 'Mia';
    if (tone === 'pile_on') return 'Hanna';
    if (tone === 'supportive') return 'Lea';
    const pool = ['Mia', 'Hanna', 'Lea'];
    return pool[(this.state.llmReplySeed || 0) % pool.length];
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
    const day = this.allDays()[this.state.day] || this.day();
    const context = this.chatContextSection();
    const recent = this.chatRecentContext(tab) || 'No earlier messages in this thread.';
    const line = String(playerText || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    const seedLine = String(seed || '').replace(/\s+/g, ' ').trim().slice(0, 100);
    const focus = this.chatFocus(playerText);
    const example = this.chatExample(who);
    const privateRule = tab === 'dm'
      ? 'This is a private message to Nicole. Answer the exact player message in first person. Do not greet, welcome, or give vague reassurance.'
      : 'This is the class group chat. Reply as one participant, not as a narrator.';
    const system = [
      'You are ' + who + ' in a realistic teen chat.',
      'Day ' + this.state.day + ': ' + (day.name || day.deskTitle || 'the current rumor') + '.',
      'Voice: ' + this.chatVoice(who) + '.',
      privateRule,
      'Use only these facts. Do not invent events or reveal everything at once.',
      'Rewrite the seed without changing its meaning or stance.',
      'Reply directly to the player. Never narrate the player, the conversation, or the scene.',
      'Never say "the player", "the user", "the voice", "the conversation", or "as if".',
      'Do not answer with only agreement. Write one natural lowercase message, maximum 14 words.',
      'Day facts: ' + context,
      'Recent: ' + recent
    ].join(' ');
    return [
      { role: 'system', content: system },
      { role: 'user', content: 'Player said: "' + example.player + '"\nFocus: ' + this.chatFocus(example.player) + '\nWrite a new reply as ' + who + '.' },
      { role: 'assistant', content: example.reply },
      { role: 'user', content: [
        'Player said: "' + line + '"',
        'Focus: ' + focus + '.',
        'Use this idea but reword it: "' + seedLine + '"',
        'Write a NEW direct reply as ' + who + '. Do not repeat the player.'
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
    value = value.replace(/["'`]/g, '').replace(/\s+/g, ' ').trim();
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
    if (this.wordCount(value) > 14) return 'too long';
    const a = value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const b = String(playerText || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (a === b || (a.length > 10 && (a.indexOf(b) > -1 || b.indexOf(a) > -1))) return 'echo';
    if (/^(i agree|agree|okay|ok|sure|yes|no|exactly|fair|right|same)$/i.test(a)) return 'generic';
    const seedNorm = String(seed || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (seed && a === seedNorm) return 'same as seed';
    if (/\b(i'?ve realized|straightforward and clear|a clear indication|the first sentence|in conclusion|the statement shows|as a response to)\b/i.test(value)) return 'abstract';
    if (who === 'Nicole') {
      if (/\b(glad you could join|welcome|nice to meet|good to see|join us|its just me|it's just me|dont worry|don't worry)\b/i.test(value)) return 'vague Nicole';
      if (!/\b(but|because|check|proof|prove|clip|video|photo|picture|account|voice|audio|room|party|said|happened|not|did|was|is|think|know|evidence|whole|original|listen|believe)\b/i.test(value)) return 'vague Nicole';
    }
    const history = (this.state.llmUsedReplies || []).slice();
    const seedIndex = seed ? history.map(old => String(old).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()).lastIndexOf(seedNorm) : -1;
    if (seedIndex >= 0) history.splice(seedIndex, 1);
    if (this.chatReplyIsRepeated(value, history)) return 'repeated';
    if ((who === 'Hanna' || who === 'Lea') && /\b(she'?s innocent|she is innocent|believe her|support her|not her fault)\b/i.test(value)) return 'wrong stance';
    if (who === 'Mia' && /\b(obviously|definitely|no question|everyone knows)\b/i.test(value)) return 'too certain for Mia';
    const dayWords = {
      1: 'video|clip|cut|whole|party|said|record|check|source',
      2: 'photo|picture|party|summer|posted|date|birthday',
      3: 'account|photo|picture|fake|real|bot|finger|writing',
      4: 'voice|audio|room|breath|clean|record|sound|pause'
    }[this.state.day] || 'check|proof|source';
    if (this.wordCount(value) <= 5 && !new RegExp('\\b(' + dayWords + ')\\b', 'i').test(value)) return 'off-topic';
    if (who === 'Mia' && this.wordCount(value) <= 5 && !/[?]/.test(value) && !/\b(maybe|check|source|wait|actually|know)\b/i.test(value)) return 'not Mia';
    if (who === 'Nicole' && !/\b(i|me|my|you|we|please|dont|don't|not|can)\b/i.test(value)) return 'not Nicole';
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
        questioning: 'the clip starts in the middle, please check the whole video',
        pile_on: 'i did not say that like this, ask mia what she remembers',
        supportive: 'thank you, i just need someone to check the full video',
        neutral: 'i know the clip looks bad, but it starts halfway through'
      },
      2: {
        questioning: 'that photo is from last summer, not last night',
        pile_on: 'i was in my room, that picture is from lauras birthday',
        supportive: 'thank you, the old post shows when that photo was taken',
        neutral: 'i did not go out last night, the photo is from july'
      },
      3: {
        questioning: 'that account is not mine, compare it with my real profile',
        pile_on: 'someone copied my photos and made that account',
        supportive: 'thank you, my real account is still there with four years of posts',
        neutral: 'that is not my account, i deleted nothing'
      },
      4: {
        questioning: 'my real voice has room noise and breathing, that note does not',
        pile_on: 'that is not how my voice sounds when i record on my phone',
        supportive: 'thank you, listen to the breathing in my real notes',
        neutral: 'the fake note is too clean, real recordings have room noise'
      }
    };
    return (seeds[this.state.day] || seeds[1])[tone] || seeds[1].neutral;
  },

  fallbackChatReply(who, text) {
    const tone = this.chatTone(text);
    if (who === 'Nicole') {
      const fresh = this.nicoleSeedReply(text);
      this.setState(s => ({
        llmUsedReplies: (s.llmUsedReplies || []).concat([fresh]).slice(-40),
        llmReplySeed: (s.llmReplySeed || 0) + 1
      }));
      return fresh;
    }
    const bank = {
      Nicole: {
        questioning: ['i dont know how to prove it to you', 'please look at the whole thing first', 'wait, that is not the whole story', 'can you ask mia what she remembers'],
        pile_on: ['that is not what happened', 'you know me better than this', 'i did not say it like that', 'please stop deciding this without asking me'],
        supportive: ['thank you, i honestly needed someone to listen', 'i swear there is more to it', 'i knew you might actually understand', 'please dont leave me alone with this'],
        neutral: ['i dont even know what to say anymore', 'can you just talk to me privately', 'everything keeps getting worse', 'i am trying to explain what happened']
      },
      Mia: {
        questioning: ['wait did anyone actually check that', 'does someone have the full version', 'what happened before this clip', 'can we check where that came from'],
        pile_on: ['okay but that still feels weird', 'can we not decide this in one second', 'that proves less than everyone thinks', 'why are we so certain already'],
        supportive: ['maybe we should actually ask her', 'this does not prove what everyone thinks', 'i think we should slow down', 'someone needs to check the original'],
        neutral: ['i dont know, something is off here', 'has anyone checked the original', 'i am not sure what to believe', 'there has to be more context']
      },
      Hanna: {
        questioning: ['why are we suddenly investigating this now', 'it looks pretty clear to me', 'what exactly are you trying to prove', 'we already checked enough'],
        pile_on: ['be serious, that is obviously her', 'why are you defending her', 'everyone saw what she did', 'she cannot keep getting away with this'],
        supportive: ['sure, but where is the proof', 'that does not change what she said', 'you always make excuses for her', 'then show us something real'],
        neutral: ['no one is buying that', 'we all saw the same thing', 'this is getting ridiculous', 'why would anyone believe that']
      },
      Lea: {
        questioning: ['okay, but what are we actually looking at', 'maybe wait before making it worse', 'does anyone have proof of that', 'i want to see the original first'],
        pile_on: ['i mean, it does look bad', 'that is a lot to explain', 'i cannot defend that part', 'why does her story keep changing'],
        supportive: ['i dont know if we should keep doing this', 'maybe someone should ask her first', 'this feels unfair without the full story', 'we should not pile on yet'],
        neutral: ['this chat is getting weird', 'i genuinely dont know anymore', 'something about this feels wrong', 'can we take a minute']
      }
    };
    const choices = (bank[who] || bank.Mia)[tone] || bank.Mia.neutral;
    const used = new Set(this.state.llmUsedReplies || []);
    const fresh = choices.find(line => !used.has(line)) || choices[0];
    this.setState(s => ({
      llmUsedReplies: (s.llmUsedReplies || []).concat([fresh]).slice(-40),
      llmReplySeed: (s.llmReplySeed || 0) + 1
    }));
    return fresh;
  },

  async generateChatReply(who, text, tab) {
    const seed = this.fallbackChatReply(who, text);
    if (!this._llmReady || !this._wllama) {
      console.log('[chat-llm] reply fallback (' + who + '): ' + seed);
      return seed;
    }
    try {
      const result = await this._wllama.createChatCompletion({
        messages: this.chatPromptMessages(who, text, tab, seed),
        max_tokens: 20,
        temperature: 0.7,
        top_k: 40,
        top_p: 0.92,
        stop: ['\n']
      });
      const reply = this.cleanChatText(this.extractChatText(result), who);
      const reason = this.chatReplyReason(reply, text, who, seed);
      if (reason) {
        console.log('[chat-llm] rejected model reply (' + reason + ') ' + who + ': ' + JSON.stringify(reply) + '; fallback: ' + seed);
        return seed;
      }
      this.setState(s => ({
        llmUsedReplies: (s.llmUsedReplies || []).concat([reply]).slice(-40),
        llmReplySeed: (s.llmReplySeed || 0) + 1
      }));
      console.log('[chat-llm] reply accepted (model) ' + who + ': ' + reply);
      return reply;
    } catch (error) {
      console.warn('[chat-llm] generation failed; fallback ' + who + ': ' + seed, error);
      this.setLlmStatus('Generation failed; using offline replies');
      return seed;
    }
  },

  async sendChatMessage() {
    const st = this.state;
    const text = String(st.chatDraft || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    const tab = st.tab === 'dm' ? 'dm' : 'group';
    const left = tab === 'dm' ? st.chatDmLeft : st.chatGroupLeft;
    if (!text || st.chatBusy || left <= 0) return;
    if (tab === 'dm' && this.samTier() === 'gone') return;

    const generation = (this._chatGeneration || 0) + 1;
    this._chatGeneration = generation;
    const mine = { who: 'You', mine: true, text };
    const remaining = tab === 'dm' ? { chatDmLeft: left - 1 } : { chatGroupLeft: left - 1 };
    this.setState(Object.assign({}, remaining, {
      chatDraft: '', chatBusy: true, actedToday: true, ignored: false,
      dmAnsweredToday: tab === 'dm' ? true : st.dmAnsweredToday,
      llmStatus: this._llmReady ? 'Replying...' : 'Model loading; using a fallback if needed'
    }));
    this.recordChatBehaviour(tab, text);
    this.maybeCompleteAskTasksFromChat(tab, text);
    this.advance(2);
    if (tab === 'dm') this.setState(s => ({ dm: s.dm.concat([mine]) }));
    else this.setState(s => ({ chat: s.chat.concat([mine]) }));

    await new Promise(resolve => setTimeout(resolve, 220));
    if (generation !== this._chatGeneration) return;
    const who = this.chatReplyWho(tab, text);
    const replyText = await this.generateChatReply(who, text, tab);
    if (generation !== this._chatGeneration) return;

    if (tab === 'dm') {
      const reply = this.pushSamReply(this.samReply(replyText));
      if (reply) this.setState(s => ({ dm: s.dm.concat([reply]) }));
    } else {
      this.setState(s => ({ chat: s.chat.concat([{ who, text: replyText }]) }));
    }
    const keepError = /offline|failed/i.test(String(this.state.llmStatus || ''));
    this.setState({ chatBusy: false, llmStatus: keepError ? this.state.llmStatus : '' });
    this.log(tab === 'dm' ? '— you texted Nicole' : '— you texted the group');
  },

  async fetchModelBlob(url, label) {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit', redirect: 'follow' });
    if (!response.ok) throw new Error(label + ' HTTP ' + response.status);
    const total = Number(response.headers.get('content-length')) || 37446112;
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
    const quietWarn = /multi-thread|single-thread|special_eos|munmap|n_ctx_per_seq|n_ctx_train|prompt_save|update_slots|context checkpoint|lack of cache|SWA|hybrid\/recurrent/i;
    return new Wllama({ default: wasmUrl }, {
      parallelDownloads: 1,
      allowOffline: false,
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
          'https://huggingface.co/tiiuae/Falcon-H1-Tiny-90M-Instruct-GGUF/resolve/main/Falcon-H1-Tiny-90M-Instruct-Q4_K_M.gguf',
          'https://hf-mirror.com/tiiuae/Falcon-H1-Tiny-90M-Instruct-GGUF/resolve/main/Falcon-H1-Tiny-90M-Instruct-Q4_K_M.gguf'
        ];
        let blob = null;
        let lastError = null;
        for (const url of modelUrls) {
          try {
            blob = await this.fetchModelBlob(url, 'model');
            if (blob && blob.size > 1000000) break;
            throw new Error('model too small');
          } catch (error) {
            lastError = error;
            console.warn('[chat-llm] model fetch failed', url, error);
            blob = null;
          }
        }
        if (!blob) throw lastError || new Error('model download failed');

        this.setLlmStatus(useGpu ? 'Starting model with WebGPU...' : 'Starting model...');
        try {
          await wllama.loadModel([blob], {
            n_threads: 1,
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
            n_threads: 1,
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
            temperature: 0.1,
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
  }
});
