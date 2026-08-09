#!/usr/bin/env python3
"""Propagate new i18n key blocks to all Captivia locales (fr/en/de/es/it/pt).

Usage: python scripts/i18n_propagate.py <new_keys.json>

new_keys.json shape (values = FR placeholder texts, same for every locale):
  {"animals": {"measurements": {"title": "Poids & mesures", ...}, ...}}

Behavior: merges the blocks into each locale file (existing keys preserved),
sorts all keys recursively, writes indent 2 + CRLF line endings (repo
convention — plain open(...,'w') would silently convert CRLF->LF and create
whole-file diffs). Prints one line per updated locale.
"""
import json
import os
import sys

BASE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'messages'))
LOCALES = ['fr', 'en', 'de', 'es', 'it', 'pt']


def sort_dict(d):
    return {k: sort_dict(v) if isinstance(v, dict) else v for k, v in sorted(d.items())}


def merge(target, patch):
    for k, v in patch.items():
        if isinstance(v, dict) and isinstance(target.get(k), dict):
            merge(target[k], v)
        else:
            target[k] = dict(v) if isinstance(v, dict) else v


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    with open(sys.argv[1], encoding='utf-8') as f:
        new_keys = json.load(f)
    for loc in LOCALES:
        path = os.path.join(BASE, f'{loc}.json')
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        merge(data, new_keys)
        raw = json.dumps(sort_dict(data), ensure_ascii=False, indent=2).replace('\n', '\r\n') + '\r\n'
        with open(path, 'w', encoding='utf-8', newline='') as f:
            f.write(raw)
        print(f'{loc}.json updated')


if __name__ == '__main__':
    main()
