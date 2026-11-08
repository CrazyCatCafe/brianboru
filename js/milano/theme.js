// Tema "Milano · Mirror's Edge": mondo bianco e luminoso, colore solo su ciò che conta per giocare.
export const THEME = {
  name: 'Milano',
  font: "'Saira', system-ui, sans-serif",
  ink: '#111111',
  muted: '#5b6168',
  paper: '#ffffff',
  accent: '#e62e2d', // il rosso "runner vision"
  sky: ['#fbfdff', '#d6e7f3'],
  ground: { city: '#eef1f3', outside: '#a9b1a6' },  // fuori dal Comune: grigio verso il verde
  building: { city: '#fdfdfd', outside: '#b4bab3' },
  rural: '#62785c',                               // campi e boschi dell'hinterland
  project: '#2dff9a',                             // anello fluorescente dei progetti urbani
  park: '#d3d8dc',
  water: '#3fb2ff',
  // semi delle carte e delle città (valgono anche per le carte)
  suit: {
    red: { fill: '#e62e2d', ink: '#ffffff', name: 'Rosso' },
    blue: { fill: '#1f8fff', ink: '#ffffff', name: 'Blu' },
    yellow: { fill: '#ffc20e', ink: '#111111', name: 'Giallo' },
    white: { fill: '#ffffff', ink: '#111111', name: 'Jolly' },
  },
  region: {
    NUN: '#ff4f7b', ULA: '#ff9a1f', BRE: '#5cc84a', CON: '#e8b400',
    SUN: '#7a5cff', DUB: '#ff5a4f', LEI: '#00b3a7', MUN: '#2f80ff',
  },
  players: ['#ff6a00', '#00a6a6', '#6c3bff', '#ff2d87', '#1b1b1b'],
};

// Variante REPLACED della città 3D: nebbia grigia, terreno bagnato, luce bassa; disegnata a bassa risoluzione (pixel art)
export const THEME_REPLACED = {
  sky: ['#b3bbc1', '#a3acb2'], fog: { color: '#a7b0b6', range: [10, 26] },
  ground: { city: '#868f95', outside: '#626a70' }, building: { city: '#e6eaec', outside: '#8f979c' },
  park: '#737c82', rural: '#56604f', water: '#6fd0ff',
  light: { hemi: 0.95, sun: 0.85, sky: '#f0f4f6', ground: '#5c656c', sunColor: '#fff0dc', sunPos: [-7, 6, 2] },
};
export const PIXEL_SCALE = 0.5; // risoluzione di disegno rispetto allo schermo nello stile REPLACED

// Alternative alla città pixel (da scegliere): nitide a ogni risoluzione, i colori di gioco restano gli unici accesi.
// Tavolo olografico: la mappa è una proiezione sul tavolo della banda, volumi scuri con spigoli ciano.
export const THEME_HOLO = {
  sky: ['#05090f', '#05090f'], fog: { color: '#05090f', range: [12, 30] },
  ground: { city: '#0c1824', outside: '#070c12' }, building: { city: '#1c3550', outside: '#0d1722' },
  park: '#0f2b28', rural: '#09130f', water: '#1fc8ff', clouds: false, glowTokens: true,
  edges: { color: '#3fd6ff', opacity: 0.12 },
  light: { hemi: 1.0, sun: 0.6, sky: '#8fbde0', ground: '#0a1018', sunColor: '#cdeeff', sunPos: [-5, 9, 4] },
};
// Plancia stampata, stile mappa della metro: carta, rilievi bassi, niente nuvole né ombre lunghe.
export const THEME_METRO = {
  sky: ['#efeae0', '#efeae0'], fog: { color: '#efeae0', range: [40, 80] },
  ground: { city: '#f5f1e8', outside: '#e4dfd4' }, building: { city: '#e3dccd', outside: '#d8d1c3' },
  park: '#cde0bd', rural: '#dde2cc', water: '#6cc0ea', clouds: false, shadows: false, heights: 0.3,
  light: { hemi: 1.15, sun: 0.45, sky: '#ffffff', ground: '#d6cfc0', sunColor: '#ffffff', sunPos: [-3, 9, 4] },
};
