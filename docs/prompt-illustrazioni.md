# Prompt per le illustrazioni delle carte (Nanobanana)

Come usarlo: incolla **il prompt di stile** e subito sotto **il soggetto della carta**. Genera una carta alla volta.
I prompt sono in inglese perché i modelli di immagini rendono meglio così; il soggetto è tradotto dal titolo italiano della carta.

Formato: **16:9** orizzontale (nella carta l'illustrazione è 184×104). Poi salva il file come `assets/milano/art/<numero>.png`
(storie: `1.png`…`25.png`; personaggi: `p1.png`…`p7.png` e `estrid.png`; polizia: `polizia-9.png` ecc.).

## Prompt di stile (sempre uguale)

```
Illustration in the style of the 1991 video game "Another World" (Out of This World) by Éric Chahi:
flat-shaded low-poly vector art, every shape a hard-edged polygon with a single flat color, no outlines,
no gradients, no textures, no photographic detail. Cinematic framing with rotoscoped, elongated human silhouettes,
strong directional light and large areas of flat shadow.
Setting: Milan in the year 2077, a white, clean, almost sterile cyberpunk city (Mirror's Edge mood):
pale concrete, white and light grey buildings, pale sky, with ONE saturated accent color used only on the
subject of the scene: ACCENT_COLOR. Everything else stays in whites, light greys and a few deep charcoal shadows.
Recognizable Milan touches when they fit (Navigli canals, tram wires, Duomo spires on the horizon, 1960s
apartment blocks, railway overpasses). Wide 16:9 composition, subject centered, readable at small size
(the image is printed on a playing card about 6 cm wide). No text, no letters, no logos, no frame, no border.
```

Sostituisci `ACCENT_COLOR` in base al colore della carta:

| Carta | ACCENT_COLOR |
|---|---|
| Rosse, guerriglia urbana | `signal red (#E62E2D)` |
| Blu, progetti di comunità | `bright blue (#1F8FFF)` |
| Gialle, feste clandestine | `warm yellow (#FFC20E)` |
| Grigie, Briano Borro | `signal red (#E62E2D) on a mostly black-and-white image` |
| Personaggi | `warm yellow (#FFC20E)` |
| Polizia | `signal red (#E62E2D) and police blue (#1F8FFF)` |

## Soggetti

### Rosse: guerriglia urbana
- **2 · Molotov**: `Subject: a hooded figure mid-throw, a molotov cocktail arcing over a street, the flame is the accent color.`
- **5 · Barricata**: `Subject: a barricade of tires, crowd-control barriers and traffic cones across a tram street, smoke rising.`
- **8 · Jammer anti-drone**: `Subject: a teenager raising a home-made jammer antenna, a police drone tumbling out of the sky in sparks.`
- **11 · Posto di blocco**: `Subject: a police checkpoint boom barrier snapped in half, a booth with a flashing light, figures running through.`
- **15 · Caccia al cane robot**: `Subject: a quadruped police robot dog cornered under an overpass, a targeting reticle drawn by flashlights.`
- **18 · Sciame hackerato**: `Subject: a swarm of police drones turned against their owners, controlled by a hacker with a laptop on a rooftop.`
- **24 · Blindato ribaltato**: `Subject: an armored police van overturned on its roof, small flames, a crowd silhouetted in the haze.`

### Blu: progetti di comunità
- **3 · Mensa sociale**: `Subject: a long communal table in a courtyard, steaming bowls, people of all ages sitting together.`
- **6 · Distribuzione viveri**: `Subject: volunteers handing out crates of vegetables and bread from a cargo bike.`
- **9 · Orto sul tetto**: `Subject: a rooftop vegetable garden on top of a housing block, rows of plants, a person watering.`
- **12 · Ortobonismo**: `Subject: guerrilla gardeners planting seedlings in cracks of the asphalt and in abandoned tram tracks.`
- **16 · Social rescue**: `Subject: a rescue team on an inflatable boat pulling people from a flooded Naviglio canal at night.`
- **19 · Rete di supporto**: `Subject: neighbours connected by lines of light between balconies of a ringhiera house, passing supplies.`
- **25 · Quartiere rinato**: `Subject: a once-abandoned block reborn, plants on every balcony, solar panels, kids playing in the street.`

### Gialle: feste clandestine
- **1 · Flyer clandestino**: `Subject: a hand slipping a rave flyer under a door, the flyer glowing, a long corridor of a housing block.`
- **4 · Cassa portatile**: `Subject: a lone dancer next to a huge portable sound system on a shopping cart, sound waves visible.`
- **7 · Rave sotto il cavalcavia**: `Subject: a crowd dancing under a concrete railway overpass, light beams fanning from the DJ.`
- **10 · Laser sui Navigli**: `Subject: laser beams sweeping across the Naviglio Grande at night, reflections on the water, silhouettes on the banks.`
- **14 · Trance alla Darsena**: `Subject: hypnotic concentric light circles above the Darsena basin, dancers in a trance at the water's edge.`
- **17 · Warehouse party**: `Subject: an abandoned sawtooth-roof factory, light pouring from the open door, strobes, a queue outside.`
- **23 · Alba techno**: `Subject: a huge sun rising behind the Milan skyline, the crowd raising their hands at the end of the night.`

### Grigie: la storia di Briano Borro
- **13 · Il carpentiere**: `Subject: Briano Borro as a young carpenter in a workshop, hammer and wooden beams, strong side light.`
- **20 · Il sindacalista**: `Subject: Briano Borro speaking through a megaphone to workers at a factory gate, a red flag.`
- **21 · La voce della resistenza**: `Subject: a pirate radio antenna on a rooftop at night, Briano Borro's voice spreading as red waves over the city.`
- **22 · Briano Borro**: `Subject: heroic close-up portrait of Briano Borro, middle-aged, beard, worker's cap, red scarf, looking toward the horizon.`

### Personaggi
- **Nina San Siro**: `Subject: portrait of a former football ultras leader turned bass shaman, scarf, headphones, stadium lights behind.`
- **Il Profeta di Corvetto**: `Subject: portrait of a long-haired preacher of techno on a rooftop, raising a finger, sound waves around him.`
- **Mamma Giambellino**: `Subject: portrait of a strong older woman with a ladle and a hair bun, she feeds half the neighbourhood.`
- **Conte Galleria**: `Subject: portrait of a decadent techno-bourgeois aristocrat in a top hat and monocle under the Galleria glass dome.`
- **Bovisa Ghost**: `Subject: portrait of a faceless hooded hacker, the face replaced by a glowing visor, cables and screens.`
- **La Sirena dei Navigli**: `Subject: portrait of a singer with long hair holding a microphone, standing waist-deep in the canal, the crowd following her into the water.`
- **Fra' Subwoofer**: `Subject: portrait of a Franciscan friar blessing a giant subwoofer.`
- **Regina Estrid**: `Subject: portrait of a free artificial intelligence: a crowned face made of geometric wireframe polygons, calm and benevolent, on a black background.`

### Polizia
- **9 · Retata**: `Subject: police vans with flashing lights blocking a street at night.`
- **10 · Cani robot**: `Subject: two quadruped police robot dogs patrolling a tram stop.`
- **11 · Sciame di droni**: `Subject: a swarm of police drones over a square, searchlights pointing down.`
- **12 · Sgombero**: `Subject: a line of riot police with shields advancing on an occupied building.`
- **12 · Blindati**: `Subject: armored police vehicles lined up on a ring road.`
- **13 · Coprifuoco**: `Subject: an empty street at night, a single searchlight cone from a police tower.`
- **14 · Operazione Ordine**: `Subject: a faceless riot police officer in a helmet with a mirrored visor, heroic low angle.`
