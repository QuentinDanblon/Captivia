import { act, render } from '@testing-library/react';

// --- Plugins et dépendances mockés ------------------------------------------
type Listener = (payload: never) => void;
const listeners = new Map<string, Listener>();
const removed: string[] = [];
const addListener = (name: string, fn: Listener) => {
  listeners.set(name, fn);
  return Promise.resolve({ remove: async () => void removed.push(name) });
};
const mockApp = {
  addListener: jest.fn(addListener),
  exitApp: jest.fn(async () => undefined),
  getLaunchUrl: jest.fn(async () => ({ url: 'https://captivia-app.netlify.app/en/animal-public/kaa-1' })),
};
jest.mock('@capacitor/app', () => ({ App: mockApp }));
jest.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: { addListener: (name: string, fn: Listener) => addListener(name, fn) },
}));

const mockIsNative = jest.fn(() => true);
jest.mock('@/lib/platform', () => ({
  IS_MOBILE_BUILD: false,
  isNative: () => mockIsNative(),
  animalDetailPath: (id: string) => `/mes-animaux/detail?id=${encodeURIComponent(id)}`,
}));

jest.mock('../../../i18n/routing', () => ({
  routing: { locales: ['fr', 'en', 'es', 'de', 'it', 'pt'], defaultLocale: 'fr' },
}));

const mockSync = jest.fn(async () => ({ outcome: 'scheduled', count: 0, source: 'network' }));
const mockClear = jest.fn(async () => undefined);
jest.mock('@/lib/local-reminders', () => ({
  ...jest.requireActual('@/lib/local-reminders'),
  syncLocalReminders: (...args: unknown[]) => mockSync(...(args as [])),
  clearLocalReminders: () => mockClear(),
}));

const mockSyncPurchases = jest.fn(async () => true);
jest.mock('@/lib/purchases', () => ({
  syncPurchasesUser: (...args: unknown[]) => mockSyncPurchases(...(args as [])),
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

type AuthState = { user: { id: string; isGuest?: boolean } | null; token: string | null; isLoading: boolean };
let mockAuth: AuthState = { user: null, token: null, isLoading: true };
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));

import { NativeBridge, NativeBridgeEffects, handleBackButton } from '../native/NativeBridge';
import { REMINDER_KIND } from '@/lib/local-reminders';

const flush = () => act(async () => {
  await new Promise((r) => setTimeout(r, 0));
});

const fire = (name: string, payload: unknown) => act(() => (listeners.get(name) as (p: unknown) => void)(payload));

beforeEach(() => {
  listeners.clear();
  removed.length = 0;
  jest.clearAllMocks();
  mockIsNative.mockReturnValue(true);
  mockAuth = { user: null, token: null, isLoading: true };
});

describe('handleBackButton', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('ferme d’abord une fenêtre modale ouverte (Échap)', () => {
    document.body.innerHTML = '<div role="dialog"><button>ok</button></div>';
    const onKey = jest.fn();
    document.addEventListener('keydown', onKey);
    const back = jest.fn();
    const exitApp = jest.fn();
    expect(handleBackButton(true, { exitApp, history: { back } as unknown as History })).toBe('dismiss');
    expect(onKey).toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }));
    expect(back).not.toHaveBeenCalled();
    expect(exitApp).not.toHaveBeenCalled();
    document.removeEventListener('keydown', onKey);
  });

  it("revient dans l'historique quand c'est possible", () => {
    const back = jest.fn();
    const exitApp = jest.fn();
    expect(handleBackButton(true, { exitApp, history: { back } as unknown as History })).toBe('back');
    expect(back).toHaveBeenCalled();
    expect(exitApp).not.toHaveBeenCalled();
  });

  it("sinon quitte l'app", () => {
    const back = jest.fn();
    const exitApp = jest.fn();
    expect(handleBackButton(false, { exitApp, history: { back } as unknown as History })).toBe('exit');
    expect(exitApp).toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });
});

