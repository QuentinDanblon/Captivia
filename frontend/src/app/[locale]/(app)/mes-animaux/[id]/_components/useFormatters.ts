import { useLocale } from 'next-intl';

/** Date calendaire de l'API (champ « date » stocké à minuit UTC) : affichée telle quelle, sans décalage de fuseau. */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}(T00:00(:00(\.000)?)?Z)?$/;

/**
 * Formateurs de dates de la fiche animal, alignés sur la frise et le bandeau de synthèse :
 * « 21 sept. 2026 » et « 8 oct. 2026, 14:00 » (jamais « 21/09/2026 »). Valeur absente : « — ».
 */
export function useFormatters() {
  const locale = useLocale();

  const formatDate = (dateString?: string | null): string => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      ...(CALENDAR_DATE.test(dateString) ? { timeZone: 'UTC' } : {}),
    }).format(date);
  };

  const formatDateTime = (dateString?: string | null): string => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  };

  return { formatDate, formatDateTime };
}
