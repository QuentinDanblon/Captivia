'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { api, type PublicAnimalProfile } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { Card, EmptyState, Figure, SectionHeader, Skeleton, SkeletonGroup, SkeletonText, buttonClasses } from '@/components/ui';

/** Date calendaire de l'API (minuit UTC) : affichée sans décalage de fuseau. */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}(T00:00(:00(\.000)?)?Z)?$/;

/**
 * Page publique d'un animal (lien ou QR code partagé par son propriétaire) : lecture seule, liste
 * blanche renvoyée par l'API (nom, espèce, sexe, année de naissance, photo, vaccins si autorisés).
 */
export default function AnimalPublicPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [slug, setSlug] = useState<string | null>(null);
  const [data, setData] = useState<PublicAnimalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    api
      .getPublicAnimal(slug)
      .then(setData)
      .catch((e: Error & { status?: number }) =>
        // 404 : lien inexistant, désactivé ou régénéré — message générique, sans détail
        setError(e.status === 404 ? t('publicLink.pageNotFound') : e.message || t('publicLink.pageNotFound')),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      ...(CALENDAR_DATE.test(value) ? { timeZone: 'UTC' } : {}),
    }).format(date);
  };

  if (loading || !slug) {
    return (
      <div className="cv-container py-8 sm:py-12">
        <SkeletonGroup label={t('common.loading')} className="mx-auto grid max-w-3xl gap-6">
          <Skeleton shape="block" height={220} />
          <SkeletonText lines={3} />
        </SkeletonGroup>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="cv-container py-12">
        <EmptyState
          headingLevel={1}
          className="mx-auto max-w-2xl"
          title={error || t('publicLink.pageNotFound')}
          benefit={t('publicLink.readOnly')}
          action={
            <Link href="/" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
              {t('common.home')}
            </Link>
          }
        />
      </div>
    );
  }

  const sex = data.sex === 'male' ? t('animals.male') : data.sex === 'female' ? t('animals.female') : data.sex ? t('animals.unknown') : null;
  const facts = [
    data.species?.commonName ? { label: t('animals.species'), value: data.species.commonName } : null,
    sex ? { label: t('animals.sex'), value: sex } : null,
    data.birthYear ? { label: t('animals.birthDate'), value: t('publicLink.bornIn', { year: data.birthYear }) } : null,
  ].filter((fact): fact is { label: string; value: string; mono?: boolean } => fact !== null);

  return (
    <div className="cv-container py-8 sm:py-12">
      <div className="mx-auto grid max-w-3xl gap-8">
        <div className="grid items-end gap-6 sm:grid-cols-[12rem_minmax(0,1fr)]">
          {data.photo ? (
            <Figure ratio="1/1" className="w-40 sm:w-full" src={data.photo} alt={data.name} userPhoto />
          ) : (
            <Figure ratio="1/1" className="w-40 sm:w-full" fallbackKind="other" />
          )}
          <SectionHeader title={data.name} latin={data.species?.scientificName || undefined} />
        </div>

        {facts.length > 0 ? (
          <dl className="m-0 grid gap-0 border-t border-line sm:grid-cols-3">
            {facts.map((fact) => (
              <div key={fact.label} className="grid gap-1 border-b border-line py-3 sm:pr-4">
                <dt className="text-meta text-ink-2">{fact.label}</dt>
                <dd className={fact.mono ? 'm-0 font-mono text-body text-ink' : 'm-0 text-body text-ink'}>{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {/* Vaccins : uniquement si le propriétaire a choisi de les afficher. */}
        {data.vaccinations ? (
          <Card as="section" title={t('publicLink.vaccinations')} titleId="public-vaccinations">
            {data.vaccinations.length === 0 ? (
              <p className="m-0 text-ui text-ink-2">{t('publicLink.noVaccinations')}</p>
            ) : (
              <ul className="m-0 grid list-none p-0">
                {data.vaccinations.map((v, i) => (
                  <li key={`${v.name}-${v.date}-${i}`} className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-b-0">
                    <span className="font-medium text-ink">{v.name}</span>
                    <time dateTime={v.date} className="font-mono text-ui text-ink-2">
                      {formatDate(v.date)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        <p className="m-0 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-meta text-ink-2">
          <span>
            {t('common.appName')} · {t('publicLink.readOnly')}
          </span>
          <Link href="/mes-animaux" className="font-medium text-accent-text underline decoration-1 underline-offset-[0.18em] hover:text-ink">
            {t('guest.entryTry')}
          </Link>
        </p>
      </div>
    </div>
  );
}
