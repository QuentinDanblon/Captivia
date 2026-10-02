'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { GuestBanner, buttonClasses } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { GUEST_UPGRADE_PATH, isGuestBannerSnoozed, isGuestUser, snoozeGuestBanner } from '@/lib/guest';

export interface GuestSaveBannerProps {
  /** Nom de l'animal de l'invité (« Kaa et son carnet… »), s'il en a un. */
  animalName?: string;
  /** Masquable (7 jours) ; `false` sur les pages où l'invitation est le sujet (paramètres). */
  dismissible?: boolean;
  className?: string;
}

/**
 * Bandeau invité « Sauvegardez vos données » (DESIGN.md § 5.1) : rendu seulement pour une session
 * invité, en tête du contenu, discret et masquable. Mène à la création de compte sans perte.
 */
export function GuestSaveBanner({ animalName, dismissible = true, className }: GuestSaveBannerProps) {
  const t = useTranslations('guest');
  const { user } = useAuth();
  // Lecture du stockage après le montage (indisponible au rendu serveur).
  const [snoozed, setSnoozed] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- état client seulement (localStorage)
    setSnoozed(dismissible && isGuestBannerSnoozed());
  }, [dismissible]);

  if (!isGuestUser(user) || snoozed) return null;

  return (
    <GuestBanner
      className={className}
      title={t('bannerTitle')}
      description={animalName ? t('bannerTextNamed', { name: animalName }) : t('bannerText')}
      action={
        <Link href={GUEST_UPGRADE_PATH} className={buttonClasses({ size: 'sm' })}>
          {t('bannerAction')}
        </Link>
      }
      dismissLabel={dismissible ? t('bannerDismiss') : undefined}
      onDismiss={() => snoozeGuestBanner()}
    />
  );
}

export default GuestSaveBanner;
