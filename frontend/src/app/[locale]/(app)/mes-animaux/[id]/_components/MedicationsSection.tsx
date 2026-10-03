'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Pause } from 'lucide-react';
import { api, type Animal, type Medication } from '@/lib/api';
import { Badge, Button, Card, EmptyState, Field } from '@/components/ui';
import { ConfirmDelete, DeleteAction, FormDialog, IconAction, LockedNote, Mono, RecordItem, RecordList, SectionError, SectionLoading } from './parts';
import { isPremiumLocked, sectionErrorKey } from './sectionErrors';
import { useFormatters } from './useFormatters';
import { localDayKey } from '@/lib/dates';
import { parseIntervalHours } from './formValues';

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
  /** Intervalle saisi, gardé en chaîne (validé de 1 à 24 à l'enregistrement, pas à chaque frappe). */
  const [medicationIntervalHours, setMedicationIntervalHours] = useState('8');
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
    setMedicationIntervalHours('8');
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
    const intervalHours = parseIntervalHours(medicationIntervalHours);
    if (medicationFrequency === 'every_x_hours' && intervalHours === null) {
      setMedicationFormError(t('animals.medications.intervalInvalid'));
      return;
    }
    if (medicationEndDate && medicationEndDate < medicationStartDate) {
      setMedicationFormError(t('animals.medications.endBeforeStart'));
      return;
    }

    setMedicationSubmitting(true);
    setMedicationFormError('');
    try {
      const payload = {
        name: medicationName.trim(),
        dose: medicationDose.trim(),
        unit: medicationUnit.trim() || undefined,
        frequency: medicationFrequency,
        intervalHours: medicationFrequency === 'every_x_hours' ? (intervalHours ?? undefined) : undefined,
        startDate: medicationStartDate,
        endDate: medicationEndDate || undefined,
        notes: medicationNotes.trim() || undefined,
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

  const closeForm = () => {
    setShowMedicationModal(false);
    setMedicationFormError('');
  };
  const addButton = (
    <Button variant="quiet" size="sm" onClick={openMedicationModalForCreate}>
      {t('animals.medications.add')}
    </Button>
  );

  return (
    <>
      <Card
        as="section"
        id="traitements"
        title={t('animals.medications.title')}
        titleId="medications-title"
        actions={!medicationsLocked && medications.length > 0 ? addButton : undefined}
        className="scroll-mt-20"
      >
        {medicationsLocked ? (
          <LockedNote message={t('animals.medications.premiumRequired')} />
        ) : medicationsLoading ? (
          <SectionLoading />
        ) : medicationsError ? (
          <SectionError message={medicationsError} />
        ) : medications.length === 0 ? (
          <EmptyState
            title={t('animals.medications.noData')}
            benefit={t('animals.sheet.medicationsBenefit')}
            action={
              <Button size="sm" onClick={openMedicationModalForCreate}>
                {t('animals.medications.add')}
              </Button>
            }
          />
        ) : (
          <RecordList>
            {medications.map((med) => (
              <RecordItem
                key={med.id}
                muted={!med.active}
                title={med.name}
                badges={
                  <Badge tone={med.active ? 'ok' : 'neutral'} dot={med.active}>
                    {med.active ? t('animals.medications.active') : t('animals.medications.inactive')}
                  </Badge>
                }
                meta={
                  <>
                    <Mono>
                      {med.dose}
                      {med.unit ? ` ${med.unit}` : ''}
                    </Mono>
                    {' · '}
                    {med.frequency === 'every_x_hours' && med.intervalHours
                      ? t('animals.sheet.everyNHours', { count: med.intervalHours })
                      : getMedicationFrequencyName(med.frequency)}
                    <br />
                    <Mono>{formatDate(med.startDate)}</Mono>
                    {med.endDate ? (
                      <>
                        {' → '}
                        <Mono>{formatDate(med.endDate)}</Mono>
                      </>
                    ) : null}
                  </>
                }
                notes={med.notes}
                actions={
                  <>
                    {med.active ? (
                      <IconAction
                        icon={Pause}
                        label={t('animals.medications.stop')}
                        onClick={() => handleStopMedication(med.id)}
                        loading={medicationStoppingId === med.id}
                      />
                    ) : null}
                    <DeleteAction
                      label={t('animals.medications.delete')}
                      onClick={() => {
                        setMedicationToDelete(med.id);
                        setShowDeleteMedicationConfirm(true);
                      }}
                      disabled={medicationDeletingId === med.id}
                    />
                  </>
                }
              />
            ))}
          </RecordList>
        )}
      </Card>

      <FormDialog
        open={showMedicationModal}
        title={t('animals.medications.add')}
        onClose={closeForm}
        onSubmit={handleSaveMedication}
        submitting={medicationSubmitting}
        error={medicationFormError}
      >
        <Field label={t('animals.medications.name')} required id="medication-name">
          <input type="text" value={medicationName} onChange={(e) => setMedicationName(e.target.value)} autoComplete="off" maxLength={100} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('animals.medications.dose')} required id="medication-dose">
            <input type="text" inputMode="decimal" className="font-mono" value={medicationDose} onChange={(e) => setMedicationDose(e.target.value)} autoComplete="off" maxLength={50} />
          </Field>
          <Field label={t('animals.medications.unit')} id="medication-unit">
            <input type="text" value={medicationUnit} onChange={(e) => setMedicationUnit(e.target.value)} placeholder={t('animals.medicationUnitPlaceholder')} autoComplete="off" maxLength={20} />
          </Field>
        </div>
        <Field label={t('animals.medications.frequency')} required id="medication-frequency">
          <select value={medicationFrequency} onChange={(e) => setMedicationFrequency(e.target.value as 'daily' | 'every_x_hours' | 'weekly')}>
            <option value="daily">{t('animals.medications.frequencyDaily')}</option>
            <option value="every_x_hours">{t('animals.medications.frequencyEveryXHours')}</option>
            <option value="weekly">{t('animals.medications.frequencyWeekly')}</option>
          </select>
        </Field>
        {medicationFrequency === 'every_x_hours' ? (
          <Field label={t('animals.medications.intervalHours')} hint={t('notifications.intervalHint')} required id="medication-interval">
            <input
              type="number"
              min={1}
              max={24}
              step={1}
              inputMode="numeric"
              className="font-mono"
              value={medicationIntervalHours}
              onChange={(e) => setMedicationIntervalHours(e.target.value)}
            />
          </Field>
        ) : null}
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('animals.medications.startDate')} required id="medication-start">
            <input type="date" className="font-mono" value={medicationStartDate} onChange={(e) => setMedicationStartDate(e.target.value)} />
          </Field>
          <Field label={t('animals.medications.endDate')} id="medication-end">
            <input type="date" className="font-mono" value={medicationEndDate} min={medicationStartDate || undefined} onChange={(e) => setMedicationEndDate(e.target.value)} />
          </Field>
        </div>
        <Field label={t('animals.medications.notes')} id="medication-notes">
          <textarea value={medicationNotes} onChange={(e) => setMedicationNotes(e.target.value)} rows={3} maxLength={1000} />
        </Field>
      </FormDialog>

      <ConfirmDelete
        open={showDeleteMedicationConfirm}
        title={t('animals.medications.delete')}
        message={t('common.confirmDelete')}
        busy={medicationDeletingId !== null}
        onConfirm={handleDeleteMedication}
        onCancel={() => {
          setShowDeleteMedicationConfirm(false);
          setMedicationToDelete(null);
        }}
      />
    </>
  );
}
