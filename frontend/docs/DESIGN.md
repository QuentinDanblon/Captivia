# Captivia — système visuel

Référence unique et finale du design de Captivia (web, app mobile Capacitor, landing), après la
refonte en quatre lots et la passe de finition d'octobre 2026. Toute entorse se justifie ici, dans
le journal des décisions (§ 10), avant d'être codée.

| Quoi | Où |
| --- | --- |
| Vision produit, offre, règle d'écriture | `docs/PRODUCT.md` (fait foi) |
| Mots publiés (landing, stores, boutons) | `docs/MESSAGING.md` |
| Jetons, styles de base, en-tête, pied, coquille de l'app | `src/app/globals.css` |
| Polices | `src/app/[locale]/layout.tsx` (`next/font/google`) |
| Composants | `src/components/ui/*` (barrel `@/components/ui`), `src/components/AppShell.tsx`, cadres `src/components/frames/*` |
| Photothèque et crédits | `src/content/photos.ts`, `public/images/CREDITS.md` |
| Garde-fous | § 9 (grep des motifs interdits, axe, CI) |

Sommaire : 1. Principes · 2. Voix et textes · 3. Jetons · 4. Architecture CSS · 5. Composants ·
6. Mises en page de référence · 7. Imagerie · 8. À ne pas faire · 9. Garde-fous · 10. Journal des
décisions.

---

## 1. Principes

Captivia est **l'app compagnon du quotidien avec ses animaux** : son centre est *l'animal de
l'utilisateur et sa journée* (soins du jour, prochains rendez-vous, alertes, dernière pesée) — ni
un catalogue, ni un site vitrine. L'accueil de l'app est un tableau de bord « Aujourd'hui »
(§ 6.2), les fiches d'espèces viennent en appui (« Bon à savoir »), la landing est une couche
séparée (§ 6.7).

1. **Un carnet, pas un tableau de bord d'entreprise.** Papier, encre, filets fins. La hiérarchie
   vient de la typographie et des filets, pas d'ombres floues ni de cartes empilées.
2. **Précis avant d'être joli.** Chiffres, unités, dates, sources : « 28–32 °C », « 0,2 ml »,
   « GBIF 2435099 ». Les mesures sont en mono à chiffres tabulaires.
3. **Le vivant en vrai.** Photos réelles sous licence libre, créditées ; sans photo, une silhouette
   au trait de la classe animale. Jamais de dégradé + initiale, jamais d'image générée.
4. **Une action principale par zone.** Un seul bouton plein (`primary`) par carte ou en-tête.
5. **Accessible par construction.** AA partout (vérifié), focus visible au clavier, zones
   tactiles ≥ 44 px, statut jamais porté par la seule couleur, mouvement réduit respecté.
6. **Le sombre est une encre, pas un filtre.** Les composants lisent des jetons ; aucune classe ne
   porte de variante sombre Tailwind, et la palette Tailwind par défaut n'existe plus (§ 4).

## 2. Voix et textes

`docs/PRODUCT.md` fait foi ; `docs/MESSAGING.md` fixe les mots publiés.

