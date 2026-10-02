'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, type Animal, type Medication, type VetAppointment, type AnimalMeasurement, type Vaccination, type BreedingRecord, type SpeciesRoutineTemplate } from '@/lib/api';
import WeightChart from '@/components/WeightChart';
import Link from 'next/link';

interface RoutineSchedule {
  time?: string;
  recurrence?: string;
  date?: string;
  weekDay?: number;
  dayOfMonth?: number;
  intervalHours?: number;
}

interface HistoryEntry {
  id: string;
  type: string;
  doneAt: string;
  note?: string | null;
}

interface SpeciesDisease {
  name: string;
  symptoms?: string;
  prevention?: string;
  whenToConsult?: string;
}

interface SpeciesHealthData {
  editorial?: { diseases?: SpeciesDisease[] };
}

interface SpeciesLegislationItem {
  country: string;
  status: string;
  details?: { citesAppendix?: string | null; euAnnex?: string | null; permits?: string[]; restrictions?: string[] };
  sources?: string[];
}

interface SpeciesLegislationData {
  editorial?: SpeciesLegislationItem[];
}

interface EquipmentRecommendation {
  label: string;
  category?: string;
  size?: string;
}

interface SpeciesEquipmentData {
  recommendations?: EquipmentRecommendation[];
}

interface SpeciesFoodProduct {
  product_name?: string;
  name?: string;
  brands?: string;
  categories?: string;
}

interface Routine {
  id: string;
  name?: string;
  type: string;
  frequency: string;
  schedule: RoutineSchedule;
  active: boolean;
}

