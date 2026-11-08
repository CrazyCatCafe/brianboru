// Figure 3D animate: cinque fazioni, presidio di polizia, progetto urbano.
// Low poly, solo primitive Three.js, colori piatti: figura grigio antracite con UN elemento luminoso del colore della fazione,
// su una base bassa del colore della fazione che copre lo spot. Animazioni procedurali per parti (testa, busto, braccia, oggetto).
// Ogni figura espone { obj, set(stato), tick(t, dt, livello, vicino) }; livello: 'alta' | 'bassa' | 'ferma' (prefers-reduced-motion).
import * as THREE from 'three';

export const SCALE = 0.2; // unità figura -> unità scena: base r 0.55 => 0.11, copre lo spot (r 0.108)
const GREY = { coat: '#6e7882', mid: '#8d97a0', dark: '#4a5158', face: '#c4cbd1', light: '#d2d8dc' };

// geometrie e materiali condivisi tra tutte le figure
const geo = {}, mats = {};
const G = (key, make) => (geo[key] ??= make());
const box = (w, h, d) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt, rb, h, n = 7) => G(`c${rt},${rb},${h},${n}`, () => new THREE.CylinderGeometry(rt, rb, h, n));
const cone = (r, h, n = 6, open = false) => G(`k${r},${h},${n},${open}`, () => new THREE.ConeGeometry(r, h, n, 1, open));
const torus = (r, t, n = 24) => G(`t${r},${t},${n}`, () => new THREE.TorusGeometry(r, t, 4, n));
const dome = r => G(`d${r}`, () => new THREE.SphereGeometry(r, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2));
const gem = r => G(`i${r}`, () => new THREE.IcosahedronGeometry(r, 0));
const lam = c => (mats['l' + c] ??= new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
const lit = c => (mats['g' + c] ??= new THREE.MeshBasicMaterial({ color: c }));            // luminoso: ignora le luci
const haze = (c, o) => (mats[`h${c}${o}`] ??= new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
// elemento luminoso: colore pieno più un alone additivo che lo fa "accendere" sulla città grigia
function shine(g, c, x, y, z, parent, r = 0.12) { const m = M(g, lit(c), x, y, z, parent); M(gem(r), haze(c, 0.28), x, y, z, parent); return m; }
const visor = () => (mats.visor ??= new THREE.MeshPhongMaterial({ color: '#7fa6c4', specular: '#ffffff', shininess: 80, flatShading: true }));
const shield = () => (mats.shield ??= new THREE.MeshLambertMaterial({ color: '#a9c7dc', transparent: true, opacity: 0.6 }));

function M(g, m, x, y, z, parent) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); parent.add(o); return o; }
function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent?.add(g); return g; }

const clamp01 = x => Math.max(0, Math.min(1, x));
const ease = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const bump = x => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));
const beat = t => Math.max(0, Math.sin(t * Math.PI * 4)) ** 6; // cassa dritta a 120 bpm

