'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { isGuestUser } from '@/lib/guest';
import { Alert, Card, SectionHeader, SkeletonGroup, Skeleton, buttonClasses } from '@/components/ui';
import { GuestEntry } from '@/components/guest/GuestEntry';
import { UpgradeGuestForm } from '@/components/guest/UpgradeGuestForm';

/**
 * « Sauvegardez vos données » : conversion de la session invité en compte, sans perte
 * (même utilisateur côté API). Sans session : l'accueil invité ; avec un compte : rien à faire.
 */
export default function SaveGuestDataPage() {
  const t = useTranslations('guest');
  const { user, token, isLoading } = useAuth();
  const [animalName, setAnimalName] = useState<string | undefined>();
  const [upgradedEmail, setUpgradedEmail] = useState<string | null>(null);
  const guest = isGuestUser(user);

  useEffect(() => {
    if (!guest || !token) return;
    let cancelled = false;
    api
      .getMyAnimals(token)
      .then((animals) => {
        if (cancelled || !Array.isArray(animals)) return;
        const first = animals[0] as { name?: unknown } | undefined;
        if (typeof first?.name === 'string') setAnimalName(first.name);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [guest, token]);

  if (isLoading) {
    return (
      <div className="cv-container py-8">
        <SkeletonGroup label={t('entryStarting')}>
          <Skeleton shape="block" height={320} />
        </SkeletonGroup>
      </div>
    );
  }

  if (!user) return <GuestEntry />;

  return (
    <div className="cv-container py-8">
      <div className="mx-auto grid max-w-2xl gap-6">
      <SectionHeader level={1} title={t('upgradeTitle')} />
      {upgradedEmail || !guest ? (
        <Alert
          severity="info"
          title={upgradedEmail ? t('upgradeSuccess', { email: upgradedEmail }) : t('upgradeAlreadyAccount', { email: user.email ?? '' })}
          action={
            <Link href="/mes-animaux" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
              {t('upgradeBack')}
            </Link>
          }
        />
      ) : (
        <Card padding="lg" className="grid gap-6">
          <div className="grid gap-2">
            <p className="m-0 text-body font-medium text-ink">
              {animalName ? t('upgradeIntroNamed', { name: animalName }) : t('upgradeIntro')}
            </p>
            <p className="m-0 text-ui text-ink-2">{t('upgradeGains')}</p>
          </div>
          <UpgradeGuestForm onUpgraded={setUpgradedEmail} />
        </Card>
      )}
      </div>
    </div>
  );
}
