import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { Alert, SectionHeader } from '@/components/ui';
import { Field } from '@/content/legal/ui';
import { LEGAL, LEGAL_ROUTES, contactMailto } from '@/lib/legal';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'transparency' });
  return { title: t('title'), description: t('metaDescription') };
}

const linkClass = 'font-medium text-accent-text underline decoration-1 underline-offset-[0.18em] transition-colors hover:text-ink';

/** Section numérotée, même lecture que les documents légaux (`content/legal`). */
function Section({ id, index, title, children }: { id: string; index: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <h2 id={id} className="m-0 flex items-baseline gap-3 text-h3 text-ink">
        <span aria-hidden="true" className="font-mono text-meta font-normal text-ink-2">
          {String(index).padStart(2, '0')}
        </span>
        <span>{title}</span>
      </h2>
      {children}
    </section>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="m-0 grid max-w-prose list-disc gap-2 pl-5 marker:text-ink-3">{children}</ul>;
}

export default async function TransparencyPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'transparency' });
  const tFooter = await getTranslations({ locale, namespace: 'footer' });
  const mailto = contactMailto();
  const settingsLink = (chunks: ReactNode) => (
    <Link href={LEGAL_ROUTES.accountSettings} className={linkClass}>
      {chunks}
    </Link>
  );

  return (
    <div className="cv-container py-8 sm:py-12">
      <div className="grid lg:grid-cols-12">
        <article className="min-w-0 break-words lg:col-span-8">
          <SectionHeader title={t('title')} description={t('intro')} />

          <div className="mt-10 grid gap-10 text-body leading-relaxed text-ink">
            <Section id="transparency-mission" index={1} title={t('missionTitle')}>
              <p className="m-0 max-w-prose">{t('missionBody')}</p>
            </Section>

            <Section id="transparency-model" index={2} title={t('modelTitle')}>
              <p className="m-0 max-w-prose">{t('modelIntro')}</p>
              <List>
                <li>{t('modelAffiliation')}</li>
                <li>{t('modelSubscription')}</li>
              </List>
              <p className="m-0 max-w-prose font-medium">{t('modelAlwaysFree')}</p>
            </Section>

            <Section id="transparency-affiliate" index={3} title={t('affiliateTitle')}>
              <Alert severity="info" title={tFooter('amazonAssociate')} />
              <List>
                <li>{t('affiliateLabelled')}</li>
                <li>{t('affiliateSamePrice')}</li>
                <li>{t('affiliateIndependence')}</li>
                <li>
                  {t.rich('affiliatePartners', {
                    link: (chunks) => (
                      <Link href="/magasin" className={linkClass}>
                        {chunks}
                      </Link>
                    ),
                  })}
                </li>
              </List>
            </Section>

            <Section id="transparency-data" index={4} title={t('dataTitle')}>
              <List>
                <li>{t('dataNoSale')}</li>
                <li>{t('dataNoTrackers')}</li>
                <li>{t('dataPrivate')}</li>
                <li>{t.rich('dataExport', { link: settingsLink })}</li>
                <li>{t.rich('dataDeletion', { link: settingsLink })}</li>
              </List>
              <p className="m-0">
                <Link href={LEGAL_ROUTES.privacy} className={linkClass}>
                  {t('dataMore')}
                </Link>
              </p>
            </Section>

            <Section id="transparency-open-data" index={5} title={t('openDataTitle')}>
              <p className="m-0 max-w-prose">{t('openDataBody')}</p>
              <p className="m-0">
                <Link href={LEGAL_ROUTES.sources} className={linkClass}>
                  {t('openDataMore')}
                </Link>
              </p>
            </Section>

            <Section id="transparency-contact" index={6} title={t('contactTitle')}>
              <p className="m-0 max-w-prose">{t('contactBody')}</p>
              <p className="m-0">
                {mailto ? (
                  <a href={mailto} className={linkClass}>
                    {LEGAL.contactEmail}
                  </a>
                ) : (
                  <span lang="fr">
                    <Field value={LEGAL.contactEmail} />
                  </span>
                )}
              </p>
            </Section>
          </div>
        </article>
      </div>
    </div>
  );
}
