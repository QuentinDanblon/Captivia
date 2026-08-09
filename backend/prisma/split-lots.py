#!/usr/bin/env python3
"""Découpe races-assignments.json en lots de N races pour les sous-agents."""
import json
import os
import sys

N = int(sys.argv[1]) if len(sys.argv) > 1 else 15
OUT_DIR = 'backend/prisma/races-lots'
os.makedirs(OUT_DIR, exist_ok=True)

with open('backend/prisma/races-assignments.json', encoding='utf-8') as f:
    races = json.load(f)

# Équilibrer : mélanger les statuts pour que chaque lot ait un mix new/existing
new = [r for r in races if r['status'] == 'new']
existing = [r for r in races if r['status'] == 'existing']
# Répartir : chaque lot prend ~N races en alternant
lots = []
i = j = 0
total = len(races)
while len(lots) * N < total:
    lot = []
    while len(lot) < N and (i < len(new) or j < len(existing)):
        if i < len(new) and (j >= len(existing) or i * len(existing) <= j * len(new)):
            lot.append(new[i]); i += 1
        elif j < len(existing):
            lot.append(existing[j]); j += 1
    if lot:
        lots.append(lot)

for idx, lot in enumerate(lots, 1):
    path = os.path.join(OUT_DIR, f'lot-{idx:02d}.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(lot, f, ensure_ascii=False, indent=1)
    print(f'lot-{idx:02d}: {len(lot)} races ({sum(1 for r in lot if r["status"]=="new")} new / {sum(1 for r in lot if r["status"]=="existing")} existing)')

print(f'total lots: {len(lots)}')
