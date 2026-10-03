'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from '@/i18n/navigation';
import { GuestEntry } from '@/components/guest/GuestEntry';
import { GuestSaveBanner } from '@/components/guest/GuestSaveBanner';

export default function ParametresPage() {
  const t = useTranslations();
  const { user, isLoading: authLoading } = useAuth();

  // Sans session : « Essayer sans compte » ou connexion (plus de redirection vers /login).
  if (!authLoading && !user) return <GuestEntry />;

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
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-6 sm:mb-8">
          {t('settings.title')}
        </h1>

        {/* Invité : l'invitation à créer un compte (sans perte) est le premier réglage. */}
        <GuestSaveBanner dismissible={false} className="mb-6" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Compte card */}
          <Link
            href="/parametres/compte"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900 rounded-lg group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800 transition-colors">
                <svg
                  className="w-8 h-8 text-emerald-600 dark:text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {t('settings.account')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {t('settings.accountDescription')}
                </p>
              </div>
              <svg
                className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>

          {/* Notifications card */}
          <Link
            href="/parametres/notifications"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                <svg
                  className="w-8 h-8 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {t('settings.notifications')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {t('settings.notificationsDescription')}
                </p>
              </div>
              <svg
                className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>

          {/* Abonnement Premium card */}
          <Link
            href="/parametres/abonnement"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900 rounded-lg group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800 transition-colors">
                <svg
                  className="w-8 h-8 text-emerald-600 dark:text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {t('settings.subscription')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {t('settings.subscriptionDescription')}
                </p>
              </div>
              <svg
                className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>

          {/* Grade card */}
          <Link
            href="/parametres/grade"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900 rounded-lg group-hover:bg-amber-200 dark:group-hover:bg-amber-800 transition-colors">
                <svg
                  className="w-8 h-8 text-amber-600 dark:text-amber-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  {t('settings.grade')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {t('settings.gradeDescription')}
                </p>
              </div>
              <svg
                className="w-5 h-5 text-gray-400 group-hover:text-amber-600 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
