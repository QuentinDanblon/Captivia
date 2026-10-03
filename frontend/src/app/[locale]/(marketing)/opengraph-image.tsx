import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { routing } from '../../../../i18n/routing';

/*
 * Image de partage (Open Graph, 1200×630) de la landing et des pages légales, générée au build
 * pour chaque locale : papier du carnet, titre de la landing, photo réelle (golden retriever,
 * Dietmar Rabich, CC BY-SA 4.0 — crédit inscrit sur l'image, cf. public/images/CREDITS.md).
 * Écartée du build mobile (scripts/build-mobile.mjs) : sans objet dans l'app.
 */

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const PAPER = '#F6F3EC';
const INK = '#1D2B24';
const INK_2 = '#5B655E';
const MOSS = '#2F5D46';

export async function generateImageMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: 'landing.meta' });
  return [{ id: 'landing', alt: t('ogAlt'), size, contentType }];
}

export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'landing' });
  const photo = await readFile(path.join(process.cwd(), 'src', 'assets', 'og-golden-retriever.jpg'));
  const src = `data:image/jpeg;base64,${photo.toString('base64')}`;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: PAPER, color: INK }}>
        <div style={{ width: 560, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px 56px 48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 30, fontWeight: 600 }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={MOSS} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 19.5C4 11.5 9.5 4.8 19.5 4.5c.4 9.8-6.4 15.4-15 15Z" />
              <path d="M4.5 19.5 15.5 8.5" />
              <path d="M9.6 14.4h4.2M12.4 11.6V7.9" />
            </svg>
            Captivia
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 60, lineHeight: 1.05, fontWeight: 600 }}>{t('hero.titleLead')}</div>
            <div style={{ fontSize: 60, lineHeight: 1.05, fontWeight: 600, color: MOSS }}>{t('hero.titleRest')}</div>
            <div style={{ marginTop: 18, height: 5, borderTop: `2px solid ${INK}`, borderBottom: `1px solid ${INK}`, width: 120 }} />
          </div>
          <div style={{ fontSize: 24, color: INK_2 }}>{t('hero.reassurance')}</div>
        </div>
        <div style={{ position: 'relative', width: 640, height: 630, display: 'flex' }}>
          <img src={src} width={640} height={630} alt="" style={{ objectFit: 'cover' }} />
          <div
            style={{
              position: 'absolute',
              right: 16,
              bottom: 16,
              padding: '4px 10px',
              borderRadius: 6,
              background: 'rgba(246, 243, 236, 0.9)',
              fontSize: 16,
              color: INK,
            }}
          >
            {t('meta.ogCredit')}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
