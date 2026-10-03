'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError, api } from '@/lib/api';
import {
  communityApi,
  communityErrorKey,
  formatLongDate,
  markCommunityAvailable,
  suspendedUntilFromError,
  markCommunityUnavailable,
  type CommunityErrorKey,
  type CommunityMe,
} from '@/lib/community';
import { GUEST_UPGRADE_PATH } from '@/lib/guest';
import { communityDecisionPath } from '@/lib/platform';
import { Alert, AnimalSilhouette, Button, EmptyState, Skeleton, SkeletonGroup, buttonClasses } from '@/components/ui';
import { useCommunityAvailability } from './primitives';

export interface CommunitySession {
  token: string;
  /** Session invité (« Essayer sans compte ») : lecture seule. */
  isGuest: boolean;
  /** Profil et éligibilité (`GET /community/profile`). */
  me: CommunityMe;
  reloadMe: () => Promise<void>;
}

const CommunityContext = createContext<CommunitySession | null>(null);

/** Session communauté de la page (à appeler sous `CommunityGate`). */
export function useCommunity(): CommunitySession {
  const value = useContext(CommunityContext);
  if (!value) throw new Error('useCommunity() hors de <CommunityGate>');
  return value;
}

/** Variante tolérante (composants partagés hors des pages de la communauté). */
export function useOptionalCommunity(): CommunitySession | null {
  return useContext(CommunityContext);
}

export function GateSkeleton() {
  const t = useTranslations('community');
  return (
    <SkeletonGroup label={t('loading')} className="grid gap-4">
      <Skeleton width="40%" height={36} />
      <Skeleton width="70%" />
      <Skeleton shape="block" height={220} />
      <Skeleton shape="block" height={160} />
    </SkeletonGroup>
  );
}

/** Volet fermé (serveur `COMMUNITY_ENABLED=false` ou drapeau de build) : annonce, sans lien mort. */
export function CommunitySoon() {
  const t = useTranslations('community');
  return (
    <EmptyState
      size="page"
      headingLevel={1}
      illustration={<AnimalSilhouette kind="bird" size={72} />}
      title={t('soon.title')}
      benefit={t('soon.body')}
      action={
        <Link href="/mes-animaux" className={buttonClasses({ variant: 'secondary' })}>
          {t('soon.action')}
        </Link>
      }
    />
  );
}

/** Visiteur sans session : la communauté demande un compte. */
function JoinInvite() {
  const t = useTranslations('community');
  return (
    <div className="grid gap-4">
      <EmptyState
        size="page"
        headingLevel={1}
        illustration={<AnimalSilhouette kind="mammal" size={72} />}
        title={t('join.title')}
        benefit={t('join.body')}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/register" className={buttonClasses()}>
              {t('join.register')}
            </Link>
            <Link href="/login" className={buttonClasses({ variant: 'quiet' })}>
              {t('join.login')}
            </Link>
          </div>
        }
      />
      <p className="m-0 max-w-prose text-ui text-ink-2">{t('join.privacy')}</p>
    </div>
  );
}

/**
 * Message d'un état ou d'un refus (code de l'API → texte au ton de PRODUCT.md), avec l'action qui
 * débloque la situation : créer un compte, vérifier l'e-mail, activer son profil, relire les
 * règles, consulter la décision de suspension…
 */
