/**
 * Communauté (volet social, phase 2 côté interface) : types des réponses de l'API `/community/*`,
 * appels, classement des erreurs et détection de l'ouverture du volet.
 *
 * Contrat : `backend/src/community/**` (DTO, codes d'erreur `CommunityErrorCode`, présentateur).
 * Règles de sécurité de l'affichage : tout texte venu de l'API est rendu en TEXTE BRUT (jamais de
 * HTML, jamais de lien cliquable), les images ne sont chargées que depuis l'origine des médias
 * autorisée par la CSP (`isAllowedMediaUrl`, src/lib/csp.ts).
 */
import { API_URL } from './config';
import { ApiError, authFetch, isBackendUnavailable } from './api';
import { mediaOriginFor } from './csp';
import { COMMUNITY_BUILD_FLAG } from './community-flag';

// ---------------------------------------------------------------------------------------------
// Types (miroir de backend/src/community/community.presenter.ts et des services)
// ---------------------------------------------------------------------------------------------

export const POST_TYPES = ['PHOTO', 'QUESTION'] as const;
export type CommunityPostType = (typeof POST_TYPES)[number];

/** Catégories d'espèce du filtre (enum Prisma `CommunitySpeciesCategory`). */
export const COMMUNITY_CATEGORIES = ['MAMMAL', 'BIRD', 'REPTILE', 'FISH', 'AMPHIBIAN', 'ARACHNID', 'INSECT', 'OTHER'] as const;
export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

/** Motifs de signalement et de décision : liste fermée (DSA art. 16 et 17). */
export const COMMUNITY_REASONS = [
  'SPAM',
  'HARASSMENT',
  'HATE',
  'VIOLENCE',
  'ANIMAL_WELFARE',
  'ILLEGAL_TRADE',
  'DANGEROUS_ADVICE',
  'NUDITY',
  'PERSONAL_DATA',
  'IMPERSONATION',
  'OTHER',
] as const;
export type CommunityReason = (typeof COMMUNITY_REASONS)[number];

export type ContentStatus = 'VISIBLE' | 'HIDDEN_AUTO' | 'HIDDEN_MODERATOR';

export interface CommunityAuthor {
  handle: string | null;
  avatarUrl: string | null;
}

export interface CommunityMedia {
  id: string;
  url: string;
  width: number;
  height: number;
  /** Description saisie par l'auteur (300 caractères au plus) ; absente : repli composé par `photoAlt`. */
  alt?: string | null;
}

export interface CommunityPost {
  id: string;
  type: CommunityPostType;
  body: string;
  speciesCategory: CommunityCategory | null;
  status: ContentStatus;
  createdAt: string;
  author: CommunityAuthor;
  /** Animal montré par l'auteur : nom et espèce, rien d'autre (jamais le carnet). */
  animal: { name: string; species: string; scientificName: string } | null;
  media: CommunityMedia[];
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  isMine: boolean;
  helpfulCommentId: string | null;
}

