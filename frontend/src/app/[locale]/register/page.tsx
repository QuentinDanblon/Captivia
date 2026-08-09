'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function RegisterPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await api.register(email, password, locale);

      if (response.accessToken && response.user) {
        login(response.accessToken, response.user);
        router.push('/mes-animaux');
      } else {
        setError(response.message || 'Registration failed');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="captivia-auth-page">
      <div className="captivia-auth-card">
        <h1 className="captivia-auth-title">{t('auth.registerTitle')}</h1>

        <form onSubmit={handleSubmit} className="captivia-auth-form">
          <div className="captivia-auth-field">
            <label htmlFor="email" className="captivia-auth-label">
              {t('auth.emailLabel')}
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="captivia-auth-input"
            />
          </div>

          <div className="captivia-auth-field">
            <label htmlFor="password" className="captivia-auth-label">
              {t('auth.passwordLabel')}
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
            <p className="captivia-auth-hint">{t('auth.passwordMin')}</p>
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

          {error && (
            <div className="captivia-auth-feedback is-error" role="alert">
              <p>{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="captivia-auth-submit">
            {loading ? t('common.loading') : t('auth.registerButton')}
          </button>
        </form>

        <div className="captivia-auth-links">
          <p>
            {t('auth.hasAccount')}{' '}
            <Link href="/login" className="captivia-auth-secondary-link">
              {t('auth.loginButton')}
            </Link>
          </p>
          <Link href="/" className="captivia-auth-back-link">
            {t('common.back')} {t('common.home')}
          </Link>
        </div>
      </div>
    </div>
  );
}
