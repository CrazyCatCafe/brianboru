# Estrae da MIL.pmtiles (OSM, schema Protomaps) edifici, acqua e parchi nell'area del tabellone Milano,
# convertiti nelle coordinate del canvas 1100x1023 di mappa.json.
import math, json, sys, struct, gzip, collections
from pmtiles.reader import Reader, MmapSource
import mapbox_vector_tile as mvt

Z = int(sys.argv[2]) if len(sys.argv) > 2 else 14
LON0, LON1, LAT0, LAT1 = 9.040955, 9.278325, 45.386054, 45.535273  # bbox del Comune (zone.geojson)
X0, X1, Y0, Y1 = 40.0, 1060.0, 70.0, 983.2                           # stesso bbox nel canvas
def to_canvas(lon, lat): return (X0 + (lon - LON0) / (LON1 - LON0) * (X1 - X0), Y0 + (LAT1 - lat) / (LAT1 - LAT0) * (Y1 - Y0))
def to_lonlat(x, y): return (LON0 + (x - X0) / (X1 - X0) * (LON1 - LON0), LAT1 - (y - Y0) / (Y1 - Y0) * (LAT1 - LAT0))
# area del canvas con un margine per l'hinterland
MARGIN = 60
lonA, latA = to_lonlat(-MARGIN, 1023 + MARGIN); lonB, latB = to_lonlat(1100 + MARGIN, -MARGIN)
def tile_xy(lon, lat, z):
    n = 2 ** z
    return int((lon + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
def tile_lonlat(x, y, z):
    n = 2 ** z
    return x / n * 360 - 180, math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
tx0, ty0 = tile_xy(lonA, latB, Z); tx1, ty1 = tile_xy(lonB, latA, Z)
f = open(sys.argv[1], 'rb'); r = Reader(MmapSource(f))
out = collections.defaultdict(list); kinds = collections.Counter()
for tx in range(tx0, tx1 + 1):
    for ty in range(ty0, ty1 + 1):
        data = r.get(Z, tx, ty)
        if not data: continue
        try: data = gzip.decompress(data)
        except OSError: pass
        lonW, latN = tile_lonlat(tx, ty, Z); lonE, latS = tile_lonlat(tx + 1, ty + 1, Z)
        layers = mvt.decode(data, default_options={'y_coord_down': True})
        for name, layer in layers.items():
            ext = layer.get('extent', 4096)
            for feat in layer['features']:
                g, p = feat['geometry'], feat['properties']
                kinds[(name, g['type'], p.get('kind'))] += 1
                def conv(ring):
                    res = []
                    for x, y in ring:
                        lon = lonW + x / ext * (lonE - lonW)
                        # y in Mercator lineare dentro la tile: interpolo in Mercator
                        my0 = math.asinh(math.tan(math.radians(latN))); my1 = math.asinh(math.tan(math.radians(latS)))
                        lat = math.degrees(math.atan(math.sinh(my0 + y / ext * (my1 - my0))))
                        cx, cy = to_canvas(lon, lat); res.append((round(cx, 1), round(cy, 1)))
                    return res
                polys = []
                if g['type'] == 'Polygon': polys = [g['coordinates']]
                elif g['type'] == 'MultiPolygon': polys = g['coordinates']
                elif g['type'] in ('LineString', 'MultiLineString'):
                    lines = [g['coordinates']] if g['type'] == 'LineString' else g['coordinates']
                    for l in lines: out[name + ':line'].append({'k': p.get('kind'), 'n': p.get('name'), 'pts': conv(l)})
                    continue
                for poly in polys:
                    out[name].append({'k': p.get('kind'), 'n': p.get('name'), 'h': p.get('height'), 'mh': p.get('min_height'), 'rings': [conv(rg) for rg in poly]})
json.dump(out, open(sys.argv[3], 'w'))
for k, v in sorted(kinds.items(), key=lambda kv: -kv[1])[:60]: print(v, k)
print({k: len(v) for k, v in out.items()})
