import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const captureException = jest.fn();
jest.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

// next-intl est mocké globalement (jest.setup.ts) : t(key) renvoie la clé ; on ajoute useLocale.
jest.mock('@/i18n/navigation', () => ({
  __esModule: true,
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Le cadre (en-tête, session, pied) est couvert ailleurs : ces tests portent sur le contenu des pages.
jest.mock('@/components/frames/MarketingFrame', () => ({
  __esModule: true,
  MarketingFrame: ({ children }: { children: React.ReactNode }) => <div data-testid="frame">{children}</div>,
}));

import LocaleNotFound from '../[locale]/not-found';
import LocaleError from '../[locale]/error';
import GlobalError from '../global-error';

describe('pages d\'erreur', () => {
  beforeEach(() => {
    captureException.mockClear();
  });

  it('not-found : titre, description et lien vers l\'accueil (le Link next-intl ajoute la locale)', () => {
    render(<LocaleNotFound />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('notFoundTitle');
    expect(screen.getByText('notFoundDescription')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'backHome' })).toHaveAttribute('href', '/');
  });

  it('error : affiche un message traduit sans fuite du message technique, et réessaie', async () => {
    const reset = jest.fn();
    const error = Object.assign(new Error('secret stack detail'), { digest: 'abc123' });

    render(<LocaleError error={error} reset={reset} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/secret stack detail/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    expect(reset).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(captureException).toHaveBeenCalledWith(error));
  });

  it('global-error : bilingue, boutons réessayer / accueil, capture Sentry', async () => {
    const reset = jest.fn();
    const error = new Error('boom');
    // <html> dans un conteneur div déclenche un avertissement React attendu pour ce composant.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<GlobalError error={error} reset={reset} />, { container: document, baseElement: document });

    expect(screen.getByText(/Une erreur est survenue/)).toBeInTheDocument();
    expect(screen.getByText(/An unexpected problem occurred/)).toBeInTheDocument();
    // (le clic n'est pas testable : React ne délègue pas les événements quand <html> est la racine)
    expect(screen.getByRole('button', { name: /Réessayer/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Accueil/ })).toHaveAttribute('href', '/');
    await waitFor(() => expect(captureException).toHaveBeenCalledWith(error));
    consoleError.mockRestore();
  });
});
