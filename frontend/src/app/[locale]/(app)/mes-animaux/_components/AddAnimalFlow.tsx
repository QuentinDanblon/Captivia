'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { api, ApiError, type SpeciesRoutineTemplate } from '@/lib/api';
import { errorKey } from '@/lib/api-errors';
import { ANIMAL_LIMIT_CODE } from '@/lib/guest';
import { checkPhotoUrl, compressImageToDataUrl, isImageTooLargeError, isUnsupportedImageError } from '@/lib/image';
import { Button, Field, Steps, cx } from '@/components/ui';
import { usePhotoPicker } from '@/components/usePhotoPicker';

interface SpeciesResult {
  key: number;
  scientificName: string;
  canonicalName?: string;
  vernacularName?: string;
}

export interface AddAnimalFlowProps {
  token: string;
  /** Invité : le message de limite explique le compte, sinon l'abonnement. */
  isGuest: boolean;
  /** Espèce déjà choisie (bouton « Ajouter à mes animaux » d'une fiche espèce) : on passe à l'étape 2. */
  preselected?: { id: number; name: string } | null;
  /** Animal créé (la liste peut se recharger) ; `name` sert au message de confirmation. */
  onCreated: (name: string) => void;
  /** Routines ajoutées (nombre) : message de confirmation. */
  onRoutinesAdded?: (count: number) => void;
  /** Parcours terminé ou abandonné. */
  onClose: () => void;
  /** Envoi en cours : la modale parente bloque sa fermeture. */
  onBusyChange?: (busy: boolean) => void;
  /** Niveau des titres d'étape (2 en page, 3 dans une modale déjà titrée). */
  headingLevel?: 2 | 3;
  /** Bouton « Annuler » à la première étape (modale) ; absent dans le parcours d'accueil. */
  cancellable?: boolean;
  className?: string;
}

const ROUTINE_TYPE_KEYS: Record<string, string> = {
  nourrissage: 'routines.types.feeding',
  nettoyage: 'routines.types.cleaning',
  uvb: 'routines.types.uvb',
  controle: 'routines.types.health',
  entretien: 'routines.types.cleaning',
};

const FREQUENCIES = ['daily', 'every_2_days', 'every_3_days', 'weekly', 'monthly', 'once', 'hourly', 'custom'];

/**
 * Ajout d'un animal en trois étapes (DESIGN.md § 5.11, `Steps`) : l'espèce, puis le nom et la
 * naissance, puis le premier soin (routines recommandées pour l'espèce, à cocher). Utilisé en
 * modale (« Ajouter un animal ») et en page, pour le premier animal d'un nouvel utilisateur.
 * Appels API inchangés : recherche d'espèce, création, modèles de routines, création de routines.
 */
