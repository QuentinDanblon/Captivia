/**
 * Fiches de l'application sur les stores, affichées sur le web (« l'abonnement se prend dans l'app
 * mobile »). Tant que l'app n'est pas publiée, chaque lien reste un marqueur `[À COMPLÉTER : …]`
 * (même convention que `src/lib/legal.ts`) : renseigner `NEXT_PUBLIC_APP_STORE_URL` et
 * `NEXT_PUBLIC_PLAY_STORE_URL` (Netlify) à la publication, voir docs/DEPLOY.md.
 */
import { isLegalMarker } from './legal';

export interface StoreLink {
  key: 'appStore' | 'googlePlay';
  /** Nom de marque du store (non traduit). */
  name: string;
  /** URL https de la fiche, ou marqueur `[À COMPLÉTER : …]`. */
  href: string;
}

function httpsUrl(raw: string | undefined, marker: string): string {
  const value = (raw ?? '').trim();
  if (!value) return marker;
  try {
    return new URL(value).protocol === 'https:' ? value : marker;
  } catch {
    return marker;
  }
}

export function storeLinks(): StoreLink[] {
  return [
    {
      key: 'appStore',
      name: 'App Store',
      href: httpsUrl(process.env.NEXT_PUBLIC_APP_STORE_URL, '[À COMPLÉTER : lien App Store]'),
    },
    {
      key: 'googlePlay',
      name: 'Google Play',
      href: httpsUrl(process.env.NEXT_PUBLIC_PLAY_STORE_URL, '[À COMPLÉTER : lien Google Play]'),
    },
  ];
}

/** Vrai tant que le lien n'est pas renseigné. */
export function isPendingStoreLink(link: StoreLink): boolean {
  return isLegalMarker(link.href);
}
