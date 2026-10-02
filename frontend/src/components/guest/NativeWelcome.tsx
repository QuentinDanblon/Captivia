'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { IS_MOBILE_BUILD, isNative } from '@/lib/platform';
import { hasSeenWelcome, markWelcomeSeen } from '@/lib/guest';
import { Button, Modal } from '@/components/ui';
import { useStartGuest } from './useStartGuest';

/**
 * App mobile (Capacitor), premier lancement sans session : propose directement l'essai sans
 * compte (une seule fois par installation). Rien sur le web, où chaque page de l'app affiche
 * l'accueil invité (`GuestEntry`).
 */
export function NativeWelcome() {
  const t = useTranslations('guest');
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { start, starting, error } = useStartGuest();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isLoading || user) return;
    if (!(IS_MOBILE_BUILD || isNative()) || hasSeenWelcome()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dépend du stockage et de la plateforme (client)
    setOpen(true);
  }, [isLoading, user]);

  const close = () => {
    markWelcomeSeen();
    setOpen(false);
  };

  return (
    <Modal open={open} onClose={close} title={t('welcomeTitle')} description={t('welcomeText')} size="md">
      <div className="grid gap-3">
        <Button
          size="lg"
          fullWidth
          loading={starting}
          onClick={async () => {
            if (await start()) {
              close();
              router.push('/mes-animaux');
            }
          }}
        >
          {starting ? t('entryStarting') : t('entryTry')}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={() => {
            close();
            router.push('/login');
          }}
        >
          {t('entryLogin')}
        </Button>
        <Button variant="quiet" fullWidth onClick={close}>
          {t('welcomeLater')}
        </Button>
        {error ? (
          <p role="alert" className="m-0 text-ui font-medium text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

export default NativeWelcome;
