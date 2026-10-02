import type { SVGProps } from 'react';

/**
 * Marque Captivia : une feuille au trait (nervure comprise), dessinée comme une planche
 * d'herbier — pas de pastille ni de dégradé. Hérite de `currentColor`.
 */
export function BrandMark({ size = 22, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {/* Limbe en amande, de la base (bas gauche) à l'apex (haut droit). */}
      <path d="M4.5 19.5C4 11.5 9.5 4.8 19.5 4.5c.4 9.8-6.4 15.4-15 15Z" />
      {/* Nervure principale et deux nervures secondaires. */}
      <path d="M4.5 19.5 15.5 8.5" />
      <path d="M9.6 14.4h4.2M12.4 11.6V7.9" />
    </svg>
  );
}