**Ton** : précis, chaleureux sans mièvrerie, factuel — des chiffres plutôt que des adjectifs
(« 3 soins aujourd'hui », « dernière pesée il y a 12 jours »). Phrases courtes, verbes d'action. On
écrit ce que la personne vit ou gagne (« Captivia vous prévient la veille »), jamais ce que l'app
« offre ». Pas de jargon visible (« synchronisation API », « token », « jeton »).

**Règle d'écriture** (propriétaire, 2026-10-02) : aucun mot des briefs à l'écran (« promesse »,
« piliers », « entonnoir », « carnet de terrain », « derrière la connexion »…), aucune formule
méta ; chaque titre donne envie au lieu de décrire la section. Test : une marque grand public
l'écrirait-elle sur sa page d'accueil ?

**Offre, sans pression** : invité et compte gratuit = 1 animal, carnet complet (D-16) ; plusieurs
animaux = compte + Premium. La valeur avant le prix ; l'invité est invité à créer un compte « pour
sauvegarder », jamais bloqué ; le passage invité → compte se dit (« Kaa et son carnet seront
rattachés à votre compte »). Aucun prix codé en dur : le tarif vient des stores.

**Forme d'adresse, par langue** (vérifiée à la passe de finition) :

| Langue | Adresse | Exemple |
| --- | --- | --- |
| fr | vous | « Connectez-vous pour modifier votre mot de passe. » |
| en | you | « Keep their enclosure at 26–32 °C. » |
| de | Sie | « Prüfen Sie Ihre Verbindung. » |
| es | tú | « Comprueba la conexión y vuelve a intentarlo. » |
| it | tu | « Controlla la connessione e riprova. » |
| pt | você (forme « seu / Tente ») | « Verifique o formulário. » |

**Formulations interdites** (et leur remplacement) :

| Interdit | Pourquoi | Écrire plutôt |
| --- | --- | --- |
| « révolutionnaire », « ultime », « incroyable », « magique », « intelligent » | adjectifs creux | le fait chiffré : « rappel 15 min avant » |
| « Découvrez… », « Explorez… », « Plongez dans… » en accroche | cliché | le contenu lui-même : « Boa constricteur — 28–32 °C, 60–70 % » |
| « en quelques clics », « simplement », « facilement » | promesse invérifiable | la durée ou l'étape : « 3 champs à remplir » |
| sur-titres en capitales (« DÉCOUVRIR ») | bruit visuel | rien, ou un identifiant mono (« Pl. 03 », « 01 ») |
| émojis, points d'exclamation (« Merci ! ») | registre | — |
| « soigne », « guérit », conseils médicaux affirmatifs | responsabilité | « à signaler au vétérinaire si… » |
| « IA », « généré », « assistant » | aucune fonction ne le justifie | — |
| « Passez à Premium ! », « Débloquez tout », « Offre limitée » | pression commerciale | « Suivez plusieurs animaux, chacun avec son carnet » |
| « Vous devez… », « Veuillez… » | injonction | l'action : « Connectez-vous pour… », « Choisissez une espèce pour continuer » |
| « Email » (fr) | anglicisme typographique | « E-mail », « adresse e-mail » |
| message brut de l'API à l'écran | langue et jargon non maîtrisés | message traduit selon le statut (ex. 401 → « E-mail ou mot de passe incorrect ») |
| « Partenaire Amazon » ou autre programme sans lien affilié affiché | inexact | la mention accompagne les liens eux-mêmes, au conditionnel ailleurs (§ 10.5) |

**Unités et dates** : espace insécable avant `%`, `°C`, `g`, `ml` ; virgule décimale en
français ; plages au tiret demi-cadratin (`formatRange`, `src/lib/units.ts`). Dates par
`Intl.DateTimeFormat` dans la locale : « 21 sept. 2026 », « 8 oct. 2026, 14:00 », jour de frise
« mer. 30 sept. » — jamais « 21/09/2026 ». Les dates calendaires de l'API (minuit UTC) se formatent
en `timeZone: 'UTC'`. Valeur absente : « — » ou la ligne est masquée, jamais « - ».

## 3. Jetons

Définis sur `:root` (clair) et redéfinis sous `:root[data-theme='dark']` ; exposés en
utilitaires par `@theme inline` : `bg-paper`, `text-ink-2`, `border-line`… Ce sont les **seules**
couleurs disponibles (§ 4).

### 3.1 Couleurs

| Jeton | Utilitaire | Clair | Sombre | Usage |
| --- | --- | --- | --- | --- |
| `--paper` | `bg-paper` | `#F6F3EC` | `#121714` | fond de page, en-tête, rail |
| `--surface` | `bg-surface` | `#FFFDF8` | `#1A211D` | cartes, champs |
| `--sunken` | `bg-sunken` | `#EFEBE2` | `#222A25` | creux, survol, gabarits, planches |
| `--ink` | `text-ink` | `#1D2B24` | `#ECE8DE` | texte principal, filets « à l'encre » |
| `--ink-2` | `text-ink-2` | `#5B655E` | `#A9B0A8` | texte secondaire, placeholders |
| `--ink-3` | `text-ink-3` | `#80877F` | `#7C857D` | **non textuel** : icônes, silhouettes, puces (≥ 3:1) |
| `--line` | `border-line` | `#E2DCCF` | `#2B3430` | filet fin |
| `--line-strong` | `border-line-strong` | `#CDC5B4` | `#3A4540` | filet appuyé, pointillés d'état vide |
| `--line-field` | `border-line-field` | `#8C8576` | `#6B776F` | bordure de champ, bouton secondaire (≥ 3:1) |
| `--accent` | `bg-accent` | `#2F5D46` mousse | `#8CC5A2` | bouton principal, pastilles |
| `--accent-strong` | `bg-accent-strong` | `#234836` | `#A9D6BA` | survol du principal |
| `--accent-soft` | `bg-accent-soft` | `#E3ECE4` | `#1F3328` | élément sélectionné |
| `--accent-text` | `text-accent-text` | `#2F5D46` | `#8CC5A2` | liens, accent en texte |
| `--on-accent` | `text-on-accent` | `#FFFDF8` | `#10201A` | texte sur `accent` |
| `--ok` / `--ok-soft` | `text-ok`, `bg-ok-soft` | `#2F6B4F` / `#E2EEE6` | `#8CC5A2` / `#1E3127` | fait, conforme |
| `--warn` / `--warn-soft` | `text-warn`, `bg-warn-soft` | `#8A5A00` / `#F6EBD2` | `#E3B85C` / `#33291A` | à faire, attention, « À COMPLÉTER » |
| `--danger` / `-soft` / `-strong` | `text-danger`… | `#A63A2A` / `#F7E4DF` / `#8A2F21` | `#F08C7A` / `#3A211C` / `#F5A597` | retard, destruction, erreur |
| `--on-danger` | `text-on-danger` | `#FFFDF8` | `#1A0F0C` | texte sur `danger` |
| `--info` / `--info-soft` | `text-info`, `bg-info-soft` | `#2D5B7A` / `#E1EBF2` | `#8DBBDD` / `#1C2A35` | rendez-vous, information |
| `--focus` | `outline-focus` | `#2F5D46` | `#8CC5A2` | anneau de focus |
| `--scrim` | `bg-scrim` | encre 55 % | noir 70 % | fond de modale |
| `--iucn-ex` … `--iucn-ne` | (via `IucnBadge`) | couleurs officielles de la Liste rouge | idem | statut UICN uniquement |

**Contrastes vérifiés** (script `palette.cjs` du lot 1, 250 paires, 0 échec ; axe en clair et en
sombre, § 9) — extraits :

| Paire | Clair | Sombre |
| --- | --- | --- |
| ink / paper · surface | 13,3 · 14,5 | 14,8 · 13,4 |
| ink-2 / paper · surface | 5,5 · 6,0 | 8,2 · 7,3 |
| accent-text / paper · surface · sunken | 6,8 · 7,4 · 6,4 | 9,2 · ≥ 8 · ≥ 7 |
| on-accent / accent · accent-strong | 7,4 · 10,1 | ≥ 8 |
| ok · warn · danger · info / leur `-soft` | 5,3 · 5,0 · 5,3 · 6,0 | 7,0 · 7,7 · 6,2 · 7,2 |
| ink-2 / ok · warn · danger · info · accent-soft, sunken | ≥ 4,9 | ≥ 6,0 |
| line-field / paper · surface (non-texte, min 3) | 3,3 · 3,6 | 3,9 · 3,5 |
| ink-3 / paper (non-texte, min 3) | 3,3 | 4,8 |
| UICN : CR blanc · EN noir · VU noir · LC noir · EW blanc | 5,1 · 8,3 · 16,6 · 9,7 · 12,4 | identiques |

Toute nouvelle paire texte/fond passe dans le script avant d'être utilisée.

### 3.2 Typographie

| Rôle | Police | Réglages |
| --- | --- | --- |
| Titres `h1-h3`, noms d'espèces, marque | **Fraunces** (variable) | `opsz` automatique, `SOFT 50`, `WONK 0`, 500-600 ; italique pour les noms latins |
| Interface, texte courant | **IBM Plex Sans** (variable) | 400 texte, 500 libellés et boutons, 600 emphase |
| Mesures, dates, doses, poids, identifiants, numéros de section | **IBM Plex Mono** 400/500 | `tabular-nums slashed-zero` (automatique sur `.font-mono`, `time`, `code`) |

Chargées par `next/font/google` (auto-hébergées au build, compatibles avec l'export mobile et la
CSP `font-src 'self'`) : `font-display` (alias `font-serif`), `font-sans`, `font-mono`.

**Échelle 1,25, base 16 px** :

| Utilitaire | Taille | Usage |
| --- | --- | --- |
| `text-meta` | 12,8 | métadonnées, légendes, crédits, numéros |
| `text-ui` | 14 | interface dense, libellés de champ |
| `text-body` | 16 | texte courant (minimum pour un paragraphe) |
| `text-h4` | 20 | titre de carte |
| `text-h3` | 25 | titre de section secondaire, modale, section légale |
| `text-h2` | 25 → 31 (fluide) | titre de section |
| `text-h1` | 31 → 39 (fluide) | titre de page |
| `text-display` | 39 → 49 (fluide) | landing uniquement |

Noms latins : `<i lang="la">Boa constrictor</i>` (ou `.latin`) — Fraunces italique ; l'autorité
(« Linnaeus, 1758 ») reste en romain. Texte en langue étrangère (titres PubMed…) : `lang` posé.

### 3.3 Grille, espacements, rayons, élévation, mouvement

- **Conteneur** `.cv-container` : 1200 px max, gouttière 24 px (16 px sous 768 px), encoches
  comprises. **Grille** 12 colonnes (`md:col-span-7/5`, `lg:col-span-8/4` contenu/latéral).
- **Espacements** base 4 : 4 / 8 / 12 / 16 / 24 / 32 / 48 / 72 → Tailwind `1 / 2 / 3 / 4 / 6 / 8 /
  12 / 18`.
- **Rayons** : `rounded-control` 6 px (boutons, champs, badges, photos) et `rounded-card` 10 px
  (cartes, modales, planches) ; `rounded-full` réservé aux pastilles et avatars.
- **Séparation par filets**, pas par ombres. `shadow-overlay` est réservé aux calques flottants
  (modale, menu) ; un filet gauche coloré s'écrit `shadow-[inset_3px_0_0_var(--warn)]`.
- **Mouvement** : 150 ms (`--dur-fast`, défaut des `transition-*`), 200 ms max, courbe `--ease` ;
  tout est coupé sous `prefers-reduced-motion`. Pas de déplacement au survol : les liens et
  lignes changent de couleur (`hover:text-accent-text`), les boutons de fond.
- **Focus** : anneau 2 px `--focus`, décalage 2 px, au clavier seulement (`:focus-visible`).
- **Zones tactiles** ≥ 44 px (`min-h-11`) ; `size="sm"` (36 px) remonte à 44 px au doigt.

## 4. Architecture CSS (`src/app/globals.css`)

Couches, dans l'ordre : `theme, base, components, utilities, fields`.

1. **Jetons** (`:root`, puis `:root[data-theme='dark']`). Le choix mémorisé prime sur la préférence système (§ 10.8).
2. **Couleurs : jetons seulement** — `@theme { --color-*: initial; }` retire toute la palette
   Tailwind (`gray-*`, `emerald-*`, `white`…) : une classe de couleur brute ne produit plus rien.
   Restent les mots-clés `transparent`, `current`, `inherit`.
3. **Pont Tailwind 4** — `@theme inline` expose les jetons (`bg-paper`…), les polices, l'échelle
   typographique, les deux rayons, les durées et `shadow-overlay`.
4. **`base`** : typographie, liens soulignés dans un `<p>`, focus, champs de formulaire (44 px,
   bordure `--line-field`, flèche de `select` redessinée, `accent-color`), barres de défilement.
5. **`components`** : `.cv-container`, lien d'évitement, en-tête et menu marketing
   (`.site-header`, `.cv-language-select`), coquille de l'app (`.app-shell`), photos (`.cv-photo`,
   grain, bichromie, cartouche de crédit), sections différées de la landing (`.cv-deferred`),
   pied de page, texture papier (`.cv-texture`).
