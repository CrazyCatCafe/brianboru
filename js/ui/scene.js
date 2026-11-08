// Tavolo 3D: tabellone vettoriale come superficie, pedine in legno, telecamera orbitale.
import * as THREE from 'three';
import { OrbitControls } from '../../vendor/three/OrbitControls.js';
import { TOWNS } from '../game/data.js';
import { THEME } from './theme.js';
import { boardSVG, BOARD_W, BOARD_H, scoreCell, marriageCell } from './map.js';

const U = 100; // pixel del tabellone per unità 3D
const TOP = 0.12; // spessore del tabellone
const at = (x, y, h = 0) => new THREE.Vector3((x - BOARD_W / 2) / U, TOP + h, (y - BOARD_H / 2) / U);

async function fontCSS() {
  const b64 = async url => {
    const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const face = async (family, file, weight) =>
    `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${await b64(new URL(`../../vendor/fonts/${file}`, import.meta.url))}) format('woff2')}`;
  return (await Promise.all([face('Uncial Antiqua', 'uncial-antiqua.woff2', 400),
    face('Alegreya Sans', 'alegreya-sans-500.woff2', 500), face('Alegreya Sans', 'alegreya-sans-800.woff2', 800), face('Alegreya SC', 'alegreya-sc-700.woff2', 700)])).join('');
}

async function svgTexture(svg, renderer, px = 2048) {
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await img.decode();
  const c = document.createElement('canvas');
  c.width = px; c.height = Math.round(px * BOARD_H / BOARD_W);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function woodTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = THEME.table.wood[1]; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 260; i++) { // venature
    const y = Math.random() * 1024, a = Math.random() * 0.12;
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? '120,80,50' : '20,10,5'},${a})`;
    g.lineWidth = 1 + Math.random() * 5;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + Math.sin(x / 140 + i) * 6);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function createTable(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#120c08');
  scene.fog = new THREE.Fog('#120c08', 22, 40);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 12.2, 8.4);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, minDistance: 6, maxDistance: 22, maxPolarAngle: 1.2, screenSpacePanning: false });
  controls.target.set(0, 0, 0.6);

  scene.add(new THREE.HemisphereLight('#fff1d6', '#2a1a10', 1.1));
  const sun = new THREE.DirectionalLight('#ffe2b0', 2.2);
  sun.position.set(-6, 14, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.85 }));
  table.rotation.x = -Math.PI / 2; table.receiveShadow = true;
  scene.add(table);

  const map = await svgTexture(boardSVG({ fontCSS: await fontCSS() }), renderer);
  const edge = new THREE.MeshStandardMaterial({ color: '#d8c79a', roughness: 0.7 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W / U, TOP, BOARD_H / U),
    [edge, edge, new THREE.MeshStandardMaterial({ map, roughness: 0.62 }), edge, edge, edge]);
  board.position.y = TOP / 2; board.receiveShadow = true; board.castShadow = true;
  scene.add(board);

  // segnaposto invisibili per cliccare le città
  const hits = TOWNS.map(t => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.2, 16), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.copy(at(t.x, t.y, 0.05)); m.userData.town = t.id; scene.add(m); return m;
  });
  const pieces = new THREE.Group(); scene.add(pieces);
  const halos = new THREE.Group(); scene.add(halos);

  const mat = {};
  const material = (color, opts = {}) => (mat[color + JSON.stringify(opts)] ??= new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...opts }));
  const disc = (color, r = 0.19, h = 0.1) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.97, h, 32), material(color));
    m.castShadow = m.receiveShadow = true; return m;
  };
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), material('#f2c14e', { metalness: 0.35, roughness: 0.3, emissive: '#8a5a00', emissiveIntensity: 0.6 }));
  marker.castShadow = true; scene.add(marker);

  function update(s) {
    pieces.clear();
    const add = (m, p) => { m.position.copy(p); pieces.add(m); return m; };
    s.towns.forEach((st, id) => {
      if (st.owner === null) return;
      const t = TOWNS[id];
      add(disc(THEME.players[st.owner]), at(t.x, t.y, 0.05));
      if (st.monastery) {
        const ring = add(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.06, 12, 40), material('#efe7d6')), at(t.x, t.y, 0.03));
        ring.rotation.x = Math.PI / 2; ring.castShadow = true;
      }
      if (st.viking) add(disc('#9c2b1e', 0.17, 0.06), at(t.x, t.y, 0.13));
    });
    // punti sul tracciato e posizione sul tracciato matrimoni (pile se condivisi)
    const stacks = {};
    s.players.forEach((pl, i) => {
      for (const [x, y] of [scoreCell(pl.points), marriageCell(pl.mar)]) {
        const k = x + ',' + y, h = (stacks[k] = (stacks[k] ?? -1) + 1);
        add(disc(THEME.players[i], 0.16, 0.08), at(x + h * 4, y - h * 2, 0.04 + h * 0.08));
      }
      for (let c = 0; c < pl.church; c++) add(disc(THEME.players[i], 0.12, 0.06), at(825 + i * 16, 250 + (c % 5) * 16, 0.03 + Math.floor(c / 5) * 0.06));
    });
    for (let r = 0; r < s.area; r++) { // predoni vichinghi nell'area battaglia
      const m = add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 20), material('#7d8a91', { metalness: 0.3 })),
        at(198 + (r % 6) * 15, 192 + Math.floor(r / 6) * 15 + (r % 2) * 3, 0.03 + Math.floor(r / 12) * 0.05));
      m.castShadow = true;
    }
    const t = s.trick?.town != null ? TOWNS[s.trick.town] : null;
    marker.visible = !!t;
    if (t) marker.position.copy(at(t.x, t.y, 0.55));
  }

  let clickable = new Set(), onPick = () => {};
  function setClickable(ids, cb) {
    clickable = new Set(ids); onPick = cb || (() => {});
    halos.clear();
    for (const id of clickable) {
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: '#fff4c2', transparent: true }));
      h.rotation.x = Math.PI / 2; h.position.copy(at(TOWNS[id].x, TOWNS[id].y, 0.02)); h.userData.town = id;
      halos.add(h);
    }
  }

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let hover = null, down = null;
  const pick = e => {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(hits)[0];
    return hit && clickable.has(hit.object.userData.town) ? hit.object.userData.town : null;
  };
  renderer.domElement.addEventListener('pointermove', e => {
    hover = pick(e); renderer.domElement.style.cursor = hover === null ? '' : 'pointer';
  });
  renderer.domElement.addEventListener('pointerdown', e => (down = [e.clientX, e.clientY]));
  renderer.domElement.addEventListener('pointerup', e => { // clic, non trascinamento
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 6) { const id = pick(e); if (id !== null) onPick(id); }
  });

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h); camera.aspect = w / h;
    camera.fov = w < h ? 62 : 38; // in verticale serve un'inquadratura più larga per vedere tutto il tabellone
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container); resize();

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setAnimationLoop(time => {
    const s = time / 1000;
    if (!still) { marker.position.y = TOP + 0.55 + Math.sin(s * 2) * 0.06; marker.rotation.y = s; }
    halos.children.forEach(h => {
      const on = h.userData.town === hover;
      h.material.opacity = on ? 1 : 0.55 + (still ? 0 : Math.sin(s * 4) * 0.3);
      h.scale.setScalar(on ? 1.25 : 1);
    });
    controls.update();
    renderer.render(scene, camera);
  });

  return { update, setClickable, renderer };
}