// --- pezzi comuni ---
function base(root, color) {
  M(cyl(0.55, 0.58, 0.08, 16), lam(color), 0, 0.04, 0, root);
  if (new THREE.Color(color).getHSL({}).l < 0.2) M(torus(0.555, 0.018, 16), lam('#c9cfd4'), 0, 0.08, 0, root).rotation.x = Math.PI / 2; // base scura: bordo chiaro
}
// sagoma umana: gambe, busto con perno sui fianchi, testa con perno sul collo, braccia con perno sulle spalle (mano a y -0.36)
function humanoid(parent, { coat = GREY.coat, legs = true } = {}) {
  const body = grp(parent, 0, 0.08, 0), p = { body, legs: [] };
  if (legs) for (const x of [-0.08, 0.08]) { const l = grp(body, x, 0.42, 0); M(box(0.12, 0.42, 0.14), lam(GREY.dark), 0, -0.21, 0, l); p.legs.push(l); }
  p.torso = grp(body, 0, 0.42, 0);
  p.chest = M(box(0.34, 0.42, 0.2), lam(coat), 0, 0.21, 0, p.torso);
  p.head = grp(p.torso, 0, 0.44, 0);
  M(box(0.17, 0.19, 0.17), lam(GREY.face), 0, 0.1, 0, p.head);
  p.armL = grp(p.torso, -0.22, 0.38, 0); p.armR = grp(p.torso, 0.22, 0.38, 0);
  for (const a of [p.armL, p.armR]) M(box(0.09, 0.38, 0.1), lam(coat), 0, -0.18, 0, a);
  return p;
}
function rest(p) {
  p.body.position.y = 0.08; p.body.scale.set(1, 1, 1);
  p.torso.rotation.set(0, 0, 0); p.torso.scale.y = 1; p.head.rotation.set(0, 0, 0);
  p.armL.rotation.set(0, 0, 0); p.armR.rotation.set(0, 0, 0);
  p.legs.forEach(l => { l.rotation.x = 0; l.scale.y = 1; });
}
// cane robot (Sciure e polizia): corpo, testa, quattro zampe
function robodog(parent, color = GREY.mid) {
  const d = grp(parent), body = grp(d, 0, 0.13, 0), legs = [];
  M(box(0.22, 0.08, 0.1), lam(color), 0, 0, 0, body);
  M(box(0.09, 0.08, 0.08), lam(GREY.light), 0.13, 0.05, 0, body);
  M(box(0.06, 0.015, 0.015), lam(GREY.dark), -0.13, 0.04, 0, body).rotation.z = 0.6; // coda
  for (const [x, z] of [[0.08, 0.04], [0.08, -0.04], [-0.08, 0.04], [-0.08, -0.04]]) {
    const l = grp(body, x, -0.03, z); M(box(0.025, 0.1, 0.025), lam(GREY.dark), 0, -0.05, 0, l); legs.push(l);
  }
  return { d, body, legs };
}

