/* ═══════════ 게임 상태 · GM 프로토콜 · 진행 로직 ═══════════ */

const SAVE_KEY = 'retroquest_save_v1';
const KEYS_KEY = 'retroquest_apikeys_v1';

const STAT_NAMES = { STR: '힘', DEX: '민첩', INT: '지혜', CHA: '매력' };

const THEMES = {
  fantasy: {
    icon: '⚔', name: '판타지 왕국', desc: '용과 마법, 던전과 보물이 기다리는 정통 판타지',
    classes: ['전사', '마법사', '도적', '성직자'],
  },
  cyberpunk: {
    icon: '🌃', name: '사이버펑크 2199', desc: '네온 불빛의 메가시티, 거대 기업과 해커들의 세계',
    classes: ['용병', '넷러너', '해결사', '기술자'],
  },
  horror: {
    icon: '👁', name: '코즈믹 호러', desc: '1920년대, 인간의 이해를 넘어선 존재들의 그림자',
    classes: ['탐정', '의사', '기자', '오컬티스트'],
  },
  wuxia: {
    icon: '🗡', name: '무협 강호', desc: '검과 협의 강호, 무림 문파들의 은원이 얽힌 세계',
    classes: ['검객', '도사', '낭인', '의원'],
  },
  custom: {
    icon: '✎', name: '직접 만들기', desc: '원하는 세계관을 자유롭게 설명해 주세요',
    classes: [],
  },
};

/* ── 게임 상태 ── */
let G = null;

function newGameState() {
  return {
    provider: 'demo',
    model: 'demo-gm',
    apiKey: '',
    playerCount: 1,
    themeKey: 'fantasy',
    customTheme: '',
    players: [],       // {name, cls, stats:{STR,DEX,INT,CHA}, hp, maxHp, inventory:[]}
    history: [],       // API용 [{role, content}]
    logEntries: [],    // 화면 로그 복원용 [{type, text}]
    turn: 1,
    activePlayer: 0,   // 인덱스
    location: '???',
    pendingChoices: [],
    pendingDiceCheck: null,
    gameOver: null,
    startedAt: Date.now(),
    playTimeMs: 0,       // 저장 시점까지 누적된 플레이 시간
    sessionStartAt: null, // 이번 세션 시작 시각 (저장 안 됨)
    actionLog: [],       // 아카이브용 [{turn, player, text, kind:'choice'|'input'|'dice'}]
    stats: { choices: 0, inputs: 0, rolls: 0, successes: 0, crits: 0, fumbles: 0 },
  };
}

/* ── 플레이 타임 ── */
function currentPlayTimeMs() {
  const base = G.playTimeMs || 0;
  return base + (G.sessionStartAt ? Date.now() - G.sessionStartAt : 0);
}

function fmtPlayTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

/* ── 엔딩 통계 집계 ── */
function computeEndStats() {
  const st = G.stats || {};
  const rolls = st.rolls || 0;
  return {
    playTimeMs: currentPlayTimeMs(),
    playTimeText: fmtPlayTime(currentPlayTimeMs()),
    turns: Math.max(1, G.turn - 1),
    choices: st.choices || 0,
    inputs: st.inputs || 0,
    rolls,
    successes: st.successes || 0,
    successRate: rolls ? Math.round(((st.successes || 0) / rolls) * 100) : null,
    crits: st.crits || 0,
    fumbles: st.fumbles || 0,
  };
}

function themeName() {
  return G.themeKey === 'custom' ? (G.customTheme.slice(0, 30) || '커스텀 세계') : THEMES[G.themeKey].name;
}

function statMod(v) { return Math.floor((v - 10) / 2); }
function fmtMod(m) { return (m >= 0 ? '+' : '') + m; }
function rollDie(sides) { return 1 + Math.floor(Math.random() * sides); }
function roll3d6() { return rollDie(6) + rollDie(6) + rollDie(6); }

