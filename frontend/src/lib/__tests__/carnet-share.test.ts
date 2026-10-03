const writeFile = jest.fn();
const share = jest.fn();
jest.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: (...args: unknown[]) => writeFile(...args) },
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}));
jest.mock('@capacitor/share', () => ({
  Share: { share: (...args: unknown[]) => share(...args) },
}));

import { buildCarnetHtml, carnetFileName, isShareCancelled, shareCarnetFile } from '../carnet-share';

/** Revue frontend, constat 8 : partage natif du carnet (window.print() inopérant en WebView). */
describe('carnet-share', () => {
  beforeEach(() => {
    writeFile.mockReset().mockResolvedValue({ uri: 'file:///cache/carnet-rango-2026-10-02.html' });
    share.mockReset().mockResolvedValue({});
  });

  it('buildCarnetHtml : document autonome, titre échappé, styles inclus', () => {
    const html = buildCarnetHtml({
      lang: 'fr',
      title: 'Carnet de santé - <Rango>',
      css: '.a{color:red}</style><script>',
      bodyHtml: '<article class="carnet-sheet">ok</article>',
    });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<title>Carnet de santé - &lt;Rango&gt;</title>');
    expect(html).toContain('.a{color:red}<\\/style><script>');
    expect(html.match(/<\/style>/g)).toHaveLength(1);
    expect(html).toContain('<article class="carnet-sheet">ok</article>');
  });

  it('carnetFileName : nom de fichier sûr (accents, espaces, caractères spéciaux)', () => {
    expect(carnetFileName('Rängo le Gecko !', '2026-10-02')).toBe('carnet-rango-le-gecko-2026-10-02.html');
    expect(carnetFileName('../..', '2026-10-02')).toBe('carnet-animal-2026-10-02.html');
  });

  it('shareCarnetFile : écrit dans le cache puis partage le fichier', async () => {
    await shareCarnetFile({ fileName: 'carnet-rango.html', html: '<html></html>', title: 'Carnet' });
    expect(writeFile).toHaveBeenCalledWith({
      path: 'carnet-rango.html',
      data: '<html></html>',
      directory: 'CACHE',
      encoding: 'utf8',
    });
    expect(share).toHaveBeenCalledWith({
      title: 'Carnet',
      dialogTitle: 'Carnet',
      files: ['file:///cache/carnet-rango-2026-10-02.html'],
    });
  });

  it('isShareCancelled : fermeture de la feuille de partage ≠ erreur', () => {
    expect(isShareCancelled(new Error('Share canceled'))).toBe(true);
    expect(isShareCancelled(new Error('Write failed'))).toBe(false);
  });
});