interface HealthRecord {
  id: string;
  type: string;
  title: string;
  date: string;
  notes?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

interface Species {
  key: number;
  scientificName: string;
  canonicalName?: string;
  vernacularName?: string;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
}

/** Select personnalisé « Père / Mère » : nom + photo miniature, option « Aucun » (module F). */
function ParentSelect({
  label,
  value,
  onChange,
  candidates,
  noneLabel,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  candidates: Animal[];
  noneLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = candidates.find((c) => c.id === value) || null;
  return (
    <div className="space-y-1.5 relative">
      <label className="block text-base font-semibold text-gray-900 dark:text-white">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-left text-base text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      >
        {selected ? (
          <>
            {selected.photos?.[0] ? (
              <img src={selected.photos[0]} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
            ) : (
              <span className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 flex items-center justify-center text-xs font-bold shrink-0">
                {selected.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">{noneLabel}</span>
        )}
        <svg className="w-4 h-4 ml-auto shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[110]" onClick={() => setOpen(false)} />
          <div className="absolute z-[120] mt-1 w-full max-h-56 overflow-y-auto rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              {noneLabel}
            </button>
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                {c.photos?.[0] ? (
                  <img src={c.photos[0]} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 flex items-center justify-center text-xs font-bold shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AnimalDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { user, token, isLoading: authLoading, logout } = useAuth();
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
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [routineName, setRoutineName] = useState('');
  const [routineType, setRoutineType] = useState('nourrissage');
  const [routineFrequency, setRoutineFrequency] = useState('daily');
  const [routineTime, setRoutineTime] = useState('08:00');
  const [routineDate, setRoutineDate] = useState('');
  const [routineWeekDay, setRoutineWeekDay] = useState(1);
  const [routineDayOfMonth, setRoutineDayOfMonth] = useState(1);
  const [routineIntervalHours, setRoutineIntervalHours] = useState(2);
  const [routineActive, setRoutineActive] = useState(true);
  const [isCreatingRoutine, setIsCreatingRoutine] = useState(false);
  const [routineError, setRoutineError] = useState('');
  const [showDeleteRoutineConfirm, setShowDeleteRoutineConfirm] = useState(false);
  const [routineToDelete, setRoutineToDelete] = useState<string | null>(null);
  const [isDeletingRoutine, setIsDeletingRoutine] = useState(false);

  // Modèles de routines de l'espèce (module D)
  const [routineTemplates, setRoutineTemplates] = useState<SpeciesRoutineTemplate[]>([]);
  const [showRoutineTemplates, setShowRoutineTemplates] = useState(false);
  const [routineTemplatesLoading, setRoutineTemplatesLoading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [speciesHealth, setSpeciesHealth] = useState<SpeciesHealthData | null>(null);
  const [speciesLegislation, setSpeciesLegislation] = useState<SpeciesLegislationData | null>(null);
  const [speciesEquipment, setSpeciesEquipment] = useState<SpeciesEquipmentData | null>(null);
  const [speciesFood, setSpeciesFood] = useState<SpeciesFoodProduct[]>([]);
  const [activeTab, setActiveTab] = useState('health');
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [editingHealthId, setEditingHealthId] = useState<string | null>(null);
  const [healthFormType, setHealthFormType] = useState<string>('vaccine');
  const [healthFormTitle, setHealthFormTitle] = useState('');
  const [healthFormDate, setHealthFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [healthFormNotes, setHealthFormNotes] = useState('');
  const [healthError, setHealthError] = useState('');
  const [healthSubmitting, setHealthSubmitting] = useState(false);
  const [healthDeletingId, setHealthDeletingId] = useState<string | null>(null);
  const [healthRecordToDelete, setHealthRecordToDelete] = useState<string | null>(null);
  const [showDeleteHealthConfirm, setShowDeleteHealthConfirm] = useState(false);
  const [showEditAnimalModal, setShowEditAnimalModal] = useState(false);
  const [editAnimalName, setEditAnimalName] = useState('');
  const [editAnimalBirthDate, setEditAnimalBirthDate] = useState('');
  const [editAnimalSex, setEditAnimalSex] = useState('');
  const [editAnimalNotes, setEditAnimalNotes] = useState('');
  const [editAnimalProfilePhotoUrl, setEditAnimalProfilePhotoUrl] = useState('');
  const [editAnimalSubmitting, setEditAnimalSubmitting] = useState(false);
  const [editAnimalError, setEditAnimalError] = useState('');
  // Parenté & groupe (module F)
  const [editFatherId, setEditFatherId] = useState('');
  const [editMotherId, setEditMotherId] = useState('');
  const [editGroupName, setEditGroupName] = useState('');
  const [candidateAnimals, setCandidateAnimals] = useState<Animal[]>([]);
  const [offspring, setOffspring] = useState<Animal[]>([]);
  const [avatarPhotoUploading, setAvatarPhotoUploading] = useState(false);
  const avatarPhotoInputRef = useRef<HTMLInputElement>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState('');
  // W0-06 — partage public (QR) en opt-in ; l'URL est construite par le backend
  const [publicLink, setPublicLink] = useState<Awaited<ReturnType<typeof api.getAnimalPublicLink>> | null>(null);
  const [publicLinkBusy, setPublicLinkBusy] = useState(false);
  const [publicLinkError, setPublicLinkError] = useState('');
  // Traitements médicaux
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medicationsLoading, setMedicationsLoading] = useState(true);
  const [medicationsError, setMedicationsError] = useState('');
  const [medicationsLocked, setMedicationsLocked] = useState(false);
  const [showMedicationModal, setShowMedicationModal] = useState(false);
  const [medicationName, setMedicationName] = useState('');
  const [medicationDose, setMedicationDose] = useState('');
  const [medicationUnit, setMedicationUnit] = useState('');
  const [medicationFrequency, setMedicationFrequency] = useState<'daily' | 'every_x_hours' | 'weekly'>('daily');
  const [medicationIntervalHours, setMedicationIntervalHours] = useState(8);
  const [medicationStartDate, setMedicationStartDate] = useState('');
  const [medicationEndDate, setMedicationEndDate] = useState('');
  const [medicationNotes, setMedicationNotes] = useState('');
  const [medicationSubmitting, setMedicationSubmitting] = useState(false);
  const [medicationFormError, setMedicationFormError] = useState('');
  const [medicationToDelete, setMedicationToDelete] = useState<string | null>(null);
  const [showDeleteMedicationConfirm, setShowDeleteMedicationConfirm] = useState(false);
  const [medicationDeletingId, setMedicationDeletingId] = useState<string | null>(null);
  const [medicationStoppingId, setMedicationStoppingId] = useState<string | null>(null);
  // RDV vétérinaires
  const [vetAppointments, setVetAppointments] = useState<VetAppointment[]>([]);
  const [vetAppointmentsLoading, setVetAppointmentsLoading] = useState(true);
  const [vetAppointmentsError, setVetAppointmentsError] = useState('');
  const [showVetModal, setShowVetModal] = useState(false);
  const [vetName, setVetName] = useState('');
  const [vetReason, setVetReason] = useState('');
  const [vetDate, setVetDate] = useState('');
  const [vetLocation, setVetLocation] = useState('');
  const [vetNotes, setVetNotes] = useState('');
  const [vetReminderJ7, setVetReminderJ7] = useState(true);
  const [vetReminderJ1, setVetReminderJ1] = useState(true);
  const [vetSubmitting, setVetSubmitting] = useState(false);
  const [vetFormError, setVetFormError] = useState('');
  const [vetToDelete, setVetToDelete] = useState<string | null>(null);
  const [showDeleteVetConfirm, setShowDeleteVetConfirm] = useState(false);
  const [vetDeletingId, setVetDeletingId] = useState<string | null>(null);
  const [vetStatusUpdatingId, setVetStatusUpdatingId] = useState<string | null>(null);

  // Poids & mesures
  const [measurements, setMeasurements] = useState<AnimalMeasurement[]>([]);
  const [measurementsLoading, setMeasurementsLoading] = useState(true);
  const [measurementsError, setMeasurementsError] = useState('');
  const [measurementsLocked, setMeasurementsLocked] = useState(false);
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [editingMeasurementId, setEditingMeasurementId] = useState<string | null>(null);
  const [measurementDate, setMeasurementDate] = useState(new Date().toISOString().slice(0, 10));
  const [measurementWeight, setMeasurementWeight] = useState('');
  const [measurementHeight, setMeasurementHeight] = useState('');
  const [measurementNotes, setMeasurementNotes] = useState('');
  const [measurementSubmitting, setMeasurementSubmitting] = useState(false);
  const [measurementFormError, setMeasurementFormError] = useState('');
  const [measurementToDelete, setMeasurementToDelete] = useState<string | null>(null);
  const [showDeleteMeasurementConfirm, setShowDeleteMeasurementConfirm] = useState(false);
  const [measurementDeletingId, setMeasurementDeletingId] = useState<string | null>(null);

  // Vaccinations
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [vaccinationsLoading, setVaccinationsLoading] = useState(true);
  const [vaccinationsError, setVaccinationsError] = useState('');
  const [vaccinationsLocked, setVaccinationsLocked] = useState(false);
  const [showVaccinationModal, setShowVaccinationModal] = useState(false);
  const [editingVaccinationId, setEditingVaccinationId] = useState<string | null>(null);
  const [vaccinationName, setVaccinationName] = useState('');
  const [vaccinationDate, setVaccinationDate] = useState('');
  const [vaccinationNextDue, setVaccinationNextDue] = useState('');
  const [vaccinationBatch, setVaccinationBatch] = useState('');
  const [vaccinationVet, setVaccinationVet] = useState('');
  const [vaccinationNotes, setVaccinationNotes] = useState('');
  const [vaccinationSubmitting, setVaccinationSubmitting] = useState(false);
  const [vaccinationFormError, setVaccinationFormError] = useState('');
  const [vaccinationToDelete, setVaccinationToDelete] = useState<string | null>(null);
  const [showDeleteVaccinationConfirm, setShowDeleteVaccinationConfirm] = useState(false);
  const [vaccinationDeletingId, setVaccinationDeletingId] = useState<string | null>(null);

  // Reproduction (suivi de reproduction - Module B)
  const [breedingRecords, setBreedingRecords] = useState<BreedingRecord[]>([]);
  const [breedingLoading, setBreedingLoading] = useState(true);
  const [breedingError, setBreedingError] = useState('');
  const [breedingLocked, setBreedingLocked] = useState(false);
  const [showBreedingModal, setShowBreedingModal] = useState(false);
  const [editingBreedingId, setEditingBreedingId] = useState<string | null>(null);
  const [breedingEventType, setBreedingEventType] = useState<BreedingRecord['eventType']>('heat');
  const [breedingDate, setBreedingDate] = useState(new Date().toISOString().slice(0, 10));
  const [breedingPartnerName, setBreedingPartnerName] = useState('');
  const [breedingOffspringCount, setBreedingOffspringCount] = useState('');
  const [breedingNotes, setBreedingNotes] = useState('');
  const [breedingSubmitting, setBreedingSubmitting] = useState(false);
  const [breedingFormError, setBreedingFormError] = useState('');
  const [breedingToDelete, setBreedingToDelete] = useState<string | null>(null);
  const [showDeleteBreedingConfirm, setShowDeleteBreedingConfirm] = useState(false);
  const [breedingDeletingId, setBreedingDeletingId] = useState<string | null>(null);

  // Export carnet de santé
  const [exportingCarnet, setExportingCarnet] = useState(false);
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

  useEffect(() => {
    if (showEditAnimalModal && animal) {
      setEditAnimalName(animal.name);
      setEditAnimalBirthDate(animal.birthDate ? animal.birthDate.slice(0, 10) : '');
      setEditAnimalSex(animal.sex || '');
      setEditAnimalNotes(animal.notes || '');
      setEditAnimalProfilePhotoUrl(animal.photos?.[0] || '');
      setEditFatherId(animal.fatherId || '');
      setEditMotherId(animal.motherId || '');
      setEditGroupName(animal.groupName || '');
      setEditAnimalError('');
      if (token) {
        api
          .getMyAnimals(token)
          .then((data) => setCandidateAnimals(Array.isArray(data) ? data : []))
          .catch(() => setCandidateAnimals([]));
      }
    }
  }, [showEditAnimalModal, animal, token]);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const fetchAnimalData = async () => {
    if (!token || !resolvedParams) return;

    try {
      // Fetch animal details
      const animalData = await api.getAnimal(resolvedParams.id, token);
      if (animalData.statusCode === 404 || animalData.error) {
        setError('Animal not found');
        setLoading(false);
        return;
      }
      setAnimal(animalData);

      // Fetch species info
      try {
        const speciesData = await api.getSpecies(animalData.speciesId.toString()) as Species;
        setSpecies(speciesData);
        
        // Fetch species health info
        try {
          const healthData = await api.getSpeciesHealth(animalData.speciesId, undefined, resolvedParams.locale);
          setSpeciesHealth(healthData as SpeciesHealthData);
        } catch (e) {
          console.error('Error fetching species health:', e);
        }

        // Fetch species legislation info (API returns { editorial: [{ country, status, details, sources }] })
        try {
          const legislationData = await api.getSpeciesLegislation(String(animalData.speciesId));
          setSpeciesLegislation(legislationData as SpeciesLegislationData);
        } catch (e) {
          console.error('Error fetching species legislation:', e);
        }

        // Fetch species equipment recommendations
        try {
          const equipmentData = await api.getRecommendedEquipment(animalData.speciesId);
          setSpeciesEquipment(equipmentData as SpeciesEquipmentData);
        } catch (e) {
          console.error('Error fetching species equipment:', e);
        }

        // Fetch species food recommendations
        try {
          const speciesName = speciesData.canonicalName || speciesData.scientificName;
          const foodData = await api.getFoodBySpecies(speciesName) as { products?: SpeciesFoodProduct[] };
          setSpeciesFood(foodData.products || []);
        } catch (e) {
          console.error('Error fetching species food:', e);
        }
      } catch (e) {
        console.error('Error fetching species:', e);
      }

      // Fetch routines
      try {
        const routinesData = await api.getAnimalRoutines(resolvedParams.id, token);
        setRoutines(Array.isArray(routinesData) ? routinesData : []);
      } catch (e) {
        console.error('Error fetching routines:', e);
      }

      // Fetch offspring (petits) — module F
      try {
        const kids = await api.getOffspring(resolvedParams.id, token);
        setOffspring(Array.isArray(kids) ? kids : []);
      } catch (e) {
        console.error('Error fetching offspring:', e);
      }

      // Fetch medications (traitements)
      try {
        const meds = await api.getMedications(resolvedParams.id, token);
        setMedications(Array.isArray(meds) ? meds : []);
        setMedicationsError('');
        setMedicationsLocked(false);
      } catch (e) {
        console.error('Error fetching medications:', e);
        const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
        if (msg.includes('unauthorized') || msg.includes('non autorisé') || msg.includes('401')) {
          logout();
          router.push('/login');
          return;
        }
        if (msg.includes('forbidden') || msg.includes('403') || msg.includes('premium')) {
          setMedicationsLocked(true);
        } else {
          setMedicationsError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        setMedicationsLoading(false);
      }

      // Fetch vet appointments (RDV vétérinaires)
      try {
        const vets = await api.getVetAppointments(resolvedParams.id, token);
        setVetAppointments(Array.isArray(vets) ? vets : []);
        setVetAppointmentsError('');
      } catch (e) {
        console.error('Error fetching vet appointments:', e);
        const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
        if (msg.includes('unauthorized') || msg.includes('non autorisé') || msg.includes('401')) {
          logout();
          router.push('/login');
          return;
        }
        setVetAppointmentsError(e instanceof Error ? e.message : String(e));
      } finally {
        setVetAppointmentsLoading(false);
      }

      // Fetch health records (carnet de santé)
      try {
        const records = await api.getAnimalHealthRecords(resolvedParams.id, token);
        setHealthRecords(Array.isArray(records) ? records : []);
      } catch {
        setHealthRecords([]);
      }

      // Fetch measurements (poids & mesures)
      try {
        const measures = await api.getMeasurements(resolvedParams.id, token);
        setMeasurements(Array.isArray(measures) ? measures : []);
        setMeasurementsError('');
        setMeasurementsLocked(false);
      } catch (e) {
        console.error('Error fetching measurements:', e);
        const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
        if (msg.includes('unauthorized') || msg.includes('non autorisé') || msg.includes('401')) {
          logout();
          router.push('/login');
          return;
        }
        if (msg.includes('forbidden') || msg.includes('403') || msg.includes('premium')) {
          setMeasurementsLocked(true);
        } else {
          setMeasurementsError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        setMeasurementsLoading(false);
      }

      // Fetch vaccinations
      try {
        const vacs = await api.getVaccinations(resolvedParams.id, token);
        setVaccinations(Array.isArray(vacs) ? vacs : []);
        setVaccinationsError('');
        setVaccinationsLocked(false);
      } catch (e) {
        console.error('Error fetching vaccinations:', e);
        const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
        if (msg.includes('unauthorized') || msg.includes('non autorisé') || msg.includes('401')) {
          logout();
          router.push('/login');
          return;
        }
        if (msg.includes('forbidden') || msg.includes('403') || msg.includes('premium')) {
          setVaccinationsLocked(true);
        } else {
          setVaccinationsError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        setVaccinationsLoading(false);
      }

      // Fetch breeding records (reproduction)
      try {
        const recs = await api.getBreedingRecords(resolvedParams.id, token);
        setBreedingRecords(Array.isArray(recs) ? recs : []);
        setBreedingError('');
        setBreedingLocked(false);
      } catch (e) {
        console.error('Error fetching breeding records:', e);
        const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
        if (msg.includes('unauthorized') || msg.includes('non autorisé') || msg.includes('401')) {
          logout();
          router.push('/login');
          return;
        }
        if (msg.includes('forbidden') || msg.includes('403') || msg.includes('premium')) {
          setBreedingLocked(true);
        } else if (msg.includes('not found') || msg.includes('404')) {
          // Module non encore déployé côté backend : traiter comme liste vide
          setBreedingRecords([]);
          setBreedingError('');
        } else {
          setBreedingError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        setBreedingLoading(false);
      }
    } catch (error) {
      const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
      const isAuthError = msg.includes('unauthorized') || msg.includes('non autorisé') || msg.includes('forbidden') || msg.includes('403') || msg.includes('401');
      if (isAuthError) {
        logout();
        router.push('/login');
        return;
      }
      console.error('Error fetching animal:', error);
      setError('Error loading animal data');
    } finally {
      setLoading(false);
    }
  };

  const getRoutineTypeName = (type: string): string => {
    const types: Record<string, string> = {
      nourrissage: t('routines.types.feeding'),
      nettoyage: t('routines.types.cleaning'),
      uvb: t('routines.types.uvb'),
      controle: t('routines.types.health'),
      entretien: t('routines.types.cleaning'),
    };
    return types[type] || type;
  };

  const getFrequencyName = (frequency: string): string => {
    const frequencies: Record<string, string> = {
      daily: t('routines.frequencies.daily'),
      every_2_days: t('routines.frequencies.every_2_days'),
      every_3_days: t('routines.frequencies.every_3_days'),
      weekly: t('routines.frequencies.weekly'),
      monthly: t('routines.frequencies.monthly'),
      once: t('routines.frequencies.once'),
      hourly: t('routines.frequencies.hourly'),
      custom: t('routines.frequencies.custom'),
    };
    return frequencies[frequency] || frequency;
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

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const handleDeleteAnimal = async () => {
    if (!animal || !token) return;
    
    setIsDeleting(true);
    try {
      await api.deleteAnimal(animal.id, token);
      router.push('/mes-animaux');
    } catch (err) {
      console.error('Error deleting animal:', err);
      setError(t('animals.errorDeleting') || 'Erreur lors de la suppression');
      setShowDeleteConfirm(false);
      setIsDeleting(false);
    }
  };

  const openRoutineModalForCreate = () => {
    setEditingRoutineId(null);
    setRoutineName('');
    setRoutineType('nourrissage');
    setRoutineFrequency('daily');
    setRoutineTime('08:00');
    setRoutineDate('');
    setRoutineWeekDay(1);
    setRoutineDayOfMonth(1);
    setRoutineIntervalHours(2);
    setRoutineActive(true);
    setRoutineError('');
    setShowRoutineModal(true);
  };

  // Modèles de routines de l'espèce (module D) : fetch + suggestions cliquables
  const handleShowRoutineTemplates = async () => {
    if (!animal || !token) return;
    if (showRoutineTemplates) {
      setShowRoutineTemplates(false);
      return;
    }
    setRoutineTemplatesLoading(true);
    try {
      const templates = await api.getRoutineTemplates(animal.id, token);
      setRoutineTemplates(templates);
      setShowRoutineTemplates(templates.length > 0);
      if (templates.length === 0) setToast(t('animals.routineTemplates.noTemplates'));
    } catch (err) {
      console.error('Error fetching routine templates:', err);
      setToast(t('animals.routineTemplates.noTemplates'));
    } finally {
      setRoutineTemplatesLoading(false);
    }
  };

  const applyRoutineTemplate = (template: SpeciesRoutineTemplate) => {
    openRoutineModalForCreate();
    setRoutineName(template.name || '');
    if (template.type) setRoutineType(template.type);
    const sch = (template.schedule || {}) as {
      time?: string;
      recurrence?: string;
      date?: string;
      weekDay?: number;
      dayOfMonth?: number;
      intervalHours?: number;
    };
    const freq = sch?.recurrence ?? template.frequency ?? 'daily';
    setRoutineFrequency(freq);
    setRoutineTime(typeof sch?.time === 'string' && sch.time ? sch.time : '08:00');
    setRoutineDate(sch?.date ?? '');
    setRoutineWeekDay(typeof sch?.weekDay === 'number' ? sch.weekDay : 1);
    setRoutineDayOfMonth(typeof sch?.dayOfMonth === 'number' ? sch.dayOfMonth : 1);
    setRoutineIntervalHours(typeof sch?.intervalHours === 'number' ? sch.intervalHours : 2);
    setRoutineActive(true);
    setShowRoutineTemplates(false);
  };

  const openRoutineModalForEdit = (routine: Routine) => {
    setEditingRoutineId(routine.id);
    setRoutineName(routine.name || '');
    setRoutineType(routine.type);
    const sch = routine.schedule as { time?: string; recurrence?: string; date?: string; weekDay?: number; dayOfMonth?: number; intervalHours?: number } | undefined;
    const freq = sch?.recurrence ?? routine.frequency ?? 'daily';
    setRoutineFrequency(freq);
    const time = sch?.time ?? routine.schedule?.time ?? '08:00';
    setRoutineTime(typeof time === 'string' ? time : '08:00');
    setRoutineDate(sch?.date ?? '');
    setRoutineWeekDay(typeof sch?.weekDay === 'number' ? sch.weekDay : 1);
    setRoutineDayOfMonth(typeof sch?.dayOfMonth === 'number' ? sch.dayOfMonth : 1);
    setRoutineIntervalHours(typeof sch?.intervalHours === 'number' ? sch.intervalHours : 2);
    setRoutineActive(routine.active);
    setRoutineError('');
    setShowRoutineModal(true);
  };

  const handleSaveRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animal || !token) return;

    setRoutineError('');
    setIsCreatingRoutine(true);

    const schedule: Record<string, unknown> = {
      time: routineTime,
      recurrence: routineFrequency,
    };
    if (routineFrequency === 'once' && routineDate) schedule.date = routineDate;
    if (routineFrequency === 'weekly') schedule.weekDay = routineWeekDay;
    if (routineFrequency === 'monthly') schedule.dayOfMonth = routineDayOfMonth;
    if (routineFrequency === 'hourly') schedule.intervalHours = routineIntervalHours;

    const payload = {
      name: routineName || undefined,
      type: routineType,
      frequency: routineFrequency,
      schedule,
      active: routineActive,
    };

    try {
      if (editingRoutineId) {
        await api.updateRoutine(animal.id, editingRoutineId, payload, token);
      } else {
        await api.createRoutine(animal.id, { ...payload, active: payload.active ?? true }, token);
      }
      setShowRoutineModal(false);
      setEditingRoutineId(null);
      setRoutineName('');
      setRoutineType('nourrissage');
      setRoutineFrequency('daily');
      setRoutineTime('08:00');
      setRoutineDate('');
      setRoutineWeekDay(1);
      setRoutineDayOfMonth(1);
      setRoutineIntervalHours(2);
      setRoutineActive(true);
      await fetchAnimalData();
    } catch (err) {
      console.error('Error saving routine:', err);
      setRoutineError(
        editingRoutineId
          ? (t('animals.errorUpdatingRoutine') || 'Erreur lors de la modification')
          : (t('animals.errorCreatingRoutine') || 'Erreur lors de la création')
      );
    } finally {
      setIsCreatingRoutine(false);
    }
  };

  const handleDeleteRoutine = async () => {
    if (!animal || !token || !routineToDelete) return;
    setIsDeletingRoutine(true);
    try {
      await api.deleteRoutine(animal.id, routineToDelete, token);
      setShowDeleteRoutineConfirm(false);
      setRoutineToDelete(null);
      await fetchAnimalData();
    } catch (err) {
      console.error('Error deleting routine:', err);
    } finally {
      setIsDeletingRoutine(false);
    }
  };

  const handleLoadHistory = async () => {
    if (!animal || !token) return;

    setIsLoadingHistory(true);
    setHistoryError('');
    try {
      const historyData = await api.getAnimalHistory(animal.id, token);
      setHistory(Array.isArray(historyData) ? historyData : []);
    } catch (err) {
      console.error('Error loading history:', err);
      setHistoryError(t('animals.errorLoadingHistory') || 'Erreur lors du chargement');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleOpenHistoryModal = async () => {
    setShowHistoryModal(true);
    if (history.length === 0) {
      await handleLoadHistory();
    }
  };

  const getHealthRecordTypeName = (type: string): string => {
    const key = `animals.healthRecordTypes.${type}` as Parameters<typeof t>[0];
    const translated = t(key);
    return translated !== key ? translated : type;
  };

  const openHealthModalForCreate = () => {
    setEditingHealthId(null);
    setHealthFormType('vaccine');
    setHealthFormTitle('');
    setHealthFormDate(new Date().toISOString().slice(0, 10));
    setHealthFormNotes('');
    setHealthError('');
    setShowHealthModal(true);
  };

  const openHealthModalForEdit = (record: HealthRecord) => {
    setEditingHealthId(record.id);
    setHealthFormType(record.type);
    setHealthFormTitle(record.title);
    setHealthFormDate(record.date ? record.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setHealthFormNotes(record.notes || '');
    setHealthError('');
    setShowHealthModal(true);
  };

  const handleSaveHealthRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animal || !token || !healthFormTitle.trim()) return;
    setHealthSubmitting(true);
    setHealthError('');
    try {
      if (editingHealthId) {
        await api.updateAnimalHealthRecord(
          animal.id,
          editingHealthId,
          {
            type: healthFormType,
            title: healthFormTitle.trim(),
            date: healthFormDate,
            notes: healthFormNotes.trim() || undefined,
          },
          token
        );
      } else {
        await api.createAnimalHealthRecord(
          animal.id,
          {
            type: healthFormType,
            title: healthFormTitle.trim(),
            date: healthFormDate,
            notes: healthFormNotes.trim() || undefined,
          },
          token
        );
      }
      setShowHealthModal(false);
      await fetchAnimalData();
    } catch (err) {
      console.error('Error saving health record:', err);
      setHealthError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setHealthSubmitting(false);
    }
  };

  const handleDeleteHealthRecord = async (recordId: string) => {
    if (!animal || !token) return;
    setHealthDeletingId(recordId);
    try {
      await api.deleteAnimalHealthRecord(animal.id, recordId, token);
      setShowDeleteHealthConfirm(false);
      setHealthRecordToDelete(null);
      await fetchAnimalData();
    } catch (err) {
      console.error('Error deleting health record:', err);
    } finally {
      setHealthDeletingId(null);
    }
  };

  const getMedicationFrequencyName = (frequency: string): string => {
    const frequencies: Record<string, string> = {
      daily: t('animals.medications.frequencyDaily'),
      every_x_hours: t('animals.medications.frequencyEveryXHours'),
      weekly: t('animals.medications.frequencyWeekly'),
    };
    return frequencies[frequency] || frequency;
  };

  const getVetStatusName = (status: string): string => {
    const statuses: Record<string, string> = {
      scheduled: t('animals.vetAppointments.statusScheduled'),
      done: t('animals.vetAppointments.statusDone'),
      cancelled: t('animals.vetAppointments.statusCancelled'),
    };
    return statuses[status] || status;
  };

  const formatDateTime = (dateString?: string): string => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return dateString;
    }
  };

  const openMedicationModalForCreate = () => {
    if (!user?.isPremium || medicationsLocked) return;
    setMedicationName('');
    setMedicationDose('');
    setMedicationUnit('');
    setMedicationFrequency('daily');
    setMedicationIntervalHours(8);
    setMedicationStartDate(new Date().toISOString().slice(0, 10));
    setMedicationEndDate('');
    setMedicationNotes('');
    setMedicationFormError('');
    setShowMedicationModal(true);
  };

  const handleSaveMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animal || !token) return;
    if (!medicationName.trim() || !medicationDose.trim() || !medicationStartDate) return;

    setMedicationSubmitting(true);
    setMedicationFormError('');
    try {
      const payload = {
        name: medicationName.trim(),
        dose: medicationDose.trim(),
        unit: medicationUnit.trim() || undefined,
        frequency: medicationFrequency,
        intervalHours: medicationFrequency === 'every_x_hours' ? medicationIntervalHours : undefined,
        startDate: medicationStartDate,
        endDate: medicationEndDate || undefined,
        notes: medicationNotes.trim() || undefined,
        active: true,
      };
      await api.createMedication(animal.id, payload, token);
      setShowMedicationModal(false);
      await fetchAnimalData();
    } catch (err) {
      console.error('Error saving medication:', err);
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('403') || msg.toLowerCase().includes('premium')) {
        setMedicationsLocked(true);
        setShowMedicationModal(false);
      } else {
        setMedicationFormError(msg);
      }
    } finally {
      setMedicationSubmitting(false);
    }
  };

  const handleStopMedication = async (medicationId: string) => {
    if (!animal || !token) return;
    setMedicationStoppingId(medicationId);
    try {
      await api.updateMedication(animal.id, medicationId, { active: false }, token);
      await fetchAnimalData();
    } catch (err) {
      console.error('Error stopping medication:', err);
    } finally {
      setMedicationStoppingId(null);
    }
  };

  const handleDeleteMedication = async () => {
    if (!animal || !token || !medicationToDelete) return;
    setMedicationDeletingId(medicationToDelete);
    try {
      await api.deleteMedication(animal.id, medicationToDelete, token);
      setShowDeleteMedicationConfirm(false);
      setMedicationToDelete(null);
      await fetchAnimalData();
    } catch (err) {
      console.error('Error deleting medication:', err);
    } finally {
      setMedicationDeletingId(null);
    }
  };

  const openVetModalForCreate = () => {
    setVetName('');
    setVetReason('');
    setVetDate('');
    setVetLocation('');
    setVetNotes('');
    setVetReminderJ7(true);
    setVetReminderJ1(true);
    setVetFormError('');
    setShowVetModal(true);
  };

  const handleSaveVetAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animal || !token) return;
    if (!vetName.trim() || !vetDate) return;

    setVetSubmitting(true);
    setVetFormError('');
    try {
      const reminderDays: number[] = [];
      if (vetReminderJ7) reminderDays.push(7);
      if (vetReminderJ1) reminderDays.push(1);
      const payload = {
        vetName: vetName.trim(),
        reason: vetReason.trim() || undefined,
        date: new Date(vetDate).toISOString(),
        location: vetLocation.trim() || undefined,
        notes: vetNotes.trim() || undefined,
        reminderDays,
      };
      await api.createVetAppointment(animal.id, payload, token);
      setShowVetModal(false);
      await fetchAnimalData();
    } catch (err) {
      console.error('Error saving vet appointment:', err);
      setVetFormError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setVetSubmitting(false);
    }
  };

  const handleMarkVetDone = async (appointmentId: string) => {
    if (!animal || !token) return;
    setVetStatusUpdatingId(appointmentId);
    try {
      await api.updateVetAppointment(animal.id, appointmentId, { status: 'done' }, token);
      await fetchAnimalData();
    } catch (err) {
      console.error('Error marking vet appointment done:', err);
    } finally {
      setVetStatusUpdatingId(null);
    }
  };

  const handleCancelVetAppointment = async (appointmentId: string) => {
    if (!animal || !token) return;
    setVetStatusUpdatingId(appointmentId);
    try {
      await api.updateVetAppointment(animal.id, appointmentId, { status: 'cancelled' }, token);
      await fetchAnimalData();
    } catch (err) {
      console.error('Error cancelling vet appointment:', err);
    } finally {
      setVetStatusUpdatingId(null);
    }
  };

  const handleDeleteVetAppointment = async () => {
    if (!animal || !token || !vetToDelete) return;
    setVetDeletingId(vetToDelete);
    try {
      await api.deleteVetAppointment(animal.id, vetToDelete, token);
      setShowDeleteVetConfirm(false);
      setVetToDelete(null);
      await fetchAnimalData();
    } catch (err) {
      console.error('Error deleting vet appointment:', err);
    } finally {
      setVetDeletingId(null);
    }
  };

  const openMeasurementModalForCreate = () => {
    if (!user?.isPremium || measurementsLocked) return;
    setEditingMeasurementId(null);
    setMeasurementDate(new Date().toISOString().slice(0, 10));
    setMeasurementWeight('');
    setMeasurementHeight('');
    setMeasurementNotes('');
    setMeasurementFormError('');
    setShowMeasurementModal(true);
  };

  const openMeasurementModalForEdit = (measurement: AnimalMeasurement) => {
    if (!user?.isPremium || measurementsLocked) return;
    setEditingMeasurementId(measurement.id);
    setMeasurementDate(measurement.measuredAt ? measurement.measuredAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setMeasurementWeight(typeof measurement.weightKg === 'number' ? String(measurement.weightKg) : '');
    setMeasurementHeight(typeof measurement.heightCm === 'number' ? String(measurement.heightCm) : '');
    setMeasurementNotes(measurement.notes || '');
    setMeasurementFormError('');
    setShowMeasurementModal(true);
  };

  const handleSaveMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animal || !token) return;
    if (!measurementDate) return;

    setMeasurementSubmitting(true);
    setMeasurementFormError('');
    try {
      const weightNum = measurementWeight.trim() === '' ? undefined : Number(measurementWeight);
      const heightNum = measurementHeight.trim() === '' ? undefined : Number(measurementHeight);
      if (measurementWeight.trim() !== '' && Number.isNaN(weightNum)) {
        setMeasurementFormError(t('animals.measurements.weightInvalid') || 'Poids invalide');
        return;
      }
      if (measurementHeight.trim() !== '' && Number.isNaN(heightNum)) {
        setMeasurementFormError(t('animals.measurements.heightInvalid') || 'Taille invalide');
        return;
      }
      const payload = {
        measuredAt: measurementDate,
        weightKg: weightNum,
        heightCm: heightNum,
        notes: measurementNotes.trim() || undefined,
      };
      if (editingMeasurementId) {
        await api.updateMeasurement(animal.id, editingMeasurementId, payload, token);
      } else {
        await api.createMeasurement(animal.id, payload, token);
      }
      setShowMeasurementModal(false);
      await fetchAnimalData();
    } catch (err) {
      console.error('Error saving measurement:', err);
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('403') || msg.toLowerCase().includes('premium')) {
        setMeasurementsLocked(true);
        setShowMeasurementModal(false);
      } else {
        setMeasurementFormError(msg);
      }
    } finally {
      setMeasurementSubmitting(false);
    }
  };

  const handleDeleteMeasurement = async () => {
    if (!animal || !token || !measurementToDelete) return;
    setMeasurementDeletingId(measurementToDelete);
    try {
      await api.deleteMeasurement(animal.id, measurementToDelete, token);
      setShowDeleteMeasurementConfirm(false);
      setMeasurementToDelete(null);
      await fetchAnimalData();
    } catch (err) {
      console.error('Error deleting measurement:', err);
    } finally {
      setMeasurementDeletingId(null);
    }
  };

  const openVaccinationModalForCreate = () => {
    if (!user?.isPremium || vaccinationsLocked) return;
    setEditingVaccinationId(null);
    setVaccinationName('');
    setVaccinationDate(new Date().toISOString().slice(0, 10));
    setVaccinationNextDue('');
    setVaccinationBatch('');
    setVaccinationVet('');
    setVaccinationNotes('');
    setVaccinationFormError('');
    setShowVaccinationModal(true);
  };

  const openVaccinationModalForEdit = (vaccination: Vaccination) => {
    if (!user?.isPremium || vaccinationsLocked) return;
    setEditingVaccinationId(vaccination.id);
    setVaccinationName(vaccination.name || '');
    setVaccinationDate(vaccination.date ? vaccination.date.slice(0, 10) : '');
    setVaccinationNextDue(vaccination.nextDueDate ? vaccination.nextDueDate.slice(0, 10) : '');
    setVaccinationBatch(vaccination.batchNumber || '');
    setVaccinationVet(vaccination.vetName || '');
    setVaccinationNotes(vaccination.notes || '');
    setVaccinationFormError('');
    setShowVaccinationModal(true);
  };

  const handleSaveVaccination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animal || !token) return;
    if (!vaccinationName.trim() || !vaccinationDate) return;

    setVaccinationSubmitting(true);
    setVaccinationFormError('');
    try {
      const payload = {
        name: vaccinationName.trim(),
        date: vaccinationDate,
        nextDueDate: vaccinationNextDue || undefined,
        batchNumber: vaccinationBatch.trim() || undefined,
        vetName: vaccinationVet.trim() || undefined,
        notes: vaccinationNotes.trim() || undefined,
      };
      if (editingVaccinationId) {
        await api.updateVaccination(animal.id, editingVaccinationId, payload, token);
      } else {
        await api.createVaccination(animal.id, payload, token);
      }
      setShowVaccinationModal(false);
      await fetchAnimalData();
    } catch (err) {
      console.error('Error saving vaccination:', err);
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('403') || msg.toLowerCase().includes('premium')) {
        setVaccinationsLocked(true);
        setShowVaccinationModal(false);
      } else {
        setVaccinationFormError(msg);
      }
    } finally {
      setVaccinationSubmitting(false);
    }
  };

  const handleDeleteVaccination = async () => {
    if (!animal || !token || !vaccinationToDelete) return;
    setVaccinationDeletingId(vaccinationToDelete);
    try {
      await api.deleteVaccination(animal.id, vaccinationToDelete, token);
      setShowDeleteVaccinationConfirm(false);
      setVaccinationToDelete(null);
      await fetchAnimalData();
    } catch (err) {
      console.error('Error deleting vaccination:', err);
    } finally {
      setVaccinationDeletingId(null);
    }
  };

  const getBreedingEventMeta = (type: string): { emoji: string; label: string } => {
    const metas: Record<string, { emoji: string; label: string }> = {
      heat: { emoji: '🔥', label: t('animals.breeding.heat') },
      mating: { emoji: '🤝', label: t('animals.breeding.mating') },
      pregnancy: { emoji: '🤰', label: t('animals.breeding.pregnancy') },
      birth: { emoji: '🍼', label: t('animals.breeding.birth') },
      weaning: { emoji: '🥛', label: t('animals.breeding.weaning') },
    };
    return metas[type] || { emoji: '📌', label: type };
  };

  const openBreedingModalForCreate = () => {
    if (!user?.isPremium || breedingLocked) return;
    setEditingBreedingId(null);
    setBreedingEventType('heat');
    setBreedingDate(new Date().toISOString().slice(0, 10));
    setBreedingPartnerName('');
    setBreedingOffspringCount('');
    setBreedingNotes('');
    setBreedingFormError('');
    setShowBreedingModal(true);
  };

  const openBreedingModalForEdit = (record: BreedingRecord) => {
    if (!user?.isPremium || breedingLocked) return;
    setEditingBreedingId(record.id);
    setBreedingEventType(record.eventType);
    setBreedingDate(record.date ? record.date.slice(0, 10) : '');
    setBreedingPartnerName(record.partnerName || '');
    setBreedingOffspringCount(record.offspringCount != null ? String(record.offspringCount) : '');
    setBreedingNotes(record.notes || '');
    setBreedingFormError('');
    setShowBreedingModal(true);
  };

  const handleSaveBreedingRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animal || !token || !breedingDate) return;

