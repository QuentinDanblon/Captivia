'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

// Adresse de contact provisoire (même valeur que la page transparence) :
// à remplacer par le vrai contact lors de la finalisation des pages légales (W2-02).
const CONTACT_EMAIL = 'contact@captivia.com';

/**
 * Page publique (sans authentification) expliquant comment supprimer son compte.
 * Exigée par Google Play (URL de suppression de compte dans la fiche Data safety).
 */
export default function SuppressionComptePage() {
  const t = useTranslations('account');
  const subject = t('emailSubject');
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 min-w-0">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 dark:text-white mb-4">
          {t('publicTitle')}
        </h1>
        <p className="text-gray-700 dark:text-gray-300 mb-6 sm:mb-8 leading-relaxed">
          {t('publicIntro')}
        </p>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-8 space-y-8 break-words">
          <section aria-labelledby="delete-in-app">
            <h2
              id="delete-in-app"
              className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-3"
            >
              {t('inAppTitle')}
            </h2>
            <ol className="list-decimal pl-6 space-y-1 text-gray-700 dark:text-gray-300">
              <li>{t('inAppStep1')}</li>
              <li>{t('inAppStep2')}</li>
              <li>{t('inAppStep3')}</li>
              <li>{t('inAppStep4')}</li>
            </ol>
            <Link
              href="/parametres/compte"
              className="inline-block mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              {t('sectionTitle')}
            </Link>
          </section>

          <section aria-labelledby="delete-by-email">
            <h2
              id="delete-by-email"
              className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-3"
            >
              {t('emailTitle')}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {t('emailBody', { email: CONTACT_EMAIL, subject })}
            </p>
            <a
              href={mailto}
              className="inline-block mt-4 text-emerald-600 dark:text-emerald-400 underline hover:text-emerald-700"
            >
              {CONTACT_EMAIL}
            </a>
          </section>

          <section aria-labelledby="delete-what">
            <h2
              id="delete-what"
              className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-3"
            >
              {t('whatTitle')}
            </h2>
            <ul className="list-disc pl-6 space-y-1 text-gray-700 dark:text-gray-300">
              <li>{t('whatItem1')}</li>
              <li>{t('whatItem2')}</li>
              <li>{t('whatItem3')}</li>
              <li>{t('whatItem4')}</li>
            </ul>
          </section>

          <section aria-labelledby="delete-backups">
            <h2
              id="delete-backups"
              className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-3"
            >
              {t('backupTitle')}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {t('backupBody')}
            </p>
          </section>

          <section aria-labelledby="delete-export">
            <h2
              id="delete-export"
              className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-3"
            >
              {t('exportInfoTitle')}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {t('exportInfoBody')}
            </p>
          </section>
        </div>

        <div className="mt-8">
          <Link href="/" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700">
            &larr; {t('backHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}
