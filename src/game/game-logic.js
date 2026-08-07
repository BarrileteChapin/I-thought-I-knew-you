class Component extends DCLogic {
  msgRef = React.createRef();
  markRef = React.createRef();

  P_GROUP_1 = window.GameData.conversations.P_GROUP_1;
  DAYS = window.GameData.conversations.DAYS;
  BACKSTORY = window.GameData.conversations.BACKSTORY;
  P_LOG = window.GameData.conversations.P_LOG;
  DM_HISTORY = window.GameData.conversations.DM_HISTORY;
  DM_OPTIONS = window.GameData.conversations.DM_OPTIONS;
  REC_LINES = window.GameData.conversations.REC_LINES;
  REC_LINES_OLD = window.GameData.conversations.REC_LINES_OLD;
  DAY_YOU = window.GameData.conversations.DAY_YOU;
  CINE_SCENES = window.GameData.conversations.CINE_SCENES;
  PUSHBACK = window.GameData.rules.PUSHBACK;
  VARIANTS = window.GameData.rules.VARIANTS;

  clips = [];
  introRef = React.createRef();
  nameRef = React.createRef();
  LLM_CHAT_ENABLED = true;

  state = {
    screen: 'cinematic', day: 1, min: 21 * 60 + 40, unread: 0, photoUp: true,
    cinePhase: 'gate', cineIdx: 0, cineActive: false, cineMuted: false, cineFlash: false,
    msgToast: null, msgToastVisible: false, socToast: null, socToastVisible: false, cameraPush: false, dayEnter: false,
    tab: 'group', confirmSleep: false, chat: [], dm: [], sharedCount: 3,
    hints: { 1: [], 2: [], 3: [], 4: [], 5: [] }, certainty: { 1: 'unchecked', 2: 'unchecked', 3: 'unchecked', 4: 'unchecked', 5: 'unchecked' },
    done: {}, used: {}, loading: null, loadingPct: 0, credibility: 0,
    credibilityLost: false, actedToday: false, openedGroup: false, ignored: false,
    dmAnsweredToday: false, shareTick: 0, shareHalved: false, fading: false,
    tool: 'player', socTab: 'feed', socProfileKey: null, socPostId: null, mediaOpen: null, seen: {}, zoom: false, dev: null, threadOpen: null, galleryNew: false, chatFlash: false,
    lastRead: { group: 0, dm: 0 }, newMarkAt: null, showNewPill: false,
    writeIn: false, writeText: '', writeStatus: null, chatDraft: '', chatBusy: false, llmStatus: '', actionsOpen: false, chatGroupLeft: 4, chatDmLeft: 3, llmUsedReplies: [], llmReplySeed: 0,
    dragItem: null, pickIdx: null, pickerOpen: false, pickerMode: 'search', searched: {}, aiPickIdx: null, aiStage: 'idle', aiStep: 0, actionLog: [], reactionTimes: [],
    arrival: 0, reactedToday: false, samSilent: false, apology: false,
    reported: false, clipBack: false, phase: 'evening', groupUnread: 0, final: { post: null, fwd: null, tell: null },
    sam: 50, group: 50, pushIdx: 0, flashSam: false, flashGroup: false, samDead: false, reason: '',
    voiceSent: false, pStage: -1, introLine: 0, introMsg: 0, introTyping: false, introReady: false,
    pendingDay: 1, cardPhase: 'evening', cardDayName: '', cardWhen: '', variant: 0,
    playerName: 'Alex', nameDraft: '', playerAvatar: null,
    dmCloseTyping: false, dmCloseExtra: null, dmCloseReady: false, replayShown: false,
    dmGhostTyping: false, ghostTypedToday: false, onReadCharged: false,
    shotOpen: null, sawFake: false, sawReal: false, reportOpen: false, reportChoice: null, reportedWrong: false, tip: null,
    profMenuOpen: false, reportReasonOpen: false, reportToast: false, reportedAccounts: {}, reportedFake: false,
    saved: [], toast: false, feedImg: null,
    recOpen: false, recPhase: 'intro', recIdx: 0, recBusy: false, recLevel: 0, hasRecording: false, recTrying: false, recAttempts: 0,
    minCheck: 0, minReact: 0, postsWith: 0, postsWithout: 0, dmChances: 0, endStep: 1, gamePhase: 'playing',
    postedWed: false,
    stats: { forwards: 0, reacts: 0, checks: 0, fast: 0, dmAnswered: 0, believed: 0, dismissed: 0, stopped: 0, fastest: null, sift: { investigate: 0, coverage: 0, trace: 0 } }
  };
}

Object.assign(Component.prototype, window.GameMethods || {});
