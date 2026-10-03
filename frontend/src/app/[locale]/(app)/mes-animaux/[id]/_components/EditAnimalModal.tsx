'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { api, type Animal } from '@/lib/api';
import { compressImageToDataUrl, isImageTooLargeError } from '@/lib/image';

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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-animal-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
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
                  onChange={handleProfilePhotoFile}
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
              onClick={() => onClose()}
              className="flex-1 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3.5 text-base font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