/* ── GM 시스템 프롬프트 ── */
function buildSystemPrompt() {
  const themeDesc = G.themeKey === 'custom'
    ? `사용자가 직접 정의한 세계관: ${G.customTheme}`
    : `${THEMES[G.themeKey].name} — ${THEMES[G.themeKey].desc}`;

  const playerDesc = G.players.map((p, i) =>
    `- 플레이어 ${i + 1}: ${p.name} (${p.cls}) | HP ${p.hp}/${p.maxHp} | 힘 ${p.stats.STR}(${fmtMod(statMod(p.stats.STR))}) 민첩 ${p.stats.DEX}(${fmtMod(statMod(p.stats.DEX))}) 지혜 ${p.stats.INT}(${fmtMod(statMod(p.stats.INT))}) 매력 ${p.stats.CHA}(${fmtMod(statMod(p.stats.CHA))})`
  ).join('\n');

  return `당신은 텍스트 기반 TRPG의 노련한 게임 마스터(GM)입니다. 레트로 게임 특유의 모험심 넘치는 분위기로, 한국어로 게임을 진행합니다.

## 세계관
${themeDesc}

## 플레이어 (${G.playerCount}인)
${playerDesc}

## 게임 규칙
- d20 판정: 주사위(1~20) + 능력치 보정치 >= 난이도 이면 성공. 20은 대성공, 1은 대실패.
- 능력치 보정치 = (능력치 - 10) / 2 내림. 능력치 키: STR(힘), DEX(민첩), INT(지혜), CHA(매력).
- 결과가 불확실하고 실패 시 대가가 있는 행동에만 주사위 판정을 요구하세요. 난이도 가이드: 쉬움 8, 보통 12, 어려움 16, 매우 어려움 20.
- 플레이어가 피해를 입으면 hp_change로 반영하세요 (보통 -1~-5, 치명적이면 -6 이상).
- HP가 0이 되면 그 캐릭터는 쓰러집니다. 전원이 쓰러지면 게임 오버(defeat)를 선언하세요.
- 이야기는 기승전결을 갖추고, 대략 15~25턴 안에 자연스러운 결말(victory 또는 defeat)에 도달하도록 전개하세요.
- 플레이어가 2인일 경우 두 캐릭터 모두 이야기에 참여시키고, 행동한 플레이어를 중심으로 서술하세요.
- 플레이어의 자유 입력이 불가능하거나 세계관에 어긋나면, 시도가 실패하는 과정을 재미있게 묘사하세요. 절대 플레이어를 대신해 결정하지 마세요.

## 응답 형식 (매우 중요)
반드시 아래 스키마의 JSON 객체 **하나만** 출력하세요. JSON 외의 텍스트, 마크다운 코드펜스, 주석을 절대 포함하지 마세요.

{
  "narration": "상황 묘사 (3~6문장, 생생하고 몰입감 있게)",
  "choices": ["선택지1", "선택지2", "선택지3"],
  "dice_check": null,
  "updates": [],
  "location": "현재 위치 (간결하게)",
  "game_over": null
}

필드 규칙:
- "choices": 항상 2~4개 제시. 단, dice_check가 있거나 game_over일 때는 빈 배열 [].
- "dice_check": 판정이 필요할 때만 {"stat": "STR|DEX|INT|CHA", "difficulty": 숫자, "reason": "판정 이유"} 형태. 판정 대상은 방금 행동한 플레이어입니다. 필요 없으면 null.
- "updates": HP나 소지품 변화가 있을 때만 [{"player": 플레이어번호(1부터), "hp_change": 정수, "add_items": ["아이템"], "remove_items": ["아이템"]}] 형태. 없으면 [].
- "game_over": 이야기가 끝났을 때만 {"type": "victory" 또는 "defeat", "epilogue": "에필로그 (3~5문장)"}. 아니면 null.`;
}

/* ── 첫 시작 메시지 ── */
function buildStartMessage() {
  const names = G.players.map((p, i) => `${p.name}(${p.cls})`).join(', ');
  return `[게임 시작] 플레이어: ${names}. 세계관에 맞는 흥미진진한 도입부와 함께 모험을 시작해 주세요. 첫 장면을 묘사하고 선택지를 제시하세요.`;
}

