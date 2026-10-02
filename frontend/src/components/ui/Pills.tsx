import type { HTMLAttributes } from 'react';
import { cx } from './cx';

type PillTone = 'neutral' | 'ok' | 'warn' | 'danger';

const TONES: Record<PillTone, string> = {
  neutral: 'border-line-strong bg-transparent text-ink-2',
  ok: 'border-transparent bg-ok-soft text-ok',
  warn: 'border-transparent bg-warn-soft text-warn',
  danger: 'border-transparent bg-danger-soft text-danger',
};

export interface TaskPillProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Nombre de tâches (affiché en mono, chiffres tabulaires). */
  count: number;
  /** Libellé accordé au nombre, traduit par l'appelant (« soins aujourd'hui »). */
  label: string;
  /** Défaut : `warn` s'il reste des soins, `ok` à zéro. `danger` pour un retard. */
  tone?: PillTone;
}

/**
 * Pastille « à faire » du tableau de bord : « 3 soins aujourd'hui ». Le nombre est le message ;
 * la couleur ne fait que le souligner.
 */
export function TaskPill({ count, label, tone, className, ...props }: TaskPillProps) {
  const resolved: PillTone = tone ?? (count > 0 ? 'warn' : 'ok');
  return (
    <span
      data-tone={resolved}
      className={cx(
        'inline-flex items-baseline gap-1.5 rounded-control border px-2 py-0.5 text-ui leading-5 whitespace-nowrap',
        TONES[resolved],
        className,
      )}
      {...props}
    >
      <span className="font-mono font-medium tabular-nums">{count}</span>
      <span>{label}</span>
    </span>
  );
}

/**
 * Badge Premium sobre : un mot en mono, un filet, la mousse en texte, un petit losange.
 * Pas de couronne, pas de doré, pas de dégradé.
 */
export function PremiumBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-control border border-line-field px-1.5 py-px font-mono text-meta font-medium text-accent-text',
        className,
      )}
    >
      <svg viewBox="0 0 10 10" className="size-2" aria-hidden="true">
        <path d="M5 0 10 5 5 10 0 5Z" fill="currentColor" />
      </svg>
      {label}
    </span>
  );
}
