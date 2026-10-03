'use client';

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { isNative, openExternal } from '@/lib/platform';

const BASE_REL = ['noopener', 'noreferrer'];

/** `rel` d'un lien sortant : toujours `noopener noreferrer`, plus les jetons fournis (`license`, `sponsored`…). */
export function externalRel(extra?: string): string {
  const tokens = [...BASE_REL];
  for (const token of (extra ?? '').split(/\s+/)) {
    if (token && !tokens.includes(token)) tokens.push(token);
  }
  return tokens.join(' ');
}

export type ExternalLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target'> & {
  /** URL absolue http(s) (sources, crédits photo, boutiques, pages légales tierces). */
  href: string;
  /** Jetons ajoutés à `noopener noreferrer` (ex. `license`, `sponsored`). */
  rel?: string;
  children?: ReactNode;
};

/**
 * Lien sortant (W6-05). Sur le web : `<a target="_blank" rel="noopener noreferrer">`, inchangé.
 * Dans l'app native : le clic passe par `openExternal`, la page s'ouvre dans le navigateur du
 * système (ou l'app du site), jamais dans la WebView de Captivia.
 */
export function ExternalLink({ href, rel, onClick, children, ...rest }: ExternalLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !isNative()) return;
    if (openExternal(href)) event.preventDefault();
  };
  return (
    <a {...rest} href={href} target="_blank" rel={externalRel(rel)} onClick={handleClick}>
      {children}
    </a>
  );
}

export default ExternalLink;
