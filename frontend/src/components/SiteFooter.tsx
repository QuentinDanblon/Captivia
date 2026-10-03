import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { LEGAL, LEGAL_ROUTES, contactMailto } from '@/lib/legal';
import { BrandMark } from '@/components/ui/BrandMark';

/**
 * Pied de page global : colophon du carnet — marque et une ligne de
 * description, liens légaux en colonnes et copyright en mono. Aucune mention d'affiliation : aucun lien
 * affilié n'est affiché (elle accompagne les liens eux-mêmes, cf. magasin).
 *
 * Sans `'use client'` ni `async` : rendu côté serveur dans le layout `(marketing)`, mais aussi
 * importable depuis `error.tsx` (composant client), d'où `useTranslations` plutôt que `getTranslations`.
 */
export function SiteFooter() {
  const t = useTranslations('footer');
  const tc = useTranslations('common');
  const mailto = contactMailto();

  const links: { label: string; path: string }[] = [
    { label: t('legalNotice'), path: LEGAL_ROUTES.legalNotice },
    { label: t('privacy'), path: LEGAL_ROUTES.privacy },
    { label: t('terms'), path: LEGAL_ROUTES.terms },
    { label: t('sources'), path: LEGAL_ROUTES.sources },
    { label: t('transparency'), path: LEGAL_ROUTES.transparency },
    { label: t('accountDeletion'), path: LEGAL_ROUTES.accountDeletion },
  ];

  return (
    <footer className="site-footer noprint">
      <div className="cv-container">
        <div className="site-footer__top">
          <div className="site-footer__brand">
            {/* Le Link next-intl ajoute lui-même le préfixe de locale. */}
            <Link href="/" className="site-brand">
              <BrandMark className="site-brand__mark" />
              <span className="site-brand__name">{tc('appName')}</span>
            </Link>
            <p className="site-footer__description">{t('description')}</p>
          </div>

          <nav aria-labelledby="site-footer-legal">
            <h2 id="site-footer-legal" className="site-footer__heading">
              {t('navLabel')}
            </h2>
            <ul className="site-footer__links">
              {links.map((link) => (
                <li key={link.path}>
                  <Link href={link.path}>{link.label}</Link>
                </li>
              ))}
              <li>
                {mailto ? (
                  <a href={mailto}>{t('contact')}</a>
                ) : (
                  <Link href={LEGAL_ROUTES.legalNotice}>{t('contact')}</Link>
                )}
              </li>
            </ul>
          </nav>
        </div>

        <div className="site-footer__colophon">
          <p className="site-footer__legal">
            © {new Date().getFullYear()} {LEGAL.serviceName} · {t('tagline')}
          </p>
        </div>
      </div>
    </footer>
  );
}

/** Pied de page de la couche marketing (landing, pages légales, 404, erreurs). L'app n'en a pas. */
export { SiteFooter as MarketingFooter };
