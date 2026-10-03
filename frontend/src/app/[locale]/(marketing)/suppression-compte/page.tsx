'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SectionHeader, buttonClasses } from '@/components/ui';
import { Field } from '@/content/legal/ui';
import { LEGAL, contactMailto } from '@/lib/legal';

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

/**
 * Page publique (sans authentification) expliquant comment supprimer son compte.
 * Exigée par Google Play (URL de suppression de compte dans la fiche Data safety).
 */
export default function SuppressionComptePage() {
  const t = useTranslations('account');
  const subject = t('emailSubject');
  const base = contactMailto();
  const mailto = base ? `${base}?subject=${encodeURIComponent(subject)}` : null;
  const linkClass = 'font-medium text-accent-text underline decoration-1 underline-offset-[0.18em] transition-colors hover:text-ink';

  return (
    <div className="cv-container py-8 sm:py-12">
      <div className="grid lg:grid-cols-12">
        <article className="min-w-0 break-words lg:col-span-8">
          <SectionHeader title={t('publicTitle')} description={t('publicIntro')} />

          <div className="mt-10 grid gap-10 text-body leading-relaxed text-ink">
            <Section id="delete-in-app" index={1} title={t('inAppTitle')}>
              <ol className="m-0 grid list-none gap-0 border-t border-line p-0">
                {[1, 2, 3, 4].map((n) => (
                  <li key={n} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 border-b border-line py-2">
                    <span className="font-mono text-meta leading-7 text-ink-2">{n}.</span>
                    <span>{t(`inAppStep${n}`)}</span>
                  </li>
                ))}
              </ol>
              <p className="m-0 mt-2">
                <Link href="/parametres/compte" className={buttonClasses({ variant: 'secondary' })}>
                  {t('sectionTitle')}
                </Link>
              </p>
            </Section>

            <Section id="delete-by-email" index={2} title={t('emailTitle')}>
              <p className="m-0 max-w-prose">{t('emailBody', { email: LEGAL.contactEmail, subject })}</p>
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

            <Section id="delete-what" index={3} title={t('whatTitle')}>
              <ul className="m-0 grid max-w-prose list-disc gap-2 pl-5 marker:text-ink-3">
                <li>{t('whatItem1')}</li>
                <li>{t('whatItem2')}</li>
                <li>{t('whatItem3')}</li>
                <li>{t('whatItem4')}</li>
              </ul>
            </Section>

            <Section id="delete-backups" index={4} title={t('backupTitle')}>
              <p className="m-0 max-w-prose">{t('backupBody')}</p>
            </Section>

            <Section id="delete-export" index={5} title={t('exportInfoTitle')}>
              <p className="m-0 max-w-prose">{t('exportInfoBody')}</p>
            </Section>
          </div>
        </article>
      </div>
    </div>
  );
}