// --- le cinque fazioni ---
// build(p, colore, root) aggiunge i dettagli; pose(p) la posa di base; idle(p, t, ph, piena) il dettaglio animato; win(p, w, t) il gesto di vittoria
export const FACTION_FIGURES = [
  { // I Navigli Rossi: impermeabile lungo col cappuccio, pertica in diagonale con lanterna arancione
    color: '#ff6a00', legs: false,
    build(p, c) {
      M(cyl(0.16, 0.28, 0.8, 7), lam(GREY.coat), 0, -0.02, 0, p.torso);
      M(cone(0.15, 0.3, 6), lam(GREY.coat), 0, 0.2, -0.01, p.head);
      p.pole = grp(p.armR, 0, -0.34, 0.04); p.pole.rotation.z = -0.35;
      M(cyl(0.022, 0.022, 1.5, 5), lam(GREY.light), 0, 0.35, 0, p.pole);
      p.lan = grp(p.pole, 0, 1.08, 0);
      M(box(0.03, 0.08, 0.03), lam(GREY.dark), 0, -0.04, 0, p.lan);
      shine(box(0.12, 0.14, 0.12), c, 0, -0.15, 0, p.lan, 0.16);
    },
    pose(p) { p.armR.rotation.x = -0.4; p.pole.rotation.z = -0.35; p.lan.rotation.set(0.4, 0, 0.35); },
    idle(p, t, ph) { p.lan.rotation.z = 0.35 + Math.sin(t * 1.8 + ph) * 0.3; p.lan.rotation.x = 0.4 + Math.sin(t * 1.3 + ph) * 0.15; },
    win(p, w, t) { p.armR.rotation.x *= 1 - w; p.armR.rotation.z += w * 1.5; p.pole.rotation.z = -0.35 - w * (1.2 + Math.sin(t * 7) * 0.15); p.lan.rotation.z += w * 1.2; },
  },
  { // Le Sciure di Porta Venezia: cappotto a campana, cappello a tesa larga, visiera luminosa, cane robot
    color: '#00a6a6', legs: false,
    build(p, c, root) {
      M(cyl(0.14, 0.34, 0.6, 8), lam(GREY.mid), 0, -0.12, 0, p.torso);
      p.chest.scale.x = 0.85;
      p.hat = grp(p.head, 0, 0.2, 0);
      M(cyl(0.3, 0.3, 0.025, 10), lam(GREY.dark), 0, 0, 0, p.hat);
      M(cyl(0.1, 0.12, 0.12, 8), lam(GREY.dark), 0, 0.07, 0, p.hat);
      shine(box(0.22, 0.05, 0.05), c, 0, 0.11, 0.09, p.head, 0.15);
      p.dog = robodog(root); p.dog.d.position.set(0.36, 0.08, 0.22); p.dog.d.rotation.y = -0.5;
    },
    pose(p) { p.hat.position.y = 0.2; p.hat.rotation.z = 0; p.dog.d.position.y = 0.08; p.dog.body.rotation.z = 0; p.dog.body.position.y = 0.13; p.dog.legs.forEach(l => (l.rotation.z = 0)); },
    idle(p, t, ph) { // il cane si siede e si rialza
      const u = (t + ph) % 8, sit = u < 3 ? 0 : u < 3.5 ? ease((u - 3) / 0.5) : u < 6.5 ? 1 : u < 7 ? 1 - ease((u - 6.5) / 0.5) : 0;
      p.dog.body.rotation.z = sit * 0.5; p.dog.body.position.y = 0.13 - sit * 0.03;
      p.dog.legs[2].rotation.z = p.dog.legs[3].rotation.z = -sit * 1.1;
    },
    win(p, w, t) { p.hat.position.y += w * 0.12; p.hat.rotation.z = w * 0.4; p.armR.rotation.z += w * 2.5; p.dog.d.position.y += w * 0.12 * Math.abs(Math.sin(t * 9)); },
  },
  { // I Monaci del Duomo: saio col cappuccio a guglia, drone che gira attorno alla testa come un'aureola
    color: '#6c3bff', legs: false,
    build(p, c) {
      M(cyl(0.15, 0.3, 0.86, 7), lam(GREY.coat), 0, 0, 0, p.torso);
      M(cone(0.15, 0.55, 6), lam(GREY.coat), 0, 0.25, -0.01, p.head);
      M(box(0.1, 0.1, 0.02), lam('#15181b'), 0, 0.09, 0.09, p.head);
      p.armL.scale.x = p.armR.scale.x = 1.4;
      p.halo = grp(p.head, 0, 0.62, 0);
      M(torus(0.2, 0.012, 20), haze(c, 0.6), 0, 0, 0, p.halo).rotation.x = Math.PI / 2;
      const d = grp(p.halo, 0.2, 0, 0);
      M(box(0.07, 0.025, 0.07), lam(GREY.dark), 0, 0, 0, d);
      shine(cyl(0.05, 0.05, 0.02, 8), c, 0, 0.02, 0, d, 0.1);
    },
    pose(p) { p.armL.rotation.set(-0.6, 0, 0.3); p.armR.rotation.set(-0.6, 0, -0.3); p.halo.position.y = 0.62; },
    idle(p, t, ph) { p.halo.rotation.y = t * 1.5 + ph; },
    win(p, w, t) { p.armL.rotation.x *= 1 - w; p.armR.rotation.x *= 1 - w; p.armL.rotation.z -= w * 1.7; p.armR.rotation.z += w * 1.7; p.halo.position.y += w * 0.2; p.halo.rotation.y = t * (1.5 + w * 8); },
  },
  { // La Banda del Leonka: cresta luminosa, giubbotto di pelle con toppe, cassa a tracolla
    color: '#ff2d87', legs: true, coat: '#2a2e33',
    build(p, c) {
      M(box(0.08, 0.08, 0.01), lam('#6e7780'), -0.08, 0.28, 0.105, p.torso);
      M(box(0.06, 0.06, 0.01), lam('#8a7f6e'), 0.09, 0.16, 0.105, p.torso);
      M(box(0.04, 0.55, 0.02), lam(GREY.dark), 0, 0.2, 0.11, p.torso).rotation.z = 0.6;
      p.mohawk = grp(p.head, 0, 0.19, 0);
      for (const z of [-0.07, 0, 0.07]) M(cone(0.045, 0.24, 4), lit(c), 0, 0.1, z, p.mohawk);
      M(gem(0.15), haze(c, 0.25), 0, 0.1, 0, p.mohawk);
      p.spk = grp(p.torso, -0.27, 0.02, 0.06);
      M(box(0.18, 0.22, 0.14), lam(GREY.dark), 0, 0, 0, p.spk);
      p.woofer = M(cyl(0.06, 0.06, 0.02, 8), lam(GREY.light), 0, 0.02, 0.075, p.spk); p.woofer.rotation.x = Math.PI / 2;
    },
    pose(p) { p.mohawk.scale.y = 1; p.woofer.scale.setScalar(1); },
    idle(p, t, ph, full) { const b = beat(t + ph * 0.05); p.mohawk.scale.y = 1 + b * 0.5; p.woofer.scale.setScalar(1 + b * 0.35); if (full) p.head.rotation.x += b * 0.15; },
    win(p, w, t) { p.armR.rotation.z += w * (2.7 + Math.sin(t * 12) * 0.3); p.mohawk.scale.y += w * 0.6; },
  },
  { // I Ferrovieri di Greco: tuta da lavoro, casco con lampada frontale bianca, chiave inglese enorme in spalla
    color: '#1b1b1b', glow: '#ffffff', legs: true, coat: '#4a525a',
    build(p) {
      M(dome(0.13), lam('#6b747c'), 0, 0.17, 0, p.head);
      M(box(0.3, 0.015, 0.3), lam('#6b747c'), 0, 0.17, 0, p.head);
      shine(cyl(0.04, 0.04, 0.03, 8), '#ffffff', 0, 0.22, 0.125, p.head, 0.09).rotation.x = Math.PI / 2;
      p.beam = grp(p.head, 0, 0.22, 0.13);
      M(cone(0.22, 0.9, 10, true), haze('#ffffff', 0.16), 0, -0.45, 0, p.beam);
      p.wrench = grp(p.armR, 0, -0.34, 0.03);
      M(box(0.05, 0.62, 0.04), lam(GREY.light), 0, 0.15, 0, p.wrench);
      M(box(0.16, 0.05, 0.045), lam(GREY.light), 0, 0.47, 0, p.wrench);
      M(box(0.04, 0.1, 0.045), lam(GREY.light), -0.06, 0.53, 0, p.wrench);
      M(box(0.04, 0.1, 0.045), lam(GREY.light), 0.06, 0.53, 0, p.wrench);
    },
    pose(p) { p.armR.rotation.set(-1.0, 0, 0.2); p.wrench.rotation.set(1.6, 0, 0); p.beam.rotation.set(-0.8, 0, 0); },
    idle(p, t, ph) { p.beam.rotation.z = Math.sin(t * 0.9 + ph) * 0.5; }, // la lampada spazza il suolo
    win(p, w) { p.armR.rotation.x -= w * 2.0; p.wrench.rotation.x -= w * 1.4; p.beam.rotation.x -= w * 0.8; },
  },
];

