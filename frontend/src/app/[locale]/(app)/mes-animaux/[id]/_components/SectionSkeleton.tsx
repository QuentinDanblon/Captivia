/** Placeholder affiché pendant le chargement d'un composant d'onglet / de section (next/dynamic). */
export default function SectionSkeleton({ className = 'h-32' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg animate-pulse ${className}`}
    />
  );
}
