'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

type Status = 'verifying' | 'success' | 'invalid' | 'missing';

/** W2-04 — page d'atterrissage du lien de vérification d'e-mail. */
function VerifyEmailContent() {
  const t = useTranslations('emailVerification');
  const searchParams = useSearchParams();
  const { user, setUser } = useAuth();
  // Le token est gardé en state puis retiré de l'URL (historique, Referer, Sentry).
  const [token] = useState<string | null>(() => searchParams.get('token'));
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'missing');
  const started = useRef(false);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('token')) {
        url.searchParams.delete('token');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      }
    } catch {
      // URL illisible : le token reste en state.
    }
  }, []);

  useEffect(() => {
    // Un seul appel (StrictMode monte deux fois en dev ; le token est à usage unique).
    if (!token || started.current) return;
    started.current = true;
    api
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('invalid'));
  }, [token]);

  useEffect(() => {
    if (status === 'success' && user && user.emailVerified !== true) {
      const next = { ...user, emailVerified: true };
      setUser(next);
      try {
        localStorage.setItem('user', JSON.stringify(next));
      } catch {
        // stockage indisponible
      }
    }
  }, [status, user, setUser]);

  const message =
    status === 'verifying'
      ? t('verifying')
      : status === 'success'
        ? t('success')
        : status === 'missing'
          ? t('missingToken')
          : t('invalid');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center space-y-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{t('pageTitle')}</h1>
        <p
          role={status === 'invalid' || status === 'missing' ? 'alert' : 'status'}
          className={
            status === 'success'
              ? 'text-emerald-700 dark:text-emerald-400'
              : status === 'verifying'
                ? 'text-gray-600 dark:text-gray-300'
                : 'text-red-600 dark:text-red-400'
          }
        >
          {message}
        </p>
        {status !== 'verifying' && (
          <Link
            href={user ? '/mes-animaux' : '/login'}
            className="inline-block px-5 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {user ? t('goToApp') : t('goToLogin')}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
