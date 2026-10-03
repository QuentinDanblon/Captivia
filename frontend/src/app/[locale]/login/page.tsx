'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { GUEST_UPGRADE_PATH, isGuestUser } from '@/lib/guest';
import { useStartGuest } from '@/components/guest/useStartGuest';
import { AuthFrame, OrDivider } from '@/components/auth/AuthFrame';
import { Alert, Button, Field, buttonClasses } from '@/components/ui';

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
      // Identifiants refusés : message traduit, jamais le texte brut de l'API.
      setError(err instanceof ApiError && (err.status === 401 || err.status === 400) ? t('auth.invalidCredentials') : err instanceof Error ? err.message : t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame title={t('auth.loginHeading')} lead={t('auth.loginLead')}>
      <div className="grid gap-8">
        {/* Invité : se connecter ouvre un AUTRE compte (aucune fusion) ; la conversion est proposée. */}
        {isGuestUser(user) && (
          <Alert
            severity="warning"
            title={tGuest('loginGuestWarning')}
            action={
              <Link href={GUEST_UPGRADE_PATH} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                {tGuest('loginGuestUpgrade')}
              </Link>
            }
          />
        )}

        <form onSubmit={handleSubmit} className="grid gap-5">
          <Field label={t('auth.emailLabel')} id="email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              inputMode="email"
            />
          </Field>

          <div className="grid gap-2">
            <Field label={t('auth.passwordLabel')} id="password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="current-password"
              />
            </Field>
            <Link href="/forgot-password" className="justify-self-end text-ui text-accent-text underline underline-offset-2">
              {t('auth.forgotPassword')}
            </Link>
          </div>

          {error && <Alert severity="urgent" title={error} />}

          <Button type="submit" size="lg" fullWidth loading={loading}>
            {loading ? t('common.loading') : t('auth.loginButton')}
          </Button>
        </form>

        {/* Sans session : l'app s'utilise aussi sans compte (1 animal, carnet complet). */}
        {!user && (
          <section aria-labelledby="login-guest-title" className="grid gap-4">
            <OrDivider label={t('common.or')} />
            <div className="grid gap-1">
              <h2 id="login-guest-title" className="m-0 font-display text-h4 font-semibold text-ink">
                {t('auth.guestTitle')}
              </h2>
              <p className="m-0 text-ui text-ink-2">{t('auth.guestLead')}</p>
            </div>
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
            {guestError && <Alert severity="urgent" title={guestError} />}
          </section>
        )}

        <p className="m-0 border-t border-line pt-6 text-ui text-ink-2">
          {t('auth.noAccount')}{' '}
          <Link href="/register" className="font-medium text-accent-text underline underline-offset-2">
            {t('auth.createAccountLink')}
          </Link>
        </p>

        {process.env.NODE_ENV === 'development' && mobileLink && (
          <div className="grid gap-1 rounded-card border border-dashed border-line-strong p-4 text-ui text-ink-2">
            <strong className="text-ink">Lien pour tester sur votre téléphone (même Wi‑Fi)</strong>
            <a href={mobileLink} target="_blank" rel="noopener noreferrer" className="font-mono text-meta break-all text-accent-text">
              {mobileLink}
            </a>
            <p className="m-0">Gardez le backend lancé sur ce PC (port 3001).</p>
          </div>
        )}
      </div>
    </AuthFrame>
  );
}
