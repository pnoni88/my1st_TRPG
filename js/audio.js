/* ═══════════ 레트로 사운드 (Web Audio 8비트 비프음) ═══════════ */

const RetroAudio = (() => {
  let ctx = null;
  let muted = false;

  function ensureCtx() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function beep(freq, duration, type = 'square', volume = 0.04) {
    if (muted) return;
    const c = ensureCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration);
  }

  return {
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    // 타자기 틱
    type() { beep(880 + Math.random() * 220, 0.015, 'square', 0.012); },
    // 버튼/선택
    select() { beep(660, 0.06); beep(990, 0.08); },
    confirm() { beep(523, 0.07); setTimeout(() => beep(784, 0.09), 70); setTimeout(() => beep(1047, 0.12), 150); },
    // 주사위 굴림 틱
    diceTick() { beep(300 + Math.random() * 500, 0.03, 'square', 0.03); },
    diceResult(success) {
      if (success) { beep(784, 0.1); setTimeout(() => beep(1175, 0.18), 100); }
      else { beep(330, 0.12); setTimeout(() => beep(196, 0.25), 120); }
    },
    damage() { beep(150, 0.2, 'sawtooth', 0.05); },
    victory() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.18), i * 140));
    },
    defeat() {
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => beep(f, 0.25, 'triangle', 0.06), i * 200));
    },
  };
})();
