#!/usr/bin/env python3
"""
PIPELINE RACES v3 — Wikidata SPARQL, toutes catégories, trié par popularité.

Classes Wikidata (races) par catégorie Captivia (page d'accueil) :
  mammifère : chien Q39367, chat Q123588392, lapin Q12045584, cheval Q1160573,
              bovin Q12045585, mouton Q15622363, chèvre Q15622387, porc Q18786396
  oiseau    : poule Q15304943, pigeon Q15623573, canard Q110536225, dindon Q110529992
  (reptiles/amphibiens/poissons/insectes/arachnides = espèces, pas races :
   déjà couvertes par les 296 profils existants + pipeline GBIF)

Popularité : `?item wikibase:sitelinks ?sl` trié DESC — proxy fiable des races
les plus courantes (le top N par classe = races réellement répandues en Europe).

Usage : python prisma/wikidata-races.py --top 120:60:40:40:60:50:60:30:20:30:50:15
       (ordre : chien, chat, lapin, cheval, bovin, mouton, chèvre, porc,
        poule, canard, pigeon, dindon)
"""
import argparse
import json
import time
import urllib.parse
import urllib.request

UA = 'Captivia/1.0 (https://captivia.com; pipeline races v3)'
SPARQL = 'https://query.wikidata.org/sparql'

CLASSES = [
    # (clé, label FR, classe Wikidata, top N)
    ('chien', 'Chien', 'Q39367', 120),
    ('chat', 'Chat', 'Q123588392', 60),
    ('lapin', 'Lapin', 'Q12045584', 40),
    ('cheval', 'Cheval', 'Q1160573', 40),
    ('bovin', 'Bovin', 'Q12045585', 60),
    ('mouton', 'Mouton', 'Q15622363', 50),
    ('chevre', 'Chèvre', 'Q15622387', 30),
    ('porc', 'Porc', 'Q18786396', 20),
    ('poule', 'Poule', 'Q15304943', 60),
    ('canard', 'Canard', 'Q110536225', 30),
    ('pigeon', 'Pigeon', 'Q15623573', 50),
    ('dindon', 'Dindon', 'Q110529992', 15),
]

QUERY = """
SELECT ?item ?itemLabel ?desc ?image ?sci ?mass ?height ?lifespan ?origin ?originLabel ?sl WHERE {{
  {{
    SELECT ?item ?sl WHERE {{
      ?item wdt:P31 wd:{cls}.
      ?item wikibase:sitelinks ?sl.
    }} ORDER BY DESC(?sl) LIMIT {top}
  }}
  OPTIONAL {{ ?item wdt:P18 ?image. }}
  OPTIONAL {{ ?item wdt:P225 ?sci. }}
  OPTIONAL {{ ?item wdt:P2067 ?mass. }}
  OPTIONAL {{ ?item wdt:P2048 ?height. }}
  OPTIONAL {{ ?item wdt:P2250 ?lifespan. }}
  OPTIONAL {{ ?item wdt:P495 ?origin. }}
  OPTIONAL {{ ?item schema:description ?desc. FILTER(LANG(?desc) = "fr") }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "fr,en". }}
}}
"""


def sparql(query: str, retries: int = 6) -> dict:
    url = SPARQL + '?' + urllib.parse.urlencode({'query': query})
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                'Accept': 'application/sparql-results+json',
                'User-Agent': UA,
            })
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except Exception as e:
            print(f'  [sparql retry {attempt + 1}] {e}')
            time.sleep(8)
    raise RuntimeError('SPARQL query failed after retries')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='backend/prisma/wikidata-races.json')
    ap.add_argument('--top', default=None,
                    help='Limites par classe, séparées par ":" (sinon défauts)')
    args = ap.parse_args()

    tops = [int(x) for x in args.top.split(':')] if args.top else None
    classes = []
    for i, (key, label, cls, default_top) in enumerate(CLASSES):
        top = tops[i] if tops else default_top
        classes.append((key, label, cls, top))

    all_races = {}
    for key, label, cls, top in classes:
        print(f'== {label} (classe {cls}, top {top})')
        data = sparql(QUERY.format(cls=cls, top=top))
        bindings = data['results']['bindings']
        print(f'   {len(bindings)} résultats')
        for b in bindings:
            item = b['item']['value'].rsplit('/', 1)[-1]
            name = b.get('itemLabel', {}).get('value', '')
            # Ignorer les lexèmes (labels "L...-S...") et les entités sans label
            if not name or name.startswith('L') and '-' in name and len(name) < 12:
                continue
            all_races[item] = {
                'wikidataId': item,
                'name': name,
                'description': b.get('desc', {}).get('value'),
                'image': b.get('image', {}).get('value'),
                'scientificName': b.get('sci', {}).get('value'),
                'mass': b.get('mass', {}).get('value'),
                'height': b.get('height', {}).get('value'),
                'lifespan': b.get('lifespan', {}).get('value'),
                'origin': b.get('originLabel', {}).get('value'),
                'breedClass': key,
                'sitelinks': int(b.get('sl', {}).get('value', 0)),
            }
        time.sleep(5)

    print(f'Total unique: {len(all_races)}')
    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(list(all_races.values()), f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
