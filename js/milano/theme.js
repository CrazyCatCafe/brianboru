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

// Variante Firewatch: niente pixel, colori piatti e nebbia colorata che dà profondità. Due momenti: tramonto e sera piovosa.
// I colori di gioco (spot, bordi, basi delle bande) restano fuori dalla nebbia, così non si confondono con l'atmosfera.
export const THEME_FIREWATCH = {
  tramonto: {
    sky: ['#f7c08a', '#f2a877'], fog: { color: '#f0a676', range: [9, 24] },
    ground: { city: '#c58b72', outside: '#8e5c5a' }, building: { city: '#f4d9b8', outside: '#b98273' },
    park: '#a77e5c', rural: '#7a6048', water: '#4cb4c4',
    light: { hemi: 0.9, sun: 1.15, sky: '#ffd9ae', ground: '#5b4a82', sunColor: '#ffb066', sunPos: [-9, 3.2, 1.5] },
  },
  pioggia: {
    sky: ['#4d6b7b', '#466574'], fog: { color: '#4f707e', range: [8, 22] },
    ground: { city: '#5d7882', outside: '#3b525b' }, building: { city: '#b3c6cc', outside: '#647d86' },
    park: '#536f64', rural: '#3e584b', water: '#8fdcec',
    light: { hemi: 0.95, sun: 0.55, sky: '#a9cbd8', ground: '#273440', sunColor: '#d3ebf5', sunPos: [4, 7, -3] },
  },
};
