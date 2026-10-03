# Captivia — système visuel « carnet de terrain vétérinaire »

Contrat de design établi au lot 1 (fondations) de la refonte. Les lots 2 (vitrine, espèces),
3 (mes animaux) et 4 (outils : agenda, paramètres, abonnement) s'y conforment. Toute entorse se
justifie ici, dans une section « Décisions », avant d'être codée.

Sources de vérité :

| Quoi | Où |
| --- | --- |
| Jetons, palette héritée, styles de base, en-tête, pied, coquille | `src/app/globals.css` |
| Polices | `src/app/[locale]/layout.tsx` (`next/font/google`) |
| Composants | `src/components/ui/*` (barrel `@/components/ui`), `src/components/AppShell.tsx` |
| Crédits photo | `public/images/CREDITS.md` |

---

## 1. Principes

Référence produit : `docs/PRODUCT.md` (à la racine du dépôt). Captivia est **l'app compagnon
du quotidien avec ses animaux** : son centre est *l'animal de l'utilisateur et sa journée*
(soins du jour, prochains rendez-vous, alertes, dernière pesée) — ni un catalogue, ni un site
vitrine. Le design le montre : l'accueil de l'app est un tableau de bord « aujourd'hui »
(§ 5.1), les fiches d'espèces viennent en appui (« Bon à savoir »), la landing est une couche
séparée.

1. **Un carnet de terrain, pas un tableau de bord d'entreprise.** Papier, encre, filets fins. La
   hiérarchie vient de la typographie et des filets, pas d'ombres floues ni de cartes empilées.
2. **Précis avant d'être joli.** Chiffres, unités, dates, sources : « 28-32 °C », « 0,2 ml »,
   « GBIF 2435099 ». Les mesures sont en mono à chiffres tabulaires.
3. **Le vivant au trait.** Photos réelles sous licence libre ; sans photo, une silhouette au trait
   de la classe animale. Jamais de dégradé + initiale, jamais d'image générée.
4. **Une action principale par zone.** Un seul bouton plein (`primary`) par carte ou en-tête.
5. **Accessible par construction.** AA partout (vérifié par script), focus visible au clavier,
   zones tactiles ≥ 44 px, statut jamais porté par la seule couleur, mouvement réduit respecté.
6. **Le sombre est une encre, pas un filtre.** Les composants lisent des jetons ; ils ne
   connaissent pas `dark:`.

## 2. Voix et message

Repris de `docs/PRODUCT.md`, qui fait foi.

**Promesse (une phrase)** : *L'application indispensable dès qu'on a un ou plusieurs animaux :
on y consigne tout, on est guidé et renseigné, on est prévenu des rendez-vous à prendre, et on
en apprend plus sur ses animaux.*

**Quatre piliers** — chaque écran sert au moins l'un d'eux, et le montre :

| Pilier | Ce que c'est | Ce qu'on montre | Composants |
| --- | --- | --- | --- |
| **Tout consigner** | Carnet de santé : vaccins, traitements, pesées, rendez-vous vétérinaires, notes, photos ; historique ; carnet imprimable / partageable | Dates, doses, poids — ce que le vétérinaire demandera | `CareTimeline`, `Card`, `Field`, `Figure` |
| **Être guidé et averti** | Rappels (soins, traitements, vaccins, rendez-vous à prendre), agenda, abonnement calendrier, notifications | La prochaine échéance, l'heure, l'animal concerné | `TaskPill`, `Alert`, `CareTimeline`, `Steps` |
| **Apprendre** | Fiches espèces et races sourcées : alimentation, habitat, comportement, santé, reproduction, réglementation | Les valeurs et leurs sources (GBIF, UICN, CITES…) | `SectionHeader`, `IucnScale`, `Tip` |
| **Partager** *(à venir)* | Photos de ses animaux, questions, commentaires et réponses | Auteur, photo, réactions | `MediaCard` (base), destination « Communauté » réservée |

**Ton** : précis, chaleureux sans mièvrerie, factuel — celui d'un soigneur expérimenté qui
note dans son carnet. **Des chiffres plutôt que des adjectifs** : « 3 soins aujourd'hui »,
« dernière pesée il y a 12 jours ». Phrases courtes, verbes d'action, vouvoiement. On écrit ce
que l'utilisateur gagne (« Captivia rappelle chaque prise à l'heure prévue »), pas ce que
l'app « offre ». Pas de jargon technique visible (« synchronisation API », « token »…).

**Offre, sans agressivité** : invité et compte gratuit = 1 animal ; plusieurs animaux = compte
+ Premium. On montre la valeur (« chaque animal a son carnet et ses rappels ») avant le prix ;
l'invité est invité à créer un compte « pour sauvegarder », jamais bloqué. Passage invité →
compte sans perte de données : le dire (« Kaa et son carnet seront rattachés à votre compte »).

**Formulations interdites** (et leur remplacement) :

| Interdit | Pourquoi | Écrire plutôt |
| --- | --- | --- |
| « révolutionnaire », « ultime », « incroyable », « magique », « intelligent » | adjectifs creux | le fait chiffré : « 120 fiches relues », « rappel 15 min avant » |
| « Découvrez… », « Explorez… », « Plongez dans… » en accroche | cliché d'IA générative | le contenu lui-même : « Boa constricteur — 28-32 °C, 60-70 % » |
| « en quelques clics », « simplement », « facilement » | promesse invérifiable | la durée ou l'étape : « 3 champs à remplir » |
| sur-titres en capitales (« DÉCOUVRIR », « EXPLORER ») | bruit visuel, ton publicitaire | rien, ou un identifiant mono (« Pl. 03 ») |
| émojis, points d'exclamation en série | registre | — |
| conseils médicaux affirmatifs (« soigne », « guérit ») | responsabilité | « à signaler au vétérinaire si… » |
| « IA », « généré », « assistant » | aucune fonction ne le justifie | — |
| « Passez à Premium ! », « Offre limitée », « Débloquez tout » | pression commerciale | la valeur : « Suivez plusieurs animaux, chacun avec son carnet » |
| « Vous devez créer un compte » | culpabilise l'invité | « Sauvegardez vos données : créez un compte, rien n'est perdu » |

