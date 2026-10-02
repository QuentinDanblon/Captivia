import type { ReactNode } from 'react';
import { BrandMark } from './BrandMark';
import { cx } from './cx';

export interface TipProps {
  /** Intitulé (« Bon à savoir »), traduit par l'appelant. */
  label: string;
  /** Le conseil, tiré de la fiche espèce : une ou deux phrases, chiffrées. */
  children: ReactNode;
  /** Source affichée en mono (« Fiche Boa constrictor · GBIF »), lien éventuel compris. */
  source?: ReactNode;
  className?: string;
}

/**
 * Conseil contextuel « Bon à savoir » (être guidé, apprendre) : une note de marge du carnet,
 * issue de la fiche de l'espèce de l'animal. Pas d'alerte : aucune urgence, aucun aplat coloré.
 *
 * @example
 * <Tip label="Bon à savoir" source="Fiche Boa constrictor">
 *   La mue dure 7 à 10 jours : remontez l'hygrométrie à 70-80 % pendant cette période.
 * </Tip>
 */
export default function Tip({ label, children, source, className }: TipProps) {
  return (
    <aside className={cx('grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 border-l border-line-strong py-1 pl-4', className)}>
      <BrandMark size={18} className="mt-0.5 text-accent-text" />
      <div className="min-w-0">
        <p className="m-0 font-display text-ui font-semibold text-ink italic">{label}</p>
        <div className="mt-0.5 text-ui text-ink">{children}</div>
        {source ? <p className="m-0 mt-1 font-mono text-meta text-ink-2">{source}</p> : null}
      </div>
    </aside>
  );
}

export { Tip };
