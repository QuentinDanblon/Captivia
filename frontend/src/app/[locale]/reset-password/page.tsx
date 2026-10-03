'use client';

import { useState, useEffect, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/config';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { Alert, Button, Field, Skeleton, SkeletonGroup, buttonClasses } from '@/components/ui';

function ResetPasswordForm() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Le token est gardé en state puis retiré de l'URL (historique, Referer, Sentry).
  const [token] = useState<string | null>(() => searchParams.get('token'));

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('token')) {
        url.searchParams.delete('token');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      }
    } catch {
      // URL illisible : le token reste en state, on ne bloque pas la page.
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setError(t('auth.resetPasswordInvalidLink'));
    }
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError(t('auth.resetPasswordMismatch'));
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      setError(t('auth.passwordMin'));
      return;
    }
    if (!token) return;

    setLoading(true);
    try {
      const res = await api.resetPassword(token, password);
      setMessage(res?.message || t('auth.resetPasswordSuccess'));
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.resetPasswordError'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthFrame title={t('auth.resetInvalidHeading')}>
        <div className="grid gap-6">
          <Alert severity="urgent" title={t('auth.resetPasswordInvalidLink')} />
          <Link href="/forgot-password" className={buttonClasses({ size: 'lg', fullWidth: true })}>
            {t('auth.resetRequestNew')}
          </Link>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title={t('auth.resetHeading')} lead={t('auth.resetPasswordDescription')}>
      <div className="grid gap-8">
        <form onSubmit={handleSubmit} className="grid gap-5">
          <Field label={t('auth.newPasswordLabel')} id="password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              autoComplete="new-password"
            />
          </Field>
          <Field label={t('auth.confirmPasswordLabel')} id="confirmPassword">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              autoComplete="new-password"
            />
          </Field>

          {message && (
            // Le reset révoque aussi le lien du flux calendrier et les abonnements push.
            <Alert severity="info" title={message}>
              {t('sessions.accessRevokedNotice')}
            </Alert>
          )}
          {error && <Alert severity="urgent" title={error} />}

          <Button type="submit" size="lg" fullWidth loading={loading}>
            {loading ? t('common.loading') : t('auth.resetPasswordSubmit')}
          </Button>
        </form>

        <p className="m-0 border-t border-line pt-6 text-ui text-ink-2">
          <Link href="/login" className="font-medium text-accent-text underline underline-offset-2">
            {t('auth.backToLogin')}
          </Link>
        </p>
      </div>
    </AuthFrame>
  );
}

function ResetPasswordFallback() {
  const t = useTranslations();
  return (
    <div className="cv-container py-12">
      <SkeletonGroup label={t('common.loading')} className="grid max-w-md gap-4">
        <Skeleton width="70%" height={36} />
        <Skeleton shape="block" height={44} />
        <Skeleton shape="block" height={44} />
      </SkeletonGroup>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