6. **`fields`** (après les utilitaires) : focus des champs en `--accent`, erreur (`aria-invalid`)
   en `--danger`, plancher de bordure ≥ 3:1.

Il n'y a plus ni pont « mode sombre », ni palette remappée, ni alias `--captivia-*`, ni
`tailwind.config.ts` (ignoré par Tailwind 4) : supprimés à la passe de finition (§ 10.5).

## 5. Composants

Import : `import { Button, Card, … } from '@/components/ui';`

### 5.1 Button — `ui/Button.tsx`

```tsx
<Button>Enregistrer</Button>                                  // primary (une seule par zone)
<Button variant="secondary">Annuler</Button>
<Button variant="quiet" size="sm">Modifier</Button>           // action de faible poids
<Button variant="danger" loading={deleting}>Supprimer</Button> // aria-busy + désactivé
<Link href="/register" className={buttonClasses({ variant: 'secondary' })}>Créer un compte</Link>
```
Tailles `sm` 36 px (44 au doigt), `md` 44, `lg` 48. `type="button"` par défaut. `iconStart` /
`iconEnd` décoratifs.

### 5.2 Field — `ui/Field.tsx`

```tsx
<Field label="Poids" hint="En grammes, pesée à jeun" error={errors.weight} required>
  <input type="number" inputMode="decimal" className="font-mono" />
</Field>
```
Relie `label`/`id`, pose `aria-describedby`, `aria-invalid`, `required`. Jamais de placeholder à
la place du libellé.

### 5.3 Card — `ui/Card.tsx`

`<Card as="section" title="Traitements" titleId="traitements" actions={…}>` — surface + filet +
rayon 10, **aucune ombre**. `tone` : `surface` | `sunken` | `outline` ; `padding` : `none` | `sm` |
`md` | `lg` ; `interactive` pour une carte-lien. Jamais de carte dans une carte.

### 5.4 Badge, IucnBadge, IucnScale — `ui/Badge.tsx`

`<Badge tone="warn" dot>À faire</Badge>` (neutral | accent | ok | warn | danger | info) ;
`<IucnBadge category="VU" label={…} />` ; `<IucnScale category="EN" labels={…} />`. Échelle
officielle EX → LC (+ DD, NE), couleurs de la Liste rouge, libellés traduits par l'appelant.

### 5.5 EmptyState — `ui/EmptyState.tsx`

Un constat, **un bénéfice**, **une action**, cadre en pointillés (page de carnet vierge).
`headingLevel={1}` pour une page introuvable, `illustration` pour une silhouette.

