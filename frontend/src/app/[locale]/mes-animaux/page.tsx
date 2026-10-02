'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { animalCarnetPath, animalDetailPath } from '@/lib/platform';
import { api, type Animal as ApiAnimal, type SpeciesRoutineTemplate } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import Modal from '@/components/ui/Modal';

interface Animal extends ApiAnimal {
  speciesName?: string;
  _count?: {
    routines: number;
    history: number;
  };
}

interface SpeciesResult {
  key: number;
  scientificName: string;
  canonicalName?: string;
  vernacularName?: string;
}

function MyAnimalsPageContent() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, token, isLoading: authLoading, logout } = useAuth();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formSpeciesId, setFormSpeciesId] = useState<number | null>(null);
  const [formSpeciesName, setFormSpeciesName] = useState('');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formSex, setFormSex] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formProfilePhotoUrl, setFormProfilePhotoUrl] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Routines recommandées pour l'espèce (module D) — affichées après création
  const [newAnimalId, setNewAnimalId] = useState<string | null>(null);
  const [routineTemplates, setRoutineTemplates] = useState<SpeciesRoutineTemplate[]>([]);
  const [checkedTemplateIds, setCheckedTemplateIds] = useState<Set<string>>(new Set());
  const [templatesAdding, setTemplatesAdding] = useState(false);
  const [templatesError, setTemplatesError] = useState('');

  // Change photo directly on card
  const [photoAnimalId, setPhotoAnimalId] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const cardPhotoInputRef = useRef<HTMLInputElement>(null);

  // Species autocomplete
  const [speciesQuery, setSpeciesQuery] = useState('');
  const [speciesResults, setSpeciesResults] = useState<SpeciesResult[]>([]);
  const [speciesSearching, setSpeciesSearching] = useState(false);
  const [showSpeciesDropdown, setShowSpeciesDropdown] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && token) {
      fetchAnimals();
    }
  }, [user, token]);

  // Debounced species search
  useEffect(() => {
    if (speciesQuery.length < 2) {
      setSpeciesResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSpeciesSearching(true);
      try {
        const results = await api.searchSpecies(speciesQuery, 10);
        setSpeciesResults((results.results || []) as SpeciesResult[]);
        setShowSpeciesDropdown(true);
      } catch (error) {
        console.error('Species search error:', error);
      } finally {
        setSpeciesSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [speciesQuery]);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchAnimals = async () => {
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
  };

  const handleCardPhotoClick = (e: React.MouseEvent, animalId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setPhotoAnimalId(animalId);
    cardPhotoInputRef.current?.click();
  };

  const handleCardPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = photoAnimalId;
    if (!file || !id || !token) {
      e.target.value = '';
      return;
    }
    setPhotoUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      await api.updateAnimal(id, { photos: [dataUrl] }, token);
      await fetchAnimals();
      setToast(t('animals.animalUpdated'));
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      if (msg.includes('unauthorized') || msg.includes('non autorisé') || msg.includes('forbidden') || msg.includes('403') || msg.includes('401')) {
        logout();
        router.push('/login');
        return;
      }
      console.error('Error updating photo:', err);
      setToast(t('animals.errorAdding'));
    } finally {
      setPhotoUploading(false);
      setPhotoAnimalId(null);
      e.target.value = '';
    }
  };

  const handleSpeciesSelect = (species: SpeciesResult) => {
    setFormSpeciesId(species.key);
    setFormSpeciesName(species.canonicalName || species.scientificName);
    setSpeciesQuery(species.vernacularName 
      ? `${species.vernacularName} (${species.scientificName})`
      : species.scientificName
    );
    setShowSpeciesDropdown(false);
  };

  const resetForm = () => {
    setFormName('');
    setFormSpeciesId(null);
    setFormSpeciesName('');
    setFormBirthDate('');
    setFormSex('');
    setFormNotes('');
    setFormProfilePhotoUrl('');
    setSpeciesQuery('');
    setFormError('');
    setNewAnimalId(null);
    setRoutineTemplates([]);
    setCheckedTemplateIds(new Set());
    setTemplatesError('');
  };

  const openAddModal = (preselectedSpeciesId?: number, preselectedSpeciesName?: string) => {
    resetForm();
    if (preselectedSpeciesId && preselectedSpeciesName) {
      setFormSpeciesId(preselectedSpeciesId);
      setFormSpeciesName(preselectedSpeciesName);
      setSpeciesQuery(preselectedSpeciesName);
    }
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  // Open the add-animal modal automatically when arriving with ?addSpecies=...&speciesName=...
  // (from the "Ajouter à Mes animaux" button on the species page), then clean the URL
  // so a refresh doesn't re-open the modal.
  useEffect(() => {
    if (authLoading || !user) return;
    const addSpecies = searchParams.get('addSpecies');
    const speciesName = searchParams.get('speciesName');
    if (addSpecies && speciesName) {
      const speciesId = parseInt(addSpecies, 10);
      if (!Number.isNaN(speciesId)) {
        openAddModal(speciesId, speciesName);
        router.replace(pathname, { scroll: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user, authLoading, pathname]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formName.trim()) {
      setFormError(t('animals.nameRequired'));
      return;
    }
    
    if (!formSpeciesId) {
      setFormError(t('animals.speciesRequired'));
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    try {
      const animalData = {
        name: formName.trim(),
        speciesId: formSpeciesId,
        birthDate: formBirthDate || undefined,
        sex: formSex || undefined,
        notes: formNotes || undefined,
        photos: formProfilePhotoUrl.trim() ? [formProfilePhotoUrl.trim()] : [],
      };

      const created = await api.createAnimal(animalData, token!);
      fetchAnimals();
      setToast(`${formName} ${t('animals.animalAdded')}`);
      // Module D : proposer les routines par défaut de l'espèce
      const createdId = (created as { id?: string })?.id;
      if (createdId && token) {
        try {
          const templates = await api.getRoutineTemplates(createdId, token);
          if (templates.length > 0) {
            setNewAnimalId(createdId);
            setRoutineTemplates(templates);
            setCheckedTemplateIds(new Set(templates.map((tpl) => tpl.id)));
            return; // la modale reste ouverte sur le panneau des routines
          }
        } catch (err) {
          // Backend sans module D (404/erreur) : on ferme la modale normalement
          console.error('Error fetching routine templates:', err);
        }
      }
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
      if (msg.includes('unauthorized') || msg.includes('non autorisé') || msg.includes('forbidden') || msg.includes('403') || msg.includes('401')) {
        logout();
        router.push('/login');
        return;
      }
      console.error('Error creating animal:', error);
      setFormError(error instanceof Error ? error.message : t('animals.errorAdding'));
    } finally {
      setFormSubmitting(false);
    }
  };

  const canAddAnimal = user?.isPremium || animals.length < 1;

  // ---- Routines recommandées (module D) ----
  const getTemplateTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      nourrissage: t('routines.types.feeding'),
      nettoyage: t('routines.types.cleaning'),
      uvb: t('routines.types.uvb'),
      controle: t('routines.types.health'),
      entretien: t('routines.types.cleaning'),
    };
    return labels[type] || type;
  };

  const getTemplateFrequencyLabel = (frequency: string): string => {
    const labels: Record<string, string> = {
      daily: t('routines.frequencies.daily'),
      every_2_days: t('routines.frequencies.every_2_days'),
      every_3_days: t('routines.frequencies.every_3_days'),
      weekly: t('routines.frequencies.weekly'),
      monthly: t('routines.frequencies.monthly'),
      once: t('routines.frequencies.once'),
      hourly: t('routines.frequencies.hourly'),
      custom: t('routines.frequencies.custom'),
    };
    return labels[frequency] || frequency;
  };

  const handleToggleTemplate = (id: string) => {
    setCheckedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleAllTemplates = () => {
    setCheckedTemplateIds((prev) =>
      prev.size === routineTemplates.length && routineTemplates.length > 0
        ? new Set()
        : new Set(routineTemplates.map((tpl) => tpl.id))
    );
  };

  const handleAddRoutineTemplates = async () => {
    if (!newAnimalId || !token || templatesAdding) return;
    const selected = routineTemplates.filter((tpl) => checkedTemplateIds.has(tpl.id));
    if (selected.length === 0) {
      setShowAddModal(false);
      resetForm();
      return;
    }
    setTemplatesAdding(true);
    setTemplatesError('');
    try {
      await Promise.all(
        selected.map((tpl) =>
          api.createRoutine(
            newAnimalId,
            {
              type: tpl.type,
              frequency: tpl.frequency,
              schedule: tpl.schedule ?? {},
              name: tpl.name || undefined,
              active: true,
            },
            token
          )
        )
      );
      setToast(
        `${selected.length} ${t('animals.routines').toLowerCase()} ${t('animals.routineTemplates.added')}`
      );
      setShowAddModal(false);
      resetForm();
      fetchAnimals();
    } catch (error) {
      const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
      if (msg.includes('unauthorized') || msg.includes('non autorisé') || msg.includes('forbidden') || msg.includes('403') || msg.includes('401')) {
        logout();
        router.push('/login');
        return;
      }
      console.error('Error adding routine templates:', error);
      setTemplatesError(error instanceof Error ? error.message : t('animals.errorAdding'));
    } finally {
      setTemplatesAdding(false);
    }
  };

  if (authLoading || loading) {
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-50 bg-emerald-600 text-white px-4 sm:px-6 py-3 rounded-lg shadow-lg animate-fade-in text-center sm:text-left">
          {toast}
        </div>
      )}

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 min-w-0">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
            {t('animals.myAnimals')}
          </h1>
          <button
            onClick={() => openAddModal()}
            disabled={!canAddAnimal}
            className={`w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg transition-colors shrink-0 ${
              canAddAnimal 
                ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            + {t('animals.addAnimal')}
          </button>
        </div>

        {animals.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
            <div className="text-gray-400 mb-4">
              <svg
                className="w-24 h-24 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
              {t('animals.noAnimals')}
            </h2>
            <p className="text-gray-500 dark:text-gray-500 mb-6">
              {t('animals.addFirstAnimal')}
            </p>
            <button
              onClick={() => openAddModal()}
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              {t('animals.addAnimal')}
            </button>
          </div>
        ) : (
          <>
            <input
              ref={cardPhotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-hidden
              onChange={handleCardPhotoFile}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {animals.map((animal) => (
              <Link
                key={animal.id}
                href={animalDetailPath(animal.id)}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow block"
              >
                <div className="relative aspect-video bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-4xl font-bold overflow-hidden group">
                  {photoUploading && photoAnimalId === animal.id ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <div className="animate-spin rounded-full h-10 w-10 border-2 border-white border-t-transparent" />
                    </div>
                  ) : (
                    <>
                      {animal.photos?.[0] ? (
                        <img
                          src={animal.photos[0]}
                          alt={animal.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        animal.name.charAt(0).toUpperCase()
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleCardPhotoClick(e, animal.id)}
                        className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 [@media(hover:none)]:inset-auto [@media(hover:none)]:bottom-2 [@media(hover:none)]:right-2 text-white text-sm font-medium"
                        title={t('animals.changePhoto')}
                      >
                        <span className="px-3 py-1.5 bg-white/90 text-gray-800 rounded-lg">
                          {t('animals.changePhoto')}
                        </span>
                      </button>
                    </>
                  )}
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                    {animal.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                    {animal.speciesName || `Species ID: ${animal.speciesId}`}
                  </p>
                  {(animal.father?.name || animal.mother?.name) && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      {animal.father?.name && (
                        <span>
                          {t(
                            `animals.family.${animal.sex === 'female' ? 'daughterOf' : animal.sex === 'unknown' ? 'childOf' : 'sonOf'}`,
                            { name: animal.father.name }
                          )}
                        </span>
                      )}
                      {animal.father?.name && animal.mother?.name && <span> · </span>}
                      {animal.mother?.name && (
                        <span>
                          {t(
                            `animals.family.${animal.sex === 'female' ? 'daughterOf' : animal.sex === 'unknown' ? 'childOf' : 'sonOf'}`,
                            { name: animal.mother.name }
                          )}
                        </span>
                      )}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {animal.groupName && (
                      <span className="px-3 py-1 bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 rounded-full text-xs">
                        {t('animals.family.group')}: {animal.groupName}
                      </span>
                    )}
                    {animal._count?.routines !== undefined && animal._count.routines > 0 && (
                      <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-full text-xs">
                        {animal._count.routines} {t('animals.routines')}
                      </span>
                    )}
                    {animal._count?.history !== undefined && animal._count.history > 0 && (
                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
                        {animal._count.history} actions
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      router.push(animalCarnetPath(animal.id));
                    }}
                    className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:underline"
                  >
                    {t('carnetPrint.title')}
                  </button>
                </div>
              </Link>
            ))}
            </div>
          </>
        )}

        {/* Premium limit warning */}
        {!user?.isPremium && animals.length >= 1 && (
          <div className="mt-8 p-6 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded-lg">
            <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              {t('animals.premiumRequired')}
            </h3>
            <p className="text-yellow-700 dark:text-yellow-300">
              {t('animals.premiumMessage')}
            </p>
          </div>
        )}
      </div>

      {/* Add Animal Modal */}
      <Modal
        open={showAddModal}
        onClose={handleCloseAddModal}
        size="xl"
        title={
          newAnimalId && routineTemplates.length > 0
            ? t('animals.routineTemplates.title')
            : t('animals.addAnimal')
        }
        dismissible={!formSubmitting && !templatesAdding}
        closeOnOverlayClick={false}
        hideCloseButton
        className="md:p-8"
        titleClassName={
          newAnimalId && routineTemplates.length > 0
            ? 'text-2xl md:text-3xl font-bold mb-2 text-gray-800 dark:text-white'
            : 'text-2xl md:text-3xl font-bold mb-6 text-gray-800 dark:text-white'
        }
      >
        {showAddModal && (
          <>
            {newAnimalId && routineTemplates.length > 0 ? (
              /* Étape 2 : routines recommandées pour l'espèce (module D) */
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {t('animals.routineTemplates.suggested')}
                </p>

                <div className="flex items-center justify-between mb-3">
                  <button
                    type="button"
                    onClick={handleToggleAllTemplates}
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    {t('animals.routineTemplates.selectAll')}
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {checkedTemplateIds.size}/{routineTemplates.length}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {routineTemplates.map((tpl) => {
                    const checked = checkedTemplateIds.has(tpl.id);
                    const time = (tpl.schedule as { time?: string } | null)?.time;
                    return (
                      <label
                        key={tpl.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          checked
                            ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleTemplate(tpl.id)}
                          className="mt-1 w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                        <span className="min-w-0">
                          <span className="block font-medium text-gray-800 dark:text-white">
                            {tpl.name || getTemplateTypeLabel(tpl.type)}
                          </span>
                          {tpl.name && (
                            <span className="block text-sm text-gray-500 dark:text-gray-400">
                              {getTemplateTypeLabel(tpl.type)}
                            </span>
                          )}
                          <span className="block text-sm text-gray-500 dark:text-gray-400">
                            {getTemplateFrequencyLabel(tpl.frequency)}
                            {time ? ` · ${time}` : ''}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                {templatesError && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                    {templatesError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleAddRoutineTemplates}
                    disabled={templatesAdding || checkedTemplateIds.size === 0}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                      templatesAdding || checkedTemplateIds.size === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {templatesAdding ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        {t('common.loading')}
                      </span>
                    ) : (
                      t('animals.routineTemplates.addSelected')
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseAddModal}
                    className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name field */}
              <div>
                <label htmlFor="animal-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('animals.animalName')} *
                </label>
                <input
                  id="animal-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t('animals.namePlaceholder')}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              {/* Species autocomplete */}
              <div className="relative">
                <label htmlFor="animal-species" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('animals.species')} *
                </label>
                <input
                  id="animal-species"
                  type="text"
                  value={speciesQuery}
                  onChange={(e) => {
                    setSpeciesQuery(e.target.value);
                    setFormSpeciesId(null);
                    setShowSpeciesDropdown(true);
                  }}
                  onFocus={() => speciesResults.length > 0 && setShowSpeciesDropdown(true)}
                  placeholder={t('animals.speciesPlaceholder')}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                />
                {speciesSearching && (
                  <div className="absolute right-3 top-9">
                    <div className="animate-spin h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full"></div>
                  </div>
                )}
                
                {/* Species dropdown */}
                {showSpeciesDropdown && speciesResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {speciesResults.map((species) => (
                      <button
                        key={species.key}
                        type="button"
                        onClick={() => handleSpeciesSelect(species)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-600 last:border-0"
                      >
                        <div className="font-medium text-gray-800 dark:text-white">
                          {species.vernacularName || species.canonicalName || species.scientificName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                          {species.scientificName}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Birth date */}
              <div>
                <label htmlFor="animal-birthdate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('animals.birthDate')}
                </label>
                <input
                  id="animal-birthdate"
                  type="date"
                  value={formBirthDate}
                  onChange={(e) => setFormBirthDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Sex - radios natifs stylisés en boutons pour une sélection fiable */}
              <div>
                <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('animals.sex')}
                </span>
                <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={t('animals.sex')}>
                  {['male', 'female', 'unknown'].map((sex) => (
                    <label
                      key={sex}
                      className={`cursor-pointer px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border-2 block ${
                        formSex === sex
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-emerald-400 dark:hover:border-emerald-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="animal-sex"
                        value={sex}
                        checked={formSex === sex}
                        onChange={(e) => {
                          e.stopPropagation();
                          setFormSex(e.target.value);
                        }}
                        className="sr-only"
                      />
                      {t(`animals.${sex}`)}
                    </label>
                  ))}
                </div>
              </div>

              {/* Photo de profil (URL) */}
              <div>
                <label htmlFor="animal-profile-photo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('animals.profilePhoto')}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className="mb-2 block w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 dark:file:bg-emerald-900/30 dark:file:text-emerald-200 file:font-medium"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const r = new FileReader();
                    r.onload = () => setFormProfilePhotoUrl(r.result as string);
                    r.readAsDataURL(file);
                    e.target.value = '';
                  }}
                />
                <input
                  id="animal-profile-photo"
                  type="url"
                  value={formProfilePhotoUrl.startsWith('data:') ? '' : formProfilePhotoUrl}
                  onChange={(e) => setFormProfilePhotoUrl(e.target.value)}
                  placeholder={t('animals.profilePhotoPlaceholder')}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t('animals.profilePhotoHelp')}
                </p>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="animal-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('animals.notes')}
                </label>
                <textarea
                  id="animal-notes"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder={t('animals.notesPlaceholder')}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Error message */}
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {formError}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-6">
                <button
                  type="submit"
                  disabled={formSubmitting || !formSpeciesId}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                    formSubmitting || !formSpeciesId
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {formSubmitting ? (
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
                  onClick={handleCloseAddModal}
                  className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary in Next.js 16 (CSR bailout otherwise)
export default function MyAnimalsPage() {
  return (
    <Suspense fallback={null}>
      <MyAnimalsPageContent />
    </Suspense>
  );
}