export interface CommunityComment {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  status: ContentStatus;
  createdAt: string;
  author: CommunityAuthor;
  isMine: boolean;
  isHelpful: boolean;
  replies?: CommunityComment[];
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export type PostDetail = CommunityPost & { comments: Page<CommunityComment> };

export type IneligibilityReason =
  | 'GUEST_ACCOUNT'
  | 'EMAIL_NOT_VERIFIED'
  | 'COMMUNITY_PROFILE_REQUIRED'
  | 'COMMUNITY_RULES_NOT_ACCEPTED'
  | 'COMMUNITY_SUSPENDED';

export interface MyProfile {
  handle: string;
  avatarUrl: string | null;
  rulesVersion: string;
  rulesAcceptedAt: string;
  suspendedUntil: string | null;
  createdAt: string;
}

/** `GET /community/profile` : mon profil (ou null) et ce qui m'empêche de publier. */
export interface CommunityMe {
  profile: MyProfile | null;
  /**
   * Fin de la suspension de publication en cours (portée par le compte), même sans profil ;
   * null sans suspension. Absente d'une API antérieure : lue comme null.
   */
  suspendedUntil?: string | null;
  currentRulesVersion: string;
  canPublish: boolean;
  reasons: IneligibilityReason[];
  ageConfirmationRequired: boolean;
}

export interface PublicProfile {
  handle: string;
  avatarUrl: string | null;
  memberSince: string;
  postCount: number;
  isMe: boolean;
}

export interface BlockedMember {
  handle: string;
  avatarUrl: string | null;
  blockedAt: string;
}

export type ModerationActionType = 'AUTO_HIDE' | 'HIDE' | 'RESTORE' | 'DELETE' | 'DISMISS' | 'SUSPEND' | 'UNSUSPEND';
export type ModerationTarget = 'POST' | 'COMMENT' | 'USER';
export type AppealStatus = 'NONE' | 'PENDING' | 'UPHELD' | 'REVERSED';

/**
 * Contenu visé par une décision : sa nature, et s'il existe encore (`exists: false` : supprimé, le
 * contenu n'est jamais renvoyé).
 */
export interface DecisionTarget {
  type: ModerationTarget;
  exists: boolean;
}

/** Décision de modération telle que la voit son destinataire (jamais l'opérateur). */
export interface ModerationDecision {
  id: string;
  action: ModerationActionType;
  targetType: ModerationTarget;
  /** Null pour un profil, ou quand le contenu a été supprimé. */
  targetId: string | null;
  /** Côté destinataire (`/community/me/decisions`) ; absent des vues d'opérateur. */
  target?: DecisionTarget;
  reason: CommunityReason | null;
  statement: string;
  automated: boolean;
  suspendedUntil: string | null;
  createdAt: string;
  appealStatus: AppealStatus;
  appealDeadline: string | null;
  canAppeal: boolean;
  appealStatement: string | null;
  appealResolvedAt: string | null;
  contactEmail?: string | null;
}

/** Contenu vu par un opérateur (pseudo de l'auteur, jamais son e-mail). */
export interface ModerationContent {
  targetType: 'POST' | 'COMMENT';
  targetId: string;
  postId: string;
  postType: CommunityPostType | null;
  body: string;
  status: ContentStatus;
  hiddenAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  media: CommunityMedia[];
  authorHandle: string | null;
}

export interface QueueItem extends ModerationContent {
  openReports: number;
  firstReportedAt: string | null;
  reasons: Partial<Record<CommunityReason, number>>;
  details: { details: string | null; reason: CommunityReason; createdAt: string }[];
}

export interface LogItem extends ModerationDecision {
  subjectHandle: string | null;
  operatorHandle: string | null;
  reportCount: number;
  notifiedAt: string | null;
  appealText: string | null;
}

/**
 * Signalement que j'ai émis (`GET /community/me/reports`) : statut et décision prise. Lecture
 * tolérante (une API antérieure répond 404 : la section est alors masquée).
 */
export interface MyReport {
  id: string;
  targetType: 'POST' | 'COMMENT';
  targetId: string;
  reason: CommunityReason | null;
  status: 'OPEN' | 'ACTIONED' | 'DISMISSED';
  createdAt: string;
  resolvedAt: string | null;
  decision: {
    action: ModerationActionType;
    /** Contenu retiré (masqué ou supprimé). */
    contentRemoved: boolean;
    reason: CommunityReason | null;
    decidedAt: string;
  } | null;
}

export interface AppealItem extends ModerationDecision {
  subjectHandle: string | null;
  appealText: string | null;
  content: ModerationContent | null;
}

/**
 * Version du texte des règles affiché par `/communaute/regles` (messages `community.rules.*`).
 * Doit suivre `COMMUNITY_RULES_VERSION` (backend/src/community/community.constants.ts) : quand
 * l'API annonce une autre version, le texte est à mettre à jour avant de la publier.
 */
export const COMMUNITY_RULES_TEXT_VERSION = '2026-10';

/** Bornes alignées sur backend/src/community/community.constants.ts. */
export const COMMUNITY_LIMITS = {
  handleMin: 3,
  handleMax: 30,
  postBody: 2000,
  commentBody: 1000,
  reportDetails: 500,
  statementMin: 10,
  statementMax: 2000,
  appealMin: 10,
  appealMax: 2000,
  photosMin: 1,
  photosMax: 4,
  questionPhotosMax: 1,
  mediaAlt: 300,
  suspensionMaxDays: 365,
  feedPageSize: 20,
} as const;

/**
 * Format d'un pseudo, vérifié avant l'envoi (miroir de `checkHandle`, backend/src/community/handle.ts) :
 * 3 à 30 caractères parmi lettres ASCII, chiffres, « _ » et « . », sans « _ » ni « . » au bord ni
 * doublé, pas uniquement des chiffres. Les mots réservés restent vérifiés par l'API.
 */
export function isValidHandleFormat(raw: string): boolean {
  const handle = raw.normalize('NFKC').trim().replace(/^@/, '');
  return (
    /^[A-Za-z0-9_.]{3,30}$/.test(handle) &&
    !/^[._]|[._]$/.test(handle) &&
    !/[._]{2}/.test(handle) &&
    !/^[0-9._]+$/.test(handle)
  );
}

export function normalizeHandleInput(raw: string): string {
  return raw.normalize('NFKC').trim().replace(/^@/, '');
}

// ---------------------------------------------------------------------------------------------
// Ouverture du volet : drapeau de build + détection par l'API
// ---------------------------------------------------------------------------------------------

export { COMMUNITY_BUILD_FLAG, parseCommunityFlag, type CommunityBuildFlag } from './community-flag';

export type CommunityAvailability = 'unknown' | 'available' | 'unavailable';

/**
 * Interprète la réponse de la sonde `GET /community/rules`, envoyée SANS session :
 *  - 404 : `COMMUNITY_ENABLED=false` côté serveur (premier garde, avant l'authentification) ;
 *  - 200, 401, 403 : les routes existent (401 = authentification exigée, donc volet actif) ;
 *  - autre (5xx, 429…) : on ne sait pas ; la destination reste « Bientôt », sans lien mort.
 */
export function availabilityFromStatus(status: number): CommunityAvailability {
  if (status === 404) return 'unavailable';
  if (status === 200 || status === 401 || status === 403) return 'available';
  return 'unknown';
}

const PROBE_TIMEOUT_MS = 8_000;
const AVAILABILITY_CACHE_KEY = 'captivia.community';
/**
 * Durée de validité du résultat de la sonde. Le navigateur journalise toujours la réponse 404
 * (volet fermé) ou 401 (sans session) dans la console : une ouverture est gardée 12 h dans ce
 * navigateur ; une fermeture est recontrôlée après une minute. Une page de
 * la communauté qui reçoit une réponse le corrige aussitôt (`markCommunity*`). En production,
 * `NEXT_PUBLIC_COMMUNITY_ENABLED=false` supprime toute sonde tant que le volet est fermé.
 */
export const AVAILABILITY_CACHE_TTL_MS = 12 * 3_600_000;
/** Une fermeture est recontrôlée rapidement pour rendre une nouvelle ouverture visible. */
export const UNAVAILABLE_CACHE_TTL_MS = 60_000;

/** Sonde l'API (une requête, sans jeton : jamais de déconnexion ni de rafraîchissement). */
export async function probeCommunity(fetchImpl: typeof fetch = fetch, apiUrl: string = API_URL): Promise<CommunityAvailability> {
  try {
    const signal =
      typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(PROBE_TIMEOUT_MS) : undefined;
    const response = await fetchImpl(`${apiUrl}/community/rules`, { method: 'GET', signal, credentials: 'omit' });
    return availabilityFromStatus(response.status);
  } catch {
    return 'unknown';
  }
}

function readCachedAvailability(now: number = Date.now()): CommunityAvailability {
  try {
    const raw = localStorage.getItem(AVAILABILITY_CACHE_KEY);
    const cached = raw ? (JSON.parse(raw) as { value?: unknown; at?: unknown }) : null;
    const ttl = cached?.value === 'unavailable' ? UNAVAILABLE_CACHE_TTL_MS : AVAILABILITY_CACHE_TTL_MS;
    if (!cached || typeof cached.at !== 'number' || now - cached.at >= ttl || cached.at > now) {
      return 'unknown';
    }
    return cached.value === 'available' || cached.value === 'unavailable' ? cached.value : 'unknown';
  } catch {
    return 'unknown';
  }
}

function writeCachedAvailability(value: CommunityAvailability) {
  try {
    if (value === 'unknown') localStorage.removeItem(AVAILABILITY_CACHE_KEY);
    else localStorage.setItem(AVAILABILITY_CACHE_KEY, JSON.stringify({ value, at: Date.now() }));
  } catch {
    // stockage indisponible : la sonde sera relancée au prochain chargement
  }
}

/** Magasin partagé ; une fermeture est recontrôlée pendant que l'application est visible. */
let availability: CommunityAvailability | null = null;
let probing: Promise<void> | null = null;
const listeners = new Set<() => void>();
let recheckTimer: ReturnType<typeof setInterval> | null = null;

function recheckAvailability() {
  if (document.visibilityState === 'hidden' || COMMUNITY_BUILD_FLAG === 'off') return;
  if (availability !== 'available' && readCachedAvailability() === 'unknown') {
    availability = null;
    ensureCommunityProbe();
  }
}

function setAvailability(value: CommunityAvailability) {
  availability = value;
  writeCachedAvailability(value);
  listeners.forEach((listener) => listener());
}

export function getCommunityAvailability(): CommunityAvailability {
  if (COMMUNITY_BUILD_FLAG === 'off') return 'unavailable';
  if (availability === null) availability = readCachedAvailability();
  return availability;
}

/** Lance la sonde si le résultat n'est pas connu (idempotent). */
export function ensureCommunityProbe(): void {
  if (COMMUNITY_BUILD_FLAG === 'off' || probing) return;
  if (getCommunityAvailability() !== 'unknown') return;
  probing = probeCommunity().then((value) => {
    probing = null;
    setAvailability(value);
  });
}

export function subscribeCommunityAvailability(listener: () => void): () => void {
  listeners.add(listener);
  ensureCommunityProbe();
  if (!recheckTimer && typeof window !== 'undefined' && COMMUNITY_BUILD_FLAG !== 'off') {
    recheckTimer = setInterval(recheckAvailability, UNAVAILABLE_CACHE_TTL_MS);
    window.addEventListener('focus', recheckAvailability);
    document.addEventListener('visibilitychange', recheckAvailability);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && recheckTimer) {
      clearInterval(recheckTimer);
      recheckTimer = null;
      window.removeEventListener('focus', recheckAvailability);
      document.removeEventListener('visibilitychange', recheckAvailability);
    }
  };
}

