'use client';

import { useState, useEffect, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';

function ResetPasswordForm() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    if (password.length < 8) {
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
      <div className="captivia-auth-page">
        <div className="captivia-auth-card captivia-auth-invalid-card">
          <div className="captivia-auth-feedback is-error" role="alert">
            <p>{t('auth.resetPasswordInvalidLink')}</p>
          </div>
          <div className="captivia-auth-links">
            <Link href="/forgot-password" className="captivia-auth-secondary-link">
              {t('auth.forgotPasswordTitle')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="captivia-auth-page">
      <div className="captivia-auth-card">
        <h1 className="captivia-auth-title">{t('auth.resetPasswordTitle')}</h1>
        <p className="captivia-auth-description">{t('auth.resetPasswordDescription')}</p>

        <form onSubmit={handleSubmit} className="captivia-auth-form">
          <div className="captivia-auth-field">
            <label htmlFor="password" className="captivia-auth-label">
              {t('auth.newPasswordLabel')}
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="captivia-auth-input"
            />
          </div>
          <div className="captivia-auth-field">
            <label htmlFor="confirmPassword" className="captivia-auth-label">
              {t('auth.confirmPasswordLabel')}
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="captivia-auth-input"
            />
          </div>

          {message && (
            <div className="captivia-auth-feedback is-success" role="status">
              <p>{message}</p>
            </div>
          )}
          {error && (
            <div className="captivia-auth-feedback is-error" role="alert">
              <p>{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="captivia-auth-submit">
            {loading ? t('common.loading') : t('auth.resetPasswordSubmit')}
          </button>
        </form>

        <div className="captivia-auth-links">
          <Link href="/login" className="captivia-auth-secondary-link">
            {t('auth.backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="captivia-auth-page">
        <p className="captivia-auth-description">Chargement...</p>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
