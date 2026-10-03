/**
 * Formes des réponses Wikidata consommées par le backend (champs lus uniquement).
 */

/** Résultat de `action=wbsearchentities`. */
export interface WikidataSearchItem {
  id: string;
  label?: string;
  description?: string;
  concepturi?: string;
  aliases?: string[];
  match?: unknown;
}

export interface WikidataSearchResponse {
  search?: WikidataSearchItem[];
}

/** Entité Wikidata (`Special:EntityData`) : les sous-objets sont transmis tels quels. */
export interface WikidataEntityRaw {
  id: string;
  labels?: Record<string, unknown>;
  descriptions?: Record<string, unknown>;
  aliases?: Record<string, unknown>;
  claims?: Record<string, unknown>;
  sitelinks?: Record<string, unknown>;
}

export interface WikidataEntityResponse {
  entities?: Record<string, WikidataEntityRaw | undefined>;
}

/** Valeur SPARQL (`{ type, value }`) : seul `value` est lu. */
export interface SparqlValue {
  value?: string;
}

/** Une ligne de résultat SPARQL : variable → valeur (absente si `OPTIONAL` non résolu). */
export type SparqlBinding = Partial<Record<string, SparqlValue>>;

export interface SparqlResponse {
  results?: { bindings?: SparqlBinding[] };
}
