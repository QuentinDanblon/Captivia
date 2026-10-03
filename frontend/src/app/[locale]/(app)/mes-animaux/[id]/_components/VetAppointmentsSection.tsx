'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { api, type Animal, type VetAppointment } from '@/lib/api';
import { Badge, Button, Card, EmptyState, Field } from '@/components/ui';
import { ConfirmDelete, DeleteAction, FormDialog, IconAction, Mono, RecordItem, RecordList, SectionError, SectionLoading } from './parts';
import { sectionErrorKey } from './sectionErrors';
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
      setVetFormError(t(sectionErrorKey(err)));
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

  const closeForm = () => {
    setShowVetModal(false);
    setVetFormError('');
  };
  // À venir d'abord (le plus proche en tête), puis l'historique (le plus récent en tête).
  const nowMs = Date.now();
  const sorted = [...vetAppointments].sort((a, b) => {
    const fa = a.status === 'scheduled' && new Date(a.date).getTime() >= nowMs;
    const fb = b.status === 'scheduled' && new Date(b.date).getTime() >= nowMs;
    if (fa !== fb) return fa ? -1 : 1;
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return fa ? da - db : db - da;
  });

  return (
    <>
      <Card
        as="section"
        id="rendez-vous"
        title={t('animals.vetAppointments.title')}
        titleId="vet-title"
        actions={
          vetAppointments.length > 0 ? (
            <Button variant="quiet" size="sm" onClick={openVetModalForCreate}>
              {t('animals.vetAppointments.add')}
            </Button>
          ) : undefined
        }
        className="scroll-mt-20"
      >
        {vetAppointmentsLoading ? (
          <SectionLoading />
        ) : vetAppointmentsError ? (
          <SectionError message={vetAppointmentsError} />
        ) : vetAppointments.length === 0 ? (
          <EmptyState
            title={t('animals.vetAppointments.noData')}
            benefit={t('animals.sheet.vetBenefit')}
            action={
              <Button size="sm" onClick={openVetModalForCreate}>
                {t('animals.vetAppointments.add')}
              </Button>
            }
          />
        ) : (
          <RecordList>
            {sorted.map((appt) => (
              <RecordItem
                key={appt.id}
                muted={appt.status === 'cancelled'}
                title={appt.vetName}
                badges={
                  <Badge tone={appt.status === 'done' ? 'ok' : appt.status === 'cancelled' ? 'neutral' : 'info'} dot={appt.status === 'scheduled'}>
                    {getVetStatusName(appt.status)}
                  </Badge>
                }
                meta={
                  <>
                    <Mono>{formatDateTime(appt.date)}</Mono>
                    {appt.reason ? ` · ${appt.reason}` : null}
                    {appt.location ? (
                      <>
                        <br />
                        {appt.location}
                      </>
                    ) : null}
                  </>
                }
                notes={appt.notes}
                actions={
                  <>
                    {appt.status === 'scheduled' ? (
                      <>
                        <IconAction
                          icon={Check}
                          label={t('animals.vetAppointments.markDone')}
                          onClick={() => handleMarkVetDone(appt.id)}
                          disabled={vetStatusUpdatingId === appt.id}
                        />
                        <IconAction
                          icon={X}
                          label={t('animals.vetAppointments.cancel')}
                          onClick={() => handleCancelVetAppointment(appt.id)}
                          disabled={vetStatusUpdatingId === appt.id}
                        />
                      </>
                    ) : null}
                    <DeleteAction
                      label={t('animals.vetAppointments.delete')}
                      onClick={() => {
                        setVetToDelete(appt.id);
                        setShowDeleteVetConfirm(true);
                      }}
                      disabled={vetDeletingId === appt.id}
                    />
                  </>
                }
              />
            ))}
          </RecordList>
        )}
      </Card>

      <FormDialog
        open={showVetModal}
        title={t('animals.vetAppointments.add')}
        onClose={closeForm}
        onSubmit={handleSaveVetAppointment}
        submitting={vetSubmitting}
        error={vetFormError}
      >
        <Field label={t('animals.vetAppointments.vetName')} required id="vet-name">
          <input type="text" value={vetName} onChange={(e) => setVetName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label={t('animals.vetAppointments.reason')} id="vet-reason">
          <input type="text" value={vetReason} onChange={(e) => setVetReason(e.target.value)} autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('animals.vetAppointments.date')} required id="vet-date">
            <input type="datetime-local" className="font-mono" value={vetDate} onChange={(e) => setVetDate(e.target.value)} />
          </Field>
          <Field label={t('animals.vetAppointments.location')} id="vet-location">
            <input type="text" value={vetLocation} onChange={(e) => setVetLocation(e.target.value)} autoComplete="off" />
          </Field>
        </div>
        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-ui font-medium text-ink">{t('animals.vetAppointments.reminders')}</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex min-h-11 items-center gap-2 text-ui text-ink">
              <input type="checkbox" className="size-4" checked={vetReminderJ7} onChange={(e) => setVetReminderJ7(e.target.checked)} />
              {t('animals.vetAppointments.reminderJ7')}
            </label>
            <label className="flex min-h-11 items-center gap-2 text-ui text-ink">
              <input type="checkbox" className="size-4" checked={vetReminderJ1} onChange={(e) => setVetReminderJ1(e.target.checked)} />
              {t('animals.vetAppointments.reminderJ1')}
            </label>
          </div>
        </fieldset>
        <Field label={t('animals.vetAppointments.notes')} id="vet-notes">
          <textarea value={vetNotes} onChange={(e) => setVetNotes(e.target.value)} rows={3} />
        </Field>
      </FormDialog>

      <ConfirmDelete
        open={showDeleteVetConfirm}
        title={t('animals.vetAppointments.delete')}
        message={t('common.confirmDelete')}
        busy={vetDeletingId !== null}
        onConfirm={handleDeleteVetAppointment}
        onCancel={() => {
          setShowDeleteVetConfirm(false);
          setVetToDelete(null);
        }}
      />
    </>
  );
}