### 5.6 Skeleton — `ui/Skeleton.tsx`

`<SkeletonGroup label="Chargement du carnet…">` + `<Skeleton>` / `<SkeletonText>` à la forme du
contenu (`role="status"`, `aria-busy`). Préféré au `Spinner`.

### 5.7 SectionHeader — signature « planche naturaliste »

```tsx
<SectionHeader title="Boa constricteur" latin="Boa constrictor" authority="Linnaeus, 1758"
  marginNote="GBIF 2435099" marginLabel="Identifiant GBIF"
  description="Grand serpent constricteur d'Amérique centrale et du Sud."
  actions={<Button>Ajouter un animal de cette espèce</Button>} />
```
Titre Fraunces, binôme latin italique, **double filet à l'encre** (2 px + 1 px), identifiant mono
en marge (au-dessus du titre en mobile). `level` 1-2 : double filet ; 3 : filet simple. En-tête
de **toute** page (app, légales, transparence, page publique), jamais dans une carte.

### 5.8 CareTimeline — signature « frise à l'encre »

`<ol>` chronologique, trait vertical continu, pastille dont **la forme** porte le statut (pleine
cochée = fait, anneau + point = à faire, losange = en retard, anneau = prévu, anneau barré =
sauté) et libellé écrit ; date en mono (« mer. 30 sept. », colonne 7,25 rem en bureau, jamais
coupée), jour répété seulement au changement de jour. `background="paper"` hors carte. Utilisée
par le tableau de bord, l'agenda, la fiche animal, le carnet et la landing.

### 5.9 AnimalSilhouette — `ui/AnimalSilhouette.tsx`

`<AnimalSilhouette kind={silhouetteKindOf(species.class)} size={64} className="text-ink-3" />` —
`reptile | bird | mammal | amphibian | fish | invertebrate | other`, au trait 1,5 px. Remplace
toutes les vignettes « dégradé + initiale » et les icônes dans des carrés pastel.

### 5.10 Figure et CommonsPhoto — photos

```tsx
<Figure src=… alt="Boa constricteur enroulé" ratio="4/3" treatment="grain" fallbackKind="reptile"
  credit={{ author, license, sourceUrl, licenseUrl }} />
<CommonsPhoto photo="catStraw" ratio="3/2" />   // photothèque : AVIF/WebP, alt traduit, crédit
```
`Figure` : ratio fixe (pas de CLS), `loading="lazy"` (sauf `priority`), coins 6 px, traitement
`none | grain | duotone`, légende + crédit **obligatoire** (le typage refuse une photo sans
`credit`, sauf `userPhoto` : photo de l'animal prise par son propriétaire), repli en silhouette.
`creditPlacement` : `caption` (défaut) | `overlay` | `external`. Photos de `public/images/` :
`photoSources(clé)` (`src/content/photos.ts`) ou directement `CommonsPhoto` (`src/components`),
dont les textes alternatifs (`landing.photos.*`) sont transmis au navigateur par le layout.

### 5.11 Composants du quotidien — `ui/AnimalCard`, `Pills`, `Alert`, `Tip`, `Offer`, `MediaCard`

| Composant | Rôle | Règles |
| --- | --- | --- |
| `AnimalCard` | Carte d'animal : photo ou silhouette, nom Fraunces, latin italique, pastilles, 2-3 faits datés en mono | Toute la carte est un lien |
| `TaskPill` | « 3 soins aujourd'hui » | Le nombre en mono est le message ; `warn` / `ok` / `danger` |
| `Alert` | `info` / `warning` / `urgent` | Filet gauche + aplat léger, pictogramme rond / triangle / losange ; `urgent` → `role="alert"` ; une action au plus |
| `Tip` | « Bon à savoir » tiré de la fiche espèce | Note de marge, source en mono, jamais d'aplat coloré |
| `Steps` | Ajout du premier animal (espèce, nom et naissance, premiers soins) | `<ol>`, `aria-current="step"`, « Étape 2 sur 3 » en mono |
| `LockedSlot` | À la place de « Ajouter un animal » à la limite | Pointillés + cadenas au trait ; la valeur avant le prix ; jamais de flou ni de modale imposée |
| `PremiumBadge` | Mention Premium | Mono, filet, losange ; ni couronne, ni doré, ni dégradé |
| `GuestBanner` | « Sauvegardez vos données » (invité) | En tête du contenu, masquable, aplat creusé |
| `MediaCard` | Base des cartes à média, dont les publications de la communauté à venir | Données de santé jamais affichées dans une publication |

### 5.12 Modal, Toast, erreurs

`Modal` (Radix, focus piégé, `alertdialog` pour les suppressions) : surface, filet, rayon 10, fond
`--scrim` sans flou, titre Fraunces `text-h3`. Erreurs de rendu (`[locale]/error.tsx` dans
`MarketingFrame`, `ErrorBoundary`) : page de carnet en pointillés avec filet brique, constat + « Réessayer », jamais
le message technique (seul le `digest` est montré). `global-error.tsx` reprend la palette en
valeurs fixes (il remplace tout le document).

## 6. Mises en page de référence

### 6.1 Trois cadres, un par groupe de routes

Le layout `src/app/[locale]/layout.tsx` ne pose aucun cadre : polices, fournisseurs (`AuthProvider`,
next-intl), `ErrorBoundary`, `NativeWelcome` et `NativeBridge` seulement. Chaque groupe de routes
apporte le sien (les groupes ne changent pas les URL) :

| Groupe | Cadre | Pages |
| --- | --- | --- |
| `(marketing)` | `MarketingFrame` (`components/frames`) | landing, pages légales, transparence, suppression de compte, **page publique d'un animal** |
| `(auth)` | `AccountFrame` (`components/frames`) | connexion, inscription, mot de passe oublié / nouveau, vérification d'e-mail, `/sauvegarder` |
| `(app)` | `AppShell` | mes animaux, agenda, espèces, fiche espèce, paramètres, abonnement, magasin, communauté |
| (hors groupe) | `MarketingFrame` apporté par le fichier | `error.tsx`, `not-found.tsx` (et `[...rest]`, qui déclenche la 404) |

`error.tsx` et `not-found.tsx` de `[locale]` remplacent le layout du groupe où l'erreur survient et
sont rendus directement dans le layout `[locale]` : ils importent donc eux-mêmes `MarketingFrame`
(en-tête, `<main>`, pied : l'internaute garde les chemins de retour). Chaque cadre porte son
`<main id="main-content">`, le lien d'évitement et le bandeau de vérification d'e-mail
(`EmailVerificationBanner`, masqué sur `/verifier-email`) ; il n'y a plus de composant qui devine le
cadre d'après le segment.

- **Marketing** (`MarketingHeader` = `AppHeader`, `MarketingFooter` = `SiteFooter`) : en-tête papier
  plein, filet, page active soulignée ; navigation complète dès 1024 px (invité) et 1200 px
  (connecté), menu en feuille modale en dessous. Un invité y voit un pictogramme de profil au trait,
  jamais d'initiales factices. Pied : marque, liens légaux en colonnes, copyright en mono,
  **aucune mention d'affiliation** (aucun lien affilié affiché). `SiteFooter` n'est ni `async` ni
  `'use client'` (`useTranslations`) pour servir aussi `error.tsx`, composant client.
- **Compte** (`AccountFrame`) : cadre **sobre**. En-tête : marque, « Retour à l'accueil » (dès
  640 px ; en dessous la marque suffit) et sélecteur de langue ; ni navigation du site ni boutons
  « Connexion / S'inscrire », qui doubleraient le formulaire. Pied : trois liens légaux (mentions,
  confidentialité, conditions) et le copyright en mono, sur une ligne. Le formulaire et sa planche
  (`AuthFrame`, § 6.6) occupent la page.