    setBreedingSubmitting(true);
    setBreedingFormError('');
    try {
      const payload: Partial<BreedingRecord> = {
        eventType: breedingEventType,
        date: breedingDate,
        partnerName: breedingPartnerName.trim() || undefined,
        offspringCount:
          breedingOffspringCount.trim() !== '' ? Number(breedingOffspringCount) : undefined,
        notes: breedingNotes.trim() || undefined,
      };
      if (editingBreedingId) {
        await api.updateBreedingRecord(animal.id, editingBreedingId, payload, token);
      } else {
        await api.createBreedingRecord(animal.id, payload, token);
      }
      setShowBreedingModal(false);
      await fetchAnimalData();
    } catch (err) {
      console.error('Error saving breeding record:', err);
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('403') || msg.toLowerCase().includes('premium')) {
        setBreedingLocked(true);
        setShowBreedingModal(false);
      } else {
        setBreedingFormError(msg);
      }
    } finally {
      setBreedingSubmitting(false);
    }
  };

  const handleDeleteBreedingRecord = async () => {
    if (!animal || !token || !breedingToDelete) return;
    setBreedingDeletingId(breedingToDelete);
    try {
      await api.deleteBreedingRecord(animal.id, breedingToDelete, token);
      setShowDeleteBreedingConfirm(false);
      setBreedingToDelete(null);
      await fetchAnimalData();
    } catch (err) {
      console.error('Error deleting breeding record:', err);
    } finally {
      setBreedingDeletingId(null);
    }
  };

  const handleExportCarnet = async () => {
    if (!animal || !token) return;
    setExportingCarnet(true);
    try {
      const blobUrl = await api.exportCarnet(animal.id, token);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `carnet-${animal.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setToast(t('animals.carnet.exportSuccess'));
    } catch (err) {
      console.error('Error exporting carnet:', err);
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('403') || msg.toLowerCase().includes('premium')) {
        setToast(t('animals.carnet.premiumRequired'));
      } else {
        setToast(t('animals.carnet.exportError'));
      }
    } finally {
      setExportingCarnet(false);
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
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      await api.updateAnimal(animal.id, { photos: [dataUrl] }, token);
      await fetchAnimalData();
    } catch (err) {
      console.error('Error updating avatar photo:', err);
    } finally {
      setAvatarPhotoUploading(false);
      e.target.value = '';
    }
  };

  const handleSaveEditAnimal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animal || !token || !editAnimalName.trim()) return;
    setEditAnimalSubmitting(true);
    setEditAnimalError('');
    try {
      await api.updateAnimal(
        animal.id,
        {
          name: editAnimalName.trim(),
          birthDate: editAnimalBirthDate || undefined,
          sex: editAnimalSex || undefined,
          notes: editAnimalNotes.trim() || undefined,
          photos: editAnimalProfilePhotoUrl.trim() ? [editAnimalProfilePhotoUrl.trim()] : [],
          fatherId: editFatherId || null,
          motherId: editMotherId || null,
          groupName: editGroupName.trim() || null,
        },
        token
      );
      await fetchAnimalData();
      setShowEditAnimalModal(false);
    } catch (err) {
      console.error('Error updating animal:', err);
      setEditAnimalError(err instanceof Error ? err.message : t('animals.errorAdding'));
    } finally {
      setEditAnimalSubmitting(false);
    }
  };

  // W0-06 — charge l'état du partage public (désactivé par défaut)
  const publicLinkAnimalId = animal?.id;
  const publicLinkLocale = resolvedParams?.locale;
  useEffect(() => {
    if (!publicLinkAnimalId || !token || !publicLinkLocale) return;
    let cancelled = false;
    api
      .getAnimalPublicLink(publicLinkAnimalId, token, publicLinkLocale)
      .then((state) => {
        if (!cancelled) setPublicLink(state);
      })
      .catch(() => {
        if (!cancelled) setPublicLink(null);
      });
    return () => {
      cancelled = true;
    };
  }, [publicLinkAnimalId, token, publicLinkLocale]);

  const updatePublicLink = async (body: { enabled?: boolean; showHealth?: boolean }) => {
    if (!animal || !token || !resolvedParams?.locale || publicLinkBusy) return;
    setPublicLinkBusy(true);
    setPublicLinkError('');
    try {
      const state = await api.updateAnimalPublicLink(animal.id, token, body, resolvedParams.locale);
      setPublicLink(state);
    } catch (e) {
      const msg = e instanceof Error ? e.message.toLowerCase() : '';
      setPublicLinkError(
        msg.includes('premium') || msg.includes('403') || msg.includes('forbidden')
          ? t('publicLink.premiumRequired')
          : t('publicLink.updateError'),
      );
    } finally {
      setPublicLinkBusy(false);
    }
  };

  const regeneratePublicLink = async () => {
    if (!animal || !token || !resolvedParams?.locale || publicLinkBusy) return;
    if (typeof window !== 'undefined' && !window.confirm(t('publicLink.regenerateConfirm'))) return;
    setPublicLinkBusy(true);
    setPublicLinkError('');
    try {
      const state = await api.regenerateAnimalPublicLink(animal.id, token, resolvedParams.locale);
      setPublicLink(state);
      setQrDataUrl('');
      setQrUrl('');
    } catch (e) {
      const msg = e instanceof Error ? e.message.toLowerCase() : '';
      setPublicLinkError(
        msg.includes('premium') || msg.includes('403') || msg.includes('forbidden')
          ? t('publicLink.premiumRequired')
          : t('publicLink.updateError'),
      );
    } finally {
      setPublicLinkBusy(false);
    }
  };

  const handleOpenQR = async () => {
    // L'URL du QR est celle renvoyée par l'API (jamais window.location.origin)
    if (!animal || !publicLink?.enabled || !publicLink.url) return;
    setQrLoading(true);
    setShowQRModal(true);
    setQrDataUrl('');
    setQrUrl('');
    setQrError('');
    try {
      const url = publicLink.url;
      const QRCodeModule = await import('qrcode');
      const dataUrl = await QRCodeModule.default.toDataURL(url, { width: 280, margin: 2 });
      setQrDataUrl(dataUrl);
      setQrUrl(url);
    } catch (e) {
      console.error('QR error:', e);
      setQrError(e instanceof Error ? e.message : t('premiumLock.qrCodeError'));
    } finally {
      setQrLoading(false);
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
            {error || 'Animal not found'}
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
                    href={`/species/${animal.speciesId}`}
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

      {/* Famille & groupe (module F) */}
      {(animal.father || animal.mother || animal.groupName || offspring.length > 0) && (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 min-w-0">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
              {t('animals.family.title')}
            </h2>
            <div className="flex flex-wrap gap-3">
              {animal.father && (
                <Link
                  href={`/mes-animaux/${animal.father.id}`}
                  className="flex items-center gap-2 rounded-xl border-2 border-gray-200 dark:border-gray-600 px-3 py-2 hover:border-emerald-500 transition-colors"
                >
                  {animal.father.photos?.[0] ? (
                    <img src={animal.father.photos[0]} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 flex items-center justify-center text-sm font-bold shrink-0">
                      {animal.father.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-sm text-gray-800 dark:text-gray-200">
                    <span className="font-medium">{t('animals.family.father')} :</span> {animal.father.name}
                  </span>
                </Link>
              )}
              {animal.mother && (
                <Link
                  href={`/mes-animaux/${animal.mother.id}`}
                  className="flex items-center gap-2 rounded-xl border-2 border-gray-200 dark:border-gray-600 px-3 py-2 hover:border-emerald-500 transition-colors"
                >
                  {animal.mother.photos?.[0] ? (
                    <img src={animal.mother.photos[0]} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 flex items-center justify-center text-sm font-bold shrink-0">
                      {animal.mother.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-sm text-gray-800 dark:text-gray-200">
                    <span className="font-medium">{t('animals.family.mother')} :</span> {animal.mother.name}
                  </span>
                </Link>
              )}
              {animal.groupName && (
                <span className="px-3 py-2 rounded-xl bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 text-sm font-medium inline-flex items-center gap-1.5">
                  {t('animals.family.group')} : {animal.groupName}
                </span>
              )}
            </div>
            {offspring.length > 0 && (
              <div className="mt-5">
                <h3 className="text-base font-semibold mb-3 text-gray-800 dark:text-white">
                  {t('animals.family.offspring')}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {offspring.map((kid) => (
                    <Link
                      key={kid.id}
                      href={`/mes-animaux/${kid.id}`}
                      className="flex items-center gap-2 rounded-xl border-2 border-gray-200 dark:border-gray-600 px-3 py-2 hover:border-emerald-500 transition-colors"
                    >
                      {kid.photos?.[0] ? (
                        <img src={kid.photos[0]} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 flex items-center justify-center text-sm font-bold shrink-0">
                          {kid.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{kid.name}</p>
                        {kid.sex && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{t(`animals.${kid.sex}`)}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
                      <li>Maintenez un environnement adapté (température, humidité)</li>
                      <li>Suivez un programme d&apos;alimentation régulier</li>
                      <li>Vérifiez les équipements (UVB, chauffage) régulièrement</li>
                      <li>Surveillez les signes de maladie</li>
                    </ul>
                  )}
                  
                  <Link
                    href={`/species/${animal.speciesId}`}
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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <div className="flex gap-0 px-6">
                  <button
                    onClick={() => setActiveTab('health')}
                    className={`px-4 py-3 font-medium transition-colors ${
                      activeTab === 'health'
                        ? 'text-emerald-600 border-b-2 border-emerald-600'
                        : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600'
                    }`}
                  >
                    {t('species.health')}
                  </button>
                  <button
                    onClick={() => setActiveTab('legislation')}
                    className={`px-4 py-3 font-medium transition-colors ${
                      activeTab === 'legislation'
                        ? 'text-emerald-600 border-b-2 border-emerald-600'
                        : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600'
                    }`}
                  >
                    {t('species.legal')}
                  </button>
                  <button
                    onClick={() => setActiveTab('equipment')}
                    className={`px-4 py-3 font-medium transition-colors ${
                      activeTab === 'equipment'
                        ? 'text-emerald-600 border-b-2 border-emerald-600'
                        : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600'
                    }`}
                  >
                    {t('species.equipment')}
                  </button>
                  <button
                    onClick={() => setActiveTab('food')}
                    className={`px-4 py-3 font-medium transition-colors ${
                      activeTab === 'food'
                        ? 'text-emerald-600 border-b-2 border-emerald-600'
                        : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600'
                    }`}
                  >
                    {t('species.food')}
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Health Tab */}
                {activeTab === 'health' && (
                  <div className="space-y-4">
                    {speciesHealth?.editorial?.diseases && speciesHealth.editorial.diseases.length > 0 ? (
                      <div className="space-y-4">
                        {speciesHealth.editorial.diseases.map((disease, idx: number) => (
                          <div key={idx}>
                            <h3 className="font-semibold text-gray-800 dark:text-white">{disease.name}</h3>
                            {disease.symptoms && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                <strong>{t('species.symptoms')}:</strong> {disease.symptoms}
                              </p>
                            )}
                            {disease.prevention && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                <strong>{t('species.prevention')}:</strong> {disease.prevention}
                              </p>
                            )}
                            {disease.whenToConsult && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                <strong>Quand consulter:</strong> {disease.whenToConsult}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">{t('common.noData') || 'Aucune donnée'}</p>
                    )}
                  </div>
                )}

                {/* Legislation Tab - API returns { editorial: [{ country, status, details, sources }] } */}
                {activeTab === 'legislation' && (
                  <div className="space-y-4">
                    {speciesLegislation?.editorial && speciesLegislation.editorial.length > 0 ? (
                      speciesLegislation.editorial.map((item) => (
                        <div key={item.country} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-gray-800 dark:text-white">
                              {item.country === 'FR' ? 'France' : item.country === 'US' ? 'États-Unis' : item.country === 'BE' ? 'Belgique' : item.country}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              item.status === 'allowed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              item.status === 'prohibited' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            }`}>
                              {item.status === 'allowed' ? (t('species.allowed') || 'Autorisé') : item.status === 'prohibited' ? (t('species.prohibited') || 'Interdit') : (t('species.permitRequired') || 'Permis requis')}
                            </span>
                          </div>
                          {item.details?.citesAppendix && (
                            <p className="text-sm text-gray-700 dark:text-gray-300"><strong>CITES:</strong> Annexe {item.details.citesAppendix}</p>
                          )}
                          {item.details?.euAnnex && (
                            <p className="text-sm text-gray-700 dark:text-gray-300"><strong>UE Annexe:</strong> {item.details.euAnnex}</p>
                          )}
                          {item.details?.permits && item.details.permits.length > 0 && (
                            <div className="text-sm mt-1">
                              <strong>Permis requis:</strong>
                              <ul className="list-disc list-inside mt-0.5">
                                {item.details.permits.map((permit: string, idx: number) => (
                                  <li key={idx}>{permit}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {item.details?.restrictions && item.details.restrictions.length > 0 && (
                            <div className="text-sm mt-1">
                              <strong>Restrictions:</strong>
                              <ul className="list-disc list-inside mt-0.5">
                                {item.details.restrictions.map((restriction: string, idx: number) => (
                                  <li key={idx}>{restriction}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {item.sources && item.sources.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Sources</p>
                              {item.sources.slice(0, 2).map((src: string, idx: number) => (
                                <a key={idx} href={src.startsWith('http') ? src : '#'} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline break-all block">{src}</a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">{t('species.noLegalData') || t('common.noData') || 'Aucune donnée législation'}</p>
                    )}
                  </div>
                )}

                {/* Equipment Tab */}
                {activeTab === 'equipment' && (
                  <div className="space-y-3">
                    {speciesEquipment?.recommendations && speciesEquipment.recommendations.length > 0 ? (
                      <div className="space-y-3">
                        {speciesEquipment.recommendations.map((equipment, idx: number) => (
                          <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                            <p className="font-semibold text-gray-800 dark:text-white">{equipment.label}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {equipment.category}
                              {equipment.size && ` - ${equipment.size}`}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">{t('common.noData') || 'Aucune donnée'}</p>
                    )}
                  </div>
                )}

                {/* Food Tab */}
                {activeTab === 'food' && (
                  <div className="space-y-3">
                    {speciesFood && speciesFood.length > 0 ? (
                      <div className="space-y-3">
                        {speciesFood.slice(0, 5).map((food, idx: number) => (
                          <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                            <p className="font-semibold text-gray-800 dark:text-white">
                              {food.product_name || food.name}
                            </p>
                            {food.brands && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">{food.brands}</p>
                            )}
                            {food.categories && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">{food.categories}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">{t('common.noData') || 'Aucune donnée'}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Carnet de santé + Routines */}
          <div className="space-y-6">
            {/* Carnet de santé */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  {t('animals.healthRecord')}
                </h2>
                <button
                  type="button"
                  onClick={openHealthModalForCreate}
                  className="text-sm text-emerald-600 hover:text-emerald-700"
                >
                  + {t('animals.healthRecordAdd')}
                </button>
              </div>
              {healthRecords.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                    {t('animals.healthRecordEmpty')}
                  </p>
                  <button
                    type="button"
                    onClick={openHealthModalForCreate}
                    className="rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-4 py-3 text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                  >
                    + {t('animals.healthRecordAdd')}
                  </button>
                </div>
              ) : (
                <ul className="space-y-4">
                  {healthRecords.map((record) => (
                    <li
                      key={record.id}
                      className="p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-700/30 hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="inline-block text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                            {getHealthRecordTypeName(record.type)}
                          </span>
                          <p className="font-semibold text-gray-800 dark:text-white truncate text-base">
                            {record.title}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {formatDate(record.date)}
                          </p>
                          {record.notes && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                              {record.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openHealthModalForEdit(record)}
                            className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                            title={t('common.edit')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHealthRecordToDelete(record.id);
                              setShowDeleteHealthConfirm(true);
                            }}
                            disabled={healthDeletingId === record.id}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50 transition-colors"
                            title={t('common.delete')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* QR code */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                {t('premiumLock.qrCode')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t('premiumLock.qrCodeHelp')}
              </p>
              {/* W0-06 — partage public en opt-in (désactivé par défaut) */}
              <div className="mb-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    role="switch"
                    className="mt-1 h-5 w-5 accent-emerald-600"
                    checked={!!publicLink?.enabled}
                    disabled={publicLinkBusy || !publicLink}
                    onChange={(e) => updatePublicLink({ enabled: e.target.checked })}
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-800 dark:text-white">
                      {t('publicLink.enableLabel')}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {t('publicLink.enableHelp')}
                    </span>
                  </span>
                </label>
                {publicLink?.enabled && (
                  <>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        role="switch"
                        className="mt-1 h-5 w-5 accent-emerald-600"
                        checked={publicLink.showHealth}
                        disabled={publicLinkBusy}
                        onChange={(e) => updatePublicLink({ showHealth: e.target.checked })}
                      />
                      <span>
                        <span className="block text-sm font-medium text-gray-800 dark:text-white">
                          {t('publicLink.showHealthLabel')}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {t('publicLink.showHealthHelp')}
                        </span>
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={regeneratePublicLink}
                      disabled={publicLinkBusy}
                      className="w-full py-2 px-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-70"
                    >
                      {t('publicLink.regenerate')}
                    </button>
                  </>
                )}
                {!publicLink?.enabled && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('publicLink.disabledHint')}</p>
                )}
                {publicLinkError && (
                  <p role="alert" className="text-sm text-red-600 dark:text-red-400">{publicLinkError}</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleOpenQR}
                disabled={qrLoading || !publicLink?.enabled}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-70 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                {qrLoading ? t('common.loading') : t('premiumLock.qrCodeButton')}
              </button>
            </div>

            {/* Routines */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  {t('routines.title')}
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleShowRoutineTemplates}
                    className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    {routineTemplatesLoading && (
                      <span className="animate-spin h-3 w-3 border-2 border-emerald-600 border-t-transparent rounded-full inline-block"></span>
                    )}
                    {t('animals.routineTemplates.templates')}
                  </button>
                  <button 
                    onClick={openRoutineModalForCreate}
                    className="text-sm text-emerald-600 hover:text-emerald-700"
                  >
                    + {t('routines.addRoutine')}
                  </button>
                </div>
              </div>

              {/* Suggestions : modèles de routines de l'espèce (module D) */}
              {showRoutineTemplates && routineTemplates.length > 0 && (
                <div className="mb-4 border border-emerald-200 dark:border-emerald-800 rounded-lg bg-emerald-50/60 dark:bg-emerald-900/10 p-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('animals.routineTemplates.title')}
                  </p>
                  <div className="space-y-1.5">
                    {routineTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => applyRoutineTemplate(tpl)}
                        className="w-full text-left px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-emerald-400 transition-colors"
                      >
                        <span className="block text-sm font-medium text-gray-800 dark:text-white">
                          {tpl.name || getRoutineTypeName(tpl.type)}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {getRoutineTypeName(tpl.type)} · {getFrequencyName(tpl.frequency)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {routines.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    {t('animals.noRoutines')}
                  </p>
                  <button 
                    onClick={openRoutineModalForCreate}
                    className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                  >
                    {t('animals.createRoutine')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {routines.map((routine) => (
                    <div
                      key={routine.id}
                      className={`p-4 rounded-lg border ${
                        routine.active
                          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-800 dark:text-white">
                            {routine.name || getRoutineTypeName(routine.type)}
                          </h3>
                          {routine.name && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {getRoutineTypeName(routine.type)}
                            </p>
                          )}
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {(routine.schedule as { time?: string })?.time ?? '—'} · {getFrequencyName(routine.frequency)}
                          </p>
                        </div>
                      <div className="flex items-center gap-1 shrink-0">
                          {routine.active && (
                            <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs rounded-full">
                              {t('routines.active')}
                            </span>
                          )}
                          {!routine.active && (
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-xs rounded-full">
                              En pause
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const updatedRoutine = { ...routine, active: !routine.active };
                              if (!animal || !token) return;
                              
                              const toggleActive = async () => {
                                try {
                                  await api.updateRoutine(animal.id, routine.id, { active: !routine.active }, token);
                                  await fetchAnimalData();
                                } catch (err) {
                                  console.error('Error toggling routine:', err);
                                }
                              };
                              toggleActive();
                            }}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="Basculer actif/pause"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => openRoutineModalForEdit(routine)}
                            className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                            title={t('routines.editRoutine')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRoutineToDelete(routine.id);
                              setShowDeleteRoutineConfirm(true);
                            }}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            title={t('routines.deleteRoutine')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* History link */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
                {t('animals.history')}
              </h2>
              <button 
                onClick={handleOpenHistoryModal}
                className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
              >
                {t('animals.viewHistory')}
              </button>
            </div>

            {/* Traitements (medications) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  {t('animals.medications.title')}
                </h2>
                {!medicationsLocked && (
                  <button
                    type="button"
                    onClick={openMedicationModalForCreate}
                    className="text-sm text-emerald-600 hover:text-emerald-700"
                  >
                    + {t('animals.medications.add')}
                  </button>
                )}
              </div>

              {medicationsLocked ? (
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                    {t('animals.medications.premiumRequired')}
                  </p>
                  <Link
                    href="/parametres/abonnement"
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    {t('premiumLock.goPremium')}
                  </Link>
                </div>
              ) : medicationsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full"></div>
                </div>
              ) : medicationsError ? (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {medicationsError}
                </div>
              ) : medications.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
                    {t('animals.medications.noData')}
                  </p>
                  <button
                    type="button"
                    onClick={openMedicationModalForCreate}
                    className="rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-4 py-3 text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                  >
                    + {t('animals.medications.add')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {medications.map((med) => (
                    <div
                      key={med.id}
                      className={`p-4 rounded-lg border ${
                        med.active
                          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-800 dark:text-white">
                              {med.name}
                            </h3>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                med.active
                                  ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                                  : 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200'
                              }`}
                            >
                              {med.active
                                ? t('animals.medications.active')
                                : t('animals.medications.inactive')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            {med.dose}
                            {med.unit ? ` ${med.unit}` : ''} · {getMedicationFrequencyName(med.frequency)}
                            {med.frequency === 'every_x_hours' && med.intervalHours
                              ? ` (${med.intervalHours} h)`
                              : ''}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t('animals.medications.startDate')}: {formatDate(med.startDate)}
                            {med.endDate
                              ? ` — ${t('animals.medications.endDate')}: ${formatDate(med.endDate)}`
                              : ''}
                          </p>
                          {med.notes && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                              {med.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {med.active && (
                            <button
                              type="button"
                              onClick={() => handleStopMedication(med.id)}
                              disabled={medicationStoppingId === med.id}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors disabled:opacity-50"
                              title={t('animals.medications.stop')}
                            >
                              {medicationStoppingId === med.id ? (
                                <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setMedicationToDelete(med.id);
                              setShowDeleteMedicationConfirm(true);
                            }}
                            disabled={medicationDeletingId === med.id}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                            title={t('animals.medications.delete')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RDV vétérinaires */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  {t('animals.vetAppointments.title')}
                </h2>
                <button
                  type="button"
                  onClick={openVetModalForCreate}
                  className="text-sm text-emerald-600 hover:text-emerald-700"
                >
                  + {t('animals.vetAppointments.add')}
                </button>
              </div>

              {vetAppointmentsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full"></div>
                </div>
              ) : vetAppointmentsError ? (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {vetAppointmentsError}
                </div>
              ) : vetAppointments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
                    {t('animals.vetAppointments.noData')}
                  </p>
                  <button
                    type="button"
                    onClick={openVetModalForCreate}
                    className="rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-4 py-3 text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                  >
                    + {t('animals.vetAppointments.add')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {vetAppointments.map((appt) => (
                    <div
                      key={appt.id}
                      className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-800 dark:text-white">
                              {appt.vetName}
                            </h3>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                appt.status === 'done'
                                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                                  : appt.status === 'cancelled'
                                    ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                                    : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                              }`}
                            >
                              {getVetStatusName(appt.status)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            {formatDateTime(appt.date)}
                          </p>
                          {appt.reason && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {appt.reason}
                            </p>
                          )}
                          {appt.location && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {appt.location}
                            </p>
                          )}
                          {appt.notes && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                              {appt.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {appt.status === 'scheduled' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleMarkVetDone(appt.id)}
                                disabled={vetStatusUpdatingId === appt.id}
                                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors disabled:opacity-50"
                                title={t('animals.vetAppointments.markDone')}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelVetAppointment(appt.id)}
                                disabled={vetStatusUpdatingId === appt.id}
                                className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-colors disabled:opacity-50"
                                title={t('animals.vetAppointments.cancel')}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setVetToDelete(appt.id);
                              setShowDeleteVetConfirm(true);
                            }}
                            disabled={vetDeletingId === appt.id}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                            title={t('animals.vetAppointments.delete')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Poids & mesures (Module C) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  {t('animals.measurements.title')}
                </h2>
                {!measurementsLocked && (
                  <button
                    type="button"
                    onClick={openMeasurementModalForCreate}
                    className="text-sm text-emerald-600 hover:text-emerald-700"
                  >
                    + {t('animals.measurements.add')}
                  </button>
                )}
              </div>

              {measurementsLocked ? (
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                    {t('animals.measurements.premiumRequired')}
                  </p>
                  <Link
                    href="/parametres/abonnement"
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    {t('premiumLock.goPremium')}
                  </Link>
                </div>
              ) : measurementsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full"></div>
                </div>
              ) : measurementsError ? (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {measurementsError}
                </div>
              ) : measurements.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
                    {t('animals.measurements.noData')}
                  </p>
                  <button
                    type="button"
                    onClick={openMeasurementModalForCreate}
                    className="rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-4 py-3 text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                  >
                    + {t('animals.measurements.add')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Courbe de poids */}
                  <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                    <WeightChart measurements={measurements} />
                  </div>

                  <div className="space-y-3">
                    {measurements.map((m) => (
                      <div
                        key={m.id}
                        className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-800 dark:text-white">
                              {formatDate(m.measuredAt)}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                              {m.weightKg !== null && m.weightKg !== undefined && (
                                <span className="mr-3">
                                  {t('animals.measurements.weightKg')}: <strong>{m.weightKg}</strong> kg
                                </span>
                              )}
                              {m.heightCm !== null && m.heightCm !== undefined && (
                                <span>
                                  {t('animals.measurements.heightCm')}: <strong>{m.heightCm}</strong> cm
                                </span>
                              )}
                            </p>
                            {m.notes && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                {m.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openMeasurementModalForEdit(m)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title={t('animals.measurements.edit')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMeasurementToDelete(m.id);
                                setShowDeleteMeasurementConfirm(true);
                              }}
                              disabled={measurementDeletingId === m.id}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                              title={t('animals.measurements.delete')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Vaccinations (Module C) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  {t('animals.vaccinations.title')}
                </h2>
                {!vaccinationsLocked && (
                  <button
                    type="button"
                    onClick={openVaccinationModalForCreate}
                    className="text-sm text-emerald-600 hover:text-emerald-700"
                  >
                    + {t('animals.vaccinations.add')}
                  </button>
                )}
              </div>

              {vaccinationsLocked ? (
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                    {t('animals.vaccinations.premiumRequired')}
                  </p>
                  <Link
                    href="/parametres/abonnement"
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    {t('premiumLock.goPremium')}
                  </Link>
                </div>
              ) : vaccinationsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full"></div>
                </div>
              ) : vaccinationsError ? (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {vaccinationsError}
                </div>
              ) : vaccinations.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
                    {t('animals.vaccinations.noData')}
                  </p>
                  <button
                    type="button"
                    onClick={openVaccinationModalForCreate}
                    className="rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-4 py-3 text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                  >
                    + {t('animals.vaccinations.add')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {vaccinations.map((v) => {
                    const isOverdue = !!v.nextDueDate && new Date(v.nextDueDate) <= new Date();
                    return (
                      <div
                        key={v.id}
                        className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-gray-800 dark:text-white">
                                {v.name}
                              </h3>
                              {v.nextDueDate && (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    isOverdue
                                      ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                                      : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                  }`}
                                >
                                  {isOverdue
                                    ? `${t('animals.vaccinations.overdue')} ${formatDate(v.nextDueDate)}`
                                    : `${t('animals.vaccinations.dueSoon')} ${formatDate(v.nextDueDate)}`}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                              {t('animals.vaccinations.date')}: {formatDate(v.date)}
                            </p>
                            {(v.batchNumber || v.vetName) && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {v.batchNumber && (
                                  <span className="mr-3">
                                    {t('animals.vaccinations.batchNumber')}: {v.batchNumber}
                                  </span>
                                )}
                                {v.vetName && (
                                  <span>
                                    {t('animals.vaccinations.vetName')}: {v.vetName}
                                  </span>
                                )}
                              </p>
                            )}
                            {v.notes && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                {v.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openVaccinationModalForEdit(v)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title={t('animals.vaccinations.edit')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setVaccinationToDelete(v.id);
                                setShowDeleteVaccinationConfirm(true);
                              }}
                              disabled={vaccinationDeletingId === v.id}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                              title={t('animals.vaccinations.delete')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reproduction (Module B) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  {t('animals.breeding.title')}
                </h2>
                {!breedingLocked && (
                  <button
                    type="button"
                    onClick={openBreedingModalForCreate}
                    className="text-sm text-emerald-600 hover:text-emerald-700"
                  >
                    + {t('animals.breeding.add')}
                  </button>
                )}
              </div>

              {breedingLocked ? (
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                    {t('animals.breeding.premiumRequired')}
                  </p>
                  <Link
                    href="/parametres/abonnement"
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    {t('premiumLock.goPremium')}
                  </Link>
                </div>
              ) : breedingLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full"></div>
                </div>
              ) : breedingError ? (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {breedingError}
                </div>
              ) : breedingRecords.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
                    {t('animals.breeding.noData')}
                  </p>
                  <button
                    type="button"
                    onClick={openBreedingModalForCreate}
                    className="rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-4 py-3 text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                  >
                    + {t('animals.breeding.add')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...breedingRecords]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((rec) => {
                      const meta = getBreedingEventMeta(rec.eventType);
                      return (
                        <div
                          key={rec.id}
                          className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-lg leading-none" aria-hidden="true">{meta.emoji}</span>
                                <h3 className="font-semibold text-gray-800 dark:text-white">
                                  {meta.label}
                                </h3>
                                {rec.eventType === 'birth' && rec.offspringCount != null && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                                    {rec.offspringCount} {t('animals.breeding.offspringBadge')}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                                {t('animals.breeding.date')}: {formatDate(rec.date)}
                                {rec.partnerName && (
                                  <span className="ml-3">
                                    {t('animals.breeding.partnerName')}: {rec.partnerName}
                                  </span>
                                )}
                              </p>
                              {rec.notes && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                  {rec.notes}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openBreedingModalForEdit(rec)}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                title={t('animals.breeding.edit')}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setBreedingToDelete(rec.id);
                                  setShowDeleteBreedingConfirm(true);
                                }}
                                disabled={breedingDeletingId === rec.id}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                                title={t('animals.breeding.delete')}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Export carnet (Module C) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
                {t('animals.carnet.export')}
              </h2>
              <button
                type="button"
                onClick={handleExportCarnet}
                disabled={exportingCarnet}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-4 py-3 text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
              >
                {exportingCarnet ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    {t('common.loading')}
                  </>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                {!exportingCarnet && t('animals.carnet.export')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Routine Modal */}
      {showRoutineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 md:p-8 max-w-[384px] w-full my-auto">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">
              {editingRoutineId ? t('routines.editRoutine') : t('routines.addRoutine')}
            </h2>
            
            <form onSubmit={handleSaveRoutine} className="space-y-5">
              {/* Name (optional) */}
              <div>
                <label htmlFor="routine-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nom de la routine (optionnel)
                </label>
                <input
                  id="routine-name"
                  type="text"
                  value={routineName}
                  onChange={(e) => setRoutineName(e.target.value)}
                  placeholder="ex. Nourriture du matin"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Type */}
              <div>
                <label htmlFor="routine-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('routines.type')} *
                </label>
                <select
                  id="routine-type"
                  value={routineType}
                  onChange={(e) => setRoutineType(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="nourrissage">{t('routines.types.feeding')}</option>
                  <option value="entretien">{t('routines.types.cleaning')}</option>
                  <option value="uvb">{t('routines.types.uvb')}</option>
                  <option value="controle">{t('routines.types.health')}</option>
                </select>
              </div>

              {/* Frequency / Recurrence (same as notifications) */}
              <div>
                <label htmlFor="routine-frequency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('routines.frequency')} *
                </label>
                <select
                  id="routine-frequency"
                  value={routineFrequency}
                  onChange={(e) => setRoutineFrequency(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="daily">{t('routines.frequencies.daily')}</option>
                  <option value="every_2_days">{t('routines.frequencies.every_2_days')}</option>
                  <option value="every_3_days">{t('routines.frequencies.every_3_days')}</option>
                  <option value="weekly">{t('routines.frequencies.weekly')}</option>
                  <option value="monthly">{t('routines.frequencies.monthly')}</option>
                  <option value="once">{t('routines.frequencies.once')}</option>
                  <option value="hourly">{t('routines.frequencies.hourly')}</option>
                  <option value="custom">{t('routines.frequencies.custom')}</option>
                </select>
              </div>

              {/* Time */}
              <div>
                <label htmlFor="routine-time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('routines.schedule')}
                </label>
                <input
                  id="routine-time"
                  type="time"
                  value={routineTime}
                  onChange={(e) => setRoutineTime(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Optional: date (once), weekDay (weekly), dayOfMonth (monthly), intervalHours (hourly) */}
              {routineFrequency === 'once' && (
                <div>
                  <label htmlFor="routine-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('notifications.date')}
                  </label>
                  <input
                    id="routine-date"
                    type="date"
                    value={routineDate}
                    onChange={(e) => setRoutineDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              )}
              {routineFrequency === 'weekly' && (
                <div>
                  <label htmlFor="routine-weekday" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('notifications.weekDay')}
                  </label>
                  <select
                    id="routine-weekday"
                    value={routineWeekDay}
                    onChange={(e) => setRoutineWeekDay(parseInt(e.target.value, 10))}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                      <option key={d} value={d}>{t(`notifications.weekDay${d}` as Parameters<typeof t>[0])}</option>
                    ))}
                  </select>
                </div>
              )}
              {routineFrequency === 'monthly' && (
                <div>
                  <label htmlFor="routine-daymonth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Jour du mois (1-31)
                  </label>
                  <input
                    id="routine-daymonth"
                    type="number"
                    min={1}
                    max={31}
                    value={routineDayOfMonth}
                    onChange={(e) => setRoutineDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1)))}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              )}
              {routineFrequency === 'hourly' && (
                <div>
                  <label htmlFor="routine-interval" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Toutes les X heures (1-24)
                  </label>
                  <input
                    id="routine-interval"
                    type="number"
                    min={1}
                    max={24}
                    value={routineIntervalHours}
                    onChange={(e) => setRoutineIntervalHours(Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 2)))}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              )}

              {/* Active (both create and edit) */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={routineActive}
                  onChange={(e) => setRoutineActive(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{t('routines.active')}</span>
              </label>

              {/* Error message */}
              {routineError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {routineError}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-6">
                <button
                  type="submit"
                  disabled={isCreatingRoutine}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                    isCreatingRoutine
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {isCreatingRoutine ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      {t('common.loading')}
                    </span>
                  ) : (
                    t('common.save')
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRoutineModal(false);
                    setEditingRoutineId(null);
                    setRoutineError('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Health record modal (carnet de santé) — en-tête fixe, corps scrollable, boutons fixes */}
      {showHealthModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="health-modal-title"
          onClick={(e) => e.target === e.currentTarget && (setShowHealthModal(false), setHealthError(''))}
        >
          <div
            className="relative w-full max-w-lg max-h-[85vh] min-h-[320px] flex flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 px-6 pt-6 pb-3 border-b border-gray-200 dark:border-gray-600">
              <h2 id="health-modal-title" className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
                {editingHealthId ? t('common.edit') : t('animals.healthRecordAdd')}
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {t('animals.healthRecordFormIntro')}
              </p>
            </div>

            <form onSubmit={handleSaveHealthRecord} className="flex flex-col flex-1 min-h-0 flex overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div className="p-6 space-y-6">
                  {/* Type */}
                  <fieldset className="space-y-2">
                    <legend className="text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.healthRecordType')} <span className="text-red-500">*</span>
                    </legend>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('animals.healthRecordTypeHelp')}
                    </p>
                    <div className="grid gap-2 mt-3" role="radiogroup" aria-label={t('animals.healthRecordType')}>
                      {(['vaccine', 'surgery', 'specific_food', 'medical_history'] as const).map((type) => (
                        <label
                          key={type}
                          className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${
                            healthFormType === type
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-500'
                              : 'border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-700/30 hover:border-gray-300 dark:hover:border-gray-500'
                          }`}
                        >
                          <input
                            type="radio"
                            name="health-type"
                            value={type}
                            checked={healthFormType === type}
                            onChange={() => setHealthFormType(type)}
                            className="w-5 h-5 shrink-0 text-emerald-600 border-gray-300 focus:ring-emerald-500"
                          />
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {t(`animals.healthRecordTypes.${type}`)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {/* Titre */}
                  <div className="space-y-1.5">
                    <label htmlFor="health-title" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.healthRecordTitle')} <span className="text-red-500">*</span>
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('animals.healthRecordTitleHelp')}
                    </p>
                    <input
                      id="health-title"
                      type="text"
                      value={healthFormTitle}
                      onChange={(e) => setHealthFormTitle(e.target.value)}
                      placeholder={t('animals.healthRecordPlaceholderTitle')}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      required
                      autoComplete="off"
                    />
                  </div>

                  {/* Date */}
                  <div className="space-y-1.5">
                    <label htmlFor="health-date" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.healthRecordDate')} <span className="text-red-500">*</span>
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('animals.healthRecordDateHelp')}
                    </p>
                    <input
                      id="health-date"
                      type="date"
                      value={healthFormDate}
                      onChange={(e) => setHealthFormDate(e.target.value)}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      required
                    />
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <label htmlFor="health-notes" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.healthRecordNotes')}
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('animals.healthRecordNotesHelp')}
                    </p>
                    <textarea
                      id="health-notes"
                      value={healthFormNotes}
                      onChange={(e) => setHealthFormNotes(e.target.value)}
                      placeholder={t('animals.healthRecordPlaceholderNotes')}
                      rows={3}
                      className="w-full resize-y min-h-[88px] rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {healthError && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">
                      {healthError}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 flex gap-3 p-6 pt-4 border-t border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
                <button
                  type="submit"
                  disabled={healthSubmitting}
                  className={`flex-1 rounded-xl px-4 py-3.5 text-base font-semibold transition-colors ${
                    healthSubmitting
                      ? 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800'
                  }`}
                >
                  {healthSubmitting ? t('common.loading') : t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowHealthModal(false); setHealthError(''); }}
                  className="flex-1 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3.5 text-base font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Animal Modal — même structure que carnet de santé (en-tête, scroll, boutons fixes) */}
      {showEditAnimalModal && animal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-animal-modal-title"
          onClick={(e) => e.target === e.currentTarget && setShowEditAnimalModal(false)}
        >
          <div
            className="relative w-full max-w-lg max-h-[85vh] min-h-[320px] flex flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 px-6 pt-6 pb-3 border-b border-gray-200 dark:border-gray-600">
              <h2 id="edit-animal-modal-title" className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
                {t('animals.editAnimal')}
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {t('animals.editAnimalFormIntro')}
              </p>
            </div>

            <form onSubmit={handleSaveEditAnimal} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div className="p-6 space-y-6">
                  {/* Nom */}
                  <div className="space-y-1.5">
                    <label htmlFor="edit-animal-name" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.animalName')} <span className="text-red-500">*</span>
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('animals.nameHelp')}
                    </p>
                    <input
                      id="edit-animal-name"
                      type="text"
                      value={editAnimalName}
                      onChange={(e) => setEditAnimalName(e.target.value)}
                      placeholder={t('animals.namePlaceholder')}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      required
                    />
                  </div>

                  {/* Date de naissance */}
                  <div className="space-y-1.5">
                    <label htmlFor="edit-animal-birthdate" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.birthDate')}
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('animals.birthDateHelp')}
                    </p>
                    <input
                      id="edit-animal-birthdate"
                      type="date"
                      value={editAnimalBirthDate}
                      onChange={(e) => setEditAnimalBirthDate(e.target.value)}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {/* Sexe */}
                  <fieldset className="space-y-2">
                    <legend className="text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.sex')}
                    </legend>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('animals.sexHelp')}
                    </p>
                    <div className="grid gap-2 mt-3" role="radiogroup" aria-label={t('animals.sex')}>
                      {['male', 'female', 'unknown'].map((sex) => (
                        <label
                          key={sex}
                          className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${
                            editAnimalSex === sex
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-500'
                              : 'border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-700/30 hover:border-gray-300 dark:hover:border-gray-500'
                          }`}
                        >
                          <input
                            type="radio"
                            name="edit-animal-sex"
                            value={sex}
                            checked={editAnimalSex === sex}
                            onChange={() => setEditAnimalSex(sex)}
                            className="w-5 h-5 shrink-0 text-emerald-600 border-gray-300 focus:ring-emerald-500"
                          />
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {t(`animals.${sex}`)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {/* Père / Mère (module F) */}
                  {(() => {
                    const others = candidateAnimals.filter((a) => a.id !== animal.id);
                    const bySpecies = (list: Animal[]) =>
                      [...list].sort(
                        (a, b) =>
                          (a.speciesId === animal.speciesId ? 0 : 1) -
                          (b.speciesId === animal.speciesId ? 0 : 1)
                      );
                    const fatherCandidates = bySpecies(
                      others.filter((a) => !a.sex || a.sex === 'male' || a.sex === 'unknown')
                    );
                    const motherCandidates = bySpecies(
                      others.filter((a) => !a.sex || a.sex === 'female' || a.sex === 'unknown')
                    );
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ParentSelect
                          label={t('animals.edit.father')}
                          value={editFatherId}
                          onChange={setEditFatherId}
                          candidates={fatherCandidates}
                          noneLabel={t('animals.family.none')}
                        />
                        <ParentSelect
                          label={t('animals.edit.mother')}
                          value={editMotherId}
                          onChange={setEditMotherId}
                          candidates={motherCandidates}
                          noneLabel={t('animals.family.none')}
                        />
                      </div>
                    );
                  })()}

                  {/* Groupe / Enclos (module F) */}
                  <div className="space-y-1.5">
                    <label htmlFor="edit-animal-group" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.edit.group')}
                    </label>
                    <input
                      id="edit-animal-group"
                      type="text"
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      placeholder={t('animals.family.groupPlaceholder')}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {/* Photo de profil */}
                  <div className="space-y-1.5">
                    <label className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.profilePhoto')}
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('animals.profilePhotoHelp')}
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      className="block w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 dark:file:bg-emerald-900/30 dark:file:text-emerald-200 file:font-medium rounded-xl border-2 border-gray-200 dark:border-gray-600 border-dashed p-3"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const r = new FileReader();
                        r.onload = () => setEditAnimalProfilePhotoUrl(r.result as string);
                        r.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                    <input
                      id="edit-animal-profile-photo"
                      type="url"
                      value={editAnimalProfilePhotoUrl.startsWith('data:') ? '' : editAnimalProfilePhotoUrl}
                      onChange={(e) => setEditAnimalProfilePhotoUrl(e.target.value)}
                      placeholder={t('animals.profilePhotoPlaceholder')}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 mt-2"
                    />
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <label htmlFor="edit-animal-notes" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.notes')}
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('animals.notesHelp')}
                    </p>
                    <textarea
                      id="edit-animal-notes"
                      value={editAnimalNotes}
                      onChange={(e) => setEditAnimalNotes(e.target.value)}
                      placeholder={t('animals.notesPlaceholder')}
                      rows={3}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {editAnimalError && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">
                      {editAnimalError}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 flex gap-3 p-6 pt-4 border-t border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
                <button
                  type="submit"
                  disabled={editAnimalSubmitting}
                  className={`flex-1 rounded-xl px-4 py-3.5 text-base font-semibold transition-colors ${
                    editAnimalSubmitting
                      ? 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800'
                  }`}
                >
                  {editAnimalSubmitting ? t('common.loading') : t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditAnimalModal(false)}
                  className="flex-1 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3.5 text-base font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR code modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-[384px]">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('premiumLock.qrCode')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('premiumLock.qrCodeHelp')}</p>
            {qrLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent" />
              </div>
            ) : qrDataUrl ? (
              <div className="flex flex-col items-center">
                <img src={qrDataUrl} alt="QR Code" className="w-64 h-64 rounded-lg bg-white p-2" />
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 break-all text-center max-w-full">{qrUrl}</p>
              </div>
            ) : qrError ? (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm text-center">
                {qrError}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setShowQRModal(false)}
              className="mt-4 w-full py-2 rounded-xl border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}

      {/* Delete routine confirmation */}
      {showDeleteRoutineConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-[384px] w-full">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
              {t('routines.deleteRoutine')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
              {t('common.confirmDelete')}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDeleteRoutine}
                disabled={isDeletingRoutine}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isDeletingRoutine ? t('common.loading') : t('common.delete')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteRoutineConfirm(false);
                  setRoutineToDelete(null);
                }}
                disabled={isDeletingRoutine}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete health record confirmation */}
      {showDeleteHealthConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-[384px] w-full">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
              {t('animals.deleteHealthRecord')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
              {t('common.confirmDelete')}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => healthRecordToDelete && handleDeleteHealthRecord(healthRecordToDelete)}
                disabled={healthDeletingId !== null}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {healthDeletingId !== null ? t('common.loading') : t('common.delete')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteHealthConfirm(false);
                  setHealthRecordToDelete(null);
                }}
                disabled={healthDeletingId !== null}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Medication modal (ajout d'un traitement) */}
      {showMedicationModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="medication-modal-title"
          onClick={(e) => e.target === e.currentTarget && (setShowMedicationModal(false), setMedicationFormError(''))}
        >
          <div
            className="relative w-full max-w-lg max-h-[85vh] min-h-[320px] flex flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 px-6 pt-6 pb-3 border-b border-gray-200 dark:border-gray-600">
              <h2 id="medication-modal-title" className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
                {t('animals.medications.add')}
              </h2>
            </div>

            <form onSubmit={handleSaveMedication} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div className="p-6 space-y-5">
                  {/* Nom */}
                  <div className="space-y-1.5">
                    <label htmlFor="medication-name" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.medications.name')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="medication-name"
                      type="text"
                      value={medicationName}
                      onChange={(e) => setMedicationName(e.target.value)}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      required
                      autoComplete="off"
                    />
                  </div>

                  {/* Dose + unité */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="medication-dose" className="block text-base font-semibold text-gray-900 dark:text-white">
                        {t('animals.medications.dose')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="medication-dose"
                        type="text"
                        value={medicationDose}
                        onChange={(e) => setMedicationDose(e.target.value)}
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        required
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="medication-unit" className="block text-base font-semibold text-gray-900 dark:text-white">
                        {t('animals.medications.unit')}
                      </label>
                      <input
                        id="medication-unit"
                        type="text"
                        value={medicationUnit}
                        onChange={(e) => setMedicationUnit(e.target.value)}
                        placeholder="ml / mg / gouttes…"
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  {/* Fréquence */}
                  <div className="space-y-1.5">
                    <label htmlFor="medication-frequency" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.medications.frequency')} <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="medication-frequency"
                      value={medicationFrequency}
                      onChange={(e) => setMedicationFrequency(e.target.value as 'daily' | 'every_x_hours' | 'weekly')}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="daily">{t('animals.medications.frequencyDaily')}</option>
                      <option value="every_x_hours">{t('animals.medications.frequencyEveryXHours')}</option>
                      <option value="weekly">{t('animals.medications.frequencyWeekly')}</option>
                    </select>
                  </div>

                  {medicationFrequency === 'every_x_hours' && (
                    <div className="space-y-1.5">
                      <label htmlFor="medication-interval" className="block text-base font-semibold text-gray-900 dark:text-white">
                        {t('animals.medications.intervalHours')}
                      </label>
                      <input
                        id="medication-interval"
                        type="number"
                        min={1}
                        max={24}
                        value={medicationIntervalHours}
                        onChange={(e) => setMedicationIntervalHours(Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 8)))}
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  )}

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="medication-start" className="block text-base font-semibold text-gray-900 dark:text-white">
                        {t('animals.medications.startDate')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="medication-start"
                        type="date"
                        value={medicationStartDate}
                        onChange={(e) => setMedicationStartDate(e.target.value)}
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="medication-end" className="block text-base font-semibold text-gray-900 dark:text-white">
                        {t('animals.medications.endDate')}
                      </label>
                      <input
                        id="medication-end"
                        type="date"
                        value={medicationEndDate}
                        onChange={(e) => setMedicationEndDate(e.target.value)}
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <label htmlFor="medication-notes" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.medications.notes')}
                    </label>
                    <textarea
                      id="medication-notes"
                      value={medicationNotes}
                      onChange={(e) => setMedicationNotes(e.target.value)}
                      rows={3}
                      className="w-full resize-y min-h-[88px] rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {medicationFormError && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">
                      {medicationFormError}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 flex gap-3 p-6 pt-4 border-t border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
                <button
                  type="submit"
                  disabled={medicationSubmitting}
                  className={`flex-1 rounded-xl px-4 py-3.5 text-base font-semibold transition-colors ${
                    medicationSubmitting
                      ? 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800'
                  }`}
                >
                  {medicationSubmitting ? t('common.loading') : t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowMedicationModal(false); setMedicationFormError(''); }}
                  className="flex-1 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3.5 text-base font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vet appointment modal (ajout d'un RDV) */}
      {showVetModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vet-modal-title"
          onClick={(e) => e.target === e.currentTarget && (setShowVetModal(false), setVetFormError(''))}
        >
          <div
            className="relative w-full max-w-lg max-h-[85vh] min-h-[320px] flex flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 px-6 pt-6 pb-3 border-b border-gray-200 dark:border-gray-600">
              <h2 id="vet-modal-title" className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
                {t('animals.vetAppointments.add')}
              </h2>
            </div>

            <form onSubmit={handleSaveVetAppointment} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div className="p-6 space-y-5">
                  {/* Vétérinaire */}
                  <div className="space-y-1.5">
                    <label htmlFor="vet-name" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.vetAppointments.vetName')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="vet-name"
                      type="text"
                      value={vetName}
                      onChange={(e) => setVetName(e.target.value)}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      required
                      autoComplete="off"
                    />
                  </div>

                  {/* Motif */}
                  <div className="space-y-1.5">
                    <label htmlFor="vet-reason" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.vetAppointments.reason')}
                    </label>
                    <input
                      id="vet-reason"
                      type="text"
                      value={vetReason}
                      onChange={(e) => setVetReason(e.target.value)}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      autoComplete="off"
                    />
                  </div>

                  {/* Date + heure */}
                  <div className="space-y-1.5">
                    <label htmlFor="vet-date" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.vetAppointments.date')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="vet-date"
                      type="datetime-local"
                      value={vetDate}
                      onChange={(e) => setVetDate(e.target.value)}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      required
                    />
                  </div>

                  {/* Lieu */}
                  <div className="space-y-1.5">
                    <label htmlFor="vet-location" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.vetAppointments.location')}
                    </label>
                    <input
                      id="vet-location"
                      type="text"
                      value={vetLocation}
                      onChange={(e) => setVetLocation(e.target.value)}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      autoComplete="off"
                    />
                  </div>

                  {/* Rappels */}
                  <fieldset className="space-y-2">
                    <legend className="text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.vetAppointments.reminders')}
                    </legend>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={vetReminderJ7}
                          onChange={(e) => setVetReminderJ7(e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {t('animals.vetAppointments.reminderJ7')}
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={vetReminderJ1}
                          onChange={(e) => setVetReminderJ1(e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {t('animals.vetAppointments.reminderJ1')}
                        </span>
                      </label>
                    </div>
                  </fieldset>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <label htmlFor="vet-notes" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.vetAppointments.notes')}
                    </label>
                    <textarea
                      id="vet-notes"
                      value={vetNotes}
                      onChange={(e) => setVetNotes(e.target.value)}
                      rows={3}
                      className="w-full resize-y min-h-[88px] rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {vetFormError && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">
                      {vetFormError}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 flex gap-3 p-6 pt-4 border-t border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
                <button
                  type="submit"
                  disabled={vetSubmitting}
                  className={`flex-1 rounded-xl px-4 py-3.5 text-base font-semibold transition-colors ${
                    vetSubmitting
                      ? 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800'
                  }`}
                >
                  {vetSubmitting ? t('common.loading') : t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowVetModal(false); setVetFormError(''); }}
                  className="flex-1 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3.5 text-base font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete medication confirmation */}
      {showDeleteMedicationConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-[384px] w-full">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
              {t('animals.medications.delete')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
              {t('common.confirmDelete')}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDeleteMedication}
                disabled={medicationDeletingId !== null}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {medicationDeletingId !== null ? t('common.loading') : t('common.delete')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteMedicationConfirm(false);
                  setMedicationToDelete(null);
                }}
                disabled={medicationDeletingId !== null}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete vet appointment confirmation */}
      {showDeleteVetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-[384px] w-full">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
              {t('animals.vetAppointments.delete')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
              {t('common.confirmDelete')}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDeleteVetAppointment}
                disabled={vetDeletingId !== null}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {vetDeletingId !== null ? t('common.loading') : t('common.delete')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteVetConfirm(false);
                  setVetToDelete(null);
                }}
                disabled={vetDeletingId !== null}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Measurement modal (ajout/modification d'une mesure) */}
      {showMeasurementModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="measurement-modal-title"
          onClick={(e) => e.target === e.currentTarget && (setShowMeasurementModal(false), setMeasurementFormError(''))}
        >
          <div
            className="relative w-full max-w-lg max-h-[85vh] min-h-[320px] flex flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 px-6 pt-6 pb-3 border-b border-gray-200 dark:border-gray-600">
              <h2 id="measurement-modal-title" className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
                {editingMeasurementId ? t('animals.measurements.edit') : t('animals.measurements.add')}
              </h2>
            </div>

            <form onSubmit={handleSaveMeasurement} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div className="p-6 space-y-5">
                  <div className="space-y-1.5">
                    <label htmlFor="measurement-date" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.measurements.date')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="measurement-date"
                      type="date"
                      value={measurementDate}
                      onChange={(e) => setMeasurementDate(e.target.value)}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="measurement-weight" className="block text-base font-semibold text-gray-900 dark:text-white">
                        {t('animals.measurements.weightKg')}
                      </label>
                      <input
                        id="measurement-weight"
                        type="number"
                        step="0.01"
                        min="0"
                        value={measurementWeight}
                        onChange={(e) => setMeasurementWeight(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="measurement-height" className="block text-base font-semibold text-gray-900 dark:text-white">
                        {t('animals.measurements.heightCm')}
                      </label>
                      <input
                        id="measurement-height"
                        type="number"
                        step="0.1"
                        min="0"
                        value={measurementHeight}
                        onChange={(e) => setMeasurementHeight(e.target.value)}
                        placeholder="0.0"
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="measurement-notes" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.measurements.notes')}
                    </label>
                    <textarea
                      id="measurement-notes"
                      value={measurementNotes}
                      onChange={(e) => setMeasurementNotes(e.target.value)}
                      rows={3}
                      className="w-full resize-y min-h-[88px] rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {measurementFormError && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">
                      {measurementFormError}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 flex gap-3 p-6 pt-4 border-t border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
                <button
                  type="submit"
                  disabled={measurementSubmitting}
                  className={`flex-1 rounded-xl px-4 py-3.5 text-base font-semibold transition-colors ${
                    measurementSubmitting
                      ? 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800'
                  }`}
                >
                  {measurementSubmitting ? t('common.loading') : t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowMeasurementModal(false); setMeasurementFormError(''); }}
                  className="flex-1 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3.5 text-base font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vaccination modal (ajout/modification d'un vaccin) */}
      {showVaccinationModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vaccination-modal-title"
          onClick={(e) => e.target === e.currentTarget && (setShowVaccinationModal(false), setVaccinationFormError(''))}
        >
          <div
            className="relative w-full max-w-lg max-h-[85vh] min-h-[320px] flex flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 px-6 pt-6 pb-3 border-b border-gray-200 dark:border-gray-600">
              <h2 id="vaccination-modal-title" className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
                {editingVaccinationId ? t('animals.vaccinations.edit') : t('animals.vaccinations.add')}
              </h2>
            </div>

            <form onSubmit={handleSaveVaccination} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div className="p-6 space-y-5">
                  <div className="space-y-1.5">
                    <label htmlFor="vaccination-name" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.vaccinations.name')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="vaccination-name"
                      type="text"
                      value={vaccinationName}
                      onChange={(e) => setVaccinationName(e.target.value)}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      required
                      autoComplete="off"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="vaccination-date" className="block text-base font-semibold text-gray-900 dark:text-white">
                        {t('animals.vaccinations.date')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="vaccination-date"
                        type="date"
                        value={vaccinationDate}
                        onChange={(e) => setVaccinationDate(e.target.value)}
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="vaccination-next-due" className="block text-base font-semibold text-gray-900 dark:text-white">
                        {t('animals.vaccinations.nextDue')}
                      </label>
                      <input
                        id="vaccination-next-due"
                        type="date"
                        value={vaccinationNextDue}
                        onChange={(e) => setVaccinationNextDue(e.target.value)}
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="vaccination-batch" className="block text-base font-semibold text-gray-900 dark:text-white">
                        {t('animals.vaccinations.batchNumber')}
                      </label>
                      <input
                        id="vaccination-batch"
                        type="text"
                        value={vaccinationBatch}
                        onChange={(e) => setVaccinationBatch(e.target.value)}
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="vaccination-vet" className="block text-base font-semibold text-gray-900 dark:text-white">
                        {t('animals.vaccinations.vetName')}
                      </label>
                      <input
                        id="vaccination-vet"
                        type="text"
                        value={vaccinationVet}
                        onChange={(e) => setVaccinationVet(e.target.value)}
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="vaccination-notes" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.vaccinations.notes')}
                    </label>
                    <textarea
                      id="vaccination-notes"
                      value={vaccinationNotes}
                      onChange={(e) => setVaccinationNotes(e.target.value)}
                      rows={3}
                      className="w-full resize-y min-h-[88px] rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {vaccinationFormError && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">
                      {vaccinationFormError}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 flex gap-3 p-6 pt-4 border-t border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
                <button
                  type="submit"
                  disabled={vaccinationSubmitting}
                  className={`flex-1 rounded-xl px-4 py-3.5 text-base font-semibold transition-colors ${
                    vaccinationSubmitting
                      ? 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800'
                  }`}
                >
                  {vaccinationSubmitting ? t('common.loading') : t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowVaccinationModal(false); setVaccinationFormError(''); }}
                  className="flex-1 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3.5 text-base font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Breeding record modal (ajout/modification d'un événement de reproduction) */}
      {showBreedingModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="breeding-modal-title"
          onClick={(e) => e.target === e.currentTarget && (setShowBreedingModal(false), setBreedingFormError(''))}
        >
          <div
            className="relative w-full max-w-lg max-h-[85vh] min-h-[320px] flex flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 px-6 pt-6 pb-3 border-b border-gray-200 dark:border-gray-600">
              <h2 id="breeding-modal-title" className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
                {editingBreedingId ? t('animals.breeding.edit') : t('animals.breeding.add')}
              </h2>
            </div>

            <form onSubmit={handleSaveBreedingRecord} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div className="p-6 space-y-5">
                  <div className="space-y-1.5">
                    <label htmlFor="breeding-event-type" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.breeding.eventType')} <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="breeding-event-type"
                      value={breedingEventType}
                      onChange={(e) => setBreedingEventType(e.target.value as BreedingRecord['eventType'])}
                      className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {(['heat', 'mating', 'pregnancy', 'birth', 'weaning'] as const).map((type) => (
                        <option key={type} value={type}>
                          {getBreedingEventMeta(type).emoji} {getBreedingEventMeta(type).label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="breeding-date" className="block text-base font-semibold text-gray-900 dark:text-white">
                        {t('animals.breeding.date')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="breeding-date"
                        type="date"
                        value={breedingDate}
                        onChange={(e) => setBreedingDate(e.target.value)}
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="breeding-partner" className="block text-base font-semibold text-gray-900 dark:text-white">
                        {t('animals.breeding.partnerName')}
                      </label>
                      <input
                        id="breeding-partner"
                        type="text"
                        value={breedingPartnerName}
                        onChange={(e) => setBreedingPartnerName(e.target.value)}
                        placeholder={t('animals.breeding.partnerNamePlaceholder')}
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  {breedingEventType === 'birth' && (
                    <div className="space-y-1.5">
                      <label htmlFor="breeding-offspring" className="block text-base font-semibold text-gray-900 dark:text-white">
                        {t('animals.breeding.offspringCount')}
                      </label>
                      <input
                        id="breeding-offspring"
                        type="number"
                        min={1}
                        value={breedingOffspringCount}
                        onChange={(e) => setBreedingOffspringCount(e.target.value)}
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label htmlFor="breeding-notes" className="block text-base font-semibold text-gray-900 dark:text-white">
                      {t('animals.breeding.notes')}
                    </label>
                    <textarea
                      id="breeding-notes"
                      value={breedingNotes}
                      onChange={(e) => setBreedingNotes(e.target.value)}
                      rows={3}
                      className="w-full resize-y min-h-[88px] rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {breedingFormError && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">
                      {breedingFormError}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 flex gap-3 p-6 pt-4 border-t border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
                <button
                  type="submit"
                  disabled={breedingSubmitting}
                  className={`flex-1 rounded-xl px-4 py-3.5 text-base font-semibold transition-colors ${
                    breedingSubmitting
                      ? 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800'
                  }`}
                >
                  {breedingSubmitting ? t('common.loading') : t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowBreedingModal(false); setBreedingFormError(''); }}
                  className="flex-1 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3.5 text-base font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete measurement confirmation */}
      {showDeleteMeasurementConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-[384px] w-full">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
              {t('animals.measurements.delete')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('animals.measurements.deleteConfirm')}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteMeasurementConfirm(false);
                  setMeasurementToDelete(null);
                }}
                disabled={measurementDeletingId !== null}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteMeasurement}
                disabled={measurementDeletingId !== null}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {measurementDeletingId !== null ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete vaccination confirmation */}
      {showDeleteVaccinationConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-[384px] w-full">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
              {t('animals.vaccinations.delete')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('animals.vaccinations.deleteConfirm')}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteVaccinationConfirm(false);
                  setVaccinationToDelete(null);
                }}
                disabled={vaccinationDeletingId !== null}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteVaccination}
                disabled={vaccinationDeletingId !== null}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {vaccinationDeletingId !== null ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete breeding record confirmation */}
      {showDeleteBreedingConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-[384px] w-full">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
              {t('animals.breeding.delete')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('animals.breeding.deleteConfirm')}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteBreedingConfirm(false);
                  setBreedingToDelete(null);
                }}
                disabled={breedingDeletingId !== null}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteBreedingRecord}
                disabled={breedingDeletingId !== null}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {breedingDeletingId !== null ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 md:p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto my-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                {t('animals.history')}
              </h2>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full"></div>
              </div>
            ) : historyError ? (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
                {historyError}
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {t('animals.noHistory') || 'Aucun historique'}
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-800 dark:text-white">
                        {entry.type}
                      </h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(entry.doneAt).toLocaleDateString()} {new Date(entry.doneAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {entry.note && (
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {entry.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
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
              {t('common.confirmDelete') || `Êtes-vous sûr de vouloir supprimer ${animal?.name} ? Cette action est irréversible.`}
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
