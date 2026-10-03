'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, type Animal, type BreedingRecord } from '@/lib/api';
import { Badge, Button, Card, EmptyState, Field } from '@/components/ui';
import { ConfirmDelete, DeleteAction, EditAction, FormDialog, LockedNote, Mono, RecordItem, RecordList, SectionError, SectionLoading } from './parts';
import { useAuth } from '@/contexts/AuthContext';
import { isPremiumLocked, sectionErrorKey } from './sectionErrors';
import { useFormatters } from './useFormatters';
import { localDayKey } from '@/lib/dates';
import { MAX_OFFSPRING_COUNT, optionalText, parseOffspringCount } from './formValues';

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
  const { formatDate } = useFormatters();
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

  const getBreedingEventLabel = (type: string): string => {
    const labels: Record<string, string> = {
      heat: t('animals.breeding.heat'),
      mating: t('animals.breeding.mating'),
      pregnancy: t('animals.breeding.pregnancy'),
      birth: t('animals.breeding.birth'),
      weaning: t('animals.breeding.weaning'),
    };
    return labels[type] || type;
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
    // Nombre de petits : entier de 0 à 100 (DTO), obligatoire pour une naissance.
    const offspringEmpty = breedingOffspringCount.trim() === '';
    const offspringCount = parseOffspringCount(breedingOffspringCount);
    if ((!offspringEmpty || breedingEventType === 'birth') && offspringCount === null) {
      setBreedingFormError(
        t(offspringEmpty ? 'animals.breeding.offspringRequired' : 'animals.breeding.offspringInvalid', { max: MAX_OFFSPRING_COUNT }),
      );
      return;
    }

    setBreedingSubmitting(true);
    setBreedingFormError('');
    try {
      // En modification, un champ facultatif vidé est effacé (null) ; à la création, il est omis.
      const editing = editingBreedingId !== null;
      const payload: Partial<BreedingRecord> = {
        eventType: breedingEventType,
        date: breedingDate,
        partnerName: optionalText(breedingPartnerName, editing),
        offspringCount: offspringCount ?? (editing ? null : undefined),
        notes: optionalText(breedingNotes, editing),
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

  const closeForm = () => {
    setShowBreedingModal(false);
    setBreedingFormError('');
  };
  const canEdit = !!user?.isPremium && !breedingLocked;

  return (
    <>
      <Card
        as="section"
        id="reproduction"
        title={t('animals.breeding.title')}
        titleId="breeding-title"
        actions={
          canEdit && breedingRecords.length > 0 ? (
            <Button variant="quiet" size="sm" onClick={openBreedingModalForCreate}>
              {t('animals.breeding.add')}
            </Button>
          ) : undefined
        }
        className="scroll-mt-20"
      >
        {breedingLocked ? (
          <LockedNote message={t('animals.breeding.premiumRequired')} />
        ) : breedingLoading ? (
          <SectionLoading />
        ) : breedingError ? (
          <SectionError message={breedingError} />
        ) : breedingRecords.length === 0 ? (
          canEdit ? (
            <EmptyState
              title={t('animals.breeding.noData')}
              benefit={t('animals.sheet.breedingBenefit')}
              action={
                <Button size="sm" onClick={openBreedingModalForCreate}>
                  {t('animals.breeding.add')}
                </Button>
              }
            />
          ) : (
            <LockedNote message={t('animals.breeding.premiumRequired')} />
          )
        ) : (
          <RecordList>
            {[...breedingRecords]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((rec) => (
                <RecordItem
                  key={rec.id}
                  title={getBreedingEventLabel(rec.eventType)}
                  badges={
                    rec.eventType === 'birth' && rec.offspringCount != null ? (
                      <Badge tone="accent">
                        {rec.offspringCount} {t('animals.breeding.offspringBadge')}
                      </Badge>
                    ) : null
                  }
                  meta={
                    <>
                      <Mono>{formatDate(rec.date)}</Mono>
                      {rec.partnerName ? ` · ${t('animals.breeding.partnerName')} : ${rec.partnerName}` : null}
                    </>
                  }
                  notes={rec.notes}
                  actions={
                    canEdit ? (
                      <>
                        <EditAction label={t('animals.breeding.edit')} onClick={() => openBreedingModalForEdit(rec)} />
                        <DeleteAction
                          label={t('animals.breeding.delete')}
                          onClick={() => {
                            setBreedingToDelete(rec.id);
                            setShowDeleteBreedingConfirm(true);
                          }}
                          disabled={breedingDeletingId === rec.id}
                        />
                      </>
                    ) : null
                  }
                />
              ))}
          </RecordList>
        )}
      </Card>

      <FormDialog
        open={showBreedingModal}
        title={editingBreedingId ? t('animals.breeding.edit') : t('animals.breeding.add')}
        onClose={closeForm}
        onSubmit={handleSaveBreedingRecord}
        submitting={breedingSubmitting}
        error={breedingFormError}
      >
        <Field label={t('animals.breeding.eventType')} required id="breeding-event-type">
          <select value={breedingEventType} onChange={(e) => setBreedingEventType(e.target.value as BreedingRecord['eventType'])}>
            {(['heat', 'mating', 'pregnancy', 'birth', 'weaning'] as const).map((type) => (
              <option key={type} value={type}>
                {getBreedingEventLabel(type)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('animals.breeding.date')} required id="breeding-date">
            <input type="date" className="font-mono" value={breedingDate} onChange={(e) => setBreedingDate(e.target.value)} />
          </Field>
          <Field label={t('animals.breeding.offspringCount')} required={breedingEventType === 'birth'} id="breeding-offspring">
            <input
              type="number"
              min={0}
              max={MAX_OFFSPRING_COUNT}
              step={1}
              inputMode="numeric"
              className="font-mono"
              value={breedingOffspringCount}
              onChange={(e) => setBreedingOffspringCount(e.target.value)}
            />
          </Field>
        </div>
        <Field label={t('animals.breeding.partnerName')} id="breeding-partner">
          <input type="text" value={breedingPartnerName} onChange={(e) => setBreedingPartnerName(e.target.value)} placeholder={t('animals.breeding.partnerNamePlaceholder')} autoComplete="off" maxLength={100} />
        </Field>
        <Field label={t('animals.breeding.notes')} id="breeding-notes">
          <textarea value={breedingNotes} onChange={(e) => setBreedingNotes(e.target.value)} rows={3} maxLength={1000} />
        </Field>
      </FormDialog>

      <ConfirmDelete
        open={showDeleteBreedingConfirm}
        title={t('animals.breeding.delete')}
        message={t('animals.breeding.deleteConfirm')}
        busy={breedingDeletingId !== null}
        onConfirm={handleDeleteBreedingRecord}
        onCancel={() => {
          setShowDeleteBreedingConfirm(false);
          setBreedingToDelete(null);
        }}
      />
    </>
  );
}
