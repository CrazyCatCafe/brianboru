// Milano 3D: edifici reali (OSM), acqua, parchi, regioni di gioco; città come torri, strade come cavi.
import * as THREE from 'three';
import { OrbitControls } from '../../vendor/three/OrbitControls.js';
import { THEME } from './theme.js';

const W = 1100, H = 1023;
const X = x => (x - W / 2) / 100, Z = y => (y - H / 2) / 100;
const HS = (1 / 18.2) * 4 / 100; // metri -> unità scena (1 unità canvas ≈ 18,2 m), altezze ×4
const PED = 0.2;                 // altezza delle torri-città

const rings = d => d.split(/(?=M)/).map(s => [...s.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m => [+m[1], +m[2]])).filter(r => r.length > 2);

function flatGeometry(polys) { // poligoni canvas -> un'unica geometria sul piano XZ
  const shapes = polys.map(r => new THREE.Shape(r.map(([x, y]) => new THREE.Vector2(X(x), -Z(y)))));
  const g = new THREE.ShapeGeometry(shapes);
  g.rotateX(-Math.PI / 2);
  return g;
}
const flat = (polys, color, y, opts = {}) => {
  const m = new THREE.Mesh(flatGeometry(polys), new THREE.MeshLambertMaterial({ color, ...opts }));
  m.position.y = y; m.receiveShadow = true; return m;
};

