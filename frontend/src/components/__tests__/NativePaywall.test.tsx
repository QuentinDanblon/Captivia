import { act, fireEvent, render, screen, within } from '@testing-library/react';

// Vraies chaînes françaises : le texte affiché est vérifié tel quel. Formateur ICU minimal
// (variables et `plural`) : next-intl / use-intl ne sont livrés qu'en ESM, non transformés par jest.
jest.mock('next-intl', () => {
  const messages = jest.requireActual('../../../messages/fr.json');
  const rules = new Intl.PluralRules('fr');
  /** Fin du bloc ouvert en `start` (accolades imbriquées comprises). */
  const closing = (text: string, start: number) => {
    let depth = 0;
    for (let j = start; j < text.length; j++) {
      if (text[j] === '{') depth++;
      if (text[j] === '}' && --depth === 0) return j;
    }
    return text.length;
  };
  /** Découpe `one {…} other {…}` en options. */
  const options = (body: string) => {
    const out: Record<string, string> = {};
    let i = 0;
    while (i < body.length) {
      const open = body.indexOf('{', i);
      if (open < 0) break;
      const end = closing(body, open);
      out[body.slice(i, open).trim()] = body.slice(open + 1, end);
      i = end + 1;
    }
    return out;
  };
  const format = (message: string, values: Record<string, string | number> = {}): string => {
    let result = '';
    for (let i = 0; i < message.length; i++) {
      if (message[i] !== '{') {
        result += message[i];
        continue;
      }
      const end = closing(message, i);
      const inner = message.slice(i + 1, end);
      const plural = /^(\w+),\s*plural,\s*([\s\S]*)$/.exec(inner);
      if (plural) {
        const n = Number(values[plural[1]]);
        const opts = options(plural[2]);
        const chosen = opts[`=${n}`] ?? opts[rules.select(n)] ?? opts.other;
        result += format(chosen.replace(/#/g, String(n)), values);
      } else {
        result += String(values[inner.trim()] ?? `{${inner}}`);
      }
      i = end;
    }
    return result;
  };
  return {
    useLocale: () => 'fr',
    useTranslations: (namespace?: string) => (key: string, values?: Record<string, string | number>) => {
      const path = [...(namespace ? namespace.split('.') : []), ...key.split('.')];
      const raw = path.reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages);
      return typeof raw === 'string' ? format(raw, values) : path.join('.');
    },
  };
});

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

type User = { id: string; isGuest?: boolean; isPremium?: boolean };
let mockUser: User | null = { id: 'user-1', isPremium: false };
const mockReloadUser = jest.fn(async (): Promise<User | null> => mockUser);
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser, reloadUser: mockReloadUser }) }));

const mockLoadPaywall = jest.fn();
const mockPurchasePlan = jest.fn();
const mockRestorePlan = jest.fn();
const mockStorePlatform = jest.fn(() => 'ios');
/** Attente du backend sans délai réel : trois lectures du profil au plus. */
const mockWait = jest.fn(async (check: () => Promise<boolean>) => {
  for (let i = 0; i < 3; i++) if (await check()) return 'active';
  return 'pending';
});
jest.mock('@/lib/purchases', () => ({
  ...jest.requireActual('@/lib/purchases'),
  loadPaywall: (...args: unknown[]) => mockLoadPaywall(...args),
  purchasePlan: (...args: unknown[]) => mockPurchasePlan(...args),
  restorePlan: (...args: unknown[]) => mockRestorePlan(...args),
  storePlatform: () => mockStorePlatform(),
  waitForBackendPremium: (check: () => Promise<boolean>) => mockWait(check),
}));

jest.mock('@/lib/platform', () => ({
  ...jest.requireActual('@/lib/platform'),
  isNative: () => true,
}));

import { NativePaywall } from '../purchases/NativePaywall';
import { plansFromOfferings } from '@/lib/purchases';

function pkg(identifier: string, packageType: string, priceString: string, subscriptionPeriod: string, introPrice: unknown = null) {
  return { identifier, packageType, offeringIdentifier: 'default', product: { identifier: `${identifier}_p`, priceString, subscriptionPeriod, introPrice } };
}

