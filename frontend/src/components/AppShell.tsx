'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, CalendarDays, CircleUserRound, LogOut, MessagesSquare, PawPrint, type LucideIcon } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { BrandMark } from '@/components/ui/BrandMark';
import { GUEST_UPGRADE_PATH } from '@/lib/guest';

export interface AppDestination {
  href: string;
  /** Clé de traduction du libellé (onglet mobile et rail). */
  labelKey: string;
  icon: LucideIcon;
  /** Préfixes de chemin qui rendent la destination active. */
  match: string[];
  /** Destination annoncée mais pas encore ouverte : affichée « bientôt », sans lien (pas de lien mort). */
  soon?: boolean;
}

/**
 * Destinations de l'app : 5 au maximum (barre d'onglets mobile). L'animal est le centre :
 * « Mes animaux » ouvre le tableau de bord du jour. L'abonnement et les notifications vivent
 * sous « Compte » (/parametres/*), la recherche sous « Espèces ». « Communauté » est réservée
 * (volet à venir, cf. docs/PRODUCT.md) : il suffira de retirer `soon` et de donner sa route.
 */
export const APP_DESTINATIONS: AppDestination[] = [
  { href: '/mes-animaux', labelKey: 'common.myAnimals', icon: PawPrint, match: ['/mes-animaux'] },
  { href: '/agenda', labelKey: 'nav.agenda', icon: CalendarDays, match: ['/agenda'] },
  // Recherche d'espèces de l'app ; l'onglet reste actif sur les fiches (/species/<id>).
  { href: '/especes', labelKey: 'nav.species', icon: BookOpen, match: ['/especes', '/species'] },
  { href: '/communaute', labelKey: 'nav.community', icon: MessagesSquare, match: ['/communaute'], soon: true },
  { href: '/parametres', labelKey: 'nav.account', icon: CircleUserRound, match: ['/parametres'] },
];

const isActive = (path: string, prefixes: string[]) =>
  prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

export interface AppShellProps {
  children: ReactNode;
  /** Destinations (défaut : `APP_DESTINATIONS`). 5 au maximum. */
  destinations?: AppDestination[];
}

/**
 * Coquille de l'application (mes animaux, agenda, espèces, paramètres, abonnement) — distincte
 * de l'en-tête marketing (`MarketingHeader`, landing et pages légales).
 *  - mobile (< 1024 px) : barre haute minimale + barre d'onglets en bas (safe areas, 56 px) ;
 *  - bureau (≥ 1024 px) : rail latéral de 240 px (marque, destinations, compte) + contenu.
 * Le bas du rail (et la barre haute en mobile) porte le profil, ou, en mode invité,
 * « Invité · Créer un compte » : l'app reste utilisable sans compte.
 * La coquille rend `<main id="main-content">` : le layout du groupe `(app)` ne doit pas en ajouter.
 */
export function AppShell({ children, destinations = APP_DESTINATIONS }: AppShellProps) {
  const t = useTranslations();
  const pathname = usePathname() ?? '/';
  const { user, isLoading, logout } = useAuth();
  const items = destinations.slice(0, 5);
  const initials = user?.email?.slice(0, 2).toUpperCase() || '··';
  // Session invité (sans e-mail) : même emplacement que sans session, mais l'invitation mène à la
  // conversion sans perte de données, et aucune déconnexion n'est proposée (elle les perdrait).
  const guestSession = user?.isGuest === true;
  const createAccountHref = guestSession ? GUEST_UPGRADE_PATH : '/register';

  const account = isLoading ? null : user && !guestSession ? (
    <div className="app-shell__account" data-state="user">
      <Link href="/parametres" className="app-shell__profile" title={user.email ?? undefined}>
        <span className="site-account__initials" aria-hidden="true">
          {initials}
        </span>
        <span className="app-shell__profile-email">{user.email}</span>
      </Link>
      <button type="button" onClick={logout} className="app-shell__logout" aria-label={t('common.logout')}>
        <LogOut size={18} aria-hidden="true" />
      </button>
    </div>
  ) : (
    <div className="app-shell__account" data-state="guest">
      <p className="app-shell__guest">
        <span className="app-shell__guest-label">{t('nav.guest')}</span>
        <Link href={createAccountHref} className="app-shell__guest-cta">
          {t('nav.createAccount')}
        </Link>
      </p>
    </div>
  );

  // Destination « bientôt » : pas de lien (aucun lien mort), marquée désactivée et annoncée.
  const renderItem = ({ href, labelKey, icon: Icon, match, soon }: AppDestination, className: string, size: number) => {
    const content = (
      <>
        <Icon size={size} strokeWidth={1.75} aria-hidden="true" />
        <span>{t(labelKey)}</span>
        {soon ? <span className="app-shell__soon">{t('nav.soon')}</span> : null}
      </>
    );
    if (soon) {
      return (
        <span className={className} aria-disabled="true" data-soon="">
          {content}
        </span>
      );
    }
    return (
      <Link href={href} className={className} aria-current={isActive(pathname, match) ? 'page' : undefined}>
        {content}
      </Link>
    );
  };

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        {t('home.skipToContent')}
      </a>

      {/* Rail (bureau) */}
      <div className="app-shell__rail noprint">
        <Link href="/" className="site-brand app-shell__brand">
          <BrandMark className="site-brand__mark" />
          <span className="site-brand__name">{t('common.appName')}</span>
        </Link>
        <nav aria-label={t('home.mainNavigation')}>
          <ul className="app-shell__rail-list">
            {items.map((item) => (
              <li key={item.href}>{renderItem(item, 'app-shell__rail-link', 18)}</li>
            ))}
          </ul>
        </nav>
        <div className="app-shell__rail-foot">{account}</div>
      </div>

      {/* Barre haute (mobile) */}
      <header className="app-shell__topbar noprint">
        <Link href="/" className="site-brand">
          <BrandMark className="site-brand__mark" />
          <span className="site-brand__name">{t('common.appName')}</span>
        </Link>
        {!isLoading && (!user || guestSession) ? (
          <Link href={createAccountHref} className="app-shell__guest-cta">
            {t('nav.createAccount')}
          </Link>
        ) : null}
      </header>

      <main id="main-content" tabIndex={-1} className="app-shell__content">
        {children}
      </main>

      {/* Barre d'onglets (mobile) */}
      <nav className="app-shell__tabbar noprint" aria-label={t('home.mobileNavigation')}>
        <ul className="app-shell__tabs">
          {items.map((item) => (
            <li key={item.href}>{renderItem(item, 'app-shell__tab', 22)}</li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export default AppShell;
