'use client';

import { useId, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AnimalSilhouette, cx, type SilhouetteKind } from '@/components/ui';

export interface AuthFrameProps {
  /** Titre de la page (h1, Fraunces). */
  title: ReactNode;
  /** Une phrase sous le titre : ce que la personne retrouve ou gagne. */
  lead?: ReactNode;
  /** Formulaire, messages, liens. */
  children: ReactNode;
  /** Panneau de droite (bureau) ; défaut : la planche Captivia (`AuthPlate`). */
  aside?: ReactNode;
  className?: string;
}

/**
 * Habillage des écrans de compte (connexion, inscription, mot de passe, vérification d'e-mail,
 * passage invité → compte) : le formulaire sur le papier, à gauche ; à partir de 1024 px, une
 * planche texturée à droite (pas de photo : aucune n'est encore sous licence dans
 * `public/images/`, et jamais d'image générée — DESIGN.md § 6). En mobile, le formulaire seul.
 */
export function AuthFrame({ title, lead, children, aside, className }: AuthFrameProps) {
  const headingId = useId();
  return (
    <div className={cx('cv-container py-8 sm:py-12 lg:py-16', className)}>
      <div className="grid items-stretch gap-10 lg:grid-cols-12 lg:gap-x-6">
        <section aria-labelledby={headingId} className="mx-auto w-full max-w-md min-w-0 lg:col-span-5 lg:mx-0 lg:max-w-none lg:py-6">
          <header className="mb-8 grid gap-3">
            <h1 id={headingId} className="m-0 text-h1 text-balance text-ink">
              {title}
            </h1>
            {lead ? <p className="m-0 max-w-prose text-body text-ink-2">{lead}</p> : null}
          </header>
          {children}
        </section>
        <div className="hidden min-w-0 lg:col-span-6 lg:col-start-7 lg:flex">{aside ?? <AuthPlate />}</div>
      </div>
    </div>
  );
}

const PLATE: { kind: SilhouetteKind; labelKey: string }[] = [
  { kind: 'reptile', labelKey: 'store.categoryReptile' },
  { kind: 'bird', labelKey: 'store.categoryBird' },
  { kind: 'mammal', labelKey: 'store.categoryMammal' },
  { kind: 'amphibian', labelKey: 'store.categoryAmphibian' },
];

/** Cadre commun aux panneaux de droite : papier creusé, grain, filet. */
export function AuthPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <aside
      className={cx(
        'cv-texture flex w-full flex-col justify-between gap-10 overflow-hidden rounded-card border border-line bg-sunken p-10 text-ink',
        className,
      )}
    >
      {children}
    </aside>
  );
}

/**
 * Planche « naturaliste » : quatre silhouettes au trait légendées comme des figures, puis trois
 * raisons de tenir le carnet. Purement illustrative ; les textes restent lisibles (pas d'aria-hidden).
 */
export function AuthPlate() {
  const t = useTranslations();
  return (
    <AuthPanel>
      <div className="flex items-baseline justify-between border-b border-line-strong pb-3 font-mono text-meta text-ink-2" aria-hidden="true">
        <span>Pl. I</span>
        <span>{t('common.appName')}</span>
      </div>

      <ul className="m-0 grid list-none grid-cols-2 gap-x-8 gap-y-10 p-0" aria-label={t('authFrame.plateLabel')}>
        {PLATE.map(({ kind, labelKey }, index) => (
          <li key={kind} className="grid justify-items-center gap-3">
            <AnimalSilhouette kind={kind} size={104} className="text-ink-3" />
            <span className="font-mono text-meta text-ink-2">
              <span aria-hidden="true">fig. {index + 1} · </span>
              {t(labelKey)}
            </span>
          </li>
        ))}
      </ul>

      <div className="grid gap-5">
        <p className="m-0 font-display text-h3 text-ink">{t('authFrame.title')}</p>
        <ol className="m-0 grid list-none gap-0 p-0">
          {[1, 2, 3].map((n) => (
            <li key={n} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-t border-line py-3">
              <span className="font-mono text-meta leading-6 text-ink-2">{String(n).padStart(2, '0')}</span>
              <span className="text-ui leading-6 text-ink-2">{t(`authFrame.point${n}`)}</span>
            </li>
          ))}
        </ol>
      </div>
    </AuthPanel>
  );
}

/** Séparateur « ou » entre le formulaire et l'essai sans compte. */
export function OrDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-meta text-ink-2">
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
      <span>{label}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </div>
  );
}

export default AuthFrame;
