'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { pickSpeciesPhoto, type SpeciesPhoto } from '@/lib/species';

/**
 * Photo d'une espèce (GET /species/:id/media), mise en cache pour la session : une vignette de
 * la recherche et la fiche ouverte ensuite partagent la même requête. Une erreur vaut « pas de
 * photo » (silhouette) : l'illustration n'empêche jamais la lecture de la fiche.
 */
const cache = new Map<string, Promise<SpeciesPhoto | null>>();

export function loadSpeciesPhoto(id: string | number): Promise<SpeciesPhoto | null> {
  const key = String(id);
  let pending = cache.get(key);
  if (!pending) {
    pending = api
      .getMedia(key)
      .then((media) => pickSpeciesPhoto(media))
      .catch(() => null);
    cache.set(key, pending);
  }
  return pending;
}

export type SpeciesPhotoState = { status: 'loading' } | { status: 'ready'; photo: SpeciesPhoto | null };

/** `enabled` à faux tant que la vignette n'approche pas de l'écran : aucune requête inutile. */
export function useSpeciesPhoto(id: string | number | null, enabled = true): SpeciesPhotoState {
  const key = id === null ? null : String(id);
  const [result, setResult] = useState<{ key: string; photo: SpeciesPhoto | null } | null>(null);

  useEffect(() => {
    if (!key || !enabled) return;
    let cancelled = false;
    loadSpeciesPhoto(key).then((photo) => {
      if (!cancelled) setResult({ key, photo });
    });
    return () => {
      cancelled = true;
    };
  }, [key, enabled]);

  return result && result.key === key ? { status: 'ready', photo: result.photo } : { status: 'loading' };
}
