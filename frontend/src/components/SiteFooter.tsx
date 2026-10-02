import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { LEGAL, LEGAL_ROUTES, contactMailto } from '@/lib/legal';

/** Pied de page global (Server Component) : liens légaux et mention d'affiliation Amazon. */
export async function SiteFooter() {
  const t = await getTranslations('footer');
  // Le Link next-intl ajoute lui-même le préfixe de locale.
  const href = (path: string) => path;
  const mailto = contactMailto();

  const links: { label: string; path: string }[] = [
    { label: t('legalNotice'), path: LEGAL_ROUTES.legalNotice },
    { label: t('privacy'), path: LEGAL_ROUTES.privacy },
    { label: t('terms'), path: LEGAL_ROUTES.terms },
    { label: t('sources'), path: LEGAL_ROUTES.sources },
    { label: t('transparency'), path: LEGAL_ROUTES.transparency },
    { label: t('accountDeletion'), path: LEGAL_ROUTES.accountDeletion },
  ];

  const linkClass =
    'rounded text-gray-700 underline-offset-2 hover:text-emerald-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:text-gray-200 dark:hover:text-emerald-300';

  return (
    <footer className="w-full border-t border-gray-200 bg-white text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8 sm:px-6">
        <nav aria-label={t('navLabel')}>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {links.map((link) => (
              <li key={link.path}>
                <Link href={href(link.path)} className={linkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              {mailto ? (
                <a href={mailto} className={linkClass}>
                  {t('contact')}
                </a>
              ) : (
                <Link href={href(LEGAL_ROUTES.legalNotice)} className={linkClass}>
                  {t('contact')}
                </Link>
              )}
            </li>
          </ul>
        </nav>
        <p className="text-gray-600 dark:text-gray-300">{t('amazonAssociate')}</p>
        <p className="text-gray-600 dark:text-gray-300">
          © {new Date().getFullYear()} {LEGAL.serviceName} · {t('tagline')}
        </p>
      </div>
    </footer>
  );
}