/* ── GM 응답 파싱 (관대한 파서) ── */
function parseGMResponse(raw) {
  let text = String(raw || '').trim();
  // 코드펜스 제거
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

  let data = null;
  try {
    data = JSON.parse(text);
  } catch (e) {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last > first) {
      try { data = JSON.parse(text.slice(first, last + 1)); } catch (e2) { /* 아래 폴백 */ }
    }
  }

  if (!data || typeof data !== 'object' || typeof data.narration !== 'string') {
    // JSON 파싱 실패: 원문을 내레이션으로 취급
    return {
      narration: text || '(GM의 응답을 이해하지 못했습니다. 다시 행동을 입력해 주세요.)',
      choices: [],
      dice_check: null,
      updates: [],
      location: G.location,
      game_over: null,
    };
  }

  // 필드 정규화
  const out = {
    narration: data.narration,
    choices: Array.isArray(data.choices) ? data.choices.filter(c => typeof c === 'string').slice(0, 4) : [],
    dice_check: null,
    updates: Array.isArray(data.updates) ? data.updates : [],
    location: typeof data.location === 'string' && data.location ? data.location : G.location,
    game_over: null,
  };
  const dc = data.dice_check;
  if (dc && typeof dc === 'object' && STAT_NAMES[dc.stat]) {
    out.dice_check = {
      stat: dc.stat,
      difficulty: Math.max(2, Math.min(30, parseInt(dc.difficulty, 10) || 12)),
      reason: typeof dc.reason === 'string' ? dc.reason : '판정이 필요합니다',
    };
  }
  const go = data.game_over;
  if (go && typeof go === 'object' && (go.type === 'victory' || go.type === 'defeat')) {
    out.game_over = { type: go.type, epilogue: typeof go.epilogue === 'string' ? go.epilogue : '' };
  }
  return out;
}

/* ── 상태 업데이트 적용 ── */
function applyUpdates(updates) {
  const notes = [];
  for (const u of updates) {
    const idx = (parseInt(u.player, 10) || 1) - 1;
    const p = G.players[idx];
    if (!p) continue;
    const hpChange = parseInt(u.hp_change, 10) || 0;
    if (hpChange !== 0) {
      p.hp = Math.max(0, Math.min(p.maxHp, p.hp + hpChange));
      notes.push(`${p.name} HP ${hpChange > 0 ? '+' : ''}${hpChange} → ${p.hp}/${p.maxHp}`);
      if (hpChange < 0) RetroAudio.damage();
    }
    for (const item of (u.add_items || [])) {
      if (typeof item === 'string' && item) { p.inventory.push(item); notes.push(`${p.name} 획득: ${item}`); }
    }
    for (const item of (u.remove_items || [])) {
      const i = p.inventory.indexOf(item);
      if (i !== -1) { p.inventory.splice(i, 1); notes.push(`${p.name} 상실: ${item}`); }
    }
  }
  return notes;
}

function allPlayersDown() {
  return G.players.length > 0 && G.players.every(p => p.hp <= 0);
}

/* ── 히스토리 관리 (토큰 절약: 최초 1개 + 최근 30개 유지) ── */
function trimmedHistory() {
  const h = G.history;
  if (h.length <= 31) return h;
  return [h[0], ...h.slice(h.length - 30)];
}

/* ── 현재 파티 상태 요약 (매 턴 GM에게 전달) ── */
function partySnapshot() {
  return G.players.map((p, i) =>
    `P${i + 1} ${p.name}: HP ${p.hp}/${p.maxHp}${p.hp <= 0 ? ' [쓰러짐]' : ''}, 소지품: ${p.inventory.join(', ') || '없음'}`
  ).join(' / ');
}

/* ── GM에게 행동 전달 (핵심 루프) ── */
async function sendToGM(playerText, { isSystemEvent = false } = {}) {
  if (G.gameOver) return;

  const content = isSystemEvent
    ? playerText
    : `[${G.players[G.activePlayer].name}의 행동] ${playerText}\n\n(현재 상태: ${partySnapshot()} / 위치: ${G.location} / ${G.turn}번째 턴)`;

  G.history.push({ role: 'user', content });

  UI.setThinking(true);
  UI.lockInputs(true);

  let parsed;
  try {
    const raw = await callAI({
      provider: G.provider,
      apiKey: G.apiKey,
      model: G.model,
      system: buildSystemPrompt(),
      messages: trimmedHistory(),
    });
    G.history.push({ role: 'assistant', content: raw });
    parsed = parseGMResponse(raw);
  } catch (err) {
    G.history.pop(); // 실패한 user 메시지 롤백
    UI.setThinking(false);
    UI.lockInputs(false);
    UI.addLog('system', '⚠ ' + (err.message || '통신 오류가 발생했습니다.') + ' 다시 시도해 주세요.');
    UI.restorePendingUI();
    return;
  }

  UI.setThinking(false);

  // 상태 반영
  const notes = applyUpdates(parsed.updates);
  G.location = parsed.location;
  G.pendingChoices = parsed.choices;
  G.pendingDiceCheck = parsed.dice_check;
  G.turn++;

  // GM이 게임오버를 선언하지 않았어도 전멸이면 강제 종료
  if (!parsed.game_over && allPlayersDown()) {
    parsed.game_over = { type: 'defeat', epilogue: '모험가들은 모두 쓰러졌다. 이들의 이야기는 여기서 끝나지만, 전설은 다른 이들에 의해 이어질 것이다...' };
  }
  G.gameOver = parsed.game_over;

  // 화면 출력
  await UI.typeNarration(parsed.narration);
  for (const n of notes) UI.addLog('system', '· ' + n);

  UI.renderParty();
  UI.updateHud();

  if (G.gameOver) {
    saveGame(); // 마지막 상태 저장 후
    clearSave();
    UI.showGameOver(G.gameOver);
    return;
  }

  // 2인 플레이: 다음 행동 플레이어로 교대 (단, 주사위 판정은 방금 행동한 플레이어가 굴림)
  if (!G.pendingDiceCheck && G.playerCount === 2) {
    let next = (G.activePlayer + 1) % 2;
    if (G.players[next].hp <= 0) next = G.activePlayer; // 쓰러진 플레이어는 건너뜀
    G.activePlayer = next;
  }

  UI.lockInputs(false);
  UI.restorePendingUI();
  saveGame();
}

