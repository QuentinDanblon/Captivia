import type { ReactNode } from 'react';
import { cx } from './cx';

export interface EmptyStateProps {
  /** Ce qui manque, dit simplement (« Aucun traitement en cours »). */
  title: ReactNode;
  /** Ce que l'utilisateur gagne à agir — une phrase, concrète (« Captivia rappelle chaque prise à l'heure prévue. »). */
  benefit: ReactNode;
  /** Une seule action (un `Button` ou un `Link` stylé `buttonClasses()`). */
  action?: ReactNode;
  /** Illustration au trait (silhouette d'animal…), décorative. Jamais d'icône dans un carré pastel. */
  illustration?: ReactNode;
  headingLevel?: 2 | 3 | 4;
  /** `inline` : version compacte dans une carte ; `page` : bloc d'une page vide. */
  size?: 'inline' | 'page';
  className?: string;
}

/**
 * État vide : une page de carnet encore blanche — cadre en pointillés, un constat, un bénéfice,
 * une action. Pas de pictogramme générique, pas de deuxième bouton.
 *
 * @example
 * <EmptyState
 *   title="Aucune pesée enregistrée"
 *   benefit="Une pesée par mois suffit à repérer une perte de poids avant les premiers symptômes."
 *   action={<Button size="sm" onClick={openForm}>Ajouter une pesée</Button>}
 * />
 */
export default function EmptyState({
  title,
  benefit,
  action,
  illustration,
  headingLevel = 3,
  size = 'inline',
  className,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div
      className={cx(
        'grid items-start gap-x-6 gap-y-3 rounded-card border border-dashed border-line-strong text-left',
        size === 'page' ? 'px-6 py-10 sm:px-10' : 'px-5 py-6',
        illustration ? 'sm:grid-cols-[auto_minmax(0,1fr)]' : undefined,
        className,
      )}
    >
      {illustration ? (
        <div aria-hidden="true" className="text-ink-3 sm:row-span-3">
          {illustration}
        </div>
      ) : null}
      <Heading className={cx('m-0 font-display font-semibold text-ink', size === 'page' ? 'text-h3' : 'text-h4')}>
        {title}
      </Heading>
      <p className="m-0 max-w-prose text-body text-ink-2">{benefit}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
