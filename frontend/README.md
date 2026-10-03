# Frontend Captivia

Application web et mobile de Captivia (carnet de santé, rappels et fiches espèces pour les
particuliers qui ont un ou plusieurs animaux). Règles du dépôt et commandes de vérification :
[`../AGENTS.md`](../AGENTS.md). Système visuel : [`docs/DESIGN.md`](docs/DESIGN.md).

## Stack

- Next.js 16 (App Router, React 19, compilateur React), Node ≥ 22
- next-intl : 6 langues (`fr` par défaut, `en`, `es`, `de`, `it`, `pt` = portugais européen) ;
  préfixe `as-needed` sur le web, `always` dans l'app mobile
- Tailwind CSS 4 limité aux jetons du système visuel, Radix UI (modales, onglets), lucide-react
- Capacitor 7 (Android / iOS) sur l'export statique (`npm run build:mobile`)
- Sentry facultatif (`@sentry/nextjs`), RevenueCat pour l'achat intégré (app uniquement)
- Tests : Jest (unitaires, parité i18n) et Playwright (smoke sur API simulée, axe)

## Arborescence

```
frontend/
├── src/
│   ├── app/[locale]/
│   │   ├── (marketing)/   # landing, pages légales, transparence, page publique d'un animal
│   │   ├── (auth)/        # connexion, inscription, mots de passe, vérification d'e-mail, /sauvegarder
│   │   └── (app)/         # mes-animaux, agenda, especes, species, parametres, magasin, communaute
│   ├── components/        # ui/ (composants du système), frames/ (cadres), landing/, community/,
│   │                      # native/ (pont Capacitor), guest/, purchases/, species/, auth/
│   ├── lib/               # api.ts (client API), config.ts, platform.ts, csp.ts, seo.ts, legal.ts…
│   ├── i18n/navigation.ts # Link, useRouter… localisés (à utiliser à la place de next/link)
│   ├── content/           # pages légales, photothèque (photos.ts)
│   └── contexts/          # AuthContext
├── i18n/                  # routing.ts (locales, préfixe), request.ts (chargement des messages)
├── messages/              # textes de l'interface, un fichier par langue
├── mobile/                # overlays de routes de l'app (mobile/app/**), sources d'icônes, gabarits natifs
├── e2e/                   # smoke/ (CI), integration/ (hors CI, backend réel), fixtures/, support/
├── public/                # images (crédits : public/images/CREDITS.md), icônes, sw.js
└── scripts/               # build-mobile.mjs, génération d'icônes, captures et textes des stores
```

## Variables d'environnement (lues au build)

| Variable | Obligatoire | Exemple |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | oui | `http://localhost:3001` (local), URL de l'API Render en production |
| `NEXT_PUBLIC_SITE_URL` | en production | `https://captivia-app.netlify.app` (fixé dans `netlify.toml`) |
| `NEXT_PUBLIC_SENTRY_DSN` | non | projet Sentry UE |
| `NEXT_PUBLIC_COMMUNITY_ENABLED` | non | `false` (coupé, aucune requête), `true` (lien depuis la landing) ; absent : détection par l'API |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | dès l'ouverture de la communauté | domaine public du bucket R2, ajouté à la CSP `img-src` |

Liste complète (dont les variables du build mobile) : [`../docs/DEPLOY.md`](../docs/DEPLOY.md) § 5.

**Communauté** (`src/lib/community.ts`, `src/lib/community-flag.ts`) : la destination « Communauté »
ne devient un lien que si l'API répond. Une sonde `GET /community/rules` sans jeton interprète la
réponse : `404` = volet fermé côté serveur (`COMMUNITY_ENABLED=false`), `200` / `401` / `403` = ouvert,
autre (réseau, 5xx) = inconnu (« Bientôt », sans lien). Le résultat est gardé pour la session
(`sessionStorage`). Les images des membres ne sont affichées que si elles viennent de
`NEXT_PUBLIC_MEDIA_BASE_URL` (sinon de l'API, pilote local du backend).

## Scripts npm

```bash
npm run dev            # serveur de développement (port 3000)
npm run build          # build de production (output standalone)
npm run start          # sert le build de production
npm run lint           # ESLint
npm test               # Jest (dont la parité des six fichiers de messages)
npm run build:mobile   # export statique pour Capacitor (out/), voir docs/MOBILE.md
npm run test:modals    # parcours Playwright des modales (frontend + backend réels déjà lancés)
```

Smoke Playwright et garde-fou de style : commandes exactes dans [`../AGENTS.md`](../AGENTS.md).

## Conventions

- Aucun texte en dur : tout passe par `messages/<locale>.json`, dans les six langues (le test de
  parité échoue sinon). Le ton et les mots publiés suivent `../docs/MESSAGING.md`.
- Liens et navigation : `@/i18n/navigation` ; chemins vers des routes dynamiques par les helpers de
  `src/lib/platform.ts` (`animalDetailPath`, `speciesPath`…) pour rester compatibles avec l'app.
- Couleurs, rayons, typographie : uniquement les jetons de `docs/DESIGN.md` (garde-fou en CI).
- Appels API : `src/lib/api.ts` (timeout, `ApiError`, rafraîchissement de session) ; jamais de
  message brut de l'API à l'écran.
