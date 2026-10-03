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
 * Mots réservés : comparés au « squelette » du pseudo (voir `handleSkeleton` : minuscules, sans
 * « _ » ni « . », leet-speak et sosies ramenés à une lettre — « m0derateur » → « moderateur »,
 * « Captlvia » → « captivia »), et à ce même squelette calculé sans les chiffres (« Admin_01 » →
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

/**
 * Sosies : chiffres et lettres qui imitent une autre lettre (leet-speak). « l » et « i » sont
 * confondus (polices sans empattement), « rn » imite « m ».
 */
const LOOKALIKES: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '2': 'z',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',
  l: 'i',
};

/** Squelette de comparaison aux mots réservés (jamais stocké : la clé reste `handleKey`). */
export function handleSkeleton(value: string): string {
  return value
    .toLowerCase()
    .replace(/[._]/g, '')
    .replace(/rn/g, 'm')
    .replace(/[0-9l]/g, (c) => LOOKALIKES[c] ?? c);
}

const RESERVED_SKELETONS: ReadonlySet<string> = new Set(
  [...RESERVED_HANDLES].map(handleSkeleton),
);
const RESERVED_FRAGMENT_SKELETONS: readonly string[] =
  RESERVED_FRAGMENTS.map(handleSkeleton);

/** Vrai si le pseudo imite un mot réservé (avec ou sans ses chiffres). */
export function isReservedHandle(key: string): boolean {
  const variants = new Set([
    handleSkeleton(key),
    handleSkeleton(key.replace(/[0-9]/g, '')),
  ]);
  for (const v of variants) {
    if (
      RESERVED_SKELETONS.has(v) ||
      RESERVED_FRAGMENT_SKELETONS.some((f) => v.includes(f))
    ) {
      return true;
    }
  }
  return false;
}

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
  if (isReservedHandle(key)) return { ok: false, reason: 'reserved' };
  return { ok: true, handle, key };
}
