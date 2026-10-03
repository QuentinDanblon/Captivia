import { fireEvent, render, screen } from '@testing-library/react';

const mockIsNative = jest.fn(() => false);
const mockOpenExternal = jest.fn((url: string) => /^https?:/.test(url));

jest.mock('@/lib/platform', () => ({
  isNative: () => mockIsNative(),
  openExternal: (url: string) => mockOpenExternal(url),
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import ExternalLink, { externalRel } from '../ui/ExternalLink';
import { NewTabPageLink } from '../NewTabPageLink';

/** Clic réel (événement annulable) : renvoie true si le navigateur aurait suivi le lien. */
function click(el: HTMLElement): boolean {
  return fireEvent.click(el);
}

describe('externalRel', () => {
  it('garde toujours noopener noreferrer et ajoute les jetons sans doublon', () => {
    expect(externalRel()).toBe('noopener noreferrer');
    expect(externalRel('license')).toBe('noopener noreferrer license');
    expect(externalRel('sponsored noopener')).toBe('noopener noreferrer sponsored');
    expect(externalRel('  ')).toBe('noopener noreferrer');
  });
});

describe('ExternalLink', () => {
  beforeEach(() => {
    mockIsNative.mockReturnValue(false);
    mockOpenExternal.mockClear();
  });

  it('web : nouvel onglet sans opener, le navigateur suit le lien', () => {
    render(<ExternalLink href="https://www.gbif.org/species/1">GBIF</ExternalLink>);
    const link = screen.getByRole('link', { name: 'GBIF' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('href', 'https://www.gbif.org/species/1');
    expect(click(link)).toBe(true);
    expect(mockOpenExternal).not.toHaveBeenCalled();
  });

  it('conserve les jetons rel et les attributs transmis', () => {
    render(
      <ExternalLink href="https://creativecommons.org/licenses/by/4.0/" rel="license" lang="en" className="x">
        CC BY
      </ExternalLink>,
    );
    const link = screen.getByRole('link', { name: 'CC BY' });
    expect(link).toHaveAttribute('rel', 'noopener noreferrer license');
    expect(link).toHaveAttribute('lang', 'en');
    expect(link).toHaveClass('x');
  });

  it('natif : ouvre le navigateur du système et annule la navigation de la WebView', () => {
    mockIsNative.mockReturnValue(true);
    render(<ExternalLink href="https://pubmed.ncbi.nlm.nih.gov/1/">PubMed</ExternalLink>);
    expect(click(screen.getByRole('link', { name: 'PubMed' }))).toBe(false);
    expect(mockOpenExternal).toHaveBeenCalledWith('https://pubmed.ncbi.nlm.nih.gov/1/');
  });

  it('natif : une URL refusée par openExternal ne bloque pas le comportement par défaut', () => {
    mockIsNative.mockReturnValue(true);
    render(<ExternalLink href="mailto:contact@example.org">Écrire</ExternalLink>);
    expect(click(screen.getByRole('link', { name: 'Écrire' }))).toBe(true);
  });

  it('respecte un onClick qui annule déjà la navigation', () => {
    mockIsNative.mockReturnValue(true);
    const onClick = jest.fn((e: React.MouseEvent) => e.preventDefault());
    render(
      <ExternalLink href="https://eol.org" onClick={onClick}>
        EOL
      </ExternalLink>,
    );
    click(screen.getByRole('link', { name: 'EOL' }));
    expect(onClick).toHaveBeenCalled();
    expect(mockOpenExternal).not.toHaveBeenCalled();
  });
});

describe('NewTabPageLink', () => {
  beforeEach(() => {
    mockIsNative.mockReturnValue(false);
    mockOpenExternal.mockClear();
  });

  it('web : page interne en nouvel onglet', () => {
    render(<NewTabPageLink href="/cgu">CGU</NewTabPageLink>);
    const link = screen.getByRole('link', { name: 'CGU' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(click(link)).toBe(true);
    expect(mockOpenExternal).not.toHaveBeenCalled();
  });

  it('natif : ouvre la page publique du site dans le navigateur du système', () => {
    mockIsNative.mockReturnValue(true);
    render(<NewTabPageLink href="/confidentialite">Confidentialité</NewTabPageLink>);
    expect(click(screen.getByRole('link', { name: 'Confidentialité' }))).toBe(false);
    // Locale du mock next-intl : fr (locale par défaut, sans préfixe sur le site).
    expect(mockOpenExternal).toHaveBeenCalledWith('https://captivia-app.netlify.app/confidentialite');
  });
});
