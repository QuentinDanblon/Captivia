'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/components/ui';

/** Distance avant le viewport à partir de laquelle le contenu est monté. */
const ROOT_MARGIN = '900px 0px';

/**
 * Monte un contenu **décoratif** seulement à l'approche du viewport : il n'entre ni dans le
 * HTML initial ni dans l'hydratation (les aperçus d'écran de la landing représentaient ~40 %
 * du DOM de la page). La place est réservée par `placeholderClassName` (hauteur minimale) ; le
 * montage a lieu ~900 px avant l'affichage, donc hors écran, sans décalage visible.
 * Réservé aux illustrations `aria-hidden` : rien d'indispensable ne doit dépendre de JavaScript.
 */
export function DeferredMount({ children, placeholderClassName }: { children: ReactNode; placeholderClassName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Navigateur sans IntersectionObserver : montage immédiat à l'hydratation.
  const [visible, setVisible] = useState(() => typeof window !== 'undefined' && !('IntersectionObserver' in window));

  useEffect(() => {
    const node = ref.current;
    if (visible || !node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: ROOT_MARGIN },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className={cx(!visible && placeholderClassName)}>
      {visible ? children : null}
    </div>
  );
}