// figura di una fazione: stati 'idle', 'enter' (cade dall'alto, impatto, gesto di vittoria), 'surrender' (si accuccia e alza le mani)
export function factionFigure(i) {
  const def = FACTION_FIGURES[i], root = new THREE.Group();
  root.scale.setScalar(SCALE);
  base(root, def.color);
  const p = humanoid(root, { coat: def.coat, legs: def.legs });
  def.build(p, def.glow || def.color, root);
  const shock = M(G('shock', () => new THREE.RingGeometry(0.55, 0.62, 24)), new THREE.MeshBasicMaterial({ color: def.glow || def.color, transparent: true, depthWrite: false, side: THREE.DoubleSide }), 0, 0.09, 0, root);
  shock.rotation.x = -Math.PI / 2; shock.visible = false;
  const ph = Math.random() * 20;
  let state = 'idle', t0 = null;
  return {
    obj: root, faction: i,
    set(s) { state = s; t0 = null; },
    get state() { return state; },
    tick(t, dt, lvl, near) {
      if (t0 === null) t0 = t;
      const a = t - t0, live = lvl !== 'ferma', full = lvl === 'alta' && near;
      if (state === 'enter' && (!live || a > 2.4)) state = 'idle';
      rest(p); def.pose(p);
      if (live) { // respiro sempre; ondeggio, giro di testa e dettaglio della fazione solo da vicino in qualità piena
        p.torso.scale.y = 1 + Math.sin(t * 2.2 + ph) * 0.025;
        if (full) {
          p.torso.rotation.z = Math.sin(t * 0.8 + ph) * 0.05;
          const u = (t + ph) % 9; p.head.rotation.y = u < 1.6 ? Math.sin(u / 1.6 * Math.PI) * 0.7 * (ph > 10 ? 1 : -1) : 0;
        }
        if (near && lvl === 'alta') def.idle(p, t, ph, full);
      }
      shock.visible = false;
      if (state === 'enter') {
        const fall = clamp01(a / 0.45);
        p.body.position.y = 0.08 + (1 - fall * fall) * 3.2;
        const sq = bump(clamp01((a - 0.45) / 0.3)); p.body.scale.set(1 + sq * 0.25, 1 - sq * 0.3, 1 + sq * 0.25);
        if (a > 0.45 && a < 1.15) { const k = (a - 0.45) / 0.7; shock.visible = true; shock.scale.setScalar(1 + k * 1.6); shock.material.opacity = 1 - k; }
        def.win(p, bump(clamp01((a - 0.75) / 1.6)), t);
      } else if (state === 'surrender') {
        const w = live ? ease(a / 0.6) : 1;
        p.body.position.y = 0.08 - 0.06 * w; p.body.scale.y = 1 - 0.18 * w;
        p.legs.forEach(l => (l.rotation.x = -0.5 * w));
        p.torso.rotation.x = 0.2 * w; p.head.rotation.x = 0.3 * w;
        p.armL.rotation.set(0, 0, -2.7 * w); p.armR.rotation.set(0, 0, 2.7 * w);
        if (full) p.torso.rotation.z += Math.sin(t * 25) * 0.012; // trema
      }
    },
  };
}

