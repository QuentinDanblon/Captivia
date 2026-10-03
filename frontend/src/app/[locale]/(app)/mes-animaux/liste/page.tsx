'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { animalCarnetPath, animalDetailPath } from '@/lib/platform';
import { api, ApiError, type Animal as ApiAnimal } from '@/lib/api';
import { errorKey } from '@/lib/api-errors';
import { isGuestUser } from '@/lib/guest';
import { compressImageToDataUrl, isImageTooLargeError, isUnsupportedImageError } from '@/lib/image';
import { usePhotoPicker } from '@/components/usePhotoPicker';
import { ageOf, formatAge, latinName, type SpeciesSheet } from '@/lib/today';
import {
  AnimalCard,
  Badge,
  Button,
  EmptyState,
  Modal,
  SectionHeader,
  Skeleton,
  SkeletonGroup,
  Toast,
  AnimalSilhouette,
  buttonClasses,
  silhouetteKindOf,
} from '@/components/ui';
import { GuestEntry } from '@/components/guest/GuestEntry';
import { GuestSaveBanner } from '@/components/guest/GuestSaveBanner';
import { AddAnimalLockedSlot } from '@/components/guest/AddAnimalLockedSlot';
import AddAnimalFlow from '../_components/AddAnimalFlow';

interface Animal extends ApiAnimal {
  speciesName?: string;
  _count?: {
    routines: number;
    history: number;
  };
}

/**
 * Tous les animaux (secondaire : l'onglet « Mes animaux » ouvre « Aujourd'hui »). Une carte par
 * animal, en `<article>` à lien étiré ; le carnet et la photo sont des actions sœurs, jamais
 * imbriquées dans le lien. Limite atteinte : l'emplacement verrouillé remplace l'ajout.
 */
