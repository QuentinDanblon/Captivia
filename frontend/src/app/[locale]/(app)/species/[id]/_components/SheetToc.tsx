'use client';

import { useEffect, useState } from 'react';
import { cx } from '@/components/ui';

export interface TocEntry {
  id: string;
  label: string;
}

/** Section en cours de lecture : la dernière dont le titre a franchi le premier tiers de l'écran. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join(' ');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sections = key
      .split(' ')
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = sections.find((s) => visible.has(s.id));
        if (first) setActive(first.id);
      },
      { rootMargin: '-15% 0px -55% 0px' },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [key]);
  return active;
}

/**
 * Sommaire de la fiche. Bureau (≥ 1024 px) : dans la colonne collante, section en cours marquée
 * d'un filet à l'encre. Mobile : rangée d'ancres défilable sous l'en-tête (pas collante : la barre
 * haute et la barre d'onglets occupent déjà les bords de l'écran).
 */
export function SheetToc({ entries, label }: { entries: TocEntry[]; label: string }) {
  const active = useActiveSection(entries.map((e) => e.id));
  return (
    <nav aria-label={label} className="grid gap-2">
      <p className="m-0 text-meta text-ink-2">{label}</p>
      <ol className="m-0 grid list-none border-l border-line p-0">
        {entries.map((entry, i) => {
          const current = entry.id === active;
          return (
            <li key={entry.id} className="m-0">
              <a
                href={`#${entry.id}`}
                aria-current={current ? 'location' : undefined}
                className={cx(
                  '-ml-px flex min-h-9 items-baseline gap-3 border-l-2 py-1.5 pr-2 pl-3 text-ui no-underline transition-colors',
                  current ? 'border-ink font-medium text-ink' : 'border-transparent text-ink-2 hover:border-line-field hover:text-ink',
                )}
              >
                <span aria-hidden="true" className="font-mono text-meta text-ink-2">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {entry.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Ancres de la fiche en mobile et tablette : une rangée défilable, cibles de 44 px. */
export function SheetAnchors({ entries, label }: { entries: TocEntry[]; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:hidden">
      <ul className="m-0 flex w-max list-none gap-1 border-b border-line p-0">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              className="inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-ui font-medium whitespace-nowrap text-ink-2 no-underline transition-colors hover:border-line-field hover:text-ink"
            >
              {entry.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
