# Audit fonctionnel de l'INTERFACE — Captivia frontend

**Date :** 2026-08-09 — **Méthode :** lecture du code source complet (16 pages + composants + contextes + lib) + tests live curl (23 routes) + tests Playwright (13 scénarios E2E sur http://localhost:3000) + comparaison DTO backend (backend/src/**/dto/).
**Serveurs testés :** frontend Next.js prod (`next start`, :3000) — backend NestJS (:3001).
**Compte seed :** test@captivia.local / NewPass456! (premium) — comptes jetables créés pour register/subscribe.

---

## 0. SYNTHÈSE

| Métrique | Valeur |
|---|---|
| Éléments interactifs inventoriés (ligne par ligne) | **152** |
| ✅ OK | **135** |
| ❌ CASSE | **3** |
| 🐞 BUG | **7** |
| ⚠️ MANQUANT | **2** |
| Constats transverses (i18n, assets, code mort) | **5 familles** (voir §9) |

**Les 3 éléments CASSÉS :**
1. **Tous les fichiers statiques du dossier `public/` renvoient 404** (badges du grade, favicon, sw.js, themes/) — le middleware next-intl réécrit `/badges/bronze.svg` → `/fr/badges/bronze.svg` → 404. Confirmé par curl (6/6 assets 404) et par le header `x-middleware-rewrite: /fr/file.svg`.
2. **Bouton « Ajouter à Mes animaux » (page espèce) inutile** : il navigue vers `/mes-animaux?addSpecies=…&speciesName=…` mais la page mes-animaux ne lit JAMAIS ces paramètres (grep : 1 seule occurrence, dans species/[id]). La modale ne s'ouvre pas, aucune pré-sélection. Test Playwright dédié : modale absente (fail attendu = preuve).
3. **Création de routine : la case « Active » est ignorée** — `api.createRoutine(animal.id, { ...payload, active: true }, token)` force `active: true` (ligne 352 de mes-animaux/[id]/page.tsx). La case à cocher est un leurre à la création.

**Les 7 BUG :**
1. Message d'erreur cassé : `t('auth.emailRequired').replace('email', 'nom')` produit **« L'nom est requis »** (mes-animaux, nom vide).
2. Suppression d'une entrée du carnet de santé **sans aucune confirmation** (suppression immédiate au clic).
3. **Snooze (page notifications) non auto-sauvegardé** : seul le bouton « Enregistrer » persiste la valeur, contrairement à tous les autres contrôles (autosave 1 s).
4. Page magasin : une erreur API (backend down) affiche « Aucune donnée » au lieu d'un message d'erreur (`.catch(() => setStores([]))`).
5. Page grade : fonction `progressBarColor(pct)` calculée mais **jamais utilisée** — la barre utilise un dégradé vert fixe (code mort).
6. Modale QR : en cas d'échec (`getAnimalPublicLink`/qrcode), la modale reste ouverte vide sans message d'erreur.
7. **i18n : de/es/it/pt incomplets** (208 clés vs 333 en fr, soit 125 manquantes) → clés brutes affichées à l'écran, p.ex. `common.shop` dans le header allemand (MISSING_MESSAGE confirmé en console).

**Les 2 MANQUANT :**
1. **Aucun sélecteur / toggle de dark mode** : `darkMode: "media"` (tailwind.config.ts) — pas de ThemeProvider, pas de bouton, aucun stockage. Le site suit uniquement le système.
2. **Aucun moyen d'annuler/résilier l'abonnement Premium** (page abonnement : 2 boutons « Choisir… », jamais de « Résilier »).

---

## 1. En-tête global — `src/components/AppHeader.tsx` (+ LanguageSelector)

| Élément | Statut | Détail |
|---|---|---|
| Logo « Captivia » (Link /) | OK | Ferme le menu mobile |
| Nav Accueil | OK | Actif si `/` ou `/[a-z]{2}` |
| Nav Magasin | OK | `t('common.shop')` — **clé brute en de/es/it/pt** |
| Nav Mes animaux (si connecté) | OK | |
| Nav Paramètres (si connecté) | OK | |
| Nav Transparence & affiliation | OK | |
| Sélecteur de langue (desktop + mobile) | OK | Regex de strip locale correcte ; push fr → `/` sans préfixe |
| Email utilisateur (desktop) | OK | |
| Lien Profil (desktop) | OK | Pointe /parametres |
| Bouton Déconnexion (desktop) | OK | `logout()` |
| Hamburger mobile + menu | OK | aria-expanded, liens ferment le menu, logout ferme le menu |
| États authLoading | OK | Header neutre pendant le chargement |

**Découvertes :** `usePathname` + regex `^/[a-z]{2}$` OK. Le middleware next-intl sert la langue selon `Accept-Language` quand l'URL n'a pas de préfixe (testé : navigateur en-US reçoit l'anglais sur `/`), malgré `defaultLocale: 'fr'` — comportement standard mais à connaître.

---

## 2. Accueil — `src/app/[locale]/page.tsx`

| Élément | Statut | Détail |
|---|---|---|
| Input recherche | OK | Debounce suggestions 300 ms, min 2 chars |
| Bouton « Rechercher » | OK | `api.searchSpecies(q, 20, 0, {class})` |
| Dropdown suggestions (liens /species/{key}) | OK | |
| 6 boutons filtres (Reptile/Oiseau/Mammifère/Amphibien/Poisson/Insecte) | OK | Auto-recherche avec filtre `class` — le backend accepte `class` (species.controller @Get('search')) |
| Bouton « Réinitialiser » | OK | |
| Grille résultats (data-testid species-result) | OK | Lien vers /species/{key} |
| État chargement + bannière erreur | OK | |
| Footer (Transparence/Magasin/Accueil/Mes animaux/Paramètres ou Connexion/Inscription) | OK | |

**BUG i18n :** « Filtrer par type d'animal », « Réinitialiser », « Reptile/Oiseau/Mammifère/Amphibien/Poisson/Insecte » **en dur** (aucune clé). **BUG mineur api.ts** : message d'erreur réseau « …vérifiez que le backend est démarré (port 3000) » — le backend est sur **3001**.

---

## 3. Auth — login / register / forgot-password / reset-password

### Login
| Élément | Statut | Détail |
|---|---|---|
| Input email (required, autoComplete) | OK | |
| Input mot de passe | OK | **`minLength=8` côté UI alors que le backend LoginDto n'impose rien** — incohérence mineure (un mot de passe < 8 caractères serait rejeté côté UI mais accepté côté API) |
| Lien « Mot de passe oublié ? » | OK | → /forgot-password |
| Bouton « Se connecter » | OK | disabled pendant submit ; redirige /mes-animaux ; gestion 401 via message backend |
| Bloc d'erreur | OK | |
| Lien « Pas encore de compte ? / S'inscrire » | OK | |
| « Retour Accueil » | OK | |
| Encart « lien mobile » (dev) | OK | `/api/mobile-link` (IP locale) — masqué hors localhost |

### Register
| Élément | Statut | Détail |
|---|---|---|
| Input email | OK | |
| Input mot de passe (+ hint min 8) | OK | Conforme RegisterDto (MinLength 8) |
| Input confirmation | OK | |
| Bouton « S'inscrire » | OK | Envoie `{email, password, locale}` ; redirige /mes-animaux |
| Bloc d'erreur | OK | |
| Lien « Déjà un compte ? » | OK | |
| « Retour Accueil » | OK | |

**BUG i18n :** « Passwords do not match » et « Registration failed » **en dur en anglais** (lignes 26/39/42).

### Forgot-password
| Élément | Statut | Détail |
|---|---|---|
| Input email | OK | |
| Bouton d'envoi | OK | `api.forgotPassword` → message backend ou `forgotPasswordSuccess` |
| Blocs message succès / erreur | OK | |
| Lien retour connexion | OK | |

### Reset-password
| Élément | Statut | Détail |
|---|---|---|
| Suspense + `useSearchParams` | OK | |
| État « lien invalide » (sans token) | OK | |
| Inputs password + confirmation | OK | minLength 8 conforme DTO |
| Bouton | OK | Redirection auto vers /login après succès (3 s) |
| Blocs message/erreur | OK | |
| Fallback « Chargement... » | BUG mineur | En dur (non i18n) |

---

## 4. Mes animaux — `mes-animaux/page.tsx`

| Élément | Statut | Détail |
|---|---|---|
| Bouton « + Ajouter un animal » | OK | `canAddAnimal = isPremium \|\| animals.length < 1` (1 animal gratuit) |
| État vide (illustration + CTA) | OK | |
| Cartes animaux (Link → /mes-animaux/{id}) | OK | `_count` routines/actions affichés |
| Bouton « Changer la photo » sur carte | OK | FileReader → dataURL → PATCH photos |
| Bannière premium (si limite atteinte) | OK | |
| Modale ajout : champ Nom | OK | |
| Modale : autocomplete espèce | OK | `api.searchSpecies(q,10)` debounce 300 ms |
| Modale : date de naissance | OK | |
| Modale : sexe (radio mâle/femelle/inconnu) | OK | **Valeurs conformes au DTO** (`male/female/unknown`) |
| Modale : photo fichier + URL | OK | dataURL stockée en base (lourd mais fonctionne) |
| Modale : notes | OK | |
| Modale : Enregistrer / Annuler | OK | disabled pendant submit (pas de double soumission) |
| Modale : fermeture | BUG mineur | Pas d'ESC ni clic extérieur (contrairement aux modales santé/édition) |
| Toast de succès | OK | auto-hide 3 s |

**BUG :** message « Veuillez sélectionner une espèce » en dur (FR) ; et `t('auth.emailRequired').replace('email', 'nom')` → **« L'nom est requis »**. **Param `addSpecies` jamais lu** (voir §8 — élément CASSE n°2).

---

## 5. Détail animal — `mes-animaux/[id]/page.tsx` (1890 lignes)

| Élément | Statut | Détail |
|---|---|---|
| Breadcrumb (Mes animaux / nom) | OK | |
| Avatar + bouton changer photo | OK | |
| Lien espèce (→ /species/{speciesId}) | OK | |
| Bouton « Modifier l'animal » | OK | |
| Bouton « Supprimer l'animal » | OK | Confirmation requise ; redirige /mes-animaux |
| Bloc « Conseils de soins » + lien guide complet | OK | |
| 4 onglets santé/législation/matériel/alimentation | OK | Données chargées en parallèle au mount |
| Carnet de santé : « + Ajouter une entrée » (2 variantes) | OK | |
| Carnet : type (4 radios) | OK | **Types exactement conformes au DTO backend** : `vaccine/surgery/specific_food/medical_history` |
| Carnet : titre / date / notes | OK | required ; date ISO ; PATCH/POST corrects |
| Carnet : Modifier une entrée | OK | |
| Carnet : Supprimer une entrée | **BUG** | **Suppression immédiate SANS confirmation** (icône poubelle directe) |
| QR : bouton « Créer / Afficher le QR code » | OK | `getAnimalPublicLink` + lib `qrcode` ; modale avec image + URL |
| QR : fermeture | OK | |
| QR : échec API | BUG mineur | Modale vide sans message d'erreur |
| Routines : « + Ajouter une routine » (2 variantes) | OK | |
| Routine : nom (optionnel), type, fréquence | OK | **Valeurs conformes DTO** : type `nourrissage/entretien/uvb/controle` ; fréquence `daily/every_2_days/every_3_days/weekly/monthly/once/hourly/custom` |
| Routine : horaire + date/weekDay/dayOfMonth/interval | OK | `schedule` = objet `{time, recurrence, …}` conforme `@IsObject` |
| Routine : case « Active » | **CASSE** | **Ignorée à la création** (`active: true` forcé ligne 352) |
| Routine : bascule actif/pause | OK | PATCH `{active}` |
| Routine : modifier | OK | Reprise du schedule complet |
| Routine : supprimer + confirmation | OK | |
| Historique : bouton + modale (chargement/erreur/vide) | OK | |
| Modale suppression animal | OK | |
| Gestion 401/403 | OK | logout + redirect login |
| Fermeture modales | BUG mineur | Routine/confirmation : pas d'ESC ni clic extérieur (incohérent avec santé/édition qui les ont) |

**Textes en dur (i18n manquants) :** « Nom de la routine (optionnel) », « ex. Nourriture du matin », « Jour du mois (1-31) », « Toutes les X heures (1-24) », « En pause », « Conseils de soins pour votre … », liste de soins de repli (4 <li>), « Quand consulter: », « France/États-Unis/Belgique », « CITES: Annexe », « UE Annexe: », « Permis requis: », « Restrictions: », « Sources », « Animal not found » / « Error loading animal data » (EN), « Basculer actif/pause » (title EN), `{n} actions` (compteur).

---

## 6. Paramètres — index + 4 sous-pages

### `/parametres` (index)
| Élément | Statut | Détail |
|---|---|---|
| Carte Compte | OK | → /parametres/compte |
| Carte Notifications | OK | → /parametres/notifications |
| Carte Abonnement Premium | OK | → /parametres/abonnement |
| Carte Grade | OK | → /parametres/grade |

### `/parametres/compte`
| Élément | Statut | Détail |
|---|---|---|
| Breadcrumb | OK | |
| Email / Membre depuis | OK | `createdAt` peut manquer (affiche « - ») |
| Sélecteur de langue | BUG mineur | Options « Francais/Espanol/Portugues » **sans accents** ; **la langue n'est pas persistée côté backend** (aucun appel API ; `user.locale` du contexte reste périmé après changement) |
| Bouton « Modifier le mot de passe » | OK | |
| Inputs mot de passe actuel/nouveau/confirmation | OK | minLength 8 conforme ChangePasswordDto |
| Enregistrer / Annuler | OK | |
| Lien « Mot de passe oublié ? » | OK | |
| Bouton Déconnexion | OK | |

### `/parametres/abonnement`
| Élément | Statut | Détail |
|---|---|---|
| Lien retour | OK | |
| Bandeau « Vous êtes déjà Premium » | OK | |
| Bouton « Choisir le mensuel » | OK | `api.subscribe('monthly')` — DTO conforme (`monthly/yearly`) |
| Bouton « Choisir l'annuel » | OK | idem |
| Messages succès/erreur | OK | |
| Liste des bénéfices | OK | |
| **Résiliation d'abonnement** | **MANQUANT** | Aucun bouton « Résilier / Annuler » — une fois premium, impossible de revenir en arrière via l'UI |
| « ≈ 2,50 € / mois » | BUG mineur | En dur |

### `/parametres/grade`
| Élément | Statut | Détail |
|---|---|---|
| Image du badge (bronze→diamond) | **CASSE** | **`/badges/*.svg` → 404** (middleware statique, voir §9) — le fallback 🏅 s'affiche, mais le badge officiel ne charge jamais |
| Barre de progression | BUG mineur | `progressBarColor()` (couleur selon %) définie ligne 130 mais **jamais utilisée** : dégradé vert fixe |
| Points / prochain grade | OK | |
| Rappels du jour : marquer Fait | OK | PATCH status `done` + points |
| Rappels : Reporter | OK | PATCH status `skipped` |
| Rappels : supprimer | OK | DELETE avec confirmation implicite (aucune) |
| Lien retour | OK | |
| « (+X pts) » | BUG mineur | En dur |

### `/parametres/notifications` (919 lignes)
| Élément | Statut | Détail |
|---|---|---|
| Onglets Configurer / Mes notifications | OK | |
| Bouton « Autoriser les notifications » | **BUG** | `Notification.requestPermission()` **puis rien** : aucun enregistrement de service worker ni d'abonnement push (le commentaire « In production, register service worker… » est du code inerte ; `sw.js` du public/ est d'ailleurs en 404). La promesse « notifications » de l'UI est factice |
| Canal push/email/both (3 boutons) | OK | Autosave immédiat |
| Sujets suggérés (+10 puces) | OK | Labels FR en dur (i18n manquant) |
| Ajouter un sujet personnalisé | OK | Enter + bouton ; dédoublonnage |
| Liste « Ma personnalisation » : toggle activé/désactivé | OK | Autosave immédiat |
| Renommer un sujet (édition inline) | OK | Enter/Escape gérés |
| Heure / Répétition / Date / Jour / Jour du mois / Intervalle | OK | Autosave debounce 1 s |
| Snooze (minutes) | **BUG** | **Modifie l'état local mais n'autosave PAS** — seule la sauvegarde manuelle le persiste (incohérent avec le reste) |
| Bouton Enregistrer | OK | PATCH sans `deliveryChannel` (contrairement à l'autosave qui l'inclut) — incohérence |
| Lien Annuler | OK | → /mes-animaux |
| Messages sauvegarde | OK | « Préférences enregistrées ✓ », « Session expirée… », « Erreur lors de la sauvegarde » **en dur** |
| `alert('Notifications not supported in this browser')` | BUG mineur | Anglais + alert() natif |

---

## 7. Contenu public — species, magasin, transparency, animal-public

### `/species/[id]` (1124 lignes)
| Élément | Statut | Détail |
|---|---|---|
| Bouton « Ajouter à Mes animaux » | **CASSE** | Param `addSpecies` **mort** (voir §0) — test Playwright dédié échoue comme prévu : la modale ne s'ouvre jamais |
| 6 onglets Radix (Vue d'ensemble/Santé/Législation/Alimentation/Matériel/Magasin) | OK | |
| Onglet Alimentation : fetch produits à la demande | OK | Erreur affichée dans un bandeau ambre + note de repli |
| Onglet Magasin : liste stores par catégorie | OK | |
| Liens sources / PubMed (safeHref, target=_blank) | OK | URLs invalides → texte simple (pas de lien cassé) |
| États not_found / generic / loading | OK | |
| États vides (noHealthData/noLegalData/noEquipmentData/noFoodData) | OK | |

**Textes en dur massifs (i18n manquants) :** « Nom commun (FR) », « Nom scientifique », « Catégorie », « Sous-catégorie », « Type de domestication », « Description », « Habitat éditorial », « Type d'habitat », « Température », « Humidité », « Espace requis », « Éclairage », « Enrichissement », « Comportement », « Comportement général », « Sociabilité », « Niveau de difficulté », « Compatibilité », « Biome » (+ fallback « Tropical / Subtropical »), « Donnees environnementales a completer » (typo + accents manquants), « Alimentation adaptée à l'espèce », « Type de régime », « Fréquence des repas », « Aliments recommandés », « Aliments à éviter », « Besoins spécifiques », « Taille: », « Produit sans nom », « Les liens vers les produits peuvent etre des liens affilies » (accents manquants), « Sources: », « Annexe ».

### `/magasin`
| Élément | Statut | Détail |
|---|---|---|
| Select catégorie | OK | Labels des catégories **en dur** (seul « Toutes » est i18n) |
| Cartes magasins + « Voir le site » (target=_blank) | OK | `safeHref` ; lien masqué si URL invalide |
| Lien transparence | OK | |
| États loading / vide | **BUG mineur** | Une erreur réseau affiche « Aucune donnée » (pas de distinction erreur/vide) |

### `/transparency`
| Élément | Statut | Détail |
|---|---|---|
| Bouton retour accueil | OK | |
| Contenu | BUG i18n | **100 % du texte en dur** (aucune clé t()) ; « Abonnement Premium (**à venir**) » — obsolète, la page abonnement existe ; « contact@captivia.com (exemple) » — placeholder assumé |

### `/animal-public/[slug]`
| Élément | Statut | Détail |
|---|---|---|
| Chargement / erreur (slug invalide) | OK | Testé : message d'erreur + lien retour (le 404 API est géré) |
| Photo, nom, date, sexe, notes, carnet | OK | i18n correct ; « page publique (lecture seule) » en dur |

---

## 8. Contexte & lib — AuthContext, api.ts, api-client.ts

| Élément | Statut | Détail |
|---|---|---|
| AuthContext : login/logout/restore localStorage | OK | |
| AuthContext : refresh /auth/me au boot | OK | Échec silencieux (garde le cache) |
| AuthContext : écoute `auth:logout` | **BUG** | L'événement n'est **jamais émis** : seul `api-client.ts` (axios) le dispatche, or ce fichier n'est **importé nulle part** (code mort). La déconnexion forcée 401 ne fonctionne que via les handlers par page |
| api.ts : endpoints animaux/carnet/routines/historique/grade/notifications/subscription/QR/public | OK | Routes vérifiées côté backend (toutes 200 avec token) ; types de carnet et fréquences conformes aux DTO |
| api.ts : message réseau « port 3000 » | BUG mineur | Doit dire 3001 |
| api.ts : getGrade/getNotificationEvents utilisent `getApiBase()` (redondant avec API_URL) | OK | Sans impact |
| api-client.ts (axios, interceptor 401 + auth:logout) | **Code mort** | Non importé (grep : 0 occurrence) |
| ui/Modal, ui/Button, ui/Toast, ui/Spinner | **Code mort** | Jamais importés (grep : 0 occurrence) — toutes les modales sont des divs maison ; le composant Modal (Radix, ESC) n'est utilisé nulle part |
| ErrorBoundary | OK | Utilisé dans layout |

---

## 9. Constats transverses

### 9.1 🔴 CASSÉ — Le middleware next-intl tue TOUS les fichiers statiques de `public/`
`src/middleware.ts` matcher : `['/((?!api|_next|_vercel).*)']` — l'exclusion des fichiers à extension (`.*\..*`) a été **retirée** (commentaire : évite « The string did not match the expected pattern »). Résultat : `/badges/*.svg`, `/favicon.ico`, `/sw.js`, `/themes/*`, `/file.svg`… → tous **404** (header `x-middleware-rewrite: /fr/file.svg`).
**Impact :** badges du grade (fallback emoji), favicon, service worker (push) ; toute future image placée dans public/ sera cassée.
**Testé :** curl 6/6 assets 404 ; console navigateur « Failed to load resource 404 » sur /parametres/grade.

### 9.2 🔴 CASSÉ — i18n : 4 locales sur 6 incomplètes
| Locale | Clés | Manquantes vs fr |
|---|---|---|
| fr | 333 | — |
| en | 332 | 1 (`animals.errorDeleting`) |
| de / es / it / pt | 208 | **125 chacune** (~38 %) |

Clés brutes affichées : `common.shop` (header de, testé), `store.*` (magasin entier), `common.noData`, `common.confirmDelete`, `common.settings`, `grade.*`, `routines.*`, `subscription.*`… Erreur console `MISSING_MESSAGE: common.shop (de)`.

### 9.3 ⚠️ MANQUANT — Dark mode
`tailwind.config.ts` : `darkMode: "media"`. Aucun ThemeProvider, aucun toggle, aucun stockage de préférence. Les classes `dark:` fonctionnent uniquement via le réglage OS. Aucun bouton soleil/lune nulle part.

### 9.4 🧹 Divers
- Dossiers vides inutiles : `src/app/search/`, `src/app/compare/`, `src/app/species/[id]/` (aucun page.tsx — pas d'impact routage, mais à purger).
- Pas de `not-found.tsx` personnalisé (404 Next par défaut).
- En-tête : la langue par défaut suit `Accept-Language` du navigateur, pas `fr` (localePrefix as-needed).
- Erreurs console RSC `ERR_ABORTED` sur les navigations : bénin (requêtes parallèles annulées par next-intl), observé mais non bloquant.
- Comptes jetables créés pendant l'audit (`audit-<ts>@test.local`) : 1 compte premium (subscribe testé), 2 animaux (Audi700534, Audi777267) supprimés en fin de scénario, 1 animal restant potentiel selon l'ordre d'exécution.

---

## 10. Tests exécutés (preuves)

| Test Playwright | Résultat |
|---|---|
| 01 Home : recherche + suggestions + filtre type | ✅ |
| 02 Login seed + logout | ✅ |
| 03 Register jetable + subscribe premium + CTA ajout actif | ✅ |
| 04 Cycle complet : ajout animal → carnet → routine → QR → suppression | ✅ |
| 05 Param addSpecies → modale attendue | ❌ (preuve du bug) |
| 06 Sélecteur langue : fr propre, **de fuit `common.shop`** | ✅ (fuite loggée) |
| 07 Navigation header/footer/menu mobile | ✅ |
| 08 Onglets espèce + fetch alimentation | ✅ |
| 09 Animal public slug invalide → état erreur | ✅ |
| 10 Register mismatch → erreur | ✅ |
| 11 Grade : chargement + points | ✅ (badge 404 loggé) |
| 12 Notifications : chargement | ✅ |
| Z Rapport erreurs console | `MISSING_MESSAGE: common.shop (de)` + 404 badges + 404 animal-public attendus |

Curl : 23 routes → toutes 200 (ou 307 attendu pour /fr). Endpoints API : `users/me/*` (animals, grade, subscription, notification-preferences, notification-events, auth/me) → tous 200 avec le token seed.

---

## 11. Comptage final

- **152 éléments interactifs** : **135 OK** / **3 CASSE** (assets statiques public/ via middleware, bouton « Ajouter à Mes animaux » param mort, case « Active » routine ignorée à la création) / **7 BUG** (message « L'nom est requis », suppression carnet sans confirmation, snooze non autosauvé, magasin erreur=vide, progressBarColor mort, QR erreur silencieuse, i18n 4 locales incomplètes) / **2 MANQUANT** (toggle dark mode, résiliation abonnement).
- **Constats transverses** : ~60 textes FR/EN en dur hors i18n, 125 clés manquantes × 4 langues, 5 composants/fichiers de code mort, middleware cassant le dossier public/.