// presidio di polizia: barricata modulare bianco-rossa, agente antisommossa con scudo, lampeggiante, droni con cono di scansione,
// cane robot di pattuglia, stemma col volto dell'agente. Stati 'enter' (i droni scendono, la barricata si monta), 'idle', 'leave'.
export function policePost(badgeMat) {
  const root = new THREE.Group(); root.scale.setScalar(SCALE);
  const blocks = [];
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2 + Math.PI / 6, b = grp(root, Math.cos(a) * 0.74, 0, Math.sin(a) * 0.74);
    b.rotation.y = -a + Math.PI / 2;
    M(box(0.36, 0.16, 0.07), lam(k % 2 ? '#e9ecee' : '#d6232a'), 0, 0.15, 0, b);
    M(box(0.362, 0.04, 0.072), lam(k % 2 ? '#d6232a' : '#e9ecee'), 0, 0.15, 0, b);
    for (const x of [-0.13, 0.13]) M(box(0.05, 0.07, 0.16), lam('#2b3a4f'), x, 0.035, 0, b);
    blocks.push(b);
  }
  const post = grp(root, -0.62, 0, -0.5);
  M(box(0.05, 0.62, 0.05), lam('#2b3a4f'), 0, 0.31, 0, post);
  const beacon = grp(post, 0, 0.66, 0);
  M(box(0.07, 0.06, 0.07), lit('#ff2a2a'), 0.045, 0, 0, beacon); M(box(0.07, 0.06, 0.07), lit('#2a7bff'), -0.045, 0, 0, beacon);
  const off = grp(root, 0.66, 0, 0.4); off.rotation.y = 0.5;
  const o = humanoid(off, { coat: '#3d4855' });
  M(dome(0.125), lam('#2b3a4f'), 0, 0.15, 0, o.head);
  M(box(0.19, 0.08, 0.04), visor(), 0, 0.12, 0.08, o.head);
  M(box(0.3, 0.48, 0.03), shield(), -0.04, 0.18, 0.17, o.torso);
  o.armL.rotation.x = -0.5;
  const orbit = grp(root, 0, 1.25, 0), drones = [];
  for (let k = 0; k < 3; k++) {
    const d = grp(orbit, Math.cos(k * 2.09) * 0.95, (k % 2) * 0.12, Math.sin(k * 2.09) * 0.95);
    M(box(0.14, 0.04, 0.14), lam('#1b2330'), 0, 0, 0, d);
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) M(cyl(0.05, 0.05, 0.01, 8), lam('#7b8794'), x * 0.09, 0.025, z * 0.09, d);
    M(box(0.03, 0.02, 0.03), lit('#ff2a2a'), 0, -0.03, 0, d);
    const scan = grp(d); M(cone(0.24, 1.1, 8, true), haze('#cfe8ff', 0.09), 0, -0.6, 0, scan);
    drones.push({ d, scan });
  }
  const patrol = grp(root), dog = robodog(patrol, '#3d4855');
  dog.d.position.set(0, 0, 0.98); dog.d.rotation.y = Math.PI; // gira in senso antiorario, muso in avanti
  const badge = new THREE.Sprite(badgeMat); badge.scale.setScalar(0.85); badge.position.y = 1.75; badge.renderOrder = 9; root.add(badge);
  let state = 'idle', t0 = null;
  return {
    obj: root,
    set(s) { state = s; t0 = null; },
    get state() { return state; },
    get gone() { return state === 'gone'; },
    tick(t, dt, lvl, near) {
      if (t0 === null) t0 = t;
      const a = t - t0, live = lvl !== 'ferma';
      if (!live && state === 'enter') state = 'idle';
      if (!live && state === 'leave') state = 'gone';
      // montaggio (enter) o smontaggio (leave): k da 0 (assente) a 1 (montato)
      const build = state === 'enter' ? a : state === 'leave' ? 1.8 - a : state === 'gone' ? -1 : 9;
      if (state === 'enter' && a > 1.8) state = 'idle';
      if (state === 'leave' && a > 1.8) state = 'gone';
      root.visible = state !== 'gone';
      const order = state === 'leave' ? [5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5];
      blocks.forEach((b, k) => { const s = ease((build - 0.5 - order.indexOf(k) * 0.15) / 0.3); b.scale.set(1, Math.max(0.001, s), 1); b.position.y = (s - 1) * 0.2; });
      const so = ease((build - 1.3) / 0.4); off.scale.set(so || 0.001, so || 0.001, so || 0.001); badge.visible = so > 0.5;
      orbit.position.y = 1.25 + (1 - ease(build / 0.8)) * 4;
      if (live) beacon.rotation.y = t * 6;
      const move = live && lvl === 'alta';
      if (move) {
        orbit.rotation.y = t * 0.6;
        drones.forEach(({ d, scan }, k) => { d.position.y = (k % 2) * 0.12 + Math.sin(t * 2 + k) * 0.04; scan.rotation.x = Math.sin(t * 1.3 + k * 2) * 0.35; });
        patrol.rotation.y = -t * 0.45;
        dog.legs.forEach((l, k) => (l.rotation.z = Math.sin(t * 9 + (k % 2 ? Math.PI : 0) + (k > 1 ? Math.PI : 0)) * 0.5));
      }
      drones.forEach(({ scan }) => (scan.visible = near));
    },
  };
}

