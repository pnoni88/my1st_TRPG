/* ═══════════ AI 게임 마스터 API 어댑터 (Claude / OpenAI / Gemini / 데모) ═══════════ */

const PROVIDERS = {
  claude: {
    name: 'Claude (Anthropic)',
    models: ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5'],
    defaultModel: 'claude-opus-4-8',
    needsKey: true,
    hint: 'API 키는 platform.claude.com 에서 발급할 수 있습니다. 키는 이 브라우저에만 저장되며 외부로 전송되지 않습니다.',
  },
  openai: {
    name: 'ChatGPT (OpenAI)',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1'],
    defaultModel: 'gpt-4o',
    needsKey: true,
    hint: 'API 키는 platform.openai.com 에서 발급할 수 있습니다. 키는 이 브라우저에만 저장되며 외부로 전송되지 않습니다.',
  },
  gemini: {
    name: 'Gemini (Google)',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    defaultModel: 'gemini-2.5-flash',
    needsKey: true,
    hint: 'API 키는 aistudio.google.com 에서 발급할 수 있습니다. 키는 이 브라우저에만 저장되며 외부로 전송되지 않습니다.',
  },
  demo: {
    name: '데모 모드 (API 키 불필요)',
    models: ['demo-gm'],
    defaultModel: 'demo-gm',
    needsKey: false,
    hint: 'API 키 없이 미리 짜여진 짧은 시나리오로 게임 방식을 체험할 수 있습니다.',
  },
};

/**
 * GM에게 메시지 전달. messages: [{role:'user'|'assistant', content:string}]
 * @returns {Promise<string>} GM의 원본 응답 텍스트
 */
async function callAI({ provider, apiKey, model, system, messages }) {
  switch (provider) {
    case 'claude': return callClaude(apiKey, model, system, messages);
    case 'openai': return callOpenAI(apiKey, model, system, messages);
    case 'gemini': return callGemini(apiKey, model, system, messages);
    case 'demo': return callDemo(messages);
    default: throw new Error('알 수 없는 AI 제공자입니다: ' + provider);
  }
}

async function readError(res) {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error?.message || body?.error?.type || JSON.stringify(body).slice(0, 200);
  } catch (e) { /* 무시 */ }
  const known = {
    401: 'API 키가 올바르지 않습니다.',
    403: 'API 키에 권한이 없습니다.',
    429: '요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',
    529: 'AI 서버가 혼잡합니다. 잠시 후 다시 시도해 주세요.',
  };
  const base = known[res.status] || `API 오류 (HTTP ${res.status})`;
  return new Error(detail ? `${base} — ${detail}` : base);
}

/* ── Claude (Anthropic Messages API, 브라우저 직접 호출) ── */
async function callClaude(apiKey, model, system, messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 3000,
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw await readError(res);
  const data = await res.json();
  if (data.stop_reason === 'refusal') {
    throw new Error('AI가 이 요청에 응답할 수 없습니다. 다른 행동을 시도해 주세요.');
  }
  return (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');
}

/* ── OpenAI (Chat Completions) ── */
async function callOpenAI(apiKey, model, system, messages) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': 'Bearer ' + apiKey,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw await readError(res);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/* ── Gemini (generateContent) ── */
async function callGemini(apiKey, model, system, messages) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 4096,
      },
    }),
  });
  if (!res.ok) throw await readError(res);
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map(p => p.text || '').join('');
}

/* ── 데모 모드: 미리 짜여진 짧은 모험 ── */
let demoStep = -1;

function resetDemo() { demoStep = -1; }

async function callDemo(messages) {
  await new Promise(r => setTimeout(r, 700)); // 통신 흉내
  demoStep++;
  const script = [
    {
      narration: '낡은 브라운관 화면에 불이 켜진다. 여러분은 안개가 자욱한 숲의 초입에 서 있다. 앞에는 이끼로 뒤덮인 고대의 석문이 반쯤 열려 있고, 그 틈으로 차가운 바람과 함께 희미한 신음 소리가 새어 나온다. 석문 옆 비석에는 이렇게 새겨져 있다. "욕심 많은 자, 이곳에 잠들다."',
      choices: ['석문 틈으로 조용히 들어간다', '비석을 자세히 조사한다', '큰 소리로 안에 누구 있냐고 외친다'],
      dice_check: null,
      updates: [],
      location: '고대 유적의 입구',
      game_over: null,
    },
    {
      narration: '어둠 속으로 발을 내딛는 순간, 발밑에서 "딸깍" 하는 소리가 들린다. 함정이다! 천장에서 녹슨 쇠창살이 떨어져 내린다. 재빨리 몸을 던져 피해야 한다!',
      choices: [],
      dice_check: { stat: 'DEX', difficulty: 12, reason: '떨어지는 쇠창살을 피하기 위한 민첩 판정' },
      updates: [],
      location: '유적의 어두운 복도',
      game_over: null,
    },
    {
      narration: '먼지가 가라앉자 복도 끝의 넓은 방이 모습을 드러낸다. 방 중앙의 제단 위에 황금 성배가 놓여 있고, 그 앞을 해골 병사 하나가 지키고 서 있다. 해골은 텅 빈 눈구멍으로 여러분을 바라보며 녹슨 검을 치켜든다. 제단 옆 바닥에는 오래된 횃불 하나가 떨어져 있다.',
      choices: ['해골 병사에게 정면으로 돌격한다', '횃불을 주워 무기로 삼는다', '해골에게 말을 걸어본다'],
      dice_check: null,
      updates: [{ player: 1, hp_change: -2, add_items: [], remove_items: [] }],
      location: '성배의 제단',
      game_over: null,
    },
    {
      narration: '치열한 격전 끝에 해골 병사는 뼈 무더기가 되어 무너져 내린다. 하지만 승리의 대가는 있었다. 녹슨 검이 스치며 상처를 남겼다. 이제 황금 성배가 눈앞에 있다. 성배를 집어 드는 순간, 유적 전체가 낮게 울리기 시작한다...',
      choices: ['성배를 들고 전력으로 탈출한다', '성배를 제자리에 두고 떠난다'],
      dice_check: null,
      updates: [{ player: 1, hp_change: -4, add_items: ['녹슨 검'], remove_items: [] }],
      location: '무너지는 제단',
      game_over: null,
    },
    {
      narration: '무너지는 돌기둥 사이를 아슬아슬하게 빠져나와 숲의 공기를 다시 들이마신다. 뒤를 돌아보니 고대 유적은 완전히 무너져 흙먼지 속으로 사라졌다.',
      choices: [],
      dice_check: null,
      updates: [{ player: 1, hp_change: 0, add_items: ['황금 성배'], remove_items: [] }],
      location: '숲의 초입',
      game_over: {
        type: 'victory',
        epilogue: '여러분은 전설 속 황금 성배를 손에 넣고 살아 돌아왔다. 마을 축제에서 이 모험담은 오래도록 회자될 것이다.\n\n※ 데모 시나리오가 끝났습니다. API 키를 등록하면 AI가 실시간으로 만들어내는 무한한 모험을 즐길 수 있습니다!',
      },
    },
  ];
  const step = Math.min(demoStep, script.length - 1);
  return JSON.stringify(script[step]);
}
