// Tema grafico: tutto ciò che cambia in un reskin (es. Milano) sta qui.
export const THEME = {
  name: 'Irlanda',
  font: { display: "'Uncial Antiqua', serif", heading: "'Alegreya SC', Georgia, serif", ui: "'Alegreya Sans', system-ui, sans-serif" },
  ink: '#2a1d12',
  parchment: '#f1e6c8',
  parchmentDark: '#d9c79c',
  sea: ['#21566a', '#163d4d'],
  coast: '#f6ecd0',
  road: '#fbf3dc',
  border: '#3b2a1a',
  // colori delle carte / città
  suit: {
    yellow: { fill: '#e6b12e', deep: '#a8780f', name: 'Corteggiamento' },
    red: { fill: '#c9452f', deep: '#8a2416', name: 'Battaglia' },
    blue: { fill: '#2f7db3', deep: '#174f78', name: 'Chiesa' },
    white: { fill: '#e4e0d6', deep: '#8d877a', name: 'Reale' },
  },
  // tinte delle regioni sulla mappa
  region: {
    NUN: '#d9958a', ULA: '#d8c160', BRE: '#a9c27a', CON: '#d99a5b',
    SUN: '#b39bc4', DUB: '#e0a35c', LEI: '#e3cf7e', MUN: '#cdbb8a',
  },
  players: ['#b8322a', '#2a5fa8', '#6f3c8f', '#d98b1c', '#2e7d4a'],
  table: { wood: ['#4a3020', '#2f1d12'] },
};
