'use client';

import { useId, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cx } from '@/components/ui';
import { CommonsPhoto } from '@/components/CommonsPhoto';
import type { PhotoKey } from '@/content/photos';

export interface AuthFrameProps {
  /** Titre de la page (h1, Fraunces). */
  title: ReactNode;
  /** Une phrase sous le titre : ce que la personne retrouve ou gagne. */
  lead?: ReactNode;
  /** Formulaire, messages, liens. */
  children: ReactNode;
  /** Panneau de droite (bureau) ; défaut : la planche Captivia (`AuthPlate`) ouverte par `photo`. */
  aside?: ReactNode;
  /** Photo Commons de la planche par défaut (`content/photos.ts`) : une par écran de compte. */
  photo?: PhotoKey;
  className?: string;
}

/**
 * Habillage des écrans de compte (connexion, inscription, mot de passe, vérification d'e-mail,
 * passage invité → compte) : le formulaire sur le papier, à gauche ; à partir de 1024 px, une
 * planche texturée à droite, ouverte par une vraie photo Wikimedia Commons créditée (`Figure`,
 * crédit en légende — DESIGN.md § 6.6 et § 7). En mobile, le formulaire seul.
 */
export function AuthFrame({ title, lead, children, aside, photo = 'catStraw', className }: AuthFrameProps) {
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
        <div className="hidden min-w-0 lg:col-span-6 lg:col-start-7 lg:flex">{aside ?? <AuthPlate photo={photo} />}</div>
      </div>
    </div>
  );
}

/** Cadre commun aux panneaux de droite : papier creusé, grain, filet. */
export function AuthPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <aside
      className={cx(
        'cv-texture flex w-full flex-col gap-8 overflow-hidden rounded-card border border-line bg-sunken p-8 text-ink xl:p-10',
        className,
      )}
    >
      {children}
    </aside>
  );
}

/**
 * Planche de droite : une photo d'animal (Commons, créditée), puis trois raisons de tenir le
 * carnet, numérotées en mono. Les textes restent lisibles (pas d'aria-hidden).
 */
export function AuthPlate({ photo = 'catStraw' }: { photo?: PhotoKey }) {
  const t = useTranslations();
  return (
    <AuthPanel>
      <CommonsPhoto photo={photo} />
      <div className="mt-auto grid gap-5">
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
