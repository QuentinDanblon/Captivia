'use client';

import { useCallback, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api';
import { startGuestSession } from '@/lib/guest';

/**
 * « Essayer sans compte » : crée la session invité (POST /auth/guest) et l'ouvre comme une
 * connexion (mêmes jetons, même stockage). Renvoie `true` si la session est ouverte.
 */
export function useStartGuest() {
  const t = useTranslations('guest');
  const locale = useLocale();
  const { login } = useAuth();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const start = useCallback(async (): Promise<boolean> => {
    setStarting(true);
    setError('');
    try {
      const session = await startGuestSession(locale);
      login(session.accessToken, session.user, session.refreshToken);
      return true;
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? t('startTooMany') : t('startError'));
      return false;
    } finally {
      setStarting(false);
    }
  }, [locale, login, t]);

  return { start, starting, error };
}
