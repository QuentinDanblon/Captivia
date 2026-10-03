import { HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH } from './community.constants';

/**
 * Pseudo public : normalisation, format et mots réservés.
 *
 * Normalisation : NFKC (les variantes pleine chasse « ａｄｍｉｎ » deviennent ASCII), espaces de
 * bord retirés, « @ » initial ignoré. Le pseudo garde sa casse à l'affichage ; l'unicité porte sur
 * la clé en minuscules (`handleKey`, index unique + CHECK SQL).
 */
export const HANDLE_PATTERN = new RegExp(
  `^[A-Za-z0-9_.]{${HANDLE_MIN_LENGTH},${HANDLE_MAX_LENGTH}}$`,
);

/**
 * Mots réservés : comparés à la clé débarrassée des « _ », « . » et chiffres (« Admin_01 » →
 * « admin »). Les racines de `RESERVED_FRAGMENTS` sont refusées où qu'elles apparaissent
 * (« captivia_officiel », « le.moderateur »…) pour empêcher l'usurpation de l'équipe.
 */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  'abuse',
  'aide',
  'anonymous',
  'anonyme',
  'api',
  'bot',
  'communaute',
  'community',
  'contact',
  'dpo',
  'equipe',
  'help',
  'info',
  'legal',
  'me',
  'moi',
  'null',
  'official',
  'officiel',
  'privacy',
  'root',
  'security',
  'securite',
  'staff',
  'support',
  'system',
  'systeme',
  'team',
  'undefined',
  'veterinaire',
  'vet',
  'webmaster',
  'www',
]);

export const RESERVED_FRAGMENTS: readonly string[] = [
  'admin',
  'captivia',
  'moderat',
  'operat',
];

export type HandleCheck =
  | { ok: true; handle: string; key: string }
  | { ok: false; reason: 'invalid' | 'reserved' };

export function normalizeHandle(raw: string): string {
  return raw.normalize('NFKC').trim().replace(/^@/, '');
}

export function handleKey(handle: string): string {
  return normalizeHandle(handle).toLowerCase();
}

export function checkHandle(raw: unknown): HandleCheck {
  if (typeof raw !== 'string') return { ok: false, reason: 'invalid' };
  const handle = normalizeHandle(raw);
  if (
    !HANDLE_PATTERN.test(handle) ||
    /^[._]|[._]$/.test(handle) ||
    /[._]{2}/.test(handle) ||
    /^[0-9._]+$/.test(handle)
  ) {
    return { ok: false, reason: 'invalid' };
  }
  const key = handle.toLowerCase();
  const stripped = key.replace(/[._0-9]/g, '');
  if (
    RESERVED_HANDLES.has(stripped) ||
    RESERVED_FRAGMENTS.some((f) => stripped.includes(f))
  ) {
    return { ok: false, reason: 'reserved' };
  }
  return { ok: true, handle, key };
}
