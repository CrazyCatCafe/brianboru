// Milano 3D: edifici reali (OSM), acqua, parchi, municipi di gioco; quartieri come cerchi, strade come trattini 3D.
// Effetti: municipio che si alza alla selezione, meteo che cambia, hinterland sfocato.
import * as THREE from 'three';
import { OrbitControls } from '../../vendor/three/OrbitControls.js';
import { THEME } from './theme.js';

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
// in sovrimpressione: sempre visibili sopra gli edifici (vale anche per i figli di un gruppo)
const over = (m, order) => {
  m.traverse(c => {
    c.renderOrder = order;
    if (c.material) Object.assign(c.material, { depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide });
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
  const cin = new THREE.Color(THEME.building.city), cout = new THREE.Color(THEME.building.outside), meshes = {};
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
      for (let j = 0; j < k; j++) { const a = base + 2 * j, b = base + 2 * ((j + 1) % k); idx.set([a, b, a + 1, a + 1, b, b + 1], t); t += 6; }
      for (const [p, q, s] of THREE.ShapeUtils.triangulateShape(contour, [])) { idx.set([base + 2 * p + 1, base + 2 * q + 1, base + 2 * s + 1], t); t += 3; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
    g.setIndex(new THREE.BufferAttribute(idx.subarray(0, t), 1));
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }));
    m.castShadow = m.receiveShadow = true;
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
  g.fillStyle = THEME.accent; g.fillRect(36, 68, 26, 5); g.fillStyle = THEME.suit.blue.fill; g.fillRect(66, 68, 26, 5);
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
  const base = new URL('../../assets/milano/', import.meta.url);
  const [map, env, bin] = await Promise.all([
    fetch(new URL('mappa.json', base)).then(r => r.json()),
    fetch(new URL('env.json', base)).then(r => r.json()),
    fetch(new URL('buildings.bin', base)).then(r => r.arrayBuffer()),
  ]);
  const towns = map.towns, townIndex = Object.fromEntries(towns.map((t, i) => [t.id, i]));

  const low = /[?&]q=low/.test(location.search) || matchMedia('(pointer: coarse)').matches; // telefoni e GPU deboli
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.5 : 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(THEME.sky[1]);
  scene.fog = new THREE.Fog(THEME.sky[1], 16, 34);
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
  const keys = new Set(), MOVE = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  addEventListener('keydown', e => { if (MOVE[e.code] && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { keys.add(e.code); e.preventDefault(); } });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  const hemi = new THREE.HemisphereLight('#ffffff', '#aab7c2', 2.1);
  const sun = new THREE.DirectionalLight('#fffaf0', 2.6);
  sun.position.set(-5, 9, 4); sun.castShadow = true;
  sun.shadow.mapSize.setScalar(low ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -7.5, right: 7.5, top: 7.5, bottom: -7.5, near: 1, far: 30 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.01;
  scene.add(hemi, sun);

  // suolo: hinterland grigio-verde con campi, Comune chiaro, parchi, acqua
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: THEME.ground.outside }));
  outer.rotation.x = -Math.PI / 2; outer.receiveShadow = true; scene.add(outer);
  scene.add(flat(env.rural, THEME.rural, 0.0005));
  const cityShape = rings(map.city_outline_path);
  scene.add(flat(cityShape, THEME.ground.city, 0.001));
  scene.add(flat(env.parks, THEME.park, 0.003));
  const waterMat = new THREE.MeshLambertMaterial({ color: THEME.water, emissive: THEME.water, emissiveIntensity: 0.25 });
  const water = new THREE.Mesh(flatGeometry(env.water), waterMat); water.position.y = 0.005; scene.add(water);
  for (const [name, lines] of Object.entries(env.rivers))
    for (const l of lines) scene.add(new THREE.Mesh(ribbon(l, name.startsWith('Lambro') ? 0.016 : 0.012, 0.006), waterMat));

  // municipi: ognuno è un gruppo (tinta, bordo, edifici, quartieri, pedine) che si può alzare
  const meshes = buildingMeshes(bin);
  scene.add(meshes[0]);
  const regions = {};
  env.regionKeys.forEach((k, i) => {
    const r = map.regions[k], g = new THREE.Group(), color = new THREE.Color(THEME.region[k]);
    const tint = flat(rings(r.svg_path), color, 0.002, { transparent: true, opacity: 0.16, depthWrite: false });
    const borders = rings(r.svg_path).map(ring => over(new THREE.Mesh(ribbon([...ring, ring[0]], 0.014, OV), new THREE.MeshBasicMaterial({ color, opacity: 0.9 })), 1));
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
  const spots = towns.map((t, i) => {
    const g = new THREE.Group(); g.position.set(X(t.x), 0, Z(t.y));
    const fill = disc(0, 0.078, THEME.suit[t.suit].fill, OV, 3.2);
    const option = disc(0.125, 0.15, THEME.project, OV, 3.3); option.visible = false; // anello delle scelte possibili
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.4, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.2; hit.userData.town = i;
    g.add(disc(0, 0.108, THEME.ink, OV, 3), disc(0, 0.094, '#ffffff', OV, 3.1), fill, option, hit);
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
  const halo = disc(0.15, 0.18, THEME.accent, OV, 7);
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
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: THEME.accent }));
  led.position.y = -0.008; droneProto.add(led);
  const spinners = [], glows = [];
  let selected = null, active = null;

  function update(s) {
    for (const r of Object.values(regions)) r.pieces.clear();
    spinners.length = glows.length = 0;
    s.towns.forEach((st, i) => {
      if (st.owner === null) return;
      const p = spots[i].g.position, parent = regions[spots[i].region].pieces;
      const put = (m, y = OV, order = 5) => { over(m, order); m.position.x += p.x; m.position.y += y; m.position.z += p.z; parent.add(m); return m; };
      // gettone 3D della banda: copre tutto lo spot
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.05, 48), mat(THEME.players[st.owner])), OV + 0.025);
      put(new THREE.Mesh(new THREE.TorusGeometry(0.104, 0.01, 8, 48), mat('#ffffff')), OV + 0.05).rotation.x = Math.PI / 2;
      if (st.monastery) { // progetto urbano: anello fluorescente
        put(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.016, 10, 64), new THREE.MeshBasicMaterial({ color: THEME.project })), OV + 0.02, 4).rotation.x = Math.PI / 2;
        const g = put(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 10, 64), new THREE.MeshBasicMaterial({ color: THEME.project, opacity: 0.35, blending: THREE.AdditiveBlending })), OV + 0.02, 3);
        g.rotation.x = Math.PI / 2; glows.push(g);
      }
      if (st.viking) { // presidio di polizia: barricata, droni che girano, stemma
        for (let k = 0; k < 6; k++) {
          const a = k / 6 * Math.PI * 2, b = new THREE.Group();
          const block = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 0.02), mat(k % 2 ? '#ffffff' : THEME.accent));
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
    addLabel(`<b style="--rc:${THEME.region[k]}">${r.name}</b><span>${r.municipio}</span><i>${r.threshold}<em>soglia</em></i><i>${r.points}<em>punti</em></i>`, 'rlabel', lx, ly, 0.02, k);
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
    rainGeo.setDrawRange(0, Math.min(MAXRAIN, low ? weather.rain / 2 : weather.rain) * 2);
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
    renderer.setSize(w, h); camera.aspect = w / h; camera.fov = w < h ? 64 : 36; camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio(), fw = Math.round(w * pr), fh = Math.round(h * pr);
    half.set(Math.max(1, fw >> 1), Math.max(1, fh >> 1));
    rtScene.setSize(fw, fh); [rtA, rtB, rtMask, rtM2].forEach(t => t.setSize(half.x, half.y));
  };
  new ResizeObserver(resize).observe(container); resize();

  // --- ciclo ---
  const v = new THREE.Vector3(), white = new THREE.Color('#ffffff'), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let last = 0;
  renderer.setAnimationLoop(time => {
    const t = time / 1000, dt = Math.min(0.05, t - last || 0); last = t;
    // tastiera: WASD e frecce spostano la vista sul piano della mappa
    if (keys.size) {
      const fwd = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0).normalize(), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const step = new THREE.Vector3(), speed = dt * camera.position.distanceTo(controls.target) * 0.6;
      keys.forEach(k => step.addScaledVector(right, MOVE[k][0]).addScaledVector(fwd, MOVE[k][1]));
      if (step.lengthSq()) { step.normalize().multiplyScalar(speed); camera.position.add(step); controls.target.add(step); }
    }
    if (homing > 0) { // bussola: torna alla vista iniziale con il nord in alto
      homing = Math.max(0, homing - dt * 2.5); const k = 1 - homing;
      camera.position.lerp(HOME.camera, k * 0.25 + 0.05); controls.target.lerp(HOME.target, k * 0.25 + 0.05);
      if (!homing) { camera.position.copy(HOME.camera); controls.target.copy(HOME.target); }
    }
    controls.update();
    if (view.compass) view.compass.style.setProperty('--az', `${controls.getAzimuthalAngle()}rad`);
    // municipio del quartiere selezionato: si alza e si colora
    const selRegion = selected !== null ? spots[selected].region : null;
    for (const [k, r] of Object.entries(regions)) {
      r.lift += ((k === selRegion ? 1 : 0) - r.lift) * Math.min(1, dt * 6);
      r.g.position.y = r.lift * LIFT;
      r.tint.material.opacity = 0.16 + r.lift * 0.3;
      r.glow.forEach(g => (g.material.opacity = r.lift * (0.45 + (still ? 0 : Math.sin(t * 3) * 0.15))));
      if (r.bld) r.bld.material.color.copy(white).lerp(r.color, r.lift * 0.4);
    }
    spots.forEach((sp, i) => {
      const on = i === selected;
      sp.g.scale.setScalar(on ? 1.7 : i === hover && clickable.has(i) ? 1.25 : 1);
      sp.fill.material.opacity = on && !still ? (Math.sin(t * 9) > 0 ? 1 : 0.25) : 1;
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
    hemi.intensity += (weather.hemi + flash * 4 - hemi.intensity) * Math.min(1, dt * (flash ? 30 : 1.5));
    sun.intensity += (weather.sun - sun.intensity) * Math.min(1, dt * 1.5);
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
    resetView: () => { homing = 1; },
    setClickable: (ids, cb) => { clickable = new Set(ids); onPick = cb || (() => {}); },
    setWeather, weather: () => weatherKey,
  };
}
