// Colonna sonora generata dal codice (Web Audio): un solo brano a strati che cambia con la fase del round.
// Due stili: 'nebbia' (dark synth lento, nebbioso) e 'chiprave' (chiptune 8 bit sopra una cassa techno).
// Gli strati suonano sempre; la fase decide quali si sentono (dissolvenze lente, la musica non si interrompe mai).

const midi = n => 440 * 2 ** ((n - 69) / 12);
export const STYLES = {
  nebbia: { name: 'Nebbia', bpm: 100, wave: 'sawtooth', arpWave: 'triangle', cut: 420,
    chords: [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]], // La- Fa Re- Mi
    bass: [0, null, null, 0, null, null, 12, null, null, null, 0, null, null, null, 7, null], arpEvery: 2 },
  chiprave: { name: 'Chip Rave', bpm: 124, wave: 'square', arpWave: 'square', cut: 900,
    chords: [[57, 60, 64], [55, 59, 62], [53, 57, 60], [52, 56, 59]], // La- Sol Fa Mi
    bass: [0, null, 12, null, 0, null, 12, null, 0, null, 12, null, 0, null, 12, 7], arpEvery: 1 },
};
// strati udibili per fase
export const PHASE_LAYERS = {
  lobby: ['pad', 'bass'],
  setup: ['pad', 'bass', 'tick'], prep: ['pad', 'bass', 'tick'], draft: ['pad', 'bass', 'tick', 'hat'],
  trick: ['pad', 'bass', 'hat', 'kick'],
  party: ['pad', 'bass', 'hat', 'open', 'kick4', 'arp'],
  guerrilla: ['bass', 'hat', 'kick', 'metal', 'siren'],
  community: ['pad', 'bass', 'arp', 'hat'],
  uprising: ['pad', 'bass', 'kick', 'roll'],
  end: ['pad', 'arp'],
};
const LAYERS = ['pad', 'bass', 'tick', 'hat', 'open', 'kick', 'kick4', 'arp', 'metal', 'siren', 'roll'];
const LEVEL = { pad: 0.2, bass: 0.16, tick: 0.1, hat: 0.09, open: 0.12, kick: 0.45, kick4: 0.75, arp: 0.16, metal: 0.1, siren: 0.06, roll: 0.18 };

