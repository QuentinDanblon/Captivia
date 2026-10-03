import { useLocale } from 'next-intl';

/** Formateurs de dates partagés (même rendu que l'ancienne page monolithique). */
export function useFormatters() {
  const locale = useLocale();

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString(locale);
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString?: string): string => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleString(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return dateString;
    }
  };

  return { formatDate, formatDateTime };
}
