'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Alert, buttonClasses } from '@/components/ui';
import { GUEST_UPGRADE_PATH } from '@/lib/guest';

export interface GuestFeatureNoteProps {
  /** Ce que la fonction demande et pourquoi (« L'abonnement calendrier demande un compte… »). */
  children: React.ReactNode;
  /** Masque le lien « Créer un compte » (déjà présent ailleurs dans la zone). */
  hideAction?: boolean;
  className?: string;
}

/**
 * À la place d'une action réservée aux comptes (lien public, flux ICS, abonnement, mot de passe) :
 * l'action est retirée et la raison expliquée, avec le chemin vers la création de compte.
 */
export function GuestFeatureNote({ children, hideAction, className }: GuestFeatureNoteProps) {
  const t = useTranslations('guest');
  return (
    <Alert
      severity="info"
      className={className}
      title={t('requiresAccount')}
      action={
        hideAction ? undefined : (
          <Link href={GUEST_UPGRADE_PATH} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
            {t('bannerAction')}
          </Link>
        )
      }
    >
      {children}
    </Alert>
  );
}

export default GuestFeatureNote;