Unités : espace insécable avant `%`, `°C`, `g`, `ml` ; virgule décimale en français ; dates
au format de la locale (`Intl.DateTimeFormat`), jamais codées en dur.

## 3. Jetons

Définis sur `:root` (clair) et redéfinis sous `@media (prefers-color-scheme: dark)` — même
mécanique que le variant `dark:` de Tailwind 4 dans ce projet (pas de classe ni d'attribut de
thème). Exposés en utilitaires par `@theme inline` : `bg-paper`, `text-ink-2`, `border-line`…

### Couleurs

| Jeton | Utilitaire | Clair | Sombre | Usage |
| --- | --- | --- | --- | --- |
| `--paper` | `bg-paper` | `#F6F3EC` | `#121714` | fond de page, en-tête, rail |
| `--surface` | `bg-surface` | `#FFFDF8` | `#1A211D` | cartes, champs |
| `--sunken` | `bg-sunken` | `#EFEBE2` | `#222A25` | creux, survol, gabarits |
| `--ink` | `text-ink` | `#1D2B24` | `#ECE8DE` | texte principal, filets « à l'encre » |
| `--ink-2` | `text-ink-2` | `#5B655E` | `#A9B0A8` | texte secondaire, placeholders |
| `--ink-3` | `text-ink-3` | `#80877F` | `#7C857D` | **non textuel** : icônes, silhouettes, séparateurs (≥ 3:1) |
| `--line` | `border-line` | `#E2DCCF` | `#2B3430` | filet fin |
| `--line-strong` | `border-line-strong` | `#CDC5B4` | `#3A4540` | filet appuyé (en-tête, cadre) |
| `--line-field` | `border-line-field` | `#8C8576` | `#6B776F` | bordure de champ, bouton secondaire (≥ 3:1) |
| `--accent` | `bg-accent` | `#2F5D46` mousse | `#8CC5A2` | bouton principal, pastilles |
| `--accent-strong` | `bg-accent-strong` | `#234836` | `#A9D6BA` | survol du principal |
| `--accent-soft` | `bg-accent-soft` | `#E3ECE4` | `#1F3328` | aplat d'accent, élément sélectionné |
| `--accent-text` | `text-accent-text` | `#2F5D46` | `#8CC5A2` | liens, accent en texte |
| `--on-accent` | `text-on-accent` | `#FFFDF8` | `#10201A` | texte sur `accent` |
| `--ok` / `--ok-soft` | `text-ok`, `bg-ok-soft` | `#2F6B4F` / `#E2EEE6` | `#8CC5A2` / `#1E3127` | fait, conforme |
| `--warn` / `--warn-soft` | `text-warn`, `bg-warn-soft` | `#8A5A00` / `#F6EBD2` | `#E3B85C` / `#33291A` | à faire, attention |
| `--danger` / `--danger-soft` / `--danger-strong` | `text-danger`… | `#A63A2A` / `#F7E4DF` / `#8A2F21` | `#F08C7A` / `#3A211C` / `#F5A597` | retard, destruction, erreur |
| `--on-danger` | `text-on-danger` | `#FFFDF8` | `#1A0F0C` | texte sur `danger` |
| `--info` / `--info-soft` | `text-info`, `bg-info-soft` | `#2D5B7A` / `#E1EBF2` | `#8DBBDD` / `#1C2A35` | rendez-vous, information |
| `--focus` | `outline-focus` | `#2F5D46` | `#8CC5A2` | anneau de focus |
| `--scrim` | `bg-scrim` | encre 55 % | noir 70 % | fond de modale |
| `--iucn-ex` … `--iucn-ne` | (via `IucnBadge`) | couleurs officielles de la Liste rouge | idem | statut UICN uniquement |

**Contrastes vérifiés** (script `palette.cjs` du lot 1, 250 paires, 0 échec) — extraits :

| Paire | Clair | Sombre |
| --- | --- | --- |
| ink / paper · surface | 13,3 · 14,5 | 14,8 · 13,4 |
| ink-2 / paper · surface | 5,5 · 6,0 | 8,2 · 7,3 |
| accent-text / paper · surface · sunken | 6,8 · 7,4 · 6,4 | 9,2 · ≥ 8 · ≥ 7 |
| on-accent / accent · accent-strong | 7,4 · 10,1 | ≥ 8 |
| ok · warn · danger · info / leur `-soft` | 5,3 · 5,0 · 5,3 · 6,0 | 7,0 · 7,7 · 6,2 · 7,2 |
| ink-2 / ok · warn · danger · info · accent-soft, sunken (alertes, bandeaux) | ≥ 4,9 | ≥ 6,0 |
| line-field / paper · surface (non-texte, min 3) | 3,3 · 3,6 | 3,9 · 3,5 |
| ink-3 / paper (non-texte, min 3) | 3,3 | 4,8 |
| UICN : CR blanc · EN noir · VU noir · LC noir · EW blanc | 5,1 · 8,3 · 16,6 · 9,7 · 12,4 | identiques |

Toute nouvelle paire texte/fond passe dans le script avant d'être utilisée.

### Typographie

| Rôle | Police | Réglages |
| --- | --- | --- |
| Titres `h1-h3`, noms d'espèces, marque | **Fraunces** (variable) | `opsz` automatique, `SOFT 50`, `WONK 0`, 500-600 ; italique pour les noms latins |
| Interface, texte courant | **IBM Plex Sans** (variable) | 400 texte, 500 libellés et boutons, 600 emphase |
| Mesures, dates, doses, poids, n° de puce, identifiants | **IBM Plex Mono** 400/500 | `font-variant-numeric: tabular-nums slashed-zero` (automatique sur `.font-mono`, `time`, `code`) |

Chargées par `next/font/google` (préchargement du seul sous-ensemble `latin` ; `latin-ext` et
les autres à la demande par `unicode-range`) : fichiers auto-hébergés au build,
compatibles avec l'export statique mobile et la CSP `font-src 'self'`. Variables :
`--font-fraunces`, `--font-plex-sans`, `--font-plex-mono` → utilitaires `font-display`
(alias `font-serif`), `font-sans`, `font-mono`.

