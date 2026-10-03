'use client';

import { useId, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { usePhotoPicker } from '@/components/usePhotoPicker';
import { Alert, Button, Card, Field, SectionHeader, Toast, buttonClasses } from '@/components/ui';
import CommunityGate, { CommunityNotice, CommunityPage, useCommunity } from '@/components/community/CommunityGate';
import { RulesDigest, useIsOperator } from '@/components/community/CommunityAside';
import { BackLink, CommunityAvatar, ConfirmModal } from '@/components/community/primitives';
import {
  communityApi,
  communityErrorKey,
  formatLongDate,
  isValidHandleFormat,
  normalizeHandleInput,
  type CommunityErrorKey,
} from '@/lib/community';
import { isImageTooLargeError, isUnsupportedImageError, prepareCommunityImage, type PreparedImage } from '@/lib/image';
import { communityProfilePath } from '@/lib/platform';

const HANDLE_ERRORS: CommunityErrorKey[] = ['handleInvalid', 'handleReserved', 'handleTaken'];

/** Erreur d'image traduite (format, HEIC, dimensions, poids). */
function useImageErrorMessage() {
  const t = useTranslations('community');
  return (err: unknown) =>
    isUnsupportedImageError(err)
      ? t(`compose.photoError.${err.reason}`, { name: t('compose.unnamedPhoto') })
      : isImageTooLargeError(err)
        ? t('compose.photoError.tooLarge', { name: t('compose.unnamedPhoto') })
        : t('compose.photoError.unreadable', { name: t('compose.unnamedPhoto') });
}

/** Activation explicite du profil public : pseudo, avatar facultatif, règles acceptées (version). */
function ActivationForm() {
  const t = useTranslations('community');
  const { token, me, reloadMe } = useCommunity();
  const id = useId();
  const imageError = useImageErrorMessage();
  const [handle, setHandle] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [avatar, setAvatar] = useState<{ prepared: PreparedImage; preview: string } | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ handle?: string; rules?: string; age?: string }>({});
  const [submitError, setSubmitError] = useState<CommunityErrorKey | null>(null);
  const [rawError, setRawError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [avatarWarning, setAvatarWarning] = useState(false);

  const picker = usePhotoPicker({
    onFile: async (file) => {
      setAvatarError(null);
      try {
        const prepared = await prepareCommunityImage(file);
        setAvatar((prev) => {
          if (prev) URL.revokeObjectURL(prev.preview);
          return { prepared, preview: URL.createObjectURL(prepared.blob) };
        });
      } catch (err) {
        setAvatarError(imageError(err));
      }
    },
    onError: setAvatarError,
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = normalizeHandleInput(handle);
    const next: typeof errors = {};
    if (!isValidHandleFormat(value)) next.handle = t('errors.handleInvalid.body');
    if (!accepted) next.rules = t('profile.rulesRequired');
    if (me.ageConfirmationRequired && !ageConfirmed) next.age = t('profile.ageRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await communityApi.activate(token, {
        handle: value,
        acceptRules: true,
        rulesVersion: me.currentRulesVersion,
        ...(me.ageConfirmationRequired ? { ageConfirmed: true } : {}),
      });
      if (avatar) {
        try {
          const media = await communityApi.uploadMedia(token, avatar.prepared.blob, avatar.prepared.filename);
          await communityApi.updateProfile(token, { avatarMediaId: media.id });
        } catch {
          // Profil créé : l'avatar pourra être ajouté ensuite, on le signale sans bloquer.
          setAvatarWarning(true);
        }
      }
      await reloadMe();
    } catch (err) {
      const key = communityErrorKey(err);
      if (HANDLE_ERRORS.includes(key)) setErrors({ handle: t(`errors.${key}.body`) });
      else {
        setSubmitError(key);
        setRawError(err);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <Card as="section" padding="lg" className="lg:col-span-7" title={t('profile.activateTitle')} titleId="activation">
        <form onSubmit={submit} className="grid gap-6" noValidate>
          <p className="m-0 text-body text-ink-2">{t('profile.activateLead')}</p>
          <Field label={t('profile.handleLabel')} hint={t('profile.handleHint')} error={errors.handle} required>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={32}
              className="font-mono"
            />
          </Field>

          <div className="grid gap-2">
            <p className="m-0 text-ui font-medium text-ink">{t('profile.avatarLabel')}</p>
            <div className="flex flex-wrap items-center gap-4">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:)
                <img src={avatar.preview} alt={t('profile.avatarPreview')} className="size-16 rounded-full border border-line object-cover" />
              ) : (
                <CommunityAvatar url={null} size={64} />
              )}
              <Button variant="secondary" size="sm" onClick={() => void picker.open()}>
                {avatar ? t('profile.avatarChange') : t('profile.avatarChoose')}
              </Button>
              {avatar ? (
                <Button variant="quiet" size="sm" onClick={() => setAvatar(null)}>
                  {t('profile.avatarRemove')}
                </Button>
              ) : null}
            </div>
            <input ref={picker.inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={picker.onChange} className="hidden" tabIndex={-1} aria-hidden="true" />
            <p className="m-0 text-meta text-ink-2">{t('profile.avatarHint')}</p>
            {avatarError ? (
              <p role="alert" className="m-0 text-meta font-medium text-danger">
                {avatarError}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <label htmlFor={`${id}-rules`} className="flex min-h-11 cursor-pointer items-start gap-3 text-body text-ink">
              <input
                id={`${id}-rules`}
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1"
                aria-invalid={errors.rules ? true : undefined}
                aria-describedby={errors.rules ? `${id}-rules-error` : undefined}
              />
              <span>
                {t('profile.acceptRules')}{' '}
                <span className="font-mono text-meta text-ink-2">{t('profile.rulesVersion', { version: me.currentRulesVersion })}</span>
              </span>
            </label>
            <Link href="/communaute/regles" className="ml-7 justify-self-start text-ui text-accent-text underline underline-offset-2">
              {t('profile.readRules')}
            </Link>
            {errors.rules ? (
              <p id={`${id}-rules-error`} role="alert" className="m-0 ml-7 text-meta font-medium text-danger">
                {errors.rules}
              </p>
            ) : null}
          </div>

          {me.ageConfirmationRequired ? (
            <div className="grid gap-1">
              <label htmlFor={`${id}-age`} className="flex min-h-11 cursor-pointer items-start gap-3 text-body text-ink">
                <input
                  id={`${id}-age`}
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                  className="mt-1"
                  aria-invalid={errors.age ? true : undefined}
                  aria-describedby={errors.age ? `${id}-age-error` : undefined}
                />
                <span>{t('profile.confirmAge')}</span>
              </label>
              {errors.age ? (
                <p id={`${id}-age-error`} role="alert" className="m-0 ml-7 text-meta font-medium text-danger">
                  {errors.age}
                </p>
              ) : null}
            </div>
          ) : null}

          {submitError ? <CommunityNotice errorKey={submitError} severity="urgent" token={token} error={rawError} accountWide /> : null}
          {avatarWarning ? <Alert severity="warning" title={t('profile.avatarLater')} /> : null}

          <div>
            <Button type="submit" size="lg" loading={busy}>
              {t('profile.activate')}
            </Button>
          </div>
        </form>
      </Card>
      <div className="grid content-start gap-4 lg:col-span-5">
        <RulesDigest />
        <Card tone="outline" padding="md" className="grid gap-2">
          <h2 className="m-0 font-display text-h4 font-semibold text-ink">{t('profile.visibleTitle')}</h2>
          <ul className="m-0 grid gap-1 pl-5 text-ui text-ink-2">
            <li>{t('profile.visibleHandle')}</li>
            <li>{t('profile.visibleAvatar')}</li>
            <li>{t('profile.visiblePosts')}</li>
          </ul>
          <p className="m-0 text-ui text-ink-2">{t('profile.neverVisible')}</p>
        </Card>
      </div>
    </div>
  );
}

/** Profil actif : pseudo, avatar, règles en vigueur, liens personnels, départ de la communauté. */
function ProfileSettings() {
  const t = useTranslations('community');
  const locale = useLocale();
  const router = useRouter();
  const { token, me, reloadMe } = useCommunity();
  const profile = me.profile!;
  const operator = useIsOperator(token);
  const imageError = useImageErrorMessage();
  const [handle, setHandle] = useState(profile.handle);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'handle' | 'avatar' | 'rules' | null>(null);
  const [error, setError] = useState<CommunityErrorKey | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const rulesOutdated = profile.rulesVersion !== me.currentRulesVersion;
  const suspended = profile.suspendedUntil;

  const run = async (kind: 'handle' | 'avatar' | 'rules', action: () => Promise<unknown>, done: string) => {
    setSaving(kind);
    setError(null);
    try {
      await action();
      await reloadMe();
      setToast(done);
    } catch (err) {
      const key = communityErrorKey(err);
      if (kind === 'handle' && HANDLE_ERRORS.includes(key)) setHandleError(t(`errors.${key}.body`));
      else setError(key);
    } finally {
      setSaving(null);
    }
  };

  const picker = usePhotoPicker({
    onFile: async (file) => {
      setAvatarError(null);
      let prepared: PreparedImage;
      try {
        prepared = await prepareCommunityImage(file);
      } catch (err) {
        setAvatarError(imageError(err));
        return;
      }
      await run(
        'avatar',
        async () => {
          const media = await communityApi.uploadMedia(token, prepared.blob, prepared.filename);
          await communityApi.updateProfile(token, { avatarMediaId: media.id });
        },
        t('profile.avatarSaved'),
      );
    },
    onError: setAvatarError,
  });

  const saveHandle = async (event: FormEvent) => {
    event.preventDefault();
    const value = normalizeHandleInput(handle);
    if (!isValidHandleFormat(value)) {
      setHandleError(t('errors.handleInvalid.body'));
      return;
    }
    setHandleError(null);
    if (value === profile.handle) return;
    await run('handle', () => communityApi.updateProfile(token, { handle: value }), t('profile.handleSaved'));
  };

  const leave = async () => {
    setLeaveBusy(true);
    setLeaveError(null);
    try {
      await communityApi.leave(token);
      await reloadMe();
      setLeaving(false);
      router.replace('/communaute');
    } catch (err) {
      setLeaveError(t(`errors.${communityErrorKey(err)}.title`));
    } finally {
      setLeaveBusy(false);
    }
  };

  const links = [
    { href: communityProfilePath(profile.handle), label: t('profile.seePublic') },
    { href: '/communaute/blocages', label: t('aside.blocks') },
    { href: '/communaute/decisions', label: t('aside.decisions') },
    { href: '/communaute/regles', label: t('aside.rulesLink') },
    ...(operator ? [{ href: '/communaute/moderation', label: t('aside.moderation') }] : []),
  ];

  return (
    <div className="grid gap-6">
      {rulesOutdated ? (
        <Alert
          severity="warning"
          title={t('profile.rulesUpdatedTitle', { version: me.currentRulesVersion })}
          action={
            <Button size="sm" loading={saving === 'rules'} onClick={() => run('rules', () => communityApi.updateProfile(token, { acceptRulesVersion: me.currentRulesVersion }), t('profile.rulesAccepted'))}>
              {t('profile.acceptNewRules')}
            </Button>
          }
        >
          {t('profile.rulesUpdatedBody')}{' '}
          <Link href="/communaute/regles" className="text-accent-text underline underline-offset-2">
            {t('profile.readRules')}
          </Link>
        </Alert>
      ) : null}
      {suspended ? <CommunityNotice errorKey="suspended" suspendedUntil={formatLongDate(suspended, locale)} /> : null}
      {error ? <CommunityNotice errorKey={error} severity="urgent" token={token} /> : null}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="grid content-start gap-6 lg:col-span-7">
          <Card as="section" title={t('profile.identityTitle')} titleId="identite">
            <div className="grid gap-6">
              <div className="flex flex-wrap items-center gap-4">
                <CommunityAvatar url={profile.avatarUrl} size={72} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => void picker.open()} loading={saving === 'avatar'} disabled={Boolean(suspended)}>
                    {profile.avatarUrl ? t('profile.avatarChange') : t('profile.avatarChoose')}
                  </Button>
                  {profile.avatarUrl ? (
                    <Button
                      variant="quiet"
                      size="sm"
                      disabled={Boolean(suspended) || saving !== null}
                      onClick={() => run('avatar', () => communityApi.updateProfile(token, { avatarMediaId: null }), t('profile.avatarRemoved'))}
                    >
                      {t('profile.avatarRemove')}
                    </Button>
                  ) : null}
                </div>
                <input ref={picker.inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={picker.onChange} className="hidden" tabIndex={-1} aria-hidden="true" />
              </div>
              {avatarError ? (
                <p role="alert" className="m-0 text-meta font-medium text-danger">
                  {avatarError}
                </p>
              ) : null}
              <form onSubmit={saveHandle} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" noValidate>
                <Field label={t('profile.handleLabel')} hint={t('profile.handleHint')} error={handleError ?? undefined}>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={32}
                    className="font-mono"
                    disabled={Boolean(suspended)}
                  />
                </Field>
                <Button type="submit" variant="secondary" loading={saving === 'handle'} disabled={Boolean(suspended)} className="sm:mb-[1.6rem]">
                  {t('profile.saveHandle')}
                </Button>
              </form>
              <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 border-t border-line pt-4 text-ui">
                <dt className="text-ink-2">{t('profile.memberSince')}</dt>
                <dd className="m-0 font-mono text-ink">{formatLongDate(profile.createdAt, locale)}</dd>
                <dt className="text-ink-2">{t('profile.rulesAcceptedOn')}</dt>
                <dd className="m-0 font-mono text-ink">
                  {formatLongDate(profile.rulesAcceptedAt, locale)} · {profile.rulesVersion}
                </dd>
              </dl>
            </div>
          </Card>

          <Card as="section" tone="outline" title={t('profile.leaveTitle')} titleId="quitter" className="shadow-[inset_3px_0_0_var(--danger)]">
            <p className="m-0 mb-4 text-body text-ink-2">{t('profile.leaveBody')}</p>
            <Button variant="danger" onClick={() => setLeaving(true)}>
              {t('profile.leave')}
            </Button>
          </Card>
        </div>

        <nav aria-label={t('aside.linksLabel')} className="lg:col-span-5">
          <ul className="m-0 grid list-none divide-y divide-line rounded-card border border-line bg-surface p-0">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-ui text-ink no-underline transition-colors hover:bg-sunken hover:text-accent-text">
                  {link.label}
                  <ChevronRight size={16} aria-hidden="true" className="text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <ConfirmModal
        open={leaving}
        title={t('profile.leaveConfirmTitle')}
        message={t('profile.leaveConfirmBody')}
        confirmLabel={t('profile.leave')}
        busy={leaveBusy}
        error={leaveError}
        onConfirm={leave}
        onCancel={() => setLeaving(false)}
      />
      {toast ? <Toast type="success" message={toast} onClose={() => setToast(null)} /> : null}
    </div>
  );
}

function ProfileView() {
  const t = useTranslations('community');
  const { me, isGuest, token } = useCommunity();
  if (isGuest) return <CommunityNotice errorKey="guest" severity="info" />;
  if (me.reasons.includes('EMAIL_NOT_VERIFIED')) return <CommunityNotice errorKey="emailNotVerified" severity="info" token={token} />;
  // Suspension portée par le compte : quitter puis revenir ne la lève pas, l'activation attendra.
  if (!me.profile && me.reasons.includes('COMMUNITY_SUSPENDED')) return <CommunityNotice errorKey="suspended" accountWide />;
  return (
    <>
      {me.profile ? <ProfileSettings /> : <ActivationForm />}
      <p className="m-0 text-meta text-ink-2">
        {t('profile.dataNote')}{' '}
        <Link href="/confidentialite" className={buttonClasses({ variant: 'quiet', size: 'sm', className: 'px-1 align-baseline' })}>
          {t('profile.privacyLink')}
        </Link>
      </p>
    </>
  );
}

/** Mon profil communauté : activation explicite, puis réglages et départ. */
export default function MyCommunityProfilePage() {
  const t = useTranslations('community');
  return (
    <CommunityGate>
      <CommunityPage>
        <BackLink href="/communaute">{t('post.backToFeed')}</BackLink>
        <SectionHeader title={t('profile.title')} description={t('profile.lead')} />
        <ProfileView />
      </CommunityPage>
    </CommunityGate>
  );
}
