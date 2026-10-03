import type { ReactNode } from 'react';
import { BrandMark, cx, type PhotoCredit } from '@/components/ui';
import { DeferredMount } from './DeferredMount';

export interface PreviewFrameProps {
  /** Ce que montre l'aperçu, lu par les lecteurs d'écran à la place du contenu décoratif. */
  description: string;
  /** Mention visible sous l'aperçu (« Aperçu de l'app, données d'exemple »). */
  note: string;
  /** Crédits des photos affichées dans l'aperçu (liens accessibles, hors de la zone masquée). */
  credits?: PhotoCredit[];
  children: ReactNode;
  /**
   * Aperçu sous la ligne de flottaison : contenu monté à l'approche du viewport (`DeferredMount`),
   * la valeur réserve sa hauteur (classes `min-h-*`). Absent : rendu immédiat (haut de page).
   */
  deferred?: string;
  className?: string;
}

/**
 * Cadre d'un aperçu d'écran de l'app sur la landing : vrais composants `ui/` et données d'exemple.
 * Le contenu est une illustration (`aria-hidden`, sans élément focusable) ; sa description et les
 * crédits photo sont portés par la légende, elle accessible. Pas de faux téléphone : une simple
 * fenêtre papier à filet, comme une page du carnet posée sur la table.
 */
export function PreviewFrame({ description, note, credits = [], children, deferred, className }: PreviewFrameProps) {
  return (
    <figure className={cx('m-0 grid min-w-0 gap-2', className)}>
      <div className="overflow-hidden rounded-card border border-line-strong bg-paper">
        <div aria-hidden="true" className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2">
          <BrandMark size={16} className="text-accent-text" />
          <span className="font-display text-ui font-semibold text-ink">Captivia</span>
        </div>
        <div aria-hidden="true" className="p-4 sm:p-6">
          {deferred ? <DeferredMount placeholderClassName={deferred}>{children}</DeferredMount> : children}
        </div>
      </div>
      <figcaption className="text-meta text-ink-2">
        <span className="sr-only">{description} </span>
        <span className="font-mono">{note}</span>
        {credits.map((credit) => (
          <span key={credit.sourceUrl} className="font-mono">
            {' · © '}
            <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-1 underline-offset-2">
              {credit.author}
            </a>
            {', '}
            {credit.licenseUrl ? (
              <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer license" className="underline decoration-1 underline-offset-2">
                {credit.license}
              </a>
            ) : (
              credit.license
            )}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