**Échelle 1,25, base 16 px** (utilitaires dédiés, l'échelle Tailwind `text-sm/xl…` reste pour
l'existant) :

| Utilitaire | Taille | Usage |
| --- | --- | --- |
| `text-meta` | 12,8 | métadonnées, légendes, crédits |
| `text-ui` | 14 | interface dense, libellés de champ |
| `text-body` | 16 | texte courant (minimum pour un paragraphe) |
| `text-h4` | 20 | titre de carte |
| `text-h3` | 25 | titre de section secondaire, modale |
| `text-h2` | 25 → 31 (fluide) | titre de section |
| `text-h1` | 31 → 39 (fluide) | titre de page |
| `text-display` | 39 → 49 (fluide) | landing uniquement |

Noms latins : `<i lang="la">Boa constrictor</i>` (ou classe `.latin`) — Fraunces italique.
L'autorité (« Linnaeus, 1758 ») reste en romain.

### Grille, espacements, rayons, élévation, mouvement

- **Conteneur** `.cv-container` : 1200 px max, gouttière 24 px (16 px sous 768 px), encoches
  (`env(safe-area-inset-*)`) comprises. **Grille** `.cv-grid` : 12 colonnes
  (`md:col-span-7` / `md:col-span-5` pour un couple contenu/latéral).
- **Espacements** base 4, paliers 4 / 8 / 12 / 16 / 24 / 32 / 48 / 72 → Tailwind
  `1 / 2 / 3 / 4 / 6 / 8 / 12 / 18`. Pas d'autres valeurs.
- **Rayons** : `rounded-control` 6 px (boutons, champs, badges, photos) et `rounded-card`
  10 px (cartes, modales). Les anciens `rounded-lg/xl/2xl` sont remappés sur 6/10/10.
- **Séparation par filets**, pas par ombres. `shadow-overlay` est réservé aux calques
  flottants (modale, menu déroulant). Les anciens `shadow-sm…lg` sont remappés en filet.
- **Mouvement** : 150 ms (`--dur-fast`, défaut des `transition-*`), 200 ms max, courbe
  `--ease`. Tout est coupé sous `prefers-reduced-motion`. Pas de `translateY(-3px)` au survol.
- **Focus** : anneau 2 px `--focus`, décalage 2 px, au clavier seulement (`:focus-visible`).
- **Zones tactiles** ≥ 44 px (`min-h-11`) ; `size="sm"` (36 px) remonte à 44 px sur pointeur
  grossier.

## 4. Architecture CSS (à connaître avant de toucher `globals.css`)

Couches, dans l'ordre : `theme, base, components, utilities, fields`.

1. **`base`** : typographie, liens soulignés dans un `<p>`, focus, champs de formulaire
   (44 px, bordure `--line-field`, flèche de `select` redessinée, `accent-color`). Les
   utilitaires gagnent toujours : `.hidden` masque enfin les `input type=file` (le bug
   « Choose File / No file chosen » venait d'une règle hors couche).
2. **`components`** : en-tête, pied, coquille de l'app, photos, classes `captivia-*` de la
   vitrine et des écrans d'authentification (remappées sur les jetons, halos/grille/double
   bordure supprimés).
3. **`utilities` (fin)** : *pont « mode sombre »* pour les pages non migrées — une classe
   `text-gray-700`, `text-emerald-600`… sans `dark:text-*` et sans fond clair propre reçoit
   l'encre sombre équivalente. Plafonne aussi les titres hérités `font-bold` à 600.
   **Réduit au lot 4** à la seule règle encore utile (`text-emerald-600` sans `dark:text-*`, liens
   de la fiche espèce `species/[id]`) : voir § 11. À supprimer avec la migration de cette fiche.
4. **`fields`** (après les utilitaires) : plancher de contraste des bordures de champ.
   `border-gray-300` (1,6:1) reste à ≥ 3:1. Focus → `--accent`, `aria-invalid` → `--danger`.

**Palette héritée** (`@theme`) : `gray-*` = rampe papier → encre (gray-50 = papier,
gray-800 = surface sombre, gray-900 = papier sombre : l'en-tête et les pages ont enfin le
même fond) ; `emerald-*` et `teal-*` = mousse (un dégradé `from-emerald-600 to-teal-600`
devient un aplat) ; `red/rose` = brique ; `amber/yellow` = ocre ; `blue/sky/indigo` =
ardoise ; `green/lime` = feuille ; `purple/violet/pink` = prune ; `orange` = rouille ;
`white` = `#FFFDF8`. Règle des paliers : 500 et plus foncés portent du texte blanc à ≥ 4,5:1 ;
400 et plus clairs se lisent à ≥ 4,5:1 sur gray-800/900. **Les nouveaux composants
n'utilisent jamais ces noms** : seulement les jetons sémantiques.

## 5. Composants

Import : `import { Button, Card, … } from '@/components/ui';`

### Button — `ui/Button.tsx`

```tsx
<Button>Enregistrer</Button>                                  // primary (une seule par zone)
<Button variant="secondary">Annuler</Button>
<Button variant="quiet" size="sm">Modifier</Button>           // action de faible poids
<Button variant="danger" loading={deleting}>Supprimer</Button> // aria-busy + désactivé
<Link href="/register" className={buttonClasses({ variant: 'secondary' })}>Créer un compte</Link>
```
Tailles `sm` 36 px (44 au doigt), `md` 44, `lg` 48. `type="button"` par défaut. `iconStart`
/ `iconEnd` décoratifs (aria-hidden). `ghost` = ancien nom de `quiet`.

### Field — `ui/Field.tsx`

```tsx
<Field label="Poids" hint="En grammes, pesée à jeun" error={errors.weight} required>
  <input type="number" inputMode="decimal" className="font-mono" />
</Field>
```
Relie `label`/`id`, pose `aria-describedby` (aide + erreur), `aria-invalid`, `required`.
Accepte aussi une fonction enfant `(control) => <MonChamp {...control} />`. Jamais de
placeholder à la place du libellé.

### Card — `ui/Card.tsx`

```tsx
<Card as="section" title="Traitements" titleId="traitements"
      actions={<Button variant="quiet" size="sm">Ajouter</Button>}>…</Card>
```
Surface + filet + rayon 10, **aucune ombre**. `tone`: `surface` | `sunken` | `outline` ;
`padding`: `none` | `sm` | `md` | `lg` ; `interactive` pour une carte-lien.

### Badge, IucnBadge, IucnScale — `ui/Badge.tsx`

```tsx
<Badge tone="warn" dot>À faire</Badge>          // neutral | accent | ok | warn | danger | info
<IucnBadge category="VU" label={t('…VU')} />     // code officiel en couleur + libellé lu
<IucnScale category="EN" labels={iucnLabels} aria-label="Statut UICN" />
toIucnCategory('Least Concern') // → 'LC'
```
Échelle officielle EX, EW, CR, EN, VU, NT, LC (+ DD, NE hors échelle), couleurs de la Liste
rouge. Les libellés sont fournis traduits par l'appelant.

### EmptyState — `ui/EmptyState.tsx`

```tsx
<EmptyState
  title="Aucune pesée enregistrée"
  benefit="Une pesée par mois suffit à repérer une perte de poids avant les premiers symptômes."
  illustration={<AnimalSilhouette kind="reptile" />}
  action={<Button size="sm" onClick={open}>Ajouter une pesée</Button>}
/>
```
Un constat, **un bénéfice**, **une action**. Cadre en pointillés (page de carnet vierge).

### Skeleton — `ui/Skeleton.tsx`

```tsx
<SkeletonGroup label="Chargement du carnet…">
  <Skeleton shape="block" height={180} /><SkeletonText lines={3} />
</SkeletonGroup>
```
Gabarits décoratifs à la forme du contenu ; l'annonce est portée par `SkeletonGroup`
(`role="status"`, `aria-busy`). Préférer au `Spinner`.

### SectionHeader — signature n° 1 « planche naturaliste »

```tsx
<SectionHeader
  title="Boa constricteur" latin="Boa constrictor" authority="Linnaeus, 1758"
  marginNote="GBIF 2435099" marginLabel="Identifiant GBIF"
  description="Grand serpent constricteur d'Amérique centrale et du Sud."
  actions={<Button>Ajouter à mes animaux</Button>}
/>
```
Titre Fraunces, binôme latin italique, **double filet à l'encre** (2 px + 1 px), identifiant
mono dans la marge gauche (au-dessus du titre en mobile). `level` 1-2 : double filet ;
3 : filet simple. Pour un en-tête de page ou de grande section, jamais dans une carte.
Identifiants types : n° GBIF (espèce), n° de puce (animal), « Pl. 03 » (section).

### CareTimeline — signature n° 2 « frise à l'encre »

```tsx
<CareTimeline
  label="Soins des 7 prochains jours"
  statusLabels={{ done: t('…'), due: …, overdue: …, planned: …, skipped: … }}
  allDayLabel={t('agenda.allDay')}
  items={items.map((i) => ({ id: i.id, date: i.date, allDay: i.allDay, title: i.title,
    detail: `${i.animalName} · ${i.detail}`, status: toCareStatus(i), kind: t(`agenda.type.${i.type}`),
    action: <Button size="sm" variant="secondary">Marquer comme fait</Button> }))}
/>
```
`<ol>` chronologique ; trait vertical continu ; pastille dont **la forme** porte le statut
(pleine cochée = fait, anneau + point = à faire, losange = en retard, anneau = prévu, anneau
barré = sauté) et libellé écrit ; date en mono, jour répété seulement au changement de jour.
`background="paper"` si la frise n'est pas dans une carte. À utiliser dans l'agenda (lot 4),
la fiche animal et le carnet (lot 3).

### AnimalSilhouette — `ui/AnimalSilhouette.tsx`

`<AnimalSilhouette kind={silhouetteKindOf(species.class)} size={64} className="text-ink-3" />`
— `reptile | bird | mammal | amphibian | fish | invertebrate | other`, au trait 1,5 px,
`currentColor`. Remplace toutes les vignettes « dégradé + initiale » et les icônes de
catégories dans des carrés pastel.

### Figure (photo) — `ui/Figure.tsx`

```tsx
<Figure src="/images/species/boa-constrictor.jpg" alt="Boa constricteur enroulé sur une branche"
  ratio="4/3" treatment="grain" fallbackKind="reptile" caption="Adulte, Costa Rica"
  credit={{ author: 'Jane Doe', license: 'CC BY-SA 4.0',
            sourceUrl: 'https://commons.wikimedia.org/wiki/File:…',
            licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' }} />
```
Ratio fixe (pas de CLS), `loading="lazy"` (sauf `priority`), coins 6 px, traitement
`none | grain | duotone`, légende + crédit **obligatoire** (le typage refuse une photo sans
`credit`), repli en silhouette sans photo ou en cas d'erreur.

Photos de `public/images/` : passer par `photoSources(clé)` (`src/content/photos.ts`), qui
fournit `src`, `srcSet` WebP et `sources` AVIF → `<picture>` natif (next/image n'optimise pas
ici). Options : `objectPosition` (cadrage dans le ratio), `ratio="fill"` (fond de bandeau,
le parent fixe la hauteur), `creditPlacement` = `caption` (défaut) | `overlay` (cartouche sur
la photo, `creditCorner` `top`/`bottom`) | `external` (le composant englobant affiche le
crédit, ex. légende d'un aperçu d'écran).

### 5.1 Tableau de bord « aujourd'hui » (accueil de l'app, invité ou connecté)

L'accueil de l'app est la journée de l'animal. Composition de référence (lot 3) :

```tsx
<GuestBanner title="Sauvegardez vos données" description="Kaa et son carnet sont enregistrés sur cet appareil seulement."
  action={<Link href="/register" className={buttonClasses({ size: 'sm' })}>Créer un compte</Link>} dismissLabel="Masquer" />  {/* invité */}
<SectionHeader level={1} title="Aujourd'hui" marginNote="ven. 02 oct." />
<div className="flex flex-wrap gap-2"><TaskPill count={3} label="soins aujourd'hui" /><TaskPill count={1} tone="danger" label="en retard" /></div>
<Alert severity="warning" title="Bilan annuel à prévoir" action={<Button size="sm" variant="secondary">Prendre rendez-vous</Button>}>
  Kaa — dernière visite il y a 11 mois.
</Alert>
<div className="grid gap-6 md:grid-cols-12">
  <Card className="md:col-span-7" title="Soins du jour"><CareTimeline … /></Card>
  <div className="grid content-start gap-6 md:col-span-5">
    <AnimalCard name="Kaa" latin="Boa constrictor" kind="reptile" href="/mes-animaux/kaa" linkAs={Link}
      status={<TaskPill count={2} label="soins aujourd'hui" />}
      facts={[{ label: 'Dernière pesée', value: '2 340 g · il y a 12 j' }]} />
    <LockedSlot title="Ajouter un deuxième animal" value="Chaque animal a son carnet, ses rappels et son agenda."
      badge={<PremiumBadge label="Premium" />} action={<Link href="/parametres/abonnement" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>Découvrir Premium</Link>} />
    <Tip label="Bon à savoir" source="Fiche Boa constrictor">La mue dure 7 à 10 jours : remontez l'hygrométrie à 70-80 %.</Tip>
  </div>
</div>
```

| Composant | Rôle | Règles |
| --- | --- | --- |
| `AnimalCard` (`ui/AnimalCard.tsx`) | Carte d'animal : photo (ou silhouette), nom Fraunces, latin italique, pastilles, 2-3 faits datés en mono | Toute la carte est un lien (pseudo-élément), actions du pied cliquables |
| `TaskPill` (`ui/Pills.tsx`) | « 3 soins aujourd'hui » | Le nombre en mono est le message ; `warn` s'il reste à faire, `ok` à zéro, `danger` en retard |
| `Alert` (`ui/Alert.tsx`) | Alertes graduées `info` / `warning` / `urgent` (dont « rendez-vous à prendre ») | Filet gauche + aplat léger, pictogramme rond / triangle / losange ; `urgent` → `role="alert"` ; une action au plus |
| `Tip` (`ui/Tip.tsx`) | « Bon à savoir » tiré de la fiche espèce | Note de marge (aside), source en mono, jamais d'aplat coloré |
| `Steps` (`ui/Offer.tsx`) | Onboarding du premier animal (3-4 étapes : espèce, nom et naissance, premier soin) | `<ol>`, `aria-current="step"`, « Étape 2 sur 3 » en mono |
| `LockedSlot` (`ui/Offer.tsx`) | À la place de « Ajouter un animal » quand la limite (1 animal) est atteinte | Case de carnet en pointillés + cadenas au trait ; la valeur avant le prix ; invité → « Créer un compte », gratuit → « Découvrir Premium » ; jamais de flou ni de modale imposée |
| `PremiumBadge` (`ui/Pills.tsx`) | Mention Premium | Mono, filet, losange ; pas de couronne, de doré ni de dégradé |
| `GuestBanner` (`ui/Offer.tsx`) | « Sauvegardez vos données » (invité) | En tête du contenu de l'app, masquable, discret (aplat creusé) |
| `MediaCard` (`ui/MediaCard.tsx`) | Base des cartes à média | Accueille aussi les **publications de la communauté** : `media` = `Figure`, `header` = auteur (avatar initiales + pseudo + date mono), `footer` = réactions et nombre de commentaires. Données de santé jamais affichées dans une publication (partage explicite uniquement) |

### Modal, Spinner, Toast

`Modal` garde son API (Radix, focus, `alertdialog`) ; restylée : surface, filet, rayon 10,
fond `--scrim` sans flou, titre Fraunces `text-h3`. Ne plus passer de `titleClassName`
Tailwind gris dans les nouvelles pages : laisser le défaut.

### En-tête marketing, pied, coquille de l'app

- `MarketingHeader` (= `AppHeader`) et `MarketingFooter` (= `SiteFooter`) : **landing et pages
  légales uniquement**. En-tête papier plein, filet, page active soulignée sur le filet, un seul
  sélecteur de langue. Seuils mesurés (6 langues, 320 → 1920 px, aucune largeur ne déborde) :
  navigation complète à partir de **1024 px** (invité, marge libre min. 181 px en espagnol) et
  **1200 px** (connecté, marge libre min. 94 px en espagnol) ; en dessous, menu en feuille
  modale (focus piégé, Échap). Libellé court « Agenda » (`nav.agenda`).
- `AppShell` (`src/components/AppShell.tsx`) : **toutes les pages de l'app** (mes animaux,
  agenda, espèces/recherche, paramètres, abonnement).
  - < 1024 px : barre haute minimale + **barre d'onglets en bas**, 5 destinations au
    maximum : Mes animaux (tableau de bord du jour), Agenda, Espèces, **Communauté** (réservée,
    marquée « Bientôt », rendue sans lien : `soon: true` dans `APP_DESTINATIONS`), Compte
    (paramètres, abonnement, notifications) ; 60 px + `safe-area-inset-bottom`, onglet actif
    marqué d'un trait sur le filet.
  - ≥ 1024 px : **rail latéral** 240 px (marque, destinations, compte en pied) + contenu.
  - Pied du rail / barre haute : profil (e-mail, déconnexion) ou, **en mode invité**,
    « Invité · Créer un compte » — l'app doit rester utilisable sans compte ; l'invitation à
    créer un compte reste discrète (lien, jamais modale bloquante).
  - Rend lui-même `<main id="main-content">` et le lien d'évitement.

