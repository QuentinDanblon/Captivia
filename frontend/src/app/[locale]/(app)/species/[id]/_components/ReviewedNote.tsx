'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { cx } from '@/components/ui';

/**
 * Mention discrète « Fiche vérifiée le 2 oct. 2026 » sous l'en-tête « planche » de la fiche espèce.
 * `lastReviewedAt` (GET /species/:id) vaut une date ISO, ou `null` tant que la fiche n'a pas été
 * relue : rien n'est alors affiché (ni « jamais », ni date inventée).
 */
export function ReviewedNote({ value, className }: { value: string | null | undefined; className?: string }) {
  const t = useTranslations();
  const format = useFormatter();
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return (
    <p className={cx('m-0 font-mono text-meta text-ink-2', className)}>
      <time dateTime={value}>{t('species.reviewedOn', { date: format.dateTime(date, { day: 'numeric', month: 'short', year: 'numeric' }) })}</time>
    </p>
  );
}

export default ReviewedNote;
