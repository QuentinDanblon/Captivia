'use client';

import { guidePath } from '@/lib/guides';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Camera, FileText, Pencil, Scale, Trash2 } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError, type Animal, type Medication, type VetAppointment, type AnimalMeasurement, type Vaccination, type BreedingRecord } from '@/lib/api';
import { compressImageToDataUrl, isImageTooLargeError, isUnsupportedImageError } from '@/lib/image';
import { usePhotoPicker } from '@/components/usePhotoPicker';
import { Link } from '@/i18n/navigation';
import { currentMedications } from '@/lib/carnet';
import {
  ageOf,
  animalAlerts,
  commonName,
  daysFrom,
  formatAge,
  formatRelativeDays,
  formatWeight,
  lastWeighing,
  latinName,
  nextAppointment,
  sheetTimeline,
  speciesTip,
  weightTrend,
  type SpeciesSheet,
} from '@/lib/today';
import {
  Alert,
  AnimalSilhouette,
  Button,
  Card,
  CareTimeline,
  EmptyState,
  Figure,
  SectionHeader,
  Skeleton,
  SkeletonGroup,
  SkeletonText,
  Tip,
  Toast,
  buttonClasses,
  silhouetteKindOf,
} from '@/components/ui';
import FamilySection from './_components/FamilySection';
import SectionSkeleton from './_components/SectionSkeleton';
import { ConfirmDelete } from './_components/parts';
import type {
  Routine,
  HealthRecord,
  Species,
  SpeciesHealthData,
  SpeciesLegislationData,
  SpeciesEquipmentData,
  SpeciesFoodProduct,
} from './_components/types';
import { animalCarnetPath, speciesPath } from '@/lib/platform';
import { isGuestUser } from '@/lib/guest';
import { isGbifKey, sameName } from '@/lib/species';
import { GuestFeatureNote } from '@/components/guest/GuestFeatureNote';

// W4-07 — chaque section (et sa/ses modale(s)) est un chunk séparé, chargé à la demande.
// L'état des formulaires vit dans ces composants ; la page ne garde que les données partagées.
const SpeciesInfoTabs = dynamic(() => import('./_components/SpeciesInfoTabs'), {
  loading: () => <SectionSkeleton className="h-48" />,
});
const HealthRecordsSection = dynamic(() => import('./_components/HealthRecordsSection'), {
  loading: () => <SectionSkeleton />,
});
const ShareQrSection = dynamic(() => import('./_components/ShareQrSection'), {
  loading: () => <SectionSkeleton />,
});
const RoutinesSection = dynamic(() => import('./_components/RoutinesSection'), {
  loading: () => <SectionSkeleton />,
});
const MedicationsSection = dynamic(() => import('./_components/MedicationsSection'), {
  loading: () => <SectionSkeleton />,
});
const VetAppointmentsSection = dynamic(() => import('./_components/VetAppointmentsSection'), {
  loading: () => <SectionSkeleton />,
});
const MeasurementsSection = dynamic(() => import('./_components/MeasurementsSection'), {
  loading: () => <SectionSkeleton />,
});
const VaccinationsSection = dynamic(() => import('./_components/VaccinationsSection'), {
  loading: () => <SectionSkeleton />,
});
const BreedingSection = dynamic(() => import('./_components/BreedingSection'), {
  loading: () => <SectionSkeleton />,
});
const CarnetExportSection = dynamic(() => import('./_components/CarnetExportSection'), {
  loading: () => <SectionSkeleton className="h-24" />,
});
// Modale d'édition : montée (donc téléchargée) uniquement à l'ouverture.
const EditAnimalModal = dynamic(() => import('./_components/EditAnimalModal'));

/** 401 après refresh : la session est perdue (lib/api a déjà émis `auth:logout` si révoquée). */
const isSessionExpired = (err: unknown) => err instanceof ApiError && err.status === 401;
/** 403 : section réservée au Premium. */
const isForbidden = (err: unknown) => err instanceof ApiError && err.status === 403;

