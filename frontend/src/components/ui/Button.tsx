import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from './cx';

/**
 * Bouton du carnet. Quatre intentions, trois tailles :
 *  - `primary`   : l'action principale de l'écran (une seule par zone) — aplat mousse ;
 *  - `secondary` : action alternative — surface + bordure de champ ;
 *  - `quiet`     : action de faible poids (Annuler, Modifier dans une liste) — texte accent ;
 *  - `danger`    : action destructive confirmée — aplat brique.
 * `ghost` reste accepté (ancien nom de `quiet`).
 *
 * Pour un lien qui a l'apparence d'un bouton, utiliser `buttonClasses()` sur `<Link>`.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonStyleOptions {
  variant?: ButtonVariant | 'ghost';
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-control border font-medium whitespace-nowrap no-underline select-none ' +
  'transition-[background-color,border-color,color] duration-150 ease-out ' +
  'disabled:cursor-not-allowed disabled:opacity-55 aria-busy:cursor-progress';

const SIZES: Record<ButtonSize, string> = {
  // 36 px en bureau ; la zone tactile remonte à 44 px sur pointeur grossier.
  sm: 'min-h-9 px-3 text-ui pointer-coarse:min-h-11',
  md: 'min-h-11 px-4 text-body',
  lg: 'min-h-12 px-5 text-body',
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-accent text-on-accent not-disabled:hover:bg-accent-strong',
  secondary: 'border-line-field bg-surface text-ink not-disabled:hover:bg-sunken',
  quiet: 'border-transparent bg-transparent text-accent-text not-disabled:hover:bg-accent-soft',
  danger: 'border-transparent bg-danger text-on-danger not-disabled:hover:bg-danger-strong',
};

/** Classes d'un bouton, réutilisables sur un `<Link>` ou un `<a>`. */
export function buttonClasses({ variant = 'primary', size = 'md', fullWidth = false, className }: ButtonStyleOptions = {}) {
  const intent: ButtonVariant = variant === 'ghost' ? 'quiet' : variant;
  return cx(BASE, SIZES[size], VARIANTS[intent], fullWidth && 'w-full', className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, Omit<ButtonStyleOptions, 'className'> {
  /** Affiche un indicateur, pose `aria-busy` et désactive le bouton le temps de l'opération. */
  loading?: boolean;
  /** Icône décorative avant / après le libellé (marquée aria-hidden par l'appelant ou ici). */
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

function Spinner() {
  return (
    <svg className="size-4 shrink-0 motion-safe:animate-spin" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" />
      <path d="M14.25 8A6.25 6.25 0 0 0 8 1.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  iconStart,
  iconEnd,
  type = 'button',
  className,
  children,
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading ? <Spinner /> : iconStart ? <span aria-hidden="true" className="inline-flex shrink-0">{iconStart}</span> : null}
      {children}
      {iconEnd && !loading ? <span aria-hidden="true" className="inline-flex shrink-0">{iconEnd}</span> : null}
    </button>
  );
}

export { Button };
