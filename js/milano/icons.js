// Icone piatte, monocromatiche (viewBox 0 0 40 40): stessi simboli della scheda abilità, linguaggio grafico Mirror's Edge.
const k = c => c; // colore passato da fuori: le icone si adattano al blocco su cui stanno

export const GLYPH = {
  // conquista la città attiva
  T: c => `<path d="M20 4a11 11 0 0 1 11 11c0 8-11 21-11 21S9 23 9 15A11 11 0 0 1 20 4Z" fill="${k(c)}"/><circle cx="20" cy="15" r="4.2" fill="var(--hole,#fff)"/>`,
  // +1 credito
  C: c => `<circle cx="20" cy="20" r="14" fill="none" stroke="${c}" stroke-width="4"/><path d="M20 13v14M13 20h14" stroke="${c}" stroke-width="4"/>`,
  // paga 1 credito
  P: c => `<circle cx="20" cy="20" r="14" fill="none" stroke="${c}" stroke-width="4"/><path d="M13 20h14" stroke="${c}" stroke-width="4"/>`,
  // avanza sul tracciato alleanze (due anelli)
  M: c => `<circle cx="15" cy="20" r="9" fill="none" stroke="${c}" stroke-width="4"/><circle cx="25" cy="20" r="9" fill="none" stroke="${c}" stroke-width="4"/>`,
  // prendi un predone
  A: c => `<path d="M8 32 25 15M22 6l12 12-6 2-8-8Z" fill="${c}" stroke="${c}" stroke-width="4" stroke-linejoin="round"/>`,
  // influenza (croce di Sant'Ambrogio)
  X: c => `<path d="M16 5h8v11h11v8H24v11h-8V24H5v-8h11Z" fill="${c}"/>`,
  // espansione: 5 crediti per una città collegata
  E: c => `<path d="M6 30 22 14M14 12h10v10" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="square"/><circle cx="30" cy="30" r="8" fill="${c}"/><text x="30" y="34" font-size="11" font-weight="800" text-anchor="middle" fill="var(--hole,#fff)" font-family="Saira, sans-serif">5</text>`,
  // rimuovi un controllo dei predoni
  V: c => `<rect x="6" y="6" width="28" height="28" fill="none" stroke="${c}" stroke-width="4"/><path d="M13 13l14 14M27 13 13 27" stroke="${c}" stroke-width="4"/>`,
  // fama
  R: c => `<path d="M20 4l4.7 10.4L36 15.6l-8.4 7.7L30 34.5 20 28.8 10 34.5l2.4-11.2L4 15.6l11.3-1.2Z" fill="${c}"/>`,
};

export const icon = (sym, size = 20, color = 'currentColor', hole = '#fff') =>
  `<svg viewBox="0 0 40 40" width="${size}" height="${size}" style="--hole:${hole}" aria-hidden="true">${GLYPH[sym](color)}</svg>`;
export const iconAt = (sym, x, y, size, color, hole = '#fff') =>
  `<g transform="translate(${x} ${y}) scale(${size / 40})" style="--hole:${hole}">${GLYPH[sym](color)}</g>`;
