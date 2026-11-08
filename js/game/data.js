// Dati di gioco ricavati da assets/docs/*.pdf e assets/board/board.jpg.
// Coordinate in pixel di board.jpg (1024x1026). Regioni e strade lette a occhio dalla foto: da verificare.

export const REGIONS = {
  NUN: { name: 'Northern Uí Néill', threshold: 6, points: 4 },
  ULA: { name: 'Ulaid', threshold: 4, points: 3 },
  BRE: { name: 'Bréifne', threshold: 3, points: 2 },
  CON: { name: 'Connaught', threshold: 7, points: 5 },
  SUN: { name: 'Southern Uí Néill', threshold: 5, points: 3 },
  DUB: { name: 'Dubhlinn', threshold: 2, points: 2 },
  LEI: { name: 'Leinster', threshold: 6, points: 4 },
  MUN: { name: 'Munster', threshold: 7, points: 5 },
};

// [colore, regione, x, y]; l'indice è l'id della città
export const TOWNS = [
  ['yellow', 'ULA', 672, 173], ['blue', 'NUN', 619, 205], ['blue', 'ULA', 699, 213], ['red', 'NUN', 561, 222],
  ['red', 'NUN', 491, 234], ['yellow', 'NUN', 656, 262], ['blue', 'NUN', 513, 272], ['blue', 'ULA', 759, 283],
  ['red', 'ULA', 709, 293], ['yellow', 'BRE', 485, 320], ['yellow', 'NUN', 583, 328], ['red', 'ULA', 742, 344],
  ['red', 'NUN', 658, 346], ['red', 'BRE', 465, 363], ['red', 'CON', 317, 372], ['blue', 'BRE', 547, 395],
  ['red', 'CON', 391, 408], ['red', 'SUN', 594, 413], ['blue', 'SUN', 658, 416], ['yellow', 'CON', 460, 419],
  ['blue', 'BRE', 506, 434], ['yellow', 'CON', 344, 449], ['yellow', 'SUN', 555, 453], ['yellow', 'DUB', 709, 468],
  ['blue', 'CON', 493, 496], ['yellow', 'SUN', 662, 500], ['blue', 'SUN', 546, 506], ['red', 'CON', 392, 507],
  ['red', 'CON', 289, 516], ['red', 'SUN', 611, 520], ['red', 'DUB', 717, 526], ['blue', 'CON', 475, 546],
  ['yellow', 'CON', 421, 549], ['blue', 'LEI', 633, 562], ['blue', 'DUB', 731, 572], ['yellow', 'LEI', 555, 575],
  ['blue', 'MUN', 374, 620], ['yellow', 'MUN', 444, 621], ['blue', 'LEI', 565, 632], ['yellow', 'LEI', 666, 648],
  ['blue', 'LEI', 720, 649], ['red', 'LEI', 608, 658], ['red', 'MUN', 444, 680], ['yellow', 'MUN', 550, 699],
  ['yellow', 'LEI', 615, 706], ['yellow', 'LEI', 693, 718], ['yellow', 'MUN', 352, 720], ['blue', 'LEI', 640, 750],
  ['blue', 'MUN', 560, 771], ['red', 'MUN', 334, 773], ['red', 'MUN', 281, 817], ['red', 'MUN', 471, 821],
  ['blue', 'MUN', 374, 873],
].map(([color, region, x, y], id) => ({ id, color, region, x, y }));

export const ROADS = [
  [0, 2], [1, 3], [1, 5], [4, 6], [5, 12], [8, 12], [7, 11], [10, 17], [13, 16], [16, 21], [19, 24], [17, 18],
  [18, 25], [22, 26], [26, 29], [24, 31], [31, 32], [28, 36], [23, 25], [30, 34], [30, 33], [33, 35], [34, 40],
  [39, 40], [39, 45], [40, 45], [38, 41], [41, 44], [44, 47], [37, 42], [43, 48], [48, 51], [49, 50],
];

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
export const PLAYER_COLORS = ['#c0392b', '#2471a3', '#7d3c98', '#d68910', '#1e8449'];
