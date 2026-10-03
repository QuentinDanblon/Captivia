'use client';

import { useId, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Field, Modal } from '@/components/ui';
import {
  COMMUNITY_LIMITS,
  COMMUNITY_REASONS,
  communityApi,
  communityErrorKey,
  type CommunityReason,
} from '@/lib/community';
import { CharCount } from './primitives';

export interface ReportTarget {
  kind: 'post' | 'comment';
  id: string;
}

/**
 * Signalement d'une publication ou d'une réponse (DSA art. 16) : motif dans la liste fermée de
 * l'API, précisions facultatives (500 caractères). L'auteur ne sait pas qui l'a signalé.
 */
export default function ReportModal({
  target,
  token,
  onClose,
}: {
  target: ReportTarget | null;
  token: string;
  onClose: () => void;
}) {
  const t = useTranslations('community');
  const tc = useTranslations('common');
  const groupId = useId();
  const [reason, setReason] = useState<CommunityReason | null>(null);
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'already'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [missingReason, setMissingReason] = useState(false);

  const close = () => {
    if (state === 'sending') return;
    setReason(null);
    setDetails('');
    setState('idle');
    setError(null);
    setMissingReason(false);
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!target) return;
    if (!reason) {
      setMissingReason(true);
      return;
    }
    setState('sending');
    setError(null);
    const body = { reason, ...(details.trim() ? { details: details.trim() } : {}) };
    try {
      const res =
        target.kind === 'post' ? await communityApi.reportPost(token, target.id, body) : await communityApi.reportComment(token, target.id, body);
      setState(res.alreadyReported ? 'already' : 'sent');
    } catch (err) {
      setState('idle');
      setError(t(`errors.${communityErrorKey(err)}.title`));
    }
  };

  const title = target?.kind === 'comment' ? t('report.titleComment') : t('report.titlePost');

  return (
    <Modal open={target !== null} onClose={close} title={title} description={state === 'idle' || state === 'sending' ? t('report.intro') : undefined} size="lg" dismissible={state !== 'sending'}>
      {state === 'sent' || state === 'already' ? (
        <div className="grid gap-4" role="status">
          <p className="m-0 text-body text-ink">{state === 'sent' ? t('report.sent') : t('report.already')}</p>
          <p className="m-0 text-ui text-ink-2">{t('report.next')}</p>
          <div>
            <Button variant="secondary" onClick={close}>
              {tc('close')}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-5" noValidate>
          <fieldset className="m-0 grid gap-2 border-0 p-0" aria-describedby={missingReason ? `${groupId}-error` : undefined}>
            <legend className="mb-2 text-ui font-medium text-ink">{t('report.reasonLabel')}</legend>
            {COMMUNITY_REASONS.map((value) => (
              <label
                key={value}
                className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-control border border-line px-3 py-2.5 transition-colors hover:bg-sunken has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
              >
                <input
                  type="radio"
                  name={`${groupId}-reason`}
                  value={value}
                  checked={reason === value}
                  onChange={() => {
                    setReason(value);
                    setMissingReason(false);
                  }}
                  className="mt-1"
                />
                <span className="grid gap-0.5">
                  <span className="text-ui font-medium text-ink">{t(`reasons.${value}.label`)}</span>
                  <span className="text-meta text-ink-2">{t(`reasons.${value}.hint`)}</span>
                </span>
              </label>
            ))}
            {missingReason ? (
              <p id={`${groupId}-error`} role="alert" className="m-0 text-meta font-medium text-danger">
                {t('report.reasonMissing')}
              </p>
            ) : null}
          </fieldset>

          <Field label={t('report.detailsLabel')} hint={<CharCount value={details} max={COMMUNITY_LIMITS.reportDetails} />}>
            <textarea rows={3} value={details} maxLength={COMMUNITY_LIMITS.reportDetails} onChange={(e) => setDetails(e.target.value)} />
          </Field>

          {error ? (
            <p role="alert" className="m-0 text-ui font-medium text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={state === 'sending'}>
              {t('report.submit')}
            </Button>
            <Button variant="secondary" onClick={close} disabled={state === 'sending'}>
              {tc('cancel')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
