# Frontend Captivia

Interface utilisateur de la plateforme Captivia — gestion participative du patrimoine génétique animal.

## Stack technique

- **Framework** : Next.js 16 avec App Router
- **Internationalisation** : next-intl 4.8.1 — 6 langues (FR par défaut, EN, ES, DE, IT, PT) avec préfixe `as-needed`
- **Styles** : Tailwind CSS 4
- **Composants UI** : Radix UI (@radix-ui/react-dialog, @radix-ui/react-tabs)
- **Icônes** : lucide-react
- **Client HTTP** : axios
- **Monitoring** : Sentry optionnel via @sentry/nextjs
- **Tests** : Jest + Playwright (e2e)
- **Lint** : ESLint bloquant en CI
- **Node.js** : ≥22

## Arborescence

```
frontend/
├── src/
│   ├── app/[locale]/        # Routes par langue (parametres/, animal-public/, etc.)
│   ├── components/          # Composants React réutilisables
│   ├── lib/
│   │   ├── config.ts        # Configuration (URL d'API, etc.)
│   │   ├── api.ts           # Fonctions d'appel API
│   │   ├── legal.ts         # Données légales à compléter
│   │   └── seo.ts           # Métadonnées SEO
│   └── content/legal/       # Pages légales statiques
├── messages/                # Fichiers de traduction (de.json, en.json, es.json, fr.json, it.json, pt.json)
├── i18n/
│   ├── routing.ts           # Configuration next-intl (locales, défaut, préfixe)
│   └── request.ts           # Context API i18n
├── e2e/                     # Tests Playwright
├── public/                  # Assets statiques
└── scripts/                 # Scripts utilitaires
```

## Configuration

### Variables d'environnement (`.env.local`)

| Variable | Obligatoire | Production | Exemple |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✓ | ✓ | `https://api.captivia.local` |
| `NEXT_PUBLIC_SITE_URL` |  | ✓ | `https://captivia.local` |
| `NEXT_PUBLIC_SENTRY_DSN` |  |  | `https://...@sentry.io/...` |
| `NEXT_PUBLIC_COMMUNITY_ENABLED` |  |  | `false` (coupé), `true` (lien depuis la landing) ; absent : détection par l'API |
| `NEXT_PUBLIC_MEDIA_BASE_URL` |  | dès l'ouverture de la communauté | `https://media.captivia.app` (domaine public du bucket R2, ajouté à la CSP `img-src`) |

**Communauté** (`src/lib/community.ts`, `src/lib/community-flag.ts`) : la destination « Communauté »
de l'app ne devient un lien que si l'API répond. Une sonde `GET /community/rules` **sans jeton**
interprète la réponse : `404` = volet fermé côté serveur (`COMMUNITY_ENABLED=false`), `200` / `401` /
`403` = volet ouvert, autre (réseau, 5xx) = inconnu (« Bientôt », sans lien). Le résultat est gardé
pour la session (`sessionStorage`). `NEXT_PUBLIC_COMMUNITY_ENABLED=false` coupe tout au build (aucune
requête) ; `true` ajoute seulement le lien de la landing (qui reste « Bientôt » sinon). Les images
des membres ne sont affichées que si elles viennent de `NEXT_PUBLIC_MEDIA_BASE_URL` (sinon de l'API,
pilote local du backend) : la même origine est ajoutée à `img-src`. Ces variables sont lues au
build.

### Fichiers clés

- **`src/lib/config.ts`** : Configuration frontale (origine API, site URL)
- **`src/lib/api.ts`** : Appels API centralisés
- **`src/i18n/navigation.ts`** : Helpers de navigation multilingue
- **`src/lib/legal.ts`** : Mentions légales, RGPD, etc. — **À compléter**
- **`messages/*.json`** : Texte UI par langue (6 fichiers)

## Scripts npm

```bash
npm run dev              # Développement (port 3000)
npm run build           # Build production
npm run start           # Serveur production
npm run lint            # ESLint (bloquant)
npm run test            # Jest
npm run test:modals     # E2E Playwright (dialogues)
```

## Conventions

### Texte UI

Tous les textes utilisateur résident dans **`messages/{fr,en,es,de,it,pt}.json`** — vérifier la parité entre 6 fichiers. Pas de texte codé en dur.

### Navigation

Utiliser `@/i18n/navigation` pour les liens multilingues.

### Code

- Pas de `any` TypeScript (lint bloquant)
- ESLint obligatoire (`npm run lint` doit passer en CI)
- Tests Jest pour la logique métier

## Déploiement

Voir **[`../docs/DEPLOY.md`](../docs/DEPLOY.md)** pour déploiement Netlify, variables d'environnement de production et hôte personnalisé.

---

*Documentation générée pour Captivia — version frontend 0.1.0*
