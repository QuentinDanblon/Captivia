import { PHOTO_CHANGES, PHOTO_KEYS, PHOTOS } from '@/content/photos';
import { A, Table } from './ui';

const HEAD = {
  fr: ['Photographie', 'Auteur', 'Licence', 'Modifications'],
  en: ['Photograph', 'Author', 'Licence', 'Changes'],
} as const;

/** Crédits des photographies du site (registre `@/content/photos`, miroir de public/images/CREDITS.md). */
export function PhotoCreditsTable({ lang }: { lang: 'fr' | 'en' }) {
  const rows = PHOTO_KEYS.map((key) => {
    const p = PHOTOS[key];
    return [
      <A key="file" href={p.credit.sourceUrl}>
        {p.commonsTitle.replace(/\.(jpe?g|png)$/i, '')}
      </A>,
      p.credit.author,
      p.credit.licenseUrl ? (
        <A key="license" href={p.credit.licenseUrl}>
          {p.credit.license}
        </A>
      ) : lang === 'fr' ? (
        p.credit.license
      ) : (
        'Public domain'
      ),
      PHOTO_CHANGES[lang][p.changes],
    ];
  });
  return <Table head={[...HEAD[lang]]} rows={rows} />;
}