/** Une page de la communauté a reçu un 404 « volet fermé » : on le mémorise pour la session. */
export function markCommunityUnavailable(): void {
  if (availability !== 'unavailable') setAvailability('unavailable');
}

/** Une route `/community/*` a répondu : le volet est ouvert (la destination devient un lien). */
export function markCommunityAvailable(): void {
  if (COMMUNITY_BUILD_FLAG !== 'off' && availability !== 'available') setAvailability('available');
}

/** Tests uniquement : remet le magasin à zéro. */
export function resetCommunityAvailabilityForTests(): void {
  if (recheckTimer) clearInterval(recheckTimer);
  recheckTimer = null;
  window.removeEventListener('focus', recheckAvailability);
  document.removeEventListener('visibilitychange', recheckAvailability);
  availability = null;
  probing = null;
  listeners.clear();
}

// ---------------------------------------------------------------------------------------------
// Médias
// ---------------------------------------------------------------------------------------------

/**
 * Vrai si l'image est servie par l'origine des médias autorisée en `img-src` (bucket public via
 * `NEXT_PUBLIC_MEDIA_BASE_URL`, sinon l'API elle-même — pilote local). Toute autre URL est
 * remplacée par une silhouette : la CSP ne bloque jamais une image affichée.
 */
export function isAllowedMediaUrl(
  url: string | null | undefined,
  mediaBaseUrl: string | null | undefined = process.env.NEXT_PUBLIC_MEDIA_BASE_URL,
  apiUrl: string = API_URL,
): boolean {
  if (!url) return false;
  const origin = mediaOriginFor({ mediaBaseUrl, apiUrl });
  if (!origin) return false;
  try {
    const parsed = new URL(url);
    return parsed.origin === origin && (parsed.protocol === 'https:' || parsed.protocol === 'http:');
  } catch {
    return false;
  }
}