- **App** (`AppShell`, groupe `(app)`) : mes animaux, agenda, espèces, fiche espèce, paramètres,
  abonnement, magasin. < 1024 px : barre haute + **onglets en bas** (Mes animaux, Agenda,
  Espèces, Communauté « Bientôt » sans lien, Compte), 60 px + `safe-area-inset-bottom`. ≥ 1024 px :
  **rail** 240 px. « Communauté » ne devient un lien que si l'API répond (§ 6.9), sinon « Bientôt »
  sans lien. Pied du rail : profil ou « Invité · Créer un compte » (lien discret, jamais
  de modale). `AppShell` rend `<main id="main-content">` et le lien d'évitement ; le layout `(app)`
  place le bandeau de vérification d'e-mail en tête du contenu.

### 6.2 Tableau de bord « Aujourd'hui » (`/mes-animaux`)

`GuestBanner` (invité) → `SectionHeader` « Aujourd'hui » (date en marge) → `TaskPill`s → alertes
graduées (`lib/today.ts` : vaccin dépassé → `urgent`, sous 30 j → `warning`, traitement en cours
→ `info`, pesée > 90 j → `warning`) → grille 7/5 : frise des 7 prochains jours | `AnimalCard`,
`LockedSlot`, `Tip`. Le `Tip` « Bon à savoir » lit la prévention de la fiche santé
(`editorial.diseases[].prevention`) ou, à défaut, les plages de l'habitat (`tempMin/tempMax`,
`humidityMin/humidityMax`, mises en forme par `formatRange`), un conseil par jour à tour de rôle.
Premier lancement (aucun animal) : `Steps` dans une carte, et à droite une **photo Commons**
créditée + trois raisons numérotées.

### 6.3 Fiche animal et carnet

En-tête planche (photo, `SectionHeader`, binôme latin lié à la fiche espèce, n° GBIF en marge),
bandeau de synthèse (âge, pesée, rendez-vous, traitement, rappel) visible sans défiler à
1440 px, frise des derniers repères et prochaines échéances, sections en `Card` avec listes datées
au format long court, formulaires en `Modal` + `Field`. Sous 1024 px, barre d'actions collante.
Le **carnet imprimable** (`carnet/`) ne lit aucun jeton : palette papier / encre en valeurs fixes,
reste clair en sombre, masque la coquille à l'impression.

### 6.4 Espèces : recherche et fiche

`/especes` : recherche pendant la frappe (≥ 2 caractères, 350 ms), filtres par groupe, texte et
groupe dans l'URL, cartes illustrées (photo GBIF sous licence libre ou silhouette). Fiche
`species/[id]` : planche (photo créditée, binôme, autorité, n° GBIF), sections ancrées en cartes
(alimentation, habitat, comportement, santé, reproduction, législation, matériel, sources),
sommaire collant en bureau, une seule action principale (« Ajouter un animal de cette espèce »).
Sous l'en-tête, en mono discret : « Fiche vérifiée le 2 oct. 2026 » (`lastReviewedAt`, date
localisée par `useFormatter`), rien si la fiche n'a pas été relue (`null`).
Santé : références **PubMed** sous « Articles de PubMed (NCBI), en anglais », titres en
`lang="en"`, liens externes `rel="noopener noreferrer"` avec mention « nouvel onglet », renvoi
depuis la section Sources. Matériel : liste sans lien marchand.

### 6.5 Outils et compte

- **Agenda** : une seule `CareTimeline`, période en contrôle segmenté (`aria-pressed`), filtres
  en `Field`, abonnement calendrier en trois étapes numérotées dans la colonne de droite.
- **Paramètres** : table des matières numérotée en mono + carte du profil ; chaque sous-page
  s'ouvre sur `SettingsHeader` (retour + `SectionHeader`). Compte en `Card`s, suppression dans un
  encart brique confirmé en `alertdialog`. Rappels : résumé mono par rappel, interrupteur
  `role="switch"`, canal en boutons radio natifs.
- **Abonnement** : deux `PlanCard`s, comparatif en vrai `<table>`, trois questions ; aucun prix.
- **Grade** : sceau au trait (`GradeSeal`), barre fine `accent`, cinq segments.
- **Magasin** : sans boutique, un `EmptyState` renvoie aux fiches ; la mention d'affiliation
  n'apparaît qu'à côté de liens réels.

### 6.6 Écrans de compte (`(auth)`, `AuthFrame`)

