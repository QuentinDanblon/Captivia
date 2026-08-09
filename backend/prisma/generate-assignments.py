#!/usr/bin/env python3
"""Génère races-assignments.json : chaque entrée reçoit un speciesId définitif.

Règles :
- Si le nom commun FR existe déjà dans SpeciesProfile -> speciesId EXISTANT (statut 'existing', à compléter).
- Sinon -> ID artificiel réservé >= 2_000_000_001 (statut 'new').
La plage 2 000 000 001+ n'est jamais attribuée par GBIF (clés <= ~3.1e8).
"""
import importlib.util
import json
import subprocess
import sys

spec = importlib.util.spec_from_file_location('rtl', 'backend/prisma/races-target-list.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

# IDs existants depuis la base
out = subprocess.run(
    ['docker', 'compose', 'exec', '-T', 'postgres', 'psql', '-U', 'user', '-d', 'captivia', '-Atc',
     'SELECT "commonNameFr", "speciesId" FROM "SpeciesProfile";'],
    capture_output=True, text=True, cwd='.'
)
existing = {}
for line in out.stdout.strip().splitlines():
    if not line:
        continue
    name, sid = line.rsplit('|', 1)
    existing[name.strip().lower()] = int(sid)

assignments = []
next_id = 2_000_000_001
used_ids = set()
for r in mod.TARGET_RACES:
    key = r['fr'].strip().lower()
    if key in existing:
        assignments.append({**r, 'speciesId': existing[key], 'status': 'existing'})
    else:
        while next_id in used_ids:
            next_id += 1
        assignments.append({**r, 'speciesId': next_id, 'status': 'new'})
        used_ids.add(next_id)
        next_id += 1

with open('backend/prisma/races-assignments.json', 'w', encoding='utf-8') as f:
    json.dump(assignments, f, ensure_ascii=False, indent=1)

from collections import Counter
print('total:', len(assignments))
print('status:', Counter(a['status'] for a in assignments))
print('next_id après allocation:', next_id)
