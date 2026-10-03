import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

type CardElement = 'div' | 'section' | 'article' | 'li' | 'aside';
type HeadingLevel = 2 | 3 | 4;

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Élément rendu (défaut `div`). `section` + `title` + `titleId` forment une région nommée. */
  as?: CardElement;
  /** Titre de la carte, en Fraunces (niveau `headingLevel`, défaut 2). */
  title?: ReactNode;
  headingLevel?: HeadingLevel;
  /** Identifiant du titre ; relie la carte à son titre (`aria-labelledby`). */
  titleId?: string;
  /** Actions alignées sur le titre (un `Button` `quiet` ou `secondary`, rarement plus). */
  actions?: ReactNode;
  /** Marge intérieure : `none` pour une liste bord à bord, `md` par défaut (24 px, 16 en mobile). */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** `surface` (défaut) ; `sunken` pour un encart secondaire ; `outline` sans fond. */
  tone?: 'surface' | 'sunken' | 'outline';
  /** Carte cliquable (lien englobant) : la bordure se renforce au survol. */
  interactive?: boolean;
  children?: ReactNode;
}

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-4 sm:p-6',
  lg: 'p-6 sm:p-8',
} as const;

const TONE = {
  surface: 'bg-surface border-line',
  sunken: 'bg-sunken border-transparent',
  outline: 'bg-transparent border-line-strong',
} as const;

/**
 * Carte du carnet : surface, filet fin, rayon 10 px, aucune ombre.
 * Remplace les anciennes cartes « fond blanc, grand rayon, ombre portée » des pages historiques.
 *
 * @example
 * <Card as="section" title="Traitements" titleId="traitements" actions={<Button variant="quiet" size="sm">Ajouter</Button>}>
 *   …
 * </Card>
 */
export default function Card({
  as: Element = 'div',
  title,
  headingLevel = 2,
  titleId,
  actions,
  padding = 'md',
  tone = 'surface',
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  const Heading = `h${headingLevel}` as const;
  const labelled = title && titleId ? { 'aria-labelledby': titleId } : {};

  return (
    <Element
      className={cx(
        'min-w-0 rounded-card border text-ink',
        TONE[tone],
        PADDING[padding],
        interactive && 'transition-colors duration-150 hover:border-line-field focus-within:border-line-field',
        className,
      )}
      {...labelled}
      {...props}
    >
      {title || actions ? (
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-line pb-3">
          {title ? (
            <Heading id={titleId} className="m-0 font-display text-h4 font-semibold text-ink">
              {title}
            </Heading>
          ) : null}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </Element>
  );
}

export { Card };
