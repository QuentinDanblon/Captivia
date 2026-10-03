'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button, LockedSlot, Modal, PremiumBadge, buttonClasses } from '@/components/ui';
import { NativePaywall } from '@/components/purchases/NativePaywall';
import { GUEST_UPGRADE_PATH } from '@/lib/guest';
import { useIsNative } from '@/lib/platform';

export interface AddAnimalLockedSlotProps {
  /** Invité : l'étape suivante est le compte ; compte gratuit : Premium. */
  isGuest: boolean;
  className?: string;
}

/**
 * « Ajouter un animal » verrouillé quand la limite gratuite (1 animal) est atteinte. La valeur
 * avant le prix : plusieurs animaux = compte + Premium (docs/PRODUCT.md, D-16).
 * Invité : création de compte. Compte gratuit : page abonnement sur le web ; dans l'app native, le
 * paywall du store s'ouvre sur place (W6-08) et se ferme dès que le backend confirme le Premium.
 */
export function AddAnimalLockedSlot({ isGuest, className }: AddAnimalLockedSlotProps) {
  const t = useTranslations('guest');
  const tPaywall = useTranslations('paywall');
  const native = useIsNative();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const inAppPurchase = native && !isGuest;

  return (
    <>
      <LockedSlot
        className={className}
        title={t('lockedTitle')}
        value={isGuest ? t('lockedValueGuest') : t('lockedValueFree')}
        badge={<PremiumBadge label={t('premium')} />}
        action={
          inAppPurchase ? (
            <Button variant="secondary" size="sm" onClick={() => setPaywallOpen(true)}>
              {t('lockedActionFree')}
            </Button>
          ) : (
            <Link
              href={isGuest ? GUEST_UPGRADE_PATH : '/parametres/abonnement'}
              className={buttonClasses({ variant: 'secondary', size: 'sm' })}
            >
              {isGuest ? t('lockedActionGuest') : t('lockedActionFree')}
            </Link>
          )
        }
      />
      {inAppPurchase ? (
        <Modal
          open={paywallOpen}
          onClose={() => setPaywallOpen(false)}
          title={tPaywall('modalTitle')}
          description={tPaywall('modalLead')}
          size="md"
          closeOnOverlayClick={false}
        >
          {paywallOpen ? <NativePaywall onActivated={() => setPaywallOpen(false)} /> : null}
        </Modal>
      ) : null}
    </>
  );
}

export default AddAnimalLockedSlot;
