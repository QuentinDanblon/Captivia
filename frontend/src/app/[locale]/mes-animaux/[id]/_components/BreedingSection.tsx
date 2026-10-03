'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api, type Animal, type BreedingRecord } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isPremiumLocked, sectionErrorKey } from './sectionErrors';
import { useFormatters } from './useFormatters';
import { localDayKey } from '@/lib/dates';

interface Props {
  animal: Animal;
  token: string | null;
  breedingRecords: BreedingRecord[];
  loading: boolean;
  error: string;
  locked: boolean;
  onLocked: () => void;
  onRefresh: () => Promise<void>;
}

export default function BreedingSection({ animal, token, breedingRecords, loading: breedingLoading, error: breedingError, locked: breedingLocked, onLocked, onRefresh }: Props) {
  const t = useTranslations();
  const { user } = useAuth();
  const { formatDate, formatDateTime } = useFormatters();
  const [showBreedingModal, setShowBreedingModal] = useState(false);
  const [editingBreedingId, setEditingBreedingId] = useState<string | null>(null);
  const [breedingEventType, setBreedingEventType] = useState<BreedingRecord['eventType']>('heat');
  const [breedingDate, setBreedingDate] = useState(localDayKey(new Date()));
  const [breedingPartnerName, setBreedingPartnerName] = useState('');
  const [breedingOffspringCount, setBreedingOffspringCount] = useState('');
  const [breedingNotes, setBreedingNotes] = useState('');
  const [breedingSubmitting, setBreedingSubmitting] = useState(false);
  const [breedingFormError, setBreedingFormError] = useState('');
  const [breedingToDelete, setBreedingToDelete] = useState<string | null>(null);
  const [showDeleteBreedingConfirm, setShowDeleteBreedingConfirm] = useState(false);
  const [breedingDeletingId, setBreedingDeletingId] = useState<string | null>(null);

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
    setBreedingDate(localDayKey(new Date()));
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
      await onRefresh();
    } catch (err) {
      console.error('Error saving breeding record:', err);
      if (isPremiumLocked(err)) {
        onLocked();
        setShowBreedingModal(false);
      } else {
        setBreedingFormError(t(sectionErrorKey(err)));
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
      await onRefresh();
    } catch (err) {
      console.error('Error deleting breeding record:', err);
    } finally {
      setBreedingDeletingId(null);
    }
  };

  return (
    <>
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
      <div className="contents">
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
      </div>
    </>
  );
}
