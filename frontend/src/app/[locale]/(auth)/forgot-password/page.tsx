'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { errorKey } from '@/lib/api-errors';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { Alert, Button, Field } from '@/components/ui';

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
      await api.forgotPassword(email);
      // Toujours le même message traduit (l'API ne dit pas si le compte existe).
      setMessage(t('auth.forgotPasswordSuccess'));
    } catch (err: unknown) {
      setError(t(errorKey(err, { fallback: 'auth.forgotPasswordError' })));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame title={t('auth.forgotHeading')} lead={t('auth.forgotLead')} photo="rabbitStraw">
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

          {message && <Alert severity="info" title={message}>{t('auth.forgotSpamHint')}</Alert>}
          {error && <Alert severity="urgent" title={error} />}

          <Button type="submit" size="lg" fullWidth loading={loading}>
            {loading ? t('common.loading') : t('auth.forgotPasswordSubmit')}
          </Button>
        </form>

        <p className="m-0 border-t border-line pt-6 text-ui text-ink-2">
          {t('auth.rememberedPassword')}{' '}
          <Link href="/login" className="font-medium text-accent-text underline underline-offset-2">
            {t('auth.backToLogin')}
          </Link>
        </p>
      </div>
    </AuthFrame>
  );
}