Cadre `AccountFrame` (§ 6.1), puis, dans la page, `AuthFrame`. Connexion, inscription, mot de passe oublié / nouveau, vérification d'e-mail, `/sauvegarder` :
formulaire sur le papier à gauche (`Field`, `Button`, `Alert`) ; dès 1024 px, une **planche**
(`AuthPanel` : papier creusé + grain) ouverte par une **photo Commons créditée** — chat
(connexion), perruches (inscription), lapin (mot de passe), calopsittes (vérification), gecko
(`/sauvegarder`, avec ce que l'invité conserve) — puis trois raisons numérotées en mono.
« Essayer sans compte » reste en vue sous la connexion et l'inscription, après un séparateur
« ou ».

### 6.7 Landing (`(marketing)/page.tsx`, `src/components/landing/`)

Accroche + aperçu réel de l'écran « Aujourd'hui » → quatre aperçus (carnet, agenda, fiche,
communauté « Bientôt ») → espèces en photos → trois étapes → offre (Sans compte / Gratuit /
Premium) → confiance → recherche de fiches → FAQ → dernier appel. Aperçus composés avec les vrais
composants et les données fixes de `landing/sample.ts` dans `PreviewFrame` (illustration
`aria-hidden`, légende et crédits). Sections sous la ligne de flottaison montées à l'approche
(`DeferredMount`) et en `content-visibility: auto`. Textes : `docs/MESSAGING.md`.

### 6.8 Pages légales, transparence, page publique, 404

- **Légales** (`content/legal`) et **transparence**, **suppression de compte** : `SectionHeader`
  (date de mise à jour en description), avertissements en `Alert`, sections numérotées en mono
  (`01 Éditeur du service`), sommaire en colonne collante dès 1024 px, texte limité à
  `max-w-prose`. Marqueurs « [À COMPLÉTER : …] » surlignés `bg-warn-soft` + filet ocre.
- **Page publique d'un animal** (`(marketing)/animal-public`, jamais indexée) : `Figure` (photo du
  propriétaire ou silhouette), binôme latin, faits en filets, vaccins datés en mono, lien discret vers
  l'essai sans compte. Cadre marketing : la personne qui reçoit un lien découvre le site.
- **404** : page de carnet en pointillés, silhouette d'oiseau « fig. 404 », un bouton, dans
  `MarketingFrame`.

### 6.9 Communauté (`(app)/communaute`, `src/components/community/`)

- **Ouverture** : drapeau de build `NEXT_PUBLIC_COMMUNITY_ENABLED` + sonde `GET /community/rules`
  (404 = fermée). Fermée : « Bientôt » dans la coquille et page d'annonce, jamais de lien mort.
- **Fil** : `SectionHeader` + un seul bouton plein « Publier » ; filtres type (contrôle segmenté
  `aria-pressed`) et espèce (`Field`), reflétés dans l'URL ; colonne latérale (profil, règles en
  bref, pages personnelles). Pagination : bouton « Voir plus » toujours présent, chargement
  automatique en option (case mémorisée), annonce du nombre d'éléments.
- **Carte de publication** : surface + filet + rayon 10 comme `MediaCard` ; avatar rond (photo ou
  patte au trait, jamais d'initiales), pseudo, date relative en mono ; photos en `Figure userPhoto`
  (sans crédit, `alt` composé à partir de la légende, de l'animal ou de l'auteur) ; texte en
  `PlainText` (texte brut, aucun lien cliquable) ; question en Fraunces ; animal montré : nom,
  espèce, binôme latin, rien d'autre. Pied : « j'aime » (`aria-pressed`, cœur qui se remplit en
  180 ms, coupé sous mouvement réduit), réponses, signalement.
- **États** : squelettes à la forme des cartes ; états vides avec un bénéfice et une action ; refus
  de l'API traduits par code (`CommunityNotice` : invité, e-mail à vérifier, âge, profil, règles,
  suspension datée, limite atteinte, image refusée…), jamais le message brut.
- **Signalement** : `Modal`, liste fermée des motifs en cartes radio (libellé + exemple).
- **Modération** : onglets Radix (signalements, masqués, recours, journal), chaque décision dans
  une modale avec motif et exposé obligatoires ; bouton `danger` pour masquer, supprimer, suspendre.

## 7. Imagerie

- **Seulement des photos sous licence libre vérifiée** : Wikimedia Commons CC0, CC BY, CC BY-SA,
  domaine public ; photos GBIF dont l'auteur est renseigné et la licence reconnue libre (NC, ND,
  « tous droits réservés » refusées). **Jamais d'image générée.**
- Chaque fichier de `public/images/` est inscrit dans `public/images/CREDITS.md` et dans
  `src/content/photos.ts` **avant** usage, et affiché avec son crédit (auteur, licence, source).
- Cadrage : l'animal entier ou la tête, fond naturel, lumière du jour ; pas de mains, pas de
  filigrane. `grain` pour les grandes photos (landing, planches de compte), `duotone` pour des
  bandeaux d'ambiance, `none` sur les fiches (couleurs fidèles).
- Export : AVIF + WebP, 2 à 4 largeurs, plus grande variante ≤ 150 Ko, métadonnées retirées. Une
  seule photo `priority` par page (celle du haut de la landing).

## 8. À ne pas faire

- Variante sombre Tailwind, couleurs Tailwind brutes, couleurs hexadécimales dans les classes
  (hors codes UICN).
- Dégradés, halos flous, grilles décoratives, verre dépoli.
- Icône dans un carré pastel arrondi ; vignette dégradé + initiale ; initiales factices.
- Sur-titres en capitales espacées, y compris en mono.
- Ombres floues sur des cartes ; carte dans une carte ; grands rayons hérités.
- Pilules partout (`rounded-full` réservé aux pastilles et avatars).
- Plus d'un bouton `primary` par zone ; bouton « + Ajouter » centré dans une carte vide
  (utiliser `EmptyState`).
- Animations de survol qui déplacent ; durées > 200 ms.
- Texte en `ink-3` ; information portée par la seule couleur.
- Message technique ou texte brut de l'API à l'écran ; dates « jj/mm/aaaa ».

## 9. Garde-fous

**Motifs interdits** — doit être vide (exécuté par la CI, job `quality`, étape « Garde — motifs de
style interdits ») :

```bash
cd frontend
grep -rnE --include='*.ts' --include='*.tsx' --include='*.css' --exclude-dir=__tests__ --exclude='*.test.*' \
  'dark:|\b(bg|text|border|ring|outline|fill|stroke|from|via|to|divide|decoration|placeholder|shadow)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b|\b(bg|text|border)-(white|black)\b|bg-gradient-|\brounded-(lg|xl|2xl|3xl)\b|\bshadow-(sm|md|lg|xl|2xl)\b|backdrop-blur|\buppercase\b|tracking-(wider|widest)|var\(--captivia-' \
  src mobile
```

