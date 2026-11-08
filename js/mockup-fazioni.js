// Mockup delle bande: cinque fazioni animate, un presidio di polizia e un progetto urbano sulla mappa, vista ravvicinata.
import { THEME, THEME_REPLACED as REPLACED, THEME_FIREWATCH, PIXEL_SCALE } from './milano/theme.js';
import { GANGS } from './milano/lore.js';
import { createCity } from './milano/city3d.js';
import { factionFigure, policePost, communityProject, triangles } from './milano/figures.js';

const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
// ?focus=S5&d=1 inquadra da vicino un quartiere; ?clock=1 fa avanzare il tempo solo da __fx.at(ms), per le catture
let now = 0;
const view = { camera: [1.17, 1.45, 1.25], target: [1.17, 0, -0.4] };
if (q.get('focus')) {
  const mapData = await fetch('assets/milano/mappa.json').then(r => r.json()), t = mapData.towns.find(t => t.id === q.get('focus'));
  const x = (t.x - 550) / 100, z = (t.y - 511.5) / 100, d = +(q.get('d') || 1);
  Object.assign(view, { target: [x, 0.12, z], camera: [x + 0.15 * d, 0.12 + 0.5 * d, z + 0.75 * d] });
}
// ?stile=firewatch&ora=tramonto|pioggia (senza pixel); di base lo stile REPLACED attuale
const fw = q.get('stile') === 'firewatch', ora = q.get('ora') || 'tramonto';
const style = fw ? { theme: { ...THEME_FIREWATCH[ora], fog: { ...THEME_FIREWATCH[ora].fog, range: [2.6, 9] } }, pixel: 0 }
  : { theme: REPLACED, pixel: +(q.get('pixel') || PIXEL_SCALE) };
if (fw) document.body.classList.add('firewatch');
const city = await createCity($('city'), $('labels'), {
  ...style, quality: q.get('q') || 'alta', minDistance: 0.4, nearFigures: 6, ...view,
  ...(q.has('clock') ? { clock: () => now } : {}),
});
city.setWeather(q.get('meteo') || (fw ? (ora === 'pioggia' ? 'pioggia' : 'sereno') : 'nuvoloso'));
$('loading').remove();
if (q.has('clean')) document.body.classList.add('clean');
const at = id => city.towns.findIndex(t => t.id === id);
const F = city.figures;

// chi sta dove: Navigli a Sant'Ambrogio, Sciure a Porta Venezia, Monaci al Duomo (con progetto urbano), Leonka a Guastalla, Ferrovieri a Brera
const place = { S4: 0, S2: 1, S5: 2, S6: 3, S1: 4 };
const figs = Object.entries(place).map(([id, f]) => F.mount(at(id), factionFigure(f)));
const project = F.mount(at('S5'), communityProject(THEME.project));
const caught = F.mount(at('S3'), factionFigure(3)); caught.set('surrender'); // Castello: Leonka sotto presidio
let police = F.mount(at('S3'), policePost(F.badge));

$('gangs').innerHTML = GANGS.map((g, i) => `<li><i class="pd" style="--pc:${THEME.players[i]}"></i><b>${g.name}</b></li>`).join('');

const enter = () => figs.forEach((f, k) => setTimeout(() => f.set('enter'), k * 350));
const raid = () => { if (!police.obj.parent) police = F.mount(at('S3'), policePost(F.badge)); police.set('enter'); caught.set('surrender'); };
const leave = () => { police.set('leave'); setTimeout(() => caught.set('idle'), 1200); };
$('b-enter').onclick = enter; $('b-raid').onclick = raid; $('b-leave').onclick = leave;
$('b-project').onclick = () => project.set('enter');
const lvl = name => { city.setQuality(name); document.querySelectorAll('#lvl [data-q]').forEach(b => b.classList.toggle('on', b.dataset.q === name)); };
document.querySelectorAll('#lvl [data-q]').forEach(b => (b.onclick = () => lvl(b.dataset.q)));
lvl(q.get('q') || 'alta');

// per le catture automatiche
window.__fx = { freeze: city.freeze, figs, caught, get police() { return police; }, project, mount: (id, fig) => F.mount(at(id), fig), policePost: () => policePost(F.badge),
  at: ms => new Promise(r => { now = ms; requestAnimationFrame(() => requestAnimationFrame(r)); }), enter, raid, leave, project: () => project.set('enter'),
  tris: () => ({ fazioni: figs.map(f => triangles(f.obj)), polizia: triangles(police.obj), progetto: triangles(project.obj) }) };
