// Genera js/game/board.js (grafo di gioco) da assets/milano/mappa.json.
// Uso: node tools/build-board.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const map = JSON.parse(readFileSync(new URL('../assets/milano/mappa.json', import.meta.url)));
const index = Object.fromEntries(map.towns.map((t, i) => [t.id, i]));
const towns = map.towns.map(t => ({ key: t.id, name: t.name, color: t.suit, region: t.region }));
const roads = map.roads.map(r => [index[r.a], index[r.b]]);
const regions = Object.fromEntries(Object.entries(map.regions).map(([k, r]) => [k, { name: r.name, municipio: r.municipio, threshold: r.threshold, points: r.points }]));

writeFileSync(new URL('../js/game/board.js', import.meta.url), `// Generato da tools/build-board.mjs a partire da assets/milano/mappa.json: non modificare a mano.
export const REGIONS = ${JSON.stringify(regions, null, 1)};
export const TOWNS = ${JSON.stringify(towns)}.map((t, id) => ({ id, ...t }));
export const ROADS = ${JSON.stringify(roads)};
`);
console.log(towns.length, 'quartieri,', roads.length, 'strade');
