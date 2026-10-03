# Contrat de vérification — contenu produit par Haiku

Le contenu des fichiers `out/S*.json` a été rédigé par un modèle rapide, connu pour halluciner (URLs inventées, chiffres plausibles mais faux, statuts légaux devinés). Ta mission : **le vérifier contre les sources réelles et corriger ou supprimer tout ce qui n'est pas confirmé.** Tu es la dernière barrière avant que ces informations soient montrées à des propriétaires d'animaux.

## Méthode (pour chaque animal de tes lots)

1. Charge WebFetch (`ToolSearch` → `select:WebFetch`). **N'utilise pas WebSearch** (quota épuisé).
2. Pour chaque section présente (`feeding`, `habitat`, `behavior`, `health`, `legislation`, `reproduction`, et `description`) :
   - Ouvre avec WebFetch au moins une des URLs de `sources` (en priorité Wikipédia FR/EN de l'espèce ; si l'URL citée ne répond pas ou ne parle pas de CETTE espèce, essaie `https://en.wikipedia.org/wiki/<Genre_espece>`).
   - **Retire de `sources`** toute URL qui ne répond pas, ou qui ne concerne pas cette espèce (ex. une page de poisson citée pour un félin). Garde le format `{type,url,title}`.
   - Contrôle les **faits vérifiables** contre la page : chiffres de reproduction (gestation/incubation, taille de portée, maturité), températures et hygrométrie, régime alimentaire, sociabilité, maladies citées (existent-elles pour ce groupe d'animaux ?), annexe CITES / statut.
   - Si un fait est **contredit** par la source : corrige-le avec la valeur de la source.
   - Si un fait n'est **ni confirmé ni contredit** mais reste plausible et prudent (conseil générique de soin) : garde-le.
   - Si un fait clé est **non confirmable** (chiffre précis, statut légal) : mets le champ à `null` (ou retire l'élément de la liste).
   - Si après nettoyage une section n'a plus aucune source valide, ou si l'essentiel en est faux : remplace la section entière par `null`.
3. **Législation (France)** — exigence maximale :
   - `citesAppendix` / `euAnnex` : uniquement si la page Wikipédia (infobox « CITES ») ou speciesplus.net/cites.org l'indique. Sinon `null`.
   - `status` : `prohibited` seulement si une source le dit explicitement ; une espèce CITES I ou protégée en France/UE → au minimum `permit_required` ; une espèce domestique courante → `allowed`. En cas de doute réel → section `legislation: null` (on préfère ne rien afficher qu'un statut légal faux).
4. Ne rajoute pas de contenu nouveau non sourcé. Tu peux reformuler pour corriger.

## Sortie

- Réécris chaque fichier `out/<LOT>.json` corrigé **en place** (JSON valide, même structure, même ordre). Vérifie : `python3 -c "import json;json.load(open('<fichier>'))"`.
- Écris un rapport `verify/<LOT>.json` : `[{"speciesId": …, "checked": ["feeding",…], "corrected": ["reproduction.gestationDays: 120 → 90 (source …)", …], "removed": ["legislation (statut non confirmé)", "source https://… (404)"], "confidence": "high|medium|low"}]`.
- N'utilise pas git. Ne modifie aucun autre fichier.
- Réponse finale (≤120 mots) : par lot, nombre de corrections, suppressions, et les erreurs les plus graves trouvées.

## Lots « D » (descriptions de races)

Pour chaque entrée de `out/D*.json` ayant une `description` :
1. WebFetch sur `sourceUrl`. Si la page ne répond pas ou ne décrit pas CETTE race (même nom, même espèce animale) → `description: null, sourceUrl: null`.
2. Vérifie chaque affirmation de la description contre la page (origine, gabarit, usage, caractère). Corrige ce qui est contredit, supprime ce qui n'y figure pas. Reste en français, 2-4 phrases, ≤ 500 caractères.
3. **Si tu manques de temps, mets à null les descriptions que tu n'as pas pu vérifier** — aucune description non vérifiée ne doit rester.
Rapport `verify/<LOT>.json` : `[{"speciesId":…,"status":"verified|corrected|removed","note":"…"}]` pour chaque entrée.
