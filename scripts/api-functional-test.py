#!/usr/bin/env python3
"""Captivia functional API audit - runs against http://localhost:3001"""
import json, urllib.request, urllib.error, sys, time

BASE = "http://localhost:3001"
PASS, FAIL, WARN = [], [], []

def req(method, path, body=None, token=None, ctype="application/json", timeout=20):
    url = BASE + path
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = ctype
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        t0 = time.time()
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            elapsed = time.time() - t0
            raw = resp.read().decode(errors="replace")
            try:
                j = json.loads(raw) if raw else None
            except Exception:
                j = raw[:200]
            return resp.status, j, elapsed
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            j = json.loads(raw) if raw else None
        except Exception:
            j = raw[:200]
        return e.code, j, 0
    except Exception as e:
        return None, str(e), 0

def check(name, cond, detail=""):
    (PASS if cond else FAIL).append((name, detail))
    print(f"{'OK ' if cond else 'FAIL'} {name}" + (f"  [{detail}]" if detail else ""))

def warn(name, detail=""):
    WARN.append((name, detail))
    print(f"WARN {name}" + (f"  [{detail}]" if detail else ""))

# ---------- AUTH ----------
print("\n=== AUTH ===")
s, j, _ = req("POST", "/auth/login", {"email": "test@captivia.local", "password": "Test1234!"})
check("login seed user", s == 200, f"status={s} (attendu 200, Nest renvoie 201 par defaut sur POST)")
token = j.get("accessToken") if j else None
check("login renvoie accessToken", bool(token))
me = req("GET", "/auth/me", token=token)
check("GET /auth/me", me[0] == 200 and me[1].get("email") == "test@captivia.local", str(me[0]))
s, j, _ = req("POST", "/auth/login", {"email": "test@captivia.local", "password": "WRONG"})
check("login mauvais mdp -> 401", s == 401, str(s))
email = f"audit{int(time.time())}@test.local"
s, j, _ = req("POST", "/auth/register", {"email": email, "password": "Password123!"})
check("register nouveau user", s == 201 and j.get("accessToken"), str(s))
token2 = j["accessToken"]
s, j, _ = req("POST", "/auth/register", {"email": email, "password": "Password123!"})
check("register email duplique -> 409", s == 409, str(s))
s, j, _ = req("POST", "/auth/register", {"email": "bad-email", "password": "Password123!"})
check("register email invalide -> 400", s == 400, str(s))
s, j, _ = req("POST", "/auth/register", {"email": f"x{int(time.time())}@t.local", "password": "short"})
check("register mdp < 8 -> 400", s == 400, str(s))

# ---------- PASSWORD RESET ----------
print("\n=== PASSWORD RESET ===")
s, j, _ = req("POST", "/auth/forgot-password", {"email": "test@captivia.local"})
check("forgot-password", s == 201, f"status={s} (201 par defaut POST)")
s, j, _ = req("POST", "/auth/forgot-password", {"email": "nonexistent@test.local"})
check("forgot-password email inconnu -> meme reponse (pas d'oracle)", s == 201 and "message" in (j or {}))
s, j, _ = req("POST", "/auth/reset-password", {"token": "invalide", "newPassword": "NewPass123!"})
check("reset-password token invalide -> 400", s == 400, str(s))

# ---------- SUBSCRIPTION ----------
print("\n=== SUBSCRIPTION ===")
s, j, _ = req("GET", "/users/me/subscription", token=token)
check("status abonnement (seed user)", s == 200, json.dumps(j)[:80] if j else "")
s, j, _ = req("GET", "/users/me/subscription", token=token2)
check("status abonnement (nouveau user) = non premium", s == 200 and j.get("isPremium") is False, json.dumps(j)[:60] if j else "")
s, j, _ = req("POST", "/users/me/subscription", {"plan": "monthly"}, token=token2)
check("POST subscribe (mock premium)", s == 201 and j.get("isPremium") is True, json.dumps(j)[:60] if j else "")

