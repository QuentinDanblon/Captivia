'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { USER_KEY, writeStorage } from '@/lib/session';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { Alert, Skeleton, SkeletonGroup, buttonClasses } from '@/components/ui';

type Status = 'verifying' | 'success' | 'invalid' | 'missing';

/** W2-04 — page d'atterrissage du lien de vérification d'e-mail. */
function VerifyEmailContent() {
  const t = useTranslations('emailVerification');
  const searchParams = useSearchParams();
  const { user, token: authToken, setUser } = useAuth();
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
    // Le lien peut concerner un AUTRE compte que celui connecté ici : on recharge le profil au
    // lieu de forcer `emailVerified` (le backend fait foi).
    if (status !== 'success' || !authToken) return;
    let cancelled = false;
    api
      .getProfile(authToken)
      .then((fresh: unknown) => {
        if (cancelled || !fresh || typeof fresh !== 'object' || Array.isArray(fresh)) return;
        setUser(fresh as NonNullable<typeof user>);
        writeStorage(USER_KEY, JSON.stringify(fresh));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [status, authToken, setUser]);

  const heading =
    status === 'success' ? t('headingSuccess') : status === 'verifying' ? t('pageTitle') : t('headingFailed');

  return (
    <AuthFrame title={heading} lead={status === 'success' ? t('leadSuccess') : undefined} photo="cockatiels">
      <div className="grid gap-6">
        {status === 'verifying' ? (
          <p role="status" className="m-0 text-body text-ink-2">
            {t('verifying')}
          </p>
        ) : status === 'success' ? (
          <Alert severity="info" title={t('success')} />
        ) : (
          <Alert severity="urgent" title={status === 'missing' ? t('missingToken') : t('invalid')} />
        )}
        {status !== 'verifying' && (
          <Link href={user ? '/mes-animaux' : '/login'} className={buttonClasses({ size: 'lg', fullWidth: true })}>
            {user ? t('goToApp') : t('goToLogin')}
          </Link>
        )}
      </div>
    </AuthFrame>
  );
}

function VerifyEmailFallback() {
  const t = useTranslations('emailVerification');
  return (
    <div className="cv-container py-12">
      <SkeletonGroup label={t('verifying')} className="grid max-w-md gap-4">
        <Skeleton width="70%" height={36} />
        <Skeleton shape="block" height={56} />
      </SkeletonGroup>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
