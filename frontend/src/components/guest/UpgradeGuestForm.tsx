'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api';
import { upgradeGuestAccount } from '@/lib/guest';
import { Button, Field } from '@/components/ui';

const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;

export interface UpgradeGuestFormProps {
  /** Appelé après la conversion (la session est déjà renouvelée dans AuthContext). */
  onUpgraded?: (email: string) => void;
}

type Errors = Partial<Record<'email' | 'password' | 'confirm' | 'consent' | 'form', string>>;

/**
 * Conversion invité → compte (POST /auth/upgrade) : e-mail, mot de passe, CGU et âge, comme
 * l'inscription. Le même utilisateur est conservé (animaux, carnet, rappels) ; la nouvelle paire
 * de jetons remplace la session invité sans rechargement de la page.
 */
export function UpgradeGuestForm({ onUpgraded }: UpgradeGuestFormProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { token, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = (): Errors => {
    const next: Errors = {};
    const trimmed = email.trim();
    if (!trimmed) next.email = t('auth.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) next.email = t('auth.emailInvalid');
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) next.password = t('auth.passwordMin');
    if (password !== confirm) next.confirm = t('auth.resetPasswordMismatch');
    if (!acceptTerms || !ageConfirmed) next.consent = t('auth.consentRequired');
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !token) return;
    setSubmitting(true);
    try {
      const session = await upgradeGuestAccount(token, {
        email: email.trim(),
        password,
        locale,
        acceptTerms,
        ageConfirmed,
      });
      login(session.accessToken, session.user, session.refreshToken);
      onUpgraded?.(session.user.email ?? email.trim());
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrors({ email: t('guest.upgradeEmailTaken') });
      } else if (err instanceof ApiError && err.status === 400) {
        setErrors({ form: err.message });
      } else {
        setErrors({ form: t('guest.upgradeError') });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <Field label={t('auth.emailLabel')} error={errors.email} required>
        <input
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
        />
      </Field>
      <Field label={t('auth.passwordLabel')} hint={t('auth.passwordMin')} error={errors.password} required>
        <input
          type="password"
          name="new-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          maxLength={PASSWORD_MAX}
        />
      </Field>
      <Field label={t('auth.confirmPasswordLabel')} error={errors.confirm} required>
        <input
          type="password"
          name="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          maxLength={PASSWORD_MAX}
        />
      </Field>

      <fieldset className="m-0 grid gap-2 border-0 p-0" aria-describedby={errors.consent ? 'upgrade-consent-error' : undefined}>
        <label className="flex items-start gap-2.5 text-ui text-ink">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
          />
          <span>
            {t.rich('auth.acceptTermsLabel', {
              terms: (chunks) => (
                <Link href="/cgu" target="_blank" rel="noopener noreferrer" className="text-accent-text underline">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/confidentialite" target="_blank" rel="noopener noreferrer" className="text-accent-text underline">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-ui text-ink">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0"
            checked={ageConfirmed}
            onChange={(e) => setAgeConfirmed(e.target.checked)}
          />
          <span>{t('auth.ageConfirmLabel')}</span>
        </label>
        {errors.consent ? (
          <p id="upgrade-consent-error" className="m-0 text-meta font-medium text-danger">
            {errors.consent}
          </p>
        ) : null}
      </fieldset>

      {errors.form ? (
        <p role="alert" className="m-0 text-ui font-medium text-danger">
          {errors.form}
        </p>
      ) : null}

      <div>
        <Button type="submit" size="lg" loading={submitting}>
          {t('guest.upgradeSubmit')}
        </Button>
      </div>
    </form>
  );
}

export default UpgradeGuestForm;
