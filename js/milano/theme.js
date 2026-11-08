// Tema "Milano · Mirror's Edge": mondo bianco e luminoso, colore solo su ciò che conta per giocare.
export const THEME = {
  name: 'Milano',
  font: "'Saira', system-ui, sans-serif",
  ink: '#111111',
  muted: '#6b7178',
  paper: '#ffffff',
  accent: '#e62e2d', // il rosso "runner vision"
  sky: ['#fbfdff', '#d6e7f3'],
  ground: { city: '#eef1f3', outside: '#dde1e4' },
  building: { city: '#fdfdfd', outside: '#c9ced2' },
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