/**
 * Texte alternatif d'une photo publiée : la description de l'auteur (`media[index].alt`) si elle
 * existe, sinon un repli composé à partir de la légende (tronquée), de l'animal montré, puis de
 * l'auteur.
 */
export function photoAlt(
  post: Pick<CommunityPost, 'body' | 'animal' | 'author'> & { media?: Pick<CommunityMedia, 'alt'>[] },
  index: number,
  total: number,
  labels: { photoOf: (n: number, total: number) => string; byAuthor: (handle: string) => string; fallback: string },
): string {
  const own = post.media?.[index]?.alt?.replace(/\s+/g, ' ').trim();
  if (own) return own;
  const prefix = total > 1 ? `${labels.photoOf(index + 1, total)} · ` : '';
  const caption = post.body.replace(/\s+/g, ' ').trim();
  if (caption) return `${prefix}${caption.length > 120 ? `${caption.slice(0, 119)}…` : caption}`;
  if (post.animal) return `${prefix}${post.animal.name}, ${post.animal.species}`;
  if (post.author.handle) return `${prefix}${labels.byAuthor(post.author.handle)}`;
  return `${prefix}${labels.fallback}`;
}

// ---------------------------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------------------------

/**
 * Date relative courte d'une publication : « il y a 5 min », « hier », puis la date
 * (« 21 sept. », l'année si elle diffère). `justNow` pour moins d'une minute.
 */
