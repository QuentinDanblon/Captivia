'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { isGbifKey, pickSpeciesPhoto, type SpeciesPhoto } from '@/lib/species';
import { curatedSpeciesPhoto } from '@/content/species-photos';

/**
 * Photo d'une espèce (GET /species/:id/media), mise en cache pour la session : une vignette de
 * la recherche et la fiche ouverte ensuite partagent la même requête. Une erreur vaut « pas de
 * photo » (silhouette) : l'illustration n'empêche jamais la lecture de la fiche.
 */
const cache = new Map<string, Promise<SpeciesPhoto | null>>();

export interface SpeciesPhotoTaxonomy {
  latin: string;
  commonNameFr?: string;
}

export function loadSpeciesPhoto(id: string | number, taxonomy?: SpeciesPhotoTaxonomy): Promise<SpeciesPhoto | null> {
  const key = taxonomy ? `${id}:${taxonomy.latin}:${taxonomy.commonNameFr ?? ''}` : String(id);
  let pending = cache.get(key);
  if (!pending) {
    const curated = taxonomy ? curatedSpeciesPhoto(taxonomy.latin, taxonomy.commonNameFr) : null;
    pending = curated
      ? Promise.resolve(curated)
      : !isGbifKey(Number(id))
        ? Promise.resolve(null)
        : api.getMedia(String(id)).then((media) => pickSpeciesPhoto(media)).catch(() => null);
    cache.set(key, pending);
  }
  return pending;
}

export type SpeciesPhotoState = { status: 'loading' } | { status: 'ready'; photo: SpeciesPhoto | null };

/** `enabled` à faux tant que la vignette n'approche pas de l'écran : aucune requête inutile. */
export function useSpeciesPhoto(id: string | number | null, enabled = true, taxonomy?: SpeciesPhotoTaxonomy): SpeciesPhotoState {
  const key = id === null ? null : String(id);
  const [result, setResult] = useState<{ key: string; photo: SpeciesPhoto | null } | null>(null);
  const taxonomyKey = taxonomy ? `${taxonomy.latin}\u0000${taxonomy.commonNameFr ?? ''}` : '';

  useEffect(() => {
    if (!key || !enabled) return;
    let cancelled = false;
    const [latin, commonNameFr] = taxonomyKey.split('\u0000');
    const photoTaxonomy = taxonomyKey ? { latin, commonNameFr: commonNameFr || undefined } : undefined;
    loadSpeciesPhoto(key, photoTaxonomy).then((photo) => {
      if (!cancelled) setResult({ key: `${key}:${taxonomyKey}`, photo });
    });
    return () => {
      cancelled = true;
    };
  }, [key, enabled, taxonomyKey]);

  return result && result.key === `${key}:${taxonomyKey}` ? { status: 'ready', photo: result.photo } : { status: 'loading' };
}
