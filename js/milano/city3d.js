// Milano 3D: edifici reali (OSM), acqua, parchi, municipi di gioco; quartieri come cerchi, strade come trattini 3D.
// Effetti: municipio che si alza alla selezione, meteo che cambia, hinterland sfocato.
import * as THREE from 'three';
import { OrbitControls } from '../../vendor/three/OrbitControls.js';
import { THEME } from './theme.js';

let T = THEME; // tema attivo: quello del gioco, o una variante passata in createCity(view.theme)
const merge = (a, b) => Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b || {})])].map(k =>
  [k, b?.[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && typeof a[k] === 'object' ? merge(a[k], b[k]) : b?.[k] ?? a[k]]));

// Livelli di qualità grafica: 'auto' parte da quello adatto al dispositivo e scende se la scena fatica
export const QUALITY = {
  // pixels: tetto ai pixel disegnati per fotogramma, così uno schermo 4K non costa più di uno Full HD
  alta: { label: 'Alta', pr: 2, pixels: 3.2e6, shadow: 4096, blur: true, rain: 1, fps: 0 },
  media: { label: 'Media', pr: 1.25, pixels: 1.6e6, shadow: 2048, blur: true, rain: 0.6, fps: 0 },
  bassa: { label: 'Bassa', pr: 0.8, pixels: 0.7e6, shadow: 0, blur: false, rain: 0.3, fps: 30 },
};
const weakDevice = () => /[?&]q=low/.test(location.search) || matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;

const W = 1100, H = 1023;
const X = x => (x - W / 2) / 100, Z = y => (y - H / 2) / 100;
const HS = (1 / 18.2) * 4 / 100; // metri -> unità scena (1 unità canvas ≈ 18,2 m), altezze ×4
const OV = 0.03;                  // quota degli elementi in sovrimpressione
const LIFT = 0.07;                // di quanto si alza il municipio selezionato

const rings = d => d.split(/(?=M)/).map(s => [...s.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m => [+m[1], +m[2]])).filter(r => r.length > 2);
function flatGeometry(polys) {
  const g = new THREE.ShapeGeometry(polys.map(r => new THREE.Shape(r.map(([x, y]) => new THREE.Vector2(X(x), -Z(y))))));
  g.rotateX(-Math.PI / 2);
  return g;
}
const flat = (polys, color, y, opts = {}) => {
  const m = new THREE.Mesh(flatGeometry(polys), new THREE.MeshLambertMaterial({ color, ...opts }));
  m.position.y = y; m.receiveShadow = true; return m;
};
function ribbon(pts, width, y) {
  const pos = [], idx = [];
  pts.forEach(([x, z], i) => {
    const [px, pz] = pts[Math.max(0, i - 1)], [nx, nz] = pts[Math.min(pts.length - 1, i + 1)];
    let dx = nx - px, dz = nz - pz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    pos.push(X(x) - dz * width, y, Z(z) + dx * width, X(x) + dz * width, y, Z(z) - dx * width);
    if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// Confini tra le aree disegnati una volta sola: i punti di aree vicine a meno di 4 px si fondono, i tratti doppi si tolgono.
// Restano a terra anche quando un'area si alza, così non si vedono due linee.
function sharedBorders(regionRings, width, y, color) {
  const pts = [], SNAP = 4;
  const snap = ([x, z]) => { const p = pts.find(q => Math.hypot(q[0] - x, q[1] - z) < SNAP); if (p) return p; const n = [x, z]; pts.push(n); return n; };
  const seen = new Set(), segs = [];
  for (const rs of regionRings) for (const ring of rs) {
    const r = ring.map(snap);
    r.forEach((a, i) => {
      const b = r[(i + 1) % r.length]; if (a === b) return;
      const ia = pts.indexOf(a), ib = pts.indexOf(b), key = Math.min(ia, ib) + ':' + Math.max(ia, ib);
      if (!seen.has(key)) { seen.add(key); segs.push([a, b]); }
    });
  }
  const pos = [], idx = [];
  for (const [[x0, z0], [x1, z1]] of segs) {
    const ax = X(x0), az = Z(z0), bx = X(x1), bz = Z(z1), l = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / l * width, nz = (bx - ax) / l * width, k = pos.length / 3;
    pos.push(ax + nx, y, az + nz, ax - nx, y, az - nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz);
    idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  // giunti tondi nei vertici, così le spezzate non hanno buchi
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const m = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color });
  m.add(new THREE.Mesh(g, mat));
  const dots = new THREE.InstancedMesh(new THREE.CircleGeometry(width, 8).rotateX(-Math.PI / 2), mat, pts.length), m4 = new THREE.Matrix4();
  pts.forEach(([x, z], i) => dots.setMatrixAt(i, m4.makeTranslation(X(x), y, Z(z)))); m.add(dots);
  return over(m, 1);
}

// in sovrimpressione: sempre visibili sopra gli edifici (vale anche per i figli di un gruppo)
const over = (m, order) => {
  m.traverse(c => {
    c.renderOrder = order;
    if (c.material) Object.assign(c.material, { depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide, fog: false }); // colori di gioco puri, fuori dalla nebbia
  });
  return m;
};

// Edifici: una mesh per municipio (flag bit 1-4 = indice+1), più l'hinterland (0)
function buildingMeshes(buf) {
  const dv = new DataView(buf), n = dv.getUint32(0, true), groups = {};
  let o = 4;
  for (let i = 0; i < n; i++) {
    const k = dv.getUint16(o, true), r = dv.getUint8(o + 3) >> 1;
    (groups[r] ??= { nv: 0, ni: 0, list: [] }).list.push(o);
    groups[r].nv += 2 * k; groups[r].ni += 6 * k + 3 * (k - 2); o += 4 + 4 * k;
  }
  const cin = new THREE.Color(T.building.city), cout = new THREE.Color(T.building.outside), meshes = {};
  for (const [r, gr] of Object.entries(groups)) {
    const pos = new Float32Array(gr.nv * 3), col = new Uint8Array(gr.nv * 3), idx = new Uint32Array(gr.ni);
    let v = 0, t = 0;
    for (let off of gr.list) {
      const k = dv.getUint16(off, true), h = Math.max(4, dv.getUint8(off + 2)) * HS * (T.heights ?? 1), inside = dv.getUint8(off + 3) & 1;
      off += 4;
      const base = v, contour = [], c = inside ? cin : cout, shade = inside ? 1 - Math.min(0.06, h * 0.1) : 1;
      for (let j = 0; j < k; j++, off += 4) {
        const x = X(dv.getInt16(off, true) / 10), z = Z(dv.getInt16(off + 2, true) / 10);
        contour.push(new THREE.Vector2(x, z));
        for (const y of [0, h]) { pos.set([x, y, z], v * 3); col.set([c.r * 255 * shade, c.g * 255 * shade, c.b * 255], v * 3); v++; }
      }
      for (let j = 0; j < k; j++) { const a = base + 2 * j, b = base + 2 * ((j + 1) % k); idx.set([a, b, a + 1, a + 1, b, b + 1], t); t += 6; }
      for (const [p, q, s] of THREE.ShapeUtils.triangulateShape(contour, [])) { idx.set([base + 2 * p + 1, base + 2 * q + 1, base + 2 * s + 1], t); t += 3; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
    g.setIndex(new THREE.BufferAttribute(idx.subarray(0, t), 1));
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }));
    m.castShadow = m.receiveShadow = T.shadows !== false;
    if (T.edges && +r) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), new THREE.LineBasicMaterial({ color: T.edges.color, transparent: true, opacity: T.edges.opacity }))); // spigoli luminosi
    meshes[r] = m;
  }
  return meshes;
}

