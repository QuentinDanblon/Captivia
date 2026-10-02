'use client';

import type { ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { cx } from './cx';

/**
 * Statut d'un soin :
 *  - `done`     fait (pastille pleine cochée) ;
 *  - `due`      à faire aujourd'hui (anneau ocre + point) ;
 *  - `overdue`  en retard (losange brique) ;
 *  - `planned`  prévu plus tard (anneau à l'encre) ;
 *  - `skipped`  sauté / annulé (anneau barré, titre barré).
 * La forme de la pastille porte le statut autant que la couleur, et le libellé est toujours écrit.
 */
export type CareStatus = 'done' | 'due' | 'overdue' | 'planned' | 'skipped';

export interface CareTimelineItem {
  id: string;
  /** Date ISO 8601 (ou objet Date) de l'échéance. */
  date: string | Date;
  /** Soin sur la journée entière : on écrit `allDayLabel` au lieu de l'heure. */
  allDay?: boolean;
  title: ReactNode;
  /** Précision courte : animal, dose, praticien… */
  detail?: ReactNode;
  status: CareStatus;
  /** Nature du soin (« Médicament », « Vaccin »…), affichée après le statut. */
  kind?: ReactNode;
  /** Action propre à l'entrée (« Marquer comme fait »). */
  action?: ReactNode;
}

export interface CareTimelineProps {
  items: CareTimelineItem[];
  /** Libellés traduits des statuts. */
  statusLabels: Record<CareStatus, string>;
  /** Nom de la liste pour les lecteurs d'écran (« Soins des 7 prochains jours »). */
  label: string;
  /** Libellé des soins sans heure (« Toute la journée »). */
  allDayLabel?: string;
  /** Locale de formatage des dates (défaut : locale next-intl courante). */
  locale?: string;
  /** Fuseau des dates (défaut : celui du navigateur). */
  timeZone?: string;
  /** Fond sur lequel la frise est posée, pour « percer » le trait sous les pastilles. */
  background?: 'surface' | 'paper';
  className?: string;
}

const STATUS_TEXT: Record<CareStatus, string> = {
  done: 'text-ok',
  due: 'text-warn',
  overdue: 'text-danger',
  planned: 'text-ink-2',
  skipped: 'text-ink-2',
};

/** Pastille de statut dessinée en SVG (16 px), sur fond `--cv-timeline-bg`. */
function StatusMark({ status }: { status: CareStatus }) {
  const hole = 'var(--cv-timeline-bg)';
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true" focusable="false" data-status={status}>
      {status === 'done' && (
        <>
          <circle cx="8" cy="8" r="7" fill="var(--ok)" />
          <path d="M4.8 8.3 7 10.4l4.2-4.6" fill="none" stroke={hole} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {status === 'due' && (
        <>
          <circle cx="8" cy="8" r="6.2" fill={hole} stroke="var(--warn)" strokeWidth="1.8" />
          <circle cx="8" cy="8" r="2.4" fill="var(--warn)" />
        </>
      )}
      {status === 'overdue' && <path d="M8 1 15 8 8 15 1 8Z" fill="var(--danger)" />}
      {status === 'planned' && <circle cx="8" cy="8" r="6.2" fill={hole} stroke="var(--ink)" strokeWidth="1.5" />}
      {status === 'skipped' && (
        <>
          <circle cx="8" cy="8" r="6.2" fill={hole} stroke="var(--ink-3)" strokeWidth="1.5" />
          <path d="M4 12 12 4" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

const toDate = (value: string | Date) => (value instanceof Date ? value : new Date(value));

/**
 * Signature n° 2 — frise de soins « à l'encre » : un trait vertical continu, une pastille par
 * soin, la date en mono dans la colonne de gauche (le jour n'est répété qu'au changement de
 * jour). Liste ordonnée (`<ol>`) : l'ordre chronologique est porté par la structure.
 * Réutilisée par l'agenda, la fiche animal et le carnet de santé.
 *
 * @example
 * <CareTimeline
 *   label="Soins à venir"
 *   statusLabels={{ done: 'Fait', due: 'À faire', overdue: 'En retard', planned: 'Prévu', skipped: 'Sauté' }}
 *   allDayLabel="Journée"
 *   items={[{ id: '1', date: '2026-10-02T08:00:00Z', title: 'Nourrissage', detail: 'Kaa · 1 rat moyen', status: 'due' }]}
 * />
 */
export default function CareTimeline({
  items,
  statusLabels,
  label,
  allDayLabel,
  locale: localeProp,
  timeZone,
  background = 'surface',
  className,
}: CareTimelineProps) {
  const currentLocale = useLocale();
  const locale = localeProp ?? currentLocale;
  const dayFormat = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', timeZone });
  const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone });
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone });
  const keyFormat = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone });

  return (
    <ol
      aria-label={label}
      className={cx(
        'm-0 list-none p-0',
        background === 'paper' ? '[--cv-timeline-bg:var(--paper)]' : '[--cv-timeline-bg:var(--surface)]',
        className,
      )}
    >
      {items.map((item, index) => {
        const date = toDate(item.date);
        const day = keyFormat.format(date);
        const previous = index > 0 ? keyFormat.format(toDate(items[index - 1].date)) : null;
        const newDay = day !== previous;
        const isLast = index === items.length - 1;

        return (
          <li
            key={item.id}
            data-status={item.status}
            className="relative grid grid-cols-[4.75rem_1rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[6rem_1rem_minmax(0,1fr)] sm:gap-x-4"
          >
            {/* Colonne date (mono, chiffres tabulaires) */}
            <div className={cx('pb-6 text-right font-mono text-meta leading-5', newDay ? 'text-ink' : 'text-ink-2')}>
              <time dateTime={date.toISOString()} className="block">
                {newDay ? (
                  <span className="block">
                    <span className="hidden text-ink-2 sm:inline">{weekdayFormat.format(date)} </span>
                    {dayFormat.format(date)}
                  </span>
                ) : null}
                <span className={cx('block', newDay ? 'text-ink-2' : undefined)}>
                  {item.allDay ? (allDayLabel ?? '—') : timeFormat.format(date)}
                </span>
              </time>
            </div>

            {/* Rail : trait à l'encre continu + pastille */}
            <div className="relative flex justify-center" aria-hidden="true">
              {!isLast ? <span className="absolute top-3 -bottom-0.5 w-[1.5px] bg-ink/55" /> : null}
              {index > 0 ? <span className="absolute top-0 h-1 w-[1.5px] bg-ink/55" /> : null}
              <span className="relative mt-0.5 inline-flex size-4 self-start rounded-full bg-[var(--cv-timeline-bg)]">
                <StatusMark status={item.status} />
              </span>
            </div>

            {/* Contenu */}
            <div className={cx('min-w-0', isLast ? 'pb-0' : 'pb-6')}>
              <p
                className={cx(
                  'm-0 leading-6 font-medium text-ink',
                  item.status === 'skipped' && 'text-ink-2 line-through decoration-1',
                )}
              >
                {item.title}
              </p>
              {item.detail ? <p className="m-0 text-ui text-ink-2">{item.detail}</p> : null}
              <p className="m-0 mt-1 flex flex-wrap items-center gap-x-2 text-meta">
                <span className={cx('font-medium', STATUS_TEXT[item.status])}>{statusLabels[item.status]}</span>
                {item.kind ? (
                  <>
                    <span aria-hidden="true" className="text-ink-3">
                      ·
                    </span>
                    <span className="text-ink-2">{item.kind}</span>
                  </>
                ) : null}
              </p>
              {item.action ? <div className="mt-2">{item.action}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export { CareTimeline };
