# Contrat d'enrichissement — base éditoriale Captivia

Tu complètes des fiches animales existantes de la base Captivia (guide d'élevage pour particuliers, en français).

## Règle d'or : sourcing réel, zéro invention

- Charge d'abord tes outils web : `ToolSearch` avec `select:WebSearch,WebFetch`.
- Chaque section doit avoir dans `sources` au moins 1 URL **réelle que tu as consultée** (WebFetch OK) ou vue dans des résultats WebSearch. **N'invente jamais une URL.**
- Sources conseillées : Wikipédia FR (`https://fr.wikipedia.org/wiki/...`), Wikipédia EN, vcahospitals.com, petmd.com, wamiz.com, sites vétérinaires, guides spécialisés (terrariophilie, aquariophilie, ornithologie), INPN (inpn.mnhn.fr), legifrance.gouv.fr, cites.org / speciesplus.net.
- Si tu ne trouves rien de fiable pour une section : mets-la à `null`. **Ne comble jamais avec du contenu inventé.** Mieux vaut `null` qu'une erreur (c'est une app de soin aux animaux).
- Langue : français, ton factuel et pratique. Pas de copier-coller long (reformule, max ~500 caractères par texte libre).

## Lots « S » (sections manquantes)

Entrée : un tableau d'espèces `{speciesId, commonNameFr, scientificName, category, domesticationType, needDescription, missing: [...]}`.
Ne remplis QUE les sections listées dans `missing` (+ `description`/`sourceUrl` si `needDescription` est vrai).

Schéma exact de chaque section, valeurs autorisées et cas particuliers (reptiles : point chaud/froid, UVB ; poissons : aquarium en litres, température de l'eau ; oiseaux : `incubationDays` et pas `gestationDays`, etc.) :
lis **`/home/user/Captivia/backend/prisma/races-contract.md`** sections « FORMAT DE SORTIE », « VALEURS AUTORISÉES » et « ATTENTION AUX CAS PARTICULIERS ». Utilise exactement ces noms de champs et ces valeurs d'énumération.

Rappels :
- `feeding.recommendedFoods` : au moins 2 recommandations sourcées. `foodsToAvoid` ne contient que des avertissements explicitement documentés et peut rester vide ; l'absence d'avertissement dans une source n'est pas une preuve d'innocuité.
- `health.diseases` : 3 maladies réalistes et documentées pour l'espèce (symptômes, prévention, quand consulter), sinon `health: null`.
- `legislation` (France) : `allowed` | `permit_required` | `prohibited`. Pour une espèce sauvage/exotique, vérifie CITES (annexe I/II/III) et l'annexe UE (A/B) sur speciesplus.net ou cites.org. En cas de doute réel : `null` (ne pas deviner un statut légal).
- `reproduction.breedingDifficulty` : `facile` | `modere` | `avance`.

## Lots « D » (descriptions de races)

Entrée : un tableau de races `{speciesId, commonNameFr, scientificName, category, ...}` (races domestiques : chiens, chats, chevaux, volailles, lapins, etc.).
Pour chacune : `description` = 2 à 4 phrases factuelles en français (origine, gabarit, caractère/usage), max 500 caractères, reformulées depuis une source consultée ; `sourceUrl` = l'URL consultée (Wikipédia FR de préférence, sinon EN ou un club de race officiel). Si la race est introuvable de façon fiable : `description: null, sourceUrl: null`.

## Format de sortie (OBLIGATOIRE)

Écris UN fichier JSON valide (tableau, une entrée par animal de ton lot, dans le même ordre) au chemin indiqué dans ta mission :

```json
[
  {
    "speciesId": 1234567,
    "description": "… ou null (absent si non demandé)",
    "sourceUrl": "https://… ou null",
    "feeding": { … } ,
    "habitat": { … },
    "behavior": { … },
    "health": { … },
    "legislation": { … },
    "reproduction": { … }
  }
]
```

- N'inclus que `speciesId` + les clés demandées (sections de `missing`, et `description`/`sourceUrl` si demandé ou lot D).
- Vérifie la validité du JSON avant de terminer : `python3 -c "import json;json.load(open('<chemin>'))"`.
- N'utilise pas git (ne commit pas, ne push pas). Ne modifie aucun autre fichier.
- Réponse finale : une ligne « lot X : N/M animaux complétés, sections null : … ».

## Lots « G » (comblement des manques, rédacteurs Sonnet) — PREUVE OBLIGATOIRE

Mêmes règles et même schéma que les lots S (champs `missing` + `description`/`sourceUrl` si `needDescription`), avec en plus :
- **Chaque chiffre et chaque affirmation factuelle doit être appuyé par une citation exacte** (copiée mot pour mot) d'une page que tu as ouverte avec WebFetch. Sans citation → le champ reste `null` (ou la section entière `null`).
- `habitat.tempMin`/`tempMax` sont facultatifs : ne les renseigne que si une source donne une plage de température adaptée à l'élevage/la captivité (ou au milieu de vie pour un poisson). Si la source fiable documente d'autres faits d'habitat sans plage thermique, garde les températures absentes et fournis les seuls faits établis.
- Écris AUSSI `verify/<LOT>.json` : `[{"speciesId":…, "evidence":[{"field":"reproduction.gestationDays","value":63,"quote":"…citation exacte…","url":"https://…"}, …]}]`.
- Pas de section `legislation` (réservée à une relecture juridique).

## Lots « H » (deuxième passe de comblement, rédacteurs Sonnet) — mêmes règles que G

Mêmes règles, même schéma et même preuve que les lots G (citation exacte obligatoire, `verify/<LOT>.json`, pas de `legislation`). Différences :
- Les lots d'habitat ne contiennent que les sections réellement manquantes ; ils couvrent les espèces dont une source adaptée documente des faits d'installation, sans exiger un champ thermique absent de la source.
- **Sources à essayer en priorité** (WebFetch) : fiches d'élevage spécialisées — reptilecentre.com (care sheets), reptilesmagazine.com, exo-terra.com (care guides), seriouslyfish.com, fishbase.se, caudata.org, arachnoboards.com / tarantula care sheets, lafeber.com (oiseaux), vcahospitals.com et merckvetmanual.com (santé), animaldiversity.org (reproduction, comportement), Wikipédia FR/EN.
- `health` : `diseases` = au moins 3 maladies **documentées pour l'espèce ou son groupe immédiat** (ex. « chytridiomycose » chez les amphibiens, « maladie osseuse métabolique » chez les reptiles insectivores), chacune appuyée par une citation ; les sous-champs non cités restent `null`.
- `feeding` : il faut au moins deux aliments recommandés cités, un régime, une fréquence valide et une source. `foodsToAvoid` peut rester vide si les sources consultées n'identifient pas d'aliments à éviter ; ne pas en inventer pour remplir la fiche.
- **Isolation** : travaille UNIQUEMENT dans `scratchpad/<ton-lot-en-minuscules>/` (ex. `scratchpad/h003/`). Ne lance jamais un script situé ailleurs, n'écris aucun fichier directement dans `scratchpad/`.
- Avant de terminer, lance le contrôle mécanique : `python3 /home/user/Captivia/backend/prisma/enrichment/check_quotes.py <LOT>` (env `QUOTECHECK_DIR=<ton dossier>/qc`). Toute citation `fail` doit être corrigée (recopiée depuis la page) ou retirée avec le champ qu'elle appuie.