Même si un motif échappait au grep, la remise à zéro `--color-*: initial` (§ 4) empêche une
couleur brute de produire du CSS.

**Vérifications d'une livraison** (toutes bloquantes en CI) :

| Vérification | Commande |
| --- | --- |
| Types | `npx tsc --noEmit` |
| Lint (0 erreur, 0 avertissement visé) | `npx eslint "src/**/*.{ts,tsx}" "e2e/**/*.ts" "mobile/**/*.tsx" --no-fix` |
| Unitaires + parité i18n des six langues | `npx jest` |
| Builds | `npm run build`, `npm run build:mobile` |
| Smoke + axe | `NEXT_PUBLIC_API_URL=http://127.0.0.1:4010 npm run build && npx playwright test --project=smoke --project=smoke-mobile` |

`e2e/smoke/a11y.spec.ts` fait échouer le smoke sur toute violation axe **sérieuse ou critique**,
sur toutes les pages (publiques, connectées, invité) et, pour neuf d'entre elles, en sombre.
Avant de fusionner un lot visuel : captures 1440 et 390, clair et sombre, aucun débordement à
320 px.

## 10. Journal des décisions

### 10.1 Lot 1 — fondations

- **Mode sombre par `prefers-color-scheme` à l'origine** ; remplacé par le choix mémorisé clair/sombre/système au § 10.8.
- **Accent sombre clair `#8CC5A2` avec texte foncé** : un vert moyen ne peut pas à la fois porter
  du texte blanc et se lire comme texte sur fond sombre ; on inverse.
- **Pas d'icônes dans la navigation de l'en-tête marketing** ; icônes conservées dans les onglets
  et le rail de l'app (convention mobile, libellé toujours écrit).
- **Fraunces plafonné à 600** (le 700 empâte la serif).
- *Remappage transitoire de la palette Tailwind* : utile pendant la migration, retiré en 10.5.

### 10.2 Lot 2 — fiches et recherche d'espèces

- **Recherche de l'app sur `/especes`** (`(app)/especes`) ; `/species` reste aux fiches (export
  mobile `/species?id=`). Sans critère, toutes les fiches (`kingdom=Animalia`).
- **Fiche `species/[id]` dans `(app)`**, consultable sans compte ; JSON-LD `Taxon` ; hors
  français, titrée par le binôme latin (noms vernaculaires de l'API en français).
- **Photo d'espèce** (`GET /species/:id/media`, `lib/species.ts`) : première image fixe à auteur
  renseigné et licence libre reconnue, servie en https, créditée ; sinon silhouette.
- **Sections** affichées seulement si elles ont du contenu (santé, législation et sources
  toujours) ; valeurs éditoriales traduites (`species.values.*`) ; `needsReview` → « À confirmer ».
  Biome par défaut, onglet Magasin et produits Open Pet Food Facts retirés.
- **Sommaire** collant en bureau, ancres défilables en dessous de 1024 px.

### 10.3 Lot 3 — mes animaux

- **Groupe `(app)`** : `mes-animaux`, `agenda`, `parametres`, `magasin`, `especes`, `species` sous
  `AppShell` ; overlays mobiles déplacés en conséquence.
- **« Aujourd'hui » sur `/mes-animaux`** ; liste complète en vue secondaire
  (`/mes-animaux/liste`) ; ajout d'un animal en `Steps` (page au premier lancement, modale
  ensuite).
- **Alertes graduées** (`lib/today.ts`, testé) ; poids en grammes sous 10 kg.
- **`Figure userPhoto`** : seule exception au crédit obligatoire.
- **Carnet imprimable** en valeurs fixes (document, reste clair en sombre).

### 10.4 Lot 4 — outils et compte

- **Écrans de compte = `AuthFrame`** ; « Essayer sans compte » sous la connexion et
  l'inscription. (Planche sans photo à l'époque : remplacée en 10.5.)
- **Paramètres = table des matières** ; **Compte** en cartes ; **Rappels** : onglets fusionnés.
- **Grade** au trait ; **Agenda** en une frise ; **Abonnement** sans prix codé en dur (le web ne
  vend rien, W6-08) ; **Magasin** vide honnête.

### 10.5 Passe de finition (octobre 2026)

- **Dernières pages migrées** : pages légales, transparence, suppression de compte, page publique
  d'un animal, 404, erreurs, `ErrorBoundary`, `global-error`.
- **Pont « mode sombre », palette remappée, alias `--captivia-*`, `tailwind.config.ts` supprimés** ;
  palette Tailwind remise à zéro (`--color-*: initial`) ; garde-fou grep en CI (§ 9).
- **Photos Commons sur les écrans de compte et l'essai** (`CommonsPhoto`), crédit en légende ;
  `landing.photos` transmis au navigateur par le layout.
- **« Bon à savoir »** : lecture des champs réels de l'API (`tempMin/tempMax`,
  `humidityMin/humidityMax`) via `formatRange` partagé (`lib/units.ts`) ; le jeu d'essai suit.
- **Dates** : format long court partout dans la fiche animal ; colonne de frise élargie.
- **Textes** : « E-mail », plus de « Vous devez / Veuillez / Merci ! / soigner » ; forme d'adresse
  unifiée par langue (§ 2) ; erreurs de connexion traduites.
- **Affiliation** : Amazon retiré du backend (W3-05) ; plus aucune mention « Partenaire Amazon »,
  `api.searchAmazon` supprimé ; transparence et documents légaux formulés au conditionnel (« si
  des liens partenaires sont proposés, ils sont signalés… »), marqueurs « À COMPLÉTER » conservés.
- **Date de vérification** des fiches (`lastReviewedAt`, backend W5-04) sous l'en-tête planche,
  absente si `null` (`ReviewedNote`, testé).
- **PubMed** présenté dans la section santé (« en anglais », `lang="en"`) et cité dans Sources.
- **Invité** : pictogramme de profil au lieu de « ·· » ; lien de la page publique vers l'essai.
- **axe** bloquant dès « serious », toutes pages, clair et sombre.

### 10.6 Communauté, phase 2 (octobre 2026)

