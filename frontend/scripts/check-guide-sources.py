#!/usr/bin/env python3
"""Verify every citation in docs/GUIDES-SOURCES.json against its exact source URL.

HTML is checked with the repository enrichment checker's norm/score functions.
PDF bytes are fetched with TLS verification and converted with pdftotext first.
The URL cache is external to the repository at /tmp/captivia-guide-source-cache.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / 'docs' / 'GUIDES-SOURCES.json'
CACHE = Path('/tmp/captivia-guide-source-cache')
CHECKER_PATH = ROOT / 'backend' / 'prisma' / 'enrichment' / 'check_quotes.py'

spec = importlib.util.spec_from_file_location('enrichment_check_quotes', CHECKER_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError(f'Cannot load quote checker: {CHECKER_PATH}')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


def get_page(url: str, refresh: bool = False) -> str:
    key = hashlib.sha256(url.encode('utf-8')).hexdigest()
    CACHE.mkdir(parents=True, exist_ok=True)
    raw_path = CACHE / f'{key}.source'
    if refresh:
        raw_path.unlink(missing_ok=True)
        (CACHE / f'{key}.txt').unlink(missing_ok=True)
    if not raw_path.exists():
        request = urllib.request.Request(
            url,
            headers={'User-Agent': 'CaptiviaGuideSourceCheck/1.0 (editorial citation verification)'},
        )
        with urllib.request.urlopen(request, timeout=45) as response:
            if response.status != 200:
                raise RuntimeError(f'HTTP {response.status} for {url}')
            raw_path.write_bytes(response.read())
    raw = raw_path.read_bytes()
    if raw.startswith(b'%PDF-') or url.lower().endswith('.pdf'):
        text_path = CACHE / f'{key}.txt'
        if not text_path.exists():
            result = subprocess.run(
                ['pdftotext', '-raw', str(raw_path), str(text_path)],
                check=False, capture_output=True, text=True,
            )
            if result.returncode:
                raise RuntimeError(f'pdftotext failed for {url}: {result.stderr.strip()}')
        return checker.norm(text_path.read_text(encoding='utf-8', errors='replace'))
    return checker.norm(raw.decode('utf-8', errors='replace'))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true', help='fetch every exact URL again instead of using the local source cache')
    args = parser.parse_args()
    data = json.loads(SOURCES.read_text(encoding='utf-8'))
    # Fetch each exact source URL once; every evidence item remains tied to its own URL.
    urls = sorted({item['url'] for entries in data['categories'].values() for item in entries})
    pages: dict[str, str] = {}
    errors = 0
    for url in urls:
        try:
            pages[url] = get_page(url, refresh=args.refresh)
        except Exception as exc:  # preserve a visible error for every URL that could not load
            errors += 1
            print(f'URL ERROR\t{url}\t{exc}', file=sys.stderr)

    checked = 0
    failed = 0
    for category, entries in data['categories'].items():
        for item in entries:
            checked += 1
            url = item['url']
            page = pages.get(url)
            if page is None:
                failed += 1
                print(f'FAIL\t{category}\t{item["field"]}\tno page\t{url}')
                continue
            score, how = checker.score(item['quote'], page)
            status = 'PASS' if score == 1.0 else 'FAIL'
            if status == 'FAIL':
                failed += 1
            print(f'{status}\t{category}\t{item["field"]}\tscore={score:.2f} ({how})\t{url}')
    print(f'SUMMARY\t{checked - failed}/{checked} exact citations\t{len(urls)} unique URLs\t{errors} URL errors')
    return 1 if failed or errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
