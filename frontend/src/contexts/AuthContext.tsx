'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_URL } from '@/lib/config';
import { isNative, tokenStorage } from '@/lib/platform';
import { ApiError, api } from '@/lib/api';
import {
  REFRESH_TOKEN_KEY,
  TOKEN_KEY,
  TOKEN_REFRESHED_EVENT,
  USER_KEY,
  isJwtExpired,
  readStorage,
  refreshAccessToken,
  removeStorage,
  writeStorage,
} from '@/lib/session';
import { unsubscribeFromPush } from '@/lib/web-push';

interface User {
  id: string;
  /** null pour un invité (mode « Essayer sans compte », cf. `isGuest`). */
  email: string | null;
  /**
   * Mode invité : session sans e-mail ni mot de passe (POST /auth/guest), mêmes jetons que les
   * comptes. Perdre cette session = perdre l'accès aux données : jamais de déconnexion implicite.
   */
  isGuest?: boolean;
  locale: string;
  isPremium: boolean;
  /** W2-04 : adresse e-mail vérifiée (absent dans les anciens caches = inconnu). */
  emailVerified?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  /** `refreshToken` : jeton opaque rotatif renvoyé par login / register (W1-01). */
  login: (token: string, user: User, refreshToken?: string) => void;
  /** Remplace le jeton de session (ex. nouvelle paire après changement de mot de passe). */
  updateToken: (token: string, refreshToken?: string) => void;
  /** Déconnecte cet appareil (révoque le refresh token côté serveur, sans attendre). */
  logout: () => void;
  /** « Se déconnecter de tous les appareils » : révoque toutes les sessions puis vide la session locale. */
  logoutAll: () => Promise<void>;
  isLoading: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  /**
   * Relit le profil (`GET /auth/me`) et met la session à jour (ex. Premium activé par le webhook
   * d'achat intégré). Null si aucune session ou en cas d'échec ; jamais de déconnexion ici.
   */
  reloadUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function clearStoredSession() {
  removeStorage(TOKEN_KEY);
  removeStorage(REFRESH_TOKEN_KEY);
  removeStorage(USER_KEY);
}

/** Révocation serveur best effort du refresh token (n'échoue jamais, ne bloque pas l'UI). */
function revokeRefreshToken(refreshToken: string | null) {
  if (!refreshToken) return;
  try {
    void fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // ignoré
  }
}

function parseStoredUser(raw: string): User | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as User;
    }
  } catch {
    // JSON corrompu : purgé par l'appelant
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nativeHydrated, setNativeHydrated] = useState(false);

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
    clearStoredSession();
  }, []);

  const refreshProfile = useCallback(
    async (initialToken: string, allowRefresh = true): Promise<void> => {
      try {
        let storedToken = initialToken;
        const fetchMe = (t: string) =>
          fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
        let res = await fetchMe(storedToken);
        // W1-01 : access token expiré → une tentative de rafraîchissement avant de déconnecter.
        // Un jeton repris d'un autre onglet (`reused`) puis refusé déclenche un vrai refresh, une fois.
        let force = false;
        for (let attempt = 0; attempt < 2; attempt++) {
          if (res.status !== 401 || !allowRefresh || !readStorage(REFRESH_TOKEN_KEY)) break;
          const refreshed = await refreshAccessToken(storedToken, { force });
          if (!refreshed.ok && !refreshed.revoked) return;
          if (!refreshed.ok) break;
          storedToken = refreshed.accessToken;
          setToken(storedToken);
          res = await fetchMe(storedToken);
          if (!refreshed.reused) break;
          force = true;
        }
        // Session révoquée / expirée côté serveur. Surtout pas sur 403 ni sur erreur réseau.
        if (res.status === 401) {
          if (readStorage(TOKEN_KEY) === storedToken || readStorage(TOKEN_KEY) === initialToken) {
            clearSession();
          }
          return;
        }
        if (res.ok) {
          const freshUser = await res.json();
          // Ignore une réponse tardive si la session a changé entre-temps (logout / autre compte).
          if (readStorage(TOKEN_KEY) !== storedToken) return;
          setUser(freshUser);
          writeStorage(USER_KEY, JSON.stringify(freshUser));
        }
      } catch {
        // Silently fail — cached user data still valid
      }
    },
    [clearSession],
  );

  useEffect(() => {
    // Natif : la session persistée (Preferences) est recopiée dans localStorage avant la lecture.
    if (isNative() && !nativeHydrated) {
      let cancelled = false;
      tokenStorage.hydrate([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]).finally(() => {
        if (!cancelled) setNativeHydrated(true);
      });
      return () => {
        cancelled = true;
      };
    }

    const storedToken = readStorage(TOKEN_KEY);
    const storedUserRaw = readStorage(USER_KEY);

    if (storedToken && storedUserRaw) {
      const storedUser = parseStoredUser(storedUserRaw);
      if (!storedUser) {
        // Cache utilisateur corrompu : on repart d'une session propre.
        clearStoredSession();
      } else if (isJwtExpired(storedToken)) {
        if (!readStorage(REFRESH_TOKEN_KEY)) {
          clearStoredSession();
        } else {
          // W1-01 : access token expiré mais refresh token présent → rotation avant de restaurer.
          let cancelled = false;
          void refreshAccessToken(storedToken)
            .then((refreshed) => {
              if (cancelled) return;
              if (refreshed.ok) {
                setToken(refreshed.accessToken);
                setUser(storedUser);
                void refreshProfile(refreshed.accessToken, false);
              } else if (refreshed.revoked) {
                clearStoredSession();
              } else {
                // Backend injoignable : on garde la session, les appels réessaieront.
                setToken(storedToken);
                setUser(storedUser);
              }
            })
            .finally(() => {
              if (!cancelled) setIsLoading(false);
            });
          return () => {
            cancelled = true;
          };
        }
      } else {
        // Hydratation depuis localStorage : uniquement après le montage (indisponible côté serveur,
        // un initialiseur d'état provoquerait un écart d'hydratation SSR/client).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setToken(storedToken);
        setUser(storedUser);
        refreshProfile(storedToken);
      }
    } else if (storedToken || storedUserRaw) {
      // Session incomplète (l'un sans l'autre) : inutilisable.
      clearStoredSession();
    }

    setIsLoading(false);
  }, [refreshProfile, nativeHydrated]);

  useEffect(() => {
    // Émis par lib/api.ts sur une réponse 401 authentifiée (jamais sur 403).
    window.addEventListener('auth:logout', clearSession);
    return () => window.removeEventListener('auth:logout', clearSession);
  }, [clearSession]);

  useEffect(() => {
    // Émis par lib/session.ts après une rotation réussie : le nouveau jeton remplace l'ancien.
    const onRefreshed = (event: Event) => {
      const accessToken = (event as CustomEvent<{ accessToken?: string }>).detail?.accessToken;
      if (typeof accessToken === 'string') setToken(accessToken);
    };
    window.addEventListener(TOKEN_REFRESHED_EVENT, onRefreshed);
    return () => window.removeEventListener(TOKEN_REFRESHED_EVENT, onRefreshed);
  }, []);

  useEffect(() => {
    // Synchronisation entre onglets : rotation (nouveau jeton) ou déconnexion (clé vidée) faite
    // dans un autre onglet. `storage` n'est jamais émis dans l'onglet qui a écrit.
    const onStorage = (event: StorageEvent) => {
      // `key === null` : localStorage.clear() dans un autre onglet.
      if (event.key !== null && event.key !== TOKEN_KEY) return;
      const next = event.key === null ? null : event.newValue;
      if (next) {
        setToken(next);
      } else {
        setToken(null);
        setUser(null);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const reloadUser = useCallback(async (): Promise<User | null> => {
    const current = readStorage(TOKEN_KEY);
    if (!current) return null;
    try {
      const fresh = (await api.getProfile(current)) as User | null;
      if (!fresh || typeof fresh !== 'object' || typeof fresh.id !== 'string') return null;
      // Session changée entre-temps (déconnexion, autre compte) : la réponse est ignorée.
      const stored = parseStoredUser(readStorage(USER_KEY) ?? '');
      if (!readStorage(TOKEN_KEY) || (stored && stored.id !== fresh.id)) return null;
      setUser(fresh);
      writeStorage(USER_KEY, JSON.stringify(fresh));
      return fresh;
    } catch {
      return null;
    }
  }, []);

  const login = (newToken: string, newUser: User, newRefreshToken?: string) => {
    setToken(newToken);
    setUser(newUser);
    writeStorage(TOKEN_KEY, newToken);
    writeStorage(USER_KEY, JSON.stringify(newUser));
    if (newRefreshToken) writeStorage(REFRESH_TOKEN_KEY, newRefreshToken);
    else removeStorage(REFRESH_TOKEN_KEY);
  };

  const updateToken = (newToken: string, newRefreshToken?: string) => {
    setToken(newToken);
    writeStorage(TOKEN_KEY, newToken);
    if (newRefreshToken) writeStorage(REFRESH_TOKEN_KEY, newRefreshToken);
  };

  const logout = () => {
    // Libère l'abonnement push de CE navigateur (serveur puis navigateur), en best effort et
    // sans attendre : sinon les rappels du compte continuaient d'arriver après la déconnexion.
    const accessToken = readStorage(TOKEN_KEY) ?? token;
    if (accessToken) {
      void unsubscribeFromPush(accessToken).catch(() => false);
    }
    revokeRefreshToken(readStorage(REFRESH_TOKEN_KEY));
    clearSession();
  };

  const logoutAll = async () => {
    const current = readStorage(TOKEN_KEY) ?? token;
    if (current) {
      // Libère d'abord l'abonnement push de ce navigateur, tant que la session est valide.
      await unsubscribeFromPush(current).catch(() => false);
      // Le refresh token est lu AVANT l'appel : un refresh révoqué le retire du stockage.
      const refreshToken = readStorage(REFRESH_TOKEN_KEY);
      try {
        // Via safeFetch : access token expiré → refresh puis rejeu (sinon rien n'était révoqué).
        await api.logoutAll(readStorage(TOKEN_KEY) ?? current);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // Session déjà perdue côté serveur : on révoque au moins celle de cet appareil et on
          // signale l'échec (les autres appareils n'ont pas pu être déconnectés).
          revokeRefreshToken(refreshToken);
          clearSession();
        }
        throw err;
      }
    }
    clearSession();
  };

  return (
    <AuthContext.Provider
      value={{ user, token, login, updateToken, logout, logoutAll, isLoading, setUser, reloadUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
