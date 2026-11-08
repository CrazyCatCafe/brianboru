// Dati di gioco: carte e tracciati da assets/docs/*.pdf, grafo dei quartieri da assets/milano/mappa.json.

export { REGIONS, TOWNS, ROADS } from './board.js'; // grafo di Milano (vedi tools/build-board.mjs)

// Simboli: T prendi città attiva, C +moneta, P paga moneta, M matrimonio, A predone vichingo,
// X chiesa, E espansione (5 monete), V rimuovi controllo vichingo
const SYM = { yellow: 'M', red: 'A', blue: 'X' };
const COLOR_OF = {};
[[1, 4, 7, 10, 14, 17, 23], [2, 5, 8, 11, 15, 18, 24], [3, 6, 9, 12, 16, 19, 25], [13, 20, 21, 22]]
  .forEach((vals, i) => vals.forEach(v => (COLOR_OF[v] = ['yellow', 'red', 'blue', 'white'][i])));

function primary(v, s) {
  if (v <= 3) return ['T', s, s, 'C'];
  if (v <= 6) return ['T', s, s];
  if (v <= 9) return ['T', s, 'C'];
  if (v <= 12) return ['T', 'C', 'C'];
  if (v <= 16) return ['T'];
  if (v <= 19) return ['T', 'P'];
  return ['T', 'P', 'P'];
}

export const CARDS = {};
for (let v = 1; v <= 25; v++) {
  const color = COLOR_OF[v];
  let card;
  if (color === 'white') {
    const p = { 13: ['T', 'C'], 20: ['T'], 21: ['T', 'P'], 22: ['T', 'P', 'P'] }[v];
    card = { primary: p, secondary: v === 13 ? [['C', 'C', 'E'], ['V', 'P']] : [['C', 'C', 'E']] };
  } else {
    const s = SYM[color];
    const coins = v <= 4 || v === 6 ? 3 : v <= 12 ? 2 : 1;
    card = {
      primary: primary(v, s),
      secondary: [[...Array(coins).fill('C'), 'E'], v <= 12 ? [s, s] : [s, s, s]],
    };
  }
  CARDS[v] = { value: v, color, ...card };
}

export const MARRIAGES = [
  { points: 2, region: 'CON' }, { points: 2, region: 'LEI' }, { points: 2, region: 'MUN' },
  { points: 2, region: 'SUN' }, { points: 2, region: 'NUN' }, { points: 4 }, { points: 2, renown: 1 },
];
export const PRINCESS = { princess: true };
export const VIKINGS = [9, 10, 11, 12, 12, 13, 14];

// Benefici del tracciato matrimoni, dallo spazio 1 (indice 0) al 10
export const MARRIAGE_TRACK = [null, null, 'C', 'C', 'C', 'CC', 'CC', 'R', 'T', null];
export const REGION_SCORE = [0, 0, 0, 1, 1, 3, 5, 7, 10]; // indice = numero di regioni
