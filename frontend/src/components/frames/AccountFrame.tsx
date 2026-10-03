import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { LanguageSelector } from '@/components/LanguageSelector';
import { BrandMark } from '@/components/ui/BrandMark';
import { LEGAL, LEGAL_ROUTES } from '@/lib/legal';

/**
 * Cadre sobre des écrans de compte (groupe `(auth)`, DESIGN.md § 6.1) : on n'y vient que pour une
 * tâche (se connecter, créer un compte, choisir un mot de passe…), donc ni navigation du site ni
 * boutons « Connexion / S'inscrire » redondants. En-tête : marque, retour à l'accueil (dès 640 px, la
 * marque suffit en dessous) et langue. Pied : trois liens légaux et le copyright, sur une ligne.
 *
 * Sans `'use client'` : rendu côté serveur par `(auth)/layout.tsx`.
 */
export function AccountFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <AccountHeader />
      <EmailVerificationBanner />
      <main id="main-content" tabIndex={-1} className="flex-1 w-full">
        {children}
      </main>
      <AccountFooter />
    </>
  );
}

function AccountHeader() {
  const t = useTranslations();
  return (
    <>
      <a href="#main-content" className="skip-link">
        {t('home.skipToContent')}
      </a>
      <header className="site-header noprint">
        <div className="cv-container site-header__bar">
          <Link href="/" className="site-brand">
            <BrandMark className="site-brand__mark" />
            <span className="site-brand__name">{t('common.appName')}</span>
          </Link>
          <div className="site-header__tools">
            <Link href="/" className="site-header__quiet site-header__auth">
              <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
              {t('errors.backHome')}
            </Link>
            <LanguageSelector />
          </div>
        </div>
      </header>
    </>
  );
}

function AccountFooter() {
  const t = useTranslations('footer');
  const links = [
    { label: t('legalNotice'), path: LEGAL_ROUTES.legalNotice },
    { label: t('privacy'), path: LEGAL_ROUTES.privacy },
    { label: t('terms'), path: LEGAL_ROUTES.terms },
  ];

  return (
    <footer className="noprint border-t border-line-strong bg-paper pb-[env(safe-area-inset-bottom,0px)] text-ui text-ink-2">
      <div className="cv-container flex flex-col gap-x-8 gap-y-2 py-4 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label={t('navLabel')}>
          <ul className="m-0 flex list-none flex-wrap gap-x-6 p-0">
            {links.map((link) => (
              <li key={link.path}>
                <Link
                  href={link.path}
                  className="inline-flex min-h-11 items-center text-ink underline-offset-[0.2em] hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="m-0 font-mono text-meta">
          © {new Date().getFullYear()} {LEGAL.serviceName}
        </p>
      </div>
    </footer>
  );
}

export default AccountFrame;
