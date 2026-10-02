import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export type BadgeTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Pastille de couleur avant le libellé (le libellé porte le sens, jamais la couleur seule). */
  dot?: boolean;
  children: ReactNode;
}

const TONES: Record<BadgeTone, string> = {
  neutral: 'border-line-strong bg-transparent text-ink-2',
  accent: 'border-transparent bg-accent-soft text-accent-text',
  ok: 'border-transparent bg-ok-soft text-ok',
  warn: 'border-transparent bg-warn-soft text-warn',
  danger: 'border-transparent bg-danger-soft text-danger',
  info: 'border-transparent bg-info-soft text-info',
};

/**
 * Étiquette courte (statut, catégorie, type de soin). Rectangle 6 px, pas de pilule ni d'icône
 * dans un carré : un mot, éventuellement une pastille.
 *
 * @example <Badge tone="warn" dot>À faire</Badge>
 */
export default function Badge({ tone = 'neutral', dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center gap-1.5 rounded-control border px-2 py-0.5 text-meta font-medium leading-5 whitespace-nowrap',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

export { Badge };

/* -------------------------------------------------------------------------- */
/* Statut UICN (Liste rouge) — couleurs officielles, codes à deux lettres.     */
/* -------------------------------------------------------------------------- */

/** Catégories de la Liste rouge, de « Éteinte » à « Non évaluée ». */
export const IUCN_CATEGORIES = ['EX', 'EW', 'CR', 'EN', 'VU', 'NT', 'LC', 'DD', 'NE'] as const;
export type IucnCategory = (typeof IUCN_CATEGORIES)[number];

/** Échelle ordonnée affichée par `IucnScale` (DD et NE sont hors échelle). */
export const IUCN_SCALE: readonly IucnCategory[] = ['EX', 'EW', 'CR', 'EN', 'VU', 'NT', 'LC'];

/**
 * Pastilles aux couleurs officielles de l'UICN. Le texte (blanc ou noir) est choisi pour
 * dépasser 4,5:1 sur chaque fond (vérifié : cf. docs/DESIGN.md).
 */
export const IUCN_CHIP_CLASSES: Record<IucnCategory, string> = {
  EX: 'bg-[var(--iucn-ex)] text-[#fff] border-transparent',
  EW: 'bg-[var(--iucn-ew)] text-[#fff] border-transparent',
  CR: 'bg-[var(--iucn-cr)] text-[#fff] border-transparent',
  EN: 'bg-[var(--iucn-en)] text-[#000] border-transparent',
  VU: 'bg-[var(--iucn-vu)] text-[#000] border-transparent',
  NT: 'bg-[var(--iucn-nt)] text-[#000] border-transparent',
  LC: 'bg-[var(--iucn-lc)] text-[#000] border-transparent',
  DD: 'bg-[var(--iucn-dd)] text-[#000] border-transparent',
  NE: 'bg-[var(--iucn-ne)] text-[#000] border-line-field',
};

/** Normalise une valeur d'API (« lc », « LC », « Least Concern »…) en code UICN, sinon `null`. */
export function toIucnCategory(value: string | null | undefined): IucnCategory | null {
  if (!value) return null;
  const v = value.trim().toUpperCase();
  if ((IUCN_CATEGORIES as readonly string[]).includes(v)) return v as IucnCategory;
  const byName: Record<string, IucnCategory> = {
    EXTINCT: 'EX',
    'EXTINCT IN THE WILD': 'EW',
    'CRITICALLY ENDANGERED': 'CR',
    ENDANGERED: 'EN',
    VULNERABLE: 'VU',
    'NEAR THREATENED': 'NT',
    'LEAST CONCERN': 'LC',
    'DATA DEFICIENT': 'DD',
    'NOT EVALUATED': 'NE',
  };
  return byName[v] ?? null;
}

export interface IucnBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  category: IucnCategory;
  /** Libellé traduit de la catégorie (« Préoccupation mineure »). Toujours lu par les lecteurs d'écran. */
  label: string;
  /** Afficher le libellé à côté du code (défaut `true`) ; sinon il reste en texte masqué. */
  showLabel?: boolean;
}

/**
 * Statut UICN : code officiel sur sa couleur de Liste rouge + libellé.
 *
 * @example <IucnBadge category="VU" label={t('species.iucn.VU')} />
 */
export function IucnBadge({ category, label, showLabel = true, className, ...props }: IucnBadgeProps) {
  return (
    <span className={cx('inline-flex items-center gap-2 text-ui text-ink', className)} {...props}>
      <span
        aria-hidden="true"
        title={label}
        className={cx(
          'inline-flex h-6 min-w-8 items-center justify-center rounded-[3px] border px-1 font-mono text-meta font-medium tracking-wide',
          IUCN_CHIP_CLASSES[category],
        )}
      >
        {category}
      </span>
      <span className={showLabel ? undefined : 'sr-only'}>{label}</span>
    </span>
  );
}

export interface IucnScaleProps extends Omit<HTMLAttributes<HTMLOListElement>, 'children'> {
  category: IucnCategory;
  /** Libellés traduits des 9 catégories. */
  labels: Record<IucnCategory, string>;
  /** Nom de la liste (« Statut UICN »). */
  'aria-label': string;
}

/**
 * Échelle de la Liste rouge (EX → LC), la catégorie de l'espèce en couleur, les autres au trait.
 * Hors échelle (DD, NE) : l'échelle reste neutre et le libellé est affiché dessous.
 */
export function IucnScale({ category, labels, className, ...props }: IucnScaleProps) {
  const offScale = !IUCN_SCALE.includes(category);
  return (
    <div className={cx('inline-grid gap-1.5', className)}>
      <ol className="m-0 flex list-none gap-1 p-0" {...props}>
        {IUCN_SCALE.map((code) => {
          const current = code === category;
          return (
            <li key={code} aria-current={current ? 'true' : undefined} className="m-0">
              <span
                title={labels[code]}
                className={cx(
                  'inline-flex h-7 min-w-8 items-center justify-center rounded-[3px] border px-1 font-mono text-meta font-medium',
                  current ? IUCN_CHIP_CLASSES[code] : 'border-line-strong bg-transparent text-ink-2',
                )}
              >
                <span aria-hidden="true">{code}</span>
                <span className="sr-only">{labels[code]}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="m-0 text-ui text-ink">
        {offScale ? (
          <>
            <span className="font-mono text-meta text-ink-2">{category}</span> {labels[category]}
          </>
        ) : (
          labels[category]
        )}
      </p>
    </div>
  );
}
