'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Animal, AnimalParent } from '@/lib/api';
import { animalDetailPath } from '@/lib/platform';
import { AnimalSilhouette, Badge, Card } from '@/components/ui';

/** Vignette ronde : la photo de l'animal, sinon la silhouette au trait (jamais d'initiale). */
function Avatar({ animal }: { animal: Pick<AnimalParent, 'photos'> }) {
  return animal.photos?.[0] ? (
    // eslint-disable-next-line @next/next/no-img-element -- photo de l'utilisateur (data URL ou adresse libre)
    <img src={animal.photos[0]} alt="" className="size-9 shrink-0 rounded-full border border-line object-cover" />
  ) : (
    <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-sunken text-ink-3">
      <AnimalSilhouette kind="other" size={22} />
    </span>
  );
}

const linkClass =
  'flex min-h-11 items-center gap-3 rounded-control border border-line px-3 py-1.5 no-underline transition-colors hover:border-line-field hover:bg-sunken';

/** Famille & groupe (module F) : parents, groupe et petits. */
export default function FamilySection({ animal, offspring }: { animal: Animal; offspring: Animal[] }) {
  const t = useTranslations();
  if (!(animal.father || animal.mother || animal.groupName || offspring.length > 0)) return null;
  const parents = [
    animal.father ? { role: t('animals.family.father'), parent: animal.father } : null,
    animal.mother ? { role: t('animals.family.mother'), parent: animal.mother } : null,
  ].filter((p): p is { role: string; parent: AnimalParent } => p !== null);

  return (
    <Card as="section" id="famille" title={t('animals.family.title')} titleId="family-title" className="scroll-mt-20">
      <div className="flex flex-wrap items-center gap-2">
        {parents.map(({ role, parent }) => (
          <Link key={parent.id} href={animalDetailPath(parent.id)} className={linkClass}>
            <Avatar animal={parent} />
            <span className="text-ui text-ink">
              <span className="text-ink-2">{role} · </span>
              <span className="font-medium">{parent.name}</span>
            </span>
          </Link>
        ))}
        {animal.groupName ? <Badge tone="neutral">{`${t('animals.family.group')} · ${animal.groupName}`}</Badge> : null}
      </div>
      {offspring.length > 0 ? (
        <div className="mt-5 grid gap-3">
          <h3 className="m-0 font-sans text-ui font-semibold text-ink">{t('animals.family.offspring')}</h3>
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
            {offspring.map((kid) => (
              <li key={kid.id}>
                <Link href={animalDetailPath(kid.id)} className={linkClass}>
                  <Avatar animal={kid} />
                  <span className="grid min-w-0">
                    <span className="truncate text-ui font-medium text-ink">{kid.name}</span>
                    {kid.sex ? <span className="text-meta text-ink-2">{t(`animals.${kid.sex}`)}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
