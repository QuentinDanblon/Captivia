/**
 * Mise en forme des mesures chiffrées (plages de température, d'hygrométrie…), dans la locale
 * de l'utilisateur : virgule décimale en français, tiret demi-cadratin, espace avant l'unité.
 */

const isNumber = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);

/** Plage chiffrée « 28–32 °C » (une seule valeur si min = max ou si l'une manque). Null sans valeur. */
export function formatRange(locale: string, min: number | null | undefined, max: number | null | undefined, unit: string): string | null {
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  if (!isNumber(min) && !isNumber(max)) return null;
  const body = isNumber(min) && isNumber(max) && min !== max ? `${nf.format(min)}–${nf.format(max)}` : nf.format((isNumber(min) ? min : max) as number);
  return `${body} ${unit}`;
}
