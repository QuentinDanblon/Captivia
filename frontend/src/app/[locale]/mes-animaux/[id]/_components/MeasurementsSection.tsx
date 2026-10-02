'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api, type Animal, type AnimalMeasurement } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useFormatters } from './useFormatters';
import WeightChart from '@/components/WeightChart';

interface Props {
  animal: Animal;
  token: string | null;
  measurements: AnimalMeasurement[];
  loading: boolean;
  error: string;
  locked: boolean;
  onLocked: () => void;
  onRefresh: () => Promise<void>;
}

export default function MeasurementsSection({ animal, token, measurements, loading: measurementsLoading, error: measurementsError, locked: measurementsLocked, onLocked, onRefresh }: Props) {
  const t = useTranslations();
  const { user } = useAuth();
  const { formatDate } = useFormatters();
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
        setMeasurementFormError(t('animals.measurements.weightInvalid'));
        return;
      }
      if (measurementHeight.trim() !== '' && Number.isNaN(heightNum)) {
        setMeasurementFormError(t('animals.measurements.heightInvalid'));
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
      await onRefresh();
    } catch (err) {
      console.error('Error saving measurement:', err);
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('403') || msg.toLowerCase().includes('premium')) {
        onLocked();
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
      await onRefresh();
    } catch (err) {
      console.error('Error deleting measurement:', err);
    } finally {
      setMeasurementDeletingId(null);
    }
  };

  return (
    <>
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
      <div className="contents">
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
      </div>
    </>
  );
}
