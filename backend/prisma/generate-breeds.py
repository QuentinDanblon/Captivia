#!/usr/bin/env python3
"""
GÉNÉRATEUR DE FICHES RACES — fusion Wikidata + templates éditoriaux.

Entrées :
  - backend/prisma/wikidata-races.json   : structure (nom, desc FR, image, masse,
    hauteur, espérance de vie, origine) pour chaque race — produit par
    wikidata-races.py
  - backend/prisma/templates/*.json      : templates éditoriaux par espèce de
    base (feeding, health, legislation, habitat, behavior, reproduction) —
    produits par les sous-agents selon templates-contract.md
  - backend/prisma/races-assignments.json : speciesId définitifs (nouveaux ≥ 2e9
    ou existants) + mapping vers breed_of / classe

Sortie :
  - backend/prisma/breeds-data.json      : fiches complètes au format d'import

Mapping race -> template : via le champ `breedClass` de Wikidata (chien/chat/
lapin/cheval/bovin/mouton/chevre/porc/poule/canard/pigeon/dindon) et le mapping
ci-dessous des espèces NAC (gecko, serpent, tortue, perruche...) vers les
templates correspondants.
"""
import json
import re
import sys
from collections import Counter

ROOT = 'backend/prisma'

# mapping breedClass Wikidata -> clé de template
BREEDCLASS_TEMPLATE = {
    'chien': 'chien', 'chat': 'chat', 'lapin': 'lapin',
    'cheval': 'cheval', 'bovin': 'bovin', 'mouton': 'mouton',
    'chevre': 'chevre', 'porc': 'porc',
    'poule': 'poule', 'canard': 'canard', 'pigeon': 'pigeon', 'dindon': 'dindon',
}

# mapping catégorie -> template par défaut si aucune correspondance plus fine
CATEGORY_TEMPLATE = {
    'mammifère': 'mammifere-nac', 'oiseau': 'oiseau-nac',
    'reptile': 'reptile-nac', 'amphibien': 'amphibien-nac',
    'poisson': 'poisson-nac', 'insecte': 'insecte-nac', 'arachnide': 'arachnide-nac',
}

# mots-clés pour mapper une race NAC vers un template spécialisé
SPECIALIZED = {
    'gecko': 'reptile-nac', 'caméléon': 'reptile-cameleon', 'iguane': 'reptile-iguane',
    'python': 'reptile-python', 'boa': 'reptile-python', 'serpent': 'reptile-serpent',
    'couleuvre': 'reptile-serpent', 'tortue': 'reptile-tortue', 'varan': 'reptile-varan',
    'agame': 'reptile-agame', 'scinque': 'reptile-agame', 'anolis': 'reptile-nac',
    'perruche': 'perruche', 'perroquet': 'oiseau-perroquet', 'ara ': 'oiseau-perroquet',
    'amazone': 'oiseau-perroquet', 'conure': 'oiseau-perroquet', 'inséparable': 'oiseau-perroquet',
    'calopsitte': 'perruche', 'canari': 'oiseau-canari', 'diamant': 'oiseau-canari',
    'mandarin': 'oiseau-canari', 'padda': 'oiseau-canari', 'bengali': 'oiseau-canari',
    'hamster': 'rongeur-hamster', 'cochon d\u2019inde': 'rongeur-cochon-inde',
    "cochon d'inde": 'rongeur-cochon-inde', 'rat ': 'rongeur-rat', 'souris': 'rongeur-rat',
    'gerbille': 'rongeur-rat', 'chinchilla': 'rongeur-chinchilla', 'octodon': 'rongeur-chinchilla',
    'écureuil': 'rongeur-rat', 'hérisson': 'mammifere-herisson', 'furet': 'mammifere-furet',
    'phasme': 'insecte-nac', 'mante': 'insecte-nac', 'blatte': 'insecte-nac',
    'mygale': 'arachnide-nac', 'scorpion': 'arachnide-nac',
    'guppy': 'poisson-nac', 'néon': 'poisson-nac', 'tétra': 'poisson-nac',
    'betta': 'poisson-nac', 'poisson rouge': 'poisson-nac', 'corydoras': 'poisson-nac',
    'scalaire': 'poisson-nac', 'discus': 'poisson-nac', 'gourami': 'poisson-nac',
    'barbus': 'poisson-nac', 'danio': 'poisson-nac', 'molly': 'poisson-nac',
    'platy': 'poisson-nac', 'xipho': 'poisson-nac', 'ancistrus': 'poisson-nac',
    'otocinclus': 'poisson-nac', 'crevette': 'poisson-nac',
    'axolotl': 'amphibien-axolotl', 'grenouille': 'amphibien-grenouille',
    'rainette': 'amphibien-grenouille', 'dendrobate': 'amphibien-grenouille',
    'triton': 'amphibien-axolotl', 'crapaud': 'amphibien-grenouille',
}


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def pick_template(name: str, breed_class: str, category: str) -> str:
    name_l = ' ' + name.lower() + ' '
    if breed_class in BREEDCLASS_TEMPLATE:
        return BREEDCLASS_TEMPLATE[breed_class]
    for kw, tmpl in SPECIALIZED.items():
        if kw in name_l:
            return tmpl
    return CATEGORY_TEMPLATE.get(category, 'mammifere-nac')


