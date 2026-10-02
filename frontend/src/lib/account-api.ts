/**
 * Appels API « compte » (RGPD) : export des données (art. 20) et suppression
 * de compte (art. 17). Fichier volontairement indépendant de lib/api.ts.
 */

import { authFetch } from './api';
import { API_URL } from './config';
import { localDayKey } from './dates';

/** Même timeout que lib/api.ts (non exporté de ce fichier). */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * fetch avec timeout. Volontairement sans `auth:logout` : sur DELETE /users/me, un 401 signifie
 * « mot de passe incorrect », pas « session expirée ».
 */
function timedFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

export class AccountApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AccountApiError';
    this.status = status;
  }
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(', ');
    if (typeof body.message === 'string') return body.message;
  } catch {
    // corps non JSON : message générique ci-dessous
  }
  return `HTTP ${res.status}`;
}

/** Récupère l'export JSON complet des données de l'utilisateur. */
export async function exportMyData(
  token: string,
): Promise<{ blob: Blob; filename: string }> {
  let res: Response;
  try {
    // Export : un 401 est bien une session expirée → refresh puis rejeu (W1-01).
    res = await authFetch(`${API_URL}/users/me/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new AccountApiError('network', 0);
  }
  if (!res.ok) {
    throw new AccountApiError(await readErrorMessage(res), res.status);
  }
  const blob = await res.blob();
  const date = localDayKey(new Date());
  return { blob, filename: `captivia-export-${date}.json` };
}

/** Déclenche le téléchargement d'un Blob dans le navigateur. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Supprime définitivement le compte (mot de passe re-vérifié côté serveur).
 * Lève AccountApiError (status 401 = mot de passe incorrect).
 */
export async function deleteMyAccount(
  token: string,
  password: string,
): Promise<void> {
  let res: Response;
  try {
    res = await timedFetch(`${API_URL}/users/me`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
  } catch {
    throw new AccountApiError('network', 0);
  }
  if (!res.ok) {
    throw new AccountApiError(await readErrorMessage(res), res.status);
  }
}
