#!/usr/bin/env python3
"""Descriptions de races depuis Wikipédia FR (API officielle), avec URL source.

Lit enrichment/in/D*.json, écrit enrichment/out/D*.json au format du contrat.
Une race n'est retenue que si le titre de la page correspond au nom de la race
et que l'introduction parle bien d'une race / d'un animal. Texte = début de
l'introduction (CC BY-SA 4.0, attribution via sourceUrl affichée par l'app).
"""
import json, glob, os, re, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request

UA = {"User-Agent": "CaptiviaBot/1.0 (contenu éditorial; contact via dépôt)"}
API = "https://fr.wikipedia.org/w/api.php?"
HERE = os.path.dirname(os.path.abspath(__file__))
KEYWORDS = ("race", "chien", "chat", "cheval", "poney", "poule", "coq", "canard", "oie", "dindon",
            "pigeon", "lapin", "mouton", "chèvre", "bovin", "vache", "porc", "cochon", "âne", "cobaye",
            "volaille", "élevage", "animal", "oiseau", "faisan", "caille", "bétail", "ovin", "caprin")

def get(params, tries=6):
    """GET poli : séquentiel, ~1 req/s, respect de Retry-After sur 429/503."""
    req = urllib.request.Request(API + urllib.parse.urlencode(params), headers=UA)
    for i in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                time.sleep(0.8)
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or i == tries - 1:
                raise
            time.sleep(min(60, int(e.headers.get("Retry-After") or 0) or 5 * (i + 1)))

def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def trim(text, limit=500):
    sents = re.split(r"(?<=[.!?])\s+", text.strip())
    out = ""
    for s in sents:
        if len(out) + len(s) + 1 > limit:
            break
        out = (out + " " + s).strip()
    return out or None

def find(b):
    name = b["commonNameFr"].strip()
    for q in (name, f"{name} race"):
        res = get({"action": "query", "generator": "search", "gsrsearch": q, "gsrlimit": 5,
                   "prop": "extracts|info", "exintro": 1, "explaintext": 1, "exlimit": 5,
                   "redirects": 1, "inprop": "url", "format": "json"})
        pages = sorted(res.get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
        for page in pages:
            base = re.sub(r"\s*\(.*\)$", "", page["title"])
            if norm(base) != norm(name):
                continue
            extract = (page.get("extract") or "").replace("\n", " ").strip()
            low = extract.lower()
            if len(extract) < 80 or "homonymie" in low or not any(k in low for k in KEYWORDS):
                continue
            desc = trim(extract)
            if desc:
                return {"speciesId": b["speciesId"], "description": desc, "sourceUrl": page["fullurl"]}
    return {"speciesId": b["speciesId"], "description": None, "sourceUrl": None}

def safe_find(b):
    try:
        return find(b)
    except Exception as e:  # réseau : on n'invente rien
        print(f"  ! {b['commonNameFr']}: {e}", file=sys.stderr)
        return {"speciesId": b["speciesId"], "description": None, "sourceUrl": None}

total = found = 0
for path in sorted(glob.glob(os.path.join(HERE, "in", "D*.json"))):
    lot = json.load(open(path))
    res = [safe_find(b) for b in lot]
    json.dump(res, open(os.path.join(HERE, "out", os.path.basename(path)), "w"), ensure_ascii=False, indent=1)
    total += len(res); found += sum(1 for r in res if r["description"])
    print(os.path.basename(path), sum(1 for r in res if r["description"]), "/", len(res), flush=True)
print(f"TOTAL {found}/{total}")