function buildingsMesh(buf) {
  const dv = new DataView(buf), n = dv.getUint32(0, true);
  let o = 4, nv = 0, ni = 0;
  for (let i = 0; i < n; i++) { const k = dv.getUint16(o, true); nv += 2 * k; ni += 6 * k + 3 * (k - 2); o += 4 + 4 * k; }
  const pos = new Float32Array(nv * 3), col = new Uint8Array(nv * 3), idx = new Uint32Array(ni);
  const cin = new THREE.Color(THEME.building.city), cout = new THREE.Color(THEME.building.outside);
  o = 4; let v = 0, t = 0;
  for (let i = 0; i < n; i++) {
    const k = dv.getUint16(o, true), h = Math.max(4, dv.getUint8(o + 2)) * HS, inside = dv.getUint8(o + 3) & 1;
    o += 4;
    const base = v, contour = [];
    const c = inside ? cin : cout, shade = inside ? 1 - Math.min(0.06, h * 0.1) : 1; // grattacieli appena più freddi
    for (let j = 0; j < k; j++, o += 4) {
      const x = X(dv.getInt16(o, true) / 10), z = Z(dv.getInt16(o + 2, true) / 10);
      contour.push(new THREE.Vector2(x, z));
      for (const y of [0, h]) {
        pos.set([x, y, z], v * 3);
        col.set([c.r * 255 * shade, c.g * 255 * shade, c.b * 255], v * 3);
        v++;
      }
    }
    for (let j = 0; j < k; j++) {
      const a = base + 2 * j, b = base + 2 * ((j + 1) % k);
      idx.set([a, b, a + 1, a + 1, b, b + 1], t); t += 6;
    }
    for (const [p, q, r] of THREE.ShapeUtils.triangulateShape(contour, [])) { idx.set([base + 2 * p + 1, base + 2 * q + 1, base + 2 * r + 1], t); t += 3; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
  g.setIndex(new THREE.BufferAttribute(idx.subarray(0, t), 1));
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

function ribbon(pts, width, y) { // fiume/naviglio come nastro piatto
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

export async function createCity(container, overlay, view = {}) {
  const base = new URL('../../assets/milano/', import.meta.url);
  const [map, env, bin] = await Promise.all([
    fetch(new URL('mappa.json', base)).then(r => r.json()),
    fetch(new URL('env.json', base)).then(r => r.json()),
    fetch(new URL('buildings.bin', base)).then(r => r.arrayBuffer()),
  ]);
  const towns = map.towns, townIndex = Object.fromEntries(towns.map((t, i) => [t.id, i]));

  const low = /[?&]q=low/.test(location.search) || matchMedia('(pointer: coarse)').matches; // telefoni e GPU deboli
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.5 : 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(THEME.sky[1], 16, 34);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 80);
  camera.position.set(...(view.camera || [0.3, 8.4, 9.2]));
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, minDistance: 2.2, maxDistance: 18, maxPolarAngle: 1.25 });
  controls.target.set(...(view.target || [0.2, 0, 0.9]));

  scene.add(new THREE.HemisphereLight('#ffffff', '#aab7c2', 2.1));
  const sun = new THREE.DirectionalLight('#fffaf0', 2.6);
  sun.position.set(-5, 9, 4); sun.castShadow = true;
  sun.shadow.mapSize.setScalar(low ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -7.5, right: 7.5, top: 7.5, bottom: -7.5, near: 1, far: 30 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.01;
  scene.add(sun);

  // suolo: hinterland, Comune, regioni di gioco, parchi, acqua
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: THEME.ground.outside }));
  outer.rotation.x = -Math.PI / 2; outer.receiveShadow = true; scene.add(outer);
  scene.add(flat(rings(map.city_outline_path), THEME.ground.city, 0.001));
  for (const [k, r] of Object.entries(map.regions)) {
    const tint = flat(rings(r.svg_path), THEME.region[k], 0.002, { transparent: true, opacity: 0.16, depthWrite: false });
    scene.add(tint);
    for (const ring of rings(r.svg_path)) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([...ring, ring[0]].map(([x, y]) => new THREE.Vector3(X(x), 0.004, Z(y)))),
        new THREE.LineBasicMaterial({ color: THEME.region[k] }));
      scene.add(line);
    }
  }
  scene.add(flat(env.parks, THEME.park, 0.003));
  const waterMat = new THREE.MeshLambertMaterial({ color: THEME.water, emissive: THEME.water, emissiveIntensity: 0.25 });
  const water = new THREE.Mesh(flatGeometry(env.water), waterMat); water.position.y = 0.005; scene.add(water);
  for (const [name, lines] of Object.entries(env.rivers))
    for (const l of lines) scene.add(new THREE.Mesh(ribbon(l, name.startsWith('Lambro') ? 0.016 : 0.012, 0.006), waterMat));

  scene.add(buildingsMesh(bin));

  // città di gioco: torri del colore del seme, collegate da cavi (le strade del grafo)
  const towers = towns.map((t, i) => {
    const color = THEME.suit[t.suit].fill;
    const g = new THREE.Group(); g.position.set(X(t.x), 0, Z(t.y));
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, PED, 6), new THREE.MeshLambertMaterial({ color }));
    shaft.position.y = PED / 2; shaft.castShadow = true;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.018, 6), new THREE.MeshLambertMaterial({ color: '#ffffff' }));
    cap.position.y = PED; cap.castShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 6), new THREE.MeshBasicMaterial({ color }));
    ring.rotation.x = Math.PI / 2; ring.position.y = PED + 0.01;
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, PED + 0.1, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = PED / 2; hit.userData.town = i;
    g.add(shaft, cap, ring, hit); scene.add(g);
    return { g, hit };
  });
  const cableMat = new THREE.MeshLambertMaterial({ color: THEME.ink });
  for (const r of map.roads) {
    const a = towns[townIndex[r.a]], b = towns[townIndex[r.b]];
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(X(a.x), PED + 0.01, Z(a.y)),
      new THREE.Vector3(X(r.control[0]), PED - 0.06, Z(r.control[1])), new THREE.Vector3(X(b.x), PED + 0.01, Z(b.y)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.006, 5), cableMat); m.castShadow = true; scene.add(m);
  }

  // pedine (aggiornate dallo stato)
  const pieces = new THREE.Group(); scene.add(pieces);
  const mats = {};
  const mat = (c, o = {}) => (mats[c + JSON.stringify(o)] ??= new THREE.MeshLambertMaterial({ color: c, ...o }));
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: THEME.accent, transparent: true, opacity: 0.55, depthWrite: false }));
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.014, 8, 48), new THREE.MeshBasicMaterial({ color: THEME.accent }));
  halo.rotation.x = Math.PI / 2; scene.add(beam, halo);

  function update(s) {
    pieces.clear();
    s.towns.forEach((st, i) => {
      if (st.owner === null) return;
      const p = towers[i].g.position;
      const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.045, 32), mat(THEME.players[st.owner]));
      puck.position.set(p.x, PED + 0.035, p.z); puck.castShadow = true; pieces.add(puck);
      if (st.monastery) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.016, 8, 40), mat('#ffffff'));
        r.rotation.x = Math.PI / 2; r.position.set(p.x, PED + 0.04, p.z); pieces.add(r);
      }
      if (st.viking) {
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.1), mat(THEME.ink));
        v.position.set(p.x, PED + 0.075, p.z); v.rotation.y = Math.PI / 4; pieces.add(v);
      }
    });
    const a = s.activeTown != null ? towers[s.activeTown].g.position : null;
    beam.visible = halo.visible = !!a;
    if (a) { beam.position.set(a.x, PED + 1.5, a.z); halo.position.set(a.x, PED + 0.02, a.z); }
  }

  // etichette HTML proiettate (nitide a ogni zoom)
  const labels = [];
  const addLabel = (html, cls, x, y, h) => {
    const el = document.createElement('div'); el.className = cls; el.innerHTML = html; overlay.appendChild(el);
    labels.push({ el, p: new THREE.Vector3(X(x), h, Z(y)) }); return el;
  };
  for (const [k, r] of Object.entries(map.regions)) {
    const [lx, ly] = r.label.tx ? [r.label.tx, r.label.ty] : [r.label.x, r.label.y];
    addLabel(`<b style="--rc:${THEME.region[k]}">${r.name}</b><span>${r.municipio}</span><i>${r.threshold}<em>soglia</em></i><i>${r.points}<em>punti</em></i>`, 'rlabel', lx, ly, 0.02);
  }
  const townLabels = towns.map(t => addLabel(t.name, 'tlabel', t.x, t.y, PED + 0.12));

  let clickable = new Set(), onPick = () => {}, hover = null;
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), hits = towers.map(t => t.hit);
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
  };
  new ResizeObserver(resize).observe(container); resize();

  const v = new THREE.Vector3(), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setAnimationLoop(time => {
    controls.update();
    if (!still) halo.scale.setScalar(1 + Math.sin(time / 300) * 0.12);
    const { clientWidth: w, clientHeight: h } = container, dist = camera.position.distanceTo(controls.target);
    labels.forEach(({ el, p }, i) => {
      v.copy(p).project(camera);
      const isTown = el.classList.contains('tlabel'), ti = i - (labels.length - towns.length);
      const show = v.z < 1 && (!isTown || dist < 7 || ti === hover || ti === state?.activeTown);
      el.style.display = show ? '' : 'none';
      if (show) el.style.transform = `translate(${(v.x + 1) / 2 * w}px, ${(1 - v.y) / 2 * h}px)`;
    });
    renderer.render(scene, camera);
  });

  let state = null;
  return {
    towns,
    regions: map.regions,
    update: s => { state = s; update(s); },
    setClickable: (ids, cb) => { clickable = new Set(ids); onPick = cb || (() => {}); },
  };
}
