(function () {
  async function readJson(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(path + ' returned HTTP ' + response.status);
    return response.json();
  }

  window.loadGameData = async function () {
    const root = './content/';
    const [intro, dmOptions, day1, day2, day3, day4, dayYou, pushback, variants] = await Promise.all([
      readJson(root + 'conversations/intro.json'),
      readJson(root + 'conversations/dm-options.json'),
      readJson(root + 'conversations/day-1.json'),
      readJson(root + 'conversations/day-2.json'),
      readJson(root + 'conversations/day-3.json'),
      readJson(root + 'conversations/day-4.json'),
      readJson(root + 'conversations/day-you.json'),
      readJson(root + 'rules/pushback.json'),
      readJson(root + 'rules/variants.json')
    ]);

    window.GameData = {
      conversations: {
        P_GROUP_1: intro.groupPrelude,
        DAYS: { 1: day1, 2: day2, 3: day3, 4: day4 },
        BACKSTORY: intro.backstory,
        P_LOG: intro.messages,
        DM_HISTORY: intro.dmHistory,
        DM_OPTIONS: dmOptions,
        REC_LINES: intro.recordingLines,
        REC_LINES_OLD: intro.recordingLinesOld,
        DAY_YOU: dayYou,
        CINE_SCENES: intro.cineScenes
      },
      rules: {
        PUSHBACK: pushback,
        VARIANTS: variants
      }
    };

    return window.GameData;
  };
}());
