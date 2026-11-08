// Quattro set di icone per gli stessi 9 simboli (viewBox 0 0 40 40). Il set attivo si cambia con setIconSet().
// T quartiere · C +credito · P -credito · M hype · A polizia · X comunità · E espansione · V presidio · R street cred
const st = (c, w = 3.5) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const H = 'var(--hole,#fff)';

const PATH = {
  pin: 'M20 37S8 25 8 15a12 12 0 0 1 24 0c0 10-12 22-12 22Z',
  speaker: 'M5 15h7l9-7v24l-9-7H5Z',
  bottle: 'M17 13h6v4l4 5v14H13V22l4-5Z',
  flame: 'M20 1c4 3 5 6 1 9-3-1-4-4-1-9Z',
  leafL: 'M20 24C11 24 7 18 7 11c8 0 13 5 13 13Z',
  leafR: 'M20 19c0-8 5-13 13-13 0 8-5 13-13 13Z',
  shield: 'M20 3l13 5v11c0 9-6 15-13 18C13 34 7 28 7 19V8Z',
  star: 'M20 3l5 10.5 11.5 1.6-8.3 8 2 11.4L20 29l-10.2 5.5 2-11.4-8.3-8 11.5-1.6Z',
};

const LINE = {
  T: c => `<path d="${PATH.pin}" ${st(c)}/><circle cx="20" cy="15" r="4" ${st(c)}/>`,
  C: c => `<circle cx="20" cy="20" r="14" ${st(c)}/><path d="M20 13v14M13 20h14" ${st(c)}/>`,
  P: c => `<circle cx="20" cy="20" r="14" ${st(c)}/><path d="M13 20h14" ${st(c)}/>`,
  M: c => `<path d="${PATH.speaker}" ${st(c)}/><path d="M26 15a7 7 0 0 1 0 10M30 11a13 13 0 0 1 0 18" ${st(c)}/>`,
  A: c => `<path d="${PATH.bottle}" ${st(c)}/><path d="${PATH.flame}" fill="${c}"/>`,
  X: c => `<path d="M20 37V19" ${st(c)}/><path d="${PATH.leafL}" ${st(c)}/><path d="${PATH.leafR}" ${st(c)}/>`,
  E: c => `<path d="M7 33 27 13M15 12h13v13" ${st(c)}/>`,
  V: c => `<path d="${PATH.shield}" ${st(c)}/><path d="M9 33 31 7" ${st(c)}/>`,
  R: c => `<path d="${PATH.star}" ${st(c)}/>`,
};

const SOLID = {
  T: c => `<path d="${PATH.pin}" fill="${c}"/><circle cx="20" cy="15" r="4.5" fill="${H}"/>`,
  C: c => `<circle cx="20" cy="20" r="16" fill="${c}"/><path d="M20 12v16M12 20h16" stroke="${H}" stroke-width="4.5"/>`,
  P: c => `<circle cx="20" cy="20" r="16" fill="${c}"/><path d="M12 20h16" stroke="${H}" stroke-width="4.5"/>`,
  M: c => `<path d="${PATH.speaker}" fill="${c}"/><path d="M26 14a8 8 0 0 1 0 12M31 9a15 15 0 0 1 0 22" ${st(c, 4.5)}/>`,
  A: c => `<path d="${PATH.bottle}" fill="${c}"/><path d="${PATH.flame}" fill="${c}"/><path d="M15 26h10" stroke="${H}" stroke-width="3"/>`,
  X: c => `<path d="M20 37V19" stroke="${c}" stroke-width="5"/><path d="${PATH.leafL}" fill="${c}"/><path d="${PATH.leafR}" fill="${c}"/>`,
  E: c => `<path d="M5 31 21 15h-8V7h20v20h-8v-8L11 35Z" fill="${c}"/>`,
  V: c => `<path d="${PATH.shield}" fill="${c}"/><path d="M12 30 28 10" stroke="${H}" stroke-width="4.5" stroke-linecap="round"/>`,
  R: c => `<path d="${PATH.star}" fill="${c}"/>`,
};

