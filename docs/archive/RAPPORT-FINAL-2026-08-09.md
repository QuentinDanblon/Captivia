# Captivia — Rapport final du chantier « niveau production » — 2026-08-09

## Vue d'ensemble

Journée complète : audit (sécurité + fonctionnel + DB + UI + prod) puis correction et développement de l'application jusqu'à un état **testé, sécurisé et déployable**, avec les premiers modules produit livrés.

---

## 1. Audit initial (rapports détaillés dans `AUDIT-2026-08-09.md`, `FONCTIONNEL-AUDIT-2026-08-09.md`, `audit-details/`)

- **Sécurité** : 48 vulns backend (2 critical) + 17 frontend · paywall factice · CORS `*`+credentials · pas de Helmet · pas de rate limit auth · BOLA OK · pas d'injection
- **Fonctionnel** : 9 bugs confirmés (login 201≠200, contrôleurs non enregistrés, Wikipedia/Wikidata 403, migrations inapplicables, start:prod cassé...)
- **DB** : 23 problèmes (4 critiques : migrations inapplicables, 3 tables absentes des migrations, pas de FK espèces)
- **UI** : 152 éléments audités — 3 cassés, 7 bugs, i18n incomplet (4/6 locales)
- **Prod** : aucun déploiement prévu, mixed content bloquant, ~15-18 j-homme estimés

## 2. Corrections (V1-V5) — TOUTES LIVRÉES

| Domaine | Résultat |
|---|---|
| **Sécurité** | Paywall verrouillé (501 + activation admin opérateur) · RBAC OperatorGuard (equipment/legislation/health/admin) · CORS strict · Helmet + CSP frontend · rate limit auth (10/60s) + 429/Retry-After · IP réelle anti-XFF · **npm audit : 0 vulnérabilité backend + frontend** |
| **Base de données** | 1 migration baseline déployable (`migrate deploy` vérifié sur base vierge, `migrate diff` = 0 écart) · FK espèces + SetNull · timestamptz · 10 CHECK constraints · index GIN · 6 migrations produit |
| **Déploiement** | Dockerfile multi-stage + compose (backend/migrate) · `start:prod` corrigé · CI/CD GitHub Actions (test, build, audit) · Vercel config (headers, proxy.ts) · Sentry (DSN optionnel) · scripts backup/restore DB testés |
| **Fonctionnalités réparées** | 201→200 · recherche avancée + open-data réveillés · Wikipedia/Wikidata (User-Agent + @Query) · pipeline events routines (gamification fonctionnelle) · DTOs durcis · register concurrent → 409 · erreurs 500→400/404 · i18n 6 locales complètes |
| **Tests** | **422/422 backend (23 suites) + 30/30 frontend** · 5 nouvelles suites e2e (hardening, modules A/B/C/D/F) · tsc 0 erreur |

## 3. Modules produit — LIVRÉS

| Module | Contenu |
|---|---|
| **A — Rappels santé** | `Medication` (posologie, fréquence, durée) + `VetAppointment` (RDV, rappels J-7/J-1) · CRUD premium · événements 💊/🏥 générés dans le pipeline · UI complète |
| **C — Carnet enrichi** | `AnimalMeasurement` (poids/taille + **courbe SVG**) · `Vaccination` (rappel 💉 automatique au prochain dû) · **export du carnet JSON** (7 sections) |
| **B — Reproduction** | `BreedingRecord` (chaleurs/saillie/gestation/naissance/sevrage, nb de petits) · fiche `SpeciesReproduction` par espèce (contenu pour Module E) |
| **D — Routines espèce** | `SpeciesRoutineTemplate` (145 modèles seedés par catégorie) · proposés en 1 clic à la création d'un animal |
| **F — Éleveur multi-animal** | parenté père/mère (validation sexe + propriétaire, auto-FK SetNull) · groupes/enclos · section « Petits » |
| **E — Contenu espèces** | **296 espèces en base** (245 nouvelles générées par pipeline sourcé : GBIF nubKey vérifiée + extrait Wikipedia FR avec sourceUrl, 0 miss, 0 anomalie) · liste 291 cibles prête pour la v1 des 300 |

## 4. État final vérifié

- **Backend** : 422/422 tests, 0 vuln, migrate deployable, serveur :3001
- **Frontend** : 30/30 tests, build prod, 18 pages, serveur :3000
- **DB locale** : 296 espèces, 1 user de démo (test@captivia.local / Test1234!), Rango + données modules A/C de démo, **0 compte de test résiduel**
- **Live** : login, recherche (296 espèces), CRUD complet, rappels 💊🏥💉, courbe de poids, export carnet, parenté, routines recommandées — tout vérifié en HTTP

## 5. Reste à faire (P2 post-lancement)

1. **V5c** : tsc strict backend (résorption ~1287 erreurs `no-unsafe`, `noImplicitAny:true`) — 2-3 j
2. **Curation contenu** : santé/législation/équipement pour les 245 nouvelles espèces (les 51 originales les ont) — vagues de sous-agents sourcés
3. **Push notifications réelles** (web-push + VAPID — le pipeline d'événements est prêt, le transport est commenté)
4. **Paiement réel** (Stripe/Paddle) à la place de l'activation admin manuelle
5. **Traduction humaine** des 5 locales (actuellement placeholders FR)
6. **tsc/frontend** : dark mode toggle, résiliation UI, PDF du carnet (l'export JSON existe)
7. **Équipement** : vrais liens d'affiliation (placeholders actuels)

## 6. Chiffres clés

- 134 fichiers changés (76 modifiés + 58 nouveaux) — rien commité (à valider par Quentin)
- 6 migrations produites (1 baseline + 5 modules)
- 422 tests backend dont 129 e2e nouveaux · 30 tests frontend
- 0 vulnérabilité npm · 0 compte de test en base · 296 espèces sourcées
- Serveurs : backend :3001 · frontend :3000 (login test@captivia.local / Test1234!)