export function formatPostTime(iso: string, locale: string, justNow: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const diff = (now.getTime() - date.getTime()) / 1000;
  if (diff < 60) return justNow;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour');
  if (diff < 7 * 86400) return rtf.format(-Math.floor(diff / 86400), 'day');
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).format(date);
}

export function formatLongDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

// ---------------------------------------------------------------------------------------------
// Erreurs
// ---------------------------------------------------------------------------------------------

/**
 * Clé de message (namespace `community.errors`) d'une erreur de l'API. Jamais le texte brut de
 * l'API à l'écran (DESIGN.md § 2) : chaque code connu a son texte, le reste un message générique.
 */
export type CommunityErrorKey =
  | 'network'
  | 'session'
  | 'guest'
  | 'emailNotVerified'
  | 'ageRequired'
  | 'profileRequired'
  | 'profileExists'
  | 'rulesNotAccepted'
  | 'suspended'
  | 'rateLimited'
  | 'linksNotAllowed'
  | 'handleInvalid'
  | 'handleReserved'
  | 'handleTaken'
  | 'mediaType'
  | 'mediaTooLarge'
  | 'mediaInvalid'
  | 'mediaDimensions'
  | 'mediaBusy'
  | 'cannotReportOwn'
  | 'cannotBlockSelf'
  | 'appealNotAllowed'
  | 'bodyRequired'
  | 'invalidParent'
  | 'notAuthor'
  | 'notFound'
  | 'forbidden'
  | 'generic';

