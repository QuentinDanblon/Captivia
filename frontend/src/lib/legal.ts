/**
 * Informations légales de l'éditeur de Captivia — SOURCE UNIQUE.
 *
 * Toutes les pages légales (mentions légales, confidentialité, CGU, sources),
 * la page Transparence et le pied de page lisent ces constantes. Pour finaliser
 * les documents, il suffit de remplacer chaque valeur `[À COMPLÉTER : …]`
 * ci-dessous par l'information réelle. Tant qu'au moins un marqueur subsiste,
 * chaque page légale affiche le bandeau « Document à faire valider par un
 * professionnel du droit » (voir `hasPendingLegalMarkers`).
 *
 * Les documents doivent être relus par un professionnel du droit avant mise en
 * production, même une fois les marqueurs remplis.
 */

/** Préfixe de tous les marqueurs à remplir par le propriétaire. */
export const LEGAL_MARKER_PREFIX = '[À COMPLÉTER';

export const LEGAL = {
  /** Nom commercial du service (affiché partout). */
  serviceName: 'Captivia',
  /** Dénomination sociale (ou nom et prénom pour un entrepreneur individuel). */
  companyName: '[À COMPLÉTER : raison sociale]',
  /** Forme juridique et capital social (le cas échéant). */
  legalForm: '[À COMPLÉTER : forme juridique et capital social]',
  /** Numéro SIREN / RCS (ou RNE). */
  siren: '[À COMPLÉTER : SIREN]',
  /** Numéro de TVA intracommunautaire (ou mention « non assujetti »). */
  vatNumber: '[À COMPLÉTER : numéro de TVA intracommunautaire]',
  /** Adresse du siège social. */
  address: '[À COMPLÉTER : adresse]',
  /** Téléphone de l'éditeur (exigé par l'article 6 III de la LCEN). */
  phone: '[À COMPLÉTER : téléphone]',
  /** Directeur ou directrice de la publication. */
  publicationDirector: '[À COMPLÉTER : directeur de publication]',
  /** Adresse e-mail de contact (questions générales et demandes RGPD). */
  contactEmail: '[À COMPLÉTER : email de contact]',
  /** Prestataire d'envoi des e-mails transactionnels (ex. réinitialisation du mot de passe). */
  emailProvider: '[À COMPLÉTER : prestataire e-mail]',

  /** Date de dernière mise à jour des documents légaux (format ISO). */
  lastUpdated: '2026-10-02',
  /** Âge minimum pour créer un compte (consentement numérique en France). */
  minimumAge: 15,
} as const;

/** Hébergeurs et sous-traitants techniques (informations publiques des prestataires). */
export const HOSTS = {
  frontend: {
    name: 'Netlify, Inc.',
    address: '512 2nd Street, Suite 200, San Francisco, CA 94107, USA',
    website: 'https://www.netlify.com',
  },
  api: {
    name: 'Render Services, Inc.',
    address: '525 Brannan Street, Suite 300, San Francisco, CA 94107, USA',
    website: 'https://render.com',
    region: 'Francfort (Allemagne, Union européenne)',
  },
  database: {
    name: 'Neon, Inc. (groupe Databricks)',
    website: 'https://neon.com',
    region: 'Francfort (Allemagne, Union européenne)',
  },
} as const;

/** Vrai si la valeur est encore un marqueur à compléter. */
export function isLegalMarker(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(LEGAL_MARKER_PREFIX);
}

/** Liste des champs restant à compléter (utile pour un contrôle avant mise en production). */
export function pendingLegalMarkers(): string[] {
  return (Object.values(LEGAL) as Array<string | number>).filter(
    (value): value is string => isLegalMarker(value),
  );
}

/** Vrai tant qu'au moins un marqueur `[À COMPLÉTER : …]` subsiste. */
export function hasPendingLegalMarkers(): boolean {
  return pendingLegalMarkers().length > 0;
}

/** Adresse e-mail de contact exploitable dans un lien `mailto:` (null tant qu'elle n'est pas renseignée). */
export function contactMailto(): string | null {
  return isLegalMarker(LEGAL.contactEmail) ? null : `mailto:${LEGAL.contactEmail}`;
}

const DEFAULT_LOCALE = 'fr';

/**
 * Construit un chemin interne pour la locale donnée (préfixe « as-needed » :
 * la locale par défaut `fr` n'a pas de préfixe).
 */
export function localizedPath(locale: string, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return normalized;
  return normalized === '/' ? `/${locale}` : `/${locale}${normalized}`;
}

/** Routes des pages légales et associées (sans préfixe de locale). */
export const LEGAL_ROUTES = {
  legalNotice: '/mentions-legales',
  privacy: '/confidentialite',
  terms: '/cgu',
  sources: '/sources-et-licences',
  transparency: '/transparency',
  accountDeletion: '/suppression-compte',
  accountSettings: '/parametres/compte',
} as const;