## 6. Imagerie

- **Seulement des photos sous licence libre vérifiée** : Wikimedia Commons CC0, CC BY,
  CC BY-SA (attribution dans la légende), ou domaine public. Licence lue sur la page du
  fichier. NC/ND refusées. **Jamais d'image générée**, jamais de banque d'images sans licence.
- Chaque fichier de `public/images/` est inscrit dans `public/images/CREDITS.md` (auteur,
  licence, URL source) **avant** usage, et affiché via `Figure` avec son crédit.
- Cadrage : l'animal entier ou la tête, fond naturel, lumière du jour ; pas de mains, pas de
  filigrane, pas de texte incrusté. Traitement `grain` pour les grandes photos de la landing,
  `duotone` pour des bandeaux d'ambiance, `none` sur les fiches (couleurs fidèles à l'espèce).
- Sans photo : `AnimalSilhouette` de la classe de l'espèce.
- Export : AVIF + WebP, 2 à 4 largeurs, plus grande variante ≤ 150 Ko, métadonnées retirées
  (`sharp`). Une seule photo `priority` par page (celle du haut de la landing).

### 6.1 Landing (`(marketing)/page.tsx`, `src/components/landing/`)

Ordre : accroche + aperçu réel de l'écran « Aujourd'hui » → quatre aperçus (carnet, agenda,
fiche espèce, communauté « Bientôt ») → espèces en photos → trois étapes → offre (tableau
Sans compte / Gratuit / Premium) → confiance → recherche de fiches → FAQ → dernier appel.
Les aperçus sont composés avec les vrais composants `ui/` et les données fixes de
`landing/sample.ts`, dans `PreviewFrame` (illustration `aria-hidden` sans élément focusable,
description et crédits dans la légende). Sous la ligne de flottaison, leur contenu est monté à
l'approche du viewport (`DeferredMount`, hauteur réservée) et les sections sont en
`content-visibility: auto` (`.cv-deferred`) : le HTML initial et l'hydratation restent légers. Textes : `docs/MESSAGING.md`, namespace `landing`.
Bouton principal → `/mes-animaux` (l'app propose l'essai sans compte).