const MONTHLY = pkg('$rc_monthly', 'MONTHLY', '2,49 €', 'P1M');
const ANNUAL = pkg('$rc_annual', 'ANNUAL', '19,99 €', 'P1Y', {
  price: 0,
  priceString: '0,00 €',
  cycles: 1,
  period: 'P1W',
  periodUnit: 'WEEK',
  periodNumberOfUnits: 1,
});
const PLANS = plansFromOfferings({ current: { monthly: MONTHLY, annual: ANNUAL, availablePackages: [] }, all: {} } as never);

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'user-1', isPremium: false };
  mockStorePlatform.mockReturnValue('ios');
  mockLoadPaywall.mockResolvedValue({ status: 'ready', plans: PLANS });
  mockPurchasePlan.mockResolvedValue({ status: 'purchased', entitled: true });
  mockRestorePlan.mockResolvedValue({ status: 'restored' });
});

async function renderPaywall(props: Partial<React.ComponentProps<typeof NativePaywall>> = {}) {
  const view = render(<NativePaywall {...props} />);
  await flush();
  return view;
}

describe('NativePaywall', () => {
  it('affiche les formules du store : prix, durée, essai, renouvellement, restauration, liens', async () => {
    await renderPaywall({ manageUrl: 'https://apps.apple.com/account/subscriptions' });
    expect(mockLoadPaywall).toHaveBeenCalledWith({ id: 'user-1', isGuest: false });

    const group = screen.getByRole('group', { name: 'Choisissez votre formule' });
    const monthly = within(group).getByRole('radio', { name: /Mensuel/ });
    const annual = within(group).getByRole('radio', { name: /Annuel/ });
    expect(annual).toBeChecked();
    expect(monthly).not.toBeChecked();
    expect(group).toHaveTextContent('2,49 € par mois');
    expect(group).toHaveTextContent('19,99 € par an');
    expect(group).toHaveTextContent('Essai gratuit de 1 semaine, puis 19,99 € par an.');

    expect(screen.getByRole('button', { name: 'S’abonner pour 19,99 € par an' })).toBeEnabled();
    fireEvent.click(monthly);
    expect(screen.getByRole('button', { name: 'S’abonner pour 2,49 € par mois' })).toBeEnabled();

    expect(screen.getByText(/renouvellement automatique.*24 heures.*compte App Store/)).toBeInTheDocument();
    expect(screen.getByText(/ne résilie pas l’abonnement/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restaurer mes achats' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Conditions d’utilisation' })).toHaveAttribute('href', '/cgu');
    expect(screen.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute('href', '/confidentialite');
    expect(screen.getByRole('link', { name: 'Gérer mon abonnement' })).toHaveAttribute('href', 'https://apps.apple.com/account/subscriptions');
  });

  it('Android : conditions Google Play et lien de gestion du store par défaut', async () => {
    mockStorePlatform.mockReturnValue('android');
    await renderPaywall();
    expect(screen.getByText(/compte Google Play.*rubrique Abonnements/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gérer mon abonnement' })).toHaveAttribute(
      'href',
      'https://play.google.com/store/account/subscriptions',
    );
  });

  it('achat : attend que le backend confirme le Premium (/auth/me) avant d’annoncer l’activation', async () => {
    const onActivated = jest.fn();
    const answers = [false, true];
    mockReloadUser.mockImplementation(async () => ({ id: 'user-1', isPremium: answers.shift() ?? true }));
    await renderPaywall({ onActivated });
    fireEvent.click(screen.getByRole('button', { name: 'S’abonner pour 19,99 € par an' }));
    await flush();
    expect(mockPurchasePlan).toHaveBeenCalledWith({ id: 'user-1', isGuest: false }, PLANS[1]);
    expect(mockReloadUser).toHaveBeenCalledTimes(2);
    expect(onActivated).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Premium est actif')).toBeInTheDocument();
  });

  it('webhook en retard : « Activation en cours… », puis « Vérifier » relit le profil', async () => {
    const onActivated = jest.fn();
    mockReloadUser.mockResolvedValue({ id: 'user-1', isPremium: false });
    await renderPaywall({ onActivated });
    fireEvent.click(screen.getByRole('button', { name: /S’abonner/ }));
    await flush();
    expect(screen.getByText('Activation en cours…')).toBeInTheDocument();
    expect(screen.getByText(/pas encore à jour/)).toBeInTheDocument();
    expect(onActivated).not.toHaveBeenCalled();

    mockReloadUser.mockResolvedValue({ id: 'user-1', isPremium: true });
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }));
    await flush();
    expect(onActivated).toHaveBeenCalledTimes(1);
  });

  it('annulation : aucun message, le bouton reste disponible', async () => {
    mockPurchasePlan.mockResolvedValueOnce({ status: 'cancelled' });
    await renderPaywall();
    fireEvent.click(screen.getByRole('button', { name: /S’abonner/ }));
    await flush();
    expect(mockReloadUser).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: /S’abonner/ })).toBeEnabled();
  });

  it('erreur réseau ou produit indisponible : message traduit', async () => {
    mockPurchasePlan.mockResolvedValueOnce({ status: 'error', reason: 'network' });
    await renderPaywall();
    fireEvent.click(screen.getByRole('button', { name: /S’abonner/ }));
    await flush();
    expect(screen.getByText('Connexion au store impossible. Vérifiez votre réseau, puis réessayez.')).toBeInTheDocument();

    mockPurchasePlan.mockResolvedValueOnce({ status: 'error', reason: 'unavailable' });
    fireEvent.click(screen.getByRole('button', { name: /S’abonner/ }));
    await flush();
    expect(screen.getByText('Cette formule n’est pas disponible sur cet appareil ou dans votre pays.')).toBeInTheDocument();
  });

  it('restauration : rien à restaurer, puis restauration suivie de l’activation', async () => {
    const onActivated = jest.fn();
    mockReloadUser.mockResolvedValue({ id: 'user-1', isPremium: true });
    mockRestorePlan.mockResolvedValueOnce({ status: 'nothing' });
    await renderPaywall({ onActivated });
    fireEvent.click(screen.getByRole('button', { name: 'Restaurer mes achats' }));
    await flush();
    expect(screen.getByText('Aucun abonnement Premium à restaurer sur ce compte store.')).toBeInTheDocument();
    expect(onActivated).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Restaurer mes achats' }));
    await flush();
    expect(mockRestorePlan).toHaveBeenCalledTimes(2);
    expect(onActivated).toHaveBeenCalledTimes(1);
  });

  it('offerings injoignables : message et nouvel essai ; restauration toujours proposée', async () => {
    mockLoadPaywall.mockResolvedValueOnce({ status: 'error', reason: 'network' });
    await renderPaywall();
    expect(screen.getByText('Impossible d’afficher les formules')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /S’abonner/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Restaurer mes achats' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await flush();
    expect(mockLoadPaywall).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: /S’abonner/ })).toBeInTheDocument();
  });

  it('aucune formule dans l’offering : message, aucun bouton d’achat', async () => {
    mockLoadPaywall.mockResolvedValueOnce({ status: 'ready', plans: [] });
    await renderPaywall();
    expect(screen.getByText('Aucune formule proposée pour le moment')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /S’abonner/ })).toBeNull();
  });

  it('clé RevenueCat absente : achat désactivé avec un message propre', async () => {
    mockLoadPaywall.mockResolvedValueOnce({ status: 'missing-key' });
    await renderPaywall();
    expect(screen.getByText('Abonnement indisponible pour le moment')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('invité : le compte d’abord, aucun achat', async () => {
    mockUser = { id: 'guest-1', isGuest: true };
    await renderPaywall();
    expect(screen.getByText(/se souscrit avec un compte/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute('href', '/sauvegarder');
    expect(screen.queryByRole('button', { name: /S’abonner|Restaurer/ })).toBeNull();
    expect(mockPurchasePlan).not.toHaveBeenCalled();
  });
});

