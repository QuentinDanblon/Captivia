'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, type Animal } from '@/lib/api';
import { useFormatters } from './useFormatters';
import type { HealthRecord } from './types';

interface Props {
  animal: Animal;
  token: string | null;
  healthRecords: HealthRecord[];
  onRefresh: () => Promise<void>;
}

export default function HealthRecordsSection({ animal, token, healthRecords, onRefresh }: Props) {
  const t = useTranslations();
  const { formatDate } = useFormatters();
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
      await onRefresh();
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
      await onRefresh();
    } catch (err) {
      console.error('Error deleting health record:', err);
    } finally {
      setHealthDeletingId(null);
    }
  };

  return (
    <>
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
      <div className="contents">
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
      </div>
    </>
  );
}
