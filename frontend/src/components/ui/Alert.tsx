import type { ReactNode } from 'react';
import { cx } from './cx';

/** Gravité graduée : `info` (à savoir), `warning` (à prévoir), `urgent` (à faire maintenant). */
export type AlertSeverity = 'info' | 'warning' | 'urgent';

export interface AlertProps {
  severity?: AlertSeverity;
  /** Constat court et chiffré : « Rappel de vaccin dans 6 jours ». */
  title: ReactNode;
  /** Précision (animal, échéance, conséquence). */
  children?: ReactNode;
  /** Une action au plus (« Prendre rendez-vous »). */
  action?: ReactNode;
  /** Mot de gravité lu avant le titre (« Urgent »), traduit par l'appelant. */
  severityLabel?: string;
  className?: string;
}

const STYLES: Record<AlertSeverity, { box: string; mark: string }> = {
  info: { box: 'bg-info-soft shadow-[inset_3px_0_0_var(--info)]', mark: 'text-info' },
  warning: { box: 'bg-warn-soft shadow-[inset_3px_0_0_var(--warn)]', mark: 'text-warn' },
  urgent: { box: 'bg-danger-soft shadow-[inset_3px_0_0_var(--danger)]', mark: 'text-danger' },
};

/** Pictogramme de gravité : la forme change avec le niveau (rond, triangle, losange). */
function SeverityMark({ severity }: { severity: AlertSeverity }) {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0" fill="none" aria-hidden="true" data-severity={severity}>
      {severity === 'info' && (
        <>
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 7.2v4M8 4.8v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      {severity === 'warning' && (
        <>
          <path d="M8 1.8 14.8 13.8H1.2L8 1.8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M8 6.4v3.4M8 11.6v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      {severity === 'urgent' && (
        <>
          <path d="M8 .9 15.1 8 8 15.1.9 8Z" fill="currentColor" />
          <path d="M8 4.8v3.8M8 10.8v.1" stroke="var(--surface)" strokeWidth="1.7" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/**
 * Alerte graduée du carnet (« être averti ») : rendez-vous à prendre, traitement en retard,
 * information réglementaire. Filet gauche + aplat léger + pictogramme dont la forme change
 * avec la gravité. `urgent` est annoncé immédiatement (`role="alert"`), les autres poliment.
 *
 * @example
 * <Alert severity="warning" title="Bilan annuel à prévoir" action={<Button size="sm" variant="secondary">Prendre rendez-vous</Button>}>
 *   Kaa — dernière visite il y a 11 mois.
 * </Alert>
 */
export default function Alert({ severity = 'info', title, children, action, severityLabel, className }: AlertProps) {
  const style = STYLES[severity];
  return (
    <div
      role={severity === 'urgent' ? 'alert' : 'status'}
      data-severity={severity}
      className={cx('flex flex-wrap items-start gap-x-3 gap-y-2 rounded-control py-3 pr-4 pl-4 text-ink', style.box, className)}
    >
      <span className={style.mark}>
        <SeverityMark severity={severity} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-medium">
          {severityLabel ? <><span className={style.mark}>{severityLabel} ·</span>{' '}</> : null}
          {title}
        </p>
        {children ? <div className="mt-0.5 text-ui text-ink-2">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 basis-full pl-7 sm:basis-auto sm:pl-0">{action}</div> : null}
    </div>
  );
}

export { Alert };
