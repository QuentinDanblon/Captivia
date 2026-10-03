'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { api, type Animal, type SpeciesRoutineTemplate } from '@/lib/api';

import type { Routine, HistoryEntry } from './types';

interface Props {
  animal: Animal;
  token: string | null;
  routines: Routine[];
  onRefresh: () => Promise<void>;
  onToast: (msg: string) => void;
}

export default function RoutinesSection({ animal, token, routines, onRefresh, onToast }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [routineName, setRoutineName] = useState('');
  const [routineType, setRoutineType] = useState('nourrissage');
  const [routineFrequency, setRoutineFrequency] = useState('daily');
  const [routineTime, setRoutineTime] = useState('08:00');
  const [routineDate, setRoutineDate] = useState('');
  const [routineWeekDay, setRoutineWeekDay] = useState(1);
  const [routineDayOfMonth, setRoutineDayOfMonth] = useState(1);
  const [routineIntervalHours, setRoutineIntervalHours] = useState(2);
  const [routineActive, setRoutineActive] = useState(true);
  const [isCreatingRoutine, setIsCreatingRoutine] = useState(false);
  const [routineError, setRoutineError] = useState('');
  const [showDeleteRoutineConfirm, setShowDeleteRoutineConfirm] = useState(false);
  const [routineToDelete, setRoutineToDelete] = useState<string | null>(null);
  const [isDeletingRoutine, setIsDeletingRoutine] = useState(false);

  // Modèles de routines de l'espèce (module D)
  const [routineTemplates, setRoutineTemplates] = useState<SpeciesRoutineTemplate[]>([]);
  const [showRoutineTemplates, setShowRoutineTemplates] = useState(false);
  const [routineTemplatesLoading, setRoutineTemplatesLoading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const getRoutineTypeName = (type: string): string => {
    const types: Record<string, string> = {
      nourrissage: t('routines.types.feeding'),
      nettoyage: t('routines.types.cleaning'),
      uvb: t('routines.types.uvb'),
      controle: t('routines.types.health'),
      entretien: t('routines.types.cleaning'),
    };
    return types[type] || type;
  };

  const getFrequencyName = (frequency: string): string => {
    const frequencies: Record<string, string> = {
      daily: t('routines.frequencies.daily'),
      every_2_days: t('routines.frequencies.every_2_days'),
      every_3_days: t('routines.frequencies.every_3_days'),
      weekly: t('routines.frequencies.weekly'),
      monthly: t('routines.frequencies.monthly'),
      once: t('routines.frequencies.once'),
      hourly: t('routines.frequencies.hourly'),
      custom: t('routines.frequencies.custom'),
    };
    return frequencies[frequency] || frequency;
  };

  const openRoutineModalForCreate = () => {
    setEditingRoutineId(null);
    setRoutineName('');
    setRoutineType('nourrissage');
    setRoutineFrequency('daily');
    setRoutineTime('08:00');
    setRoutineDate('');
    setRoutineWeekDay(1);
    setRoutineDayOfMonth(1);
    setRoutineIntervalHours(2);
    setRoutineActive(true);
    setRoutineError('');
    setShowRoutineModal(true);
  };

  // Modèles de routines de l'espèce (module D) : fetch + suggestions cliquables
  const handleShowRoutineTemplates = async () => {
    if (!animal || !token) return;
    if (showRoutineTemplates) {
      setShowRoutineTemplates(false);
      return;
    }
    setRoutineTemplatesLoading(true);
    try {
      const templates = await api.getRoutineTemplates(animal.id, token);
      setRoutineTemplates(templates);
      setShowRoutineTemplates(templates.length > 0);
      if (templates.length === 0) onToast(t('animals.routineTemplates.noTemplates'));
    } catch (err) {
      console.error('Error fetching routine templates:', err);
      onToast(t('animals.routineTemplates.noTemplates'));
    } finally {
      setRoutineTemplatesLoading(false);
    }
  };

  const applyRoutineTemplate = (template: SpeciesRoutineTemplate) => {
    openRoutineModalForCreate();
    setRoutineName(template.name || '');
    if (template.type) setRoutineType(template.type);
    const sch = (template.schedule || {}) as {
      time?: string;
      recurrence?: string;
      date?: string;
      weekDay?: number;
      dayOfMonth?: number;
      intervalHours?: number;
    };
    const freq = sch?.recurrence ?? template.frequency ?? 'daily';
    setRoutineFrequency(freq);
    setRoutineTime(typeof sch?.time === 'string' && sch.time ? sch.time : '08:00');
    setRoutineDate(sch?.date ?? '');
    setRoutineWeekDay(typeof sch?.weekDay === 'number' ? sch.weekDay : 1);
    setRoutineDayOfMonth(typeof sch?.dayOfMonth === 'number' ? sch.dayOfMonth : 1);
    setRoutineIntervalHours(typeof sch?.intervalHours === 'number' ? sch.intervalHours : 2);
    setRoutineActive(true);
    setShowRoutineTemplates(false);
  };

  const openRoutineModalForEdit = (routine: Routine) => {
    setEditingRoutineId(routine.id);
    setRoutineName(routine.name || '');
    setRoutineType(routine.type);
    const sch = routine.schedule as { time?: string; recurrence?: string; date?: string; weekDay?: number; dayOfMonth?: number; intervalHours?: number } | undefined;
    const freq = sch?.recurrence ?? routine.frequency ?? 'daily';
    setRoutineFrequency(freq);
    const time = sch?.time ?? routine.schedule?.time ?? '08:00';
    setRoutineTime(typeof time === 'string' ? time : '08:00');
    setRoutineDate(sch?.date ?? '');
    setRoutineWeekDay(typeof sch?.weekDay === 'number' ? sch.weekDay : 1);
    setRoutineDayOfMonth(typeof sch?.dayOfMonth === 'number' ? sch.dayOfMonth : 1);
    setRoutineIntervalHours(typeof sch?.intervalHours === 'number' ? sch.intervalHours : 2);
    setRoutineActive(routine.active);
    setRoutineError('');
    setShowRoutineModal(true);
  };

  const handleSaveRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animal || !token) return;

    setRoutineError('');
    setIsCreatingRoutine(true);

    const schedule: Record<string, unknown> = {
      time: routineTime,
      recurrence: routineFrequency,
    };
    if (routineFrequency === 'once' && routineDate) schedule.date = routineDate;
    if (routineFrequency === 'weekly') schedule.weekDay = routineWeekDay;
    if (routineFrequency === 'monthly') schedule.dayOfMonth = routineDayOfMonth;
    if (routineFrequency === 'hourly') schedule.intervalHours = routineIntervalHours;

    const payload = {
      name: routineName || undefined,
      type: routineType,
      frequency: routineFrequency,
      schedule,
      active: routineActive,
    };

    try {
      if (editingRoutineId) {
        await api.updateRoutine(animal.id, editingRoutineId, payload, token);
      } else {
        await api.createRoutine(animal.id, { ...payload, active: payload.active ?? true }, token);
      }
      setShowRoutineModal(false);
      setEditingRoutineId(null);
      setRoutineName('');
      setRoutineType('nourrissage');
      setRoutineFrequency('daily');
      setRoutineTime('08:00');
      setRoutineDate('');
      setRoutineWeekDay(1);
      setRoutineDayOfMonth(1);
      setRoutineIntervalHours(2);
      setRoutineActive(true);
      await onRefresh();
    } catch (err) {
      console.error('Error saving routine:', err);
      setRoutineError(
        editingRoutineId
          ? t('animals.errorUpdatingRoutine')
          : t('animals.errorCreatingRoutine')
      );
    } finally {
      setIsCreatingRoutine(false);
    }
  };

  const handleDeleteRoutine = async () => {
    if (!animal || !token || !routineToDelete) return;
    setIsDeletingRoutine(true);
    try {
      await api.deleteRoutine(animal.id, routineToDelete, token);
      setShowDeleteRoutineConfirm(false);
      setRoutineToDelete(null);
      await onRefresh();
    } catch (err) {
      console.error('Error deleting routine:', err);
    } finally {
      setIsDeletingRoutine(false);
    }
  };

  const handleLoadHistory = async () => {
    if (!animal || !token) return;

    setIsLoadingHistory(true);
    setHistoryError('');
    try {
      const historyData = await api.getAnimalHistory(animal.id, token);
      setHistory(Array.isArray(historyData) ? historyData : []);
    } catch (err) {
      console.error('Error loading history:', err);
      setHistoryError(t('animals.errorLoadingHistory'));
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleOpenHistoryModal = async () => {
    setShowHistoryModal(true);
    if (history.length === 0) {
      await handleLoadHistory();
    }
  };

  return (
    <>
    {/* Routines */}
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
          {t('routines.title')}
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleShowRoutineTemplates}
            className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            {routineTemplatesLoading && (
              <span className="animate-spin h-3 w-3 border-2 border-emerald-600 border-t-transparent rounded-full inline-block"></span>
            )}
            {t('animals.routineTemplates.templates')}
          </button>
          <button 
            onClick={openRoutineModalForCreate}
            className="text-sm text-emerald-600 hover:text-emerald-700"
          >
            + {t('routines.addRoutine')}
          </button>
        </div>
      </div>

      {/* Suggestions : modèles de routines de l'espèce (module D) */}
      {showRoutineTemplates && routineTemplates.length > 0 && (
        <div className="mb-4 border border-emerald-200 dark:border-emerald-800 rounded-lg bg-emerald-50/60 dark:bg-emerald-900/10 p-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('animals.routineTemplates.title')}
          </p>
          <div className="space-y-1.5">
            {routineTemplates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => applyRoutineTemplate(tpl)}
                className="w-full text-left px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-emerald-400 transition-colors"
              >
                <span className="block text-sm font-medium text-gray-800 dark:text-white">
                  {tpl.name || getRoutineTypeName(tpl.type)}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {getRoutineTypeName(tpl.type)} · {getFrequencyName(tpl.frequency)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {routines.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {t('animals.noRoutines')}
          </p>
          <button 
            onClick={openRoutineModalForCreate}
            className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
          >
            {t('animals.createRoutine')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {routines.map((routine) => (
            <div
              key={routine.id}
              className={`p-4 rounded-lg border ${
                routine.active
                  ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-800 dark:text-white">
                    {routine.name || getRoutineTypeName(routine.type)}
                  </h3>
                  {routine.name && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {getRoutineTypeName(routine.type)}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {(routine.schedule as { time?: string })?.time ?? '—'} · {getFrequencyName(routine.frequency)}
                  </p>
                </div>
              <div className="flex items-center gap-1 shrink-0">
                  {routine.active && (
                    <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs rounded-full">
                      {t('routines.active')}
                    </span>
                  )}
                  {!routine.active && (
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-xs rounded-full">
                      {t('routines.paused')}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const updatedRoutine = { ...routine, active: !routine.active };
                      if (!animal || !token) return;
                      
                      const toggleActive = async () => {
                        try {
                          await api.updateRoutine(animal.id, routine.id, { active: !routine.active }, token);
                          await onRefresh();
                        } catch (err) {
                          console.error('Error toggling routine:', err);
                        }
                      };
                      toggleActive();
                    }}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    title={t('routines.toggleActive')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => openRoutineModalForEdit(routine)}
                    className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                    title={t('routines.editRoutine')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRoutineToDelete(routine.id);
                      setShowDeleteRoutineConfirm(true);
                    }}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title={t('routines.deleteRoutine')}
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

    {/* History link */}
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
        {t('animals.history')}
      </h2>
      <button 
        onClick={handleOpenHistoryModal}
        className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
      >
        {t('animals.viewHistory')}
      </button>
    </div>
      <div className="contents">
        {/* Routine Modal */}
        {showRoutineModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 md:p-8 max-w-[384px] w-full my-auto">
              <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">
                {editingRoutineId ? t('routines.editRoutine') : t('routines.addRoutine')}
              </h2>
            
              <form onSubmit={handleSaveRoutine} className="space-y-5">
                {/* Name (optional) */}
                <div>
                  <label htmlFor="routine-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nom de la routine (optionnel)
                  </label>
                  <input
                    id="routine-name"
                    type="text"
                    value={routineName}
                    onChange={(e) => setRoutineName(e.target.value)}
                    placeholder={t('routines.namePlaceholder')}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Type */}
                <div>
                  <label htmlFor="routine-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('routines.type')} *
                  </label>
                  <select
                    id="routine-type"
                    value={routineType}
                    onChange={(e) => setRoutineType(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    <option value="nourrissage">{t('routines.types.feeding')}</option>
                    <option value="entretien">{t('routines.types.cleaning')}</option>
                    <option value="uvb">{t('routines.types.uvb')}</option>
                    <option value="controle">{t('routines.types.health')}</option>
                  </select>
                </div>

                {/* Frequency / Recurrence (same as notifications) */}
                <div>
                  <label htmlFor="routine-frequency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('routines.frequency')} *
                  </label>
                  <select
                    id="routine-frequency"
                    value={routineFrequency}
                    onChange={(e) => setRoutineFrequency(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    <option value="daily">{t('routines.frequencies.daily')}</option>
                    <option value="every_2_days">{t('routines.frequencies.every_2_days')}</option>
                    <option value="every_3_days">{t('routines.frequencies.every_3_days')}</option>
                    <option value="weekly">{t('routines.frequencies.weekly')}</option>
                    <option value="monthly">{t('routines.frequencies.monthly')}</option>
                    <option value="once">{t('routines.frequencies.once')}</option>
                    <option value="hourly">{t('routines.frequencies.hourly')}</option>
                    <option value="custom">{t('routines.frequencies.custom')}</option>
                  </select>
                </div>

                {/* Time */}
                <div>
                  <label htmlFor="routine-time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('routines.schedule')}
                  </label>
                  <input
                    id="routine-time"
                    type="time"
                    value={routineTime}
                    onChange={(e) => setRoutineTime(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Optional: date (once), weekDay (weekly), dayOfMonth (monthly), intervalHours (hourly) */}
                {routineFrequency === 'once' && (
                  <div>
                    <label htmlFor="routine-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('notifications.date')}
                    </label>
                    <input
                      id="routine-date"
                      type="date"
                      value={routineDate}
                      onChange={(e) => setRoutineDate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                )}
                {routineFrequency === 'weekly' && (
                  <div>
                    <label htmlFor="routine-weekday" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('notifications.weekDay')}
                    </label>
                    <select
                      id="routine-weekday"
                      value={routineWeekDay}
                      onChange={(e) => setRoutineWeekDay(parseInt(e.target.value, 10))}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                    >
                      {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                        <option key={d} value={d}>{t(`notifications.weekDay${d}` as Parameters<typeof t>[0])}</option>
                      ))}
                    </select>
                  </div>
                )}
                {routineFrequency === 'monthly' && (
                  <div>
                    <label htmlFor="routine-daymonth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Jour du mois (1-31)
                    </label>
                    <input
                      id="routine-daymonth"
                      type="number"
                      min={1}
                      max={31}
                      value={routineDayOfMonth}
                      onChange={(e) => setRoutineDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1)))}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                )}
                {routineFrequency === 'hourly' && (
                  <div>
                    <label htmlFor="routine-interval" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Toutes les X heures (1-24)
                    </label>
                    <input
                      id="routine-interval"
                      type="number"
                      min={1}
                      max={24}
                      value={routineIntervalHours}
                      onChange={(e) => setRoutineIntervalHours(Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 2)))}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                )}

                {/* Active (both create and edit) */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={routineActive}
                    onChange={(e) => setRoutineActive(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t('routines.active')}</span>
                </label>

                {/* Error message */}
                {routineError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                    {routineError}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 pt-6">
                  <button
                    type="submit"
                    disabled={isCreatingRoutine}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                      isCreatingRoutine
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {isCreatingRoutine ? (
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
                    onClick={() => {
                      setShowRoutineModal(false);
                      setEditingRoutineId(null);
                      setRoutineError('');
                    }}
                    className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete routine confirmation */}
        {showDeleteRoutineConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-[384px] w-full">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
                {t('routines.deleteRoutine')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                {t('common.confirmDelete')}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDeleteRoutine}
                  disabled={isDeletingRoutine}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeletingRoutine ? t('common.loading') : t('common.delete')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteRoutineConfirm(false);
                    setRoutineToDelete(null);
                  }}
                  disabled={isDeletingRoutine}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* History Modal */}
        {showHistoryModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 md:p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto my-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                  {t('animals.history')}
                </h2>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {isLoadingHistory ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full"></div>
                </div>
              ) : historyError ? (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
                  {historyError}
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  {t('animals.noHistory')}
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-800 dark:text-white">
                          {entry.type}
                        </h3>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(entry.doneAt).toLocaleDateString(locale)} {new Date(entry.doneAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {entry.note && (
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {entry.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6">
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
