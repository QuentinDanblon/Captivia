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

  // Invité : aucune adresse à vérifier (l'invitation à créer un compte est portée ailleurs).
  if (!user || user.isGuest || user.emailVerified !== false || dismissed) return null;
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

  // `noprint` : le bandeau ne sort jamais à l'impression (carnet de santé imprimable).
  return (
    <div role="status" className="noprint w-full border-b border-line bg-warn-soft text-ink">
      <div className="cv-container flex flex-wrap items-center gap-x-4 py-1 text-ui">
        <p className="m-0 min-w-0 flex-1 py-2">
          <span aria-hidden="true" className="mr-2 inline-block size-2 rounded-full bg-warn align-middle" />
          {feedback ?? t('bannerText')}
        </p>
        <div className="flex items-center gap-1">
          {state !== 'sent' && (
            <button
              type="button"
              onClick={resend}
              disabled={state === 'sending'}
              className="min-h-11 rounded-control px-2 font-medium text-ink underline decoration-1 underline-offset-[0.18em] transition-colors hover:bg-sunken disabled:opacity-60"
            >
              {state === 'sending' ? t('bannerSending') : t('bannerResend')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="min-h-11 rounded-control px-2 text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
          >
            {t('bannerDismiss')}
          </button>
        </div>
      </div>
    </div>
  );
}
