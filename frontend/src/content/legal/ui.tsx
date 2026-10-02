import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { isLegalMarker } from '@/lib/legal';

/** Briques de mise en forme partagées par les contenus légaux FR et EN. */

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

export interface LegalDoc {
  title: string;
  description: string;
  sections: LegalSection[];
}

export interface LegalContent {
  legalNotice: LegalDoc;
  privacy: LegalDoc;
  terms: LegalDoc;
  sources: LegalDoc;
}

export type LegalDocKey = keyof LegalContent;

export function P({ children }: { children: ReactNode }) {
  return <p className="leading-relaxed">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 leading-relaxed">{children}</ul>;
}

/** Valeur issue de `LEGAL` : un marqueur à compléter est mis en évidence. */
export function Field({ value }: { value: string | number }) {
  if (isLegalMarker(value)) {
    return (
      <mark className="rounded bg-amber-100 px-1 font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
        {value}
      </mark>
    );
  }
  return <>{value}</>;
}

const linkClass =
  'font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200';

/** Lien externe (nouvel onglet). */
export function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {children}
    </a>
  );
}

/** Lien interne, préfixé par la locale courante. */
export function ILink({ locale, href, children }: { locale: string; href: string; children: ReactNode }) {
  return (
    <Link href={href} locale={locale} className={linkClass}>
      {children}
    </Link>
  );
}

/** Tableau simple ; le texte se replie pour tenir sur mobile (pas de défilement horizontal). */
export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div>
      <table className="w-full table-fixed border-collapse break-words text-left text-sm">
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="border-b border-gray-300 py-2 pr-4 font-semibold text-gray-900 dark:border-gray-600 dark:text-white"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="align-top">
              {row.map((cell, j) => (
                <td key={j} className="border-b border-gray-200 py-2 pr-4 dark:border-gray-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
