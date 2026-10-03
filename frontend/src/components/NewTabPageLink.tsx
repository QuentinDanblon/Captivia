'use client';

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { externalRel } from '@/components/ui/ExternalLink';
import { isNative, openExternal } from '@/lib/platform';
import { webPageUrl } from '@/lib/site-url';

export type NewTabPageLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'> & {
  /** Chemin d'une page du site, sans locale (ex. `/cgu`). */
  href: string;
  children?: ReactNode;
};

/**
 * Page du site ouverte à côté du formulaire en cours (CGU, confidentialité). Sur le web : nouvel
 * onglet (`noopener noreferrer`), le formulaire reste intact. Dans l'app native, un nouvel onglet
 * n'existe pas : la page publique du site s'ouvre dans le navigateur du système (W6-05).
 */
export function NewTabPageLink({ href, onClick, children, ...rest }: NewTabPageLinkProps) {
  const locale = useLocale();
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !isNative()) return;
    if (openExternal(webPageUrl(locale, href))) event.preventDefault();
  };
  return (
    <Link {...rest} href={href} target="_blank" rel={externalRel()} onClick={handleClick}>
      {children}
    </Link>
  );
}

export default NewTabPageLink;