const CODE_TO_KEY: Record<string, CommunityErrorKey> = {
  GUEST_ACCOUNT: 'guest',
  EMAIL_NOT_VERIFIED: 'emailNotVerified',
  AGE_CONFIRMATION_REQUIRED: 'ageRequired',
  COMMUNITY_PROFILE_REQUIRED: 'profileRequired',
  COMMUNITY_PROFILE_EXISTS: 'profileExists',
  COMMUNITY_RULES_NOT_ACCEPTED: 'rulesNotAccepted',
  COMMUNITY_RULES_VERSION_MISMATCH: 'rulesNotAccepted',
  COMMUNITY_SUSPENDED: 'suspended',
  COMMUNITY_RATE_LIMITED: 'rateLimited',
  COMMUNITY_LINKS_NOT_ALLOWED: 'linksNotAllowed',
  HANDLE_INVALID: 'handleInvalid',
  HANDLE_RESERVED: 'handleReserved',
  HANDLE_TAKEN: 'handleTaken',
  MEDIA_UNSUPPORTED_TYPE: 'mediaType',
  MEDIA_TOO_LARGE: 'mediaTooLarge',
  MEDIA_INVALID_IMAGE: 'mediaInvalid',
  MEDIA_BUSY: 'mediaBusy',
  COMMUNITY_INVALID_MEDIA: 'mediaInvalid',
  COMMUNITY_CANNOT_REPORT_OWN: 'cannotReportOwn',
  COMMUNITY_CANNOT_BLOCK_SELF: 'cannotBlockSelf',
  COMMUNITY_APPEAL_NOT_ALLOWED: 'appealNotAllowed',
  COMMUNITY_BODY_REQUIRED: 'bodyRequired',
  COMMUNITY_INVALID_PARENT: 'invalidParent',
  COMMUNITY_NOT_POST_AUTHOR: 'notAuthor',
  COMMUNITY_NOT_A_QUESTION: 'generic',
};

export function communityErrorKey(err: unknown): CommunityErrorKey {
  if (isBackendUnavailable(err)) return 'network';
  if (!(err instanceof ApiError)) return 'generic';
  if (err.code && Object.prototype.hasOwnProperty.call(CODE_TO_KEY, err.code)) return CODE_TO_KEY[err.code];
  // Codes à venir ou inconnus : tolérance par famille plutôt qu'un blocage (revue de sécurité du
  // backend : refus des dimensions extrêmes, pseudos réservés plus strictement…).
  const code = err.code ?? '';
  if (/DIMENSION|RATIO|PIXEL/i.test(code)) return 'mediaDimensions';
  if (/^MEDIA_/i.test(code)) return err.status === 413 ? 'mediaTooLarge' : 'mediaInvalid';
  if (/HANDLE/i.test(code)) return err.status === 409 ? 'handleTaken' : 'handleReserved';
  if (/SUSPEND/i.test(code)) return 'suspended';
  if (err.status === 429) return 'rateLimited';
  if (err.status === 413) return 'mediaTooLarge';
  if (err.status === 415) return 'mediaType';
  if (err.status === 401) return 'session';
  if (err.status === 404) return 'notFound';
  if (err.status === 403) return 'forbidden';
  return 'generic';
}

/** Raisons d'inéligibilité → clé d'erreur (même texte qu'un refus de l'API). */
export function reasonToErrorKey(reason: IneligibilityReason): CommunityErrorKey {
  return CODE_TO_KEY[reason] ?? 'generic';
}

// ---------------------------------------------------------------------------------------------
// Appels
// ---------------------------------------------------------------------------------------------

type Json = Record<string, unknown> | unknown[];

async function call<T>(token: string, path: string, init: RequestInit = {}, timeoutMs?: number): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (init.body !== undefined && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await authFetch(`${API_URL}${path}`, { ...init, headers }, timeoutMs ? { timeoutMs } : undefined);
  if (response.status === 204) return undefined as T;
  let data: unknown = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) {
    const body = (data ?? {}) as { message?: unknown; code?: unknown };
    const message = Array.isArray(body.message) ? body.message.join(' ; ') : typeof body.message === 'string' ? body.message : response.statusText;
    throw new ApiError(response.status, message || `HTTP ${response.status}`, typeof body.code === 'string' ? body.code : undefined);
  }
  return data as T;
}

const jsonBody = (value: Json) => JSON.stringify(value);
const enc = encodeURIComponent;

function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export interface FeedFilters {
  category?: CommunityCategory | null;
  type?: CommunityPostType | null;
}