# ---------- ANIMALS ----------
print("\n=== ANIMALS ===")
s, j, _ = req("GET", "/users/me/animals", token=token)
check("liste animaux (seed Rango)", s == 200 and len(j) >= 1, json.dumps(j)[:80] if j else "")
rango = j[0] if (j and len(j)) else None
animal_id = rango["id"] if rango else None
s, j, _ = req("GET", f"/users/me/animals/{animal_id}", token=token)
check("detail animal", s == 200 and j.get("name") == "Rango", str(s))
s, j, _ = req("POST", "/users/me/animals", {"name": "Milo", "speciesId": 1, "sex": "male"}, token=token)
check("create animal (user premium)", s == 201, str(s))
milo_id = j.get("id") if j else None
s, j, _ = req("PATCH", f"/users/me/animals/{milo_id}", {"name": "Milo2"}, token=token)
check("update animal", s == 200 and j.get("name") == "Milo2", str(s))
s, j, _ = req("DELETE", f"/users/me/animals/{milo_id}", token=token)
check("delete animal", s == 200, str(s))
# BOLA : user2 tente d'acceder a l'animal de user1
s, j, _ = req("GET", f"/users/me/animals/{animal_id}", token=token2)
check("BOLA: acces animal d'autrui -> 403", s == 403, str(s))
# limite gratuit (user gratuit : cree un 2e animal -> 403 attendu seulement si le 1er compte est non premium)
email3 = f"free{int(time.time())}@test.local"
s, j, _ = req("POST", "/auth/register", {"email": email3, "password": "Password123!"})
token3 = j.get("accessToken")
s, j, _ = req("POST", "/users/me/animals", {"name": "Petit1", "speciesId": 1}, token=token3)
check("user gratuit: 1er animal OK", s == 201, str(s))
s, j, _ = req("POST", "/users/me/animals", {"name": "Petit2", "speciesId": 1}, token=token3)
check("user gratuit: 2e animal -> 403 (limite 1)", s == 403, str(s))

# ---------- HEALTH RECORDS ----------
print("\n=== HEALTH RECORDS ===")
s, j, _ = req("GET", f"/users/me/animals/{animal_id}/health-records", token=token2)
check("health-records list (premium)", s == 200, str(s))
s, j, _ = req("POST", f"/users/me/animals/{animal_id}/health-records", {"type": "vaccin", "title": "Rappel rage", "date": "2026-08-01", "notes": "OK"}, token=token2)
check("health-record create", s == 201, str(s))
rec_id = j.get("id") if j else None
s, j, _ = req("PATCH", f"/users/me/animals/{animal_id}/health-records/{rec_id}", {"title": "Rappel rage v2"}, token=token2)
check("health-record update", s == 200, str(s))
s, j, _ = req("DELETE", f"/users/me/animals/{animal_id}/health-records/{rec_id}", token=token2)
check("health-record delete", s == 200, str(s))
s, j, _ = req("GET", f"/users/me/animals/{animal_id}/health-records", token=token3)
check("health-records sans premium -> 403", s == 403, str(s))
s, j, _ = req("POST", f"/users/me/animals/{animal_id}/health-records", {"type": "vaccin", "title": "x"}, token=token)
check("health-record sur animal d'autrui -> 403/404", s in (403, 404), str(s))

# ---------- ROUTINES ----------
print("\n=== ROUTINES ===")
s, j, _ = req("GET", f"/users/me/animals/{animal_id}/routines", token=token)
check("routines list (seed)", s == 200, str(s))
s, j, _ = req("POST", f"/users/me/animals/{animal_id}/routines", {"name": "Nourrir", "type": "nourrissage", "frequency": "daily", "schedule": {"time": "08:00"}}, token=token)
check("routine create", s == 201, str(s))
routine_id = j.get("id") if j else None
s, j, _ = req("PATCH", f"/users/me/animals/{animal_id}/routines/{routine_id}", {"active": False}, token=token)
check("routine update", s == 200, str(s))
s, j, _ = req("POST", f"/users/me/animals/{animal_id}/history", {"type": "nourrissage", "note": "fait"}, token=token)
check("action log create", s == 201, str(s))
s, j, _ = req("GET", f"/users/me/animals/{animal_id}/history", token=token)
check("history list", s == 200 and len(j) >= 1, str(s))
s, j, _ = req("DELETE", f"/users/me/animals/{animal_id}/routines/{routine_id}", token=token)
check("routine delete", s == 200, str(s))
s, j, _ = req("GET", f"/users/me/animals/{animal_id}/routines", token=token2)
check("routines d'autrui -> 403", s == 403, str(s))