export default function AnimalsListPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { user, token, isLoading: authLoading } = useAuth();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [species, setSpecies] = useState<Record<number, SpeciesSheet | null>>({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  /** Message éphémère : succès (vert) ou erreur (rouge), jamais une erreur affichée en succès. */
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showSuccess = useCallback((message: string) => setToast({ message, type: 'success' }), []);
  const showError = useCallback((message: string) => setToast({ message, type: 'error' }), []);
  const [now] = useState(() => new Date());

  // Changement de photo depuis la carte
  const [photoAnimalId, setPhotoAnimalId] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const fetchAnimals = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getMyAnimals(token);
      setAnimals(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching animals:', error);
      setAnimals([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user && token) void fetchAnimals();
  }, [user, token, fetchAnimals]);

  // Fiches d'espèce (binôme latin, silhouette) : une requête par espèce, facultative.
  const speciesKey = [...new Set(animals.map((a) => a.speciesId))].sort().join(',');
  useEffect(() => {
    if (!speciesKey) return;
    let cancelled = false;
    const ids = speciesKey.split(',').map(Number);
    Promise.allSettled(ids.map(async (id) => [id, (await api.getSpecies(String(id))) as SpeciesSheet] as const)).then((results) => {
      if (cancelled) return;
      const next: Record<number, SpeciesSheet | null> = {};
      results.forEach((r, i) => {
        next[ids[i]] = r.status === 'fulfilled' ? r.value[1] : null;
      });
      setSpecies(next);
    });
    return () => {
      cancelled = true;
    };
  }, [speciesKey]);

  const handleCardPhotoFile = async (file: Blob, id: string | undefined) => {
    if (!id || !token) return;
    setPhotoAnimalId(id);
    setPhotoUploading(true);
    try {
      // W4-07 : réduction sur l'appareil (600 px max, ~100 Ko, WebP ou JPEG), refus > 30 Mo
      const dataUrl = await compressImageToDataUrl(file);
      await api.updateAnimal(id, { photos: [dataUrl] }, token);
      await fetchAnimals();
      showSuccess(t('animals.animalUpdated'));
    } catch (err) {
      // Session perdue : lib/api a déjà tenté le refresh et émis `auth:logout` si elle est
      // révoquée (la page redirige alors). Jamais de logout() ici : ni sur 403, ni sur un
      // échec passager du backend.
      if (err instanceof ApiError && err.status === 401) return;
      if (isImageTooLargeError(err)) {
        showError(t('animals.photoTooLarge'));
        return;
      }
      if (isUnsupportedImageError(err)) {
        showError(t('animals.photoUnsupported'));
        return;
      }
      console.error('Error updating photo:', err);
      showError(t(errorKey(err, { fallback: 'animals.photoUpdateError' })));
    } finally {
      setPhotoUploading(false);
      setPhotoAnimalId(null);
    }
  };
  // Web : sélecteur de fichier ; app native : appareil photo ou galerie (W6-05).
  const { inputRef: cardPhotoInputRef, open: openCardPhotoPicker, onChange: onCardPhotoInputChange } = usePhotoPicker<string>({ onFile: handleCardPhotoFile, onError: showError });

  const closeToast = useCallback(() => setToast(null), []);

  // Plusieurs animaux = compte + Premium : un invité reste à 1 animal (D-16).
  const guest = isGuestUser(user);
  const canAddAnimal = (!guest && user?.isPremium) || animals.length < 1;

  if (!authLoading && !user) return <GuestEntry />;

  const sexLabel = (sex?: string) => (sex === 'male' || sex === 'female' ? t(`animals.${sex}`) : t('animals.unknown'));
  const familyKey = (animal: Animal) =>
    `animals.family.${animal.sex === 'female' ? 'daughterOf' : animal.sex === 'unknown' ? 'childOf' : 'sonOf'}`;

  return (
    <div className="cv-container grid gap-6 py-6 sm:py-8">
      <GuestSaveBanner animalName={animals[0]?.name} />
      <SectionHeader
        title={t('animals.myAnimals')}
        marginNote={loading ? undefined : t('animals.list.count', { count: animals.length })}
        description={t('animals.list.description')}
        actions={
          canAddAnimal && animals.length > 0 ? <Button onClick={() => setAddOpen(true)}>{t('animals.addAnimal')}</Button> : undefined
        }
      />

      {authLoading || loading ? (
        <SkeletonGroup label={t('common.loading')} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid gap-3 rounded-card border border-line p-0">
              <Skeleton shape="block" height={180} className="rounded-b-none" />
              <div className="grid gap-2 p-4">
                <Skeleton width="50%" height={22} />
                <Skeleton width="70%" />
              </div>
            </div>
          ))}
        </SkeletonGroup>
      ) : animals.length === 0 ? (
        <EmptyState
          size="page"
          headingLevel={2}
          title={t('animals.noAnimals')}
          benefit={t('animals.list.emptyBenefit')}
          illustration={<AnimalSilhouette kind="reptile" size={72} />}
          action={<Button onClick={() => setAddOpen(true)}>{t('animals.addAnimal')}</Button>}
        />
      ) : (
        <>
          <input ref={cardPhotoInputRef} type="file" accept="image/*" className="hidden" tabIndex={-1} aria-hidden onChange={onCardPhotoInputChange} />
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {animals.map((animal) => {
              const sheet = species[animal.speciesId];
              const age = ageOf(animal.birthDate, now);
              const uploading = photoUploading && photoAnimalId === animal.id;
              return (
                <li key={animal.id} className="grid">
                  <AnimalCard
                    name={animal.name}
                    latin={latinName(sheet, animal.speciesName) ?? undefined}
                    kind={silhouetteKindOf(sheet?.class ?? sheet?.profile?.category)}
                    photo={animal.photos?.[0] ? { src: animal.photos[0], alt: t('today.photoAlt', { name: animal.name }), userPhoto: true } : undefined}
                    href={animalDetailPath(animal.id)}
                    linkAs={Link}
                    headingLevel={2}
                    sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
                    status={
                      animal.groupName || animal._count?.routines ? (
                        <>
                          {animal.groupName ? <Badge tone="neutral">{`${t('animals.family.group')} · ${animal.groupName}`}</Badge> : null}
                          {animal._count?.routines ? (
                            <Badge tone="accent">{t('animals.list.routines', { count: animal._count.routines })}</Badge>
                          ) : null}
                        </>
                      ) : undefined
                    }
                    facts={[
                      { label: t('animals.sex'), value: <span className="font-sans">{sexLabel(animal.sex)}</span> },
                      ...(age ? [{ label: t('today.factAge'), value: formatAge(age, locale) }] : []),
                    ]}
                    actions={
                      <>
                        <Link href={animalCarnetPath(animal.id)} className={buttonClasses({ variant: 'quiet', size: 'sm', className: 'relative z-10' })}>
                          {t('carnetPrint.title')}
                        </Link>
                        <Button
                          variant="quiet"
                          size="sm"
                          className="relative z-10 ml-auto"
                          loading={uploading}
                          onClick={() => void openCardPhotoPicker(animal.id)}
                        >
                          {t('animals.changePhoto')}
                        </Button>
                      </>
                    }
                  >
                    {animal.father?.name || animal.mother?.name ? (
                      <p className="m-0 mt-3 text-ui text-ink-2">
                        {[animal.father?.name, animal.mother?.name]
                          .filter((n): n is string => Boolean(n))
                          .map((n) => t(familyKey(animal), { name: n }))
                          .join(' · ')}
                      </p>
                    ) : null}
                  </AnimalCard>
                </li>
              );
            })}
            {/* « Ajouter un animal » verrouillé : invité → compte, gratuit → Premium. */}
            {!canAddAnimal ? (
              <li className="grid">
                <AddAnimalLockedSlot isGuest={guest} />
              </li>
            ) : null}
          </ul>
        </>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} size="lg" title={t('animals.addAnimal')} dismissible={!addBusy} closeOnOverlayClick={false}>
        {addOpen && token ? (
          <AddAnimalFlow
            token={token}
            isGuest={guest}
            onCreated={(name) => {
              showSuccess(`${name} ${t('animals.animalAdded')}`);
              void fetchAnimals();
            }}
            onRoutinesAdded={(count) => showSuccess(t('today.routinesAdded', { count }))}
            onClose={() => setAddOpen(false)}
            onBusyChange={setAddBusy}
          />
        ) : null}
      </Modal>

      {toast ? <Toast message={toast.message} type={toast.type} onClose={closeToast} /> : null}
    </div>
  );
}
