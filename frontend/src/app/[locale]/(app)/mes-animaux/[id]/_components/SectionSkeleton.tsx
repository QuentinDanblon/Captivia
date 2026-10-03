import { Skeleton } from '@/components/ui';

/**
 * Gabarit d'une section de la fiche pendant le chargement de son code (next/dynamic) : une carte
 * vide à la forme du contenu. Décoratif ; l'annonce de chargement est portée par la page.
 */
export default function SectionSkeleton({ className = 'h-32' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`grid content-start gap-3 rounded-card border border-line bg-surface p-4 sm:p-6 ${className}`}>
      <Skeleton width="40%" height={22} />
      <Skeleton width="85%" />
      <Skeleton width="60%" />
    </div>
  );
}
