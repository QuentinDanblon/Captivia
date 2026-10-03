'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { GUEST_UPGRADE_PATH, isGuestUser } from '@/lib/guest';
import { useStartGuest } from '@/components/guest/useStartGuest';
import { AuthFrame, OrDivider } from '@/components/auth/AuthFrame';
import { Alert, Button, Field } from '@/components/ui';
import { NewTabPageLink } from '@/components/NewTabPageLink';

export default function RegisterPage() {
  const t = useTranslations();
  const tGuest = useTranslations('guest');
  const locale = useLocale();
  const router = useRouter();
  const { login, user } = useAuth();
  const { start: startGuest, starting: guestStarting, error: guestError } = useStartGuest();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Session invité : créer un compte = convertir l'invité (données conservées), pas en ouvrir un autre.
  useEffect(() => {
    if (isGuestUser(user)) router.replace(GUEST_UPGRADE_PATH);
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth.resetPasswordMismatch'));
      return;
    }

    if (!acceptTerms || !ageConfirmed) {
      setError(t('auth.consentRequired'));
      return;
    }

    setLoading(true);

    try {
      const response = await api.register(email, password, locale, {
        acceptTerms,
        ageConfirmed,
      });

      if (response.accessToken && response.user) {
        login(response.accessToken, response.user, response.refreshToken);
        router.push('/mes-animaux');
      } else {
        setError(response.message || t('auth.registerError'));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.registerError'));
    } finally {
      setLoading(false);
    }
  };

  const legalLink = (href: string) => {
    const LegalLink = (chunks: React.ReactNode) => (
      <NewTabPageLink href={href} className="text-accent-text underline underline-offset-2">
        {chunks}
      </NewTabPageLink>
    );
    return LegalLink;
  };

  return (
    <AuthFrame title={t('auth.registerHeading')} lead={t('auth.registerLead')} photo="budgerigars">
      <div className="grid gap-8">
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

          <Field label={t('auth.passwordLabel')} hint={t('account.passwordRule')} id="password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={10}
              maxLength={128}
              autoComplete="new-password"
            />
          </Field>

          <Field label={t('auth.confirmPasswordLabel')} id="confirmPassword">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={10}
              maxLength={128}
              autoComplete="new-password"
            />
          </Field>

          <fieldset className="m-0 grid gap-3 border-0 p-0">
            <legend className="sr-only">{t('auth.consentLegend')}</legend>
            <label htmlFor="acceptTerms" className="flex cursor-pointer items-start gap-3 text-ui text-ink">
              <input
                type="checkbox"
                id="acceptTerms"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                required
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                {t.rich('auth.acceptTermsLabel', {
                  terms: legalLink('/cgu'),
                  privacy: legalLink('/confidentialite'),
                })}
              </span>
            </label>
            <label htmlFor="ageConfirmed" className="flex cursor-pointer items-start gap-3 text-ui text-ink">
              <input
                type="checkbox"
                id="ageConfirmed"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                required
                className="mt-0.5 size-4 shrink-0"
              />
              <span>{t('auth.ageConfirmLabel')}</span>
            </label>
          </fieldset>

          {error && <Alert severity="urgent" title={error} />}

          <Button type="submit" size="lg" fullWidth loading={loading}>
            {loading ? t('common.loading') : t('auth.registerSubmit')}
          </Button>
        </form>

        {/* Sans session : on peut commencer sans compte et convertir plus tard, sans perte. */}
        {!user && (
          <section aria-labelledby="register-guest-title" className="grid gap-4">
            <OrDivider label={t('common.or')} />
            <div className="grid gap-1">
              <h2 id="register-guest-title" className="m-0 font-display text-h4 font-semibold text-ink">
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
          {t('auth.hasAccount')}{' '}
          <Link href="/login" className="font-medium text-accent-text underline underline-offset-2">
            {t('auth.loginButton')}
          </Link>
        </p>
      </div>
    </AuthFrame>
  );
}
