'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { History, Pause, Play } from 'lucide-react';
import { api, type Animal, type SpeciesRoutineTemplate } from '@/lib/api';
import { Badge, Button, Card, EmptyState, Field, Modal } from '@/components/ui';
import { ConfirmDelete, DeleteAction, EditAction, FormDialog, IconAction, Mono, RecordItem, RecordList, SectionError, SectionLoading } from './parts';

import type { Routine, HistoryEntry } from './types';
import { optionalText, parseIntervalHours } from './formValues';
import { localDayKey } from '@/lib/dates';
import { errorKey } from '@/lib/api-errors';

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
  /** Intervalle saisi, gardé en chaîne (validé de 1 à 24 à l'enregistrement). */
  const [routineIntervalHours, setRoutineIntervalHours] = useState('2');
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
      changement_eau: t('routines.types.waterChange'),
      nettoyage_habitat: t('routines.types.habitatCleaning'),
      litiere: t('routines.types.litter'),
      promenade: t('routines.types.walk'),
      exercice: t('routines.types.exercise'),
      brossage: t('routines.types.brushing'),
      hygiene: t('routines.types.hygiene'),
      entrainement: t('routines.types.training'),
      controle_materiel: t('routines.types.equipmentCheck'),
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
    setRoutineIntervalHours('2');
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
    setRoutineDate(sch?.date ?? (freq === 'once' ? localDayKey(new Date()) : ''));
    setRoutineWeekDay(typeof sch?.weekDay === 'number' ? sch.weekDay : 1);
    setRoutineDayOfMonth(typeof sch?.dayOfMonth === 'number' ? sch.dayOfMonth : 1);
    setRoutineIntervalHours(String(typeof sch?.intervalHours === 'number' ? sch.intervalHours : 2));
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
    setRoutineDate(sch?.date ?? (freq === 'once' ? localDayKey(new Date()) : ''));
    setRoutineWeekDay(typeof sch?.weekDay === 'number' ? sch.weekDay : 1);
    setRoutineDayOfMonth(typeof sch?.dayOfMonth === 'number' ? sch.dayOfMonth : 1);
    setRoutineIntervalHours(String(typeof sch?.intervalHours === 'number' ? sch.intervalHours : 2));
    setRoutineActive(routine.active);
    setRoutineError('');
    setShowRoutineModal(true);
  };

  const handleSaveRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animal || !token) return;

    // « Une seule fois » : la date est obligatoire (sans elle, le rappel ne se déclencherait jamais).
    if (routineFrequency === 'once' && !routineDate) {
      setRoutineError(t('routines.dateRequired'));
      return;
    }
    const intervalHours = parseIntervalHours(routineIntervalHours);
    if (routineFrequency === 'hourly' && intervalHours === null) {
      setRoutineError(t('animals.medications.intervalInvalid'));
      return;
    }

    setRoutineError('');
    setIsCreatingRoutine(true);

    const schedule: Record<string, unknown> = {
      time: routineTime,
      recurrence: routineFrequency,
    };
    if (routineFrequency === 'once') schedule.date = routineDate;
    if (routineFrequency === 'weekly') schedule.weekDay = routineWeekDay;
    if (routineFrequency === 'monthly') schedule.dayOfMonth = routineDayOfMonth;
    if (routineFrequency === 'hourly') schedule.intervalHours = intervalHours;

    const payload = {
      // Nom vidé en modification : effacé (null) ; omis à la création.
      name: optionalText(routineName, editingRoutineId !== null),
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
      setRoutineIntervalHours('2');
      setRoutineActive(true);
      await onRefresh();
    } catch (err) {
      console.error('Error saving routine:', err);
      setRoutineError(
        t(errorKey(err, { fallback: editingRoutineId ? 'animals.errorUpdatingRoutine' : 'animals.errorCreatingRoutine' })),
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

  const toggleActive = async (routine: Routine) => {
    if (!animal || !token) return;
    try {
      await api.updateRoutine(animal.id, routine.id, { active: !routine.active }, token);
      await onRefresh();
    } catch (err) {
      console.error('Error toggling routine:', err);
    }
  };

  const closeForm = () => {
    setShowRoutineModal(false);
    setEditingRoutineId(null);
    setRoutineError('');
  };

  const historyDate = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <>
      <Card
        as="section"
        id="soins"
        title={t('routines.title')}
        titleId="routines-title"
        actions={
          <>
            <Button variant="quiet" size="sm" onClick={handleShowRoutineTemplates} loading={routineTemplatesLoading} aria-expanded={showRoutineTemplates}>
              {t('animals.routineTemplates.templates')}
            </Button>
            {routines.length > 0 ? (
              <Button variant="quiet" size="sm" onClick={openRoutineModalForCreate}>
                {t('routines.addRoutine')}
              </Button>
            ) : null}
          </>
        }
        className="scroll-mt-20"
      >
        {/* Suggestions : modèles de routines de l'espèce (module D) */}
        {showRoutineTemplates && routineTemplates.length > 0 ? (
          <div className="mb-4 grid gap-2 rounded-control bg-sunken p-3">
            <p className="m-0 text-ui font-medium text-ink">{t('animals.routineTemplates.title')}</p>
            <ul className="m-0 grid list-none gap-1.5 p-0">
              {routineTemplates.map((tpl) => (
                <li key={tpl.id}>
                  <button
                    type="button"
                    onClick={() => applyRoutineTemplate(tpl)}
                    className="grid min-h-11 w-full gap-0.5 rounded-control border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-line-field"
                  >
                    <span className="text-ui font-medium text-ink">{tpl.name || getRoutineTypeName(tpl.type)}</span>
                    <span className="text-meta text-ink-2">
                      {getRoutineTypeName(tpl.type)} · {getFrequencyName(tpl.frequency)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {routines.length === 0 ? (
          <EmptyState
            title={t('animals.noRoutines')}
            benefit={t('animals.sheet.routinesBenefit')}
            action={
              <Button size="sm" onClick={openRoutineModalForCreate}>
                {t('animals.createRoutine')}
              </Button>
            }
          />
        ) : (
          <RecordList>
            {routines.map((routine) => (
              <RecordItem
                key={routine.id}
                muted={!routine.active}
                title={routine.name || getRoutineTypeName(routine.type)}
                badges={
                  <Badge tone={routine.active ? 'ok' : 'neutral'} dot={routine.active}>
                    {routine.active ? t('routines.active') : t('routines.paused')}
                  </Badge>
                }
                meta={
                  <>
                    {routine.name ? `${getRoutineTypeName(routine.type)} · ` : null}
                    <Mono>{(routine.schedule as { time?: string })?.time ?? '—'}</Mono>
                    {' · '}
                    {routine.frequency === 'hourly' && typeof routine.schedule?.intervalHours === 'number'
                      ? t('animals.sheet.everyNHours', { count: routine.schedule.intervalHours })
                      : getFrequencyName(routine.frequency)}
                  </>
                }
                actions={
                  <>
                    <IconAction icon={routine.active ? Pause : Play} label={t('routines.toggleActive')} onClick={() => void toggleActive(routine)} />
                    <EditAction label={t('routines.editRoutine')} onClick={() => openRoutineModalForEdit(routine)} />
                    <DeleteAction
                      label={t('routines.deleteRoutine')}
                      onClick={() => {
                        setRoutineToDelete(routine.id);
                        setShowDeleteRoutineConfirm(true);
                      }}
                    />
                  </>
                }
              />
            ))}
          </RecordList>
        )}

        <div className="mt-4 border-t border-line pt-3">
          <Button variant="quiet" size="sm" iconStart={<History size={16} strokeWidth={1.75} />} onClick={handleOpenHistoryModal}>
            {t('animals.viewHistory')}
          </Button>
        </div>
      </Card>

      <FormDialog
        open={showRoutineModal}
        title={editingRoutineId ? t('routines.editRoutine') : t('routines.addRoutine')}
        onClose={closeForm}
        onSubmit={handleSaveRoutine}
        submitting={isCreatingRoutine}
        error={routineError}
      >
        <Field label={t('animals.sheet.routineName')} id="routine-name">
          <input type="text" value={routineName} onChange={(e) => setRoutineName(e.target.value)} placeholder={t('routines.namePlaceholder')} autoComplete="off" maxLength={100} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('routines.type')} required id="routine-type">
            <select value={routineType} onChange={(e) => setRoutineType(e.target.value)}>
              <option value="nourrissage">{t('routines.types.feeding')}</option>
              <option value="entretien">{t('routines.types.cleaning')}</option>
              <option value="changement_eau">{t('routines.types.waterChange')}</option>
              <option value="nettoyage_habitat">{t('routines.types.habitatCleaning')}</option>
              <option value="litiere">{t('routines.types.litter')}</option>
              <option value="promenade">{t('routines.types.walk')}</option>
              <option value="exercice">{t('routines.types.exercise')}</option>
              <option value="brossage">{t('routines.types.brushing')}</option>
              <option value="hygiene">{t('routines.types.hygiene')}</option>
              <option value="entrainement">{t('routines.types.training')}</option>
              <option value="controle_materiel">{t('routines.types.equipmentCheck')}</option>
              <option value="uvb">{t('routines.types.uvb')}</option>
              <option value="controle">{t('routines.types.health')}</option>
            </select>
          </Field>
          <Field label={t('routines.frequency')} required id="routine-frequency">
            <select
              value={routineFrequency}
              onChange={(e) => {
                setRoutineFrequency(e.target.value);
                // « Une seule fois » : aujourd'hui par défaut.
                if (e.target.value === 'once' && !routineDate) setRoutineDate(localDayKey(new Date()));
              }}
            >
              <option value="daily">{t('routines.frequencies.daily')}</option>
              <option value="every_2_days">{t('routines.frequencies.every_2_days')}</option>
              <option value="every_3_days">{t('routines.frequencies.every_3_days')}</option>
              <option value="weekly">{t('routines.frequencies.weekly')}</option>
              <option value="monthly">{t('routines.frequencies.monthly')}</option>
              <option value="once">{t('routines.frequencies.once')}</option>
              <option value="hourly">{t('routines.frequencies.hourly')}</option>
              {/* « Personnalisé » n'a aucun réglage et ne déclenche aucun rappel : proposé
                  seulement pour une ancienne routine qui l'utilise déjà. */}
              {routineFrequency === 'custom' ? <option value="custom">{t('routines.frequencies.custom')}</option> : null}
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('routines.schedule')} id="routine-time">
            <input type="time" className="font-mono" value={routineTime} onChange={(e) => setRoutineTime(e.target.value)} />
          </Field>
          {routineFrequency === 'once' ? (
            <Field label={t('notifications.date')} required id="routine-date">
              <input type="date" className="font-mono" value={routineDate} onChange={(e) => setRoutineDate(e.target.value)} required />
            </Field>
          ) : null}
          {routineFrequency === 'weekly' ? (
            <Field label={t('notifications.weekDay')} id="routine-weekday">
              <select value={routineWeekDay} onChange={(e) => setRoutineWeekDay(parseInt(e.target.value, 10))}>
                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                  <option key={d} value={d}>
                    {t(`notifications.weekDay${d}` as Parameters<typeof t>[0])}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {routineFrequency === 'monthly' ? (
            <Field label={t('animals.sheet.dayOfMonth')} id="routine-daymonth">
              <input
                type="number"
                min={1}
                max={31}
                className="font-mono"
                value={routineDayOfMonth}
                onChange={(e) => setRoutineDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1)))}
              />
            </Field>
          ) : null}
          {routineFrequency === 'hourly' ? (
            <Field label={t('animals.sheet.everyHours')} hint={t('notifications.intervalHint')} required id="routine-interval">
              <input
                type="number"
                min={1}
                max={24}
                step={1}
                inputMode="numeric"
                className="font-mono"
                value={routineIntervalHours}
                onChange={(e) => setRoutineIntervalHours(e.target.value)}
              />
            </Field>
          ) : null}
        </div>
        <label className="flex min-h-11 items-center gap-2 text-ui text-ink">
          <input type="checkbox" className="size-4" checked={routineActive} onChange={(e) => setRoutineActive(e.target.checked)} />
          {t('routines.active')}
        </label>
      </FormDialog>

      <ConfirmDelete
        open={showDeleteRoutineConfirm}
        title={t('routines.deleteRoutine')}
        message={t('common.confirmDelete')}
        busy={isDeletingRoutine}
        onConfirm={handleDeleteRoutine}
        onCancel={() => {
          setShowDeleteRoutineConfirm(false);
          setRoutineToDelete(null);
        }}
      />

      <Modal open={showHistoryModal} onClose={() => setShowHistoryModal(false)} title={t('animals.history')} size="xl">
        {isLoadingHistory ? (
          <SectionLoading rows={3} />
        ) : historyError ? (
          <SectionError message={historyError} />
        ) : history.length === 0 ? (
          <p className="m-0 text-body text-ink-2">{t('animals.noHistory')}</p>
        ) : (
          <ol className="m-0 grid list-none divide-y divide-line p-0">
            {history.map((entry) => (
              <li key={entry.id} className="grid gap-0.5 py-3 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium text-ink">{getRoutineTypeName(entry.type)}</span>
                  <time dateTime={entry.doneAt} className="font-mono text-meta text-ink-2">
                    {historyDate.format(new Date(entry.doneAt))}
                  </time>
                </div>
                {entry.note ? <p className="m-0 text-ui text-ink-2">{entry.note}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </Modal>
    </>
  );
}
