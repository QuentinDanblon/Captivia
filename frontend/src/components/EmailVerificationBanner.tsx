'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';

type SendState = 'idle' | 'sending' | 'sent' | 'tooSoon' | 'error';

/**
 * W2-04 — bandeau non bloquant « vérifiez votre e-mail ». Affiché uniquement quand le
 * profil indique explicitement `emailVerified === false` (anciens caches : rien).
 */
export function EmailVerificationBanner() {
  const t = useTranslations('emailVerification');
  const pathname = usePathname();
  const { user, token } = useAuth();
  const [state, setState] = useState<SendState>('idle');
  const [dismissed, setDismissed] = useState(false);

  if (!user || user.emailVerified !== false || dismissed) return null;
  if (pathname?.startsWith('/verifier-email')) return null;

  const resend = async () => {
    if (!token) return;
    setState('sending');
    try {
      await api.resendVerification(token);
      setState('sent');
    } catch (err) {
      setState(err instanceof ApiError && err.status === 429 ? 'tooSoon' : 'error');
    }
  };

  const feedback =
    state === 'sent'
      ? t('bannerSent')
      : state === 'tooSoon'
        ? t('bannerTooSoon')
        : state === 'error'
          ? t('bannerError')
          : null;

  return (
    <div
      role="status"
      className="w-full bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100"
    >
      <div className="max-w-5xl mx-auto px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <p className="flex-1 min-w-0">{feedback ?? t('bannerText')}</p>
        {state !== 'sent' && (
          <button
            type="button"
            onClick={resend}
            disabled={state === 'sending'}
            className="font-medium underline hover:no-underline disabled:opacity-60"
          >
            {state === 'sending' ? t('bannerSending') : t('bannerResend')}
          </button>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-amber-700 dark:text-amber-300 hover:underline"
        >
          {t('bannerDismiss')}
        </button>
      </div>
    </div>
  );
}
