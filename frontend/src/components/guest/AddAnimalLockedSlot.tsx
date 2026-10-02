'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LockedSlot, PremiumBadge, buttonClasses } from '@/components/ui';
import { GUEST_UPGRADE_PATH } from '@/lib/guest';

export interface AddAnimalLockedSlotProps {
  /** Invité : l'étape suivante est le compte ; compte gratuit : Premium. */
  isGuest: boolean;
  className?: string;
}

/**
 * « Ajouter un animal » verrouillé quand la limite gratuite (1 animal) est atteinte. La valeur
 * avant le prix : plusieurs animaux = compte + Premium (docs/PRODUCT.md, D-16).
 */
export function AddAnimalLockedSlot({ isGuest, className }: AddAnimalLockedSlotProps) {
  const t = useTranslations('guest');
  return (
    <LockedSlot
      className={className}
      title={t('lockedTitle')}
      value={isGuest ? t('lockedValueGuest') : t('lockedValueFree')}
      badge={<PremiumBadge label={t('premium')} />}
      action={
        <Link
          href={isGuest ? GUEST_UPGRADE_PATH : '/parametres/abonnement'}
          className={buttonClasses({ variant: 'secondary', size: 'sm' })}
        >
          {isGuest ? t('lockedActionGuest') : t('lockedActionFree')}
        </Link>
      }
    />
  );
}

export default AddAnimalLockedSlot;
