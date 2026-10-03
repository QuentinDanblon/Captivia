import type { ElementType, ReactNode } from 'react';
import Figure, { type FigureSource, type PhotoCredit } from './Figure';
import MediaCard from './MediaCard';
import type { SilhouetteKind } from './AnimalSilhouette';

export interface AnimalFact {
  /** « Dernière pesée » */
  label: string;
  /** « 2 340 g · il y a 12 jours » (rendu en mono) */
  value: ReactNode;
}

export interface AnimalCardProps {
  name: string;
  /** Binôme latin de l'espèce. */
  latin?: string;
  /** Photo de l'animal (crédit requis s'il ne s'agit pas d'une photo de l'utilisateur). */
  photo?: {
    src: string;
    alt: string;
    credit: PhotoCredit;
    /** Variantes responsives et placement du crédit, transmis à `Figure`. */
    srcSet?: string;
    sources?: FigureSource[];
    sizes?: string;
    creditPlacement?: 'caption' | 'overlay' | 'external';
  };
  /** Silhouette de repli (classe animale). */
  kind?: SilhouetteKind;
  /** Pastilles d'état (`TaskPill`, `Badge`, `PremiumBadge`). */
  status?: ReactNode;
  /** Deux ou trois faits datés et chiffrés. */
  facts?: AnimalFact[];
  /** Actions rapides en pied (« Ajouter une pesée »). */
  actions?: ReactNode;
  href?: string;
  linkAs?: ElementType;
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

/**
 * Carte d'animal du tableau de bord « aujourd'hui » : photo (ou silhouette), nom en Fraunces,
 * espèce en latin, pastilles d'état, faits chiffrés en mono. L'animal est le centre de l'app.
 *
 * @example
 * <AnimalCard
 *   name="Kaa" latin="Boa constrictor" kind="reptile" href="/mes-animaux/kaa" linkAs={Link}
 *   status={<TaskPill count={2} label="soins aujourd'hui" />}
 *   facts={[{ label: 'Dernière pesée', value: '2 340 g · il y a 12 j' }, { label: 'Prochain RDV', value: '07 oct. · 14:00' }]}
 * />
 */
export default function AnimalCard({
  name,
  latin,
  photo,
  kind = 'other',
  status,
  facts,
  actions,
  href,
  linkAs,
  headingLevel = 3,
  className,
}: AnimalCardProps) {
  const media = photo ? (
    <Figure
      src={photo.src}
      alt={photo.alt}
      credit={photo.credit}
      srcSet={photo.srcSet}
      sources={photo.sources}
      sizes={photo.sizes}
      creditPlacement={photo.creditPlacement}
      ratio="4/3"
      fallbackKind={kind}
    />
  ) : (
    <Figure ratio="4/3" fallbackKind={kind} />
  );

  return (
    <MediaCard
      media={media}
      title={name}
      headingLevel={headingLevel}
      subtitle={
        latin ? (
          <i lang="la" className="latin">
            {latin}
          </i>
        ) : undefined
      }
      href={href}
      linkAs={linkAs}
      footer={actions}
      className={className}
    >
      {status ? <div className="flex flex-wrap gap-1.5">{status}</div> : null}
      {facts && facts.length > 0 ? (
        <dl className="m-0 mt-3 grid gap-1.5">
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-baseline justify-between gap-3 border-b border-dotted border-line pb-1.5 last:border-0">
              <dt className="text-ink-2">{fact.label}</dt>
              <dd className="m-0 text-right font-mono text-meta text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </MediaCard>
  );
}

export { AnimalCard };