// progetto urbano (ex monastero): fioriere con piante, gazebo con lucine, pannello solare, volontario che annaffia, anello verde.
// Disposto ad anello attorno alla base così non copre la figura della fazione; le cose alte stanno dietro.
export function communityProject(green = '#2dff9a') {
  const root = new THREE.Group(); root.scale.setScalar(SCALE);
  M(torus(0.66, 0.035, 32), lit(green), 0, 0.03, 0, root).rotation.x = Math.PI / 2;
  const halo = M(torus(0.66, 0.09, 32), haze(green, 0.35), 0, 0.03, 0, root); halo.rotation.x = Math.PI / 2;
  const grow = [];
  for (const deg of [30, 150, 205]) {
    const a = deg * Math.PI / 180, g = grp(root, Math.cos(a) * 0.84, 0, Math.sin(a) * 0.84);
    g.rotation.y = -a + Math.PI / 2;
    M(box(0.3, 0.1, 0.14), lam('#5d6369'), 0, 0.05, 0, g);
    for (let j = 0; j < 3; j++) {
      const pl = grp(g, (j - 1) * 0.09, 0.1, 0);
      if (j % 2) M(gem(0.06), lam('#4d9a5c'), 0, 0.05, 0, pl); else M(cone(0.05, 0.17, 5), lam('#3f8a52'), 0, 0.085, 0, pl);
      grow.push(pl);
    }
  }
  const gaz = grp(root, -0.62, 0, -0.62), pieces = [gaz];
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) M(cyl(0.015, 0.015, 0.5, 4), lam(GREY.light), x * 0.14, 0.25, z * 0.14, gaz);
  M(cone(0.27, 0.18, 4), lam('#4a5157'), 0, 0.59, 0, gaz).rotation.y = Math.PI / 4;
  const sol = grp(root, 0.64, 0, -0.6); pieces.push(sol);
  M(box(0.04, 0.36, 0.04), lam(GREY.mid), 0, 0.18, 0, sol);
  M(box(0.34, 0.02, 0.22), lam('#1f3550'), 0, 0.38, 0, sol).rotation.x = -0.5;
  // filo di lucine tra il gazebo e il pannello, dietro la figura
  const bulbs = [], A = new THREE.Vector3(-0.48, 0.5, -0.62), B = new THREE.Vector3(0.5, 0.42, -0.6), wire = [];
  for (let k = 0; k <= 8; k++) {
    const u = k / 8, pt = A.clone().lerp(B, u); pt.y -= Math.sin(u * Math.PI) * 0.12; wire.push(pt);
    if (k && k < 8) bulbs.push(M(gem(0.025), new THREE.MeshBasicMaterial({ color: '#3a3f45' }), pt.x, pt.y - 0.02, pt.z, root));
  }
  root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: '#25292e' })));
  // volontario con l'annaffiatoio: va e viene sul lato destro e si ferma ad annaffiare
  const walker = grp(root), vol = grp(walker); vol.scale.setScalar(0.55);
  const v = humanoid(vol, { coat: GREY.mid });
  const can = grp(v.armR, 0, -0.36, 0.05);
  M(box(0.12, 0.1, 0.08), lam('#6f9a7a'), 0, -0.04, 0.04, can); M(box(0.02, 0.02, 0.12), lam('#6f9a7a'), 0, 0, 0.12, can);
  const ON = '#ffd27a', OFF = new THREE.Color('#3a3f45');
  let state = 'idle', t0 = null;
  return {
    obj: root,
    set(s) { state = s; t0 = null; },
    get state() { return state; },
    tick(t, dt, lvl, near) {
      if (t0 === null) t0 = t;
      const a = t - t0, live = lvl !== 'ferma';
      if (state === 'enter' && (!live || a > 2.5)) state = 'idle';
      const k = state === 'enter' ? a : 9;
      grow.forEach((pl, j) => pl.scale.setScalar(Math.max(0.001, ease((k - j * 0.07) / 0.5))));   // le piante crescono
      pieces.forEach((pc, j) => pc.scale.setScalar(Math.max(0.001, ease((k - 0.2 - j * 0.2) / 0.4))));
      bulbs.forEach((b, j) => b.material.color.set(k > 1 + j * 0.15 ? ON : OFF));                   // lucine che si accendono a catena
      halo.material.opacity = 0.35;
      halo.scale.setScalar(live ? 1 + Math.sin(t * 1.4) * 0.05 : 1);
      // giro del volontario: 3 s di cammino, 1 s ad annaffiare, ritorno
      const u = live && lvl === 'alta' ? (t * 0.5) % 4 : 1.25, out = u < 2;
      const w = out ? Math.min(1, u / 1.5) : Math.max(0, 1 - (u - 2) / 1.5), walking = out ? u < 1.5 : u - 2 < 1.5;
      const ang = (-25 + w * 60) * Math.PI / 180;
      walker.position.set(Math.cos(ang) * 0.92, 0, Math.sin(ang) * 0.92);
      vol.rotation.y = -ang + (out ? 0 : Math.PI);
      rest(v); can.rotation.x = 0;
      if (live && lvl === 'alta' && walking) v.legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 10 + i * Math.PI) * 0.5));
      else if (live && lvl === 'alta') { v.armR.rotation.x = -1.1; can.rotation.x = 0.6; } // annaffia
      walker.visible = near || !live;
    },
  };
}

// conteggio triangoli (per controllare il budget low poly)
export function triangles(obj) {
  let n = 0;
  obj.traverse(o => { if (o.isMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return n;
}