const dots = (c, pts) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${c}"/>`).join('');
const cs = c => `fill="none" stroke="${c}" stroke-width="2.6" stroke-linejoin="miter" stroke-linecap="square"`;
const OCT = 'M14 6h12l8 8v12l-8 8H14l-8-8V14Z';
const CIRCUIT = {
  T: c => `<path d="M20 4 31 15 20 28 9 15Z" ${cs(c)}/><path d="M20 28v6" ${cs(c)}/>${dots(c, [[20, 15], [20, 36]])}`,
  C: c => `<path d="${OCT}" ${cs(c)}/><path d="M20 14v12M14 20h12" ${cs(c)}/>${dots(c, [[20, 13], [20, 27], [13, 20], [27, 20]])}`,
  P: c => `<path d="${OCT}" ${cs(c)}/><path d="M14 20h12" ${cs(c)}/>${dots(c, [[13, 20], [27, 20]])}`,
  M: c => `<path d="M4 15h7l9-7v24l-9-7H4Z" ${cs(c)}/><path d="M25 14l5 6-5 6M30 9l8 11-8 11" ${cs(c)}/>${dots(c, [[25, 14], [25, 26]])}`,
  A: c => `<path d="M17 14h6v4l4 5v13H13V23l4-5Z" ${cs(c)}/><path d="M20 2l3 4-3 3 1 3" ${cs(c)}/>${dots(c, [[20, 29]])}`,
  X: c => `<path d="M20 37V21M20 28 11 19v-7M20 23l9-9V7" ${cs(c)}/>${dots(c, [[11, 11], [29, 6], [20, 20], [20, 37]])}`,
  E: c => `<path d="M7 33 17 23h8v-8l7-7M25 8h7v7" ${cs(c)}/>${dots(c, [[7, 33], [17, 23]])}`,
  V: c => `<path d="M20 4l13 5v11L20 36 7 20V9Z" ${cs(c)}/><path d="M11 31 29 9" ${cs(c)}/>${dots(c, [[20, 20]])}`,
  R: c => `<path d="${PATH.star}" ${cs(c)}/>${dots(c, [[20, 19]])}`,
};

// Pixel: bitmap 10x10, una cella = 4 unità
const BITMAP = {
  T: ['...####...', '..######..', '.###..###.', '.##....##.', '.###..###.', '..######..', '...####...', '....##....', '....##....', '....#.....'],
  C: ['..######..', '.##....##.', '##..##..##', '#...##...#', '#.######.#', '#.######.#', '#...##...#', '##..##..##', '.##....##.', '..######..'],
  P: ['..######..', '.##....##.', '##......##', '#........#', '#.######.#', '#.######.#', '#........#', '##......##', '.##....##.', '..######..'],
  M: ['...##.....', '..###..#..', '####.#..#.', '####..#.#.', '####..#..#', '####..#..#', '####..#.#.', '####.#..#.', '..###..#..', '...##.....'],
  A: ['.....#....', '....##....', '.....#....', '....##....', '...####...', '..######..', '..######..', '..#....#..', '..######..', '...####...'],
  X: ['##......##', '###....###', '.###..###.', '..##..##..', '...####...', '....##....', '....##....', '....##....', '..######..', '..######..'],
  E: ['....######', '.......###', '......####', '.....###.#', '....###...', '...###....', '..###.....', '.###......', '###.......', '##........'],
  V: ['.########.', '.#......#.', '.#.#..#.#.', '.#..##..#.', '.#..##..#.', '.#.#..#.#.', '..#....#..', '...#..#...', '....##....', '..........'],
  R: ['....##....', '....##....', '...####...', '##########', '.########.', '..######..', '..######..', '.###..###.', '.##....##.', '##......##'],
};
const PIXEL = Object.fromEntries(Object.entries(BITMAP).map(([k, rows]) => [k, c =>
  rows.flatMap((r, y) => [...r].map((ch, x) => (ch === '#' ? `<rect x="${x * 4}" y="${y * 4}" width="4.2" height="4.2" fill="${c}"/>` : ''))).join('')]));

export const ICON_SETS = {
  linea: { name: 'Linea', glyph: LINE },
  pieno: { name: 'Pieno', glyph: SOLID },
  pixel: { name: 'Pixel', glyph: PIXEL },
  circuito: { name: 'Circuito', glyph: CIRCUIT },
};
let current = 'pieno';
export const setIconSet = name => { if (ICON_SETS[name]) current = name; };
export const iconSet = () => current;

// Il "5" dell'espansione è comune a tutti i set
const five = (c, hole) => `<circle cx="32" cy="32" r="8" fill="${c}"/><text x="32" y="36" font-size="11" font-weight="800" text-anchor="middle" fill="${hole}" font-family="Saira, sans-serif">5</text>`;
const body = (sym, c, hole) => ICON_SETS[current].glyph[sym](c) + (sym === 'E' ? five(c, hole) : '');

export const icon = (sym, size = 20, color = 'currentColor', hole = '#fff') =>
  `<svg viewBox="0 0 40 40" width="${size}" height="${size}" style="--hole:${hole}" aria-hidden="true">${body(sym, color, hole)}</svg>`;
export const iconAt = (sym, x, y, size, color, hole = '#fff') =>
  `<g transform="translate(${x} ${y}) scale(${size / 40})" style="--hole:${hole}">${body(sym, color, hole)}</g>`;
