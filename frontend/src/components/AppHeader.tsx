'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LanguageSelector } from '@/components/LanguageSelector';
import { ArrowRight, Home, Leaf, LogIn, LogOut, Menu, PawPrint, Settings2, ShoppingBag, X } from 'lucide-react';
import Link from 'next/link';

export function AppHeader() {
  const t = useTranslations();
  const pathname = usePathname();
  const { user, isLoading: authLoading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);
  const isHome = pathname === '/' || /^\/[a-z]{2}\/?$/.test(pathname ?? '');
  const userInitials = user?.email?.slice(0, 2).toUpperCase() || 'C';

  const navLinkClass = (active: boolean) => `captivia-nav-link${active ? ' is-active' : ''}`;
  const mobileLinkClass = (active: boolean) => `captivia-mobile-link${active ? ' is-active' : ''}`;

  return (
    <header className="captivia-header">
      <div className="captivia-header-inner">
        <Link href="/" className="captivia-brand" onClick={closeMobileMenu}>
          <span className="captivia-brand-mark" aria-hidden="true">
            <Leaf size={19} strokeWidth={2.4} />
          </span>
          <span>{t('common.appName')}</span>
        </Link>

        <nav className="captivia-desktop-nav" aria-label="Navigation principale">
          <Link
            href="/"
            className={navLinkClass(isHome)}
            aria-current={isHome ? 'page' : undefined}
          >
            <Home size={16} strokeWidth={2.2} aria-hidden="true" />
            <span>{t('common.home')}</span>
          </Link>
          <Link
            href="/magasin"
            className={navLinkClass(pathname?.includes('/magasin') ?? false)}
            aria-current={pathname?.includes('/magasin') ? 'page' : undefined}
          >
            <ShoppingBag size={16} strokeWidth={2.2} aria-hidden="true" />
            <span>{t('common.shop')}</span>
          </Link>
          {user && (
            <>
              <Link
                href="/mes-animaux"
                className={navLinkClass(pathname?.includes('/mes-animaux') ?? false)}
                aria-current={pathname?.includes('/mes-animaux') ? 'page' : undefined}
              >
                <PawPrint size={16} strokeWidth={2.2} aria-hidden="true" />
                <span>{t('common.myAnimals')}</span>
              </Link>
              <Link
                href="/parametres"
                className={navLinkClass(pathname?.includes('/parametres') ?? false)}
                aria-current={pathname?.includes('/parametres') ? 'page' : undefined}
              >
                <Settings2 size={16} strokeWidth={2.2} aria-hidden="true" />
                <span>{t('common.settings')}</span>
              </Link>
            </>
          )}
          <Link
            href="/transparency"
            className={navLinkClass(pathname?.includes('/transparency') ?? false)}
            aria-current={pathname?.includes('/transparency') ? 'page' : undefined}
          >
            <span>{t('footer.transparency')}</span>
          </Link>
        </nav>

        <div className="captivia-header-actions">
          <LanguageSelector />
          {!authLoading &&
            (user ? (
              <div className="captivia-authenticated-actions">
                <Link href="/parametres" className="captivia-user-chip" title={user.email}>
                  <span className="captivia-user-avatar" aria-hidden="true">{userInitials}</span>
                  <span className="captivia-user-email">{user.email}</span>
                </Link>
                <button type="button" onClick={logout} className="captivia-logout-button">
                  <LogOut size={16} strokeWidth={2.2} aria-hidden="true" />
                  <span>{t('common.logout')}</span>
                </button>
              </div>
            ) : (
              <div className="captivia-guest-actions">
                <Link href="/login" className="captivia-login-link">
                  <LogIn size={16} strokeWidth={2.2} aria-hidden="true" />
                  <span>{t('common.login')}</span>
                </Link>
                <Link href="/register" className="captivia-register-button">
                  <span>{t('common.register')}</span>
                  <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
                </Link>
              </div>
            ))}
        </div>

        <div className="captivia-mobile-actions">
          <LanguageSelector />
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="captivia-menu-button"
            aria-label="Menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="captivia-mobile-navigation"
          >
            {mobileMenuOpen ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div id="captivia-mobile-navigation" className="captivia-mobile-menu" role="dialog" aria-label="Navigation">
          <nav className="captivia-mobile-nav" aria-label="Navigation mobile">
            <Link href="/" className={mobileLinkClass(isHome)} onClick={closeMobileMenu}>
              <Home size={17} aria-hidden="true" />
              <span>{t('common.home')}</span>
            </Link>
            <Link
              href="/magasin"
              className={mobileLinkClass(pathname?.includes('/magasin') ?? false)}
              onClick={closeMobileMenu}
            >
              <ShoppingBag size={17} aria-hidden="true" />
              <span>{t('common.shop')}</span>
            </Link>
            {user && (
              <>
                <Link
                  href="/mes-animaux"
                  className={mobileLinkClass(pathname?.includes('/mes-animaux') ?? false)}
                  onClick={closeMobileMenu}
                >
                  <PawPrint size={17} aria-hidden="true" />
                  <span>{t('common.myAnimals')}</span>
                </Link>
                <Link
                  href="/parametres"
                  className={mobileLinkClass(pathname?.includes('/parametres') ?? false)}
                  onClick={closeMobileMenu}
                >
                  <Settings2 size={17} aria-hidden="true" />
                  <span>{t('common.settings')}</span>
                </Link>
              </>
            )}
            <Link
              href="/transparency"
              className={mobileLinkClass(pathname?.includes('/transparency') ?? false)}
              onClick={closeMobileMenu}
            >
              <span>{t('footer.transparency')}</span>
            </Link>

            <div className="captivia-mobile-auth">
              {!authLoading &&
                (user ? (
                  <>
                    <Link href="/parametres" className="captivia-mobile-user" onClick={closeMobileMenu}>
                      <span className="captivia-user-avatar" aria-hidden="true">{userInitials}</span>
                      <span className="truncate">{user.email}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        closeMobileMenu();
                      }}
                      className="captivia-mobile-logout"
                    >
                      <LogOut size={17} aria-hidden="true" />
                      <span>{t('common.logout')}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="captivia-mobile-login" onClick={closeMobileMenu}>
                      <LogIn size={17} aria-hidden="true" />
                      <span>{t('common.login')}</span>
                    </Link>
                    <Link href="/register" className="captivia-mobile-register" onClick={closeMobileMenu}>
                      <span>{t('common.register')}</span>
                      <ArrowRight size={17} aria-hidden="true" />
                    </Link>
                  </>
                ))}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
