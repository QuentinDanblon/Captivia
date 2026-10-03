'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { api, type Animal } from '@/lib/api';
import { compressImageToDataUrl, isImageTooLargeError } from '@/lib/image';
import { Button, Field, Modal, cx } from '@/components/ui';
import { FormError } from './parts';

interface Props {
  animal: Animal;
  token: string | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

/** Modale « Modifier l'animal » (montée uniquement quand elle est ouverte). */
export default function EditAnimalModal({ animal, token, onClose, onRefresh }: Props) {
  const t = useTranslations();
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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
  }, [animal, token]);

  const handleProfilePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setEditAnimalProfilePhotoUrl(await compressImageToDataUrl(file));
      setEditAnimalError('');
    } catch (err) {
      setEditAnimalError(isImageTooLargeError(err) ? t('animals.photoTooLarge') : t('animals.errorAdding'));
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
      await onRefresh();
      onClose();
    } catch (err) {
      console.error('Error updating animal:', err);
      setEditAnimalError(err instanceof Error ? err.message : t('animals.errorAdding'));
    } finally {
      setEditAnimalSubmitting(false);
    }
  };

  const others = candidateAnimals.filter((a) => a.id !== animal.id);
  const bySpecies = (list: Animal[]) =>
    [...list].sort((a, b) => (a.speciesId === animal.speciesId ? 0 : 1) - (b.speciesId === animal.speciesId ? 0 : 1));
  const fatherCandidates = bySpecies(others.filter((a) => !a.sex || a.sex === 'male' || a.sex === 'unknown'));
  const motherCandidates = bySpecies(others.filter((a) => !a.sex || a.sex === 'female' || a.sex === 'unknown'));

  return (
    <Modal
      open
      onClose={onClose}
      title={t('animals.editAnimal')}
      description={t('animals.editAnimalFormIntro')}
      size="xl"
      dismissible={!editAnimalSubmitting}
      closeOnOverlayClick={false}
    >
      <form onSubmit={handleSaveEditAnimal} className="grid gap-4">
        <Field label={t('animals.animalName')} hint={t('animals.nameHelp')} required id="edit-animal-name">
          <input type="text" value={editAnimalName} onChange={(e) => setEditAnimalName(e.target.value)} placeholder={t('animals.namePlaceholder')} autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('animals.birthDate')} hint={t('animals.birthDateHelp')} id="edit-animal-birthdate">
            <input type="date" className="font-mono" value={editAnimalBirthDate} onChange={(e) => setEditAnimalBirthDate(e.target.value)} />
          </Field>
          <fieldset className="m-0 grid min-w-0 content-start gap-1.5 border-0 p-0">
            <legend className="mb-1.5 p-0 text-ui font-medium text-ink">{t('animals.sex')}</legend>
            <div className="grid grid-cols-3 gap-1 rounded-control border border-line-field p-1">
              {['male', 'female', 'unknown'].map((sex) => (
                <label
                  key={sex}
                  className={cx(
                    'flex min-h-9 cursor-pointer items-center justify-center rounded-[4px] px-2 text-ui font-medium transition-colors pointer-coarse:min-h-11',
                    'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-focus',
                    editAnimalSex === sex ? 'bg-accent text-on-accent' : 'text-ink hover:bg-sunken',
                  )}
                >
                  <input type="radio" name="edit-animal-sex" value={sex} checked={editAnimalSex === sex} onChange={() => setEditAnimalSex(sex)} className="sr-only" />
                  {t(`animals.${sex}`)}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Père / Mère (module F) : animaux de la même espèce en tête de liste. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('animals.edit.father')} id="edit-animal-father">
            <select value={editFatherId} onChange={(e) => setEditFatherId(e.target.value)}>
              <option value="">{t('animals.family.none')}</option>
              {fatherCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('animals.edit.mother')} id="edit-animal-mother">
            <select value={editMotherId} onChange={(e) => setEditMotherId(e.target.value)}>
              <option value="">{t('animals.family.none')}</option>
              {motherCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={t('animals.edit.group')} id="edit-animal-group">
          <input type="text" value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)} placeholder={t('animals.family.groupPlaceholder')} autoComplete="off" />
        </Field>

        <div className="grid gap-1.5">
          <span className="text-ui font-medium text-ink">{t('animals.profilePhoto')}</span>
          <div className="flex flex-wrap items-center gap-3">
            {editAnimalProfilePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- aperçu local (data URL ou adresse saisie)
              <img src={editAnimalProfilePhotoUrl} alt="" className="size-14 rounded-control border border-line object-cover" />
            ) : null}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" tabIndex={-1} aria-hidden onChange={handleProfilePhotoFile} />
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              {t('animals.choosePhotoFile')}
            </Button>
          </div>
          <Field label={t('animals.profilePhotoUrl')} hint={t('animals.profilePhotoHelp')} id="edit-animal-profile-photo">
            <input
              type="url"
              value={editAnimalProfilePhotoUrl.startsWith('data:') ? '' : editAnimalProfilePhotoUrl}
              onChange={(e) => setEditAnimalProfilePhotoUrl(e.target.value)}
              placeholder={t('animals.profilePhotoPlaceholder')}
            />
          </Field>
        </div>

        <Field label={t('animals.notes')} hint={t('animals.notesHelp')} id="edit-animal-notes">
          <textarea value={editAnimalNotes} onChange={(e) => setEditAnimalNotes(e.target.value)} placeholder={t('animals.notesPlaceholder')} rows={3} />
        </Field>

        <FormError>{editAnimalError}</FormError>
        <div className="flex flex-wrap gap-3 border-t border-line pt-4">
          <Button type="submit" loading={editAnimalSubmitting}>
            {t('common.save')}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={editAnimalSubmitting}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