def main():
    races = load_json(f'{ROOT}/wikidata-races.json')
    assignments = load_json(f'{ROOT}/races-assignments.json')
    try:
        templates = load_json(f'{ROOT}/templates/index.json')
    except FileNotFoundError:
        print('ERREUR: templates/index.json manquant')
        sys.exit(1)

    # index templates par clé
    templates_by_key = {t['especeKey']: t for t in templates}

    # index assignments par nom normalisé
    assign_by_name = {}
    for a in assignments:
        assign_by_name[a['fr'].strip().lower()] = a

    # index wikidata par nom normalisé (prendre le plus populaire si doublon)
    wd_by_name = {}
    for r in races:
        key = r['name'].strip().lower()
        if key not in wd_by_name or r['sitelinks'] > wd_by_name[key]['sitelinks']:
            wd_by_name[key] = r

    # construire les fiches
    breeds = []
    matched = Counter()
    unmatched = []
    used_names = set()

    # 1) D'abord les races Wikidata qui matchent un assignment (les 348 ciblées)
    for r in races:
        key = r['name'].strip().lower()
        assign = assign_by_name.get(key)
        if not assign:
            continue
        tmpl_key = pick_template(r['name'], r['breedClass'], assign['class'])
        tmpl = templates_by_key.get(tmpl_key)
        if not tmpl:
            print(f'WARN: template {tmpl_key} manquant pour {r["name"]}')
            unmatched.append((r['name'], tmpl_key))
            continue
        breeds.append(build_breed(r, assign, tmpl, tmpl_key))
        used_names.add(key)
        matched['wikidata+assign'] += 1

    # 2) Ensuite les assignments restants (NAC et autres) via templates catégorie
    for a in assignments:
        key = a['fr'].strip().lower()
        if key in used_names:
            continue
        wd = wd_by_name.get(key)
        tmpl_key = pick_template(a['fr'], '', a['class'])
        tmpl = templates_by_key.get(tmpl_key)
        if not tmpl:
            print(f'WARN: template {tmpl_key} manquant pour {a["fr"]}')
            unmatched.append((a['fr'], tmpl_key))
            continue
        breeds.append(build_breed(wd, a, tmpl, tmpl_key))
        used_names.add(key)
        matched['assign-only'] += 1

    # 3) Enfin les races Wikidata sans assignment (volume 1000+) via templates
    next_id = max((a['speciesId'] or 0) for a in assignments) + 1
    for r in races:
        key = r['name'].strip().lower()
        if key in used_names:
            continue
        category = CATEGORY_FROM_BREEDCLASS.get(r['breedClass'], 'mammifère')
        tmpl_key = pick_template(r['name'], r['breedClass'], category)
        tmpl = templates_by_key.get(tmpl_key)
        if not tmpl:
            unmatched.append((r['name'], tmpl_key))
            continue
        # créer un assignment synthétique (speciesId artificiel séquentiel)
        assign = {
            'fr': r['name'], 'sci': r.get('scientificName') or '',
            'class': category, 'breed_of': BREED_OF[r['breedClass']],
            'speciesId': next_id, 'status': 'new',
        }
        # scientificName est requis : fallback sur le nom FR si Wikidata ne l'a pas
        if not assign['sci']:
            assign['sci'] = r['name']
        next_id += 1
        breeds.append(build_breed(r, assign, tmpl, tmpl_key, synthetic=True))
        used_names.add(key)
        matched['wikidata-only'] += 1

    print('=== Résumé génération ===')
    for k, v in matched.items():
        print(f'  {k}: {v}')
    print(f'  TOTAL fiches: {len(breeds)}')
    print(f'  non mappées (template manquant): {len(unmatched)}')
    for name, tmpl in unmatched[:15]:
        print(f'    - {name} -> {tmpl}')

    with open(f'{ROOT}/breeds-data.json', 'w', encoding='utf-8') as f:
        json.dump(breeds, f, ensure_ascii=False, indent=1)