// Stemma della polizia: faccia con casco, disegnata su canvas
function policeBadge() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#10151c'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
  g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke();
  g.fillStyle = '#e8c7a8'; g.beginPath(); g.ellipse(64, 76, 26, 30, 0, 0, 7); g.fill();                                   // volto
  g.fillStyle = '#2b3a4f'; g.beginPath(); g.arc(64, 64, 36, Math.PI, 0); g.lineTo(100, 72); g.lineTo(28, 72); g.fill(); // casco
  g.fillStyle = '#0b0e12'; g.fillRect(32, 64, 64, 14);                                                                  // visiera
  g.fillStyle = T.accent; g.fillRect(36, 68, 26, 5); g.fillStyle = T.suit.blue.fill; g.fillRect(66, 68, 26, 5);
  g.fillStyle = '#c9a43a'; g.beginPath(); g.moveTo(64, 32); g.lineTo(71, 43); g.lineTo(64, 52); g.lineTo(57, 43); g.fill(); // fregio
  g.strokeStyle = '#2b3a4f'; g.lineWidth = 5; g.beginPath(); g.moveTo(38, 80); g.quadraticCurveTo(64, 116, 90, 80); g.stroke(); // sottogola
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// --- meteo ---
const WEATHER = {
  sereno: { label: 'Sereno', clouds: 5, color: '#d5dadf', opacity: 0.12, sun: 2.6, hemi: 2.1, rain: 0 },
  nuvoloso: { label: 'Nuvoloso', clouds: 14, color: '#c3c9cf', opacity: 0.16, sun: 1.7, hemi: 1.9, rain: 0 },
  pioggia: { label: 'Pioggia', clouds: 20, color: '#a7afb6', opacity: 0.2, sun: 1.0, hemi: 1.6, rain: 2200 },
  temporale: { label: 'Temporale', clouds: 26, color: '#8b939a', opacity: 0.25, sun: 0.6, hemi: 1.3, rain: 4000, lightning: true },
};
export const WEATHER_TYPES = Object.fromEntries(Object.entries(WEATHER).map(([k, v]) => [k, v.label]));