## 7. À ne pas faire

- Dégradés de couleur (`bg-gradient-*`, `from-*/to-*`), halos flous, grilles décoratives,
  verre dépoli (`backdrop-blur`).
- Icône lucide dans un carré pastel arrondi ; vignette dégradé + initiale.
- Sur-titres en capitales espacées (`uppercase tracking-widest`), y compris en mono.
- Ombres floues (`shadow-lg`, `shadow-xl`) sur des cartes ; carte dans une carte.
- Pilules partout (`rounded-full` est réservé aux pastilles et avatars).
- `dark:` dans un nouveau composant ; couleurs Tailwind brutes (`gray-*`, `emerald-*`…).
- Plus d'un bouton `primary` par zone ; boutons « + Ajouter » centrés dans chaque carte vide
  (utiliser `EmptyState`).
- Animations de survol qui déplacent (`translate`, `scale`) ; durées > 200 ms.
- Texte en `ink-3` ; information portée par la seule couleur.
- Hero « nom de marque géant + slogan + pastilles ».

## 8. Guide de migration (lots 2 à 4)

### 8.1 Séparer les deux couches (à faire au premier lot qui migre une page de l'app)

1. Créer `src/app/[locale]/(marketing)/layout.tsx` : `MarketingHeader`,
   `EmailVerificationBanner`, `<main id="main-content" tabIndex={-1} className="flex-1">`,
   `MarketingFooter`. Y déplacer l'accueil (landing), `cgu`, `confidentialite`,
   `mentions-legales`, `sources-et-licences`, `transparency`, `suppression-compte`, `login`,
   `register`, `forgot-password`, `reset-password`, `verifier-email`, `animal-public`.
