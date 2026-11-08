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
export const PIXEL_SCALE = 0.75; // risoluzione di disegno della mappa nello stile REPLACED (si può spegnere dal gioco)