export const communityApi = {
  rules: (token: string) => call<{ version: string }>(token, '/community/rules'),
  me: (token: string) => call<CommunityMe>(token, '/community/profile'),
  activate: (token: string, body: { handle: string; acceptRules: true; rulesVersion: string; ageConfirmed?: boolean }) =>
    call<MyProfile>(token, '/community/profile', { method: 'POST', body: jsonBody(body) }),
  updateProfile: (token: string, body: { handle?: string; avatarMediaId?: string | null; acceptRulesVersion?: string }) =>
    call<MyProfile>(token, '/community/profile', { method: 'PATCH', body: jsonBody(body) }),
  leave: (token: string) => call<void>(token, '/community/profile', { method: 'DELETE' }),

  publicProfile: (token: string, handle: string) => call<PublicProfile>(token, `/community/users/${enc(handle)}`),
  userPosts: (token: string, handle: string, cursor?: string | null) =>
    call<Page<CommunityPost>>(token, `/community/users/${enc(handle)}/posts${query({ cursor, limit: COMMUNITY_LIMITS.feedPageSize })}`),

  blocks: (token: string) => call<{ items: BlockedMember[] }>(token, '/community/blocks'),
  block: (token: string, handle: string) => call<{ handle: string; blocked: true }>(token, `/community/blocks/${enc(handle)}`, { method: 'PUT' }),
  unblock: (token: string, handle: string) =>
    call<{ handle: string; blocked: false }>(token, `/community/blocks/${enc(handle)}`, { method: 'DELETE' }),

  feed: (token: string, filters: FeedFilters, cursor?: string | null) =>
    call<Page<CommunityPost>>(
      token,
      `/community/posts${query({ cursor, limit: COMMUNITY_LIMITS.feedPageSize, category: filters.category, type: filters.type })}`,
    ),
  createPost: (
    token: string,
    body: {
      type: CommunityPostType;
      body?: string;
      mediaIds?: string[];
      /** Description de chaque image, dans l'ordre de `mediaIds` (chaîne vide : aucune). */
      mediaAlts?: string[];
      animalId?: string;
      speciesCategory?: CommunityCategory;
    },
  ) => call<CommunityPost>(token, '/community/posts', { method: 'POST', body: jsonBody(body) }),
  post: (token: string, id: string) => call<PostDetail>(token, `/community/posts/${enc(id)}`),
  deletePost: (token: string, id: string) => call<void>(token, `/community/posts/${enc(id)}`, { method: 'DELETE' }),
  comments: (token: string, id: string, cursor?: string | null) =>
    call<Page<CommunityComment>>(token, `/community/posts/${enc(id)}/comments${query({ cursor, limit: 50 })}`),
  comment: (token: string, id: string, body: { body: string; parentId?: string }) =>
    call<CommunityComment>(token, `/community/posts/${enc(id)}/comments`, { method: 'POST', body: jsonBody(body) }),
  like: (token: string, id: string) => call<{ liked: true; likeCount: number }>(token, `/community/posts/${enc(id)}/like`, { method: 'PUT' }),
  unlike: (token: string, id: string) =>
    call<{ liked: false; likeCount: number }>(token, `/community/posts/${enc(id)}/like`, { method: 'DELETE' }),
  reportPost: (token: string, id: string, body: { reason: CommunityReason; details?: string }) =>
    call<{ reported: true; alreadyReported: boolean }>(token, `/community/posts/${enc(id)}/report`, { method: 'POST', body: jsonBody(body) }),

  deleteComment: (token: string, id: string) => call<void>(token, `/community/comments/${enc(id)}`, { method: 'DELETE' }),
  markHelpful: (token: string, id: string) =>
    call<{ postId: string; helpfulCommentId: string | null }>(token, `/community/comments/${enc(id)}/helpful`, { method: 'PUT' }),
  unmarkHelpful: (token: string, id: string) =>
    call<{ postId: string; helpfulCommentId: string | null }>(token, `/community/comments/${enc(id)}/helpful`, { method: 'DELETE' }),
  reportComment: (token: string, id: string, body: { reason: CommunityReason; details?: string }) =>
    call<{ reported: true; alreadyReported: boolean }>(token, `/community/comments/${enc(id)}/report`, { method: 'POST', body: jsonBody(body) }),

  /** Mes signalements et leur suite ; 404 tant que la route n'existe pas (l'appelant masque la section). */
  myReports: async (token: string, cursor?: string | null): Promise<Page<MyReport>> => {
    const data = await call<unknown>(token, `/community/me/reports${query({ cursor })}`);
    const raw = Array.isArray(data) ? data : ((data as { items?: unknown })?.items ?? []);
    const items = (Array.isArray(raw) ? raw : [])
      .filter((r): r is MyReport => typeof (r as MyReport)?.id === 'string')
      // `decision` absente = pas encore de décision.
      .map((r) => ({ ...r, decision: r.decision ?? null }));
    const next = Array.isArray(data) ? null : (data as { nextCursor?: unknown })?.nextCursor;
    return { items, nextCursor: typeof next === 'string' ? next : null };
  },
  myDecisions: (token: string, cursor?: string | null) =>
    call<Page<ModerationDecision> & { contactEmail: string | null }>(token, `/community/me/decisions${query({ cursor })}`),
  myDecision: (token: string, id: string) => call<ModerationDecision>(token, `/community/me/decisions/${enc(id)}`),
  appeal: (token: string, id: string, text: string) =>
    call<ModerationDecision>(token, `/community/me/decisions/${enc(id)}/appeal`, { method: 'POST', body: jsonBody({ text }) }),

  /** Téléversement (multipart, champ `file`) : renvoie l'identifiant à passer dans `mediaIds`. */
  uploadMedia: (token: string, file: Blob, filename = 'photo.jpg') => {
    const form = new FormData();
    form.append('file', file, filename);
    // Réseau mobile : un envoi d'image peut dépasser les 15 s par défaut.
    return call<CommunityMedia>(token, '/community/media', { method: 'POST', body: form }, 60_000);
  },
};