2. Créer `src/app/[locale]/(app)/layout.tsx` (client) : `<AppShell>{children}</AppShell>` (+
   `EmailVerificationBanner` en tête du contenu). Y déplacer `mes-animaux`, `agenda`,
   `parametres` (dont abonnement, notifications), `magasin`, et la future recherche d'espèces
   + `species/[id]` (fiche consultée dans l'app ; la version publique SEO reste servie par la
   même route : AppShell est utilisable sans compte).
3. Retirer de `src/app/[locale]/layout.tsx` l'en-tête, le pied et `<main>` : il ne garde que
   `<html>`, polices, providers et `ErrorBoundary`.
4. Les groupes `( )` ne changent pas les URL. Vérifier `scripts/build-mobile.mjs` (chemins
   exclus) et les overlays `mobile/app/[locale]/**` : ils doivent suivre le déplacement.
5. Repointer la destination « Espèces » d'`APP_DESTINATIONS` vers la page de recherche de
   l'app quand elle existe (aujourd'hui `/`).

**État (landing, octobre 2026)** : point 1 fait pour la partie marketing — groupe
`(marketing)` (accueil + pages légales). `login`, `register`, `forgot-password`,
`reset-password`, `verifier-email`, `animal-public` restent hors groupe ; en attendant le
groupe `(app)`, `src/components/SiteChrome.tsx` rend l'ancien cadre pour toutes les pages hors
`(marketing)`. Points 2, 3 et 5 restent à faire.

### 8.2 Correspondances classe → composant/jeton

| Avant (Tailwind brut) | Après |
| --- | --- |
| `bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6` | `<Card>` |
| `<h2 className="text-xl font-bold text-gray-900 dark:text-white">` dans une carte | `<Card title=…>` |
| titre de page `text-2xl/3xl font-bold` + sous-titre | `<SectionHeader level={1} …>` |
| `bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg` | `<Button>` |
| `border border-gray-300 text-gray-700 … rounded-lg` (bouton) | `<Button variant="secondary">` |
| `text-emerald-600 hover:text-emerald-700` (bouton texte « + Ajouter ») | `<Button variant="quiet" size="sm">` |
| `bg-red-600 text-white` | `<Button variant="danger">` |
| `<label>` + `<input className="w-full px-4 py-2 border … focus:ring-2 …">` | `<Field label=…><input /></Field>` (style par la couche base) |
| bloc « Aucun … » + bouton centré | `<EmptyState>` |
| spinner centré | `<SkeletonGroup>` + `<Skeleton>` à la forme du contenu |
| `px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs` | `<Badge tone="accent">` |
| pastille UICN rouge « IUCN: LC » | `<IucnBadge category="LC" label=…>` |
| vignette dégradé + initiale | `<Figure fallbackKind=…>` / `<AnimalSilhouette>` |
| bandeau hero `bg-gradient-to-r from-emerald-600 to-teal-600 text-white` | `<SectionHeader>` sur le papier |
| liste de rendez-vous / prises datées | `<CareTimeline>` |
| `bg-yellow-50 border-l-4 border-yellow-400` (alerte) | `bg-warn-soft text-ink` + filet gauche `shadow-[inset_3px_0_0_var(--warn)]` |
| `text-gray-900 dark:text-white` | `text-ink` |
| `text-gray-600 dark:text-gray-300` / `text-gray-500 dark:text-gray-400` | `text-ink-2` |
| `bg-gray-50 dark:bg-gray-900` (fond de page) | rien (le `body` est déjà `bg-paper`) |
| `border-gray-200 dark:border-gray-700` | `border-line` |
| `font-mono` sur poids/doses/dates | conserver (`font-mono`, chiffres tabulaires) |

