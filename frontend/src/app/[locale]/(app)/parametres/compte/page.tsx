'use client';

import { useState, useEffect, useRef, useId, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { languageNames } from '@/components/LanguageSelector';
import { Link, useRouter, usePathname } from '@/i18n/navigation';
import type { Locale } from '../../../../../../i18n/routing';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { errorKey } from '@/lib/api-errors';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/config';
import {
  AccountApiError,
  deleteMyAccount,
  downloadBlob,
  exportMyData,
} from '@/lib/account-api';
import { isGuestUser } from '@/lib/guest';
import { GuestFeatureNote } from '@/components/guest/GuestFeatureNote';
import { GuestSaveBanner } from '@/components/guest/GuestSaveBanner';
import { Alert, Button, Card, Field, Modal, Skeleton, SkeletonGroup, Toast } from '@/components/ui';
import { SettingsHeader } from '../_components/SettingsHeader';

interface DeleteAccountModalProps {
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  /** Invité : aucun mot de passe à saisir (le compte n'en a pas). */
  guest?: boolean;
  error: string;
  loading: boolean;
}

/** Confirmation destructive : ui/Modal en variante alertdialog (focus piégé, Échap, focus rendu). */
function DeleteAccountModal({ onClose, onConfirm, error, loading, guest = false }: DeleteAccountModalProps) {
  const t = useTranslations();
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password && !guest) {
      setLocalError(t('account.modalPasswordRequired'));
      return;
    }
    setLocalError('');
    await onConfirm(password);
  };

  const shownError = localError || error;

  return (
    <Modal
      open
      onClose={onClose}
      variant="alertdialog"
      size="md"
      title={t('account.modalTitle')}
      description={t('account.modalWarning')}
      dismissible={!loading}
      hideCloseButton
      initialFocusRef={guest ? undefined : inputRef}
    >
      <form onSubmit={handleSubmit} className="grid gap-5" noValidate>
        {guest ? (
          <p className="m-0 text-ui text-ink-2">{t('guest.deleteGuestHint')}</p>
        ) : (
          <Field label={t('account.modalPasswordLabel')} id={inputId}>
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              aria-invalid={shownError ? true : undefined}
              aria-describedby={shownError ? errorId : undefined}
              disabled={loading}
            />
          </Field>
        )}
        {shownError && (
          <p id={errorId} role="alert" className="m-0 text-ui font-medium text-danger">
            {shownError}
          </p>
        )}
        <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="danger" loading={loading}>
            {loading ? t('account.modalDeleting') : t('account.modalConfirm')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ComptePage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, isLoading: authLoading, logout, logoutAll, updateToken } = useAuth();
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const [logoutAllError, setLogoutAllError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [selectedLocale, setSelectedLocale] = useState('fr');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // Évite la redirection vers /login quand la déconnexion suit une suppression de compte.
  const [accountDeleted, setAccountDeleted] = useState(false);
  // Session invité : ni mot de passe, ni déconnexion (elle ferait perdre l'accès aux données).
  const guest = isGuestUser(user);

  useEffect(() => {
    if (!authLoading && !user && !accountDeleted) {
      router.push('/login');
    }
  }, [user, authLoading, router, accountDeleted]);

  useEffect(() => {
    if (user?.locale) {
      setSelectedLocale(user.locale);
    }
  }, [user]);

  const closeToast = useCallback(() => setToast(null), []);

  const handleLocaleChange = (newLocale: string) => {
    setSelectedLocale(newLocale);

    // La navigation next-intl gère le préfixe de locale ; on conserve la query string.
    const search = typeof window !== 'undefined' ? window.location.search : '';
    router.replace(`${pathname}${search}`, { locale: newLocale as Locale });

    setToast(t('common.languageSaved'));
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (!currentPassword.trim()) {
      setPasswordError(t('profile.currentPasswordRequired'));
      return;
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH || newPassword.length > PASSWORD_MAX_LENGTH) {
      setPasswordError(t('auth.passwordMin'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('auth.resetPasswordMismatch'));
      return;
    }
    if (!token) {
      setPasswordError(t('profile.mustBeLoggedIn'));
      return;
    }

    setPasswordLoading(true);
    try {
      // Le backend incrémente tokenVersion : l'ancien jeton est révoqué, on adopte le nouveau.
      const res = await api.changePassword(token, currentPassword, newPassword);
      if (res?.accessToken) updateToken(res.accessToken, res.refreshToken);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setToast(t('common.passwordChanged'));
    } catch (err: unknown) {
      // 400 / 401 : mot de passe actuel refusé ; jamais le message brut de l'API.
      setPasswordError(
        t(errorKey(err, { statuses: { 400: 'profile.changePasswordError', 401: 'profile.changePasswordError' }, fallback: 'profile.changePasswordError' })),
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleExport = async () => {
    if (!token) return;
    setExportError('');
    setExportLoading(true);
    try {
      const { blob, filename } = await exportMyData(token);
      downloadBlob(blob, filename);
      setToast(t('account.exportSuccess'));
    } catch {
      setExportError(t('account.exportError'));
    } finally {
      setExportLoading(false);
    }
  };

  // W1-01 : révoque toutes les sessions (tous appareils, y compris celui-ci).
  const handleLogoutAll = async () => {
    setLogoutAllError('');
    setLogoutAllLoading(true);
    try {
      await logoutAll();
      router.replace('/login');
    } catch {
      setLogoutAllError(t('sessions.logoutAllError'));
      setLogoutAllLoading(false);
    }
  };

  const handleDeleteAccount = async (password: string) => {
    if (!token) return;
    setDeleteError('');
    setDeleteLoading(true);
    try {
      await deleteMyAccount(token, guest ? undefined : password);
      setAccountDeleted(true);
      logout();
      router.replace('/');
    } catch (err) {
      setDeleteError(
        err instanceof AccountApiError && err.status === 401
          ? t('account.modalWrongPassword')
          : t('account.modalError'),
      );
      setDeleteLoading(false);
    }
  };

  /** Date d'inscription (absente des anciens profils : la ligne est alors masquée, jamais « - »). */
  const createdAt = (user as { createdAt?: string } | null)?.createdAt;
  const memberSince =
    createdAt && !Number.isNaN(new Date(createdAt).getTime())
      ? new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(createdAt))
      : null;

  if (authLoading) {
    return (
      <div className="cv-container py-6 sm:py-8">
        <SkeletonGroup label={t('common.loading')} className="grid gap-6">
          <Skeleton width="35%" height={40} />
          <div className="grid gap-6 md:grid-cols-12">
            <div className="grid gap-6 md:col-span-8">
              <Skeleton shape="block" height={220} />
              <Skeleton shape="block" height={160} />
            </div>
            <Skeleton shape="block" height={180} className="md:col-span-4" />
          </div>
        </SkeletonGroup>
      </div>
    );
  }

  const cancelPasswordForm = () => {
    setShowPasswordForm(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  return (
    <div className="cv-container grid gap-6 py-6 sm:py-8">
      <GuestSaveBanner dismissible={false} />
      <SettingsHeader title={t('account.pageTitle')} description={t('account.pageLead')} />

      <div className="grid gap-6 md:grid-cols-12">
        <div className="grid min-w-0 content-start gap-6 md:col-span-8">
          {/* Profil */}
          <Card as="section" title={t('account.profileTitle')} titleId="profile-title">
            <dl className="m-0 grid gap-0 text-ui sm:grid-cols-2 sm:gap-x-6">
              <div className="grid gap-1 border-b border-line pb-4 sm:border-b-0">
                <dt className="text-ink-2">{t('common.email')}</dt>
                <dd className="m-0 break-all text-body text-ink">{user?.email ?? t('guest.accountNoEmail')}</dd>
              </div>
              {memberSince ? (
                <div className="grid gap-1 py-4 sm:py-0">
                  <dt className="text-ink-2">{t('common.memberSince')}</dt>
                  <dd className="m-0 font-mono text-body text-ink">{memberSince}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-2 border-t border-line pt-5 sm:mt-6">
              <Field label={t('common.language')} hint={t('account.languageHint')} id="account-locale" className="max-w-xs">
                <select value={selectedLocale} onChange={(e) => handleLocaleChange(e.target.value)}>
                  {(Object.keys(languageNames) as Array<keyof typeof languageNames>).map((code) => (
                    <option key={code} value={code}>
                      {languageNames[code]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>

          {/* Mot de passe — un invité n'en a pas. */}
          {guest ? (
            <GuestFeatureNote>{t('guest.passwordNote')}</GuestFeatureNote>
          ) : (
            <Card
              as="section"
              title={t('common.password')}
              titleId="password-title"
              actions={
                showPasswordForm ? undefined : (
                  <Button variant="secondary" size="sm" onClick={() => setShowPasswordForm(true)}>
                    {t('common.changePassword')}
                  </Button>
                )
              }
            >
              <p className="m-0 text-ui text-ink-2">
                {t('account.passwordIntro')}{' '}
                <Link href="/forgot-password" className="text-accent-text underline underline-offset-2">
                  {t('auth.forgotPassword')}
                </Link>
              </p>
              {passwordSuccess && !showPasswordForm ? (
                <p role="status" className="m-0 mt-3 text-ui font-medium text-ok">
                  {t('common.passwordChanged')}
                </p>
              ) : null}

              {showPasswordForm ? (
                <form onSubmit={handlePasswordSubmit} className="mt-5 grid gap-4 border-t border-line pt-5">
                  <Field label={t('profile.currentPassword')} id="current-password">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t('profile.newPassword')} hint={t('account.passwordRule')} id="new-password">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={PASSWORD_MIN_LENGTH}
                        maxLength={PASSWORD_MAX_LENGTH}
                        autoComplete="new-password"
                      />
                    </Field>
                    <Field label={t('common.confirmPassword')} id="confirm-password">
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={PASSWORD_MIN_LENGTH}
                        maxLength={PASSWORD_MAX_LENGTH}
                        autoComplete="new-password"
                      />
                    </Field>
                  </div>

                  {passwordError ? <Alert severity="urgent" title={passwordError} /> : null}

                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" loading={passwordLoading}>
                      {passwordLoading ? t('common.loading') : t('common.save')}
                    </Button>
                    <Button variant="quiet" onClick={cancelPasswordForm}>
                      {t('common.cancel')}
                    </Button>
                  </div>
                </form>
              ) : null}
            </Card>
          )}

          {/* Appareils connectés (W1-01) — pas pour un invité : tout déconnecter perdrait ses données. */}
          {!guest ? (
            <Card as="section" title={t('sessions.title')} titleId="sessions-title">
              <div className="grid gap-3">
                <p className="m-0 text-body text-ink-2">{t('sessions.logoutAllDescription')}</p>
                <p className="m-0 text-ui text-ink-2">{t('sessions.accessRevokedNotice')}</p>
                <div className="pt-1">
                  <Button variant="secondary" onClick={handleLogoutAll} loading={logoutAllLoading}>
                    {logoutAllLoading ? t('sessions.logoutAllLoading') : t('sessions.logoutAllButton')}
                  </Button>
                </div>
                {logoutAllError ? (
                  <p role="alert" className="m-0 text-ui font-medium text-danger">
                    {logoutAllError}
                  </p>
                ) : null}
              </div>
            </Card>
          ) : null}

          {/* Mes données (RGPD) */}
          <Card as="section" title={t('account.sectionTitle')} titleId="my-data-title">
            <p className="m-0 text-body text-ink-2">{t('account.sectionIntro')}</p>

            <div className="mt-6 grid gap-3 border-t border-line pt-5">
              <h3 className="m-0 text-body font-semibold text-ink">{t('account.exportTitle')}</h3>
              <p className="m-0 text-ui text-ink-2">{t('account.exportDescription')}</p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button variant="secondary" onClick={handleExport} loading={exportLoading} disabled={!token}>
                  {exportLoading ? t('account.exportLoading') : t('account.exportButton')}
                </Button>
                <span className="font-mono text-meta text-ink-2">JSON</span>
              </div>
              {exportError ? (
                <p role="alert" className="m-0 text-ui font-medium text-danger">
                  {exportError}
                </p>
              ) : null}
            </div>

            <div className="mt-6 grid gap-3 rounded-control bg-danger-soft p-4 shadow-[inset_3px_0_0_var(--danger)]">
              <h3 className="m-0 text-body font-semibold text-danger">{t('account.deleteTitle')}</h3>
              <p className="m-0 text-ui text-ink-2">{t('account.deleteDescription')}</p>
              <div className="pt-1">
                <Button
                  variant="danger"
                  onClick={() => {
                    setDeleteError('');
                    setShowDeleteModal(true);
                  }}
                >
                  {t('account.deleteButton')}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Cet appareil : déconnexion (pas pour un invité : la session est son seul accès à ses données). */}
        {!guest ? (
          <aside className="grid min-w-0 content-start gap-6 md:col-span-4">
            <Card tone="sunken" className="grid gap-4">
              <h2 className="m-0 font-display text-h4 font-semibold text-ink">{t('account.thisDeviceTitle')}</h2>
              <p className="m-0 text-ui text-ink-2">
                {t('account.thisDeviceText', { email: user?.email ?? '' })}
              </p>
              <Button variant="secondary" onClick={logout} fullWidth>
                {t('common.logout')}
              </Button>
            </Card>
            <ul className="m-0 grid list-none gap-2 p-0 text-ui">
              <li>
                <Link href="/confidentialite" className="text-accent-text underline underline-offset-2">
                  {t('account.privacyLink')}
                </Link>
              </li>
              <li>
                <Link href="/suppression-compte" className="text-accent-text underline underline-offset-2">
                  {t('account.deletionHelpLink')}
                </Link>
              </li>
            </ul>
          </aside>
        ) : null}
      </div>

      {toast ? <Toast message={toast} type="success" onClose={closeToast} /> : null}

      {showDeleteModal && (
        <DeleteAccountModal
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteAccount}
          error={deleteError}
          loading={deleteLoading}
          guest={guest}
        />
      )}
    </div>
  );
}
