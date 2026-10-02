/** Nom localisé d'un pays à partir de son code ISO 3166-1 alpha-2 (repli : le code lui-même). */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
