import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import { AccountFrame } from '../frames/AccountFrame';

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) => (namespace ? `${namespace}.${key}` : key),
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/components/LanguageSelector', () => ({ LanguageSelector: () => <select aria-label="language" /> }));
jest.mock('@/components/EmailVerificationBanner', () => ({ EmailVerificationBanner: () => null }));

describe('AccountFrame (écrans de compte)', () => {
  it('un seul <main id="main-content"> entre l’en-tête et le pied, avec le lien d’évitement', () => {
    render(
      <AccountFrame>
        <h1>Connexion</h1>
      </AccountFrame>,
    );
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(within(screen.getByRole('main')).getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'home.skipToContent' })).toHaveAttribute('href', '#main-content');
  });

  it('en-tête sobre : marque, retour à l’accueil et langue, sans navigation du site ni boutons de compte', () => {
    render(<AccountFrame>x</AccountFrame>);
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'common.appName' })).toHaveAttribute('href', '/');
    expect(within(header).getByRole('link', { name: 'errors.backHome' })).toHaveAttribute('href', '/');
    expect(within(header).getByLabelText('language')).toBeInTheDocument();
    expect(within(header).queryByRole('navigation')).not.toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'common.register' })).not.toBeInTheDocument();
  });

  it('pied minimal : trois liens légaux et le copyright', () => {
    render(<AccountFrame>x</AccountFrame>);
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveClass('noprint');
    const nav = within(footer).getByRole('navigation', { name: 'footer.navLabel' });
    expect(within(nav).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/mentions-legales',
      '/confidentialite',
      '/cgu',
    ]);
    expect(footer).toHaveTextContent(`© ${new Date().getFullYear()} Captivia`);
  });
});
