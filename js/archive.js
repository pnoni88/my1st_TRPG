/* ═══════════ 모험 기록 카드 (PNG) 생성 · 다운로드 · 공유 ═══════════ */

const Archive = (() => {
  const W = 800;          // 카드 논리 폭
  const SCALE = 2;        // 고해상도 렌더링 배율
  const PAD = 44;         // 좌우 여백
  const FONT = 'DungGeunMo, "Courier New", monospace';

  const C = {
    bg: '#050807',
    panel: '#0a120c',
    green: '#33ff66',
    greenDim: '#1d8f3e',
    greenDark: '#0f3d1e',
    amber: '#ffb000',
    cyan: '#4de8e8',
    red: '#ff4455',
    gray: '#6a7a6e',
  };

  const MAX_ARCHIVE_LINES = 60; // 카드에 담을 최대 기록 수

  function ensureFont() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('16px DungGeunMo'),
      document.fonts.load('32px DungGeunMo'),
    ]).catch(() => {});
  }

  /* ── 텍스트 줄바꿈 (measureText 기반) ── */
  function wrapText(ctx, text, maxWidth) {
    const lines = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const ch of para) {
        if (ctx.measureText(line + ch).width > maxWidth && line) {
          lines.push(line);
          line = ch === ' ' ? '' : ch;
        } else {
          line += ch;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  /* ── 카드 그리기: dry=true면 그리지 않고 총 높이만 계산 ── */
  function paintCard(ctx, dry) {
    const cw = W - PAD * 2;
    let y = 0;

    const setFont = (size, color, glow) => {
      ctx.font = `${size}px ${FONT}`;
      ctx.fillStyle = color;
      if (!dry) {
        ctx.shadowColor = glow || 'transparent';
        ctx.shadowBlur = glow ? 8 : 0;
      }
    };
    const line = (text, size, color, { glow = null, align = 'left', gap = 8 } = {}) => {
      setFont(size, color, glow);
      for (const l of wrapText(ctx, text, cw)) {
        y += size;
        if (!dry) {
          const x = align === 'center' ? W / 2 : PAD;
          ctx.textAlign = align === 'center' ? 'center' : 'left';
          ctx.fillText(l, x, y);
        }
        y += gap;
      }
    };
    const divider = (char = '─') => {
      setFont(13, C.greenDark);
      y += 13;
      if (!dry) {
        ctx.textAlign = 'center';
        ctx.fillText(char.repeat(52), W / 2, y);
      }
      y += 16;
    };

    const go = G.gameOver || { type: 'victory', epilogue: '' };
    const s = computeEndStats();
    const victory = go.type === 'victory';

    /* 헤더 */
    y += 52;
    setFont(40, C.green, 'rgba(51,255,102,0.7)');
    if (!dry) { ctx.textAlign = 'center'; ctx.fillText('RETRO QUEST', W / 2, y); }
    y += 14;
    line('— ADVENTURE RECORD —', 14, C.amber, { align: 'center', gap: 4 });
    y += 6;
    divider('═');

    /* 결과 배너 */
    y += 10;
    line(victory ? '★ THE END — 모험 완수! ★' : '— GAME OVER —', 26,
      victory ? C.amber : C.red,
      { glow: victory ? 'rgba(255,176,0,0.6)' : 'rgba(255,68,85,0.6)', align: 'center', gap: 6 });
    y += 8;

    /* 메타 정보 */
    const date = new Date(G.startedAt || Date.now());
    const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
    const gmName = (typeof PROVIDERS !== 'undefined' && PROVIDERS[G.provider]) ? PROVIDERS[G.provider].name : G.provider;
    line(`세계관: ${themeName()}  ·  ${dateStr}  ·  GM: ${gmName}`, 14, C.gray, { align: 'center', gap: 4 });
    y += 10;
    divider();

    /* 파티 */
    y += 4;
    line('░ 파티 ░', 16, C.cyan, { gap: 10 });
    for (const p of G.players) {
      const alive = p.hp > 0;
      line(`${alive ? '♥' : '✖'} ${p.name} (${p.cls}) — HP ${p.hp}/${p.maxHp}${alive ? '' : ' [쓰러짐]'}`,
        16, alive ? C.green : C.red, { gap: 2 });
      line(`   힘 ${p.stats.STR} · 민첩 ${p.stats.DEX} · 지혜 ${p.stats.INT} · 매력 ${p.stats.CHA}` +
        (p.inventory.length ? ` · 소지품: ${p.inventory.join(', ')}` : ''), 13, C.gray, { gap: 10 });
    }
    y += 4;
    divider();

    /* 통계 */
    y += 4;
    line('░ 모험 결산 ░', 16, C.cyan, { gap: 10 });
    const statRows = [
      ['플레이 타임', s.playTimeText],
      ['진행 턴', `${s.turns}턴`],
      ['선택지 선택', `${s.choices}회`],
      ['직접 행동 입력', `${s.inputs}회`],
      ['주사위 판정', `${s.rolls}회`],
      ['판정 성공률', s.successRate === null ? '─' : `${s.successRate}%`],
      ['대성공 / 대실패', `${s.crits}회 / ${s.fumbles}회`],
    ];
    for (const [k, v] of statRows) {
      y += 16;
      if (!dry) {
        setFont(15, C.green);
        ctx.textAlign = 'left';
        ctx.fillText(k, PAD, y);
        setFont(15, C.amber);
        ctx.textAlign = 'right';
        ctx.fillText(v, W - PAD, y);
      }
      y += 9;
    }
    y += 4;
    divider();

    /* 선택의 기록 */
    y += 4;
    line('░ 선택의 기록 ░', 16, C.cyan, { gap: 10 });
    const log = G.actionLog || [];
    const shown = log.slice(0, MAX_ARCHIVE_LINES);
    if (!shown.length) {
      line('기록된 행동이 없습니다.', 14, C.gray, { gap: 6 });
    }
    for (const e of shown) {
      const mark = e.kind === 'dice' ? '🎲' : e.kind === 'choice' ? '▸' : '»';
      const who = e.kind === 'dice' ? '' : `${e.player}: `;
      const color = e.kind === 'dice' ? C.cyan : e.kind === 'choice' ? C.green : C.amber;
      line(`T${e.turn} ${mark} ${who}${e.text}`, 14, color, { gap: 5 });
    }
    if (log.length > shown.length) {
      line(`… 외 ${log.length - shown.length}개의 기록`, 13, C.gray, { gap: 6 });
    }
    y += 4;
    divider();

    /* 에필로그 */
    if (go.epilogue) {
      y += 4;
      line('░ 에필로그 ░', 16, C.cyan, { gap: 10 });
      line(go.epilogue, 15, C.green, { gap: 7 });
      y += 4;
      divider();
    }

    /* 푸터 */
    y += 8;
    line('AI 게임 마스터와 함께하는 테이블탑 RPG', 13, C.gray, { align: 'center', gap: 4 });
    line('당신의 모험을 시작하세요 — RETRO QUEST', 13, C.amber, { align: 'center', gap: 4 });
    y += 30;

    return y;
  }

  /* ── 배경 · 프레임 · 스캔라인 ── */
  function paintChrome(ctx, h) {
    // 배경
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, h);
    const grad = ctx.createRadialGradient(W / 2, h / 2, 60, W / 2, h / 2, Math.max(W, h) * 0.7);
    grad.addColorStop(0, '#0b1410');
    grad.addColorStop(1, C.bg);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, h);
    // 이중 프레임
    ctx.strokeStyle = C.greenDim;
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, h - 16);
    ctx.strokeStyle = C.greenDark;
    ctx.lineWidth = 1;
    ctx.strokeRect(14, 14, W - 28, h - 28);
  }

  function paintScanlines(ctx, h) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.10)';
    for (let sy = 0; sy < h; sy += 4) {
      ctx.fillRect(0, sy, W, 1.5);
    }
  }

  /* ── 카드 캔버스 생성 ── */
  async function renderCard() {
    await ensureFont();

    // 1차: 높이 측정
    const measure = document.createElement('canvas').getContext('2d');
    const h = Math.ceil(paintCard(measure, true));

    // 2차: 실제 렌더링
    const canvas = document.createElement('canvas');
    canvas.width = W * SCALE;
    canvas.height = h * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    paintChrome(ctx, h);
    paintCard(ctx, false);
    paintScanlines(ctx, h);
    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('이미지 생성에 실패했습니다.')), 'image/png');
    });
  }

  function fileStamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  }

  /* ── PNG 다운로드 ── */
  async function downloadCard() {
    const canvas = await renderCard();
    const blob = await canvasToBlob(canvas);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retroquest_record_${fileStamp()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /* ── 공유 텍스트 ── */
  function buildShareText() {
    const s = computeEndStats();
    const victory = G.gameOver && G.gameOver.type === 'victory';
    const names = G.players.map(p => `${p.name}(${p.cls})`).join(', ');
    const rate = s.successRate === null ? '─' : `${s.successRate}%`;
    return [
      `🎲 RETRO QUEST — ${themeName()} 모험 ${victory ? '완수! ★' : '실패... ✖'}`,
      `⏱ ${s.playTimeText} · ${s.turns}턴 · 주사위 성공률 ${rate}`,
      `파티: ${names}`,
      'AI 게임 마스터와 함께하는 레트로 TRPG, 당신도 도전해 보세요!',
    ].join('\n');
  }

  function shareUrl() {
    return location.href.split('#')[0].split('?')[0];
  }

  /* ── 결과 공유: Web Share(이미지 포함) → Web Share(텍스트) → 클립보드 ── */
  async function shareResult() {
    const text = buildShareText();
    const url = shareUrl();

    // 1) 이미지 파일 포함 공유
    if (navigator.canShare) {
      try {
        const canvas = await renderCard();
        const blob = await canvasToBlob(canvas);
        const file = new File([blob], `retroquest_record_${fileStamp()}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'RETRO QUEST', text: `${text}\n${url}` });
          return { method: 'share' };
        }
      } catch (e) {
        if (e && e.name === 'AbortError') return { method: 'cancel' };
        // 다음 방식으로 폴백
      }
    }

    // 2) 텍스트 공유
    if (navigator.share) {
      try {
        await navigator.share({ title: 'RETRO QUEST', text, url });
        return { method: 'share' };
      } catch (e) {
        if (e && e.name === 'AbortError') return { method: 'cancel' };
      }
    }

    // 3) 클립보드 복사
    const full = `${text}\n${url}`;
    try {
      await navigator.clipboard.writeText(full);
      return { method: 'clipboard' };
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = full;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (ok) return { method: 'clipboard' };
      // 4) 자동 복사 불가: 텍스트를 직접 복사하도록 전달
      return { method: 'manual', text: full };
    }
  }

  return { renderCard, downloadCard, shareResult };
})();
