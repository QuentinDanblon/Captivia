'use client';

import { useState, useEffect, useRef, useId } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter, usePathname } from '@/i18n/navigation';
import type { Locale } from '../../../../../i18n/routing';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  AccountApiError,
  deleteMyAccount,
  downloadBlob,
  exportMyData,
} from '@/lib/account-api';

const SUPPORTED_LOCALES = ['fr', 'en', 'es', 'de', 'it', 'pt'];

interface DeleteAccountModalProps {
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  error: string;
  loading: boolean;
}

/** Modale de confirmation accessible : role=alertdialog, focus piégé, Échap pour fermer. */
function DeleteAccountModal({ onClose, onConfirm, error, loading }: DeleteAccountModalProps) {
  const t = useTranslations();
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descId = useId();
  const inputId = useId();
  const errorId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !loading) {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'Tab' && dialogRef.current) {
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setLocalError(t('account.modalPasswordRequired'));
      return;
    }
    setLocalError('');
    await onConfirm(password);
  };

  const shownError = localError || error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6"
      >
        <h2 id={titleId} className="text-lg font-bold text-gray-800 dark:text-white mb-2">
          {t('account.modalTitle')}
        </h2>
        <p id={descId} className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {t('account.modalWarning')}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('account.modalPasswordLabel')}
            </label>
            <input
              id={inputId}
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              aria-invalid={shownError ? true : undefined}
              aria-describedby={shownError ? errorId : undefined}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          {shownError && (
            <p id={errorId} role="alert" className="text-red-600 dark:text-red-400 text-sm">
              {shownError}
            </p>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading ? t('account.modalDeleting') : t('account.modalConfirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ComptePage() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, isLoading: authLoading, logout } = useAuth();
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

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

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
    if (newPassword.length < 8) {
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
      await api.changePassword(token, currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setToast(t('common.passwordChanged'));
    } catch (err: unknown) {
      setPasswordError(
        (err instanceof Error && err.message) || t('profile.changePasswordError'),
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

  const handleDeleteAccount = async (password: string) => {
    if (!token) return;
    setDeleteError('');
    setDeleteLoading(true);
    try {
      await deleteMyAccount(token, password);
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

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">
            {t('common.loading')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-4 min-w-0">
        <nav className="text-sm text-gray-500">
          <Link href="/parametres" className="hover:text-emerald-600">
            {t('settings.title')}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-800 dark:text-white">{t('settings.account')}</span>
        </nav>
      </div>

      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-6 sm:mb-8">
          {t('settings.account')}
        </h1>

        {/* Account info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-6">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t('common.email')}
            </label>
            <p className="text-lg text-gray-800 dark:text-white">
              {user?.email}
            </p>
          </div>

          {/* Member since - optional if API returns it */}
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t('common.memberSince')}
            </label>
            <p className="text-gray-800 dark:text-white">
              {formatDate((user as { createdAt?: string })?.createdAt)}
            </p>
          </div>

          {/* Language selector */}
          <div>
            <label htmlFor="account-locale" className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              {t('common.language')}
            </label>
            <select
              id="account-locale"
              value={selectedLocale}
              onChange={(e) => handleLocaleChange(e.target.value)}
              className="w-full max-w-xs px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="fr">Francais</option>
              <option value="en">English</option>
              <option value="es">Espanol</option>
              <option value="de">Deutsch</option>
              <option value="it">Italiano</option>
              <option value="pt">Portugues</option>
            </select>
          </div>

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Password section — visible only when connected */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              {t('common.password')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {t('profile.passwordNotDisplayed')}{' '}
              <Link href="/forgot-password" className="text-emerald-600 hover:text-emerald-700">
                {t('auth.forgotPassword')}
              </Link>
            </p>

            {!showPasswordForm ? (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('common.changePassword')}
              </button>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('profile.currentPassword')}
                  </label>
                  <input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-white"
                    required
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('profile.newPassword')}
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-white"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('common.confirmPassword')}
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-white"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>

                {passwordError && (
                  <p className="text-red-600 dark:text-red-400 text-sm">{passwordError}</p>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {passwordLoading ? t('common.loading') : t('common.save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setPasswordError('');
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            )}
          </div>

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Mes données (RGPD) */}
          <section aria-labelledby="my-data-title" className="space-y-6">
            <div>
              <h3 id="my-data-title" className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                {t('account.sectionTitle')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('account.sectionIntro')}
              </p>
            </div>

            <div>
              <h4 className="font-medium text-gray-800 dark:text-white mb-1">
                {t('account.exportTitle')}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {t('account.exportDescription')}
              </p>
              <button
                type="button"
                onClick={handleExport}
                disabled={exportLoading || !token}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {exportLoading ? t('account.exportLoading') : t('account.exportButton')}
              </button>
              {exportError && (
                <p role="alert" className="text-red-600 dark:text-red-400 text-sm mt-2">
                  {exportError}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-red-200 dark:border-red-900/50 p-4">
              <h4 className="font-medium text-red-700 dark:text-red-400 mb-1">
                {t('account.deleteTitle')}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('account.deleteDescription')}
              </p>
              <button
                type="button"
                onClick={() => {
                  setDeleteError('');
                  setShowDeleteModal(true);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                {t('account.deleteButton')}
              </button>
            </div>
          </section>

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Logout */}
          <div>
            <button
              onClick={logout}
              className="px-6 py-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors font-medium"
            >
              {t('common.logout')}
            </button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteAccountModal
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteAccount}
          error={deleteError}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
