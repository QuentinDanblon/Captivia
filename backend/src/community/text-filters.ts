import {
  LINKS_MIN_ACCOUNT_AGE_DAYS,
  MEDIA_ALT_MAX_LENGTH,
} from './community.constants';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Détection des liens dans un texte libre (anti-spam des comptes récents).
 * Repère les schémas (`http://`, `https://`, `ftp://`), les préfixes `www.`, les liens
 * `mailto:` / `tel:` et les noms de domaine nus suivis d'une extension usuelle (`exemple.com`,
 * `promo.shop/x`). Les nombres décimaux (« 1.5 kg ») et les abréviations (« ex. », « etc. »)
 * ne sont pas des liens.
 */
const SCHEME = /\b(?:https?|ftp):\/\/\S+/i;
const WWW = /\bwww\.[^\s.]+\.\S+/i;
const MAILTO = /\b(?:mailto|tel):\S+/i;
const BARE_DOMAIN =
  /\b[a-z0-9][a-z0-9-]{0,62}(?:\.[a-z0-9-]{1,63})*\.(?:com|net|org|info|biz|fr|be|ch|lu|ca|eu|de|es|it|pt|nl|uk|us|io|co|me|ly|gg|tv|app|dev|xyz|site|online|shop|store|link|click|top|live|ru|cn|tk|ml|ga|cf|gq)\b(?:\/\S*)?/i;

export function containsLink(text: string): boolean {
  const t = text.normalize('NFKC');
  return SCHEME.test(t) || WWW.test(t) || MAILTO.test(t) || BARE_DOMAIN.test(t);
}

/** Vrai si le compte a moins de LINKS_MIN_ACCOUNT_AGE_DAYS jours (liens interdits). */
export function isNewAccount(createdAt: Date, now: Date = new Date()): boolean {
  return (
    now.getTime() - createdAt.getTime() < LINKS_MIN_ACCOUNT_AGE_DAYS * DAY_MS
  );
}

/** Caractère de contrôle à retirer (tout sauf tabulation et saut de ligne). */
function isStrippedControl(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (code < 0x20 && code !== 0x09 && code !== 0x0a) || code === 0x7f;
}

/**
 * Texte normalisé avant stockage : NFC, fins de ligne unifiées, caractères de contrôle retirés,
 * espaces de bord retirés. Le texte reste brut : le client l'affiche en texte, jamais en HTML.
 */
export function cleanText(text: string | null | undefined): string {
  return Array.from((text ?? '').normalize('NFC').replace(/\r\n?/g, '\n'))
    .filter((ch) => !isStrippedControl(ch))
    .join('')
    .trim();
}

/**
 * Texte alternatif d'une image : nettoyé comme les autres textes (`cleanText`), ramené à une seule
 * ligne, tronqué à MEDIA_ALT_MAX_LENGTH ; null s'il est vide.
 */
export function cleanAlt(text: string | null | undefined): string | null {
  const alt = Array.from(cleanText(text).replace(/\s+/g, ' '))
    .slice(0, MEDIA_ALT_MAX_LENGTH)
    .join('')
    .trim();
  return alt || null;
}