/** File de modération (opérateurs, e-mail vérifié). */
export const moderationApi = {
  queue: (token: string) => call<{ items: QueueItem[] }>(token, '/community/moderation/queue'),
  hidden: (token: string) => call<{ items: ModerationContent[] }>(token, '/community/moderation/hidden'),
  appeals: (token: string) => call<{ items: AppealItem[] }>(token, '/community/moderation/appeals'),
  log: (token: string, cursor?: string | null) => call<Page<LogItem>>(token, `/community/moderation/log${query({ cursor })}`),
  hide: (token: string, kind: 'posts' | 'comments', id: string, body: { reason: CommunityReason; statement: string }) =>
    call<ModerationDecision>(token, `/community/moderation/${kind}/${enc(id)}/hide`, { method: 'POST', body: jsonBody(body) }),
  remove: (token: string, kind: 'posts' | 'comments', id: string, body: { reason: CommunityReason; statement: string }) =>
    call<ModerationDecision>(token, `/community/moderation/${kind}/${enc(id)}/delete`, { method: 'POST', body: jsonBody(body) }),
  restore: (token: string, kind: 'posts' | 'comments', id: string, body: { statement: string }) =>
    call<ModerationDecision>(token, `/community/moderation/${kind}/${enc(id)}/restore`, { method: 'POST', body: jsonBody(body) }),
  dismiss: (token: string, kind: 'posts' | 'comments', id: string, body: { statement: string }) =>
    call<ModerationDecision>(token, `/community/moderation/${kind}/${enc(id)}/dismiss`, { method: 'POST', body: jsonBody(body) }),
  suspend: (token: string, handle: string, body: { reason: CommunityReason; statement: string; days: number }) =>
    call<ModerationDecision>(token, `/community/moderation/users/${enc(handle)}/suspend`, { method: 'POST', body: jsonBody(body) }),
  unsuspend: (token: string, handle: string, body: { statement: string }) =>
    call<ModerationDecision>(token, `/community/moderation/users/${enc(handle)}/unsuspend`, { method: 'POST', body: jsonBody(body) }),
  resolveAppeal: (token: string, id: string, body: { outcome: 'UPHELD' | 'REVERSED'; statement: string }) =>
    call<ModerationDecision>(token, `/community/moderation/appeals/${enc(id)}/resolve`, { method: 'POST', body: jsonBody(body) }),
};
