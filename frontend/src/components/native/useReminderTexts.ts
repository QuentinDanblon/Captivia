'use client';

import { useTranslations } from 'next-intl';
import type { AgendaItem } from '@/lib/agenda';
import type { ReminderTexts } from '@/lib/local-reminders';

/** Textes des notifications locales (W6-06), dans la langue de l'app. */
export function useReminderTexts(): ReminderTexts {
  const t = useTranslations();
  return {
    format: (item: AgendaItem) => ({
      title: item.animalName,
      body: t('nativeReminders.body', { type: t(`agenda.types.${item.type}`), title: item.title }),
    }),
    channelName: t('nativeReminders.channelName'),
    channelDescription: t('nativeReminders.channelDescription'),
  };
}
