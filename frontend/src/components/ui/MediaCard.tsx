import type { ReactNode } from 'react';
import { cx } from './cx';

export interface MediaCardProps {
  /** Média en tête de carte, bord à bord (`<Figure>` ou silhouette). */
  media?: ReactNode;
  /** Ligne d'en-tête : auteur (publication) ou statut (animal). */
  header?: ReactNode;
  /** Titre (Fraunces). */
  title: ReactNode;
  headingLevel?: 2 | 3 | 4;
  /** Sous-titre : binôme latin, date… */
  subtitle?: ReactNode;
  /** Corps libre : mesures, extrait de texte. */
  children?: ReactNode;
  /** Pied séparé par un filet : actions, réactions, compteurs. */
  footer?: ReactNode;
  /**
   * Lien principal : le titre devient un lien et toute la carte est cliquable (pseudo-élément),
   * sans imbriquer de liens ; les actions du pied restent cliquables au-dessus.
   */
  href?: string;
  /** Composant de lien (ex. `Link` de next-intl). Défaut : `<a>`. */
  linkAs?: React.ElementType;
  as?: 'article' | 'li' | 'div';
  className?: string;
}

/**
 * Carte à média : base commune de la carte d'animal (tableau de bord) et, demain, des
 * publications de la communauté (photo, auteur, réactions, commentaires). Surface, filet,
 * rayon 10, média bord à bord en haut, pied séparé par un filet.
 */
export default function MediaCard({
  media,
  header,
  title,
  headingLevel = 3,
  subtitle,
  children,
  footer,
  href,
  linkAs: LinkComponent = 'a',
  as: Element = 'article',
  className,
}: MediaCardProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <Element
      className={cx(
        'relative flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface text-ink',
        href && 'transition-colors duration-150 hover:border-line-field focus-within:border-line-field',
        className,
      )}
    >
      {media ? <div className="[&_.cv-photo]:rounded-none [&_figure]:gap-0">{media}</div> : null}
      <div className="grid gap-1 p-4">
        {header ? <div className="text-meta text-ink-2">{header}</div> : null}
        <Heading className="m-0 font-display text-h4 font-semibold">
          {href ? (
            <LinkComponent href={href} className="text-ink no-underline after:absolute after:inset-0 after:content-['']">
              {title}
            </LinkComponent>
          ) : (
            title
          )}
        </Heading>
        {subtitle ? <p className="m-0 text-ui text-ink-2">{subtitle}</p> : null}
        {children ? <div className="mt-2 text-ui">{children}</div> : null}
      </div>
      {footer ? (
        <div className="relative z-10 mt-auto flex flex-wrap items-center gap-2 border-t border-line px-4 py-2">{footer}</div>
      ) : null}
    </Element>
  );
}

export { MediaCard };
