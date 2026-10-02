#!/usr/bin/env python3
"""Contrôle mécanique des lots G : chaque citation de verify/G*.json doit figurer dans la page source.
Usage : python3 check_quotes.py G001 [G002 ...]  ->  rapports dans $QUOTECHECK_DIR (défaut /tmp/captivia-quotecheck)."""
import json, sys, os, re, time, html, hashlib, subprocess, unicodedata, urllib.parse
BASE = os.path.dirname(os.path.abspath(__file__))
HERE = os.environ.get('QUOTECHECK_DIR', '/tmp/captivia-quotecheck')
CACHE = os.path.join(HERE, 'cache'); os.makedirs(CACHE, exist_ok=True)
UA = 'CaptiviaQuoteCheck/1.0 (editorial verification; github.com/quentindanblon)'

def fetch(url):
    key = hashlib.sha1(url.encode()).hexdigest()
    p = os.path.join(CACHE, key)
    if os.path.exists(p):
        return open(p, encoding='utf-8', errors='replace').read()
    u = urllib.parse.urlsplit(url)
    target = url
    m = re.match(r'([a-z\-]+)\.(?:m\.)?wikipedia\.org$', u.netloc)
    if m and u.path.startswith('/wiki/'):
        title = urllib.parse.quote(urllib.parse.unquote(u.path[len('/wiki/'):]), safe='/:()\',_-.')
        target = f'https://{m.group(1)}.wikipedia.org/w/index.php?title={title}&action=render&redirect=yes'
    else:
        target = urllib.parse.urlunsplit((u.scheme, u.netloc, urllib.parse.quote(urllib.parse.unquote(u.path), safe='/:()\',_-.%'), u.query, ''))
    for attempt in range(4):
        r = subprocess.run(['curl', '-sSL', '--compressed', '--max-time', '30', '-A', UA, '-w', '\n__HTTP__%{http_code}', target],
                           capture_output=True, text=True, errors='replace')
        out = r.stdout
        code = out.rsplit('__HTTP__', 1)[-1].strip() if '__HTTP__' in out else '000'
        body = out.rsplit('\n__HTTP__', 1)[0]
        if code == '429':
            time.sleep(5 * (attempt + 1)); continue
        break
    if code != '200':
        return None
    open(p, 'w', encoding='utf-8').write(body)
    time.sleep(0.7)
    return body

def norm(s):
    s = html.unescape(s)
    s = unicodedata.normalize('NFKC', s)
    s = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', s, flags=re.S | re.I)
    s = re.sub(r'<[^>]+>', ' ', s)
    s = re.sub(r'\[\s*(?:\d+|[a-z]|note \d+|réf\. nécessaire|citation needed|nb \d+)\s*\]', ' ', s, flags=re.I)
    s = s.replace('’', "'").replace('‘', "'").replace('«', '"').replace('»', '"')
    s = s.replace('“', '"').replace('”', '"').replace('–', '-').replace('—', '-').replace(' ', ' ').replace(' ', ' ')
    s = re.sub(r'[*_`]', '', s)
    s = s.lower()
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def words(s):
    return re.findall(r"[\w']+", s)

def score(quote, page):
    q = norm(quote); 
    if not q: return 0.0, 'empty'
    if q in page: return 1.0, 'exact'
    qw = words(q); pw = ' ' + ' '.join(words(page)) + ' '
    if ' ' + ' '.join(qw) + ' ' in pw: return 1.0, 'words'
    n = 4 if len(qw) >= 8 else 2 if len(qw) >= 3 else 1
    grams = [' ' + ' '.join(qw[i:i+n]) + ' ' for i in range(max(1, len(qw) - n + 1))]
    hit = sum(1 for g in grams if g in pw)
    return hit / len(grams), f'{n}-grams'

def num_in_quote(value, quote):
    nums = re.findall(r'\d+(?:[.,]\d+)?', str(value))
    if not nums: return True
    qn = set(x.replace(',', '.') for x in re.findall(r'\d+(?:[.,]\d+)?', quote.replace(' ', '').replace(' ', ' ')))
    qn |= set(x.replace(',', '.') for x in re.findall(r'\d+(?:[.,]\d+)?', re.sub(r'(?<=\d)[\s  ](?=\d{3})', '', quote)))
    return all(n.replace(',', '.') in qn for n in nums)

def main(lots):
    for lot in lots:
        data = json.load(open(f'{BASE}/verify/{lot}.json'))
        out = []; stats = {'ok': 0, 'weak': 0, 'fail': 0, 'nopage': 0, 'numMismatch': 0}
        for e in data:
            for ev in e.get('evidence', []):
                url = ev.get('url', ''); quote = ev.get('quote', '')
                page = fetch(url) if url.startswith('https://') else None
                if page is None:
                    st = 'nopage'; sc = 0.0; how = ''
                else:
                    sc, how = score(quote, norm(page))
                    st = 'ok' if sc >= 0.85 else 'weak' if sc >= 0.5 else 'fail'
                stats[st] += 1
                numok = True
                if isinstance(ev.get('value'), (int, float)) and not isinstance(ev.get('value'), bool):
                    numok = num_in_quote(ev['value'], quote)
                    if not numok: stats['numMismatch'] += 1
                out.append({'speciesId': e['speciesId'], 'field': ev.get('field'), 'status': st, 'score': round(sc, 2),
                            'how': how, 'numInQuote': numok, 'url': url, 'quote': quote[:200], 'value': ev.get('value')})
        json.dump(out, open(os.path.join(HERE, f'report-{lot}.json'), 'w'), ensure_ascii=False, indent=1)
        print(lot, stats)

if __name__ == '__main__':
    main(sys.argv[1:])
