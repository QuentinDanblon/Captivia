import { notFound } from 'next/navigation';

/**
 * Catch-all : toute URL inconnue sous /<locale>/... déclenche la page 404 de
 * app/[locale]/not-found.tsx, rendue dans le layout (en-tête et traductions).
 *
 * - `force-dynamic` : sans cela la route est mise en cache comme une page « normale » et
 *   répond 200 ; ici notFound() est évalué à chaque requête et renvoie un vrai statut 404.
 * - Ne PAS ajouter de loading.tsx sous app/[locale] : il crée une frontière Suspense, le flux
 *   démarre en 200 et notFound() ne peut plus changer le statut (soft 404 pour les moteurs de
 *   recherche, même avec le meta noindex).
 */
export const dynamic = 'force-dynamic';

export default function CatchAllNotFound() {
  notFound();
}