export function CommunityNotice({
  errorKey,
  severity = 'warning',
  onRetry,
  suspendedUntil,
  accountWide = false,
  error,
  decisionId,
  className,
  token,
}: {
  errorKey: CommunityErrorKey;
  severity?: 'info' | 'warning' | 'urgent';
  onRetry?: () => void;
  /** Suspension : date de fin (déjà mise en forme). */
  suspendedUntil?: string | null;
  /** Suspension portée par le compte alors qu'aucun profil n'existe (départ puis retour). */
  accountWide?: boolean;
  /** Refus d'origine : la date de fin de suspension peut s'y lire (403 COMMUNITY_SUSPENDED). */
  error?: unknown;
  decisionId?: string | null;
  className?: string;
  /** Jeton : permet de renvoyer l'e-mail de vérification depuis le message. */
  token?: string | null;
}) {
  const t = useTranslations('community');
  const locale = useLocale();
  const errorUntil = suspendedUntilFromError(error);
  const until = suspendedUntil ?? (errorUntil ? formatLongDate(errorUntil, locale) : null);
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const sendVerification = async () => {
    if (!token) return;
    setResend('sending');
    try {
      await api.resendVerification(token);
      setResend('sent');
    } catch {
      setResend('error');
    }
  };

  let action: ReactNode = null;
  switch (errorKey) {
    case 'guest':
      action = (
        <Link href={GUEST_UPGRADE_PATH} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
          {t('actions.createAccount')}
        </Link>
      );
      break;
    case 'emailNotVerified':
      action =
        resend === 'sent' ? (
          <span className="text-ui font-medium text-ok">{t('actions.verificationSent')}</span>
        ) : token ? (
          <Button variant="secondary" size="sm" onClick={sendVerification} loading={resend === 'sending'}>
            {t('actions.resendVerification')}
          </Button>
        ) : null;
      break;
    case 'profileRequired':
    case 'ageRequired':
    case 'rulesNotAccepted':
      action = (
        <Link href="/communaute/profil" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
          {errorKey === 'rulesNotAccepted' ? t('actions.reviewRules') : t('actions.createProfile')}
        </Link>
      );
      break;
    case 'suspended':
      action = (
        <Link
          href={decisionId ? communityDecisionPath(decisionId) : '/communaute/decisions'}
          className={buttonClasses({ variant: 'secondary', size: 'sm' })}
        >
          {t('actions.seeDecision')}
        </Link>
      );
      break;
    case 'session':
      action = (
        <Link href="/login" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
          {t('actions.login')}
        </Link>
      );
      break;
    case 'network':
    case 'generic':
      action = onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('actions.retry')}
        </Button>
      ) : null;
      break;
    default:
      action = null;
  }

  return (
    <Alert severity={severity} className={className} title={t(`errors.${errorKey}.title`)} action={action}>
      {errorKey === 'suspended' && until
        ? t('errors.suspended.bodyUntil', { date: until })
        : errorKey === 'suspended' && accountWide
          ? t('errors.suspended.bodyNoDate')
          : t(`errors.${errorKey}.body`)}
      {resend === 'error' ? <span className="mt-1 block text-danger">{t('actions.verificationError')}</span> : null}
    </Alert>
  );
}

/**
 * Garde de toutes les pages de la communauté :
 *  1. volet fermé (drapeau de build, ou 404 de l'API) → annonce « Bientôt » ;
 *  2. pas de session → invitation à créer un compte (la communauté exige un compte) ;
 *  3. session → `GET /community/profile` (éligibilité), puis la page avec `useCommunity()`.
 * Un invité (« Essayer sans compte ») lit le fil ; écrire lui est refusé avec une invitation.
 */
export default function CommunityGate({ children }: { children: ReactNode }) {
  const availability = useCommunityAvailability();
  const { user, token, isLoading } = useAuth();
  const [me, setMe] = useState<CommunityMe | null>(null);
  const [error, setError] = useState<CommunityErrorKey | null>(null);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await communityApi.me(token);
      markCommunityAvailable();
      setMe(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        markCommunityUnavailable();
        return;
      }
      setError(communityErrorKey(err));
    }
  }, [token]);

  useEffect(() => {
    if (availability === 'unavailable' || !token) return;
    let cancelled = false;
    communityApi
      .me(token)
      .then((data) => {
        if (cancelled) return;
        markCommunityAvailable();
        setMe(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          markCommunityUnavailable();
          return;
        }
        setError(communityErrorKey(err));
      });
    return () => {
      cancelled = true;
    };
  }, [token, availability, attempt]);

  if (availability === 'unavailable') return <CommunitySoon />;
  if (isLoading) return <GateSkeleton />;
  if (!token || !user) return <JoinInvite />;
  if (error) {
    return (
      <CommunityNotice
        errorKey={error}
        severity="urgent"
        onRetry={() => {
          setError(null);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (!me) return <GateSkeleton />;

  return (
    <CommunityContext.Provider value={{ token, isGuest: user.isGuest === true, me, reloadMe: load }}>
      {children}
    </CommunityContext.Provider>
  );
}

/** Mise en page commune : conteneur et rythme vertical des pages de la communauté. */
export function CommunityPage({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return <div className={narrow ? 'cv-container grid max-w-3xl gap-6 py-6 sm:py-8' : 'cv-container grid gap-6 py-6 sm:py-8'}>{children}</div>;
}

/** Bandeau d'éligibilité : le premier motif qui empêche de publier, et comment le lever. */
export function EligibilityNotice({ className }: { className?: string }) {
  const { me, token } = useCommunity();
  const locale = useLocale();
  if (me.canPublish || me.reasons.length === 0) return null;
  const reason = me.reasons[0];
  const key: CommunityErrorKey =
    reason === 'GUEST_ACCOUNT'
      ? 'guest'
      : reason === 'EMAIL_NOT_VERIFIED'
        ? 'emailNotVerified'
        : reason === 'COMMUNITY_PROFILE_REQUIRED'
          ? 'profileRequired'
          : reason === 'COMMUNITY_RULES_NOT_ACCEPTED'
            ? 'rulesNotAccepted'
            : 'suspended';
  const until = me.profile?.suspendedUntil ?? null;
  return (
    <CommunityNotice
      errorKey={key}
      severity="info"
      token={token}
      className={className}
      suspendedUntil={until ? formatLongDate(until, locale) : null}
      accountWide={key === 'suspended' && !me.profile}
    />
  );
}
