'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_URL } from '@/lib/config';
import {
  REFRESH_TOKEN_KEY,
  TOKEN_KEY,
  TOKEN_REFRESHED_EVENT,
  USER_KEY,
  readStorage,
  refreshAccessToken,
  removeStorage,
  writeStorage,
} from '@/lib/session';

interface User {
  id: string;
  email: string;
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

/**
 * Lit la claim `exp` (secondes) d'un JWT sans vérifier la signature (le backend reste l'autorité).
 * Un jeton illisible ou sans `exp` n'est PAS considéré comme expiré.
 */
function isJwtExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload) return false;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const claims = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        if (res.status === 401 && allowRefresh && readStorage(REFRESH_TOKEN_KEY)) {
          const refreshed = await refreshAccessToken(storedToken);
          if (!refreshed.ok && !refreshed.revoked) return;
          if (refreshed.ok) {
            storedToken = refreshed.accessToken;
            setToken(storedToken);
            res = await fetchMe(storedToken);
          }
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
  }, [refreshProfile]);

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
    revokeRefreshToken(readStorage(REFRESH_TOKEN_KEY));
    clearSession();
  };

  const logoutAll = async () => {
    const current = readStorage(TOKEN_KEY) ?? token;
    if (current) {
      const res = await fetch(`${API_URL}/auth/logout-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${current}` },
      });
      // 401 : la session était déjà révoquée → on vide quand même la session locale.
      if (!res.ok && res.status !== 401) {
        throw new Error(`HTTP ${res.status}`);
      }
    }
    clearSession();
  };

  return (
    <AuthContext.Provider
      value={{ user, token, login, updateToken, logout, logoutAll, isLoading, setUser }}
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
