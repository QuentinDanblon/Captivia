/**
 * Couche plateforme web / natif (W6-02 à W6-05, D-11).
 *
 * - `isNative()` : vrai seulement dans l'app Capacitor (iOS / Android).
 * - `openExternal(url)` : ouvre un lien dans le navigateur système (boutiques, sources : jamais dans la WebView).
 * - `tokenStorage` : stockage de session, Preferences sur natif + miroir localStorage, localStorage seul sur le web.
 * - `animalDetailPath` / `speciesPath` / `publicAnimalPath` : chemins des fiches selon la cible
 *   (routes dynamiques sur le web, routes à query `?id=` dans l'export statique mobile).
 */
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Capacitor } from '@capacitor/core';

/** Vrai dans le bundle de l'app (export statique `npm run build:mobile`), faux sur le web. */
export const IS_MOBILE_BUILD = process.env.NEXT_PUBLIC_MOBILE_BUILD === '1';

export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getPlatform(): 'ios' | 'android' | 'web' {
  const p = isNative() ? Capacitor.getPlatform() : 'web';
  return p === 'ios' || p === 'android' ? p : 'web';
}

/**
 * Ouvre `url` (http/https uniquement) hors de l'application.
 * Sur natif, Capacitor délègue toute navigation vers un hôte externe au système
 * (Safari / navigateur par défaut, ou l'app du site si installée) : la WebView n'affiche jamais la page.
 * Sur le web, nouvel onglet sans `window.opener`.
 * @returns false si l'URL est refusée (schéma non http(s), URL invalide).
 */
export function openExternal(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  if (typeof window === 'undefined') return false;
  window.open(parsed.toString(), '_blank', 'noopener,noreferrer');
  return true;
}

type PreferencesApi = typeof import('@capacitor/preferences').Preferences;
let preferencesPromise: Promise<PreferencesApi> | null = null;

/** Chargé à la demande : le bundle web n'embarque pas le plugin. */
function loadPreferences(): Promise<PreferencesApi> {
  if (!preferencesPromise) {
    preferencesPromise = import('@capacitor/preferences').then((m) => m.Preferences);
  }
  return preferencesPromise;
}

function persistNative(key: string, value: string | null): void {
  if (!isNative()) return;
  loadPreferences()
    .then((prefs) => (value === null ? prefs.remove({ key }) : prefs.set({ key, value })))
    .catch(() => {
      // Échec natif : le miroir localStorage garde la session pour la durée de vie de la WebView.
    });
}

/**
 * Stockage des jetons de session, à sémantique localStorage (synchrone, peut lever si le stockage est bloqué).
 *
 * Sur le web : strictement localStorage (comportement inchangé).
 * Sur natif : écriture double, Preferences (UserDefaults / SharedPreferences, persistant, hors de la
 * WebView que iOS peut purger) + localStorage (lecteurs synchrones existants : api.ts, pages). Au
 * démarrage, `hydrate()` recopie Preferences → localStorage avant la lecture de la session.
 */
export const tokenStorage = {
  getItem(key: string): string | null {
    return localStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
    persistNative(key, value);
  },
  removeItem(key: string): void {
    localStorage.removeItem(key);
    persistNative(key, null);
  },
  /** Natif : restaure dans localStorage les clés persistées par Preferences. Sans effet sur le web. */
  async hydrate(keys: readonly string[]): Promise<void> {
    if (!isNative()) return;
    try {
      const prefs = await loadPreferences();
      for (const key of keys) {
        const { value } = await prefs.get({ key });
        try {
          if (value !== null) localStorage.setItem(key, value);
          else if (localStorage.getItem(key) !== null) {
            // Session antérieure à Preferences (ou écrite avant l'hydratation) : on la persiste.
            persistNative(key, localStorage.getItem(key));
          }
        } catch {
          // localStorage indisponible : rien à restaurer
        }
      }
    } catch {
      // Plugin indisponible : on reste sur localStorage.
    }
  },
};

const enc = encodeURIComponent;

/** Fiche d'un animal : `/mes-animaux/<id>` (web) ou `/mes-animaux/detail?id=<id>` (app). */
export function animalDetailPath(id: string | number): string {
  return IS_MOBILE_BUILD ? `/mes-animaux/detail?id=${enc(String(id))}` : `/mes-animaux/${enc(String(id))}`;
}

/** Carnet imprimable : `/mes-animaux/<id>/carnet` (web) ou `/mes-animaux/carnet?id=<id>` (app). */
export function animalCarnetPath(id: string | number): string {
  return IS_MOBILE_BUILD ? `/mes-animaux/carnet?id=${enc(String(id))}` : `/mes-animaux/${enc(String(id))}/carnet`;
}

/** Fiche espèce : `/species/<id>` (web) ou `/species?id=<id>` (app). */
export function speciesPath(id: string | number): string {
  return IS_MOBILE_BUILD ? `/species?id=${enc(String(id))}` : `/species/${enc(String(id))}`;
}

/** Page publique (QR) : `/animal-public/<slug>` (web) ou `/animal-public?slug=<slug>` (app). */
export function publicAnimalPath(slug: string): string {
  return IS_MOBILE_BUILD ? `/animal-public?slug=${enc(slug)}` : `/animal-public/${enc(slug)}`;
}

/**
 * Routes à query de l'app mobile (W6-02) : fournit aux pages web dynamiques (`params: Promise<…>`)
 * des paramètres lus dans `?<name>=`. Promesse stable tant que la valeur ne change pas.
 * À utiliser sous une frontière <Suspense> (exigée par useSearchParams dans un export statique).
 */
export function useQueryRouteParams<K extends string>(name: K): Promise<{ locale: string } & Record<K, string>> {
  const locale = useLocale();
  const value = useSearchParams().get(name) ?? '';
  return useMemo(
    () => Promise.resolve({ locale, [name]: value } as { locale: string } & Record<K, string>),
    [locale, name, value],
  );
}