describe('NativeBridge', () => {
  it('ne fait rien sur le web (hors export mobile)', async () => {
    const { container } = render(<NativeBridge />);
    await flush();
    expect(container.innerHTML).toBe('');
    expect(mockApp.addListener).not.toHaveBeenCalled();
  });

  it("n'enregistre aucun écouteur hors de l'app native", async () => {
    mockIsNative.mockReturnValue(false);
    mockAuth = { user: { id: 'u1' }, token: 'jwt', isLoading: false };
    render(<NativeBridgeEffects />);
    await flush();
    expect(mockApp.addListener).not.toHaveBeenCalled();
    expect(mockSync).not.toHaveBeenCalled();
    expect(mockSyncPurchases).not.toHaveBeenCalled();
  });

  // Doit rester le premier montage natif du fichier : l'URL de lancement est consommée une fois par exécution.
  it("ouvre l'URL de lancement (lien universel à froid) une seule fois", async () => {
    const first = render(<NativeBridgeEffects />);
    await flush();
    expect(mockApp.getLaunchUrl).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/en/animal-public/?slug=kaa-1');
    first.unmount();
    render(<NativeBridgeEffects />);
    await flush();
    expect(mockApp.getLaunchUrl).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('écoute les liens, le premier plan, le bouton retour et les rappels touchés ; les retire au démontage', async () => {
    const { unmount } = render(<NativeBridgeEffects />);
    await flush();
    expect([...listeners.keys()].sort()).toEqual(
      ['appStateChange', 'appUrlOpen', 'backButton', 'localNotificationActionPerformed'].sort(),
    );
    unmount();
    expect(removed.sort()).toEqual([...listeners.keys()].sort());
  });

  it('ouvre la route de l’app pour un lien universel, ignore un domaine étranger', async () => {
    render(<NativeBridgeEffects />);
    await flush();
    mockPush.mockClear();
    fire('appUrlOpen', { url: 'https://captivia-app.netlify.app/mes-animaux/abc' });
    expect(mockPush).toHaveBeenLastCalledWith('/fr/mes-animaux/detail/?id=abc');
    fire('appUrlOpen', { url: 'https://captivia-app.netlify.app/en/reset-password?token=t0k' });
    expect(mockPush).toHaveBeenLastCalledWith('/en/reset-password/?token=t0k');
    mockPush.mockClear();
    fire('appUrlOpen', { url: 'https://evil.example/mes-animaux/abc' });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('un rappel touché ouvre la fiche de l’animal', async () => {
    render(<NativeBridgeEffects />);
    await flush();
    mockPush.mockClear();
    fire('localNotificationActionPerformed', { actionId: 'tap', notification: { id: 1, extra: { kind: REMINDER_KIND, animalId: 'a 1' } } });
    expect(mockPush).toHaveBeenCalledWith('/fr/mes-animaux/detail/?id=a%201');
    mockPush.mockClear();
    fire('localNotificationActionPerformed', { actionId: 'tap', notification: { id: 2, extra: { kind: 'autre', animalId: 'x' } } });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('bouton retour Android : historique, sinon sortie', async () => {
    const back = jest.spyOn(window.history, 'back').mockImplementation(() => undefined);
    render(<NativeBridgeEffects />);
    await flush();
    fire('backButton', { canGoBack: true });
    expect(back).toHaveBeenCalled();
    fire('backButton', { canGoBack: false });
    expect(mockApp.exitApp).toHaveBeenCalled();
    back.mockRestore();
  });

  describe('rappels locaux', () => {
    it('lancement à froid avec session : synchronise sans demander la permission', async () => {
      const view = render(<NativeBridgeEffects />);
      mockAuth = { user: { id: 'u1' }, token: 'jwt', isLoading: false };
      view.rerender(<NativeBridgeEffects />);
      await flush();
      expect(mockSync).toHaveBeenCalledTimes(1);
      expect(mockSync).toHaveBeenCalledWith(expect.objectContaining({ token: 'jwt', userId: 'u1', prompt: false }));
    });

    it('retour au premier plan : resynchronise', async () => {
      mockAuth = { user: { id: 'u1' }, token: 'jwt', isLoading: false };
      render(<NativeBridgeEffects />);
      await flush();
      mockSync.mockClear();
      fire('appStateChange', { isActive: true });
      expect(mockSync).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', prompt: false }));
      mockSync.mockClear();
      fire('appStateChange', { isActive: false });
      expect(mockSync).not.toHaveBeenCalled();
    });

    it('connexion (ou essai invité) pendant la session : permission proposée', async () => {
      const view = render(<NativeBridgeEffects />);
      mockAuth = { user: null, token: null, isLoading: false };
      view.rerender(<NativeBridgeEffects />);
      await flush();
      expect(mockSync).not.toHaveBeenCalled();
      mockAuth = { user: { id: 'guest-1' }, token: 'jwt-guest', isLoading: false };
      view.rerender(<NativeBridgeEffects />);
      await flush();
      expect(mockSync).toHaveBeenCalledWith(expect.objectContaining({ userId: 'guest-1', prompt: 'once' }));
    });

    it('déconnexion : annule les rappels', async () => {
      mockAuth = { user: { id: 'u1' }, token: 'jwt', isLoading: false };
      const view = render(<NativeBridgeEffects />);
      await flush();
      mockAuth = { user: null, token: null, isLoading: false };
      view.rerender(<NativeBridgeEffects />);
      await flush();
      expect(mockClear).toHaveBeenCalledTimes(1);
    });

    it('ne resynchronise pas quand seul le jeton change (rotation)', async () => {
      mockAuth = { user: { id: 'u1' }, token: 'jwt', isLoading: false };
      const view = render(<NativeBridgeEffects />);
      await flush();
      mockAuth = { user: { id: 'u1' }, token: 'jwt-2', isLoading: false };
      view.rerender(<NativeBridgeEffects />);
      await flush();
      expect(mockSync).toHaveBeenCalledTimes(1);
      // … mais le prochain retour au premier plan utilise le nouveau jeton.
      fire('appStateChange', { isActive: true });
      expect(mockSync).toHaveBeenLastCalledWith(expect.objectContaining({ token: 'jwt-2' }));
    });
  });

  describe('achats intégrés (RevenueCat)', () => {
    it('attend la fin du chargement de la session', async () => {
      render(<NativeBridgeEffects />);
      await flush();
      expect(mockSyncPurchases).not.toHaveBeenCalled();
    });

    it('compte connecté : identifie le compte ; déconnexion : logOut', async () => {
      mockAuth = { user: { id: 'u1' }, token: 'jwt', isLoading: false };
      const view = render(<NativeBridgeEffects />);
      await flush();
      expect(mockSyncPurchases).toHaveBeenLastCalledWith({ id: 'u1', isGuest: false });
      mockAuth = { user: null, token: null, isLoading: false };
      view.rerender(<NativeBridgeEffects />);
      await flush();
      expect(mockSyncPurchases).toHaveBeenLastCalledWith(null);
    });

    it('invité puis création de compte (même id) : identifié seulement une fois devenu compte', async () => {
      mockAuth = { user: { id: 'g1', isGuest: true }, token: 'jwt', isLoading: false };
      const view = render(<NativeBridgeEffects />);
      await flush();
      expect(mockSyncPurchases).toHaveBeenLastCalledWith({ id: 'g1', isGuest: true });
      mockAuth = { user: { id: 'g1', isGuest: false }, token: 'jwt-2', isLoading: false };
      view.rerender(<NativeBridgeEffects />);
      await flush();
      expect(mockSyncPurchases).toHaveBeenLastCalledWith({ id: 'g1', isGuest: false });
      expect(mockSyncPurchases).toHaveBeenCalledTimes(2);
    });
  });
});
