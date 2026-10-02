'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError, type Animal, type Medication, type VetAppointment, type AnimalMeasurement, type Vaccination, type BreedingRecord } from '@/lib/api';
import { compressImageToDataUrl, isImageTooLargeError } from '@/lib/image';
import { Link } from '@/i18n/navigation';
import FamilySection from './_components/FamilySection';
import SectionSkeleton from './_components/SectionSkeleton';
import { useFormatters } from './_components/useFormatters';
import type {
  Routine,
  HealthRecord,
  Species,
  SpeciesHealthData,
  SpeciesLegislationData,
  SpeciesEquipmentData,
  SpeciesFoodProduct,
} from './_components/types';
import { speciesPath } from '@/lib/platform';

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
  const { formatDate } = useFormatters();
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
  const avatarPhotoInputRef = useRef<HTMLInputElement>(null);
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
  }, [user, token, resolvedParams]);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

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

  const handleAvatarPhotoClick = () => {
    avatarPhotoInputRef.current?.click();
  };

  const handleAvatarPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !animal || !token) {
      e.target.value = '';
      return;
    }
    setAvatarPhotoUploading(true);
    try {
      // W4-07 : redimensionnement (1600 px max) + JPEG 0.82 côté client, refus > 10 Mo
      const dataUrl = await compressImageToDataUrl(file);
      await api.updateAnimal(animal.id, { photos: [dataUrl] }, token);
      await fetchAnimalData();
    } catch (err) {
      if (isImageTooLargeError(err)) {
        setToast(t('animals.photoTooLarge'));
      } else {
        console.error('Error updating avatar photo:', err);
      }
    } finally {
      setAvatarPhotoUploading(false);
      e.target.value = '';
    }
  };

  if (authLoading || loading || !resolvedParams) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">
            {t('common.loading')}
          </p>
        </div>
      </div>
    );
  }

  if (error || !animal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-4">
            {error || t('animals.notFound')}
          </p>
          <Link
            href="/mes-animaux"
            className="text-emerald-600 hover:text-emerald-700"
          >
            {t('common.back')} {t('common.myAnimals')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Breadcrumb */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 min-w-0">
        <nav className="text-sm text-gray-500">
          <Link href="/mes-animaux" className="hover:text-emerald-600">
            {t('animals.myAnimals')}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-800 dark:text-white">{animal.name}</span>
        </nav>
      </div>

      {/* Animal Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-6 sm:py-8">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 min-w-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 flex-1 min-w-0">
              <input
                ref={avatarPhotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-hidden
                onChange={handleAvatarPhotoFile}
              />
              <button
                type="button"
                onClick={handleAvatarPhotoClick}
                disabled={avatarPhotoUploading}
                className="w-20 h-20 sm:w-24 sm:h-24 bg-white/20 rounded-full flex items-center justify-center text-3xl sm:text-4xl font-bold shrink-0 overflow-hidden ring-2 ring-white/30 hover:ring-white/50 hover:bg-white/25 transition-all disabled:opacity-70 cursor-pointer"
                title={t('animals.changePhoto')}
              >
                {avatarPhotoUploading ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
                ) : animal.photos?.[0] ? (
                  <img
                    src={animal.photos[0]}
                    alt={animal.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  animal.name.charAt(0).toUpperCase()
                )}
              </button>
              <div className="text-center sm:text-left">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">{animal.name}</h1>
                {species && (
                  <Link 
                    href={speciesPath(animal.speciesId)}
                    className="text-lg opacity-90 hover:opacity-100 hover:underline"
                  >
                    {species.canonicalName || species.scientificName}
                  </Link>
                )}
                <div className="flex gap-4 mt-2 text-sm opacity-80">
                  {animal.birthDate && (
                    <span>{t('animals.birthDate')}: {formatDate(animal.birthDate)}</span>
                  )}
                  <span>{t('animals.sex')}: {getSexName(animal.sex)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowEditAnimalModal(true)}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {t('animals.editAnimal')}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <FamilySection animal={animal} offspring={offspring} />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Care advice block */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                {t('species.careAdvice')}
              </h2>
              
              {species ? (
                <div className="space-y-4">
                  <p className="text-gray-600 dark:text-gray-400">
                    Conseils de soins pour votre {species.canonicalName || species.scientificName} :
                  </p>
                  
                  {speciesHealth?.editorial?.diseases && speciesHealth.editorial.diseases.length > 0 ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold text-gray-800 dark:text-white mb-2">
                          {t('species.commonDiseases')}
                        </h3>
                        <ul className="space-y-2">
                          {speciesHealth.editorial.diseases.map((disease, idx: number) => (
                            <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">
                              <strong>{disease.name}</strong>
                              {disease.symptoms && ` - ${disease.symptoms}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      {speciesHealth.editorial.diseases[0]?.prevention && (
                        <div>
                          <h3 className="font-semibold text-gray-800 dark:text-white mb-2">
                            {t('species.prevention')}
                          </h3>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {speciesHealth.editorial.diseases[0].prevention}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                      <li>{t('animals.defaultCareTips.environment')}</li>
                      <li>{t('animals.defaultCareTips.feeding')}</li>
                      <li>{t('animals.defaultCareTips.equipment')}</li>
                      <li>{t('animals.defaultCareTips.illness')}</li>
                    </ul>
                  )}
                  
                  <Link
                    href={speciesPath(animal.speciesId)}
                    className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium mt-4"
                  >
                    {t('species.viewFullGuide')}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">
                  {t('common.loading')}
                </p>
              )}
            </div>

            {/* Notes */}
            {animal.notes && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
                  {t('animals.notes')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {animal.notes}
                </p>
              </div>
            )}

            {/* Species Information Tabs */}
            <SpeciesInfoTabs
              speciesHealth={speciesHealth}
              speciesLegislation={speciesLegislation}
              speciesEquipment={speciesEquipment}
              speciesFood={speciesFood}
            />
          </div>

          {/* Sidebar - Carnet de santé + Routines */}
          <div className="space-y-6">
            <HealthRecordsSection animal={animal} token={token} healthRecords={healthRecords} onRefresh={fetchAnimalData} />
            <ShareQrSection animal={animal} token={token} locale={resolvedParams.locale} />
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
            <VetAppointmentsSection
              animal={animal}
              token={token}
              vetAppointments={vetAppointments}
              loading={vetAppointmentsLoading}
              error={vetAppointmentsError}
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
            <CarnetExportSection animal={animal} token={token} onToast={setToast} />
          </div>
        </div>
      </div>

      {/* Edit Animal Modal */}
      {showEditAnimalModal && (
        <EditAnimalModal
          animal={animal}
          token={token}
          onClose={() => setShowEditAnimalModal(false)}
          onRefresh={fetchAnimalData}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-lg shadow-lg text-sm font-medium bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900"
          role="alert"
        >
          {toast}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-[384px] w-full">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
              {t('animals.deleteAnimal')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('common.confirmDelete')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteAnimal}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    {t('common.loading')}
                  </>
                ) : (
                  t('animals.deleteAnimal')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
