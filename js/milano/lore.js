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

// Le cinque bande giocabili, una per colore dei giocatori (THEME.players, stesso ordine). Solo ambientazione: le regole non cambiano.
export const GANGS = [
  { key: 'navigli', name: 'I Navigli Rossi', short: 'Navigli Rossi', side: 'Punk', home: 'Darsena e Navigli',
    who: 'Barcaioli e contrabbandieri della Darsena: impermeabili lunghi, pertiche e lanterne arancioni sull\'acqua nera.', sign: 'la lanterna' },
  { key: 'sciure', name: 'Le Sciure di Porta Venezia', short: 'Sciure', side: 'Technoborghesi', home: 'Porta Venezia',
    who: 'Liberty e moda: cappotti a campana, cappelli a tesa larga, visiere luminose e un cane robot sempre al guinzaglio.', sign: 'la visiera' },
  { key: 'monaci', name: 'I Monaci del Duomo', short: 'Monaci del Duomo', side: 'Technoborghesi', home: 'Duomo',
    who: 'Ordine tecno-religioso della Veneranda Fabbrica: restaurano la città coi droni, cappucci a guglia e un drone per aureola.', sign: 'il drone-aureola' },
  { key: 'leonka', name: 'La Banda del Leonka', short: 'Leonka', side: 'Punk', home: 'Lambrate e centri sociali',
    who: 'Centri sociali e sound system: creste luminose, giubbotti di pelle con le toppe, una cassa a tracolla che non si spegne mai.', sign: 'la cresta' },
  { key: 'ferrovieri', name: 'I Ferrovieri di Greco', short: 'Ferrovieri', side: 'Punk', home: 'Scali di Greco e cavalcavia',
    who: 'Gente degli scali e dei cavalcavia, eredi di Briano Borro: tute da lavoro, casco con la lampada frontale, chiave inglese in spalla.', sign: 'la lampada frontale' },
];
export const POLICE_POST = { name: 'Presidio di polizia', who: 'Agenti antisommossa con visiera a specchio, barricate modulari, droni di scansione e cani robot di pattuglia.' };
export const PROJECT = { name: 'Progetto urbano', who: 'Orti in cassetta, un gazebo con le lucine, un pannello solare e volontari con l\'annaffiatoio: il quartiere conta doppio.' };

// Glossario dei simboli (uguale per tutti i set di icone)
export const SYMBOLS = {
  T: 'Conquista il quartiere attivo',
  C: '+1 credito',
  P: 'Paga 1 credito (o perdi 2 punti)',
  M: 'Sali di 1 nell\'hype (2 crediti per ogni passo in più)',
  A: 'Neutralizza 1 unità di polizia',
  X: '+1 alla comunità',
  E: 'Espanditi in un quartiere collegato per 5 crediti',
  V: 'Rimuovi un presidio di polizia',
  R: '+1 street cred',
};

// motti delle cinque fazioni (schermata prepartita)
export const FACTION_MOTTO = {
  Technoborghesi: 'Il futuro è nostro: l\'abbiamo comprato.',
  Punk: 'Niente padroni, niente futuro, niente paura.',
  'Partite Iva': 'Fattura alla mano, barricata in spalla.',
  Startuppers: 'Disrupt the block.',
  'Le Sciure': 'Il quartiere lo conosciamo da sessant\'anni.',
};
