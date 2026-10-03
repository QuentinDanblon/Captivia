'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api, type Animal, type Vaccination } from '@/lib/api';
import { daysFrom, formatRelativeDays, VACCINE_SOON_DAYS } from '@/lib/today';
import { Badge, Button, Card, EmptyState, Field } from '@/components/ui';
import { ConfirmDelete, DeleteAction, EditAction, FormDialog, LockedNote, Mono, RecordItem, RecordList, SectionError, SectionLoading } from './parts';
import { isPremiumLocked, sectionErrorKey } from './sectionErrors';
import { useFormatters } from './useFormatters';
import { localDayKey } from '@/lib/dates';
import { optionalText } from './formValues';

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
  const locale = useLocale();
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
    // D-16 : carnet complet sans Premium (seul un refus de l'API verrouille la section).
    if (vaccinationsLocked) return;
    setEditingVaccinationId(null);
    setVaccinationName('');
    setVaccinationDate(localDayKey(new Date()));
    setVaccinationNextDue('');
    setVaccinationBatch('');
    setVaccinationVet('');
    setVaccinationNotes('');
    setVaccinationFormError('');
    setShowVaccinationModal(true);
  };

  const openVaccinationModalForEdit = (vaccination: Vaccination) => {
    // D-16 : carnet complet sans Premium (seul un refus de l'API verrouille la section).
    if (vaccinationsLocked) return;
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
    if (vaccinationNextDue && vaccinationNextDue < vaccinationDate) {
      setVaccinationFormError(t('animals.vaccinations.nextDueBeforeDate'));
      return;
    }

    setVaccinationSubmitting(true);
    setVaccinationFormError('');
    try {
      // En modification, un champ vidé est effacé (null : rappel supprimé…) ; à la création, omis.
      const editing = editingVaccinationId !== null;
      const payload = {
        name: vaccinationName.trim(),
        date: vaccinationDate,
        nextDueDate: optionalText(vaccinationNextDue, editing),
        batchNumber: optionalText(vaccinationBatch, editing),
        vetName: optionalText(vaccinationVet, editing),
        notes: optionalText(vaccinationNotes, editing),
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
      if (isPremiumLocked(err)) {
        onLocked();
        setShowVaccinationModal(false);
      } else {
        setVaccinationFormError(t(sectionErrorKey(err)));
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

  const closeForm = () => {
    setShowVaccinationModal(false);
    setVaccinationFormError('');
  };
  const sorted = [...vaccinations].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      <Card
        as="section"
        id="vaccins"
        title={t('animals.vaccinations.title')}
        titleId="vaccinations-title"
        actions={
          !vaccinationsLocked && vaccinations.length > 0 ? (
            <Button variant="quiet" size="sm" onClick={openVaccinationModalForCreate}>
              {t('animals.vaccinations.add')}
            </Button>
          ) : undefined
        }
        className="scroll-mt-20"
      >
        {vaccinationsLocked ? (
          <LockedNote message={t('animals.vaccinations.premiumRequired')} />
        ) : vaccinationsLoading ? (
          <SectionLoading />
        ) : vaccinationsError ? (
          <SectionError message={vaccinationsError} />
        ) : vaccinations.length === 0 ? (
          <EmptyState
            title={t('animals.vaccinations.noData')}
            benefit={t('animals.sheet.vaccinationsBenefit')}
            action={
              <Button size="sm" onClick={openVaccinationModalForCreate}>
                {t('animals.vaccinations.add')}
              </Button>
            }
          />
        ) : (
          <RecordList>
            {sorted.map((v) => {
              const due = v.nextDueDate ? daysFrom(v.nextDueDate) : null;
              const isOverdue = !!v.nextDueDate && new Date(v.nextDueDate) <= new Date();
              return (
                <RecordItem
                  key={v.id}
                  title={v.name}
                  badges={
                    v.nextDueDate && due !== null ? (
                      <Badge tone={isOverdue ? 'danger' : due <= VACCINE_SOON_DAYS ? 'warn' : 'neutral'} dot={isOverdue || due <= VACCINE_SOON_DAYS}>
                        {isOverdue ? t('animals.sheet.vaccineOverdue', { when: formatRelativeDays(due, locale) }) : t('animals.sheet.vaccineDue', { when: formatRelativeDays(due, locale) })}
                      </Badge>
                    ) : null
                  }
                  meta={
                    <>
                      {t('animals.vaccinations.date')} <Mono>{formatDate(v.date)}</Mono>
                      {v.nextDueDate ? (
                        <>
                          {' · '}
                          {t('animals.vaccinations.nextDue')} <Mono>{formatDate(v.nextDueDate)}</Mono>
                        </>
                      ) : null}
                      {v.batchNumber || v.vetName ? <br /> : null}
                      {v.batchNumber ? (
                        <>
                          {t('animals.vaccinations.batchNumber')} <Mono>{v.batchNumber}</Mono>
                        </>
                      ) : null}
                      {v.batchNumber && v.vetName ? ' · ' : null}
                      {v.vetName ?? null}
                    </>
                  }
                  notes={v.notes}
                  actions={
                    <>
                      <EditAction label={t('animals.vaccinations.edit')} onClick={() => openVaccinationModalForEdit(v)} />
                      <DeleteAction
                        label={t('animals.vaccinations.delete')}
                        onClick={() => {
                          setVaccinationToDelete(v.id);
                          setShowDeleteVaccinationConfirm(true);
                        }}
                        disabled={vaccinationDeletingId === v.id}
                      />
                    </>
                  }
                />
              );
            })}
          </RecordList>
        )}
      </Card>

      <FormDialog
        open={showVaccinationModal}
        title={editingVaccinationId ? t('animals.vaccinations.edit') : t('animals.vaccinations.add')}
        onClose={closeForm}
        onSubmit={handleSaveVaccination}
        submitting={vaccinationSubmitting}
        error={vaccinationFormError}
      >
        <Field label={t('animals.vaccinations.name')} required id="vaccination-name">
          <input type="text" value={vaccinationName} onChange={(e) => setVaccinationName(e.target.value)} autoComplete="off" maxLength={100} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('animals.vaccinations.date')} required id="vaccination-date">
            <input type="date" className="font-mono" value={vaccinationDate} onChange={(e) => setVaccinationDate(e.target.value)} />
          </Field>
          <Field label={t('animals.vaccinations.nextDue')} id="vaccination-next-due">
            <input type="date" className="font-mono" value={vaccinationNextDue} min={vaccinationDate || undefined} onChange={(e) => setVaccinationNextDue(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('animals.vaccinations.batchNumber')} id="vaccination-batch">
            <input type="text" className="font-mono" value={vaccinationBatch} onChange={(e) => setVaccinationBatch(e.target.value)} autoComplete="off" maxLength={100} />
          </Field>
          <Field label={t('animals.vaccinations.vetName')} id="vaccination-vet">
            <input type="text" value={vaccinationVet} onChange={(e) => setVaccinationVet(e.target.value)} autoComplete="off" maxLength={100} />
          </Field>
        </div>
        <Field label={t('animals.vaccinations.notes')} id="vaccination-notes">
          <textarea value={vaccinationNotes} onChange={(e) => setVaccinationNotes(e.target.value)} rows={3} maxLength={500} />
        </Field>
      </FormDialog>

      <ConfirmDelete
        open={showDeleteVaccinationConfirm}
        title={t('animals.vaccinations.delete')}
        message={t('animals.vaccinations.deleteConfirm')}
        busy={vaccinationDeletingId !== null}
        onConfirm={handleDeleteVaccination}
        onCancel={() => {
          setShowDeleteVaccinationConfirm(false);
          setVaccinationToDelete(null);
        }}
      />
    </>
  );
}
