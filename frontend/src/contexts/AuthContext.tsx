'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_URL } from '@/lib/config';

interface User {
  id: string;
  email: string;
  locale: string;
  isPremium: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  /** Remplace uniquement le jeton de session (ex. nouveau jeton après changement de mot de passe). */
  updateToken: (token: string) => void;
  logout: () => void;
  isLoading: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

/** Accès localStorage tolérant (mode privé, stockage bloqué, valeur corrompue). */
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible : la session reste valable en mémoire pour l'onglet courant.
  }
}

function clearStoredSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
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
    async (storedToken: string) => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        // Session révoquée / expirée côté serveur. Surtout pas sur 403 ni sur erreur réseau.
        if (res.status === 401) {
          if (readStorage(TOKEN_KEY) === storedToken) clearSession();
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
        clearStoredSession();
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

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    writeStorage(TOKEN_KEY, newToken);
    writeStorage(USER_KEY, JSON.stringify(newUser));
  };

  const updateToken = (newToken: string) => {
    setToken(newToken);
    writeStorage(TOKEN_KEY, newToken);
  };

  const logout = () => {
    clearSession();
  };

  return (
    <AuthContext.Provider value={{ user, token, login, updateToken, logout, isLoading, setUser }}>
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