export function createMusic(ctx, out, styleName = 'nebbia') {
  const st = STYLES[styleName], master = ctx.createGain(), comp = ctx.createDynamicsCompressor(); // il compressore tiene il volume sotto controllo, niente distorsione
  master.gain.value = 0.4; comp.threshold.value = -14; comp.ratio.value = 6;
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -2; lim.ratio.value = 20; lim.attack.value = 0.001; master.connect(comp).connect(lim).connect(out);
  // riverbero (risposta all'impulso fatta di rumore che si spegne) e eco per pad e arpeggi
  const verb = ctx.createConvolver(), len = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.5; }
  verb.buffer = ir; const verbOut = ctx.createGain(); verbOut.gain.value = 0.35; verb.connect(verbOut).connect(master);
  const echo = ctx.createDelay(1), fb = ctx.createGain(); echo.delayTime.value = (60 / st.bpm) * 0.75; fb.gain.value = 0.35;
  echo.connect(fb).connect(echo); echo.connect(verb); echo.connect(master);
  const bus = Object.fromEntries(LAYERS.map(k => { const g = ctx.createGain(); g.gain.value = 0; g.connect(master); return [k, g]; }));
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }

  const env = (g, t, a, peak, rel) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + rel); };
  const osc = (type, f, t, dur, dest) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o; };
  const noiseSrc = (t, dur, dest) => { const s = ctx.createBufferSource(); s.buffer = noise; s.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur); };
  const I = {
    kick(t, dest) { const g = ctx.createGain(); g.connect(dest); env(g, t, 0.003, 1, 0.32); const o = osc('sine', 150, t, 0.4, g); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); },
    hat(t, dest, open) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ctx.createGain(); f.connect(g).connect(dest); env(g, t, 0.001, 1, open ? 0.22 : 0.045); noiseSrc(t, 0.3, f); },
    snare(t, dest, v) { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; const g = ctx.createGain(); f.connect(g).connect(dest); env(g, t, 0.001, v, 0.12); noiseSrc(t, 0.2, f); },
    tone(t, dest, f, dur, type, cut, peak = 1, send = null) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut; lp.Q.value = 4; const g = ctx.createGain(); lp.connect(g).connect(dest); if (send) g.connect(send);
      env(g, t, 0.01, peak, dur); osc(type, f, t, dur, lp);
    },
    pad(t, dest, notes, dur) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1100, t + dur / 2); lp.frequency.linearRampToValueAtTime(500, t + dur);
      const g = ctx.createGain(); lp.connect(g).connect(dest); g.connect(verb);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + dur * 0.3); g.gain.linearRampToValueAtTime(0, t + dur * 1.05);
      notes.forEach(n => [-6, 6].forEach(d => { const o = osc(st.wave === 'square' ? 'triangle' : 'sawtooth', midi(n), t, dur * 1.1, lp); o.detune.value = d; }));
    },
    metal(t, dest) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 8; const g = ctx.createGain(); bp.connect(g).connect(dest); env(g, t, 0.001, 1, 0.09); osc('square', 540, t, 0.1, bp); osc('square', 760, t, 0.1, bp); },
    siren(t, dest, dur) { const g = ctx.createGain(); g.connect(dest); g.connect(verb); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
      const o = osc('sine', 700, t, dur, g), lfo = ctx.createOscillator(), d = ctx.createGain(); lfo.frequency.value = 0.9; d.gain.value = 160; lfo.connect(d).connect(o.frequency); lfo.start(t); lfo.stop(t + dur); },
    tick(t, dest) { const g = ctx.createGain(); g.connect(dest); env(g, t, 0.001, 1, 0.03); osc('sine', 1900, t, 0.05, g); },
  };

  const sixteenth = 60 / st.bpm / 4;
  let step = 0, next = ctx.currentTime + 0.1, timer = null, phase = null;
  function play(n, t) {
    const s = n % 16, bar = Math.floor(n / 16), chord = st.chords[bar % 4], root = chord[0] - 24;
    if (s === 0) I.pad(t, bus.pad, chord, sixteenth * 16);
    const b = st.bass[s]; if (b !== null) I.tone(t, bus.bass, midi(root + b), sixteenth * 1.6, st.wave, st.cut);
    if (s % 4 === 0) I.tick(t, bus.tick);
    if (s % 4 === 2) { I.hat(t, bus.hat); I.hat(t, bus.open, true); }
    if (s === 0 || s === 8) I.kick(t, bus.kick);
    if (s % 4 === 0) I.kick(t, bus.kick4);
    if (s % st.arpEvery === 0) { const k = (n / st.arpEvery) % 4, nt = k === 3 ? chord[1] + 12 : chord[k] + 12; I.tone(t, bus.arp, midi(nt), sixteenth * 0.9, st.arpWave, 2600, 1, echo); }
    if (s % 4 === 3 || (s === 6 && bar % 2)) I.metal(t, bus.metal);
    if (s === 0 && bar % 2 === 0) I.siren(t, bus.siren, sixteenth * 28);
    if (s === 4 || s === 12) I.snare(t, bus.roll, 0.9);
    if (bar % 4 === 3 && s >= 8) I.snare(t, bus.roll, 0.25 + (s - 8) / 10); // rullo che cresce a fine giro
  }
  function setPhase(p, t = ctx.currentTime) {
    if (p === phase) return; phase = p;
    const on = new Set(PHASE_LAYERS[p] || PHASE_LAYERS.lobby);
    LAYERS.forEach(k => { const g = bus[k].gain; g.cancelScheduledValues(t); g.setTargetAtTime(on.has(k) ? LEVEL[k] : 0, t, 0.8); });
  }
  function schedule(until) { while (next < until) { play(step, next); next += sixteenth; step++; } }
  return {
    style: styleName, setPhase, schedule, master,
    start() { if (timer) return; next = Math.max(next, ctx.currentTime + 0.05); timer = setInterval(() => schedule(ctx.currentTime + 0.25), 50); },
    stop() { clearInterval(timer); timer = null; },
  };
}
