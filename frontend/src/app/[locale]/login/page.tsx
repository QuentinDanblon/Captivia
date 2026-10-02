'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { GUEST_UPGRADE_PATH, isGuestUser } from '@/lib/guest';
import { useStartGuest } from '@/components/guest/useStartGuest';
import { Alert, Button, buttonClasses } from '@/components/ui';

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const { login, user } = useAuth();
  const tGuest = useTranslations('guest');
  const { start: startGuest, starting: guestStarting, error: guestError } = useStartGuest();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mobileLink, setMobileLink] = useState<string | null>(null);

  useEffect(() => {
    // Lien « test sur téléphone » : outil de développement uniquement.
    if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal) return;
    fetch('/api/mobile-link')
      .then((r) => r.json())
      .then((d) => setMobileLink(d.urlFr || d.url))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.login(email, password);

      if (response.accessToken && response.user) {
        login(response.accessToken, response.user, response.refreshToken);
        router.push('/mes-animaux');
      } else {
        setError(t('auth.invalidCredentials'));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="captivia-auth-page">
      <div className="captivia-auth-card">
        <h1 className="captivia-auth-title">{t('auth.loginTitle')}</h1>

        {/* Invité : se connecter ouvre un AUTRE compte (aucune fusion) ; la conversion est proposée. */}
        {isGuestUser(user) && (
          <Alert
            severity="warning"
            className="mb-4"
            title={tGuest('loginGuestWarning')}
            action={
              <Link href={GUEST_UPGRADE_PATH} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                {tGuest('loginGuestUpgrade')}
              </Link>
            }
          />
        )}

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
            <div className="captivia-auth-label-row">
              <label htmlFor="password">{t('auth.passwordLabel')}</label>
              <Link href="/forgot-password" className="captivia-auth-inline-link">
                {t('auth.forgotPassword')}
              </Link>
            </div>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="current-password"
              className="captivia-auth-input"
            />
          </div>

          {error && (
            <div className="captivia-auth-feedback is-error" role="alert">
              <p>{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="captivia-auth-submit">
            {loading ? t('common.loading') : t('auth.loginButton')}
          </button>
        </form>

        {/* Sans session : l'app s'utilise aussi sans compte (1 animal, carnet complet). */}
        {!user && (
          <div className="mt-4 grid gap-2">
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              loading={guestStarting}
              onClick={async () => {
                if (await startGuest()) router.push('/mes-animaux');
              }}
            >
              {guestStarting ? tGuest('entryStarting') : tGuest('entryTry')}
            </Button>
            {guestError && (
              <div className="captivia-auth-feedback is-error" role="alert">
                <p>{guestError}</p>
              </div>
            )}
          </div>
        )}

        <div className="captivia-auth-links">
          <p>
            {t('auth.noAccount')}{' '}
            <Link href="/register" className="captivia-auth-secondary-link">
              {t('auth.registerButton')}
            </Link>
          </p>

          <Link href="/" className="captivia-auth-back-link">
            {t('common.back')} {t('common.home')}
          </Link>
        </div>

        {process.env.NODE_ENV === 'development' && mobileLink && (
          <div className="captivia-auth-mobile-link">
            <strong>Lien pour tester sur votre téléphone (même Wi‑Fi)</strong>
            <a href={mobileLink} target="_blank" rel="noopener noreferrer">
              {mobileLink}
            </a>
            <p>Gardez le backend lancé sur ce PC (port 3001).</p>
          </div>
        )}
      </div>
    </div>
  );
}
