import type { ReactNode } from 'react';
import { cx } from './cx';

export interface SectionHeaderProps {
  /** Nom commun ou titre de page (Fraunces). */
  title: ReactNode;
  /** Binôme latin, en italique (`lang="la"`) : « Boa constrictor ». */
  latin?: ReactNode;
  /** Autorité taxonomique, en romain après le binôme : « Linnaeus, 1758 ». */
  authority?: ReactNode;
  /** Identifiant porté dans la marge, en mono : n° GBIF, n° de puce, « Pl. 03 »… */
  marginNote?: ReactNode;
  /** Ce que désigne `marginNote`, lu par les lecteurs d'écran (« Identifiant GBIF »). */
  marginLabel?: string;
  /** Niveau du titre (défaut 1) : 1 et 2 portent le double filet, 3 un filet simple. */
  level?: 1 | 2 | 3;
  /** Une phrase de contexte sous le filet. */
  description?: ReactNode;
  /** Actions de la section (un bouton principal au plus). */
  actions?: ReactNode;
  /** `id` du titre, pour `aria-labelledby` de la section englobante. */
  id?: string;
  className?: string;
}

const TITLE_SIZE = { 1: 'text-h1', 2: 'text-h2', 3: 'text-h3' } as const;

/**
 * Signature n° 1 — en-tête « planche naturaliste » : titre en Fraunces, binôme latin en
 * italique, double filet à l'encre, identifiant en mono dans la marge (au-dessus du titre en
 * mobile). Pour les en-têtes de page et de grande section ; pas pour une carte.
 *
 * @example
 * <SectionHeader
 *   title="Boa constricteur"
 *   latin="Boa constrictor"
 *   authority="Linnaeus, 1758"
 *   marginNote="GBIF 2435099"
 *   marginLabel="Identifiant GBIF"
 *   actions={<Button>Ajouter à mes animaux</Button>}
 * />
 */
export default function SectionHeader({
  title,
  latin,
  authority,
  marginNote,
  marginLabel,
  level = 1,
  description,
  actions,
  id,
  className,
}: SectionHeaderProps) {
  const Heading = `h${level}` as const;
  const hasMargin = marginNote !== undefined && marginNote !== null && marginNote !== '';

  return (
    <header
      className={cx(
        'grid gap-x-6',
        hasMargin ? 'md:grid-cols-[7.5rem_minmax(0,1fr)]' : 'grid-cols-1',
        className,
      )}
    >
      {hasMargin ? (
        <p className="m-0 mb-2 font-mono text-meta leading-none text-ink-2 md:mb-0 md:self-end md:pb-3 md:text-right">
          {marginLabel ? <span className="sr-only">{marginLabel} : </span> : null}
          {marginNote}
        </p>
      ) : null}

      <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-3">
        <div className="min-w-0">
          <Heading id={id} className={cx('m-0 text-ink', TITLE_SIZE[level])}>
            {title}
          </Heading>
          {latin ? (
            <p className="m-0 mt-1 text-h4 leading-snug text-ink-2">
              <i lang="la" className="latin">
                {latin}
              </i>
              {authority ? <span className="font-sans text-ui not-italic"> {authority}</span> : null}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {/* Double filet (2 px + 1 px) sur toute la largeur, marge comprise. */}
      <div
        aria-hidden="true"
        data-rule={level === 3 ? 'single' : 'double'}
        className={cx('col-span-full', level === 3 ? 'border-t border-ink' : 'h-[5px] border-t-2 border-b border-ink')}
      />

      {description ? (
        <p className={cx('m-0 mt-3 max-w-prose text-body text-ink-2', hasMargin && 'md:col-start-2')}>{description}</p>
      ) : null}
    </header>
  );
}

export { SectionHeader };
