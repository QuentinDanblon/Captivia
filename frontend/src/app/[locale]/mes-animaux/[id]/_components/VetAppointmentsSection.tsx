'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, type Animal, type VetAppointment } from '@/lib/api';
import { useFormatters } from './useFormatters';

interface Props {
  animal: Animal;
  token: string | null;
  vetAppointments: VetAppointment[];
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
}

export default function VetAppointmentsSection({ animal, token, vetAppointments, loading: vetAppointmentsLoading, error: vetAppointmentsError, onRefresh }: Props) {
  const t = useTranslations();
  const { formatDateTime } = useFormatters();
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

  const getVetStatusName = (status: string): string => {
    const statuses: Record<string, string> = {
      scheduled: t('animals.vetAppointments.statusScheduled'),
      done: t('animals.vetAppointments.statusDone'),
      cancelled: t('animals.vetAppointments.statusCancelled'),
    };
    return statuses[status] || status;
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
      await onRefresh();
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
      await onRefresh();
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
      await onRefresh();
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
      await onRefresh();
    } catch (err) {
      console.error('Error deleting vet appointment:', err);
    } finally {
      setVetDeletingId(null);
    }
  };

  return (
    <>
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
      <div className="contents">
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
      </div>
    </>
  );
}
