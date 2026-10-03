'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, type Animal } from '@/lib/api';
import { Button, Card, EmptyState, Field, cx } from '@/components/ui';
import { ConfirmDelete, DeleteAction, EditAction, FormDialog, Mono, RecordItem, RecordList } from './parts';
import { sectionErrorKey } from './sectionErrors';
import { optionalText } from './formValues';
import { useFormatters } from './useFormatters';
import type { HealthRecord } from './types';
import { localDayKey } from '@/lib/dates';

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
  const [healthFormDate, setHealthFormDate] = useState(localDayKey(new Date()));
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
    setHealthFormDate(localDayKey(new Date()));
    setHealthFormNotes('');
    setHealthError('');
    setShowHealthModal(true);
  };

  const openHealthModalForEdit = (record: HealthRecord) => {
    setEditingHealthId(record.id);
    setHealthFormType(record.type);
    setHealthFormTitle(record.title);
    setHealthFormDate(record.date ? record.date.slice(0, 10) : localDayKey(new Date()));
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
            // Notes vidées en modification : effacées (null), pas ignorées.
            notes: optionalText(healthFormNotes, true),
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
      setHealthError(t(sectionErrorKey(err)));
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

  const closeForm = () => {
    setShowHealthModal(false);
    setHealthError('');
  };
  const sorted = [...healthRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      <Card
        as="section"
        id="sante"
        title={t('animals.healthRecord')}
        titleId="health-title-heading"
        actions={
          healthRecords.length > 0 ? (
            <Button variant="quiet" size="sm" onClick={openHealthModalForCreate}>
              {t('animals.healthRecordAdd')}
            </Button>
          ) : undefined
        }
        className="scroll-mt-20"
      >
        {healthRecords.length === 0 ? (
          <EmptyState
            title={t('animals.healthRecordEmpty')}
            benefit={t('animals.sheet.healthBenefit')}
            action={
              <Button size="sm" onClick={openHealthModalForCreate}>
                {t('animals.healthRecordAdd')}
              </Button>
            }
          />
        ) : (
          <RecordList>
            {sorted.map((record) => (
              <RecordItem
                key={record.id}
                eyebrow={getHealthRecordTypeName(record.type)}
                title={record.title}
                meta={<Mono>{formatDate(record.date)}</Mono>}
                notes={record.notes}
                actions={
                  <>
                    <EditAction label={t('common.edit')} onClick={() => openHealthModalForEdit(record)} />
                    <DeleteAction
                      label={t('common.delete')}
                      onClick={() => {
                        setHealthRecordToDelete(record.id);
                        setShowDeleteHealthConfirm(true);
                      }}
                      disabled={healthDeletingId === record.id}
                    />
                  </>
                }
              />
            ))}
          </RecordList>
        )}
      </Card>

      <FormDialog
        open={showHealthModal}
        title={editingHealthId ? t('common.edit') : t('animals.healthRecordAdd')}
        description={t('animals.healthRecordFormIntro')}
        onClose={closeForm}
        onSubmit={handleSaveHealthRecord}
        submitting={healthSubmitting}
        error={healthError}
      >
        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-ui font-medium text-ink">
            {t('animals.healthRecordType')}
            <span aria-hidden="true" className="ml-0.5 text-danger">
              *
            </span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['vaccine', 'surgery', 'specific_food', 'medical_history'] as const).map((type) => (
              <label
                key={type}
                className={cx(
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-control border px-3 py-2 text-ui transition-colors',
                  healthFormType === type ? 'border-accent bg-accent-soft text-ink' : 'border-line-field text-ink hover:bg-sunken',
                )}
              >
                <input type="radio" name="health-type" value={type} checked={healthFormType === type} onChange={() => setHealthFormType(type)} className="size-4 shrink-0" />
                {t(`animals.healthRecordTypes.${type}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label={t('animals.healthRecordTitle')} hint={t('animals.healthRecordTitleHelp')} required id="health-title">
          <input type="text" value={healthFormTitle} onChange={(e) => setHealthFormTitle(e.target.value)} autoComplete="off" maxLength={200} />
        </Field>
        <Field label={t('animals.healthRecordDate')} hint={t('animals.healthRecordDateHelp')} required id="health-date">
          <input type="date" className="font-mono" value={healthFormDate} onChange={(e) => setHealthFormDate(e.target.value)} />
        </Field>
        <Field label={t('animals.healthRecordNotes')} hint={t('animals.healthRecordNotesHelp')} id="health-notes">
          <textarea value={healthFormNotes} onChange={(e) => setHealthFormNotes(e.target.value)} rows={3} placeholder={t('animals.healthRecordPlaceholderNotes')} maxLength={5000} />
        </Field>
      </FormDialog>

      <ConfirmDelete
        open={showDeleteHealthConfirm}
        title={t('animals.deleteHealthRecord')}
        message={t('common.confirmDelete')}
        busy={healthDeletingId !== null}
        onConfirm={() => healthRecordToDelete && handleDeleteHealthRecord(healthRecordToDelete)}
        onCancel={() => {
          setShowDeleteHealthConfirm(false);
          setHealthRecordToDelete(null);
        }}
      />
    </>
  );
}
