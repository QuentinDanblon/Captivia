/**
 * Partage du carnet de santé dans l'app native : `window.print()` est sans effet dans la WebView
 * Capacitor. Le carnet est écrit comme fichier HTML autonome (styles inclus, lisible dans tout
 * navigateur et imprimable en PDF) dans le cache de l'app, puis confié à la feuille de partage.
 * Les plugins sont importés dynamiquement : ils restent hors du bundle web.
 */

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Document HTML autonome : `bodyHtml` est le balisage déjà rendu (échappé) par React. */
export function buildCarnetHtml({
  lang,
  title,
  css,
  bodyHtml,
}: {
  lang: string;
  title: string;
  css: string;
  bodyHtml: string;
}): string {
  return [
    '<!doctype html>',
    `<html lang="${escapeHtml(lang)}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    // Le CSS est une constante de l'app : on empêche seulement la fermeture prématurée de <style>.
    `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`,
    '</head>',
    `<body><main class="carnet-page">${bodyHtml}</main></body>`,
    '</html>',
  ].join('\n');
}

/** Nom de fichier sûr : `carnet-<nom>-<YYYY-MM-DD>.html`. */
export function carnetFileName(animalName: string, day: string): string {
  const slug =
    animalName
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'animal';
  return `carnet-${slug}-${day}.html`;
}

/** true si l'utilisateur a simplement fermé la feuille de partage (pas une erreur). */
export function isShareCancelled(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '');
  return /cancel/i.test(message);
}

/** Écrit le fichier dans le cache de l'app puis ouvre la feuille de partage native. */
export async function shareCarnetFile({
  fileName,
  html,
  title,
}: {
  fileName: string;
  html: string;
  title: string;
}): Promise<void> {
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);
  const { uri } = await Filesystem.writeFile({
    path: fileName,
    data: html,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({ title, dialogTitle: title, files: [uri] });
}