export default function AnimalDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const [resolvedParams, setResolvedParams] = useState<{
    locale: string;
    id: string;
  } | null>(null);
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [species, setSpecies] = useState<Species | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [speciesHealth, setSpeciesHealth] = useState<SpeciesHealthData | null>(null);
  const [speciesLegislation, setSpeciesLegislation] = useState<SpeciesLegislationData | null>(null);
  const [speciesEquipment, setSpeciesEquipment] = useState<SpeciesEquipmentData | null>(null);
  const [speciesFood, setSpeciesFood] = useState<SpeciesFoodProduct[]>([]);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [showEditAnimalModal, setShowEditAnimalModal] = useState(false);
  const [offspring, setOffspring] = useState<Animal[]>([]);
  const [avatarPhotoUploading, setAvatarPhotoUploading] = useState(false);
  // Données des sections (chargées ici, affichées/éditées par les composants dédiés)
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medicationsLoading, setMedicationsLoading] = useState(true);
  const [medicationsError, setMedicationsError] = useState('');
  const [medicationsLocked, setMedicationsLocked] = useState(false);
  const [vetAppointments, setVetAppointments] = useState<VetAppointment[]>([]);
  const [vetAppointmentsLoading, setVetAppointmentsLoading] = useState(true);
  const [vetAppointmentsError, setVetAppointmentsError] = useState('');
  const [measurements, setMeasurements] = useState<AnimalMeasurement[]>([]);
  const [measurementsLoading, setMeasurementsLoading] = useState(true);
  const [measurementsError, setMeasurementsError] = useState('');
  const [measurementsLocked, setMeasurementsLocked] = useState(false);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [vaccinationsLoading, setVaccinationsLoading] = useState(true);
  const [vaccinationsError, setVaccinationsError] = useState('');
  const [vaccinationsLocked, setVaccinationsLocked] = useState(false);
  const [breedingRecords, setBreedingRecords] = useState<BreedingRecord[]>([]);
  const [breedingLoading, setBreedingLoading] = useState(true);
  const [breedingError, setBreedingError] = useState('');
  const [breedingLocked, setBreedingLocked] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Interface : horloge figée au montage (statuts cohérents), demande « Peser » de la barre d'actions.
  const [now] = useState(() => new Date());
  const [measurementRequest, setMeasurementRequest] = useState(0);
  const closeToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && token && resolvedParams) {
      fetchAnimalData();
    }
    // Chargement à l'ouverture et au changement de session ou d'animal seulement : fetchAnimalData
    // est recréée à chaque rendu (pas de useCallback), l'ajouter relancerait la requête en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token, resolvedParams]);

  // Garde « cancelled » : chaque chargement porte un numéro ; un chargement dépassé (autre animal,
  // rechargement plus récent, démontage) n'écrit plus dans l'état de la fiche.
  const loadRef = useRef({ seq: 0, animalId: null as string | null });
  useEffect(() => {
    const load = loadRef.current;
    return () => {
      load.seq++;
    };
  }, []);

  const fetchAnimalData = async () => {
    if (!token || !resolvedParams) return;
    const load = loadRef.current;
    const seq = ++load.seq;
    const cancelled = () => seq !== load.seq;

    // Autre animal : on ne garde rien de la fiche précédente (espèce, conseils, matériel…).
    if (load.animalId !== resolvedParams.id) {
      load.animalId = resolvedParams.id;
      setAnimal(null);
      setSpecies(null);
      setSpeciesHealth(null);
      setSpeciesLegislation(null);
      setSpeciesEquipment(null);
      setSpeciesFood([]);
      setError(null);
    }

    try {
      // Fetch animal details
      const animalData = await api.getAnimal(resolvedParams.id, token);
      if (cancelled()) return;
      if (animalData.statusCode === 404 || animalData.error) {
        setError(t('animals.notFound'));
        setLoading(false);
        return;
      }
      setAnimal(animalData);

      // Fetch species info
      try {
        const speciesData = await api.getSpecies(animalData.speciesId.toString()) as Species;
        if (cancelled()) return;
        setSpecies(speciesData);

        // Fetch species health info
        try {
          const healthData = await api.getSpeciesHealth(animalData.speciesId, undefined, resolvedParams.locale);
          if (cancelled()) return;
          setSpeciesHealth(healthData as SpeciesHealthData);
        } catch (e) {
          if (cancelled()) return;
          setSpeciesHealth(null);
          console.error('Error fetching species health:', e);
        }

        // Fetch species legislation info (API returns { editorial: [{ country, status, details, sources }] })
        try {
          const legislationData = await api.getSpeciesLegislation(String(animalData.speciesId));
          if (cancelled()) return;
          setSpeciesLegislation(legislationData as SpeciesLegislationData);
        } catch (e) {
          if (cancelled()) return;
          setSpeciesLegislation(null);
          console.error('Error fetching species legislation:', e);
        }

        // Fetch species equipment recommendations
        try {
          const equipmentData = await api.getRecommendedEquipment(animalData.speciesId);
          if (cancelled()) return;
          setSpeciesEquipment(equipmentData as SpeciesEquipmentData);
        } catch (e) {
          if (cancelled()) return;
          setSpeciesEquipment(null);
          console.error('Error fetching species equipment:', e);
        }

        // Fetch species food recommendations
        try {
          const speciesName = speciesData.canonicalName || speciesData.scientificName;
          const foodData = await api.getFoodBySpecies(speciesName) as { products?: SpeciesFoodProduct[] };
          if (cancelled()) return;
          setSpeciesFood(foodData.products || []);
        } catch (e) {
          if (cancelled()) return;
          setSpeciesFood([]);
          console.error('Error fetching species food:', e);
        }
      } catch (e) {
        if (cancelled()) return;
        setSpecies(null);
        setSpeciesHealth(null);
        setSpeciesLegislation(null);
        setSpeciesEquipment(null);
        setSpeciesFood([]);
        console.error('Error fetching species:', e);
      }

      // Fetch routines
      try {
        const routinesData = await api.getAnimalRoutines(resolvedParams.id, token);
        if (cancelled()) return;
        setRoutines(Array.isArray(routinesData) ? routinesData : []);
      } catch (e) {
        console.error('Error fetching routines:', e);
      }

      // Fetch offspring (petits) — module F
      try {
        const kids = await api.getOffspring(resolvedParams.id, token);
        if (cancelled()) return;
        setOffspring(Array.isArray(kids) ? kids : []);
      } catch (e) {
        console.error('Error fetching offspring:', e);
      }

      // Session expirée : lib/api a déjà tenté le refresh et, si la session est révoquée, émis
      // `auth:logout` (AuthContext vide la session, la page redirige). Jamais de logout() ici :
      // un échec passager (BACKEND_UNAVAILABLE) ne doit pas révoquer la session.
      // 403 = fonctionnalité Premium verrouillée.

      // Fetch medications (traitements)
      try {
        const meds = await api.getMedications(resolvedParams.id, token);
        if (cancelled()) return;
        setMedications(Array.isArray(meds) ? meds : []);
        setMedicationsError('');
        setMedicationsLocked(false);
      } catch (e) {
        if (cancelled()) return;
        console.error('Error fetching medications:', e);
        if (isSessionExpired(e)) return;
        if (isForbidden(e)) {
          setMedicationsLocked(true);
        } else {
          setMedicationsError(t('animals.sectionErrors.loadFailed'));
        }
      } finally {
        if (!cancelled()) setMedicationsLoading(false);
      }

      // Fetch vet appointments (RDV vétérinaires)
      try {
        const vets = await api.getVetAppointments(resolvedParams.id, token);
        if (cancelled()) return;
        setVetAppointments(Array.isArray(vets) ? vets : []);
        setVetAppointmentsError('');
      } catch (e) {
        if (cancelled()) return;
        console.error('Error fetching vet appointments:', e);
        if (isSessionExpired(e)) return;
        setVetAppointmentsError(t('animals.sectionErrors.loadFailed'));
      } finally {
        if (!cancelled()) setVetAppointmentsLoading(false);
      }

      // Fetch health records (carnet de santé)
      try {
        const records = await api.getAnimalHealthRecords(resolvedParams.id, token);
        if (cancelled()) return;
        setHealthRecords(Array.isArray(records) ? records : []);
      } catch {
        if (cancelled()) return;
        setHealthRecords([]);
      }

      // Fetch measurements (poids & mesures)
      try {
        const measures = await api.getMeasurements(resolvedParams.id, token);
        if (cancelled()) return;
        setMeasurements(Array.isArray(measures) ? measures : []);
        setMeasurementsError('');
        setMeasurementsLocked(false);
      } catch (e) {
        if (cancelled()) return;
        console.error('Error fetching measurements:', e);
        if (isSessionExpired(e)) return;
        if (isForbidden(e)) {
          setMeasurementsLocked(true);
        } else {
          setMeasurementsError(t('animals.sectionErrors.loadFailed'));
        }
      } finally {
        if (!cancelled()) setMeasurementsLoading(false);
      }

      // Fetch vaccinations
      try {
        const vacs = await api.getVaccinations(resolvedParams.id, token);
        if (cancelled()) return;
        setVaccinations(Array.isArray(vacs) ? vacs : []);
        setVaccinationsError('');
        setVaccinationsLocked(false);
      } catch (e) {
        if (cancelled()) return;
        console.error('Error fetching vaccinations:', e);
        if (isSessionExpired(e)) return;
        if (isForbidden(e)) {
          setVaccinationsLocked(true);
        } else {
          setVaccinationsError(t('animals.sectionErrors.loadFailed'));
        }
      } finally {
        if (!cancelled()) setVaccinationsLoading(false);
      }

      // Fetch breeding records (reproduction)
      try {
        const recs = await api.getBreedingRecords(resolvedParams.id, token);
        if (cancelled()) return;
        setBreedingRecords(Array.isArray(recs) ? recs : []);
        setBreedingError('');
        setBreedingLocked(false);
      } catch (e) {
        if (cancelled()) return;
        console.error('Error fetching breeding records:', e);
        if (isSessionExpired(e)) return;
        if (isForbidden(e)) {
          setBreedingLocked(true);
        } else if (e instanceof ApiError && e.status === 404) {
          // Module non encore déployé côté backend : traiter comme liste vide
          setBreedingRecords([]);
          setBreedingError('');
        } else {
          setBreedingError(t('animals.sectionErrors.loadFailed'));
        }
      } finally {
        if (!cancelled()) setBreedingLoading(false);
      }
    } catch (error) {
      if (cancelled()) return;
      if (isSessionExpired(error)) return;
      console.error('Error fetching animal:', error);
      setError(t('animals.errorLoadingAnimal'));
    } finally {
      if (!cancelled()) setLoading(false);
    }
  };

  const getSexName = (sex?: string): string => {
    if (!sex) return t('animals.unknown');
    const sexes: Record<string, string> = {
      male: t('animals.male'),
      female: t('animals.female'),
      unknown: t('animals.unknown'),
    };
    return sexes[sex] || sex;
  };

  const handleDeleteAnimal = async () => {
    if (!animal || !token) return;
    
    setIsDeleting(true);
    try {
      await api.deleteAnimal(animal.id, token);
      router.push('/mes-animaux');
    } catch (err) {
      console.error('Error deleting animal:', err);
      setError(t('animals.errorDeleting'));
      setShowDeleteConfirm(false);
      setIsDeleting(false);
    }
  };

  const handleAvatarPhotoFile = async (file: Blob) => {
    if (!animal || !token) return;
    setAvatarPhotoUploading(true);
    try {
      // W4-07 : réduction sur l'appareil (600 px max, ~100 Ko, WebP ou JPEG), refus > 30 Mo
      const dataUrl = await compressImageToDataUrl(file);
      await api.updateAnimal(animal.id, { photos: [dataUrl] }, token);
      await fetchAnimalData();
    } catch (err) {
      if (isImageTooLargeError(err)) {
        setToast(t('animals.photoTooLarge'));
      } else if (isUnsupportedImageError(err)) {
        setToast(t('animals.photoUnsupported'));
      } else {
        console.error('Error updating avatar photo:', err);
        setToast(t('animals.errorAdding'));
      }
    } finally {
      setAvatarPhotoUploading(false);
    }
  };
  // Web : sélecteur de fichier ; app native : appareil photo ou galerie (W6-05).
  const { inputRef: avatarPhotoInputRef, open: openAvatarPhotoPicker, onChange: onAvatarPhotoInputChange } = usePhotoPicker({ onFile: handleAvatarPhotoFile, onError: setToast });

  if (authLoading || loading || !resolvedParams) {
    return (
      <div className="cv-container py-6 sm:py-8">
        <SkeletonGroup label={t('animals.sheet.loading')} className="grid gap-6">
          <Skeleton width={180} />
          <div className="grid gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
            <Skeleton shape="block" height={180} />
            <div className="grid content-start gap-3">
              <Skeleton width="45%" height={40} />
              <Skeleton width="30%" height={22} />
              <Skeleton shape="block" height={84} className="mt-4" />
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-12">
            <Skeleton shape="block" height={280} className="lg:col-span-7" />
            <Skeleton shape="block" height={280} className="lg:col-span-5" />
          </div>
        </SkeletonGroup>
      </div>
    );
  }

  if (error || !animal) {
    return (
      <div className="cv-container grid gap-6 py-6 sm:py-8">
        <EmptyState
          size="page"
          headingLevel={1}
          title={error || t('animals.notFound')}
          benefit={t('animals.sheet.errorBenefit')}
          illustration={<AnimalSilhouette kind="other" size={72} />}
          action={
            <Link href="/mes-animaux" className={buttonClasses({ variant: 'secondary' })}>
              {t('animals.sheet.back')}
            </Link>
          }
        />
      </div>
    );
  }

  const sheet = species as (Species & SpeciesSheet) | null;
  const latin = latinName(sheet);
  const common = commonName(sheet, resolvedParams.locale);
  const kind = silhouetteKindOf(sheet?.class);
  const age = ageOf(animal.birthDate, now);
  const weighing = lastWeighing(measurements);
  const trend = weightTrend(measurements);
  const appointment = nextAppointment(vetAppointments, now);
  const treatments = currentMedications(medications, now);
  const nextVaccine = vaccinations
    .filter((v) => v.nextDueDate)
    .sort((a, b) => new Date(a.nextDueDate as string).getTime() - new Date(b.nextDueDate as string).getTime())
    .find((v) => daysFrom(v.nextDueDate as string, now) >= -365);
  const alerts = animalAlerts(
    {
      animal,
      vaccinations: vaccinationsLoading || vaccinationsLocked || vaccinationsError ? null : vaccinations,
      medications: medicationsLoading || medicationsLocked || medicationsError ? null : medications,
      measurements: measurementsLoading || measurementsLocked || measurementsError ? null : measurements,
    },
    now,
  ).filter((a) => a.level !== 'info' || a.kind === 'treatment');
  const tip = speciesTip(sheet, speciesHealth, resolvedParams.locale);
  const locale = resolvedParams.locale;
  const timeline = sheetTimeline({ vetAppointments, vaccinations, measurements, healthRecords, medications }, now, (kg) => formatWeight(kg, locale));
  const dateFormat = new Intl.DateTimeFormat(resolvedParams.locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const shortDate = new Intl.DateTimeFormat(resolvedParams.locale, { day: '2-digit', month: 'short' });
  const longDate = new Intl.DateTimeFormat(resolvedParams.locale, { day: 'numeric', month: 'long' });
  const dateTime = new Intl.DateTimeFormat(resolvedParams.locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const pending = <Skeleton width="60%" />;

  const statusLabels = {
    done: t('today.status.done'),
    due: t('today.status.due'),
    overdue: t('today.status.overdue'),
    planned: t('today.status.planned'),
    skipped: t('today.status.skipped'),
  };

  const summary: { key: string; label: string; value: ReactNode; note?: ReactNode }[] = [
    {
      key: 'age',
      label: t('today.factAge'),
      value: age ? formatAge(age, locale) : t('animals.sheet.unknownValue'),
      note: animal.birthDate ? t('animals.sheet.bornOn', { date: dateFormat.format(new Date(animal.birthDate)) }) : getSexName(animal.sex),
    },
    {
      key: 'weight',
      label: t('today.factWeight'),
      value: measurementsLoading ? pending : weighing ? formatWeight(weighing.weightKg, locale) : t('today.factNoWeight'),
      note: weighing ? (
        <>
          {formatRelativeDays(daysFrom(weighing.measuredAt, now), locale)}
          {trend !== null && trend !== 0 ? <> · {formatWeight(trend, locale, true)}</> : null}
        </>
      ) : undefined,
    },
    {
      key: 'visit',
      label: t('today.factNextVisit'),
      value: vetAppointmentsLoading ? pending : appointment ? dateTime.format(new Date(appointment.date)) : t('today.factNoVisit'),
      note: appointment ? [appointment.vetName, appointment.reason].filter(Boolean).join(' · ') : undefined,
    },
    {
      key: 'treatment',
      label: t('animals.sheet.treatments'),
      value: medicationsLoading
        ? pending
        : medicationsLocked
          ? '—'
          : treatments.length > 0
            ? treatments.map((m) => m.name).join(', ')
            : t('animals.sheet.noTreatment'),
      note:
        treatments.length === 1 && treatments[0].endDate
          ? t('animals.sheet.until', { date: shortDate.format(new Date(treatments[0].endDate)) })
          : undefined,
    },
    {
      key: 'vaccine',
      label: t('animals.sheet.nextVaccine'),
      value: vaccinationsLoading ? pending : nextVaccine?.nextDueDate ? shortDate.format(new Date(nextVaccine.nextDueDate)) : t('animals.sheet.noVaccine'),
      note: nextVaccine?.nextDueDate ? (
        <>
          {nextVaccine.name} · {formatRelativeDays(daysFrom(nextVaccine.nextDueDate, now), locale)}
        </>
      ) : undefined,
    },
  ];

  const sections = [
    ['soins', t('routines.title')],
    ['traitements', t('animals.medications.title')],
    ['mesures', t('animals.measurements.title')],
    ['vaccins', t('animals.vaccinations.title')],
    ['rendez-vous', t('animals.vetAppointments.title')],
    ['sante', t('animals.healthRecord')],
    ['espece', t('animals.sheet.speciesTitle')],
  ] as const;

  return (
    <div className="cv-container grid gap-6 py-6 pb-44 sm:py-8 sm:pb-44 lg:pb-8">
      <nav aria-label={t('animals.sheet.breadcrumb')} className="text-ui text-ink-2">
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
          <li>
            <Link href="/mes-animaux" className="text-ink-2 underline decoration-1 underline-offset-2 hover:text-ink">
              {t('animals.myAnimals')}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            {animal.name}
          </li>
        </ol>
      </nav>

      {/* En-tête « planche » : photo, nom, binôme latin, âge, poids. */}
      <header className="grid gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:items-start">
        <div className="grid max-w-[15rem] gap-2">
          {animal.photos?.[0] ? (
            <Figure src={animal.photos[0]} alt={t('today.photoAlt', { name: animal.name })} userPhoto ratio="4/3" priority sizes="15rem" fallbackKind={kind} />
          ) : (
            <Figure ratio="4/3" fallbackKind={kind} />
          )}
          <input ref={avatarPhotoInputRef} type="file" accept="image/*" className="hidden" tabIndex={-1} aria-hidden onChange={onAvatarPhotoInputChange} />
          <Button
            variant="quiet"
            size="sm"
            className="justify-self-start"
            onClick={() => void openAvatarPhotoPicker()}
            loading={avatarPhotoUploading}
            iconStart={<Camera size={16} strokeWidth={1.75} />}
          >
            {t('animals.changePhoto')}
          </Button>
        </div>

        <div className="grid min-w-0 gap-5">
          <SectionHeader
            title={animal.name}
            latin={latin ? <Link href={speciesPath(animal.speciesId)} className="text-ink-2 no-underline hover:underline">{latin}</Link> : undefined}
            // Race : identifiant interne (hors GBIF), aucun « GBIF n° » ; nom courant non répété.
            marginNote={isGbifKey(animal.speciesId) ? `GBIF ${animal.speciesId}` : undefined}
            marginLabel={t('animals.sheet.gbifLabel')}
            description={[sameName(common, latin) ? undefined : common, getSexName(animal.sex)].filter(Boolean).join(' · ')}
            actions={
              <div className="hidden flex-wrap gap-2 lg:flex">
                <Link href={animalCarnetPath(animal.id)} className={buttonClasses({ variant: 'secondary' })}>
                  <FileText size={18} strokeWidth={1.75} aria-hidden="true" />
                  {t('carnetPrint.title')}
                </Link>
                <Link href={speciesPath(animal.speciesId)} className={buttonClasses({ variant: 'primary' })}>
                  {t('animals.sheet.speciesGuide')}
                </Link>
                <Button variant="secondary" onClick={() => setShowEditAnimalModal(true)} iconStart={<Pencil size={18} strokeWidth={1.75} />}>
                  {t('animals.editAnimal')}
                </Button>
                <Button
                  variant="quiet"
                  className="text-danger hover:not-disabled:bg-danger-soft"
                  onClick={() => setShowDeleteConfirm(true)}
                  aria-label={t('animals.deleteAnimal')}
                  title={t('animals.deleteAnimal')}
                >
                  <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
                </Button>
              </div>
            }
          />

          {/* Bandeau de synthèse : visible sans défiler en bureau. */}
          <section aria-labelledby="summary-title" className="rounded-card border border-line bg-surface">
            <h2 id="summary-title" className="sr-only">
              {t('animals.sheet.summaryTitle')}
            </h2>
            <dl className="m-0 grid grid-cols-2 divide-line sm:grid-cols-3 xl:grid-cols-5 xl:divide-x">
              {summary.map((item) => (
                <div key={item.key} className="grid content-start gap-1 border-b border-line px-4 py-3 last:border-b-0 xl:border-b-0">
                  <dt className="text-meta text-ink-2">{item.label}</dt>
                  <dd className="m-0 font-mono text-body font-medium break-words text-ink">{item.value}</dd>
                  {item.note ? <dd className="m-0 text-meta text-ink-2">{item.note}</dd> : null}
                </div>
              ))}
            </dl>
          </section>
        </div>
      </header>

      {alerts.length > 0 ? (
        <ul className="m-0 grid list-none gap-2 p-0" aria-label={t('today.alertsTitle')}>
          {alerts.slice(0, 3).map((alert) => {
            const when = alert.days !== undefined ? formatRelativeDays(alert.days, locale) : '';
            const values = { name: alert.animalName, subject: alert.subject ?? '', when, date: alert.date ? longDate.format(new Date(alert.date)) : '' };
            const key = alert.kind === 'treatment' && !alert.date ? 'treatmentOpen' : alert.kind === 'weighingStale' ? 'weighingOld' : alert.kind;
            return (
              <li key={`${alert.kind}-${alert.subject ?? ''}`}>
                <Alert
                  severity={alert.level === 'urgent' ? 'urgent' : alert.level === 'warning' ? 'warning' : 'info'}
                  severityLabel={alert.level === 'urgent' ? t('today.urgent') : undefined}
                  title={t(`today.alerts.${key}.title`, values)}
                >
                  {t(`today.alerts.${key}.body`, values)}
                </Alert>
              </li>
            );
          })}
        </ul>
      ) : null}

      <nav aria-label={t('animals.sheet.sectionsNav')} className="noprint -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="m-0 flex w-max list-none gap-1 border-b border-line p-0">
          {sections.map(([id, label]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-ui font-medium whitespace-nowrap text-ink-2 no-underline transition-colors hover:border-line-field hover:text-ink"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="grid min-w-0 content-start gap-6 lg:col-span-7">
          <Card as="section" title={t('animals.sheet.timelineTitle')} titleId="sheet-timeline-title">
            {timeline.length === 0 ? (
              <p className="m-0 text-body text-ink-2">{t('animals.sheet.timelineEmpty')}</p>
            ) : (
              <CareTimeline
                label={t('animals.sheet.timelineLabel', { name: animal.name })}
                statusLabels={statusLabels}
                allDayLabel={t('today.allDayShort')}
                items={timeline.map((entry) => ({
                  id: entry.id,
                  date: entry.date,
                  allDay: entry.allDay,
                  title: entry.title,
                  detail: entry.detail,
                  status: entry.status,
                  kind: t(`animals.sheet.kinds.${entry.kind}`),
                }))}
              />
            )}
          </Card>
          <RoutinesSection animal={animal} token={token} routines={routines} onRefresh={fetchAnimalData} onToast={setToast} />
          <MedicationsSection
            animal={animal}
            token={token}
            medications={medications}
            loading={medicationsLoading}
            error={medicationsError}
            locked={medicationsLocked}
            onLocked={() => setMedicationsLocked(true)}
            onRefresh={fetchAnimalData}
          />
          <MeasurementsSection
            animal={animal}
            token={token}
            measurements={measurements}
            loading={measurementsLoading}
            error={measurementsError}
            locked={measurementsLocked}
            onLocked={() => setMeasurementsLocked(true)}
            onRefresh={fetchAnimalData}
            createRequest={measurementRequest}
          />
          <VaccinationsSection
            animal={animal}
            token={token}
            vaccinations={vaccinations}
            loading={vaccinationsLoading}
            error={vaccinationsError}
            locked={vaccinationsLocked}
            onLocked={() => setVaccinationsLocked(true)}
            onRefresh={fetchAnimalData}
          />
          <VetAppointmentsSection
            animal={animal}
            token={token}
            vetAppointments={vetAppointments}
            loading={vetAppointmentsLoading}
            error={vetAppointmentsError}
            onRefresh={fetchAnimalData}
          />
          <HealthRecordsSection animal={animal} token={token} healthRecords={healthRecords} onRefresh={fetchAnimalData} />
          <BreedingSection
            animal={animal}
            token={token}
            breedingRecords={breedingRecords}
            loading={breedingLoading}
            error={breedingError}
            locked={breedingLocked}
            onLocked={() => setBreedingLocked(true)}
            onRefresh={fetchAnimalData}
          />
        </div>

        <div className="grid min-w-0 content-start gap-6 lg:col-span-5">
          <Card as="section" title={t('species.careAdvice')} titleId="care-advice-title">
            {species ? (
              <div className="grid gap-4">
                {tip ? (
                  <Tip label={t('today.tipLabel')} source={t('today.tipSource', { species: common ?? latin ?? '' })}>
                    {tip.kind === 'prevention'
                      ? t('today.tipPrevention', { topic: tip.topic, text: tip.text })
                      : tip.temperature && tip.humidity
                        ? t('today.tipHabitat', { temperature: tip.temperature, humidity: tip.humidity })
                        : tip.temperature
                          ? t('today.tipTemperature', { temperature: tip.temperature })
                          : t('today.tipHumidity', { humidity: tip.humidity ?? '' })}
                  </Tip>
                ) : (
                  <ul className="m-0 grid gap-1.5 pl-5 text-ui text-ink">
                    <li>{t('animals.defaultCareTips.environment')}</li>
                    <li>{t('animals.defaultCareTips.feeding')}</li>
                    <li>{t('animals.defaultCareTips.equipment')}</li>
                    <li>{t('animals.defaultCareTips.illness')}</li>
                  </ul>
                )}
                <Link href={guidePath(animal.speciesId)} className={buttonClasses({ variant: 'secondary', className: 'justify-self-start' })}>{t('guides.open')}</Link>
                <Link href={speciesPath(animal.speciesId)} className={buttonClasses({ variant: 'quiet', size: 'sm', className: 'justify-self-start' })}>
                  {t('species.viewFullGuide')}
                </Link>
              </div>
            ) : (
              <SkeletonGroup label={t('common.loading')}>
                <SkeletonText lines={3} />
              </SkeletonGroup>
            )}
          </Card>

          {animal.notes ? (
            <Card as="section" title={t('animals.notes')} titleId="notes-title">
              <p className="m-0 text-body whitespace-pre-wrap text-ink">{animal.notes}</p>
            </Card>
          ) : null}

          <SpeciesInfoTabs
            speciesHealth={speciesHealth}
            speciesLegislation={speciesLegislation}
            speciesEquipment={speciesEquipment}
            speciesFood={speciesFood}
          />
          <FamilySection animal={animal} offspring={offspring} />
          <CarnetExportSection animal={animal} token={token} onToast={setToast} />
          {/* Invité : la page publique (QR) demande un compte — action retirée, raison expliquée. */}
          {isGuestUser(user) ? (
            <GuestFeatureNote>{t('guest.publicLinkNote')}</GuestFeatureNote>
          ) : (
            <ShareQrSection animal={animal} token={token} locale={resolvedParams.locale} />
          )}
        </div>
      </div>

      {/* Barre d'actions collante (mobile et tablette) : au-dessus de la barre d'onglets. */}
      <div
        role="toolbar"
        aria-label={t('animals.sheet.actionsLabel', { name: animal.name })}
        className="noprint fixed inset-x-0 z-20 grid grid-cols-2 gap-2 border-t border-line-strong bg-paper px-[max(var(--gutter,16px),env(safe-area-inset-left,0px))] py-2 lg:hidden bottom-[calc(var(--tabbar-h,60px)+env(safe-area-inset-bottom,0px))]"
      >
        <Link href={animalCarnetPath(animal.id)} className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'min-h-11 min-w-0 whitespace-normal text-center' })}>
          {t('animals.sheet.carnetShort')}
        </Link>
        <Link href={speciesPath(animal.speciesId)} className={buttonClasses({ variant: 'primary', size: 'sm', className: 'min-h-11 min-w-0 whitespace-normal text-center' })}>
          {t('animals.sheet.speciesGuide')}
        </Link>
        <div className="col-span-2 flex gap-2">
          {!measurementsLocked ? (
            <Button variant="secondary" className="flex-1" onClick={() => setMeasurementRequest((n) => n + 1)} iconStart={<Scale size={18} strokeWidth={1.75} />}>
              {t('animals.sheet.weigh')}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => setShowEditAnimalModal(true)} aria-label={t('animals.editAnimal')} title={t('animals.editAnimal')}>
            <Pencil size={18} strokeWidth={1.75} aria-hidden="true" />
          </Button>
          <Button
            variant="secondary"
            className="text-danger"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label={t('animals.deleteAnimal')}
            title={t('animals.deleteAnimal')}
          >
            <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Edit Animal Modal */}
      {showEditAnimalModal && (
        <EditAnimalModal animal={animal} token={token} onClose={() => setShowEditAnimalModal(false)} onRefresh={fetchAnimalData} />
      )}

      {toast ? <Toast message={toast} onClose={closeToast} /> : null}

      <ConfirmDelete
        open={showDeleteConfirm}
        title={t('animals.deleteAnimal')}
        message={t('common.confirmDelete')}
        busy={isDeleting}
        onConfirm={handleDeleteAnimal}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