CATEGORY_FROM_BREEDCLASS = {
    'chien': 'mammifère', 'chat': 'mammifère', 'lapin': 'mammifère',
    'cheval': 'mammifère', 'bovin': 'mammifère', 'mouton': 'mammifère',
    'chevre': 'mammifère', 'porc': 'mammifère',
    'poule': 'oiseau', 'canard': 'oiseau', 'pigeon': 'oiseau', 'dindon': 'oiseau',
}
BREED_OF = {
    'chien': 'Chien', 'chat': 'Chat', 'lapin': 'Lapin domestique',
    'cheval': 'Cheval', 'bovin': 'Bovin', 'mouton': 'Mouton',
    'chevre': 'Chèvre', 'porc': 'Porc',
    'poule': 'Poule', 'canard': 'Canard', 'pigeon': 'Pigeon', 'dindon': 'Dindon',
}


def capitalize_name(name: str) -> str:
    """Capitalise proprement un nom de race : première lettre de chaque mot,
    préserve les majuscules existantes (sigles) et les noms propres."""
    words = name.strip().split()
    out = []
    for w in words:
        if w.isupper() or w in ('de', 'd', 'la', 'le', 'les', 'du', 'des', 'à', 'au', 'aux', 'en', 'et', 'sur'):
            out.append(w)
        else:
            out.append(w[0].upper() + w[1:])
    return ' '.join(out)


def build_breed(wd, assign, tmpl, tmpl_key, synthetic=False):
    """Construit une fiche complète : structure Wikidata + éditorial template."""
    name = capitalize_name(wd['name'] if wd else assign['fr'])
    desc = None
    source_url = None
    if wd and wd.get('description'):
        desc = wd['description'][:500]
    if wd:
        # source Wikidata (page de la race)
        source_url = f'https://www.wikidata.org/wiki/{wd["wikidataId"]}'

    # injection des attributs Wikidata dans le template (variables)
    feeding = dict(tmpl['feeding'])
    habitat = dict(tmpl['habitat'])
    health = dict(tmpl['health'])
    behavior = dict(tmpl['behavior'])
    reproduction = dict(tmpl['reproduction'])
    legislation = dict(tmpl['legislation'])

    extra_notes = []
    if wd and wd.get('mass'):
        extra_notes.append(f"Poids moyen : {wd['mass']}")
    if wd and wd.get('height'):
        extra_notes.append(f"Hauteur au garrot : {wd['height']}")
    if wd and wd.get('lifespan'):
        extra_notes.append(f"Espérance de vie : {wd['lifespan']}")
    if wd and wd.get('origin'):
        extra_notes.append(f"Origine : {wd['origin']}")
    if extra_notes:
        base = feeding.get('specificNeeds') or ''
        feeding['specificNeeds'] = (base + ' ' + ' '.join(extra_notes)).strip()[:500]

    return {
        'speciesId': assign['speciesId'],
        'commonNameFr': name,
        'scientificName': assign['sci'] or (wd.get('scientificName') if wd else ''),
        'category': assign['class'],
        'subcategory': tmpl.get('subcategory'),
        'domesticationType': tmpl.get('domesticationType', 'domestique'),
        'description': desc,
        'sourceUrl': source_url,
        'feeding': feeding,
        'habitat': habitat,
        'behavior': behavior,
        'health': health,
        'legislation': legislation,
        'reproduction': reproduction,
        'template': tmpl_key,
    }


if __name__ == '__main__':
    main()
