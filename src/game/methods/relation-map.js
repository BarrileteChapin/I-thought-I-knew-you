window.GameMethods = Object.assign(window.GameMethods || {}, {
  // Progressive Class 10b map — nodes/edges unlock from what the player has learned.
  relationKnowledge(st) {
    const s = st || this.state;
    const D = s.done || {};
    const day = s.day || 1;
    const clip = day === 3 && s.phase === 'clip';
    const cert1 = (s.certainty && s.certainty[1]) || 'unchecked';
    const searchedParty = !!(s.searched && (s.searched['nicole_party.jpg'] || s.searched['nicole_party_repost.jpg']));
    return {
      youNicole: true,
      benitoEx: true,
      classmates: day >= 1,
      oppose: day >= 1,
      miaInquiry: day >= 1,
      miaQuestions: !!D.d1mia || cert1 === 'hint' || cert1 === 'confirmed',
      whoFilmedAsk: !!D.d1jonas,
      benitoQuiet: day >= 1,
      // Designer truth (Benito filmed) stays soft until the player has asked around.
      benitoFilmedHint: !!D.d1jonas && (day >= 2 || cert1 !== 'unchecked'),
      nele: day >= 2 || clip || day >= 3,
      neleJealous: day >= 2 || clip,
      laura: day >= 2 && (!!D.d2rev || searchedParty || day >= 3)
    };
  },

  playerFaceSrc(st) {
    const s = st || this.state;
    return s.playerAvatar === 'male'
      ? 'assets/av-player-male.webp'
      : 'assets/av-player-female.webp';
  },

  relationMapSelect(id) {
    this.setState(s => ({
      notebookMapFocus: s.notebookMapFocus === id ? null : id
    }));
  },

  relationMapView(st) {
    const s = st || this.state;
    const k = this.relationKnowledge(s);
    const focus = s.notebookMapFocus || null;
    const W = 100;
    const H = 132;

    // Positions in viewBox units (x: 0–W, y: 0–H). Nodes convert y → % of stage height.
    // Keep Laura high enough that name + "(off-screen)" stay inside .g-rmap.
    const pos = {
      you: { x: 18, y: 18 },
      nicole: { x: 50, y: 42 },
      benito: { x: 82, y: 18 },
      mia: { x: 18, y: 52 },
      nele: { x: 22, y: 88 },
      hanna: { x: 78, y: 62 },
      lea: { x: 78, y: 86 },
      laura: { x: 50, y: 112 }
    };

    // Avatar radius in viewBox units (approx. for non-square stretch) — shorten lines to the rim.
    const radiusOf = (id) => (id === 'you' || id === 'nicole') ? 11 : 8.5;

    const node = (id, label, ring, avatar, unlocked, extra) => {
      const p = pos[id];
      const hero = id === 'you' || id === 'nicole';
      return Object.assign({
        id,
        label,
        ring,
        avatar: avatar || '',
        unlocked: !!unlocked,
        locked: !unlocked,
        x: p.x,
        y: p.y,
        left: (p.x / W * 100) + '%',
        top: (p.y / H * 100) + '%',
        selected: focus === id,
        select: () => this.relationMapSelect(id),
        isLaura: id === 'laura',
        isYou: id === 'you',
        hero,
        offscreen: !!extra && !!extra.offscreen,
        onscreen: !(extra && extra.offscreen)
      }, extra || {});
    };

    const nodes = [
      node('you', 'You', '#1B4FE0', this.playerFaceSrc(s), true),
      node('nicole', 'Nicole', '#E07A3D', this.faceOf('Nicole'), true),
      node('benito', 'Benito', '#8A8580', this.faceOf('Benito'), k.benitoEx),
      node('mia', 'Mia', '#00B89C', this.faceOf('Mia'), k.classmates),
      node('nele', 'Nele', '#A39E98', this.faceOf('Nele'), k.nele),
      node('hanna', 'Hanna', '#E01B1B', this.faceOf('Hanna'), k.classmates),
      node('lea', 'Lea', '#E01B1B', this.faceOf('Lea'), k.classmates),
      node('laura', 'Laura', '#B0A99E', '', k.laura, { offscreen: true, sub: '(off-screen)' })
    ].map(n => Object.assign(n, {
      nodeClass: [
        'g-rmap-node',
        n.unlocked ? 'is-open' : 'is-locked',
        n.selected ? 'is-selected' : '',
        n.hero ? 'is-hero' : '',
        n.small ? 'is-small' : '',
        n.offscreen ? 'is-offscreen' : ''
      ].filter(Boolean).join(' ')
    }));

    const edgeEnds = (a, b) => {
      const A = pos[a];
      const B = pos[b];
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const rA = radiusOf(a);
      const rB = radiusOf(b);
      if (len <= rA + rB + 0.5) {
        return { x1: A.x, y1: A.y, x2: B.x, y2: B.y };
      }
      const ux = dx / len;
      const uy = dy / len;
      return {
        x1: A.x + ux * rA,
        y1: A.y + uy * rA,
        x2: B.x - ux * rB,
        y2: B.y - uy * rB
      };
    };

    const edge = (id, a, b, kind, unlocked) => {
      const A = pos[a];
      const B = pos[b];
      if (!A || !B || !unlocked) return null;
      const lit = !focus || focus === a || focus === b;
      const dim = !!focus && !lit;
      const ends = edgeEnds(a, b);
      return {
        id,
        a,
        b,
        kind,
        x1: ends.x1, y1: ends.y1, x2: ends.x2, y2: ends.y2,
        isStrong: kind === 'strong',
        isSupport: kind === 'support',
        isDash: kind === 'dash',
        isPressure: kind === 'pressure',
        isMates: kind === 'mates',
        notPressure: kind !== 'pressure',
        lit,
        dim,
        lineClass: [
          'g-rmap-line',
          'is-' + kind,
          lit ? 'is-lit' : '',
          dim ? 'is-dim' : ''
        ].filter(Boolean).join(' ')
      };
    };

    const edges = [
      edge('e-you-nic', 'you', 'nicole', 'strong', k.youNicole),
      edge('e-you-mia', 'you', 'mia', 'support', k.miaInquiry),
      edge('e-mia-nic', 'mia', 'nicole', 'support', k.miaInquiry),
      edge('e-nic-ben', 'nicole', 'benito', 'dash', k.benitoEx),
      edge('e-nic-nele', 'nicole', 'nele', 'dash', k.neleJealous),
      edge('e-han-lea', 'hanna', 'lea', 'mates', k.classmates),
      edge('e-han-nic', 'hanna', 'nicole', 'pressure', k.oppose && !!s.openedGroup),
      edge('e-lea-nic', 'lea', 'nicole', 'pressure', k.oppose && !!s.openedGroup)
    ].filter(Boolean);

    const notes = [];
    const legend = [
      { id: 'lg-strong', label: 'close / best friends', swatch: 'strong', on: k.youNicole },
      { id: 'lg-mates', label: 'usually together', swatch: 'mates', on: k.classmates },
      { id: 'lg-dash', label: 'complicated', swatch: 'dash', on: k.benitoEx || k.neleJealous },
      { id: 'lg-support', label: 'asking / checking', swatch: 'support', on: k.miaInquiry },
      { id: 'lg-pressure', label: 'against her in chat', swatch: 'pressure', on: k.oppose && !!s.openedGroup }
    ].filter(l => l.on).map(l => Object.assign(l, {
      swatchClass: 'g-rmap-swatch is-' + l.swatch
    }));

    const openedGroup = !!s.openedGroup;
    const day = s.day || 1;

    // Diary voice only — what you could reasonably write from intro / chats / checks.
    const facts = {
      you: [
        'That\'s you — ' + this.name() + '.',
        k.youNicole ? 'Nicole\'s been your best friend since year 7. You walk home together most days.' : null
      ],
      nicole: [
        'Nicole Kruger — your closest friend in 10b.',
        k.youNicole ? 'You\'ve been best friends since year 7.' : null,
        k.benitoEx ? 'Her ex Benito is in 10b too. They were together about eight months; it ended roughly six months ago.' : null,
        openedGroup && day >= 1 ? 'The group chat is full of stuff about her this week.' : null,
        k.neleJealous && day >= 2 && openedGroup
          ? 'People keep bringing Nele into it — Hanna said Nele was crying at home when the photo went round.'
          : null,
        k.neleJealous && (day >= 3 || (day === 3 && s.phase === 'clip'))
          ? 'There was a voice note that tried to pin jealousy on her and Nele.'
          : null
      ],
      benito: [
        k.benitoEx
          ? 'Nicole\'s ex. You already knew he\'s in 10b — same year, same chat.'
          : null,
        k.benitoEx
          ? 'Eight months together, over about six months ago. It was messy for a while; it isn\'t really anymore — or that\'s how it looked before this week.'
          : null,
        openedGroup && k.benitoQuiet
          ? 'In the group he barely says anything when the clip / photo / account stuff kicks off.'
          : null,
        k.whoFilmedAsk
          ? 'You asked who filmed the party clip. Nobody gave a clear answer.'
          : null
      ],
      mia: [
        'Mia. Same class group.',
        openedGroup && day >= 1
          ? 'She\'s in the chat when the video lands.'
          : null,
        openedGroup && day >= 1
          ? 'The clip is from a party. If anyone there might remember what was actually said, it\'s her.'
          : null,
        k.miaQuestions
          ? 'You asked her. She doesn\'t think the clip is the whole story — someone else said that, or it\'s not what happened.'
          : null
      ],
      hanna: [
        'Hanna. Same year — she\'s in the class group.',
        'She and Lea are usually together.'
      ],
      lea: [
        'Lea. Same year — she\'s in the class group.',
        'She and Hanna are usually together.'
      ],
      nele: [
        day >= 2 && openedGroup
          ? 'Nele. Hanna brought her up with the photo — said Nele was at home crying.'
          : (k.nele ? 'Nele\'s name has started showing up around Nicole.' : null),
        k.neleJealous && day >= 2 && openedGroup
          ? 'You don\'t know the full story between Nicole and Nele — only what people are implying in chat.'
          : null
      ],
      laura: [
        k.laura
          ? 'Laura isn\'t really in this week\'s chat — but the photo reverse-search pointed at her birthday last summer.'
          : null
      ]
    };

    const focusNode = nodes.find(n => n.id === focus);
    const focusFacts = (facts[focus] || []).filter(Boolean);
    const knownCount = nodes.filter(n => n.unlocked).length;

    return {
      nodes,
      edges,
      notes,
      legend,
      hasFocus: !!focusNode,
      noFocus: !focusNode,
      focusName: focusNode ? focusNode.label : '',
      focusFacts: focusFacts.map((t, i) => ({ id: 'f' + i, text: t })),
      focusEmpty: !(focusNode && focusNode.unlocked) || !focusFacts.length,
      hint: knownCount <= 3
        ? 'As you check things this week, more of the class map fills in.'
        : 'Tap someone for more detail.',
      vbW: W,
      vbH: H
    };
  }
});
