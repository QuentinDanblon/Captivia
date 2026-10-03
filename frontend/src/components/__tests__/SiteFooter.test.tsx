import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import { SiteFooter } from '../SiteFooter';

jest.mock('next-intl/server', () => ({
  getTranslations: jest.fn(async (namespace: string) => (key: string) => `${namespace}.${key}`),
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/lib/legal', () => ({
  LEGAL: { serviceName: 'Captivia' },
  LEGAL_ROUTES: {
    legalNotice: '/mentions-legales',
    privacy: '/confidentialite',
    terms: '/cgu',
    sources: '/sources-et-licences',
    transparency: '/transparency',
    accountDeletion: '/suppression-compte',
  },
  contactMailto: () => 'mailto:contact@captivia.test',
}));

async function renderFooter() {
  render(await SiteFooter());
}

describe('SiteFooter', () => {
  it('landmark contentinfo, exclu de l’impression', async () => {
    await renderFooter();
    expect(screen.getByRole('contentinfo')).toHaveClass('noprint');
  });

  it('navigation légale nommée par son titre visible, 6 pages + contact', async () => {
    await renderFooter();
    const nav = screen.getByRole('navigation', { name: 'footer.navLabel' });
    expect(within(nav).getByRole('heading', { level: 2, name: 'footer.navLabel' })).toBeInTheDocument();
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/mentions-legales',
      '/confidentialite',
      '/cgu',
      '/sources-et-licences',
      '/transparency',
      '/suppression-compte',
      'mailto:contact@captivia.test',
    ]);
  });

  it('marque, description, mention d’affiliation Amazon et copyright de l’année', async () => {
    await renderFooter();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: 'common.appName' })).toHaveAttribute('href', '/');
    expect(within(footer).getByText('footer.description')).toBeInTheDocument();
    expect(within(footer).getByText('footer.amazonAssociate')).toBeInTheDocument();
    expect(footer).toHaveTextContent(`© ${new Date().getFullYear()} Captivia · footer.tagline`);
  });
});
