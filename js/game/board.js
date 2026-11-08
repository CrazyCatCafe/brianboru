// Generato da tools/build-board.mjs a partire da assets/milano/mappa.json: non modificare a mano.
export const REGIONS = {
 "SUN": {
  "name": "CENTRO",
  "municipio": "Municipio 1",
  "threshold": 5,
  "points": 3
 },
 "NUN": {
  "name": "NORD",
  "municipio": "Municipio 9",
  "threshold": 6,
  "points": 4
 },
 "ULA": {
  "name": "NORD-EST",
  "municipio": "Municipio 2",
  "threshold": 4,
  "points": 3
 },
 "DUB": {
  "name": "EST",
  "municipio": "Municipio 3",
  "threshold": 2,
  "points": 2
 },
 "LEI": {
  "name": "SUD-EST",
  "municipio": "Municipio 4",
  "threshold": 6,
  "points": 4
 },
 "MUN": {
  "name": "SUD-OVEST",
  "municipio": "Municipi 5 e 6",
  "threshold": 7,
  "points": 5
 },
 "CON": {
  "name": "OVEST",
  "municipio": "Municipio 7",
  "threshold": 7,
  "points": 5
 },
 "BRE": {
  "name": "NORD-OVEST",
  "municipio": "Municipio 8",
  "threshold": 3,
  "points": 2
 }
};
export const TOWNS = [{"key":"N1","name":"Dergano","color":"red","region":"NUN"},{"key":"N2","name":"Bovisa","color":"blue","region":"NUN"},{"key":"N3","name":"Comasina","color":"red","region":"NUN"},{"key":"N4","name":"Bruzzano","color":"blue","region":"NUN"},{"key":"N5","name":"Niguarda","color":"yellow","region":"NUN"},{"key":"N6","name":"Isola","color":"yellow","region":"NUN"},{"key":"N7","name":"Bicocca","color":"red","region":"NUN"},{"key":"U1","name":"Via Padova","color":"yellow","region":"ULA"},{"key":"U2","name":"Gorla","color":"blue","region":"ULA"},{"key":"U3","name":"Greco","color":"red","region":"ULA"},{"key":"U4","name":"Loreto","color":"blue","region":"ULA"},{"key":"U5","name":"Centrale","color":"red","region":"ULA"},{"key":"B1","name":"Quarto Oggiaro","color":"yellow","region":"BRE"},{"key":"B2","name":"Gallaratese","color":"red","region":"BRE"},{"key":"B3","name":"Paolo Sarpi","color":"blue","region":"BRE"},{"key":"B4","name":"CityLife","color":"blue","region":"BRE"},{"key":"C1","name":"Muggiano","color":"red","region":"CON"},{"key":"C2","name":"Figino","color":"red","region":"CON"},{"key":"C3","name":"San Siro","color":"yellow","region":"CON"},{"key":"C4","name":"Quinto Romano","color":"yellow","region":"CON"},{"key":"C5","name":"De Angeli","color":"red","region":"CON"},{"key":"C6","name":"Baggio","color":"red","region":"CON"},{"key":"C7","name":"Quarto Cagnino","color":"yellow","region":"CON"},{"key":"C8","name":"Forze Armate","color":"blue","region":"CON"},{"key":"C9","name":"Selinunte","color":"blue","region":"CON"},{"key":"S1","name":"Brera","color":"red","region":"SUN"},{"key":"S2","name":"Porta Venezia","color":"blue","region":"SUN"},{"key":"S3","name":"Castello","color":"yellow","region":"SUN"},{"key":"S4","name":"Sant'Ambrogio","color":"blue","region":"SUN"},{"key":"S5","name":"Duomo","color":"red","region":"SUN"},{"key":"S6","name":"Guastalla","color":"yellow","region":"SUN"},{"key":"D1","name":"Buenos Aires","color":"yellow","region":"DUB"},{"key":"D2","name":"Città Studi","color":"red","region":"DUB"},{"key":"D3","name":"Ortica","color":"blue","region":"DUB"},{"key":"L1","name":"Corsica","color":"blue","region":"LEI"},{"key":"L2","name":"XXII Marzo","color":"yellow","region":"LEI"},{"key":"L3","name":"Porta Romana","color":"blue","region":"LEI"},{"key":"L4","name":"Calvairate","color":"red","region":"LEI"},{"key":"L5","name":"Ortomercato","color":"yellow","region":"LEI"},{"key":"L6","name":"Mecenate","color":"blue","region":"LEI"},{"key":"L7","name":"Corvetto","color":"yellow","region":"LEI"},{"key":"L8","name":"Ponte Lambro","color":"yellow","region":"LEI"},{"key":"L9","name":"Rogoredo","color":"blue","region":"LEI"},{"key":"M1","name":"Lorenteggio","color":"blue","region":"MUN"},{"key":"M2","name":"Bande Nere","color":"yellow","region":"MUN"},{"key":"M3","name":"Giambellino","color":"red","region":"MUN"},{"key":"M4","name":"Navigli","color":"yellow","region":"MUN"},{"key":"M5","name":"Barona","color":"red","region":"MUN"},{"key":"M6","name":"Gratosoglio","color":"red","region":"MUN"},{"key":"M7","name":"Ripamonti","color":"red","region":"MUN"},{"key":"M8","name":"Chiaravalle","color":"blue","region":"MUN"},{"key":"M9","name":"Morivione","color":"blue","region":"MUN"},{"key":"M10","name":"Vigentina","color":"yellow","region":"MUN"}].map((t, id) => ({ id, ...t }));
export const ROADS = [[0,1],[2,3],[3,4],[4,6],[6,9],[1,12],[5,14],[7,8],[10,11],[12,13],[13,17],[17,19],[18,24],[24,23],[23,22],[21,43],[25,26],[26,30],[30,29],[29,28],[28,27],[27,25],[32,34],[33,39],[34,35],[36,37],[37,40],[40,42],[42,41],[38,41],[39,41],[44,45],[47,48],[52,51],[51,49],[38,39]];
