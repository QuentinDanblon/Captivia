'use client';

import { useState, type ReactNode } from 'react';
import { cx } from './cx';

export interface LockedSlotProps {
  /** « Ajouter un deuxième animal » */
  title: ReactNode;
  /** Ce que débloque l'offre, concrètement (« Suivez jusqu'à 20 animaux, chacun avec son carnet. »). */
  value: ReactNode;
  /** Une action (« Découvrir Premium » ou « Créer un compte » pour un invité). */
  action: ReactNode;
  /** Mention de l'offre (`<PremiumBadge>`). */
  badge?: ReactNode;
  className?: string;
}

/**
 * Emplacement verrouillé, à la place de la carte « Ajouter un animal » quand la limite est
 * atteinte (invité et compte gratuit : 1 animal). Cadre en pointillés comme une case de carnet
 * encore libre, cadenas au trait, la valeur avant le prix. Jamais de flou ni de modale imposée.
 */
export function LockedSlot({ title, value, action, badge, className }: LockedSlotProps) {
  return (
    <div
      className={cx(
        'flex min-h-full flex-col justify-between gap-4 rounded-card border border-dashed border-line-strong p-5',
        className,
      )}
    >
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <svg viewBox="0 0 24 24" className="size-6 text-ink-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
            <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" strokeLinecap="round" />
            <path d="M12 14.5v2.2" strokeLinecap="round" />
          </svg>
          {badge}
        </div>
        <p className="m-0 font-display text-h4 font-semibold text-ink">{title}</p>
        <p className="m-0 text-ui text-ink-2">{value}</p>
      </div>
      <div>{action}</div>
    </div>
  );
}

export interface GuestBannerProps {
  /** « Sauvegardez vos données » */
  title: ReactNode;
  /** « Kaa et son carnet sont enregistrés sur cet appareil seulement. » */
  description?: ReactNode;
  /** « Créer un compte » (lien vers l'inscription, sans perte de données). */
  action: ReactNode;
  /** Libellé du bouton de fermeture ; absent → bandeau non masquable. */
  dismissLabel?: string;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Bandeau invité « Sauvegardez vos données » : discret (aplat papier creusé, filet), en tête
 * du contenu de l'app, masquable. L'app reste pleinement utilisable sans compte.
 */
export function GuestBanner({ title, description, action, dismissLabel, onDismiss, className }: GuestBannerProps) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <section
      aria-label={typeof title === 'string' ? title : undefined}
      className={cx('flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-line bg-sunken px-4 py-3', className)}
    >
      <div className="min-w-0 flex-1">
        <p className="m-0 font-medium text-ink">{title}</p>
        {description ? <p className="m-0 text-ui text-ink-2">{description}</p> : null}
      </div>
      <div className="flex items-center gap-1">
        {action}
        {dismissLabel ? (
          <button
            type="button"
            onClick={() => {
              setHidden(true);
              onDismiss?.();
            }}
            className="inline-flex size-11 items-center justify-center rounded-control text-ink-2 transition-colors hover:bg-paper hover:text-ink"
            aria-label={dismissLabel}
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>
    </section>
  );
}

export interface StepsProps {
  /** Libellés des étapes (« Espèce », « Nom et naissance », « Premier soin »). */
  steps: string[];
  /** Index de l'étape courante (0 = première). */
  current: number;
  /** Nom de la liste (« Ajouter votre premier animal »). */
  'aria-label': string;
  /** Texte de progression, traduit par l'appelant (« Étape 2 sur 3 »). */
  progressLabel?: string;
  className?: string;
}

/**
 * Progression de l'onboarding du premier animal (3-4 étapes) : liste ordonnée, étape courante
 * `aria-current="step"`, étapes faites cochées au trait. Numéros en mono.
 */
export function Steps({ steps, current, progressLabel, className, ...props }: StepsProps) {
  return (
    <div className={cx('grid gap-2', className)}>
      {progressLabel ? <p className="m-0 font-mono text-meta text-ink-2">{progressLabel}</p> : null}
      <ol className="m-0 flex list-none gap-2 p-0" aria-label={props['aria-label']}>
        {steps.map((label, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'todo';
          return (
            <li
              key={label}
              data-state={state}
              aria-current={state === 'current' ? 'step' : undefined}
              className="flex min-w-0 flex-1 flex-col gap-1.5"
            >
              <span
                aria-hidden="true"
                className={cx('h-0.5 rounded-full', state === 'todo' ? 'bg-line-strong' : 'bg-accent')}
              />
              <span className={cx('flex items-baseline gap-1.5 text-ui', state === 'todo' ? 'text-ink-2' : 'text-ink')}>
                <span className="font-mono text-meta">{state === 'done' ? '✓' : index + 1}</span>
                <span className={cx('truncate', state === 'current' && 'font-medium')}>{label}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
