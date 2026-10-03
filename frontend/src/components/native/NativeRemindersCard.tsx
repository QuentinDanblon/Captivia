'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import {
  areLocalRemindersEnabled,
  countScheduledReminders,
  getReminderPermission,
  setLocalRemindersEnabled,
  syncLocalReminders,
  type ReminderPermission,
} from '@/lib/local-reminders';
import { Alert, Badge, Button, Card, Skeleton, SkeletonGroup } from '@/components/ui';
import { useReminderTexts } from './useReminderTexts';

interface Status {
  enabled: boolean;
  permission: ReminderPermission;
  count: number;
}

async function readStatus(): Promise<Status> {
  const [enabled, permission, count] = await Promise.all([
    areLocalRemindersEnabled(),
    getReminderPermission(),
    countScheduledReminders(),
  ]);
  return { enabled, permission, count };
}

/**
 * Paramètres de notifications, dans l'app native (W6-06) : rappels programmés sur ce téléphone.
 * Activer demande la permission du système (seul moment où elle est demandée sur action) ;
 * couper annule tous les rappels programmés et n'en programme plus.
 */
export function NativeRemindersCard() {
  const t = useTranslations();
  const { user, token } = useAuth();
  const texts = useReminderTexts();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncError, setSyncError] = useState(false);

  const refresh = useCallback(async () => {
    setStatus(await readStatus());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void readStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = async () => {
    if (!user || !token) return;
    setBusy(true);
    setSyncError(false);
    try {
      await setLocalRemindersEnabled(true);
      const result = await syncLocalReminders({ token, userId: user.id, texts, prompt: 'always' });
      setSyncError(result.outcome === 'unavailable');
    } catch {
      setSyncError(true);
    }
    await refresh();
    setBusy(false);
  };

  const disable = async () => {
    setBusy(true);
    setSyncError(false);
    await setLocalRemindersEnabled(false);
    await refresh();
    setBusy(false);
  };

  const active = status?.enabled && status.permission === 'granted';
  const badge = !status ? null : status.permission === 'denied' ? (
    <Badge tone="warn" dot>
      {t('notifications.pushOff')}
    </Badge>
  ) : active ? (
    <Badge tone="ok" dot>
      {t('notifications.pushOn')}
    </Badge>
  ) : (
    <Badge>{t('notifications.pushOff')}</Badge>
  );

  return (
    <Card as="section" title={t('notifications.deviceTitle')} titleId="device-title" actions={badge}>
      <div className="grid gap-4">
        {!status ? (
          <SkeletonGroup label={t('common.loading')}>
            <Skeleton width="80%" />
          </SkeletonGroup>
        ) : status.permission === 'denied' ? (
          <Alert severity="warning" title={t('nativeReminders.blocked')} />
        ) : active ? (
          <>
            <p className="m-0 text-ui text-ink-2">{t('nativeReminders.onText', { count: status.count })}</p>
            <Button variant="secondary" onClick={disable} loading={busy} fullWidth>
              {t('nativeReminders.disable')}
            </Button>
          </>
        ) : (
          <>
            <p className="m-0 text-ui text-ink-2">{t('nativeReminders.offText')}</p>
            <Button onClick={enable} loading={busy} fullWidth>
              {busy ? t('notifications.enabling') : t('nativeReminders.enable')}
            </Button>
          </>
        )}
        {syncError ? (
          <p role="alert" className="m-0 text-ui font-medium text-danger">
            {t('nativeReminders.syncError')}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

export default NativeRemindersCard;