### 8.3 Procédure par page

1. Remplacer la structure par `SectionHeader` + `Card`s sur la grille `.cv-container` /
   `md:grid-cols-12`. 2. Remplacer boutons, champs, états vides et chargements par les
   composants. 3. Supprimer **tous** les `dark:` et couleurs brutes de la page (`grep -nE
   "dark:|(gray|emerald|red|amber|yellow|blue|teal|green)-[0-9]"` doit être vide). 4. Relire les
   textes avec la section 2. 5. Vérifier : jest, axe (0 sérieux/critique), captures 1440/390
   clair/sombre, aucun débordement à 320 px.

Quand toutes les pages sont migrées : supprimer le pont « mode sombre » résiduel, la
palette héritée de `@theme`, les classes `captivia-*` inutilisées et `tailwind.config.ts`
(ignoré par Tailwind 4, aucun `@config`). Après le lot 4, restent à migrer : la fiche espèce
`species/[id]`, `animal-public`, `transparency`, `suppression-compte`, `content/legal/*` et
`ui/ErrorBoundary` (la landing et les pages légales relèvent du groupe `(marketing)`).

## 9. Décisions (lot 1)

- **Mode sombre par `prefers-color-scheme`** : c'est déjà la mécanique du variant `dark:` ;
  pas de sélecteur de thème ajouté (aucune préférence utilisateur stockée aujourd'hui).
- **Remappage de la palette Tailwind plutôt que réécriture** : gain immédiat et cohérent sur
  ~2 400 classes sans toucher aux pages ; chaque palier a été recalculé pour que les paires
  réellement employées (`text-emerald-600` sur blanc, blanc sur `bg-emerald-600`,
  `dark:text-gray-400` sur `gray-800`…) passent AA — elles échouaient avant (3,1 à 4,0:1).
- **Accent sombre clair `#8CC5A2` avec texte foncé** : un vert moyen ne peut pas porter à la
  fois du texte blanc et être lisible comme texte sur fond sombre ; on inverse.
- **Pas d'icônes dans la navigation de l'en-tête marketing** ; icônes conservées dans la
  barre d'onglets et le rail de l'app (convention mobile, libellé toujours écrit).
- **« Espèces » remplace « Accueil »** dans la navigation : l'accueil est le guide des espèces,
  le libellé dit ce qu'on y trouve. « Paramètres » passe dans le bloc compte (initiales).
- **Fraunces plafonné à 600** pour les titres hérités en `font-bold` (le 700 empâte la serif).

## 10. Décisions (lot 3 — mes animaux)

- **Groupe `(app)` créé** (§ 8.1, point 2) : `mes-animaux`, `agenda`, `parametres`, `magasin`
  y vivent sous `AppShell` (+ `EmailVerificationBanner` en tête du contenu). Les overlays mobiles
  suivent (`mobile/app/[locale]/(app)/mes-animaux/**`) ; `build-mobile.mjs` ne change pas : les
  groupes ne modifient ni les URL ni l'export.
- **`SiteChrome`, transitoire** : tant que `(marketing)` n'a pas son layout, le layout racine
  passe l'en-tête, le pied et `<main>` à `SiteChrome`, qui les omet pour le segment `(app)`
  (`useSelectedLayoutSegment`) : un seul `<main>`, aucun en-tête doublé. À retirer avec le point 3
  du § 8.1 ; le layout racine ne garde alors que `<html>`, polices, fournisseurs, `ErrorBoundary`.
- **« Aujourd'hui » sur `/mes-animaux`** : l'onglet « Mes animaux » (`APP_DESTINATIONS`, inchangé)
  ouvre directement la journée de l'animal ; toutes les entrées existantes y mènent déjà
  (connexion, inscription, essai sans compte, `NativeWelcome`, conversion invité) et le lien
  `?addSpecies=` des fiches espèces y ouvre l'ajout présélectionné. La liste complète passe en vue
  secondaire, `/mes-animaux/liste` (lien « Tous vos animaux ») : pour l'animal unique d'un invité
  ou d'un compte gratuit, le tableau de bord suffit. Fiche et carnet restent sous `/mes-animaux/…`,
  l'onglet reste donc actif partout, export mobile compris (`detail?id=`, `carnet?id=`).
- **Ajout d'un animal = `Steps`** (`mes-animaux/_components/AddAnimalFlow`) : espèce, puis nom et
  naissance, puis premiers soins (routines recommandées de l'espèce). En page au premier
  lancement, en modale ensuite ; mêmes appels API qu'avant.
- **Alertes graduées** (`lib/today.ts`, testé) : rappel de vaccin dépassé → `urgent`, sous 30 j →
  `warning` ; traitement en cours → `info` ; dernière pesée > 90 j → `warning`, > 30 j ou aucune →
  `info`. Une section non chargée ou refusée ne produit aucune alerte.
- **Poids** : grammes sous 10 kg (« 2 340 g »), kilogrammes au-delà, via `Intl.NumberFormat`.
- **`Figure userPhoto`** : seule exception au crédit obligatoire, la photo de l'animal prise par
  son propriétaire (`alt` toujours requis). `AnimalCard` accepte `ratio` (16/9 dans la colonne du
  tableau de bord) ; `EmptyState` accepte `headingLevel={1}` (fiche introuvable).
- **Fiche** : en-tête « planche » (photo, `SectionHeader` avec binôme latin lié à la fiche
  espèce, n° GBIF en marge) et bandeau de synthèse (âge, pesée, rendez-vous, traitement, rappel)
  visibles sans défiler à 1440 px ; frise construite à partir des données déjà chargées (aucun
  appel ajouté) ; formulaires en `Modal` + `Field`, suppressions en `alertdialog`. Sous 1024 px,
  barre d'actions collante au-dessus de la barre d'onglets (« Peser », « Carnet », modifier,
  supprimer), cibles de 44 px.
- **Carnet imprimable** : même feuille pour l'écran, l'impression A4 et le fichier HTML partagé
  depuis l'app ; elle ne lit donc aucun jeton, reprend la palette papier / encre en valeurs fixes
  (§ 3), reste claire en mode sombre (c'est un document) et masque la coquille de l'app à
  l'impression.

## 11. Décisions (lot 4 — outils et compte)

- **Écrans de compte = `AuthFrame`** (`src/components/auth/AuthFrame.tsx`) : connexion,
  inscription, mot de passe oublié / nouveau, vérification d'e-mail et passage invité → compte
  (`/sauvegarder`). Formulaire sur le papier à gauche (`Field`, `Button`, `Alert` pour les
  messages, `role="alert"` conservé) ; à partir de 1024 px, une planche texturée à droite
  (`AuthPanel` : papier creusé + grain `cv-texture`, silhouettes au trait légendées « fig. »,
  trois raisons de tenir le carnet). **Aucune photo** : `public/images/` n'en contient encore
  aucune sous licence, et jamais d'image générée. `/sauvegarder` remplace la planche par ce qui
  suit l'invité (son animal, le carnet, les rappels, les réglages). Les pages restent hors du
  groupe `(app)` et ne sont pas déplacées : le groupe `(marketing)` les accueillera tel quel.
- **« Essayer sans compte » reste en vue** : sous le bouton de connexion, et désormais aussi
  sous l'inscription, après un séparateur « ou », avec la promesse en une phrase (1 animal, carnet
  complet, rien n'est perdu). Bouton `secondary` pleine largeur, taille `lg`.
- **Paramètres = table des matières** : l'index `/parametres` liste les rubriques numérotées en
  mono (filets, pas de carte à pictogramme pastel) et, à côté, la carte du profil (initiales,
  formule, langue, déconnexion). Chaque sous-page s'ouvre sur `SettingsHeader`
  (`parametres/_components`) : lien de retour + `SectionHeader`.
- **Compte** : profil, mot de passe, appareils connectés et données en `Card` ; la suppression
  vit dans un encart brique (`bg-danger-soft` + filet gauche) et se confirme dans une `Modal`
  `alertdialog` restylée (`Field`, `Button` `danger`). Déconnexion « sur cet appareil » dans la
  colonne de droite ; jamais pour un invité (inchangé).
- **Rappels et notifications** : les onglets « Configurer / Mes notifications » (doublon) sont
  fusionnés : chaque rappel porte son résumé en mono (« 19:30 · Chaque semaine · Vendredi »), un
  interrupteur `role="switch"` nommé par le rappel, ses champs (`Field`) et ses actions. Le canal
  de réception devient un groupe de boutons radio natifs. L'enregistrement automatique est dit
  (« Chaque changement est enregistré automatiquement ») ; le bouton « Enregistrer » reste.
- **Grade** : sceau au trait (`GradeSeal`, cinq losanges pleins jusqu'au rang) à la place des
  médailles en dégradé ; progression en barre fine `accent` ; échelle des cinq grades en
  segments ; rappels du jour en `CareTimeline` avec leurs actions (« C'est fait », « Reporter »,
  « Supprimer »).
- **Agenda** : une seule `CareTimeline` (ordre de `groupByDay`, statuts de `careStatusOf` comme le
  tableau de bord), période en contrôle segmenté (`aria-pressed`), filtres en `Field`, pastilles
  `TaskPill`, période affichée en marge (mono). L'abonnement calendrier passe dans la colonne de
  droite, en trois étapes numérotées, avec l'état du lien en `Badge` ; libellé du bouton honnête
  selon l'état (créer / copier / obtenir un nouveau lien, ce dernier régénérant le jeton comme
  avant).
- **Abonnement** : deux formules côte à côte (`PlanCard`), puis un comparatif en vrai `<table>`
  (« Inclus » / « Non inclus » lus, pas seulement montrés) et trois questions. **Aucun prix codé
  en dur** : les anciennes chaînes `subscription.priceMonthly/priceYearly/…` sont retirées des six
  langues (et de la liste blanche du test de parité) ; Premium affiche « Abonnement mensuel ou
  annuel » et « Tarif affiché dans l'app avant tout achat » (formulations de la landing), le
  tarif réel venant des stores via RevenueCat. Le web ne vend rien (W6-08) ; le comparatif suit
  l'API : 1 animal en gratuit (`FREE_ANIMAL_LIMIT`), carnet complet pour tous (D-16), page
  publique / QR code et reproduction réservés à Premium.
- **Magasin** : le seed de production ne référence aucune boutique. Sans boutique, un
  `EmptyState` le dit et renvoie aux fiches espèces ; ni filtre, ni mention d'affiliation tant
  qu'aucun lien d'affiliation n'est affiché.
- **Pont « mode sombre »** (§ 4) : réduit à `text-emerald-600` (seule classe encore posée sans
  `dark:text-*`, sur les liens de `species/[id]`, hors lot). Classes `captivia-auth-*` supprimées.
- **Smoke** : l'API simulée couvre agenda (jeton calendrier), abonnement, préférences, grade,
  événements et boutiques ; axe passe sur ces pages ; `e2e/smoke/tools.spec.ts` vérifie la frise
  et ses filtres, l'absence de prix et de bouton d'achat, et l'état vide du magasin.
