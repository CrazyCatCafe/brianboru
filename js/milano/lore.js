// Ambientazione Milano 2077: nomi e testi. Le regole restano quelle di Brian Boru (vedi js/game).

// Le 25 carte storia, per valore
export const STORIES = {
  // gialle: feste clandestine techno e trance
  1: 'Flyer clandestino', 4: 'Cassa portatile', 7: 'Rave sotto il cavalcavia', 10: 'Laser sui Navigli',
  14: 'Trance alla Darsena', 17: 'Warehouse party', 23: 'Alba techno',
  // rosse: guerriglia urbana
  2: 'Molotov', 5: 'Barricata', 8: 'Jammer anti-drone', 11: 'Posto di blocco',
  15: 'Caccia al cane robot', 18: 'Sciame hackerato', 24: 'Blindato ribaltato',
  // blu: progetti di comunità
  3: 'Mensa sociale', 6: 'Distribuzione viveri', 9: 'Orto sul tetto', 12: 'Ortobonismo',
  16: 'Social rescue', 19: 'Rete di supporto', 25: 'Quartiere rinato',
  // grigie: la storia di Briano Borro
  13: 'Il carpentiere', 20: 'Il sindacalista', 21: 'La voce della resistenza', 22: 'Briano Borro',
};

export const SUIT_NAMES = { yellow: 'Underground Party', red: 'Guerrilla', blue: 'Community Projects', white: 'Briano Borro e BB Resistance' };

// Personaggi da ingaggiare (le carte matrimonio), nello stesso ordine di MARRIAGES in js/game/data.js
export const CHARACTERS = [
  { name: 'Nina San Siro', who: 'Ex capo ultrà, ora sciamana del basso', zone: 'OVEST' },
  { name: 'Il Profeta di Corvetto', who: 'Predica la cassa dritta dai tetti', zone: 'SUD-EST' },
  { name: 'Mamma Giambellino', who: 'Sfama mezzo municipio, comanda l\'altro mezzo', zone: 'SUD-OVEST' },
  { name: 'Conte Galleria', who: 'Technoborghese decaduto, conosce ogni porta', zone: 'CENTRO' },
  { name: 'Bovisa Ghost', who: 'Hacker senza volto, accende i blackout', zone: 'NORD' },
  { name: 'La Sirena dei Navigli', who: 'Canta e la folla la segue in acqua' },
  { name: 'Fra\' Subwoofer', who: 'Frate francescano, benedice i bassi' },
];
export const ESTRID = {
  name: 'Regina Estrid', who: 'IA libera, a disposizione dell\'umanità',
  options: { military: 'Scudo di Estrid', trade: 'Rete di Estrid', spurn: 'Lasciala libera' },
};

// Carte polizia (le carte vichinghe): forza = unità che arrivano nell'area di allerta
export const POLICE = [
  { strength: 9, name: 'Retata' }, { strength: 10, name: 'Cani robot' }, { strength: 11, name: 'Sciame di droni' },
  { strength: 12, name: 'Sgombero' }, { strength: 12, name: 'Blindati' }, { strength: 13, name: 'Coprifuoco' },
  { strength: 14, name: 'Operazione Ordine' },
];

export const FACTIONS = ['Technoborghesi', 'Punk'];

// Glossario dei simboli (uguale per tutti i set di icone)
export const SYMBOLS = {
  T: 'Conquista il quartiere attivo',
  C: '+1 credito',
  P: 'Paga 1 credito (o perdi 2 punti)',
  M: 'Sali di 1 nell\'hype (2 crediti per ogni passo in più)',
  A: 'Neutralizza 1 unità di polizia (2 crediti per ognuna in più)',
  X: '+1 alla comunità (2 crediti per ognuno in più)',
  E: 'Espanditi in un quartiere collegato per 5 crediti',
  V: 'Rimuovi un presidio di polizia',
  R: '+1 street cred',
};
