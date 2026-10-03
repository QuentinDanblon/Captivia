import { sign } from 'crypto';
import type { FcmServiceAccount } from './fcm.config';

/**
 * Client minimal de l'API HTTP v1 de Firebase Cloud Messaging (W6-07), sans SDK :
 * - jeton d'accès OAuth 2.0 obtenu par assertion JWT signée avec la clé du compte de service
 *   (RS256, flux « JWT bearer » de Google), mis en cache jusqu'à 5 min avant son expiration ;
 * - `POST https://fcm.googleapis.com/v1/projects/<id>/messages:send`, un message par jeton.
 *
 * Seuls deux hôtes Google fixes sont appelés (jamais `token_uri` du JSON ni une URL fournie par un
 * client) ; chaque requête a une échéance globale de {@link FCM_REQUEST_TIMEOUT_MS}.
 */

export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
/** Échéance d'un appel à Google (jeton ou envoi) : un service lent ne bloque pas le cron. */
export const FCM_REQUEST_TIMEOUT_MS = 5_000;
/** Le jeton d'accès est renouvelé 5 min avant son expiration. */
const ACCESS_TOKEN_MARGIN_MS = 5 * 60 * 1000;
const ASSERTION_LIFETIME_S = 3600;

export function fcmSendUrl(projectId: string): string {
  return `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
}

/** Sous-ensemble de `fetch` utilisé (injectable pour les tests). */
export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/** Message FCM v1 (champs utilisés par Captivia). */
export interface FcmMessage {
  token: string;
  notification?: { title: string; body: string };
  /** Valeurs obligatoirement chaînes (contrainte FCM). */
  data?: Record<string, string>;
  android?: {
    ttl?: string;
    priority?: 'normal' | 'high';
    collapse_key?: string;
    notification?: {
      channel_id?: string;
      icon?: string;
      color?: string;
      tag?: string;
      sound?: string;
    };
  };
  apns?: {
    headers?: Record<string, string>;
    payload?: { aps: Record<string, unknown> };
  };
}

export type FcmSendResult =
  | { ok: true }
  | {
      ok: false;
      /** Statut HTTP (0 : réseau, délai dépassé ou jeton d'accès indisponible). */
      status: number;
      /** `FcmError.errorCode` (UNREGISTERED, INVALID_ARGUMENT, SENDER_ID_MISMATCH…) ou statut gRPC. */
      errorCode: string | null;
      /** Le jeton d'appareil n'est plus valable : il doit être supprimé. */
      invalidToken: boolean;
      message: string;
    };

const base64url = (input: string | Buffer): string =>
  Buffer.from(input).toString('base64url');

interface GoogleErrorBody {
  error?: {
    code?: number;
    status?: string;
    message?: string;
    details?: Array<{
      '@type'?: string;
      errorCode?: string;
      fieldViolations?: Array<{ field?: string; description?: string }>;
    }>;
  };
}

/**
 * Interprète une réponse d'erreur FCM v1. Jeton à purger :
 * - `UNREGISTERED` (404) : application désinstallée, jeton expiré ou révoqué ;
 * - `SENDER_ID_MISMATCH` (403) : jeton d'un autre projet Firebase ;
 * - `INVALID_ARGUMENT` (400) **visant le jeton** (`fieldViolations` sur `message.token`, ou message
 *   « registration token ») : jeton mal formé. Un `INVALID_ARGUMENT` sur un autre champ signale un
 *   défaut de NOTRE message : on journalise sans purger (sinon un bogue viderait toute la table).
 */
export function classifyFcmError(
  status: number,
  body: unknown,
): Extract<FcmSendResult, { ok: false }> {
  const error = (body as GoogleErrorBody | null)?.error ?? {};
  const details = Array.isArray(error.details) ? error.details : [];
  const fcmCode =
    details.find((d) => typeof d?.errorCode === 'string')?.errorCode ?? null;
  const errorCode =
    fcmCode ?? (typeof error.status === 'string' ? error.status : null);
  const message =
    typeof error.message === 'string' ? error.message.slice(0, 300) : '';

  const tokenTargeted =
    details.some((d) =>
      (d?.fieldViolations ?? []).some(
        (v) => typeof v?.field === 'string' && /(^|\.)token$/.test(v.field),
      ),
    ) || /registration token/i.test(message);

  const invalidToken =
    errorCode === 'UNREGISTERED' ||
    errorCode === 'SENDER_ID_MISMATCH' ||
    (errorCode === 'INVALID_ARGUMENT' && tokenTargeted);

  return { ok: false, status, errorCode, invalidToken, message };
}

export class FcmClient {
  private cached: { token: string; expiresAt: number } | null = null;
  private pending: Promise<string> | null = null;

  constructor(
    private readonly account: FcmServiceAccount,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly now: () => number = Date.now,
  ) {}

  get projectId(): string {
    return this.account.projectId;
  }

  /** Assertion JWT (RS256) échangée contre un jeton d'accès OAuth 2.0. */
  createAssertion(): string {
    const iat = Math.floor(this.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64url(
      JSON.stringify({
        iss: this.account.clientEmail,
        scope: FCM_SCOPE,
        aud: GOOGLE_OAUTH_TOKEN_URL,
        iat,
        exp: iat + ASSERTION_LIFETIME_S,
      }),
    );
    const signature = sign(
      'RSA-SHA256',
      Buffer.from(`${header}.${claims}`),
      this.account.privateKey,
    );
    return `${header}.${claims}.${base64url(signature)}`;
  }

  /** Oublie le jeton d'accès (réponse 401 de FCM, rotation de la clé). */
  invalidateAccessToken(): void {
    this.cached = null;
  }

  /** Jeton d'accès valide (cache partagé ; un seul échange simultané). */
  async accessToken(): Promise<string> {
    if (
      this.cached &&
      this.cached.expiresAt - ACCESS_TOKEN_MARGIN_MS > this.now()
    ) {
      return this.cached.token;
    }
    this.pending ??= this.fetchAccessToken().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async fetchAccessToken(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: this.createAssertion(),
    }).toString();
    const res = await this.fetchImpl(GOOGLE_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(FCM_REQUEST_TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => null)) as {
      access_token?: unknown;
      expires_in?: unknown;
      error?: unknown;
    } | null;
    if (!res.ok || typeof json?.access_token !== 'string') {
      // Jamais le corps complet (pas de secret, mais inutile) : le code d'erreur OAuth suffit.
      const code = typeof json?.error === 'string' ? json.error : 'inconnue';
      throw new Error(
        `Jeton d'accès Google refusé (HTTP ${res.status}, erreur ${code})`,
      );
    }
    const expiresIn =
      typeof json.expires_in === 'number' && json.expires_in > 0
        ? json.expires_in
        : 3600;
    this.cached = {
      token: json.access_token,
      expiresAt: this.now() + expiresIn * 1000,
    };
    return json.access_token;
  }

  /** Envoie un message. Ne lève jamais : les erreurs sont décrites dans le résultat. */
  async send(message: FcmMessage): Promise<FcmSendResult> {
    let accessToken: string;
    try {
      accessToken = await this.accessToken();
    } catch (error) {
      return {
        ok: false,
        status: 0,
        errorCode: 'AUTH',
        invalidToken: false,
        message: error instanceof Error ? error.message : 'erreur inconnue',
      };
    }
    try {
      const res = await this.fetchImpl(fcmSendUrl(this.account.projectId), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({ message }),
        signal: AbortSignal.timeout(FCM_REQUEST_TIMEOUT_MS),
      });
      if (res.ok) return { ok: true };
      if (res.status === 401) this.invalidateAccessToken();
      return classifyFcmError(res.status, await res.json().catch(() => null));
    } catch (error) {
      return {
        ok: false,
        status: 0,
        errorCode: null,
        invalidToken: false,
        message: error instanceof Error ? error.message : 'erreur réseau',
      };
    }
  }
}
