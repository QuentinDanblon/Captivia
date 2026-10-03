'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CircleUserRound, Menu, X } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LanguageSelector } from '@/components/LanguageSelector';
import { BrandMark } from '@/components/ui/BrandMark';
import { GUEST_UPGRADE_PATH } from '@/lib/guest';

type NavItem = {
  href: string;
  label: string;
  /** Rubrique active : la page courante appartient à cette entrée. */
  isActive: (path: string) => boolean;
};

const startsWithSegment = (path: string, segment: string) =>
  path === segment || path.startsWith(`${segment}/`);

/**
 * En-tête du site (« carnet de terrain ») : papier plein, filet fin, page active soulignée
 * sur le filet. Trois états selon la largeur — mesurés de 320 à 1920 px dans les 6 langues :
 *  - < 640 px : marque · langue · menu ;
 *  - 640 px → seuil : + actions de compte (initiales, ou Connexion / S'inscrire) ;
 *  - ≥ seuil (invité 1024 px, connecté 1200 px) : navigation complète, sans menu.
 * Un seul sélecteur de langue est rendu, quelle que soit la largeur.
 */
export function AppHeader() {
  const t = useTranslations();
  const pathname = usePathname() ?? '/';
  const { user, isLoading: authLoading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => setMenuOpen(false);

  // Menu en feuille modale : focus sur la première entrée, Échap ferme (focus rendu au bouton),
  // Tab confiné au menu et à son bouton, défilement de la page bloqué.
  useEffect(() => {
    if (!menuOpen) return;
    const menu = menuRef.current;
    const focusables = () =>
      Array.from(menu?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select') ?? []);
    focusables()[0]?.focus();

    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      const button = menuButtonRef.current;
      if (items.length === 0 || !button) return;
      const cycle = [button, ...items];
      const index = cycle.indexOf(document.activeElement as HTMLElement);
      if (index === -1) {
        event.preventDefault();
        items[0].focus();
      } else if (!event.shiftKey && index === cycle.length - 1) {
        event.preventDefault();
        cycle[0].focus();
      } else if (event.shiftKey && index === 0) {
        event.preventDefault();
        cycle[cycle.length - 1].focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      root.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const items: NavItem[] = [
    {
      href: '/especes',
      label: t('nav.species'),
      isActive: (p) => startsWithSegment(p, '/especes') || startsWithSegment(p, '/species'),
    },
    { href: '/magasin', label: t('common.shop'), isActive: (p) => startsWithSegment(p, '/magasin') },
    ...(user
      ? [
          {
            href: '/mes-animaux',
            label: t('common.myAnimals'),
            isActive: (p: string) => startsWithSegment(p, '/mes-animaux'),
          },
          { href: '/agenda', label: t('nav.agenda'), isActive: (p: string) => startsWithSegment(p, '/agenda') },
        ]
      : []),
    {
      href: '/transparency',
      label: t('nav.transparency'),
      isActive: (p) => startsWithSegment(p, '/transparency'),
    },
  ];

  const settingsActive = startsWithSegment(pathname, '/parametres');
  // Invité (sans e-mail) : pictogramme de profil au trait plutôt que des initiales factices.
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : <CircleUserRound className="size-4" strokeWidth={1.5} />;
  const authState = user ? 'user' : 'guest';
  // Session invité : pas de déconnexion (elle ferait perdre l'accès aux données), mais l'invitation
  // à créer un compte, qui conserve l'animal et son carnet.
  const guestSession = user?.isGuest === true;

  return (
    <>
      <a href="#main-content" className="skip-link">
        {t('home.skipToContent')}
      </a>
      <header className="site-header noprint" data-auth={authState}>
        <div className="cv-container site-header__bar">
          <Link href="/" className="site-brand" onClick={closeMenu}>
            <BrandMark className="site-brand__mark" />
            <span className="site-brand__name">{t('common.appName')}</span>
          </Link>

          <nav className="site-nav" aria-label={t('home.mainNavigation')}>
            <ul className="site-nav__list">
              {items.map((item) => {
                const active = item.isActive(pathname);
                return (
                  <li key={item.href}>
                    <Link href={item.href} className="site-nav__link" aria-current={active ? 'page' : undefined}>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="site-header__tools">
            <LanguageSelector />
            {!authLoading &&
              (user ? (
                <>
                  <Link
                    href="/parametres"
                    className="site-account site-header__auth"
                    title={user.email ?? t('nav.guest')}
                    aria-current={settingsActive ? 'page' : undefined}
                  >
                    <span className="site-account__initials" aria-hidden="true">
                      {initials}
                    </span>
                    <span className="site-account__label">{t('common.settings')}</span>
                  </Link>
                  {guestSession ? (
                    <Link href={GUEST_UPGRADE_PATH} className="site-header__cta site-header__nav-only">
                      {t('nav.createAccount')}
                    </Link>
                  ) : (
                    <button type="button" onClick={logout} className="site-header__quiet site-header__nav-only">
                      {t('common.logout')}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <Link href="/login" className="site-header__quiet site-header__auth">
                    {t('common.login')}
                  </Link>
                  <Link href="/register" className="site-header__cta site-header__auth">
                    {t('common.register')}
                  </Link>
                </>
              ))}
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="site-menu-button"
              aria-label={menuOpen ? t('home.closeMenu') : t('home.openMenu')}
              aria-expanded={menuOpen}
              aria-controls="site-menu"
            >
              {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div
            id="site-menu"
            ref={menuRef}
            className="site-menu"
            role="dialog"
            aria-modal="true"
            aria-label={t('home.mobileNavigation')}
          >
            <nav className="cv-container" aria-label={t('home.mobileNavigation')}>
              <ul className="site-menu__list">
                {items.map((item) => {
                  const active = item.isActive(pathname);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="site-menu__link"
                        aria-current={active ? 'page' : undefined}
                        onClick={closeMenu}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
                {user && (
                  <li>
                    <Link
                      href="/parametres"
                      className="site-menu__link"
                      aria-current={settingsActive ? 'page' : undefined}
                      onClick={closeMenu}
                    >
                      {t('common.settings')}
                    </Link>
                  </li>
                )}
              </ul>

              {!authLoading && (
                <div className="site-menu__account">
                  {guestSession ? (
                    <>
                      <p className="site-menu__email m-0">{t('nav.guest')}</p>
                      <Link href={GUEST_UPGRADE_PATH} className="site-header__cta" onClick={closeMenu}>
                        {t('nav.createAccount')}
                      </Link>
                    </>
                  ) : user ? (
                    <>
                      <p className="site-menu__email m-0">{user.email}</p>
                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          closeMenu();
                        }}
                        className="site-header__quiet"
                      >
                        {t('common.logout')}
                      </button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" className="site-header__quiet" onClick={closeMenu}>
                        {t('common.login')}
                      </Link>
                      <Link href="/register" className="site-header__cta" onClick={closeMenu}>
                        {t('common.register')}
                      </Link>
                    </>
                  )}
                </div>
              )}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}

/** En-tête de la couche marketing (landing, pages légales). L'app utilise `AppShell`. */
export { AppHeader as MarketingHeader };
