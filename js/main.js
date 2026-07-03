/* ═══════════ 화면 연결 · 이벤트 배선 ═══════════ */

(() => {
  const $ = id => document.getElementById(id);

  /* ────── 타이틀 화면 ────── */
  function refreshTitleButtons() {
    $('btn-continue').style.display = hasSave() ? 'inline-block' : 'none';
  }

  $('btn-new-game').addEventListener('click', () => {
    RetroAudio.confirm();
    G = newGameState();
    initSetupScreen();
    UI.showScreen('screen-setup');
  });

  $('btn-continue').addEventListener('click', () => {
    const data = loadGame();
    if (!data) { refreshTitleButtons(); return; }
    RetroAudio.confirm();
    G = data;
    if (!G.apiKey && PROVIDERS[G.provider].needsKey) {
      G.apiKey = loadApiKey(G.provider);
    }
    if (G.provider === 'demo') resetDemo();
    enterGameScreen({ restored: true });
  });

  /* ────── 설정 화면 ────── */
  const selProvider = $('sel-provider');
  const selModel = $('sel-model');

  function initSetupScreen() {
    // 제공자 목록
    selProvider.innerHTML = '';
    for (const [key, p] of Object.entries(PROVIDERS)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = p.name;
      selProvider.appendChild(opt);
    }
    selProvider.value = 'claude';
    onProviderChange();

    // 게임 길이
    const lenGrid = $('length-grid');
    lenGrid.innerHTML = '';
    for (const [key, l] of Object.entries(GAME_LENGTHS)) {
      const card = document.createElement('button');
      card.className = 'length-card' + (key === 'standard' ? ' selected' : '');
      card.dataset.length = key;
      card.innerHTML = `<span class="l-name">${l.icon} ${l.name}</span><span class="l-time">${l.time} · ${l.turns[0]}~${l.turns[1]}턴</span><span class="l-desc">${l.desc}</span>`;
      card.addEventListener('click', () => {
        RetroAudio.select();
        lenGrid.querySelectorAll('.length-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
      lenGrid.appendChild(card);
    }

    // 도파민 모드
    dopamineLevel = 0;
    refreshDopamine();

    // 테마 그리드
    const grid = $('theme-grid');
    grid.innerHTML = '';
    for (const [key, t] of Object.entries(THEMES)) {
      const card = document.createElement('button');
      card.className = 'theme-card' + (key === 'fantasy' ? ' selected' : '');
      card.dataset.theme = key;
      card.innerHTML = `<span class="t-icon">${t.icon}</span><span class="t-name">${t.name}</span><span class="t-desc">${t.desc}</span>`;
      card.addEventListener('click', () => {
        RetroAudio.select();
        grid.querySelectorAll('.theme-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        $('inp-custom-theme').style.display = key === 'custom' ? 'block' : 'none';
      });
      grid.appendChild(card);
    }
    $('inp-custom-theme').style.display = 'none';
    $('setup-error').textContent = '';
  }

  function onProviderChange() {
    const p = PROVIDERS[selProvider.value];
    selModel.innerHTML = '';
    for (const m of p.models) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      selModel.appendChild(opt);
    }
    selModel.value = p.defaultModel;
    $('row-apikey').style.display = p.needsKey ? 'flex' : 'none';
    $('provider-hint').textContent = p.hint;
    $('inp-apikey').value = loadApiKey(selProvider.value);
  }

  selProvider.addEventListener('change', () => { RetroAudio.select(); onProviderChange(); });

  /* ── 도파민 모드 스테퍼 ── */
  let dopamineLevel = 0;

  function refreshDopamine() {
    const lvl = $('dopa-level');
    const desc = $('dopa-desc');
    if (dopamineLevel === 0) {
      lvl.textContent = 'OFF';
      lvl.className = '';
      desc.textContent = '평범한 모험가의 길';
    } else {
      lvl.textContent = dopamineLevel >= DOPAMINE_MAX ? 'MAX' : `Lv.${dopamineLevel}`;
      lvl.className = 'dopa-on';
      const pct = (dopamineLevel + 1) * 5;
      desc.textContent = dopamineLevel >= DOPAMINE_MAX
        ? `대성공 ${20 - dopamineLevel}~20 · 대실패 1~${1 + dopamineLevel} (각 ${pct}%) — 한계까지 짜릿하게!`
        : `대성공 ${20 - dopamineLevel}~20 · 대실패 1~${1 + dopamineLevel} (각 ${pct}%)`;
    }
    $('dopa-minus').disabled = dopamineLevel <= 0;
    $('dopa-plus').disabled = dopamineLevel >= DOPAMINE_MAX;
  }

  $('dopa-minus').addEventListener('click', () => {
    if (dopamineLevel <= 0) return;
    dopamineLevel--;
    RetroAudio.select();
    refreshDopamine();
  });
  $('dopa-plus').addEventListener('click', () => {
    if (dopamineLevel >= DOPAMINE_MAX) return;
    dopamineLevel++;
    RetroAudio.select();
    refreshDopamine();
  });

  document.querySelectorAll('.player-count').forEach(btn => {
    btn.addEventListener('click', () => {
      RetroAudio.select();
      document.querySelectorAll('.player-count').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  $('btn-setup-back').addEventListener('click', () => {
    RetroAudio.select();
    refreshTitleButtons();
    UI.showScreen('screen-title');
  });

  $('btn-setup-next').addEventListener('click', () => {
    const err = $('setup-error');
    const provider = selProvider.value;
    const p = PROVIDERS[provider];
    const key = $('inp-apikey').value.trim();

    if (p.needsKey && !key) {
      err.textContent = '⚠ API 키를 입력해 주세요. (키 없이 체험하려면 "데모 모드"를 선택하세요)';
      return;
    }
    const themeCard = document.querySelector('.theme-card.selected');
    const themeKey = themeCard ? themeCard.dataset.theme : 'fantasy';
    if (themeKey === 'custom' && !$('inp-custom-theme').value.trim()) {
      err.textContent = '⚠ 커스텀 세계관 설명을 입력해 주세요.';
      return;
    }

    err.textContent = '';
    G.provider = provider;
    G.model = selModel.value;
    G.apiKey = key;
    G.playerCount = parseInt(document.querySelector('.player-count.selected').dataset.count, 10);
    const lenCard = document.querySelector('.length-card.selected');
    G.lengthKey = lenCard ? lenCard.dataset.length : 'standard';
    G.dopamine = dopamineLevel;
    G.themeKey = themeKey;
    G.customTheme = $('inp-custom-theme').value.trim();

    if (p.needsKey && $('chk-savekey').checked) saveApiKey(provider, key);

    RetroAudio.confirm();
    initCreateScreen();
    UI.showScreen('screen-create');
  });

  /* ────── 캐릭터 생성 화면 ────── */
  let createData = [];

  function classOptions() {
    if (G.themeKey === 'custom') return [];
    return THEMES[G.themeKey].classes;
  }

  function initCreateScreen() {
    createData = Array.from({ length: G.playerCount }, () => ({
      name: '', cls: '', stats: null, mode: 'dice',
      manual: { STR: POINT_BUY.start, DEX: POINT_BUY.start, INT: POINT_BUY.start, CHA: POINT_BUY.start },
    }));
    const box = $('create-container');
    box.innerHTML = '';
    $('create-error').textContent = '';

    createData.forEach((cd, idx) => {
      const card = document.createElement('div');
      card.className = 'char-card';

      const classes = classOptions();
      const classBtns = classes.map(c => `<button class="opt-btn cls-btn" data-cls="${UI.esc(c)}">${UI.esc(c)}</button>`).join('');

      card.innerHTML = `
        <h3>PLAYER ${idx + 1}</h3>
        <div class="field">
          <label>이름</label>
          <input type="text" class="inp-name" maxlength="12" placeholder="캐릭터 이름">
        </div>
        <div class="field">
          <label>클래스 ${classes.length ? '' : '(자유 입력)'}</label>
          <div class="class-grid">${classBtns}</div>
          <input type="text" class="inp-cls-custom" maxlength="12" placeholder="직접 입력 (예: 음유시인)" style="margin-top:8px; width:100%;">
        </div>
        <div class="field">
          <label>능력치 결정 방식</label>
          <div class="stat-mode-row">
            <button class="opt-btn mode-btn selected" data-mode="dice">🎲 주사위 (권장)</button>
            <button class="opt-btn mode-btn" data-mode="manual">✎ 직접 배분</button>
          </div>
          <p class="stat-mode-hint">주사위(3d6×4)는 기대 총합 42! 직접 배분(총 ${POINT_BUY.budget})보다 강한 영웅이 태어날 수 있습니다.</p>
        </div>
        <div class="field stat-field-dice">
          <table class="stat-table">
            <tr><td>힘 (STR)</td><td class="stat-val" data-stat="STR">─</td><td class="stat-mod" data-mod="STR"></td></tr>
            <tr><td>민첩 (DEX)</td><td class="stat-val" data-stat="DEX">─</td><td class="stat-mod" data-mod="DEX"></td></tr>
            <tr><td>지혜 (INT)</td><td class="stat-val" data-stat="INT">─</td><td class="stat-mod" data-mod="INT"></td></tr>
            <tr><td>매력 (CHA)</td><td class="stat-val" data-stat="CHA">─</td><td class="stat-mod" data-mod="CHA"></td></tr>
          </table>
          <button class="menu-btn small roll-stats-btn">🎲 능력치 굴리기</button>
        </div>
        <div class="field stat-field-manual" style="display:none">
          <div class="pb-remaining">남은 포인트: <b class="pb-left"></b> <span class="pb-range">(각 능력치 ${POINT_BUY.min}~${POINT_BUY.max})</span></div>
          <table class="stat-table">
            ${['STR', 'DEX', 'INT', 'CHA'].map(s => `
            <tr>
              <td>${STAT_NAMES[s]} (${s})</td>
              <td class="pb-ctrl">
                <button class="pb-btn" data-stat="${s}" data-d="-1">−</button>
                <span class="pb-val" data-pbstat="${s}"></span>
                <button class="pb-btn" data-stat="${s}" data-d="1">＋</button>
              </td>
              <td class="stat-mod" data-pbmod="${s}"></td>
            </tr>`).join('')}
          </table>
        </div>
        <div class="hp-line">체력(HP): <span class="hp-val">─</span></div>
      `;

      // 이름
      card.querySelector('.inp-name').addEventListener('input', e => { cd.name = e.target.value.trim(); });

      // 클래스 버튼
      card.querySelectorAll('.cls-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          RetroAudio.select();
          card.querySelectorAll('.cls-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          card.querySelector('.inp-cls-custom').value = '';
          cd.cls = btn.dataset.cls;
        });
      });
      card.querySelector('.inp-cls-custom').addEventListener('input', e => {
        card.querySelectorAll('.cls-btn').forEach(b => b.classList.remove('selected'));
        cd.cls = e.target.value.trim();
      });

      // 능력치 결정 방식 전환
      const calcHp = str => Math.max(14, 20 + statMod(str) * 2);
      const pbSum = () => Object.values(cd.manual).reduce((a, b) => a + b, 0);
      const refreshManual = () => {
        const left = POINT_BUY.budget - pbSum();
        card.querySelector('.pb-left').textContent = left;
        for (const s of ['STR', 'DEX', 'INT', 'CHA']) {
          card.querySelector(`[data-pbstat="${s}"]`).textContent = cd.manual[s];
          card.querySelector(`[data-pbmod="${s}"]`).textContent = '(' + fmtMod(statMod(cd.manual[s])) + ')';
        }
        card.querySelectorAll('.pb-btn').forEach(b => {
          const v = cd.manual[b.dataset.stat] + parseInt(b.dataset.d, 10);
          b.disabled = v < POINT_BUY.min || v > POINT_BUY.max || (parseInt(b.dataset.d, 10) > 0 && left <= 0);
        });
        if (cd.mode === 'manual') card.querySelector('.hp-val').textContent = calcHp(cd.manual.STR);
      };

      card.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          RetroAudio.select();
          cd.mode = btn.dataset.mode;
          card.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('selected', b === btn));
          card.querySelector('.stat-field-dice').style.display = cd.mode === 'dice' ? 'block' : 'none';
          card.querySelector('.stat-field-manual').style.display = cd.mode === 'manual' ? 'block' : 'none';
          if (cd.mode === 'manual') refreshManual();
          else card.querySelector('.hp-val').textContent = cd.stats ? cd.maxHp : '─';
        });
      });

      card.querySelectorAll('.pb-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const s = btn.dataset.stat;
          const d = parseInt(btn.dataset.d, 10);
          const v = cd.manual[s] + d;
          if (v < POINT_BUY.min || v > POINT_BUY.max) return;
          if (d > 0 && POINT_BUY.budget - pbSum() <= 0) return;
          cd.manual[s] = v;
          RetroAudio.select();
          refreshManual();
        });
      });
      refreshManual();

      // 능력치 굴리기 (애니메이션)
      const rollBtn = card.querySelector('.roll-stats-btn');
      rollBtn.addEventListener('click', () => {
        rollBtn.disabled = true;
        let ticks = 0;
        const interval = setInterval(() => {
          RetroAudio.diceTick();
          ['STR', 'DEX', 'INT', 'CHA'].forEach(s => {
            card.querySelector(`[data-stat="${s}"]`).textContent = roll3d6();
          });
          ticks++;
          if (ticks >= 10) {
            clearInterval(interval);
            const stats = { STR: roll3d6(), DEX: roll3d6(), INT: roll3d6(), CHA: roll3d6() };
            cd.stats = stats;
            ['STR', 'DEX', 'INT', 'CHA'].forEach(s => {
              card.querySelector(`[data-stat="${s}"]`).textContent = stats[s];
              card.querySelector(`[data-mod="${s}"]`).textContent = '(' + fmtMod(statMod(stats[s])) + ')';
            });
            const maxHp = Math.max(14, 20 + statMod(stats.STR) * 2);
            cd.maxHp = maxHp;
            card.querySelector('.hp-val').textContent = maxHp;
            rollBtn.disabled = false;
            rollBtn.textContent = '🎲 다시 굴리기';
            RetroAudio.confirm();
          }
        }, 80);
      });

      box.appendChild(card);
    });
  }

  $('btn-create-back').addEventListener('click', () => {
    RetroAudio.select();
    UI.showScreen('screen-setup');
  });

  $('btn-create-start').addEventListener('click', () => {
    const err = $('create-error');
    for (let i = 0; i < createData.length; i++) {
      const cd = createData[i];
      if (!cd.name) { err.textContent = `⚠ 플레이어 ${i + 1}의 이름을 입력해 주세요.`; return; }
      if (!cd.cls) { err.textContent = `⚠ 플레이어 ${i + 1}의 클래스를 선택해 주세요.`; return; }
      if (cd.mode === 'manual') {
        const left = POINT_BUY.budget - Object.values(cd.manual).reduce((a, b) => a + b, 0);
        if (left > 0) { err.textContent = `⚠ 플레이어 ${i + 1}: 남은 포인트 ${left}를 모두 배분해 주세요.`; return; }
        cd.stats = { ...cd.manual };
        cd.maxHp = Math.max(14, 20 + statMod(cd.stats.STR) * 2);
      } else if (!cd.stats) { err.textContent = `⚠ 플레이어 ${i + 1}의 능력치를 굴려 주세요.`; return; }
    }
    err.textContent = '';

    G.players = createData.map(cd => ({
      name: cd.name, cls: cd.cls, stats: cd.stats,
      hp: cd.maxHp, maxHp: cd.maxHp, inventory: [],
    }));

    RetroAudio.confirm();
    startAdventure();
  });

  /* ────── 게임 시작 / 복원 ────── */
  function startAdventure() {
    if (G.provider === 'demo') resetDemo();
    enterGameScreen({ restored: false });
    UI.addLog('system', `※ 세계관: ${themeName()} · ${G.playerCount}인 플레이 · ${gameLength().name}(${gameLength().time}) · GM: ${PROVIDERS[G.provider].name}`);
    if (G.dopamine > 0) {
      UI.addLog('system', `※ ⚡ 도파민 모드 ${G.dopamine >= DOPAMINE_MAX ? 'MAX' : 'Lv.' + G.dopamine} — 대성공 ${critMin()}~20 · 대실패 1~${fumbleMax()}`);
    }
    UI.addLog('system', '※ 선택지를 고르거나, 아래 입력창에 원하는 행동을 직접 입력할 수 있습니다.');
    UI.addDivider();
    sendToGM(buildStartMessage(), { isSystemEvent: true });
  }

  function enterGameScreen({ restored }) {
    G.sessionStartAt = Date.now();
    UI.showScreen('screen-game');
    UI.hideGameOver();
    if (restored) {
      UI.restoreLog();
      UI.addLog('system', '※ 저장된 모험을 불러왔습니다.', { record: false });
    } else {
      UI.clearLog();
    }
    UI.renderParty();
    UI.updateHud();
    UI.lockInputs(false);
    UI.restorePendingUI();
  }

  /* ────── 게임 화면 조작 ────── */
  $('btn-send').addEventListener('click', () => {
    UI.submitAction($('inp-action').value, 'input');
  });
  $('inp-action').addEventListener('keydown', e => {
    if (e.key === 'Enter') UI.submitAction($('inp-action').value, 'input');
  });

  $('btn-roll-check').addEventListener('click', () => UI.rollCheckDice());

  document.querySelectorAll('.dice-btn').forEach(btn => {
    btn.addEventListener('click', () => UI.rollFreeDie(parseInt(btn.dataset.die, 10)));
  });

  $('btn-sound').addEventListener('click', () => {
    const muted = RetroAudio.toggleMute();
    $('btn-sound').textContent = muted ? '♪ OFF' : '♪ ON';
  });

  $('btn-quit').addEventListener('click', () => {
    saveGame();
    refreshTitleButtons();
    UI.showScreen('screen-title');
  });

  $('btn-to-title').addEventListener('click', () => {
    RetroAudio.select();
    UI.hideGameOver();
    refreshTitleButtons();
    UI.showScreen('screen-title');
  });

  /* ────── 엔딩: 기록 카드 저장 / 공유 ────── */
  const shareStatus = $('share-status');

  $('btn-save-card').addEventListener('click', async () => {
    const btn = $('btn-save-card');
    btn.disabled = true;
    shareStatus.textContent = '기록 카드를 생성하는 중...';
    try {
      await Archive.downloadCard();
      RetroAudio.confirm();
      shareStatus.textContent = '✔ PNG 기록 카드가 저장되었습니다.';
    } catch (e) {
      shareStatus.textContent = '⚠ ' + (e.message || '카드 생성에 실패했습니다.');
    }
    btn.disabled = false;
  });

  $('btn-share').addEventListener('click', async () => {
    const btn = $('btn-share');
    btn.disabled = true;
    shareStatus.textContent = '공유 준비 중...';
    try {
      const r = await Archive.shareResult();
      if (r.method === 'clipboard') {
        RetroAudio.confirm();
        shareStatus.textContent = '✔ 결과가 클립보드에 복사되었습니다. 친구에게 붙여넣기 하세요!';
      } else if (r.method === 'manual') {
        shareStatus.textContent = '자동 복사가 지원되지 않는 환경입니다. 아래 텍스트를 직접 복사해 주세요.';
        const ta = $('share-fallback');
        ta.value = r.text;
        ta.style.display = 'block';
        ta.focus();
        ta.select();
      } else if (r.method === 'cancel') {
        shareStatus.textContent = '';
      } else {
        RetroAudio.confirm();
        shareStatus.textContent = '✔ 공유되었습니다.';
      }
    } catch (e) {
      shareStatus.textContent = '⚠ ' + (e.message || '공유에 실패했습니다.');
    }
    btn.disabled = false;
  });

  /* ────── 초기화 ────── */
  UI.initSkipHandler();
  refreshTitleButtons();
})();