export default function AddAnimalFlow({
  token,
  isGuest,
  preselected,
  onCreated,
  onRoutinesAdded,
  onClose,
  onBusyChange,
  headingLevel = 3,
  cancellable = true,
  className,
}: AddAnimalFlowProps) {
  const t = useTranslations();
  const uid = useId();
  const [step, setStep] = useState(preselected ? 1 : 0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Étape 1 : espèce
  const [speciesQuery, setSpeciesQuery] = useState(preselected?.name ?? '');
  const [speciesId, setSpeciesId] = useState<number | null>(preselected?.id ?? null);
  const [speciesName, setSpeciesName] = useState(preselected?.name ?? '');
  const [results, setResults] = useState<SpeciesResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Étape 2 : identité
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Étape 3 : premier soin (routines recommandées de l'espèce, module D)
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<SpeciesRoutineTemplate[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [templatesError, setTemplatesError] = useState('');

  useEffect(() => {
    onBusyChange?.(submitting || adding);
  }, [submitting, adding, onBusyChange]);

  // Changement d'étape : le focus va au titre de l'étape (lecteurs d'écran, clavier).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  // Recherche d'espèce (300 ms après la dernière frappe, 2 caractères minimum).
  useEffect(() => {
    if (speciesQuery.length < 2 || speciesId) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.searchSpecies(speciesQuery, 10);
        setResults((data.results || []) as SpeciesResult[]);
        setShowResults(true);
      } catch (error) {
        console.error('Species search error:', error);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [speciesQuery, speciesId]);

  const selectSpecies = (species: SpeciesResult) => {
    setSpeciesId(species.key);
    setSpeciesName(species.canonicalName || species.scientificName);
    setSpeciesQuery(species.vernacularName ? `${species.vernacularName} (${species.scientificName})` : species.scientificName);
    setShowResults(false);
  };

  const handlePhotoFile = async (file: Blob) => {
    try {
      setPhotoUrl(await compressImageToDataUrl(file));
      setFormError('');
    } catch (err) {
      setFormError(isImageTooLargeError(err)
          ? t('animals.photoTooLarge')
          : isUnsupportedImageError(err)
            ? t('animals.photoUnsupported')
            : t('animals.errorAdding'));
    }
  };
  // Web : sélecteur de fichier ; app native : appareil photo ou galerie (W6-05).
  const { inputRef: photoInputRef, open: openPhotoPicker, onChange: onPhotoInputChange } = usePhotoPicker({ onFile: handlePhotoFile, onError: setFormError });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError(t('animals.nameRequired'));
      return;
    }
    if (!speciesId) {
      setFormError(t('animals.speciesRequired'));
      setStep(0);
      return;
    }
    const photoCheck = checkPhotoUrl(photoUrl);
    if (photoCheck !== 'ok') {
      setFormError(t(photoCheck === 'insecure' ? 'animals.photoUrlInsecure' : 'animals.photoUrlInvalid'));
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const created = await api.createAnimal(
        {
          name: name.trim(),
          speciesId,
          birthDate: birthDate || undefined,
          sex: sex || undefined,
          notes: notes || undefined,
          photos: photoUrl.trim() ? [photoUrl.trim()] : [],
        },
        token,
      );
      onCreated(name.trim());
      // Module D : proposer les routines par défaut de l'espèce.
      const id = (created as { id?: string })?.id;
      if (id) {
        try {
          const list = await api.getRoutineTemplates(id, token);
          if (list.length > 0) {
            setCreatedId(id);
            setTemplates(list);
            setChecked(new Set(list.map((tpl) => tpl.id)));
            setStep(2);
            return;
          }
        } catch (err) {
          // Backend sans module D (404/erreur) : le parcours se termine normalement.
          console.error('Error fetching routine templates:', err);
        }
      }
      onClose();
    } catch (error) {
      // Limite d'animaux (invité / compte gratuit) : explication, jamais de déconnexion.
      if (error instanceof ApiError && error.code === ANIMAL_LIMIT_CODE) {
        setFormError(isGuest ? t('guest.lockedValueGuest') : t('guest.lockedValueFree'));
        return;
      }
      // Session perdue : lib/api a déjà tenté le refresh et émis `auth:logout` si elle est
      // révoquée (la page redirige alors). Jamais de logout() ici.
      if (error instanceof ApiError && error.status === 401) return;
      console.error('Error creating animal:', error);
      setFormError(t(errorKey(error, { fallback: 'animals.errorAdding' })));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddRoutines = async () => {
    if (!createdId || adding) return;
    const selected = templates.filter((tpl) => checked.has(tpl.id));
    if (selected.length === 0) {
      onClose();
      return;
    }
    setAdding(true);
    setTemplatesError('');
    try {
      await Promise.all(
        selected.map((tpl) =>
          api.createRoutine(
            createdId,
            { type: tpl.type, frequency: tpl.frequency, schedule: tpl.schedule ?? {}, name: tpl.name || undefined, active: true },
            token,
          ),
        ),
      );
      onRoutinesAdded?.(selected.length);
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return;
      console.error('Error adding routine templates:', error);
      setTemplatesError(t(errorKey(error, { fallback: 'animals.errorAdding' })));
    } finally {
      setAdding(false);
    }
  };

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const typeLabel = (type: string) => (ROUTINE_TYPE_KEYS[type] ? t(ROUTINE_TYPE_KEYS[type]) : type);
  const frequencyLabel = (frequency: string) =>
    FREQUENCIES.includes(frequency) ? t(`routines.frequencies.${frequency}`) : frequency;

  const stepLabels = [t('onboarding.stepSpecies'), t('onboarding.stepIdentity'), t('onboarding.stepCare')];
  const Heading = `h${headingLevel}` as const;
  const listId = `${uid}-species-list`;

  return (
    <div className={cx('grid gap-5', className)}>
      <Steps
        steps={stepLabels}
        current={step}
        aria-label={t('onboarding.stepsLabel')}
        progressLabel={t('onboarding.progress', { current: step + 1, total: stepLabels.length })}
      />

      {step === 0 ? (
        <div className="grid gap-4">
          <div className="grid gap-1">
            <Heading ref={headingRef} tabIndex={-1} className="m-0 font-display text-h4 font-semibold text-ink outline-none">
              {t('onboarding.speciesTitle')}
            </Heading>
            <p className="m-0 text-ui text-ink-2">{t('onboarding.speciesText')}</p>
          </div>
          <div className="relative">
            <Field label={t('animals.species')} hint={speciesId ? undefined : t('onboarding.speciesHint')} required id="animal-species">
              <input
                type="text"
                role="combobox"
                aria-expanded={showResults && results.length > 0}
                aria-controls={listId}
                aria-autocomplete="list"
                autoComplete="off"
                value={speciesQuery}
                onChange={(e) => {
                  setSpeciesQuery(e.target.value);
                  setSpeciesId(null);
                  setShowResults(true);
                }}
                onFocus={() => results.length > 0 && setShowResults(true)}
                placeholder={t('animals.speciesPlaceholder')}
              />
            </Field>
            {searching ? (
              <span role="status" className="absolute top-9 right-3 font-mono text-meta text-ink-2">
                {t('onboarding.searching')}
              </span>
            ) : null}
            {showResults && results.length > 0 ? (
              <ul
                id={listId}
                aria-label={t('onboarding.resultsLabel')}
                className="absolute z-20 mt-1 max-h-64 w-full list-none overflow-y-auto rounded-control border border-line-strong bg-surface p-1 shadow-overlay"
              >
                {results.map((species) => (
                  <li key={species.key}>
                    <button
                      type="button"
                      onClick={() => selectSpecies(species)}
                      className="grid min-h-11 w-full gap-0.5 rounded-control px-3 py-2 text-left transition-colors hover:bg-sunken"
                    >
                      <span className="font-medium text-ink">
                        {species.vernacularName || species.canonicalName || species.scientificName}
                      </span>
                      <i lang="la" className="latin text-ui text-ink-2">
                        {species.scientificName}
                      </i>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {speciesId ? (
            <p className="m-0 flex items-center gap-2 text-ui text-ok" role="status">
              <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-hidden="true">
                <circle cx="8" cy="8" r="7" fill="currentColor" />
                <path d="M4.8 8.3 7 10.4l4.2-4.6" fill="none" stroke="var(--surface)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>
                {t('onboarding.speciesChosen')} <i lang="la" className="latin text-ink">{speciesName}</i>
              </span>
            </p>
          ) : null}
          {formError ? (
            <p role="alert" className="m-0 text-ui font-medium text-danger">
              {formError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => { setFormError(''); setStep(1); }} disabled={!speciesId}>
              {t('common.next')}
            </Button>
            {cancellable ? (
              <Button variant="secondary" onClick={onClose}>
                {t('common.cancel')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <form onSubmit={handleCreate} className="grid gap-4" noValidate>
          <div className="grid gap-1">
            <Heading ref={headingRef} tabIndex={-1} className="m-0 font-display text-h4 font-semibold text-ink outline-none">
              {t('onboarding.identityTitle')}
            </Heading>
            <p className="m-0 text-ui text-ink-2">
              {t('onboarding.identityText')} <i lang="la" className="latin text-ink">{speciesName}</i>
            </p>
          </div>
          <Field label={t('animals.animalName')} required id="animal-name">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('animals.namePlaceholder')} autoComplete="off" maxLength={100} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('animals.birthDate')} hint={t('animals.birthDateHelp')} id="animal-birthdate">
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="font-mono" />
            </Field>
            <fieldset className="m-0 grid min-w-0 gap-1.5 border-0 p-0">
              <legend className="mb-1.5 p-0 text-ui font-medium text-ink">{t('animals.sex')}</legend>
              <div className="grid grid-cols-3 gap-1 rounded-control border border-line-field p-1">
                {['male', 'female', 'unknown'].map((value) => (
                  <label
                    key={value}
                    className={cx(
                      'flex min-h-9 cursor-pointer items-center justify-center rounded-[4px] px-2 text-ui font-medium transition-colors pointer-coarse:min-h-11',
                      'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-focus',
                      sex === value ? 'bg-accent text-on-accent' : 'text-ink hover:bg-sunken',
                    )}
                  >
                    <input type="radio" name={`${uid}-sex`} value={value} checked={sex === value} onChange={(e) => setSex(e.target.value)} className="sr-only" />
                    {t(`animals.${value}`)}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="grid gap-1.5">
            <span className="text-ui font-medium text-ink">{t('animals.profilePhoto')}</span>
            <div className="flex flex-wrap items-center gap-3">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- aperçu local (data URL ou adresse saisie)
                <img src={photoUrl} alt="" className="size-14 rounded-control border border-line object-cover" />
              ) : null}
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" tabIndex={-1} aria-hidden onChange={onPhotoInputChange} />
              <Button variant="secondary" size="sm" onClick={() => void openPhotoPicker()}>
                {t('animals.choosePhotoFile')}
              </Button>
            </div>
            <p className="m-0 text-meta text-ink-2">{t('animals.photoSizeHint')}</p>
            <Field label={t('animals.profilePhotoUrl')} hint={t('onboarding.photoHint')} id="animal-profile-photo">
              <input type="url" value={photoUrl.startsWith('data:') ? '' : photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder={t('animals.profilePhotoPlaceholder')} maxLength={2048} />
            </Field>
          </div>
          <Field label={t('animals.notes')} id="animal-notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('animals.notesPlaceholder')} rows={3} maxLength={2000} />
          </Field>
          {formError ? (
            <p role="alert" className="m-0 text-ui font-medium text-danger">
              {formError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={submitting}>
              {t('common.save')}
            </Button>
            <Button variant="secondary" onClick={() => setStep(0)} disabled={submitting}>
              {t('common.previous')}
            </Button>
          </div>
        </form>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-4">
          <div className="grid gap-1">
            <Heading ref={headingRef} tabIndex={-1} className="m-0 font-display text-h4 font-semibold text-ink outline-none">
              {t('onboarding.careTitle', { name })}
            </Heading>
            <p className="m-0 text-ui text-ink-2">{t('onboarding.careText')}</p>
          </div>
          <fieldset className="m-0 grid gap-2 border-0 p-0">
            <legend className="sr-only">{t('animals.routineTemplates.title')}</legend>
            {templates.map((tpl) => {
              const time = (tpl.schedule as { time?: string } | null)?.time;
              return (
                <label
                  key={tpl.id}
                  className={cx(
                    'flex cursor-pointer items-start gap-3 rounded-control border px-3 py-3 transition-colors',
                    checked.has(tpl.id) ? 'border-accent bg-accent-soft' : 'border-line hover:bg-sunken',
                  )}
                >
                  <input type="checkbox" checked={checked.has(tpl.id)} onChange={() => toggle(tpl.id)} className="mt-1 size-4 shrink-0" />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="font-medium text-ink">{tpl.name || typeLabel(tpl.type)}</span>
                    <span className="text-ui text-ink-2">
                      {tpl.name ? `${typeLabel(tpl.type)} · ` : ''}
                      {frequencyLabel(tpl.frequency)}
                      {time ? (
                        <>
                          {' · '}
                          <span className="font-mono">{time}</span>
                        </>
                      ) : null}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <p className="m-0 font-mono text-meta text-ink-2">
            {t('onboarding.careCount', { checked: checked.size, total: templates.length })}
          </p>
          {templatesError ? (
            <p role="alert" className="m-0 text-ui font-medium text-danger">
              {templatesError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleAddRoutines} loading={adding} disabled={checked.size === 0}>
              {t('animals.routineTemplates.addSelected')}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={adding}>
              {t('onboarding.careLater')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
