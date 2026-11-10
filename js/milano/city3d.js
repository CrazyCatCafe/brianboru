// Milano 3D: edifici reali (OSM), acqua, parchi, municipi di gioco; quartieri come cerchi, strade come trattini 3D.
// Effetti: municipio che si alza alla selezione, meteo che cambia, hinterland sfocato.
import * as THREE from 'three';
import { OrbitControls } from '../../vendor/three/OrbitControls.js';
import { THEME } from './theme.js';
import { logo } from './icons.js';
import { loadPawns, makePawn } from './pawns.js';

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
// È un muro continuo con le sue ombre, fermo a terra anche quando un'area si alza: niente linee doppie.
function sharedBorders(regionRings, width, height, y, color) {
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
  // muro continuo: un blocco per tratto più una colonnina per vertice, come un edificio lungo il confine
  const mat = new THREE.MeshLambertMaterial({ color }), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, segs.length);
  segs.forEach(([[x0, z0], [x1, z1]], i) => {
    const ax = X(x0), az = Z(z0), bx = X(x1), bz = Z(z1), l = Math.hypot(bx - ax, bz - az);
    q.setFromAxisAngle(up, -Math.atan2(bz - az, bx - ax));
    walls.setMatrixAt(i, m4.compose(new THREE.Vector3((ax + bx) / 2, y + height / 2, (az + bz) / 2), q, new THREE.Vector3(l, height, width)));
  });
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(width / 2, width / 2, height, 8), mat, pts.length);
  pts.forEach(([x, z], i) => posts.setMatrixAt(i, m4.makeTranslation(X(x), y + height / 2, Z(z))));
  const g = new THREE.Group(); g.add(walls, posts);
  g.traverse(o => { o.castShadow = o.receiveShadow = true; });
  return g;
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
// octs: ottagoni dei quartieri {x, z, a (apotema)}; ogni palazzo che ci cade dentro viene annotato in octs[i].blds per poterlo colorare
function buildingMeshes(buf, octs = []) {
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
      const k = dv.getUint16(off, true), h = Math.max(4, dv.getUint8(off + 2)) * HS, inside = dv.getUint8(off + 3) & 1;
      off += 4;
      const base = v, contour = [], c = inside ? cin : cout, shade = inside ? 1 - Math.min(0.06, h * 0.1) : 1;
      for (let j = 0; j < k; j++, off += 4) {
        const x = X(dv.getInt16(off, true) / 10), z = Z(dv.getInt16(off + 2, true) / 10);
        contour.push(new THREE.Vector2(x, z));
        for (const y of [0, h]) { pos.set([x, y, z], v * 3); col.set([c.r * 255 * shade, c.g * 255 * shade, c.b * 255], v * 3); v++; }
      }
      if (octs.length) { // il palazzo sta nell'ottagono di un quartiere?
        let cx = 0, cz = 0; contour.forEach(p => { cx += p.x; cz += p.y; }); cx /= k; cz /= k;
        const o = octs.find(o => { const dx = Math.abs(cx - o.x), dz = Math.abs(cz - o.z); return Math.max(dx, dz, (dx + dz) / Math.SQRT2) <= o.a; });
        if (o) o.blds.push([r, base, v]);
      }
      for (let j = 0; j < k; j++) { const a = base + 2 * j, b = base + 2 * ((j + 1) % k); idx.set([a, b, a + 1, a + 1, b, b + 1], t); t += 6; }
      for (const [p, q, s] of THREE.ShapeUtils.triangulateShape(contour, [])) { idx.set([base + 2 * p + 1, base + 2 * q + 1, base + 2 * s + 1], t); t += 3; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
    g.setIndex(new THREE.BufferAttribute(idx.subarray(0, t), 1));
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
    const m = new THREE.Mesh(g, mat);
    m.castShadow = m.receiveShadow = true;
    m.userData.orig = col.slice(); m.userData.origPos = pos.slice(0, v * 3); // colori e altezze originali (i palazzi sprofondano sotto le pedine)
    meshes[r] = m;
  }
  return meshes;
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
  // sinistro e destro: spostano · rotella: zoom (su touch: un dito sposta, due dita zoom)
  Object.assign(controls, { enableDamping: true, minDistance: 2.2, maxDistance: 18, maxPolarAngle: 1.25, screenSpacePanning: false,
    enableRotate: false, // la mappa non si ruota: il nord resta sempre in alto
    mouseButtons: { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN },
    touches: { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN } });
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
  // aree: confini come muro continuo antracite, l'area velata del suo colore
  scene.add(sharedBorders(Object.values(map.regions).map(r => rings(r.svg_path)), 0.016, 0.05, 0, '#3d434a'));
  // quartieri: ottagoni; i palazzi che ci cadono dentro prendono il colore del seme (libero) o della banda (preso)
  const OCT_R = 0.13, BRIGHT = { red: '#ff1f2d', blue: '#0a84ff', yellow: '#ffd400' };
  const octs = towns.map(t => ({ x: X(t.x), z: Z(t.y), a: OCT_R * Math.cos(Math.PI / 8), blds: [] }));
  const meshes = buildingMeshes(bin, octs);
  await loadPawns(base); // pedine 3D delle fazioni
  // altezza dei palazzi dentro l'ottagono del quartiere i: 1 normali, 0 rasi al suolo (piazza)
  const sink = (i, k) => {
    const touched = new Set();
    for (const [r, from, to] of octs[i].blds) {
      const a = meshes[r].geometry.attributes.position, o = meshes[r].userData.origPos;
      for (let v = from; v < to; v++) a.setY(v, Math.max(0.0005, o[v * 3 + 1] * k));
      touched.add(meshes[r].geometry);
    }
    touched.forEach(g => { g.attributes.position.needsUpdate = true; g.computeBoundingSphere(); });
  };
  scene.add(meshes[0]); const outsideBld = meshes[0];
  const regions = {};
  env.regionKeys.forEach((k, i) => {
    const r = map.regions[k], g = new THREE.Group(), color = new THREE.Color(T.region[k]);
    const tint = flat(rings(r.svg_path), color, 0.002, { transparent: true, opacity: 0, depthWrite: false });
    // confini solo neri (il muro); l'ombra scurisce le zone lontane da quella su cui si sta giocando
    const shade = flat(rings(r.svg_path), '#05070a', 0.0025, { transparent: true, opacity: 0, depthWrite: false });
    const bld = meshes[i + 1], pieces = new THREE.Group();
    g.add(tint, shade, pieces);
    if (bld) g.add(bld);
    scene.add(g);
    regions[k] = { g, tint, shade, bld, pieces, color, owner: null, lift: 0, dim: 0 };
  });

  // quartieri: cerchi del colore del seme
  const disc = (r0, r1, color, y, order, opts = {}) => {
    const m = over(new THREE.Mesh(r0 ? new THREE.RingGeometry(r0, r1, 48) : new THREE.CircleGeometry(r1, 48), new THREE.MeshBasicMaterial({ color, ...opts })), order);
    m.rotation.x = -Math.PI / 2; m.position.y = y; return m;
  };
  const poly = (r, n, color, y, order, r0 = 0) => {
    const m = over(new THREE.Mesh(r0 ? new THREE.RingGeometry(r0, r, n, 1, Math.PI / 2) : new THREE.CircleGeometry(r, n, Math.PI / 2), new THREE.MeshBasicMaterial({ color })), order);
    m.rotation.x = -Math.PI / 2; m.position.y = y; return m;
  };
  const spots = towns.map((t, i) => {
    const g = new THREE.Group(); g.position.set(X(t.x), 0, Z(t.y));
    // ottagono a terra del colore del seme, i palazzi sopra li colora paint()
    // libero: solo il contorno dell'ottagono nel colore del seme; preso: ottagono e palazzi pieni del colore della banda
    const fill = new THREE.Mesh(new THREE.CircleGeometry(OCT_R, 8, Math.PI / 8), new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true }));
    fill.rotation.x = -Math.PI / 2; fill.position.y = 0.006; fill.receiveShadow = true; fill.renderOrder = 1; fill.visible = false;
    const thin = poly(OCT_R + 0.012, 8, BRIGHT[t.suit], OV, 2, OCT_R - 0.012), thick = poly(OCT_R + 0.02, 8, '#ffffff', OV, 2, OCT_R - 0.004);
    thin.rotation.z = thick.rotation.z = Math.PI / 8 - Math.PI / 2; thick.visible = false;
    g.add(thin, thick);
    const option = disc(OCT_R + 0.015, OCT_R + 0.04, T.project, OV, 3.3); option.visible = false;
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(OCT_R, OCT_R, 0.4, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.2; hit.userData.town = i;
    g.add(fill, option, hit); regions[t.region].g.add(g);
    return { g, hit, fill, option, region: t.region, suit: t.suit, thin, thick, color: null };
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
  // fuochi d'artificio sui quartieri dove ci si può espandere: un razzo sale, esplode in scintille colorate che ricadono
  let fwTowns = [];
  const FW_MAX = 16, FW_N = 28, fwPos = new Float32Array(FW_MAX * (FW_N + 1) * 3), fwCol = new Float32Array(FW_MAX * (FW_N + 1) * 3);
  const fwGeo = new THREE.BufferGeometry(); fwGeo.setAttribute('position', new THREE.BufferAttribute(fwPos, 3)); fwGeo.setAttribute('color', new THREE.BufferAttribute(fwCol, 3));
  const fw = new THREE.Points(fwGeo, new THREE.PointsMaterial({ size: 9, sizeAttenuation: false, vertexColors: true, depthTest: false }));
  fw.renderOrder = 9; fw.frustumCulled = false; scene.add(fw);
  const FW_COLORS = ['#ffd400', '#ff2d87', '#00e5ff', '#7cff4f', '#ffffff'].map(c => new THREE.Color(c));
  const fwDirs = Array.from({ length: FW_N }, (_, k) => { const a = k / FW_N * Math.PI * 2, e = 0.4 + (k % 3) * 0.3; return [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)]; });
  function tickFireworks(t) {
    const list = fwTowns.slice(0, FW_MAX);
    fwGeo.setDrawRange(0, list.length * (FW_N + 1));
    list.forEach((id, j) => {
      const sp = spots[id], base = j * (FW_N + 1), ph = (j * 0.37) % 1, cyc = 1.8, u = ((t / cyc + ph) % 1) * cyc;
      const x = sp.g.position.x, z = sp.g.position.z, y0 = OV + regions[sp.region].g.position.y, top = 0.55, col = FW_COLORS[j % FW_COLORS.length];
      const set = (k, px, py, pz, c, a) => { fwPos.set([px, py, pz], (base + k) * 3); fwCol.set([c.r, c.g, c.b], (base + k) * 3); if (a <= 0.05) fwPos[(base + k) * 3 + 1] = -10; };
      if (u < 0.5) { // razzo che sale
        set(0, x, y0 + top * (u / 0.5), z, FW_COLORS[4], 1);
        for (let k = 1; k <= FW_N; k++) set(k, x, -10, z, col, 0);
      } else { // esplosione
        const b = u - 0.5, a = Math.max(0, 1 - b / 1.3), r = 0.26 * (1 - Math.exp(-b * 4));
        set(0, x, -10, z, col, 0);
        fwDirs.forEach((d, k) => set(k + 1, x + d[0] * r, y0 + top + d[1] * r - 0.12 * b * b, z + d[2] * r, k % 4 ? col : FW_COLORS[4], a));
      }
    });
    fwGeo.attributes.position.needsUpdate = fwGeo.attributes.color.needsUpdate = true;
  }
  const halo = disc(0.15, 0.18, T.accent, OV, 7);
  scene.add(halo);
  // sul quartiere in palio: fari da prima cinematografica che si muovono e sparano un raggio di luce nel cielo
  const beams = new THREE.Group(), beamGeo = new THREE.CylinderGeometry(0.035, 0.004, 1.6, 16, 1, true).translate(0, 0.8, 0);
  const beamMat = new THREE.MeshBasicMaterial({ color: '#fff6d8', transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const lampMat = new THREE.MeshLambertMaterial({ color: '#1b1f24' }), lensMat = new THREE.MeshBasicMaterial({ color: '#fffbe8' });
  const lights = [0, 1, 2].map(k => {
    const base = new THREE.Group(), a = k / 3 * Math.PI * 2 + 0.4;
    base.position.set(Math.cos(a) * 0.075, 0, Math.sin(a) * 0.075);
    const head = new THREE.Group(); head.position.y = 0.025; base.add(head);
    head.add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.03, 10), lampMat));
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.014, 10), lensMat); lens.rotation.x = -Math.PI / 2; lens.position.y = 0.016; head.add(lens);
    head.add(new THREE.Mesh(beamGeo, beamMat));
    beams.add(base); return { head, a, k };
  });
  scene.add(beams);

  // --- pedine ---
  const mats = {};
  const mat = (c, o = {}) => (mats[c + JSON.stringify(o)] ??= new THREE.MeshLambertMaterial({ color: c, ...o }));
  // scudo della polizia: sagoma estrusa blu con la stella bianca davanti (coordinate dell'icona 40x40, y in su)
  const shieldShape = new THREE.Shape(); { const P = [[20, 3], [34, 8], [34, 19], [30, 31], [20, 38], [10, 31], [6, 19], [6, 8]]; P.forEach(([x, y], i) => (i ? shieldShape.lineTo : shieldShape.moveTo).call(shieldShape, x - 20, 20 - y)); }
  const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, { depth: 4, bevelEnabled: false }).translate(0, 0, -2);
  const starShape = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 - Math.PI / 2, r = k % 2 ? 3 : 7; (k ? starShape.lineTo : starShape.moveTo).call(starShape, Math.cos(a) * r, -Math.sin(a) * r + 1); }
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 5, bevelEnabled: false }).translate(0, 0, -2.5);
  const shieldMat = new THREE.MeshLambertMaterial({ color: '#1f5fbf', emissive: '#0b2a60' }), starMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const droneProto = new THREE.Group(); // drone piccolo: corpo, 4 rotori, luce
  droneProto.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.03), mat('#1b2330')));
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.003, 12), mat('#7b8794'));
    r.position.set(x * 0.022, 0.008, z * 0.022); droneProto.add(r);
  }
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: T.accent }));
  led.position.y = -0.008; droneProto.add(led);
  const spinners = [], glows = [], dancers = [], cones = [];
  const barGeo = { block: new THREE.BoxGeometry(0.075, 0.035, 0.02), foot: new THREE.BoxGeometry(0.075, 0.008, 0.035) }; // barricate dei presidi: geometrie condivise, non si ricreano a ogni aggiornamento
  const raveGeo = { box: new THREE.BoxGeometry(0.05, 0.04, 0.04), cone: new THREE.CircleGeometry(0.013, 10), body: new THREE.BoxGeometry(0.016, 0.03, 0.012), head: new THREE.BoxGeometry(0.013, 0.013, 0.013) };
  const raveMat = { cone: new THREE.MeshBasicMaterial({ color: '#ff2d87' }) };
  const RAVE_COLORS = ['#ff2d87', '#00e5ff', '#ffd400', '#7cff4f', '#a34dff'];
  let selected = null, active = null, lit = null, pickRegions = new Set(); // lit: zona illuminata a richiesta (carta Hype); pickRegions: zone dove si può scegliere sulla mappa

  function update(s) {
    for (const r of Object.values(regions)) r.pieces.clear();
    spinners.length = glows.length = dancers.length = cones.length = 0;
    s.towns.forEach((st, i) => {
      const sp = spots[i], c = st.owner === null ? null : T.players[st.owner]; // libero: palazzi normali; preso: colore della banda
      if (sp.color !== c) { sp.color = c; if (c) { sp.fill.material.color.set('#2b3036'); sp.thick.material.color.set(c); } } // preso: piazza scura col bordino del giocatore
      sp.sinkTo = c ? 0 : 1; // i palazzi del quartiere preso sprofondano, quelli dei quartieri liberi restano
      sp.thin.visible = !c; sp.thick.visible = sp.fill.visible = false; // preso: resta solo la pedina, niente piazza né bordino
      // pedina della fazione al centro del quartiere preso; quando arriva cade dall'alto e rimbalza
      const fac = st.owner === null ? null : s.factions?.[st.owner], key = st.owner === null ? null : `${st.owner}:${fac}`;
      if (sp.pawnKey !== key) {
        if (sp.pawn) sp.g.remove(sp.pawn);
        sp.pawn = key && makePawn(fac, T.players[st.owner]); sp.pawnKey = key;
        if (sp.pawn) { sp.pawn.scale.setScalar(0.36); sp.pawn.position.y = OV; sp.pawn.userData.born = sp.pawnKey && sp.seen ? performance.now() / 1000 : -9; sp.g.add(sp.pawn); }
      }
      sp.seen = true;
      if (st.owner === null) return;
      const p = spots[i].g.position, parent = regions[spots[i].region].pieces;
      const put = (m, y = OV, order = 5) => { over(m, order); m.position.x += p.x; m.position.y += y; m.position.z += p.z; parent.add(m); return m; };
      if (st.monastery) { // community project: rave in strada, due muri di casse e gente che balla
        const rave = new THREE.Group();
        for (const side of [-1, 1]) { // casse: tre cubi impilati con il cono acceso
          for (let k = 0; k < 2; k++) {
            const box = new THREE.Mesh(raveGeo.box, mat('#16191d')); box.position.set(side * 0.14, 0.02 + k * 0.04, -0.06); rave.add(box);
            const cone = new THREE.Mesh(raveGeo.cone, raveMat.cone); cone.rotation.x = Math.PI / 2; cone.position.set(side * 0.14, 0.02 + k * 0.04, -0.039); rave.add(cone);
            cones.push(cone);
          }
        }
        for (let k = 0; k < 6; k++) { // ballerini: corpo e testa, ognuno con il suo tempo
          const d = new THREE.Group(), a = k / 6 * Math.PI * 2;
          const body = new THREE.Mesh(raveGeo.body, mat(RAVE_COLORS[k % RAVE_COLORS.length])); body.position.y = 0.022;
          const head = new THREE.Mesh(raveGeo.head, mat('#e8d6c4')); head.position.y = 0.05;
          d.add(body, head); d.position.set(Math.cos(a) * 0.075, 0, 0.03 + Math.sin(a) * 0.05); d.userData.ph = k * 1.3;
          rave.add(d); dancers.push(d);
        }
        put(rave, OV, 6);
      }
      if (st.viking) { // presidio di polizia: barricata, droni che girano, stemma
        for (let k = 0; k < 6; k++) {
          const a = k / 6 * Math.PI * 2, b = new THREE.Group();
          const block = new THREE.Mesh(barGeo.block, mat(k % 2 ? '#ffffff' : T.accent));
          const foot = new THREE.Mesh(barGeo.foot, mat('#2b3a4f')); foot.position.y = -0.02;
          b.add(block, foot); b.position.set(Math.cos(a) * 0.17, 0.03, Math.sin(a) * 0.17); b.rotation.y = -a + Math.PI / 2;
          put(b, OV, 6);
        }
        const orbit = new THREE.Group();
        for (let k = 0; k < 3; k++) { const d = droneProto.clone(); d.position.set(Math.cos(k * 2.09) * 0.24, (k % 2) * 0.03, Math.sin(k * 2.09) * 0.24); orbit.add(d); }
        spinners.push(put(orbit, OV + 0.14, 7));
        // scudo della polizia 3D che gira sopra il quartiere presidiato
        const shield = new THREE.Group(); shield.add(new THREE.Mesh(shieldGeo, shieldMat), new THREE.Mesh(starGeo, starMat));
        shield.scale.setScalar(0.009); shield.renderOrder = 8; put(shield, OV + 0.34, 8); spinners.push(shield);
      }
    });
    active = s.activeTown ?? null;
    for (const [k, r] of Object.entries(regions)) { // quartieri occupati verso la soglia (progetto urbano = 2, polizia compresa)
      const n = towns.reduce((a, t, i) => a + (t.region === k && s.towns[i].owner !== null ? (s.towns[i].monastery ? 2 : 1) : 0), 0);
      const c = r.title?.querySelector('.cnt'); if (c) { c.textContent = n; c.parentElement.classList.toggle('reached', n >= map.regions[k].threshold); }
    }
    for (const [k, r] of Object.entries(regions)) { // municipio controllato (zona assegnata): diventa del colore della banda
      const o = s.claims?.[k]?.owner ?? null;
      r.owner = o === null ? null : new THREE.Color(T.players[o]);
      r.tint.material.color.copy(r.owner || r.color);
      // municipio che va in palio: il cartello si gira; cambio di proprietario: il cartello lampeggia
      const up = !!s.claims?.[k]?.up, ow = s.claims?.[k]?.owner ?? null;
      if (r.title && r.seenClaim && (up !== r.wasUp || ow !== r.wasOwner)) { const cls = up !== r.wasUp ? 'flipin' : 'ownin'; r.title.classList.remove('flipin', 'ownin'); void r.title.offsetWidth; r.title.classList.add(cls); }
      r.wasUp = up; r.wasOwner = ow; r.seenClaim = true;
      // cartello: zona controllata → quadratino e nome della banda al posto di triangolino e nome della zona
      const b = r.title?.querySelector('b'), who = o === null ? null : (s.names?.[o] || `Banda ${o + 1}`);
      if (b && b.dataset.who !== String(who)) {
        b.dataset.who = String(who); b.classList.toggle('owned', o !== null);
        b.style.setProperty('--rc', o === null ? T.region[k] : T.players[o]);
        b.querySelector('.nm').textContent = who ?? map.regions[k].name;
      }
    }
  }

  // --- etichette HTML proiettate ---
  const labels = [];
  const addLabel = (html, cls, x, y, h, region) => {
    const el = document.createElement('div'); el.className = cls; el.innerHTML = html; overlay.appendChild(el);
    labels.push({ el, p: new THREE.Vector3(X(x), h, Z(y)), region }); return el;
  };
  for (const [k, r] of Object.entries(map.regions)) {
    const [lx, ly] = r.label.tx ? [r.label.tx, r.label.ty] : [r.label.x, r.label.y];
    regions[k].title = addLabel(`<b style="--rc:${T.region[k]}" title="${r.name}"><i class="tri" aria-hidden="true"><i></i><i></i><i></i><i></i></i><span class="nm">${r.name}</span></b><i title="Quartieri occupati su quelli che servono per l'Uprising"><span class="frac"><span class="cnt">0</span>/${r.threshold}</span>${logo('uprising', 13)}</i><i title="Punti per chi controlla la zona">${r.points}${logo('punti', 13)}</i>`, 'rlabel', lx, ly, 0.02, k);
    regions[k].title.dataset.region = k;
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
    for (let c = 0; c < weather.clouds; c++) {
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
    sun.castShadow = q.shadow > 0;
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
    if (!container.clientWidth || !container.clientHeight) return; // mappa nascosta (menu): niente disegno
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
    // municipio del quartiere selezionato: si alza e si colora
    const selRegion = selected !== null ? spots[selected].region : null, actRegion = active !== null ? spots[active].region : null; // anche la zona del quartiere in palio, per tutti
    for (const [k, r] of Object.entries(regions)) {
      const on = k === selRegion || k === actRegion || k === lit || pickRegions.has(k), focus = selRegion !== null || actRegion !== null || lit !== null || pickRegions.size > 0;
      r.lift += ((on ? 1 : 0) - r.lift) * Math.min(1, dt * 6);
      r.dim += ((focus && !on ? 1 : 0) - r.dim) * Math.min(1, dt * 4); // le altre zone si spengono, quella in gioco risalta
      r.g.position.y = r.lift * LIFT;
      r.tint.material.opacity = (r.owner ? 0.4 : 0) + r.lift * 0.35;
      r.shade.material.opacity = r.dim * 0.4;
      if (r.bld) r.bld.material.color.copy(white).lerp(r.owner || r.color, (r.owner ? 0.4 : 0) + r.lift * 0.35).multiplyScalar(1 - r.dim * 0.45); // controllato: palazzi del colore della banda
    }
    if (outsideBld) { const d = Object.values(regions).reduce((m, r) => Math.max(m, r.dim), 0); outsideBld.material.color.setScalar(1 - d * 0.45); }
    spots.forEach((sp, i) => { // palazzi che sprofondano (o rispuntano) insieme alla pedina
      if (sp.sinkTo === undefined) return;
      const k = sp.sinkK ?? 1, goal = sp.sinkTo, nk = still || !sp.seenSink ? goal : k + Math.sign(goal - k) * Math.min(Math.abs(goal - k), dt * 2.2);
      if (nk !== k || sp.sinkK === undefined) { sp.sinkK = nk; sink(i, nk); }
      sp.seenSink = true;
    });
    spots.forEach(sp => { // pedina appena arrivata: cade e rimbalza (0,6 s)
      if (!sp.pawn) return;
      const a = still ? 1 : Math.min(1, (time / 1000 - sp.pawn.userData.born) / 0.6);
      sp.pawn.position.y = OV + (a < 0.6 ? (1 - a / 0.6) ** 2 * 0.6 : Math.sin((a - 0.6) / 0.4 * Math.PI) * 0.04);
    });
    spots.forEach((sp, i) => {
      const on = i === selected;
      sp.g.scale.setScalar(on ? 1.7 : i === hover && clickable.has(i) ? 1.25 : 1);
      sp.fill.material.opacity = on && !still ? 0.7 + Math.sin(t * 4) * 0.3 : 1; // pulsazione lenta, non lampeggio
      sp.option.visible = clickable.has(i) && !on;
      if (sp.option.visible) sp.option.material.opacity = 0.55 + (still ? 0.3 : Math.sin(t * 5) * 0.35);
    });
    halo.visible = false; beams.visible = active !== null; // quartiere in palio: bastano i fari nel cielo, niente cerchio rosso
    if (active !== null) {
      const sp = spots[active];
      halo.position.set(sp.g.position.x, OV + regions[sp.region].g.position.y, sp.g.position.z);
      beams.position.set(sp.g.position.x, regions[sp.region].g.position.y + OV, sp.g.position.z);
      lights.forEach(({ head, a, k }) => { // ognuno oscilla per conto suo, inclinato verso l'esterno
        const w = still ? 0 : t * (0.7 + k * 0.17) + k * 2.1;
        head.rotation.set(0.35 + Math.sin(w) * 0.25, 0, 0); head.parent.rotation.y = -a + Math.PI / 2 + (still ? 0 : Math.sin(w * 0.8) * 0.6);
      });
      halo.scale.setScalar((active === selected ? 1.7 : 1) * (1 + (still ? 0 : Math.sin(t * 4) * 0.08)));
    }
    if (!still) {
      spinners.forEach(s => (s.rotation.y = t * 1.6)); glows.forEach(g => g.scale.setScalar(1 + Math.sin(t * 2.5) * 0.12));
      const beat = Math.max(0, Math.sin(t * Math.PI * 4)) ** 3; // cassa dritta a 120 bpm
      cones.forEach(c => c.scale.setScalar(1 + beat * 0.4));
      tickFireworks(t);
      dancers.forEach(d => { const ph = d.userData.ph; d.position.y = Math.abs(Math.sin(t * Math.PI * 2 + ph)) * 0.012; d.rotation.y = Math.sin(t * 1.7 + ph) * 0.8; });
    }
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
      v.copy(p); if (i >= firstTown) v.y += regions[region]?.g.position.y || 0; v.project(camera); // i cartelli dei municipi restano fermi, anche se la zona si alza
      const ti = i - firstTown, isTown = ti >= 0;
      const show = v.z < 1 && (!isTown || dist < 7 || ti === hover || ti === active || ti === selected);
      el.style.display = show ? '' : 'none';
      if (!isTown && regions[region]) el.classList.toggle('focus', regions[region].lift > 0.5); // zona in gioco: cartello più grande, triangolo che ruota
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
    highlight: k => { lit = k ?? null; },
    // "portami lì": centra la mappa sul quartiere e avvicina del 30% (stesso angolo)
    focusTown: i => {
      const p = spots[i].g.position, off = new THREE.Vector3().subVectors(camera.position, controls.target).multiplyScalar(0.7);
      goal.target.set(p.x, 0, p.z); goal.camera.copy(goal.target).add(off); homing = 1;
    },
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
    setClickable: (ids, cb) => { clickable = new Set(ids); onPick = cb || (() => {}); pickRegions = new Set(ids.length && ids.length < spots.length / 2 ? ids.map(i => spots[i].region) : []); }, // scelte sulla mappa: si illuminano le loro zone
    setFireworks: ids => { fwTowns = ids || []; },
    setWeather, weather: () => weatherKey,
    // pixel art accesa/spenta: solo la mappa, l'interfaccia resta nitida
    setPixel: px => { view.pixel = px || 0; renderer.domElement.style.imageRendering = px ? 'pixelated' : ''; resize(); },
    setQuality: name => { qName = name; q = QUALITY[name === 'auto' ? (weakDevice() ? 'media' : 'alta') : name]; applyQuality(); },
    quality: () => ({ setting: qName, level: Object.keys(QUALITY).find(k => QUALITY[k] === q) }),
  };
}