- **Destination conditionnelle** : « Communauté » reste « Bientôt » tant que l'API ne répond pas
  (`feature: 'community'` dans `APP_DESTINATIONS`).
- **Texte brut** pour tout contenu de membre (`PlainText`) : ni HTML ni lien cliquable, même une
  URL écrite en clair ; aucun `dangerouslySetInnerHTML` dans le volet.
- **Photos des membres** : `Figure userPhoto`, origine limitée à `NEXT_PUBLIC_MEDIA_BASE_URL` (ou
  l'API) ; image refusée ou masquée (404) → silhouette au trait.
- **Avatar** : photo ronde ou patte au trait sur papier creusé (`rounded-full` autorisé, § 3.3).
- **`cv-pop`** : seule animation ajoutée (« j'aime », 180 ms, échelle, sans déplacement).

### 10.7 Fin de `SiteChrome` (octobre 2026)

- **`SiteChrome` supprimé**, ainsi que `APP_ROUTE_GROUP` / `MARKETING_ROUTE_GROUP` : plus de cadre
  deviné d'après le segment actif. Le layout racine ne garde que `<html>`, polices, fournisseurs,
  `ErrorBoundary`, `NativeWelcome` et `NativeBridge` ; chaque groupe pose son cadre (§ 6.1).
- **Groupe `(auth)` plutôt que `(marketing)`** pour les six écrans de compte. Le cadre marketing
  affichait « Connexion » et « S'inscrire » au-dessus d'un formulaire de connexion ou d'inscription,
  une navigation complète qui détourne d'une tâche à une seule issue, et un pied de six liens plus une
  description, qui pèse plus que le formulaire sur mobile. `AccountFrame` garde la marque, le
  retour et la langue, et un pied d'une ligne ; la planche à photo de `AuthFrame` porte déjà
  l'ambiance, elle n'a pas besoin d'un en-tête chargé. Aucun texte nouveau : « Retour à l'accueil »
  (`errors.backHome`) et les libellés `footer.*` existent dans les six langues.
- **Page publique d'un animal dans `(marketing)`** : le lien arrive par QR ou par partage ; la
  personne ne connaît pas Captivia, l'en-tête complet et le pied légal sont à leur place. Rendu
  identique à l'ancien (captures avant / après).
- **`error.tsx` et `not-found.tsx` importent `MarketingFrame`** : rendus dans le layout `[locale]`
  sans layout de groupe, ils portent leur cadre ; `SiteFooter` devient isomorphe (`useTranslations`)
  pour être importable depuis le composant client `error.tsx`.
- **Export mobile** : les routes miroir de `mobile/app/` suivent les groupes
  (`mobile/app/[locale]/(marketing)/animal-public/`) ; `[...rest]` reste écarté du build.

### 10.8 Choix du thème (octobre 2026)

- **Clair / sombre** : choix explicite depuis les en-têtes du site et des écrans de compte, le rail et la barre haute de l'app ;
  le réglage de Compte propose aussi « Système ». Par défaut, la préférence système est suivie.
- **Persistance** : `localStorage` sur le web et le stockage `Preferences` de Capacitor sur iOS / Android.
  `theme-init.js`, chargé depuis une URL locale en `beforeInteractive`, applique le choix avant
  l'hydratation ; le contrôle de Compte réconcilie le miroir local avec `Preferences` au démarrage.
- **Palette inchangée** : `data-theme` ne fait que sélectionner les deux jeux de jetons existants ;
  les icônes et contrôles utilisent les composants et couleurs tokenisés du système.

- **Compatibilité Netlify** : `beforeInteractive` est déclaré dans le corps du layout ; Next
  l'injecte lui-même dans l'en-tête. Un `<head>` explicite contenant ce script provoquait une
  erreur d'hydratation uniquement sur le déploiement de production, malgré un aperçu valide.

**Reste à faire** (hors design) : dater les aperçus de la landing (`SAMPLE_TODAY`, fixe) si l'on
veut qu'ils suivent le jour courant. La locale `pt` est du
**portugais européen (pt-PT, AO90)** : « palavra-passe », « eliminar », « guardar », « subscrição »,
« ficheiro », « telemóvel », « ecrã », « boletim de saúde » ; adresse en « o seu », impératif à la
3e personne, enclise (« Inscreva-se »), jamais de gérondif (« a fazer », pas « fazendo »).


### 10.12 — Guides d’aménagement (GUI-01, 2026-10-04)

La destination Guides est ajoutée au rail bureau. En mobile, elle dispose d’un onglet sur
une seconde ligne de la barre haute : les cinq onglets du bas conservent leurs zones tactiles.
Les illustrations techniques libres sont présentées entières sur fond clair, avec crédit.
Un plan coté interactif utilise les mesures saisies par la personne ; il ne certifie pas
une dimension minimale pour une espèce. Les accessoires peuvent être placés par la personne
sur la vue de dessus et sont repérés dans une légende ; aucune position n’est préremplie.
Les recommandations numériques restent celles
des fiches espèces sourcées, sans valeur générique de remplacement.

### 10.13 — Catégories photographiques (ESP-02, 2026-10-04)

À la demande du propriétaire, les six grandes catégories de l’onglet Espèces sont des cartes
photographiques verticales. Cette évolution autorise, uniquement pour ces cartes, un dégradé
de lisibilité sur la photo et une ombre diffuse avec légère élévation. Ces effets utilisent
des jetons dédiés ; les polices, couleurs de navigation et deux rayons existants sont conservés.
Les filtres « tout » et arachnides restent disponibles. Un appui affiche les résultats ; un
glissement conserve le défilement vertical natif de la page, sans zone de défilement imbriquée.
Les textures de fond proviennent de photographies libres de matières animales réelles,
créditées. Une répétition par réflexion assure la continuité des bords sans dessiner de faux
poils, plumes ou écailles. Le fond couvre le viewport ; les textes et résultats reposent sur
des surfaces opaques. Les animations et le défilement animé respectent la réduction du mouvement.

Les photos des six cartes sont exportées en 640/1200/1600 px, en 16:9 sans agrandissement. Les textures réelles sont recadrées en 800 × 550 px ; chaque variante AVIF/WebP reste sous 150 Ko. Les plumes roses, écailles vertes et peaux colorées donnent des fonds plus lumineux, dosés à 38 % en clair et 27 % en sombre.