// --- sfocatura dell'hinterland: scena in un render target, sfocata fuori dalla maschera del Comune ---
const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const BLUR_FS = `uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
  void main(){ vec4 s = texture2D(tex, vUv) * .227;
    s += (texture2D(tex, vUv + dir * 1.385) + texture2D(tex, vUv - dir * 1.385)) * .316;
    s += (texture2D(tex, vUv + dir * 3.231) + texture2D(tex, vUv - dir * 3.231)) * .07;
    gl_FragColor = s; }`;
const MIX_FS = `uniform sampler2D sharp, soft, mask; varying vec2 vUv;
  void main(){ float m = smoothstep(.15, .85, texture2D(mask, vUv).r);
    gl_FragColor = vec4(mix(texture2D(soft, vUv).rgb, texture2D(sharp, vUv).rgb, m), 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export async function createCity(container, overlay, view = {}) {
  T = view.theme ? merge(THEME, view.theme) : THEME;
  const base = new URL('../../assets/milano/', import.meta.url);
  const [map, env, bin] = await Promise.all([
    fetch(new URL('mappa.json', base)).then(r => r.json()),
    fetch(new URL('env.json', base)).then(r => r.json()),
    fetch(new URL('buildings.bin', base)).then(r => r.arrayBuffer()),
  ]);
  const towns = map.towns, townIndex = Object.fromEntries(towns.map((t, i) => [t.id, i]));

  let qName = view.quality || 'auto', q = QUALITY[qName === 'auto' ? (weakDevice() ? 'media' : 'alta') : qName];
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  if (view.pixel) renderer.domElement.style.imageRendering = 'pixelated'; // pixel art: si disegna a bassa risoluzione e si ingrandisce
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  container.appendChild(renderer.domElement);
  renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute('aria-label', 'Mappa di Milano: frecce o WASD per spostarla');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(T.sky[1]);
  scene.fog = new THREE.Fog(T.fog?.color || T.sky[1], ...(T.fog?.range || [16, 34]));
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 80);
  camera.position.set(...(view.camera || [0.3, 8.4, 9.2]));
  const controls = new OrbitControls(camera, renderer.domElement);
  // sinistro: sposta · destro: ruota · rotella: zoom (su touch: un dito sposta, due dita zoom e rotazione)
  Object.assign(controls, { enableDamping: true, minDistance: 2.2, maxDistance: 18, maxPolarAngle: 1.25, screenSpacePanning: false,
    mouseButtons: { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE },
    touches: { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE } });
  const HOME = { camera: new THREE.Vector3(...(view.camera || [0.3, 8.4, 9.2])), target: new THREE.Vector3(...(view.target || [0.2, 0, 0.9])) };
  controls.target.copy(HOME.target);
  let homing = 0; // >0 mentre la vista torna a quella iniziale (bussola)
  const goal = { camera: HOME.camera.clone(), target: HOME.target.clone() };
  const keys = new Set(), MOVE = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  const mapFocused = () => [document.body, renderer.domElement, null].includes(document.activeElement);
  addEventListener('keydown', e => { if (MOVE[e.code] && mapFocused() && !e.altKey && !e.ctrlKey && !e.metaKey) { keys.add(e.code); e.preventDefault(); } });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  const L = { hemi: 1, sun: 1, sky: '#ffffff', ground: '#aab7c2', sunColor: '#fffaf0', sunPos: [-5, 9, 4], ...(T.light || {}) };
  const hemi = new THREE.HemisphereLight(L.sky, L.ground, 2.1 * L.hemi);
  const sun = new THREE.DirectionalLight(L.sunColor, 2.6 * L.sun);
  sun.position.set(...L.sunPos);
  Object.assign(sun.shadow.camera, { left: -7.5, right: 7.5, top: 7.5, bottom: -7.5, near: 1, far: 30 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.01;
  scene.add(hemi, sun);

  // suolo: hinterland grigio-verde con campi, Comune chiaro, parchi, acqua
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: T.ground.outside }));
  outer.rotation.x = -Math.PI / 2; outer.receiveShadow = true; scene.add(outer);
  scene.add(flat(env.rural, T.rural, 0.0005));
  const cityShape = rings(map.city_outline_path);
  scene.add(flat(cityShape, T.ground.city, 0.001));
  scene.add(flat(env.parks, T.park, 0.003));
  const waterMat = new THREE.MeshLambertMaterial({ color: T.water, emissive: T.water, emissiveIntensity: 0.25 });
  const water = new THREE.Mesh(flatGeometry(env.water), waterMat); water.position.y = 0.005; scene.add(water);
  for (const [name, lines] of Object.entries(env.rivers))
    for (const l of lines) scene.add(new THREE.Mesh(ribbon(l, name.startsWith('Lambro') ? 0.016 : 0.012, 0.006), waterMat));

  // municipi: ognuno è un gruppo (tinta, bordo, edifici, quartieri, pedine) che si può alzare
  const AREAS = view.areas === 'nero'; // proposta: confini scuri, area velata del suo colore
  if (AREAS) scene.add(sharedBorders(Object.values(map.regions).map(r => rings(r.svg_path)), 0.013, OV, '#3d434a'));
  const meshes = buildingMeshes(bin);
  scene.add(meshes[0]);
  const regions = {};
  env.regionKeys.forEach((k, i) => {
    const r = map.regions[k], g = new THREE.Group(), color = new THREE.Color(T.region[k]);
    const tint = flat(rings(r.svg_path), color, 0.002, { transparent: true, opacity: 0.16, depthWrite: false });
    const borders = AREAS ? [] : rings(r.svg_path).map(ring => over(new THREE.Mesh(ribbon([...ring, ring[0]], 0.014, OV), new THREE.MeshBasicMaterial({ color, opacity: 0.9 })), 1));
    const glow = rings(r.svg_path).map(ring => over(new THREE.Mesh(ribbon([...ring, ring[0]], 0.06, OV - 0.002),
      new THREE.MeshBasicMaterial({ color, opacity: 0, blending: THREE.AdditiveBlending })), 0));
    const bld = meshes[i + 1], pieces = new THREE.Group();
    g.add(tint, ...borders, ...glow, pieces);
    if (bld) g.add(bld);
    scene.add(g);
    regions[k] = { g, tint, glow, bld, pieces, color, lift: 0 };
  });

  // quartieri: cerchi del colore del seme
  const disc = (r0, r1, color, y, order, opts = {}) => {
    const m = over(new THREE.Mesh(r0 ? new THREE.RingGeometry(r0, r1, 48) : new THREE.CircleGeometry(r1, 48), new THREE.MeshBasicMaterial({ color, ...opts })), order);
    m.rotation.x = -Math.PI / 2; m.position.y = y; return m;
  };
  // forma dei quartieri (view.markers): 'disco' com'era; proposte 'anello' (vuoto→pieno), 'esagono' (piatto→torre), 'rombo' (piatto→spillo)
  const MK = view.markers || 'disco', BRIGHT = { red: '#ff1f2d', blue: '#0a84ff', yellow: '#ffd400' };
  const poly = (r, n, color, y, order, r0 = 0) => {
    const m = over(new THREE.Mesh(r0 ? new THREE.RingGeometry(r0, r, n, 1, Math.PI / 2) : new THREE.CircleGeometry(r, n, Math.PI / 2), new THREE.MeshBasicMaterial({ color })), order);
    m.rotation.x = -Math.PI / 2; m.position.y = y; return m;
  };
  const freeMarker = (suit, g) => {
    const c = BRIGHT[suit];
    if (MK === 'anello') { g.add(poly(0.112, 48, T.ink, OV, 3, 0.05)); return poly(0.1, 48, c, OV, 3.2, 0.062); }
    const n = MK === 'esagono' ? 6 : 4, r = MK === 'esagono' ? 0.108 : 0.115;
    g.add(poly(r, n, T.ink, OV, 3)); return poly(r * 0.8, n, c, OV, 3.2);
  };
  const spots = towns.map((t, i) => {
    const g = new THREE.Group(); g.position.set(X(t.x), 0, Z(t.y));
    if (MK !== 'disco') {
      const free = new THREE.Group(), fill = freeMarker(t.suit, free); free.add(fill);
      const option = disc(0.125, 0.15, T.project, OV, 3.3); option.visible = false;
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.4, 8), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.2; hit.userData.town = i;
      g.add(free, option, hit); regions[t.region].g.add(g);
      return { g, hit, fill, option, free, region: t.region, suit: t.suit };
    }
    const fill = disc(0, 0.078, T.suit[t.suit].fill, OV, 3.2);
    const option = disc(0.125, 0.15, T.project, OV, 3.3); option.visible = false; // anello delle scelte possibili
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.4, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.2; hit.userData.town = i;
    g.add(disc(0, 0.108, T.ink, OV, 3), disc(0, 0.094, '#ffffff', OV, 3.1), fill, option, hit);
    regions[t.region].g.add(g);
    return { g, hit, fill, option, region: t.region };
  });

  // strade: trattini 3D ad arco
  const dashes = [], DASH = 0.04, GAP = 0.028;
  for (const r of map.roads) {
    const a = towns[townIndex[r.a]], b = towns[townIndex[r.b]];
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(X(a.x), OV, Z(a.y)),
      new THREE.Vector3(X(r.control[0]), OV + 0.16, Z(r.control[1])), new THREE.Vector3(X(b.x), OV, Z(b.y)));
    const len = curve.getLength(), start = 0.12 / len, end = 1 - 0.12 / len;
    for (let u = start; u + DASH / len <= end; u += (DASH + GAP) / len) dashes.push([curve.getPointAt(u), curve.getPointAt(u + DASH / len)]);
  }
  const dashMesh = over(new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 10), new THREE.MeshLambertMaterial({ color: '#1d1d1f' }), dashes.length), 2);
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), mid = new THREE.Vector3();
    dashes.forEach(([p0, p1], i) => {
      dir.subVectors(p1, p0); const l = dir.length(); q.setFromUnitVectors(up, dir.normalize());
      m4.compose(mid.addVectors(p0, p1).multiplyScalar(0.5), q, new THREE.Vector3(0.013, l, 0.013));
      dashMesh.setMatrixAt(i, m4);
    });
  }
  scene.add(dashMesh);

  // segnalino del quartiere attivo (anello pulsante)
  const halo = disc(0.15, 0.18, T.accent, OV, 7);
  scene.add(halo);

  // --- pedine ---
  const mats = {};
  const mat = (c, o = {}) => (mats[c + JSON.stringify(o)] ??= new THREE.MeshLambertMaterial({ color: c, ...o }));
  const badgeMat = new THREE.SpriteMaterial({ map: policeBadge(), depthTest: false, depthWrite: false, transparent: true });
  const droneProto = new THREE.Group(); // drone piccolo: corpo, 4 rotori, luce
  droneProto.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.03), mat('#1b2330')));
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.003, 12), mat('#7b8794'));
    r.position.set(x * 0.022, 0.008, z * 0.022); droneProto.add(r);
  }
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: T.accent }));
  led.position.y = -0.008; droneProto.add(led);
  const spinners = [], glows = [];
  let selected = null, active = null;

  function update(s) {
    for (const r of Object.values(regions)) r.pieces.clear();
    spinners.length = glows.length = 0;
    s.towns.forEach((st, i) => {
      if (spots[i].free) spots[i].free.visible = st.owner === null || MK !== 'anello';
      if (st.owner === null) return;
      const p = spots[i].g.position, parent = regions[spots[i].region].pieces;
      const put = (m, y = OV, order = 5) => { over(m, order); m.position.x += p.x; m.position.y += y; m.position.z += p.z; parent.add(m); return m; };
      const solid = (m, y, order) => { put(m, y, order); m.material.side = THREE.FrontSide; return m; }; // pezzi convessi senza profondità: solo facce davanti
      const pc = T.players[st.owner], sc = BRIGHT[spots[i].suit];
      if (MK === 'anello') { // preso: disco pieno della banda, bordino del seme
        put(poly(0.14, 48, sc, 0, 4, 0.112), OV);
        solid(new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.112, 0.04, 48), mat(pc)), OV + 0.02, 5);
      } else if (MK === 'esagono') { // preso: torretta esagonale della banda sopra l'esagono del seme
        solid(new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.16, 6), mat(pc)), OV + 0.08, 5);
        solid(new THREE.Mesh(new THREE.CylinderGeometry(0.073, 0.073, 0.012, 6), mat('#ffffff')), OV + 0.163, 6);
      } else if (MK === 'rombo') { // preso: spillo da mappa della banda piantato sul rombo del seme
        const pin = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 16), mat(pc)); pin.rotation.x = Math.PI;
        solid(pin, OV + 0.08, 5);
        solid(new THREE.Mesh(new THREE.SphereGeometry(0.066, 20, 14), mat(pc)), OV + 0.2, 6);
        solid(new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 8), mat('#ffffff')), OV + 0.2, 7).position.z += 0.05;
      }
      if (MK === 'disco') {
      // gettone 3D della banda: copre tutto lo spot
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.05, 48), T.glowTokens ? new THREE.MeshBasicMaterial({ color: T.players[st.owner] }) : mat(T.players[st.owner])), OV + 0.025);
      put(new THREE.Mesh(new THREE.TorusGeometry(0.104, 0.01, 8, 48), mat('#ffffff')), OV + 0.05).rotation.x = Math.PI / 2;
      }
      if (st.monastery) { // progetto urbano: anello fluorescente
        put(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.016, 10, 64), new THREE.MeshBasicMaterial({ color: T.project })), OV + 0.02, 4).rotation.x = Math.PI / 2;
        const g = put(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 10, 64), new THREE.MeshBasicMaterial({ color: T.project, opacity: 0.35, blending: THREE.AdditiveBlending })), OV + 0.02, 3);
        g.rotation.x = Math.PI / 2; glows.push(g);
      }
      if (st.viking) { // presidio di polizia: barricata, droni che girano, stemma
        for (let k = 0; k < 6; k++) {
          const a = k / 6 * Math.PI * 2, b = new THREE.Group();
          const block = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 0.02), mat(k % 2 ? '#ffffff' : T.accent));
          const foot = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.008, 0.035), mat('#2b3a4f')); foot.position.y = -0.02;
          b.add(block, foot); b.position.set(Math.cos(a) * 0.17, 0.03, Math.sin(a) * 0.17); b.rotation.y = -a + Math.PI / 2;
          put(b, OV, 6);
        }
        const orbit = new THREE.Group();
        for (let k = 0; k < 3; k++) { const d = droneProto.clone(); d.position.set(Math.cos(k * 2.09) * 0.24, (k % 2) * 0.03, Math.sin(k * 2.09) * 0.24); orbit.add(d); }
        spinners.push(put(orbit, OV + 0.14, 7));
        const badge = new THREE.Sprite(badgeMat); badge.scale.setScalar(0.24); badge.renderOrder = 8; badge.position.y = 0.34;
        parent.add(badge); badge.position.x += p.x; badge.position.z += p.z; badge.position.y += OV;
      }
    });
    active = s.activeTown ?? null;
  }

  // --- etichette HTML proiettate ---
  const labels = [];
  const addLabel = (html, cls, x, y, h, region) => {
    const el = document.createElement('div'); el.className = cls; el.innerHTML = html; overlay.appendChild(el);
    labels.push({ el, p: new THREE.Vector3(X(x), h, Z(y)), region }); return el;
  };
  for (const [k, r] of Object.entries(map.regions)) {
    const [lx, ly] = r.label.tx ? [r.label.tx, r.label.ty] : [r.label.x, r.label.y];
    addLabel(`<b style="--rc:${T.region[k]}">${r.name}</b><span>${r.municipio}</span><i>${r.threshold}<em>soglia</em></i><i>${r.points}<em>punti</em></i>`, 'rlabel', lx, ly, 0.02, k);
  }
  const firstTown = labels.length;
  towns.forEach(t => addLabel(t.name, 'tlabel', t.x, t.y, OV + 0.16, t.region));

  // --- meteo: nuvole basse e rade, pioggia, lampi ---
  const clouds = new THREE.Group(); scene.add(clouds);
  const blob = new THREE.IcosahedronGeometry(1, 1);
  const MAXRAIN = 4000;
  const rainPos = new Float32Array(MAXRAIN * 6), drops = Array.from({ length: MAXRAIN }, () => [0, 0, 0]);
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#5f7a91', transparent: true, opacity: 0.6 }));
  rain.frustumCulled = false; scene.add(rain);
  const wind = new THREE.Vector3(0.12, 0, 0.04);
  let weather = WEATHER.sereno, weatherKey = 'sereno', flash = 0;
  const resetDrop = (d, top) => { d[0] = (Math.random() - 0.5) * 14; d[1] = top ? 2.4 : Math.random() * 2.4; d[2] = (Math.random() - 0.5) * 13; };
  drops.forEach(d => resetDrop(d, false));
  function setWeather(key) {
    weatherKey = key; weather = WEATHER[key];
    clouds.clear();
    const cm = new THREE.MeshLambertMaterial({ color: weather.color, transparent: true, opacity: weather.opacity, depthWrite: false, flatShading: true });
    for (let c = 0; c < (T.clouds === false ? 0 : weather.clouds); c++) {
      const g = new THREE.Group(), n = 4 + Math.floor(Math.random() * 6), size = 0.35 + Math.random() * 0.5;
      for (let k = 0; k < n; k++) {
        const b = new THREE.Mesh(blob, cm), s = size * (0.5 + Math.random() * 0.6);
        b.scale.set(s * 1.4, s * 0.55, s); b.position.set((Math.random() - 0.5) * size * 2.6, Math.random() * size * 0.3, (Math.random() - 0.5) * size * 1.2);
        g.add(b);
      }
      g.position.set((Math.random() - 0.5) * 18, 1.4 + Math.random() * 0.7, (Math.random() - 0.5) * 15);
      clouds.add(g);
    }
    rainGeo.setDrawRange(0, Math.round(Math.min(MAXRAIN, weather.rain * q.rain)) * 2);
  }
  setWeather(view.weather || 'sereno');

  // --- post: hinterland sfocato ---
  const half = new THREE.Vector2();
  const rt = (s = 0) => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: s });
  const rtScene = rt(4), rtA = rt(), rtB = rt(), rtMask = rt(), rtM2 = rt();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blurMat = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: QUAD_VS, fragmentShader: BLUR_FS, toneMapped: false });
  const mixMat = new THREE.ShaderMaterial({ uniforms: { sharp: { value: rtScene.texture }, soft: { value: rtB.texture }, mask: { value: rtM2.texture } }, vertexShader: QUAD_VS, fragmentShader: MIX_FS });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat), quadScene = new THREE.Scene(); quadScene.add(quad);
  const maskScene = new THREE.Scene(); maskScene.background = new THREE.Color('#000');
  maskScene.add(new THREE.Mesh(flatGeometry(cityShape), new THREE.MeshBasicMaterial({ color: '#fff' })));
  const pass = (material, target) => { quad.material = material; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); };
  function blur(src, a, b, times) { // gaussiana separabile, ripetuta per sfocare di più
    for (let k = 0; k < times; k++) {
      blurMat.uniforms.tex.value = k ? b.texture : src.texture; blurMat.uniforms.dir.value.set(1.6 / half.x, 0); pass(blurMat, a);
      blurMat.uniforms.tex.value = a.texture; blurMat.uniforms.dir.value.set(0, 1.6 / half.y); pass(blurMat, b);
    }
  }

  // --- input ---
  let clickable = new Set(), onPick = () => {}, hover = null;
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), hits = spots.map(t => t.hit);
  const pick = e => {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const h = ray.intersectObjects(hits)[0]; return h ? h.object.userData.town : null;
  };
  let down = null;
  renderer.domElement.addEventListener('pointermove', e => { hover = pick(e); renderer.domElement.style.cursor = hover !== null && clickable.has(hover) ? 'pointer' : ''; });
  renderer.domElement.addEventListener('pointerdown', e => (down = [e.clientX, e.clientY]));
  renderer.domElement.addEventListener('pointerup', e => {
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 6) { const id = pick(e); if (id !== null && clickable.has(id)) onPick(id); }
  });

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    const want = view.pixel ? Math.min(view.pixel, q.pr) : Math.min(devicePixelRatio, q.pr);
    renderer.setPixelRatio(Math.max(0.25, Math.min(want, Math.sqrt(q.pixels / Math.max(1, w * h)))));
    renderer.setSize(w, h); camera.aspect = w / h; camera.fov = w < h ? 64 : 36; camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio(), fw = Math.round(w * pr), fh = Math.round(h * pr);
    half.set(Math.max(1, fw >> 1), Math.max(1, fh >> 1));
    rtScene.setSize(fw, fh); [rtA, rtB, rtMask, rtM2].forEach(t => t.setSize(half.x, half.y));
  };
  new ResizeObserver(resize).observe(container);
  function applyQuality() {
    sun.castShadow = q.shadow > 0 && T.shadows !== false;
    if (q.shadow && sun.shadow.mapSize.x !== q.shadow) { sun.shadow.mapSize.setScalar(q.shadow); sun.shadow.map?.dispose(); sun.shadow.map = null; }
    rainGeo.setDrawRange(0, Math.round(Math.min(MAXRAIN, weather.rain * q.rain)) * 2);
    resize();
  }
  applyQuality();
  let slowT = 0, slowN = 0; // misura della fluidità per la qualità automatica

  // --- ciclo ---
  const v = new THREE.Vector3(), white = new THREE.Color('#ffffff'), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let last = 0;
  let lastFrame = 0;
  renderer.setAnimationLoop(time => {
    if (q.fps && time - lastFrame < 1000 / q.fps - 2) return; // qualità bassa: al massimo 30 fotogrammi al secondo
    lastFrame = time;
    const t = time / 1000, real = t - last, dt = Math.min(0.05, real || 0); last = t;
    if (qName === 'auto' && q !== QUALITY.bassa && real > 0 && real < 1) { // in automatico scende di livello se si va sotto i ~28 fotogrammi al secondo
      slowT += real; slowN++;
      if (slowT > 3) { if (slowT / slowN > 1 / 28) { q = q === QUALITY.alta ? QUALITY.media : QUALITY.bassa; applyQuality(); } slowT = slowN = 0; }
    }
    // tastiera: WASD e frecce spostano la vista sul piano della mappa
    if (keys.size) {
      const fwd = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0).normalize(), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const step = new THREE.Vector3(), speed = dt * camera.position.distanceTo(controls.target) * 0.6;
      keys.forEach(k => step.addScaledVector(right, MOVE[k][0]).addScaledVector(fwd, MOVE[k][1]));
      if (step.lengthSq()) { step.normalize().multiplyScalar(speed); camera.position.add(step); controls.target.add(step); }
    }
    if (homing > 0) { // bussola: torna alla vista iniziale con il nord in alto
      homing = Math.max(0, homing - dt * 2.5); const k = 1 - homing;
      camera.position.lerp(goal.camera, k * 0.25 + 0.05); controls.target.lerp(goal.target, k * 0.25 + 0.05);
      if (!homing) { camera.position.copy(goal.camera); controls.target.copy(goal.target); }
    }
    controls.update();
    if (view.compass) view.compass.style.setProperty('--az', `${controls.getAzimuthalAngle()}rad`);
    // municipio del quartiere selezionato: si alza e si colora
    const selRegion = selected !== null ? spots[selected].region : null;
    for (const [k, r] of Object.entries(regions)) {
      r.lift += ((k === selRegion ? 1 : 0) - r.lift) * Math.min(1, dt * 6);
      r.g.position.y = r.lift * LIFT;
      r.tint.material.opacity = (AREAS ? 0.3 : 0.16) + r.lift * 0.3;
      r.glow.forEach(g => (g.material.opacity = r.lift * (0.45 + (still ? 0 : Math.sin(t * 3) * 0.15))));
      if (r.bld) r.bld.material.color.copy(white).lerp(r.color, (AREAS ? 0.16 : 0) + r.lift * 0.4); // con aree colorate anche gli edifici prendono una velatura
    }
    spots.forEach((sp, i) => {
      const on = i === selected;
      sp.g.scale.setScalar(on ? 1.7 : i === hover && clickable.has(i) ? 1.25 : 1);
      sp.fill.material.opacity = on && !still ? 0.7 + Math.sin(t * 4) * 0.3 : 1; // pulsazione lenta, non lampeggio
      sp.option.visible = clickable.has(i) && !on;
      if (sp.option.visible) sp.option.material.opacity = 0.55 + (still ? 0.3 : Math.sin(t * 5) * 0.35);
    });
    halo.visible = active !== null;
    if (active !== null) {
      const sp = spots[active];
      halo.position.set(sp.g.position.x, OV + regions[sp.region].g.position.y, sp.g.position.z);
      halo.scale.setScalar((active === selected ? 1.7 : 1) * (1 + (still ? 0 : Math.sin(t * 4) * 0.08)));
    }
    if (!still) { spinners.forEach(s => (s.rotation.y = t * 1.6)); glows.forEach(g => g.scale.setScalar(1 + Math.sin(t * 2.5) * 0.12)); }
    // meteo
    clouds.children.forEach(c => {
      c.position.addScaledVector(wind, dt);
      if (c.position.x > 10) c.position.x -= 20;
      if (c.position.z > 8.5) c.position.z -= 17;
    });
    const nRain = rainGeo.drawRange.count / 2;
    if (nRain > 0 && nRain < Infinity) {
      for (let k = 0; k < nRain; k++) {
        const d = drops[k];
        d[1] -= dt * 3.2; d[0] += wind.x * dt * 4; d[2] += wind.z * dt * 4;
        if (d[1] < 0) resetDrop(d, true);
        rainPos.set([d[0], d[1], d[2], d[0] - wind.x * 0.3, d[1] + 0.07, d[2] - wind.z * 0.3], k * 6);
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    if (weather.lightning && !still && Math.random() < dt * 0.15) flash = 1;
    flash = Math.max(0, flash - dt * 5);
    hemi.intensity += (weather.hemi * L.hemi + flash * 4 - hemi.intensity) * Math.min(1, dt * (flash ? 30 : 1.5));
    sun.intensity += (weather.sun * L.sun - sun.intensity) * Math.min(1, dt * 1.5);
    // etichette
    const { clientWidth: w, clientHeight: h } = container, dist = camera.position.distanceTo(controls.target);
    labels.forEach(({ el, p, region }, i) => {
      v.copy(p); v.y += regions[region]?.g.position.y || 0; v.project(camera);
      const ti = i - firstTown, isTown = ti >= 0;
      const show = v.z < 1 && (!isTown || dist < 7 || ti === hover || ti === active || ti === selected);
      el.style.display = show ? '' : 'none';
      if (show) el.style.transform = `translate(${(v.x + 1) / 2 * w}px, ${(1 - v.y) / 2 * h}px)`;
    });
    // render: scena -> maschera del Comune -> sfocatura -> composizione a schermo
    if (!q.blur) { renderer.setRenderTarget(null); renderer.render(scene, camera); return; } // qualità bassa: niente sfocatura
    renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
    renderer.setRenderTarget(rtMask); renderer.render(maskScene, camera);
    blur(rtScene, rtA, rtB, 2);
    blur(rtMask, rtA, rtM2, 1);
    pass(mixMat, null);
  });

  return {
    towns, regions: map.regions,
    update,
    select: i => { selected = i ?? null; },
    resetView: () => { goal.camera.copy(HOME.camera); goal.target.copy(HOME.target); homing = 1; },
    // porta in vista gli spot indicati (es. dove ci si può espandere), senza cambiare l'angolo della telecamera
    frame: ids => {
      if (!ids.length) return;
      const pts = ids.map(i => spots[i].g.position), c = new THREE.Vector3();
      pts.forEach(p => c.add(p)); c.divideScalar(pts.length);
      const spread = Math.max(1.2, ...pts.map(p => p.distanceTo(c)));
      const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
      goal.target.set(c.x, 0, c.z + 0.35); goal.camera.copy(goal.target).addScaledVector(dir, Math.min(13, Math.max(3.2, spread * 2.6)));
      homing = 1;
    },
    setClickable: (ids, cb) => { clickable = new Set(ids); onPick = cb || (() => {}); },
    setWeather, weather: () => weatherKey,
    setQuality: name => { qName = name; q = QUALITY[name === 'auto' ? (weakDevice() ? 'media' : 'alta') : name]; applyQuality(); },
    quality: () => ({ setting: qName, level: Object.keys(QUALITY).find(k => QUALITY[k] === q) }),
  };
}
