'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { isGuestUser } from '@/lib/guest';
import { Alert, AnimalSilhouette, SkeletonGroup, Skeleton, buttonClasses } from '@/components/ui';
import { AuthFrame, AuthPanel } from '@/components/auth/AuthFrame';
import { GuestEntry } from '@/components/guest/GuestEntry';
import { UpgradeGuestForm } from '@/components/guest/UpgradeGuestForm';

/** Ce qui suit l'invité dans son compte : le même utilisateur côté API, donc tout. */
function KeptPanel({ animalName }: { animalName?: string }) {
  const t = useTranslations('guest');
  const items = [t('keptRecord'), t('keptReminders'), t('keptSettings')];
  return (
    <AuthPanel>
      <div className="flex items-baseline justify-between border-b border-line-strong pb-3 font-mono text-meta text-ink-2">
        <span>{t('keptLabel')}</span>
      </div>
      <div className="grid justify-items-start gap-6">
        <AnimalSilhouette kind="other" size={96} className="text-ink-3" />
        <p className="m-0 font-display text-h2 text-ink">
          {animalName ? t('keptTitleNamed', { name: animalName }) : t('keptTitle')}
        </p>
      </div>
      <ul className="m-0 grid list-none p-0">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 border-t border-line py-3 text-ui text-ink-2">
            <svg viewBox="0 0 16 16" className="mt-1 size-4 shrink-0 text-ok" fill="none" aria-hidden="true">
              <path d="M3.2 8.4 6.4 11.4 12.8 4.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </AuthPanel>
  );
}

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
      <div className="cv-container py-12">
        <SkeletonGroup label={t('entryStarting')} className="grid max-w-md gap-4">
          <Skeleton width="70%" height={40} />
          <Skeleton shape="block" height={320} />
        </SkeletonGroup>
      </div>
    );
  }

  if (!user) return <GuestEntry />;

  const done = Boolean(upgradedEmail) || !guest;

  return (
    <AuthFrame
      title={done ? t('upgradeDoneTitle') : t('upgradeTitle')}
      lead={done ? undefined : animalName ? t('upgradeIntroNamed', { name: animalName }) : t('upgradeIntro')}
      aside={<KeptPanel animalName={animalName} />}
    >
      {done ? (
        <div className="grid gap-6">
          <Alert
            severity="info"
            title={upgradedEmail ? t('upgradeSuccess', { email: upgradedEmail }) : t('upgradeAlreadyAccount', { email: user.email ?? '' })}
          />
          <Link href="/mes-animaux" className={buttonClasses({ size: 'lg', fullWidth: true })}>
            {t('upgradeBack')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          <p className="m-0 text-ui text-ink-2">{t('upgradeGains')}</p>
          <UpgradeGuestForm onUpgraded={setUpgradedEmail} />
        </div>
      )}
    </AuthFrame>
  );
}
