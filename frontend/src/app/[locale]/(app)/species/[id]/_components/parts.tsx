'use client';

/**
 * Pièces communes des sections de la fiche espèce : carte de section ancrée, liste de repères
 * (dl), sources en note, libellés de valeurs éditoriales et plages chiffrées.
 */
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Card, cx } from '@/components/ui';
import type { SourceRef } from './types';

type T = ReturnType<typeof useTranslations>;

/** Clé de traduction d'une valeur éditoriale : « semi-grégaire » → « semi_gregaire ». */
export function valueKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Libellé traduit d'une valeur éditoriale (`species.values.<groupe>.<valeur>`) ; une valeur
 * inconnue est affichée telle que saisie (contenu éditorial), avec une majuscule.
 */
export function valueLabel(t: T, group: string, value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const key = `species.values.${group}.${valueKey(value)}`;
  if (t.has(key)) return t(key);
  const raw = value.trim();
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export { formatRange } from '@/lib/units';

/** Section ancrée de la fiche : carte titrée, cible du sommaire. */
export function SheetSection({
  id,
  title,
  aside,
  children,
}: {
  id: string;
  title: ReactNode;
  /** Mention à droite du titre (badge « À confirmer », date de mise à jour). */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card as="section" id={id} title={title} titleId={`${id}-title`} actions={aside} className="scroll-mt-20 lg:scroll-mt-6" data-sheet-section="">
      <div className="grid gap-5">{children}</div>
    </Card>
  );
}

export interface FactItem {
  label: ReactNode;
  value: ReactNode;
  /** Valeur chiffrée : mono, chiffres tabulaires. */
  mono?: boolean;
  /** Occupe toute la largeur (texte long). */
  wide?: boolean;
}

/** Repères d'une section : libellé discret, valeur à l'encre ; deux colonnes au-delà de 640 px. */
export function FactList({ items, label }: { items: Array<FactItem | null | false | undefined | ''>; label?: string }) {
  const facts = items.filter((i): i is FactItem => Boolean(i));
  if (facts.length === 0) return null;
  return (
    <dl aria-label={label} className="m-0 grid gap-x-8 gap-y-5 sm:grid-cols-2">
      {facts.map((fact, i) => (
        <div key={i} className={cx('grid content-start gap-1', fact.wide && 'sm:col-span-2')}>
          <dt className="text-meta text-ink-2">{fact.label}</dt>
          <dd className={cx('m-0 text-body text-ink', fact.mono && 'font-mono')}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Domaine lisible d'une URL de source (« lafeber.com »). */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Sources d'une section, en note mono sous un filet pointillé. */
export function SourceNote({ sources }: { sources: Array<SourceRef | string> | null | undefined }) {
  const t = useTranslations();
  const list = (sources ?? [])
    .map((s) => (typeof s === 'string' ? { url: s, title: undefined } : s))
    .map((s) => ({ url: safeUrl(s.url), title: s.title?.trim() }))
    .filter((s) => s.url || s.title);
  if (list.length === 0) return null;
  return (
    <p className="m-0 flex flex-wrap gap-x-3 gap-y-1 border-t border-dotted border-line-strong pt-3 font-mono text-meta text-ink-2">
      <span>{t('species.sources')}</span>
      {list.map((s, i) =>
        s.url ? (
          <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="break-all text-accent-text underline decoration-1 underline-offset-2">
            {s.title || hostOf(s.url) || s.url}
          </a>
        ) : (
          <span key={i}>{s.title}</span>
        ),
      )}
    </p>
  );
}

/** Liste à puces fines (aliments, permis, restrictions). */
export function InkList({ items, marker = 'dot' }: { items: string[]; marker?: 'dot' | 'cross' }) {
  return (
    <ul className="m-0 grid list-none gap-1.5 p-0">
      {items.map((item, i) => (
        <li key={i} className="grid grid-cols-[0.75rem_minmax(0,1fr)] items-baseline gap-2 text-body text-ink">
          <span aria-hidden="true" className="font-mono text-ink-2">
            {marker === 'cross' ? '×' : '·'}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
