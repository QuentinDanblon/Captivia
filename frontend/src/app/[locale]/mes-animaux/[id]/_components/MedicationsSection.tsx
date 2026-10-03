'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api, type Animal, type Medication } from '@/lib/api';
import { isPremiumLocked, sectionErrorKey } from './sectionErrors';
import { useFormatters } from './useFormatters';
import { localDayKey } from '@/lib/dates';

interface Props {
  animal: Animal;
  token: string | null;
  medications: Medication[];
  loading: boolean;
  error: string;
  locked: boolean;
  onLocked: () => void;
  onRefresh: () => Promise<void>;
}

export default function MedicationsSection({ animal, token, medications, loading: medicationsLoading, error: medicationsError, locked: medicationsLocked, onLocked, onRefresh }: Props) {
  const t = useTranslations();
  const { formatDate } = useFormatters();
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

  const getMedicationFrequencyName = (frequency: string): string => {
    const frequencies: Record<string, string> = {
      daily: t('animals.medications.frequencyDaily'),
      every_x_hours: t('animals.medications.frequencyEveryXHours'),
      weekly: t('animals.medications.frequencyWeekly'),
    };
    return frequencies[frequency] || frequency;
  };

  const openMedicationModalForCreate = () => {
    // D-16 : carnet complet sans Premium (seul un refus de l'API verrouille la section).
    if (medicationsLocked) return;
    setMedicationName('');
    setMedicationDose('');
    setMedicationUnit('');
    setMedicationFrequency('daily');
    setMedicationIntervalHours(8);
    setMedicationStartDate(localDayKey(new Date()));
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
      await onRefresh();
    } catch (err) {
      console.error('Error saving medication:', err);
      if (isPremiumLocked(err)) {
        onLocked();
        setShowMedicationModal(false);
      } else {
        setMedicationFormError(t(sectionErrorKey(err)));
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
      await onRefresh();
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
      await onRefresh();
    } catch (err) {
      console.error('Error deleting medication:', err);
    } finally {
      setMedicationDeletingId(null);
    }
  };

  return (
    <>
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
      <div className="contents">
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
                          placeholder={t('animals.medicationUnitPlaceholder')}
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
      </div>
    </>
  );
}
