#!/usr/bin/env python3
"""Collecte les templates éditoriaux produits par les sous-agents et construit
templates/index.json (format attendu par generate-breeds.py)."""
import json
import os
import re
import sys

ROOT = 'backend/prisma/templates'
os.makedirs(ROOT, exist_ok=True)

REQUIRED_TOP = ['feeding', 'habitat', 'behavior', 'health', 'legislation', 'reproduction']

if __name__ == '__main__':
    templates = []
    errors = []
    for fname in sorted(os.listdir(ROOT)):
        if not fname.startswith('template-') or not fname.endswith('.json'):
            continue
        path = os.path.join(ROOT, fname)
        try:
            with open(path, encoding='utf-8') as f:
                t = json.load(f)
        except json.JSONDecodeError as e:
            errors.append(f'{fname}: JSON invalide — {e}')
            continue
        # validation
        key = t.get('especeKey')
        if not key:
            errors.append(f'{fname}: champ especeKey manquant')
            continue
        missing = [s for s in REQUIRED_TOP if not t.get(s)]
        if missing:
            errors.append(f'{fname}: sections manquantes {missing}')
            continue
        # sources présentes ?
        no_src = [s for s in REQUIRED_TOP if not t[s].get('sources')]
        if no_src:
            errors.append(f'{fname}: sections sans sources {no_src}')
            continue
        templates.append(t)
    if errors:
        print('ERREURS:')
        for e in errors:
            print('  -', e)
        sys.exit(1)
    with open(os.path.join(ROOT, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(templates, f, ensure_ascii=False, indent=1)
    print(f'OK: {len(templates)} templates collectés dans index.json')
    for t in templates:
        print(f"  - {t['especeKey']}: {t.get('espece')} (sections OK, sources OK)")
