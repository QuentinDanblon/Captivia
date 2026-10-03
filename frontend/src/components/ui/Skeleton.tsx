import type { CSSProperties, ReactNode } from 'react';
import { cx } from './cx';

export interface SkeletonProps {
  /** `line` : ligne de texte ; `block` : vignette, carte ; `circle` : avatar. */
  shape?: 'line' | 'block' | 'circle';
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  className?: string;
}

const SHAPES = {
  line: 'h-[0.875em] rounded-[3px]',
  block: 'rounded-card',
  circle: 'rounded-full aspect-square',
} as const;

/**
 * Gabarit de chargement, décoratif (`aria-hidden`). Il reprend la forme du contenu attendu ;
 * l'annonce « chargement » est portée par `SkeletonGroup`. Pulsation coupée sous
 * `prefers-reduced-motion`.
 */
export default function Skeleton({ shape = 'line', width, height, className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      data-skeleton=""
      className={cx('block bg-sunken motion-safe:animate-pulse', SHAPES[shape], className)}
      style={{ width, height }}
    />
  );
}

export { Skeleton };

/** Paragraphe fictif : `lines` lignes, la dernière plus courte. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cx('grid gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 && lines > 1 ? '62%' : '100%'} />
      ))}
    </span>
  );
}

export interface SkeletonGroupProps {
  /** Annonce lue par les lecteurs d'écran (« Chargement du carnet… »). */
  label: string;
  children: ReactNode;
  className?: string;
}

/** Zone en cours de chargement : `role="status"`, `aria-busy`, libellé masqué visuellement. */
export function SkeletonGroup({ label, children, className }: SkeletonGroupProps) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
