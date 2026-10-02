import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { LEGAL, LEGAL_ROUTES, contactMailto } from '@/lib/legal';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'transparency' });
  return { title: t('title'), description: t('metaDescription') };
}

const linkClass =
  'font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-xl font-bold text-emerald-800 sm:text-2xl dark:text-emerald-300">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function TransparencyPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'transparency' });
  const tFooter = await getTranslations({ locale, namespace: 'footer' });
  // Le Link next-intl ajoute lui-même le préfixe de locale.
  const href = (path: string) => path;
  const mailto = contactMailto();
  const settingsLink = (chunks: ReactNode) => (
    <Link href={href(LEGAL_ROUTES.accountSettings)} className={linkClass}>
      {chunks}
    </Link>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto w-full min-w-0 max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl dark:text-white">{t('title')}</h1>
        <p className="mb-8 text-gray-700 dark:text-gray-300">{t('intro')}</p>

        <div className="space-y-8 break-words rounded-xl bg-white p-4 leading-relaxed text-gray-800 shadow-lg sm:p-8 dark:bg-gray-800 dark:text-gray-200">
          <Section id="transparency-mission" title={t('missionTitle')}>
            <p>{t('missionBody')}</p>
          </Section>

          <Section id="transparency-model" title={t('modelTitle')}>
            <p>{t('modelIntro')}</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>{t('modelAffiliation')}</li>
              <li>{t('modelSubscription')}</li>
            </ul>
            <p className="font-medium">{t('modelAlwaysFree')}</p>
          </Section>

          <Section id="transparency-affiliate" title={t('affiliateTitle')}>
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
              {tFooter('amazonAssociate')}
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>{t('affiliateLabelled')}</li>
              <li>{t('affiliateSamePrice')}</li>
              <li>{t('affiliateIndependence')}</li>
              <li>
                {t.rich('affiliatePartners', {
                  link: (chunks) => (
                    <Link href={href('/magasin')} className={linkClass}>
                      {chunks}
                    </Link>
                  ),
                })}
              </li>
            </ul>
          </Section>

          <Section id="transparency-data" title={t('dataTitle')}>
            <ul className="list-disc space-y-2 pl-5">
              <li>{t('dataNoSale')}</li>
              <li>{t('dataNoTrackers')}</li>
              <li>{t('dataPrivate')}</li>
              <li>{t.rich('dataExport', { link: settingsLink })}</li>
              <li>{t.rich('dataDeletion', { link: settingsLink })}</li>
            </ul>
            <p>
              <Link href={href(LEGAL_ROUTES.privacy)} className={linkClass}>
                {t('dataMore')}
              </Link>
            </p>
          </Section>

          <Section id="transparency-open-data" title={t('openDataTitle')}>
            <p>{t('openDataBody')}</p>
            <p>
              <Link href={href(LEGAL_ROUTES.sources)} className={linkClass}>
                {t('openDataMore')}
              </Link>
            </p>
          </Section>

          <div className="border-t border-gray-200 pt-6 dark:border-gray-700">
            <Section id="transparency-contact" title={t('contactTitle')}>
              <p>{t('contactBody')}</p>
              <p className="font-semibold">
                {mailto ? (
                  <a href={mailto} className={linkClass}>
                    {LEGAL.contactEmail}
                  </a>
                ) : (
                  <mark
                    lang="fr"
                    className="rounded bg-amber-100 px-1 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100"
                  >
                    {LEGAL.contactEmail}
                  </mark>
                )}
              </p>
            </Section>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href={href('/')}
            className="inline-block rounded-lg bg-emerald-700 px-6 py-3 text-white transition-colors hover:bg-emerald-800"
          >
            {t('backHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}
