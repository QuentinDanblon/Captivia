/** Navigation pleine page (rechargement complet). Isolée dans un module pour pouvoir la simuler en test. */
export function hardNavigate(url: string): void {
  window.location.assign(url);
}
