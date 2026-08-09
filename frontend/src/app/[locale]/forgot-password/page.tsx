'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await api.forgotPassword(email);
      setMessage(res?.message || t('auth.forgotPasswordSuccess'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.forgotPasswordError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="captivia-auth-page">
      <div className="captivia-auth-card">
        <h1 className="captivia-auth-title">{t('auth.forgotPasswordTitle')}</h1>
        <p className="captivia-auth-description">{t('auth.forgotPasswordDescription')}</p>

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
            {loading ? t('common.loading') : t('auth.forgotPasswordSubmit')}
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
