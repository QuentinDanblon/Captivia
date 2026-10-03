'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api, type Animal, type AnimalMeasurement } from '@/lib/api';
import { formatWeight } from '@/lib/today';
import { Button, Card, EmptyState, Field } from '@/components/ui';
import { ConfirmDelete, DeleteAction, EditAction, FormDialog, LockedNote, Mono, RecordItem, RecordList, SectionError, SectionLoading } from './parts';
import { isPremiumLocked, sectionErrorKey } from './sectionErrors';
import { useFormatters } from './useFormatters';
import WeightChart from '@/components/WeightChart';
import { localDayKey } from '@/lib/dates';
import { isSuspiciousChange, parseDecimal } from './formValues';

interface Props {
  animal: Animal;
  token: string | null;
  measurements: AnimalMeasurement[];
  loading: boolean;
  error: string;
  locked: boolean;
  onLocked: () => void;
  onRefresh: () => Promise<void>;
  /** Incrémenté par la barre d'actions de la fiche : ouvre le formulaire « Ajouter une mesure ». */
  createRequest?: number;
}

export default function MeasurementsSection({ animal, token, measurements, loading: measurementsLoading, error: measurementsError, locked: measurementsLocked, onLocked, onRefresh, createRequest = 0 }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const { formatDate } = useFormatters();
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [editingMeasurementId, setEditingMeasurementId] = useState<string | null>(null);
  const [measurementDate, setMeasurementDate] = useState(localDayKey(new Date()));
  const [measurementWeight, setMeasurementWeight] = useState('');
  const [measurementHeight, setMeasurementHeight] = useState('');
  const [measurementNotes, setMeasurementNotes] = useState('');
  const [measurementSubmitting, setMeasurementSubmitting] = useState(false);
  const [measurementFormError, setMeasurementFormError] = useState('');
  /** Poids très éloigné de la pesée précédente : valeur à confirmer par un second envoi. */
  const [weightToConfirm, setWeightToConfirm] = useState<number | null>(null);
  const [measurementToDelete, setMeasurementToDelete] = useState<string | null>(null);
  const [showDeleteMeasurementConfirm, setShowDeleteMeasurementConfirm] = useState(false);
  const [measurementDeletingId, setMeasurementDeletingId] = useState<string | null>(null);

  const openMeasurementModalForCreate = () => {
    // D-16 : carnet complet sans Premium (seul un refus de l'API verrouille la section).
    if (measurementsLocked) return;
    setEditingMeasurementId(null);
    setMeasurementDate(localDayKey(new Date()));
    setMeasurementWeight('');
    setMeasurementHeight('');
    setMeasurementNotes('');
    setMeasurementFormError('');
    setWeightToConfirm(null);
    setShowMeasurementModal(true);
  };

  const openMeasurementModalForEdit = (measurement: AnimalMeasurement) => {
    // D-16 : carnet complet sans Premium (seul un refus de l'API verrouille la section).
    if (measurementsLocked) return;
    setEditingMeasurementId(measurement.id);
    setMeasurementDate(measurement.measuredAt ? measurement.measuredAt.slice(0, 10) : localDayKey(new Date()));
    setMeasurementWeight(typeof measurement.weightKg === 'number' ? String(measurement.weightKg) : '');
    setMeasurementHeight(typeof measurement.heightCm === 'number' ? String(measurement.heightCm) : '');
    setMeasurementNotes(measurement.notes || '');
    setMeasurementFormError('');
    setWeightToConfirm(null);
    setShowMeasurementModal(true);
  };

  const handleSaveMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animal || !token) return;
    if (!measurementDate) return;

    // Virgule ou point décimal acceptés (« 4,25 ») ; valeurs strictement positives.
    const weightNum = parseDecimal(measurementWeight);
    const heightNum = parseDecimal(measurementHeight);
    if (weightNum !== null && !(weightNum > 0 && weightNum <= 10000)) {
      setMeasurementFormError(t('animals.measurements.weightInvalid'));
      return;
    }
    if (heightNum !== null && !(heightNum > 0 && heightNum <= 10000)) {
      setMeasurementFormError(t('animals.measurements.heightInvalid'));
      return;
    }
    if (weightNum === null && heightNum === null) {
      setMeasurementFormError(t('animals.measurements.valueRequired'));
      return;
    }
    // Écart d'un facteur 10 avec la pesée précédente (kg saisis en g ?) : confirmation demandée.
    const previousWeight = sortedByDate(measurements).find((m) => m.id !== editingMeasurementId && m.weightKg != null)?.weightKg;
    if (weightNum !== null && weightNum !== weightToConfirm && isSuspiciousChange(previousWeight, weightNum)) {
      setWeightToConfirm(weightNum);
      setMeasurementFormError(
        t('animals.measurements.confirmWeight', {
          previous: formatWeight(previousWeight as number, locale),
          next: formatWeight(weightNum, locale),
        }),
      );
      return;
    }

    setMeasurementSubmitting(true);
    setMeasurementFormError('');
    try {
      // En modification, un champ vidé est effacé (null) ; à la création, il est omis.
      const editing = editingMeasurementId !== null;
      const payload = {
        measuredAt: measurementDate,
        weightKg: weightNum ?? (editing ? null : undefined),
        heightCm: heightNum ?? (editing ? null : undefined),
        notes: measurementNotes.trim() || (editing ? null : undefined),
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
      if (isPremiumLocked(err)) {
        onLocked();
        setShowMeasurementModal(false);
      } else {
        setMeasurementFormError(t(sectionErrorKey(err)));
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

  // Demande venue de la barre d'actions (mobile) : même ouverture que le bouton de la section.
  // Départ à 0 : une demande faite avant le chargement du code de la section est honorée au montage.
  const lastRequest = useRef(0);
  useEffect(() => {
    if (createRequest === lastRequest.current) return;
    lastRequest.current = createRequest;
    openMeasurementModalForCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ouverture sur demande uniquement
  }, [createRequest]);

  const closeForm = () => {
    setShowMeasurementModal(false);
    setMeasurementFormError('');
  };
  const sorted = sortedByDate(measurements);

  return (
    <>
      <Card
        as="section"
        id="mesures"
        title={t('animals.measurements.title')}
        titleId="measurements-title"
        actions={
          !measurementsLocked && measurements.length > 0 ? (
            <Button variant="quiet" size="sm" onClick={openMeasurementModalForCreate}>
              {t('animals.measurements.add')}
            </Button>
          ) : undefined
        }
        className="scroll-mt-20"
      >
        {measurementsLocked ? (
          <LockedNote message={t('animals.measurements.premiumRequired')} />
        ) : measurementsLoading ? (
          <SectionLoading />
        ) : measurementsError ? (
          <SectionError message={measurementsError} />
        ) : measurements.length === 0 ? (
          <EmptyState
            title={t('animals.measurements.noData')}
            benefit={t('animals.sheet.measurementsBenefit')}
            action={
              <Button size="sm" onClick={openMeasurementModalForCreate}>
                {t('animals.measurements.add')}
              </Button>
            }
          />
        ) : (
          <div className="grid gap-5">
            <WeightChart measurements={measurements} />
            <RecordList label={t('animals.sheet.measurementsList')}>
              {sorted.map((m) => (
                <RecordItem
                  key={m.id}
                  title={<Mono>{formatDate(m.measuredAt)}</Mono>}
                  meta={
                    <>
                      {m.weightKg !== null && m.weightKg !== undefined ? <Mono>{formatWeight(m.weightKg, locale)}</Mono> : null}
                      {m.weightKg != null && m.heightCm != null ? ' · ' : null}
                      {m.heightCm !== null && m.heightCm !== undefined ? (
                        <Mono>{new Intl.NumberFormat(locale, { style: 'unit', unit: 'centimeter', maximumFractionDigits: 1 }).format(m.heightCm)}</Mono>
                      ) : null}
                    </>
                  }
                  notes={m.notes}
                  actions={
                    <>
                      <EditAction label={t('animals.measurements.edit')} onClick={() => openMeasurementModalForEdit(m)} />
                      <DeleteAction
                        label={t('animals.measurements.delete')}
                        onClick={() => {
                          setMeasurementToDelete(m.id);
                          setShowDeleteMeasurementConfirm(true);
                        }}
                        disabled={measurementDeletingId === m.id}
                      />
                    </>
                  }
                />
              ))}
            </RecordList>
          </div>
        )}
      </Card>

      <FormDialog
        open={showMeasurementModal}
        title={editingMeasurementId ? t('animals.measurements.edit') : t('animals.measurements.add')}
        onClose={closeForm}
        onSubmit={handleSaveMeasurement}
        submitting={measurementSubmitting}
        error={measurementFormError}
      >
        <Field label={t('animals.measurements.date')} required id="measurement-date">
          <input type="date" className="font-mono" value={measurementDate} onChange={(e) => setMeasurementDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('animals.measurements.weightKg')} hint={t('animals.sheet.weightHint')} id="measurement-weight">
            <input
              type="text"
              inputMode="decimal"
              className="font-mono"
              value={measurementWeight}
              onChange={(e) => {
                setMeasurementWeight(e.target.value);
                setWeightToConfirm(null);
              }}
              autoComplete="off"
              maxLength={12}
            />
          </Field>
          <Field label={t('animals.measurements.heightCm')} id="measurement-height">
            <input
              type="text"
              inputMode="decimal"
              className="font-mono"
              value={measurementHeight}
              onChange={(e) => setMeasurementHeight(e.target.value)}
              autoComplete="off"
              maxLength={12}
            />
          </Field>
        </div>
        <Field label={t('animals.measurements.notes')} id="measurement-notes">
          <textarea value={measurementNotes} onChange={(e) => setMeasurementNotes(e.target.value)} rows={3} maxLength={500} />
        </Field>
      </FormDialog>

      <ConfirmDelete
        open={showDeleteMeasurementConfirm}
        title={t('animals.measurements.delete')}
        message={t('animals.measurements.deleteConfirm')}
        busy={measurementDeletingId !== null}
        onConfirm={handleDeleteMeasurement}
        onCancel={() => {
          setShowDeleteMeasurementConfirm(false);
          setMeasurementToDelete(null);
        }}
      />
    </>
  );
}

/** Mesures de la plus récente à la plus ancienne. */
function sortedByDate(list: AnimalMeasurement[]): AnimalMeasurement[] {
  return [...list].sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());
}
