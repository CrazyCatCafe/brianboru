# Genera i dati 3D di Milano per il gioco a partire da:
#   - mappa.json (pacchetto mappa Brian Boru · Milano: canvas 1100x1023, contorno del Comune)
#   - un estratto JSON di MIL.pmtiles (OpenStreetMap, schema Protomaps, zoom 14) prodotto da tools/extract-pmtiles.py
# Uscite (in assets/milano/): buildings.bin, env.json
# Uso: python3 tools/build-milano.py <mappa.json> <z14.json> <cartella-uscita>
import json, re, struct, sys, zlib
from shapely.geometry import Polygon, LineString
from shapely.prepared import prep

mappa, osm, outdir = json.load(open(sys.argv[1])), json.load(open(sys.argv[2])), sys.argv[3]
W, H, MARGIN = 1100, 1023, 60

def path_rings(d):  # "M x,y L x,y ... Z M ..." -> liste di anelli
    return [[tuple(map(float, p.split(','))) for p in re.findall(r'[-\d.]+,[-\d.]+', sub)] for sub in re.split(r'(?=M)', d) if sub.strip()]

city = max((Polygon(r) for r in path_rings(mappa['city_outline_path']) if len(r) > 3), key=lambda p: p.area).buffer(0)
city_p = prep(city)
frame = Polygon([(-MARGIN, -MARGIN), (W + MARGIN, -MARGIN), (W + MARGIN, H + MARGIN), (-MARGIN, H + MARGIN)])

def h32(s):  # FNV-1a, per altezze stabili quando OSM non le ha
    h = 2166136261
    for c in s.encode(): h = ((h ^ c) * 16777619) & 0xffffffff
    return h

def clean(ring, tol):
    p = Polygon(ring).buffer(0)
    if p.is_empty: return []
    p = p.simplify(tol, preserve_topology=True)
    parts = [p] if p.geom_type == 'Polygon' else list(getattr(p, 'geoms', []))
    return [list(q.exterior.coords)[:-1] for q in parts if q.geom_type == 'Polygon' and q.area > 0.05 and frame.intersects(q)]

# --- edifici ---
out, kept, pts = bytearray(), 0, 0
for i, b in enumerate(osm['buildings']):
    for ring in clean(b['rings'][0], 0.35):
        if Polygon(ring).area < 0.6: continue  # < ~200 m²
        cx = sum(x for x, _ in ring) / len(ring); cy = sum(y for _, y in ring) / len(ring)
        inside = city_p.contains(Polygon(ring).representative_point())
        hm = b['h'] if b['h'] else 9 + h32(f'{cx:.1f},{cy:.1f}') % 16  # 9–24 m se ignota
        flags = 1 if inside else 0
        out += struct.pack('<HBB', len(ring), min(255, int(round(hm))), flags)
        out += b''.join(struct.pack('<hh', int(round(x * 10)), int(round(y * 10))) for x, y in ring)
        kept += 1; pts += len(ring)
open(f'{outdir}/buildings.bin', 'wb').write(struct.pack('<I', kept) + out)
print('edifici', kept, 'punti', pts, 'byte', len(out), 'gzip', len(zlib.compress(bytes(out), 9)))

# --- acqua, parchi ---
rnd = lambda ring: [[round(x, 1), round(y, 1)] for x, y in ring]
water = [rnd(r) for w in osm['water'] if w['k'] in ('water', 'lake', 'basin', None) for r in clean(w['rings'][0], 0.3) if Polygon(r).area > 1.2]
NAMED = ('Naviglio Grande', 'Naviglio Pavese', 'Naviglio Martesana', 'Lambro', 'Lambro Meridionale')
rivers = {}
for w in osm['water:line']:
    if w['n'] in NAMED:
        l = LineString(w['pts']).simplify(0.4)
        if frame.intersects(l): rivers.setdefault(w['n'], []).append(rnd(l.coords))
PARK = {'park', 'garden', 'grass', 'grassland', 'meadow', 'forest', 'wood', 'cemetery', 'village_green', 'recreation_ground', 'golf_course', 'scrub'}
parks = [rnd(r) for p in osm['landuse'] if p['k'] in PARK for r in clean(p['rings'][0], 0.6) if Polygon(r).area > 6]
json.dump({'water': water, 'rivers': rivers, 'parks': parks}, open(f'{outdir}/env.json', 'w'), separators=(',', ':'))
print('acqua', len(water), 'fiumi', {k: len(v) for k, v in rivers.items()}, 'parchi', len(parks))
