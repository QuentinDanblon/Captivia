'use client';

import { useTranslations } from 'next-intl';
import { Button, Modal } from '@/components/ui';

interface NotificationPrimerProps {
  open: boolean;
  busy?: boolean;
  onAccept: () => void;
  onLater: () => void;
}

/**
 * Explication préalable à la demande de permission système (W6-07) : proposée une seule fois par
 * appareil, au premier soin créé (ou juste après une connexion s'il y a des soins à rappeler),
 * jamais au lancement. « Activer » déclenche la boîte de dialogue du système ; « Plus tard » ne
 * demande rien (le bouton des paramètres de notifications reste disponible).
 */
export function NotificationPrimer({ open, busy = false, onAccept, onLater }: NotificationPrimerProps) {
  const t = useTranslations('nativeReminders');
  return (
    <Modal
      open={open}
      onClose={onLater}
      title={t('primerTitle')}
      description={t('primerBody')}
      size="sm"
      dismissible={!busy}
      hideCloseButton
    >
      <div className="flex flex-col gap-2">
        <Button onClick={onAccept} loading={busy} fullWidth>
          {t('primerAccept')}
        </Button>
        <Button variant="quiet" onClick={onLater} disabled={busy} fullWidth>
          {t('primerLater')}
        </Button>
      </div>
    </Modal>
  );
}

export default NotificationPrimer;