/* ── 주사위 판정 실행 ── */
function resolveDiceCheck(rollValue) {
  const dc = G.pendingDiceCheck;
  if (!dc) return null;
  const p = G.players[G.activePlayer];
  const mod = statMod(p.stats[dc.stat]);
  const total = rollValue + mod;
  const crit = rollValue === 20;
  const fumble = rollValue === 1;
  const success = crit || (!fumble && total >= dc.difficulty);

  let resultText;
  if (crit) resultText = '대성공!!';
  else if (fumble) resultText = '대실패...';
  else resultText = success ? '성공!' : '실패...';

  G.stats.rolls++;
  if (success) G.stats.successes++;
  if (crit) G.stats.crits++;
  if (fumble) G.stats.fumbles++;
  G.actionLog.push({
    turn: G.turn, player: p.name, kind: 'dice',
    text: `${STAT_NAMES[dc.stat]} 판정 d20[${rollValue}]${fmtMod(mod)}=${total} vs ${dc.difficulty} → ${resultText}`,
  });

  const logLine = `🎲 ${p.name}의 ${STAT_NAMES[dc.stat]} 판정: d20 [${rollValue}] ${fmtMod(mod)} = ${total} vs 난이도 ${dc.difficulty} → ${resultText}`;
  const gmMessage = `[주사위 판정 결과] ${p.name}의 ${STAT_NAMES[dc.stat]}(${dc.stat}) 판정: d20에서 ${rollValue}가 나왔고 보정치 ${fmtMod(mod)}를 더해 총 ${total}. 난이도 ${dc.difficulty} 대비 ${resultText} ${crit ? '(대성공: 기대 이상의 극적인 결과로 묘사)' : ''}${fumble ? '(대실패: 예상치 못한 불운한 결과로 묘사)' : ''} 이 결과를 반영해 이야기를 이어가 주세요.`;

  G.pendingDiceCheck = null;
  return { logLine, gmMessage, success };
}

/* ── 세이브 / 로드 ── */
function saveGame() {
  if (!G || G.gameOver) return;
  try {
    const data = { ...G };
    if (!shouldSaveKey()) data.apiKey = '';
    data.playTimeMs = currentPlayTimeMs();
    data.sessionStartAt = null;
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* 저장 실패는 치명적이지 않음 */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.players || !data.history) return null;
    // 구버전 세이브 호환
    if (!data.stats) data.stats = { choices: 0, inputs: 0, rolls: 0, successes: 0, crits: 0, fumbles: 0 };
    if (!Array.isArray(data.actionLog)) data.actionLog = [];
    if (typeof data.playTimeMs !== 'number') data.playTimeMs = 0;
    if (!data.startedAt) data.startedAt = Date.now();
    data.sessionStartAt = null;
    return data;
  } catch (e) { return null; }
}

function hasSave() { return !!loadGame(); }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

function shouldSaveKey() {
  const chk = document.getElementById('chk-savekey');
  return chk ? chk.checked : true;
}

function saveApiKey(provider, key) {
  try {
    const all = JSON.parse(localStorage.getItem(KEYS_KEY) || '{}');
    all[provider] = key;
    localStorage.setItem(KEYS_KEY, JSON.stringify(all));
  } catch (e) {}
}

function loadApiKey(provider) {
  try {
    const all = JSON.parse(localStorage.getItem(KEYS_KEY) || '{}');
    return all[provider] || '';
  } catch (e) { return ''; }
}
