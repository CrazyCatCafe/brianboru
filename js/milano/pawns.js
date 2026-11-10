// Pedine 3D delle fazioni (assets/milano/pedine/*.glb). Lettore GLB minimo: una mesh, solo posizioni e indici per materiale.
// Materiali: "colore_giocatore" e "neon_giocatore" prendono il colore del giocatore, gli altri hanno il loro colore fisso.
import * as THREE from 'three';

export const PAWN_FILES = { Technoborghesi: 'technoborghesi', Punk: 'punk', 'Partite Iva': 'partite-iva', Startuppers: 'startuppers', 'Le Sciure': 'le-sciure' };

async function readGlb(url) {
  const buf = await (await fetch(url)).arrayBuffer(), dv = new DataView(buf);
  const jsonLen = dv.getUint32(12, true), json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  const bin = 20 + jsonLen + 8; // dopo il chunk JSON: lunghezza e tipo del chunk BIN
  const view = i => { const a = json.accessors[i], bv = json.bufferViews[a.bufferView], n = a.count * (a.type === 'VEC3' ? 3 : 1);
    return a.componentType === 5126 ? new Float32Array(buf, bin + (bv.byteOffset || 0), n) : new Uint16Array(buf, bin + (bv.byteOffset || 0), n); };
  const prims = json.meshes[0].primitives, pos = view(prims[0].attributes.POSITION), idx = [], groups = [];
  prims.forEach((p, m) => { const ix = view(p.indices); groups.push({ start: idx.length, count: ix.length, m: p.material }); idx.push(...ix); });
  let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setIndex(idx);
  groups.forEach(x => g.addGroup(x.start, x.count, x.m));
  g = g.toNonIndexed(); g.computeVertexNormals(); // facce piatte, nello stile low poly
  return { geo: g, mats: json.materials.map(m => ({ name: m.name, color: m.pbrMetallicRoughness.baseColorFactor })) };
}

const cache = {};
export const loadPawns = base => Promise.all(Object.values(PAWN_FILES).map(async k => { try { cache[k] = await readGlb(new URL(`pedine/${k}.glb`, base)); } catch (e) { console.warn('pedina', k, e); } }));

// pedina della fazione nel colore del giocatore (null se il file non c'è)
export function makePawn(faction, color) {
  const p = cache[PAWN_FILES[faction]];
  if (!p) return null;
  const mats = p.mats.map(m => m.name === 'colore_giocatore' ? new THREE.MeshLambertMaterial({ color, flatShading: true })
    : m.name === 'neon_giocatore' ? new THREE.MeshBasicMaterial({ color })
    : new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(m.color[0], m.color[1], m.color[2], THREE.LinearSRGBColorSpace), flatShading: true }));
  const mesh = new THREE.Mesh(p.geo, mats); mesh.castShadow = true;
  return mesh;
}
