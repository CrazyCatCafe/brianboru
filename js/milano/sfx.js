// Effetti sonori sintetizzati (Web Audio): 8 bit per interfaccia e azioni, rumore filtrato per i suoni "veri" (whoosh, sirena)
export function createSfx(ctx, out) {
  const bus = ctx.createGain(); bus.gain.value = 0.5; bus.connect(out);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const tone = (f, t, dur, type = 'square', peak = 0.3, to = null) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.02);
  };
  const hiss = (t, dur, from, to, peak = 0.35) => {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise; f.type = 'bandpass'; f.Q.value = 1.5;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(bus); s.start(t); s.stop(t + dur);
  };
  const S = {
    ui: t => tone(1200, t, 0.04, 'square', 0.12), // click
    turn: t => { tone(660, t, 0.1); tone(990, t + 0.1, 0.18); }, // tocca a te
    phase: t => { hiss(t, 0.6, 300, 4000); tone(110, t + 0.55, 0.25, 'triangle', 0.5, 55); }, // barra rossa: whoosh e colpo
    card: t => hiss(t, 0.12, 2500, 900, 0.25), // carta giocata
    win: t => [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.08, 0.14)), // fanfara 8 bit
    coin: t => { tone(988, t, 0.06); tone(1319, t + 0.06, 0.18); },
    error: t => tone(140, t, 0.2, 'sawtooth', 0.2),
  };
  let last = {};
  return {
    play(name) { // niente raffiche: lo stesso suono non riparte prima di 80 ms
      const t = ctx.currentTime; if (!S[name] || t - (last[name] ?? -1) < 0.08) return; last[name] = t; S[name](t);
    },
  };
}

// Suono del meteo (sintetizzato): pioggia = rumore filtrato, temporale = pioggia forte e tuoni ogni tanto, sereno/nuvoloso = brusio lontano della città
export function createAmbience(ctx, out) {
  const bus = ctx.createGain(); bus.gain.value = 0; bus.connect(out);
  const len = ctx.sampleRate * 3, buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let b = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 2; } }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), body = ctx.createGain();
  hp.type = 'highpass'; lp.type = 'lowpass'; src.connect(hp).connect(lp).connect(body).connect(bus); src.start();
  let kind = null, thunderT = null;
  const thunder = () => { // boato basso che rotola
    const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = 180; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.6, t + 0.08 + Math.random() * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 3 + Math.random() * 2);
    s.connect(f).connect(g).connect(bus); s.start(t, Math.random()); s.stop(t + 5.5);
  };
  const SET = { // filtri e volume per ogni meteo
    sereno: { hp: 120, lp: 600, v: 0.05 }, nuvoloso: { hp: 140, lp: 800, v: 0.07 },
    pioggia: { hp: 900, lp: 7000, v: 0.32 }, temporale: { hp: 600, lp: 9000, v: 0.48 },
  };
  return {
    set(k, on) {
      const c = SET[k] || SET.nuvoloso, t = ctx.currentTime;
      hp.frequency.setTargetAtTime(c.hp, t, 0.5); lp.frequency.setTargetAtTime(c.lp, t, 0.5);
      bus.gain.setTargetAtTime(on ? c.v : 0, t, 0.8);
      clearInterval(thunderT); thunderT = null; kind = k;
      if (on && k === 'temporale') thunderT = setInterval(() => Math.random() < 0.35 && thunder(), 4000);
    },
  };
}
