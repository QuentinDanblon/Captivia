'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api, type Animal, type Vaccination } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useFormatters } from './useFormatters';

interface Props {
  animal: Animal;
  token: string | null;
  vaccinations: Vaccination[];
  loading: boolean;
  error: string;
  locked: boolean;
  onLocked: () => void;
  onRefresh: () => Promise<void>;
}

export default function VaccinationsSection({ animal, token, vaccinations, loading: vaccinationsLoading, error: vaccinationsError, locked: vaccinationsLocked, onLocked, onRefresh }: Props) {
  const t = useTranslations();
  const { user } = useAuth();
  const { formatDate } = useFormatters();
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
      await onRefresh();
    } catch (err) {
      console.error('Error saving vaccination:', err);
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('403') || msg.toLowerCase().includes('premium')) {
        onLocked();
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
      await onRefresh();
    } catch (err) {
      console.error('Error deleting vaccination:', err);
    } finally {
      setVaccinationDeletingId(null);
    }
  };

  return (
    <>
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
      <div className="contents">
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
      </div>
    </>
  );
}
