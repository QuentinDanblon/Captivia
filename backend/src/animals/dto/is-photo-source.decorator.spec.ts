import {
  isPhotoSource,
  MAX_PHOTO_DATA_URL_BYTES,
} from './is-photo-source.decorator';

describe('isPhotoSource', () => {
  it('accepte une URL https', () => {
    expect(isPhotoSource('https://example.com/a.jpg')).toBe(true);
  });

  it('refuse http, javascript: et les valeurs non texte', () => {
    expect(isPhotoSource('http://example.com/a.jpg')).toBe(false);
    expect(isPhotoSource('javascript:alert(1)')).toBe(false);
    expect(isPhotoSource('not a url')).toBe(false);
    expect(isPhotoSource(42)).toBe(false);
  });

  it('accepte une data URL image de taille raisonnable', () => {
    expect(isPhotoSource('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });

  it('refuse une data URL non image (svg, html) ou trop grosse', () => {
    expect(isPhotoSource('data:text/html;base64,PGh0bWw+')).toBe(false);
    expect(isPhotoSource('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    const big = 'A'.repeat(Math.ceil((MAX_PHOTO_DATA_URL_BYTES * 4) / 3) + 8);
    expect(isPhotoSource(`data:image/jpeg;base64,${big}`)).toBe(false);
  });
});
