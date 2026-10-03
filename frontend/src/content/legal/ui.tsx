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
  return <p className="m-0 max-w-prose leading-relaxed">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="m-0 grid max-w-prose list-disc gap-2 pl-5 leading-relaxed marker:text-ink-3">{children}</ul>;
}

/** Valeur issue de `LEGAL` : un marqueur à compléter est mis en évidence. */
export function Field({ value }: { value: string | number }) {
  if (isLegalMarker(value)) {
    return (
      <mark className="rounded-control bg-warn-soft px-1 font-medium text-ink shadow-[inset_0_-1px_0_var(--warn)]">
        {value}
      </mark>
    );
  }
  return <>{value}</>;
}

const linkClass =
  'font-medium text-accent-text underline decoration-1 underline-offset-[0.18em] transition-colors hover:text-ink';

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
      <table className="w-full table-fixed border-collapse break-words text-left text-ui">
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="border-b border-ink py-2 pr-4 text-ui font-medium text-ink"
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
                <td key={j} className="border-b border-line py-2 pr-4">
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
