'use client';

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { cx } from './cx';

/** Attributs posés sur le contrôle par `Field`. */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  required?: boolean;
}

export interface FieldProps {
  /** Libellé visible (obligatoire : pas de placeholder en guise de label). */
  label: ReactNode;
  /** Aide permanente sous le champ (unité, format attendu…). */
  hint?: ReactNode;
  /** Message d'erreur : passe le champ en `aria-invalid` et l'annonce via `aria-describedby`. */
  error?: ReactNode;
  /** Champ obligatoire : `required` sur le contrôle, astérisque décorative sur le libellé. */
  required?: boolean;
  /** Identifiant du contrôle (généré sinon). */
  id?: string;
  className?: string;
  /**
   * Le contrôle : un élément (`<input />`, `<select>`, `<textarea>`), qui reçoit `id`,
   * `aria-describedby`, `aria-invalid` et `required` ; ou une fonction qui les reçoit.
   */
  children: ReactElement<Partial<FieldControlProps>> | ((control: FieldControlProps) => ReactNode);
}

/**
 * Champ de formulaire accessible : libellé relié, aide et erreur annoncées.
 * Le style du contrôle vient de la couche `base` (bordure ≥ 3:1, 44 px de haut, focus 2 px).
 *
 * @example
 * <Field label="Poids" hint="En grammes, pesée à jeun" error={errors.weight} required>
 *   <input type="number" inputMode="decimal" className="font-mono" />
 * </Field>
 */
export default function Field({ label, hint, error, required, id, className, children }: FieldProps) {
  const autoId = useId();
  const controlId = id ?? `field-${autoId}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  const control: FieldControlProps = {
    id: controlId,
    ...(hintId || errorId ? { 'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') } : {}),
    ...(error ? { 'aria-invalid': true as const } : {}),
    ...(required ? { required: true } : {}),
  };

  let rendered: ReactNode;
  if (typeof children === 'function') {
    rendered = children(control);
  } else if (isValidElement(children)) {
    const own = children.props['aria-describedby'];
    rendered = cloneElement(children, {
      ...control,
      'aria-describedby': [own, control['aria-describedby']].filter(Boolean).join(' ') || undefined,
    });
  } else {
    rendered = children;
  }

  return (
    <div className={cx('grid gap-1.5', className)}>
      <label htmlFor={controlId} className="text-ui font-medium text-ink">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        ) : null}
      </label>
      {rendered}
      {hint ? (
        <p id={hintId} className="m-0 text-meta text-ink-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="m-0 flex items-start gap-1.5 text-meta font-medium text-danger">
          <svg viewBox="0 0 16 16" className="mt-0.5 size-3.5 shrink-0" fill="none" aria-hidden="true">
            <path d="M8 1.5 15 14H1L8 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M8 6v3.5M8 11.6v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export { Field };