# ---------- QR / PUBLIC ----------
print("\n=== QR / PUBLIC ===")
s, j, _ = req("GET", f"/users/me/animals/{animal_id}/public-link", token=token)
check("public-link (premium)", s == 200 and j.get("slug"), json.dumps(j)[:100] if j else "")
slug = j.get("slug") if j else None
if slug:
    s, j, _ = req("GET", f"/public/animal/{slug}")
    check("page publique par slug", s == 200 and j.get("name") == "Rango", str(s))
    s, j, _ = req("GET", "/public/animal/inexistant")
    check("slug inconnu -> 404", s == 404, str(s))
s, j, _ = req("GET", f"/users/me/animals/{animal_id}/public-link", token=token3)
check("public-link sans premium -> 403", s == 403, str(s))

# ---------- SPECIES / GATEWAY ----------
print("\n=== SPECIES / GATEWAY ===")
s, j, _ = req("GET", "/species/search?q=boa&limit=5")
check("species search local", s == 200, str(s))
s, j, _ = req("GET", "/species/1")
check("species detail local", s == 200, str(s))
s, j, _ = req("GET", "/gateway/health")
check("gateway health", s == 200, json.dumps(j)[:200] if j else "")
s, j, _ = req("GET", "/gateway/search?query=boa&limit=3")
check("gateway search (GBIF+enrich)", s == 200 and (j or {}).get("results") is not None, str(s) + " /" + str(j)[:100] if j else "")
s, j, _ = req("GET", "/food/search?q=insecte")
check("food search", s == 200, str(s))
s, j, _ = req("GET", "/equipment?speciesId=1")
check("equipment list", s == 200, str(s))
s, j, _ = req("GET", "/affiliate-stores")
check("affiliate-stores", s == 200, str(s))
s, j, _ = req("GET", "/species/1/health")
check("species health content", s == 200, str(s))
s, j, _ = req("GET", "/species/1/legislation")
check("species legislation", s == 200, str(s))
s, j, _ = req("GET", "/species/search/advanced?q=boa")
check("advanced search", s in (200, 400), str(s))
s, j, _ = req("GET", "/species/search/filters")
check("search filters", s == 200, str(s))

# ---------- GRADE / NOTIFICATIONS ----------
print("\n=== GRADE / NOTIFICATIONS ===")
s, j, _ = req("GET", "/users/me/grade", token=token)
check("grade", s == 200, json.dumps(j)[:80] if j else "")
s, j, _ = req("GET", "/users/me/notification-events", token=token)
check("notification-events today", s == 200, str(s))
ev = (j or [])[0] if (j and len(j)) else None
if ev:
    s, j, _ = req("PATCH", f"/users/me/notification-events/{ev['id']}", {"status": "done"}, token=token)
    check("event done (points)", s == 200, str(s))
    s, j, _ = req("PATCH", f"/users/me/notification-events/{ev['id']}", {"status": "done"}, token=token)
    check("event done 2e fois -> null (pas de re-credit)", s == 200 and j is None, str(j)[:60] if j else "null")
s, j, _ = req("GET", "/users/me/notification-preferences", token=token)
check("notification-preferences", s == 200, str(s))
s, j, _ = req("PATCH", "/users/me/notification-preferences", {"snooze": 30}, token=token)
check("update preferences", s == 200, str(s))

# ---------- ADMIN ENDPOINTS (token gratuit) ----------
print("\n=== ENDPOINTS ADMIN (user gratuit) ===")
for p in ["/database/stats", "/errors/recent", "/monitoring/metrics", "/analytics"]:
    s, j, _ = req("GET", p, token=token3)
    print(f"  {p} -> {s}")

# ---------- RATE LIMIT ----------
print("\n=== RATE LIMIT (species) ===")
s, j, _ = req("GET", "/species/search?q=aaa")
check("rate limit: req1", s == 200, str(s))
s, j, _ = req("GET", "/species/search?q=bbb")
check("rate limit: req2", s == 200, str(s))
s, j, _ = req("POST", "/auth/login", {"email": "x@y.z", "password": "zzzzzzzz"})
check("auth sans rate limit (pas de 429 attendu ici)", s != 429, str(s))

print(f"\n===== RESULTATS : {len(PASS)} OK, {len(FAIL)} FAIL, {len(WARN)} WARN =====")
for n, d in FAIL:
    print(f"  FAIL: {n} :: {d}")
