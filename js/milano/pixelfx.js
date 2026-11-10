// Effetto "sgretolamento": la scritta vecchia si sbriciola in pixel che cadono, quella nuova si ricompone dai pixel.
// Disegna su un canvas sopra l'elemento; intanto l'elemento vero resta nascosto con la classe `hideCls` sul body.
const P = 3; // lato di un pixel della scritta (px CSS)
const live = new Map(); // un effetto alla volta per ogni scritta: quello nuovo sostituisce il precedente

function points(text, font, spacing, w, h, dpr) {
  const c = document.createElement('canvas'); c.width = w * dpr; c.height = h * dpr;
  const g = c.getContext('2d'); g.scale(dpr, dpr); g.font = font; g.letterSpacing = spacing; g.textBaseline = 'middle'; g.fillStyle = '#000';
  g.fillText(text, 0, h / 2);
  const data = g.getImageData(0, 0, c.width, c.height).data, out = [];
  for (let y = 0; y < h; y += P) for (let x = 0; x < w; x += P) if (data[((Math.floor((y + P / 2) * dpr)) * c.width + Math.floor((x + P / 2) * dpr)) * 4 + 3] > 110) out.push([x, y]);
  return out;
}

export function pixelSwap(el, fromText, { hideCls = 'pxswap', dur = 900 } = {}) {
  const toText = el?.textContent?.trim();
  if (!el || !fromText || !toText || fromText === toText || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = el.getBoundingClientRect(); if (!r.width) return;
  const cs = getComputedStyle(el), up = t => (cs.textTransform === 'uppercase' ? t.toUpperCase() : t);
  const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, pad = 60, w = Math.ceil(Math.max(r.width, 40)) + pad * 2, h = Math.ceil(r.height) + pad * 2, dpr = devicePixelRatio || 1;
  const textH = Math.ceil(r.height), tw = w - pad * 2;
  const from = points(up(fromText), font, cs.letterSpacing, tw, textH, dpr), to = points(up(toText), font, cs.letterSpacing, tw, textH, dpr);
  const cv = document.createElement('canvas'); cv.width = w * dpr; cv.height = h * dpr;
  Object.assign(cv.style, { position: 'fixed', left: r.left - pad + 'px', top: r.top - pad + 'px', width: w + 'px', height: h + 'px', pointerEvents: 'none', zIndex: 30 });
  live.get(hideCls)?.remove(); live.set(hideCls, cv);
  document.body.appendChild(cv); document.body.classList.add(hideCls);
  const g = cv.getContext('2d'); g.scale(dpr, dpr); g.fillStyle = cs.color;
  const rnd = (a, b) => a + Math.random() * (b - a), span = Math.max(1, tw);
  const fall = from.map(([x, y]) => ({ x: x + pad, y: y + pad, vx: rnd(-40, 40), vy: rnd(-60, 10), d: (x / span) * 0.35 })); // si sbriciola da sinistra a destra
  const rise = to.map(([x, y]) => ({ x: x + pad, y: y + pad, sx: x + pad + rnd(-50, 50), sy: y + pad + rnd(-45, 45), d: 0.35 + (x / span) * 0.3 }));
  const t0 = performance.now(), ease = t => 1 - (1 - t) ** 3;
  (function frame(now) {
    const t = (now - t0) / dur; g.clearRect(0, 0, w, h);
    for (const p of fall) { const k = Math.min(1, Math.max(0, (t - p.d) / 0.3)); if (k >= 1) continue; g.globalAlpha = 1 - k; g.fillRect(p.x + p.vx * k, p.y + p.vy * k + 140 * k * k, P, P); }
    for (const p of rise) { const k = Math.min(1, Math.max(0, (t - p.d) / 0.35)); if (k <= 0) continue; const e = ease(k); g.globalAlpha = Math.min(1, k * 2); g.fillRect(p.sx + (p.x - p.sx) * e, p.sy + (p.y - p.sy) * e, P, P); }
    if (live.get(hideCls) !== cv) return; // sostituito da un effetto più nuovo
    if (t < 1) requestAnimationFrame(frame);
    else { cv.remove(); live.delete(hideCls); document.body.classList.remove(hideCls); }
  })(t0);
}
