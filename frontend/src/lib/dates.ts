/**
 * Dates calendaires LOCALES (fuseau du navigateur). `toISOString().slice(0, 10)` donne le jour
 * UTC : entre minuit et 1 h/2 h à Paris il renvoie la veille, d'où ces utilitaires.
 */

const pad = (n: number): string => String(n).padStart(2, '0');

/** `YYYY-MM-DD` du jour LOCAL de `date` (le navigateur de l'utilisateur fait foi). */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
