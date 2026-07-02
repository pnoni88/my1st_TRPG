/* ═══════════ 화면 렌더링 · 타자기 효과 · 주사위 연출 ═══════════ */

const UI = (() => {
  const $ = id => document.getElementById(id);

  let skipTyping = false;

  /* ── 화면 전환 ── */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }

  /* ── 로그 ── */
  function addLog(type, text, { record = true } = {}) {
    const div = document.createElement('div');
    div.className = 'log-entry log-' + type;
    div.textContent = text;
    $('log').appendChild(div);
    scrollLog();
    if (record && G) G.logEntries.push({ type, text });
    return div;
  }

  function addDivider() {
    const div = document.createElement('div');
    div.className = 'log-divider';
    div.textContent = '─'.repeat(40);
    $('log').appendChild(div);
  }

  function scrollLog() {
    const area = $('log-area');
    area.scrollTop = area.scrollHeight;
  }

  function clearLog() { $('log').innerHTML = ''; }

  function restoreLog() {
    clearLog();
    for (const e of G.logEntries) addLog(e.type, e.text, { record: false });
  }

  /* ── 타자기 내레이션 ── */
  function typeNarration(text) {
    return new Promise(resolve => {
      skipTyping = false;
      const div = document.createElement('div');
      div.className = 'log-entry log-gm';
      $('log').appendChild(div);
      if (G) G.logEntries.push({ type: 'gm', text });

      let i = 0;
      const step = () => {
        if (skipTyping) {
          div.textContent = text;
          scrollLog();
          resolve();
          return;
        }
        // 한 번에 1~2자씩
        const chunk = text.slice(i, i + 1);
        div.textContent += chunk;
        i += chunk.length;
        if (i % 3 === 0) RetroAudio.type();
        if (i % 20 === 0) scrollLog();
        if (i < text.length) {
          setTimeout(step, 18);
        } else {
          scrollLog();
          resolve();
        }
      };
      step();
    });
  }

  // 로그 클릭 시 타이핑 스킵
  function initSkipHandler() {
    $('log-area').addEventListener('click', () => { skipTyping = true; });
  }

  /* ── GM 생각 중 표시 ── */
  function setThinking(on) {
    $('gm-thinking').style.display = on ? 'block' : 'none';
    if (on) scrollLog();
  }

  /* ── HUD ── */
  function updateHud() {
    $('hud-location').textContent = '◈ ' + (G.location || '???');
    $('hud-turn').textContent = 'TURN ' + G.turn;
  }

  /* ── 파티 사이드바 ── */
  function renderParty() {
    const box = $('party-panel');
    box.innerHTML = '';
    G.players.forEach((p, i) => {
      const pct = Math.max(0, Math.round((p.hp / p.maxHp) * 100));
      const hpClass = pct > 60 ? 'hp-high' : pct > 30 ? 'hp-mid' : '';
      const div = document.createElement('div');
      div.className = 'char-status' + (i === G.activePlayer && G.playerCount === 2 ? ' active-turn' : '');
      div.innerHTML = `
        <div class="cs-name">${esc(p.name)} <span class="cs-class">· ${esc(p.cls)}</span></div>
        <div class="hp-bar-wrap"><div class="hp-bar ${hpClass}" style="width:${pct}%"></div></div>
        <div class="hp-text">HP ${p.hp}/${p.maxHp}</div>
        ${p.hp <= 0 ? '<div class="cs-dead">✖ 쓰러짐</div>' : ''}
        <div class="cs-stats">
          <span>힘 <b>${p.stats.STR}</b></span><span>민첩 <b>${p.stats.DEX}</b></span>
          <span>지혜 <b>${p.stats.INT}</b></span><span>매력 <b>${p.stats.CHA}</b></span>
        </div>
        <div class="cs-inv">소지품: ${p.inventory.length ? p.inventory.map(x => `<span>${esc(x)}</span>`).join(', ') : '없음'}</div>
      `;
      box.appendChild(div);
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ── 액션 영역 상태 ── */
  function lockInputs(locked) {
    $('inp-action').disabled = locked;
    $('btn-send').disabled = locked;
    $('btn-roll-check').disabled = locked;
    document.querySelectorAll('.choice-btn').forEach(b => b.disabled = locked);
  }

  function restorePendingUI() {
    const choicesBox = $('choices-box');
    const diceBox = $('dice-check-box');
    const freeRow = $('free-input-row');
    choicesBox.innerHTML = '';

    // 활성 플레이어 표시
    const tag = $('active-player-tag');
    if (G.playerCount === 2 && !G.gameOver) {
      const p = G.players[G.activePlayer];
      tag.textContent = `▶ ${p.name}의 차례`;
      tag.style.display = 'block';
    } else {
      tag.style.display = 'none';
    }

    if (G.pendingDiceCheck) {
      const dc = G.pendingDiceCheck;
      const p = G.players[G.activePlayer];
      const mod = statMod(p.stats[dc.stat]);
      diceBox.style.display = 'block';
      choicesBox.style.display = 'none';
      freeRow.style.display = 'none';
      $('dice-check-info').textContent =
        `⚡ ${STAT_NAMES[dc.stat]} 판정 — ${dc.reason} (난이도 ${dc.difficulty}, ${p.name}의 보정치 ${fmtMod(mod)})`;
      $('dice-display').textContent = '?';
      $('btn-roll-check').disabled = false;
    } else {
      diceBox.style.display = 'none';
      choicesBox.style.display = 'flex';
      freeRow.style.display = 'flex';
      for (const c of G.pendingChoices) {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = c;
        btn.addEventListener('click', () => {
          RetroAudio.select();
          submitAction(c);
        });
        choicesBox.appendChild(btn);
      }
      $('inp-action').focus();
    }
  }

  /* ── 행동 제출 (선택지/자유입력 공용) ── */
  function submitAction(text) {
    if (!text.trim() || G.gameOver) return;
    addLog('player', `${G.players[G.activePlayer].name}: ${text}`);
    addDivider();
    $('choices-box').innerHTML = '';
    $('inp-action').value = '';
    sendToGM(text);
  }

  /* ── 판정 주사위 연출 ── */
  function rollCheckDice() {
    if (!G.pendingDiceCheck) return;
    const display = $('dice-display');
    const btn = $('btn-roll-check');
    btn.disabled = true;
    display.classList.add('rolling');

    const finalRoll = rollDie(20);
    let ticks = 0;
    const interval = setInterval(() => {
      display.textContent = rollDie(20);
      RetroAudio.diceTick();
      ticks++;
      if (ticks >= 12) {
        clearInterval(interval);
        display.classList.remove('rolling');
        display.textContent = finalRoll;

        const result = resolveDiceCheck(finalRoll);
        RetroAudio.diceResult(result.success);
        addLog('dice', result.logLine);
        addDivider();
        setTimeout(() => {
          $('dice-check-box').style.display = 'none';
          sendToGM(result.gmMessage, { isSystemEvent: true });
        }, 900);
      }
    }, 80);
  }

  /* ── 자유 주사위 ── */
  function rollFreeDie(sides) {
    const out = $('free-dice-result');
    let ticks = 0;
    const interval = setInterval(() => {
      out.textContent = `d${sides} → ${rollDie(sides)}`;
      RetroAudio.diceTick();
      ticks++;
      if (ticks >= 8) {
        clearInterval(interval);
        const v = rollDie(sides);
        out.textContent = `d${sides} → 【 ${v} 】`;
      }
    }, 70);
  }

  /* ── 게임 오버 ── */
  const ART_VICTORY = `
      ___________
     '._==_==_=_.'
     .-\\:      /-.
    | (|:.     |) |
     '-|:.     |-'
       \\::.    /
        '::. .'
          ) (
        _.' '._
       '-------'`;
  const ART_DEFEAT = `
        ______
     .-'      '-.
    /            \\
   |              |
   |,  .-.  .-.  ,|
   | )(_o/  \\o_)( |
   |/     /\\     \\|
   (_     ^^     _)
    \\__|IIIIII|__/
     | \\IIIIII/ |
     \\          /
      '--------'`;

  function showGameOver(go) {
    const overlay = $('gameover-overlay');
    const title = $('gameover-title');
    $('gameover-art').textContent = go.type === 'victory' ? ART_VICTORY : ART_DEFEAT;
    title.textContent = go.type === 'victory' ? '★ THE END — 모험 완수! ★' : '— GAME OVER —';
    title.className = go.type;
    $('gameover-epilogue').textContent = go.epilogue || '';
    overlay.style.display = 'flex';
    if (go.type === 'victory') RetroAudio.victory(); else RetroAudio.defeat();
  }

  function hideGameOver() { $('gameover-overlay').style.display = 'none'; }

  return {
    showScreen, addLog, addDivider, clearLog, restoreLog, typeNarration, initSkipHandler,
    setThinking, updateHud, renderParty, lockInputs, restorePendingUI,
    submitAction, rollCheckDice, rollFreeDie, showGameOver, hideGameOver, esc,
  };
})();
