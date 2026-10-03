// --- Plugin RevenueCat simulé --------------------------------------------------
const mockState = { loaded: 0, configured: false };
const mockPurchases = {
  isConfigured: jest.fn(async () => ({ isConfigured: mockState.configured })),
  configure: jest.fn(async () => {
    mockState.configured = true;
  }),
  logIn: jest.fn(async () => ({ customerInfo: customerInfo(false), created: false })),
  logOut: jest.fn(async () => ({ customerInfo: customerInfo(false) })),
  getOfferings: jest.fn(async () => offerings()),
  purchasePackage: jest.fn(async () => ({ productIdentifier: 'captivia_premium_annual', customerInfo: customerInfo(true) })),
  restorePurchases: jest.fn(async () => ({ customerInfo: customerInfo(true) })),
  getCustomerInfo: jest.fn(async () => ({ customerInfo: customerInfo(true) })),
};
jest.mock('@revenuecat/purchases-capacitor', () => {
  mockState.loaded++;
  return { Purchases: mockPurchases };
});

const mockIsNative = jest.fn(() => true);
const mockPlatform = jest.fn(() => 'ios');
jest.mock('../platform', () => ({
  isNative: () => mockIsNative(),
  getPlatform: () => mockPlatform(),
}));

import {
  APPLE_MANAGE_URL,
  GOOGLE_MANAGE_URL,
  classifyPurchaseError,
  configurePurchases,
  entitlementId,
  getCustomerState,
  loadPaywall,
  logOutPurchases,
  parseStorePeriod,
  plansFromOfferings,
  purchasePlan,
  purchasesAvailability,
  resetPurchasesForTests,
  restorePlan,
  revenueCatApiKey,
  storeManageUrl,
  syncPurchasesUser,
  waitForBackendPremium,
  type PaywallPlan,
} from '../purchases';

// --- Données du store ----------------------------------------------------------
function customerInfo(entitled: boolean, entitlement = 'premium') {
  return {
    entitlements: { active: entitled ? { [entitlement]: { identifier: entitlement, isActive: true } } : {}, all: {} },
    activeSubscriptions: entitled ? ['captivia_premium_annual'] : [],
    managementURL: entitled ? 'https://apps.apple.com/account/subscriptions' : null,
  };
}

function pkg(identifier: string, packageType: string, product: Record<string, unknown>) {
  return {
    identifier,
    packageType,
    offeringIdentifier: 'default',
    product: { identifier: `${identifier}_product`, priceString: '—', subscriptionPeriod: null, introPrice: null, ...product },
  };
}

const MONTHLY = pkg('$rc_monthly', 'MONTHLY', { identifier: 'captivia_premium_monthly', priceString: '2,49 €', subscriptionPeriod: 'P1M' });
const ANNUAL = pkg('$rc_annual', 'ANNUAL', {
  identifier: 'captivia_premium_annual',
  priceString: '19,99 €',
  subscriptionPeriod: 'P1Y',
  introPrice: { price: 0, priceString: '0,00 €', cycles: 1, period: 'P1W', periodUnit: 'WEEK', periodNumberOfUnits: 1 },
});

function offerings(current: unknown = { identifier: 'default', monthly: MONTHLY, annual: ANNUAL, availablePackages: [MONTHLY, ANNUAL] }) {
  return { current, all: {} };
}

const ACCOUNT = { id: 'user-1' };

const ENV_KEYS = ['NEXT_PUBLIC_REVENUECAT_IOS_KEY', 'NEXT_PUBLIC_REVENUECAT_ANDROID_KEY', 'NEXT_PUBLIC_REVENUECAT_ENTITLEMENT_ID'] as const;

beforeEach(() => {
  jest.clearAllMocks();
  resetPurchasesForTests();
  mockState.configured = false;
  mockIsNative.mockReturnValue(true);
  mockPlatform.mockReturnValue('ios');
  process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY = 'appl_test_key';
  process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY = 'goog_test_key';
  delete process.env.NEXT_PUBLIC_REVENUECAT_ENTITLEMENT_ID;
});

afterAll(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe('sur le web : aucun effet', () => {
  beforeEach(() => {
    mockIsNative.mockReturnValue(false);
    mockPlatform.mockReturnValue('web');
  });

  it('ne charge jamais le plugin et ne fait aucun appel', async () => {
    const loadedBefore = mockState.loaded;
    expect(purchasesAvailability()).toBe('web');
    expect(revenueCatApiKey()).toBeNull();
    expect(storeManageUrl()).toBeNull();
    expect(await configurePurchases(ACCOUNT)).toBe(false);
    await logOutPurchases();
    await syncPurchasesUser(ACCOUNT);
    await syncPurchasesUser(null);
    expect(await loadPaywall(ACCOUNT)).toEqual({ status: 'web' });
    expect(await purchasePlan(ACCOUNT, { pkg: MONTHLY } as unknown as PaywallPlan)).toEqual({ status: 'error', reason: 'not-configured' });
    expect(await restorePlan(ACCOUNT)).toEqual({ status: 'error', reason: 'not-configured' });
    expect(await getCustomerState(ACCOUNT)).toBeNull();
    expect(mockState.loaded).toBe(loadedBefore);
    for (const fn of Object.values(mockPurchases)) expect(fn).not.toHaveBeenCalled();
  });
});

describe('configure / logOut', () => {
  it('configure après la connexion d’un compte, avec la clé iOS et appUserID = id du compte', async () => {
    expect(await configurePurchases(ACCOUNT)).toBe(true);
    expect(mockPurchases.configure).toHaveBeenCalledWith({ apiKey: 'appl_test_key', appUserID: 'user-1' });
    // Idempotent : pas de second configure pour le même compte.
    expect(await configurePurchases(ACCOUNT)).toBe(true);
    expect(mockPurchases.configure).toHaveBeenCalledTimes(1);
    expect(mockPurchases.logIn).not.toHaveBeenCalled();
  });

  it('utilise la clé Android sur Android', async () => {
    mockPlatform.mockReturnValue('android');
    await configurePurchases(ACCOUNT);
    expect(mockPurchases.configure).toHaveBeenCalledWith({ apiKey: 'goog_test_key', appUserID: 'user-1' });
    expect(storeManageUrl()).toBe(GOOGLE_MANAGE_URL);
  });

  it('jamais pour un invité', async () => {
    expect(await configurePurchases({ id: 'guest-1', isGuest: true })).toBe(false);
    await syncPurchasesUser({ id: 'guest-1', isGuest: true });
    expect(mockPurchases.configure).not.toHaveBeenCalled();
    expect(await loadPaywall({ id: 'guest-1', isGuest: true })).toEqual({ status: 'guest' });
  });

  it('clé absente : achat désactivé, rien n’est configuré', async () => {
    delete process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY;
    expect(purchasesAvailability()).toBe('missing-key');
    expect(await configurePurchases(ACCOUNT)).toBe(false);
    expect(await loadPaywall(ACCOUNT)).toEqual({ status: 'missing-key' });
    expect(mockPurchases.configure).not.toHaveBeenCalled();
    // L'autre plateforme a sa propre clé.
    mockPlatform.mockReturnValue('android');
    expect(purchasesAvailability()).toBe('ready');
  });

  it('autre compte connecté ensuite : logIn, pas de second configure', async () => {
    await configurePurchases(ACCOUNT);
    await configurePurchases({ id: 'user-2' });
    expect(mockPurchases.configure).toHaveBeenCalledTimes(1);
    expect(mockPurchases.logIn).toHaveBeenCalledWith({ appUserID: 'user-2' });
  });

  it('SDK déjà configuré (WebView rechargée) : logIn au lieu de configure', async () => {
    mockState.configured = true;
    await configurePurchases(ACCOUNT);
    expect(mockPurchases.configure).not.toHaveBeenCalled();
    expect(mockPurchases.logIn).toHaveBeenCalledWith({ appUserID: 'user-1' });
  });

  it('logOut à la déconnexion, une seule fois ; jamais sans compte identifié', async () => {
    await logOutPurchases();
    expect(mockPurchases.logOut).not.toHaveBeenCalled();
    await syncPurchasesUser(ACCOUNT);
    await syncPurchasesUser(null);
    expect(mockPurchases.logOut).toHaveBeenCalledTimes(1);
    await logOutPurchases();
    expect(mockPurchases.logOut).toHaveBeenCalledTimes(1);
    // Reconnexion : nouvel appUserID via logIn (le SDK reste configuré).
    await syncPurchasesUser({ id: 'user-2' });
    expect(mockPurchases.logIn).toHaveBeenCalledWith({ appUserID: 'user-2' });
  });

  it('passage en invité après un compte : logOut', async () => {
    await syncPurchasesUser(ACCOUNT);
    await syncPurchasesUser({ id: 'guest-1', isGuest: true });
    expect(mockPurchases.logOut).toHaveBeenCalledTimes(1);
  });

  it('connexion puis déconnexion immédiates : appels enchaînés dans l’ordre', async () => {
    const order: string[] = [];
    mockPurchases.configure.mockImplementationOnce(async () => {
      await new Promise((r) => setTimeout(r, 5));
      order.push('configure');
      mockState.configured = true;
    });
    mockPurchases.logOut.mockImplementationOnce(async () => {
      order.push('logOut');
      return { customerInfo: customerInfo(false) };
    });
    await Promise.all([syncPurchasesUser(ACCOUNT), syncPurchasesUser(null)]);
    expect(order).toEqual(['configure', 'logOut']);
  });

  it('échec de configure : renvoie faux sans lever', async () => {
    mockPurchases.configure.mockRejectedValueOnce(Object.assign(new Error('bad key'), { code: '11' }));
    expect(await configurePurchases(ACCOUNT)).toBe(false);
    expect(await purchasePlan(ACCOUNT, { pkg: MONTHLY } as unknown as PaywallPlan)).toEqual(
      expect.objectContaining({ status: 'purchased' }),
    );
  });
});

describe('offerings', () => {
  it('durées ISO 8601 du store', () => {
    expect(parseStorePeriod('P1M')).toEqual({ unit: 'month', count: 1 });
    expect(parseStorePeriod('P1Y')).toEqual({ unit: 'year', count: 1 });
    expect(parseStorePeriod('P3M')).toEqual({ unit: 'month', count: 3 });
    expect(parseStorePeriod('P7D')).toEqual({ unit: 'week', count: 1 });
    expect(parseStorePeriod('P3D')).toEqual({ unit: 'day', count: 3 });
    expect(parseStorePeriod('')).toBeNull();
    expect(parseStorePeriod(null)).toBeNull();
    expect(parseStorePeriod('P1M2D')).toBeNull();
  });

  it('formules mensuelle puis annuelle, prix et durée lus dans le store', () => {
    const plans = plansFromOfferings(offerings() as never);
    expect(plans.map((p) => [p.id, p.kind, p.productId, p.priceString, p.period])).toEqual([
      ['$rc_monthly', 'monthly', 'captivia_premium_monthly', '2,49 €', { unit: 'month', count: 1 }],
      ['$rc_annual', 'annual', 'captivia_premium_annual', '19,99 €', { unit: 'year', count: 1 }],
    ]);
    expect(plans[0].intro).toBeNull();
    expect(plans[1].intro).toEqual({ price: 0, priceString: '0,00 €', period: { unit: 'week', count: 1 }, cycles: 1 });
  });

  it('sans packages mensuel / annuel : abonnements disponibles dont le store donne la durée', () => {
    const quarter = pkg('quarter', 'THREE_MONTH', { priceString: '6,99 €', subscriptionPeriod: 'P3M' });
    const lifetime = pkg('lifetime', 'LIFETIME', { priceString: '49 €', subscriptionPeriod: null });
    const plans = plansFromOfferings(offerings({ monthly: null, annual: null, availablePackages: [quarter, lifetime] }) as never);
    expect(plans.map((p) => p.id)).toEqual(['quarter']);
    expect(plansFromOfferings(offerings(null) as never)).toEqual([]);
    expect(plansFromOfferings(null)).toEqual([]);
  });

  it('loadPaywall : identité puis offering courante', async () => {
    const result = await loadPaywall(ACCOUNT);
    expect(mockPurchases.configure).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('ready');
    expect(result.status === 'ready' && result.plans).toHaveLength(2);
  });

  it('loadPaywall : erreur réseau ou produits indisponibles', async () => {
    mockPurchases.getOfferings.mockRejectedValueOnce({ code: '10', message: 'Network' });
    expect(await loadPaywall(ACCOUNT)).toEqual({ status: 'error', reason: 'network' });
    mockPurchases.getOfferings.mockRejectedValueOnce({ code: '23', message: 'None of the products could be fetched' });
    expect(await loadPaywall(ACCOUNT)).toEqual({ status: 'error', reason: 'unavailable' });
  });
});

describe('achat', () => {
  const plan = () => plansFromOfferings(offerings() as never)[1];

  it('succès : achète le package choisi', async () => {
    expect(await purchasePlan(ACCOUNT, plan())).toEqual({ status: 'purchased', entitled: true });
    expect(mockPurchases.purchasePackage).toHaveBeenCalledWith({ aPackage: ANNUAL });
  });

  it('entitlement aligné sur REVENUECAT_ENTITLEMENT_ID (défaut premium)', async () => {
    expect(entitlementId()).toBe('premium');
    process.env.NEXT_PUBLIC_REVENUECAT_ENTITLEMENT_ID = 'pro';
    expect(entitlementId()).toBe('pro');
    expect(await purchasePlan(ACCOUNT, plan())).toEqual({ status: 'purchased', entitled: false });
  });

  it('annulation par l’utilisateur : pas une erreur', async () => {
    mockPurchases.purchasePackage.mockRejectedValueOnce({ code: '1', message: 'Purchase was cancelled.', userCancelled: true });
    expect(await purchasePlan(ACCOUNT, plan())).toEqual({ status: 'cancelled' });
    mockPurchases.purchasePackage.mockRejectedValueOnce({ code: '0', data: { userCancelled: true } });
    expect(await purchasePlan(ACCOUNT, plan())).toEqual({ status: 'cancelled' });
  });

  it('erreur réseau (en ligne ou hors ligne)', async () => {
    mockPurchases.purchasePackage.mockRejectedValueOnce({ code: '10', message: 'Network error' });
    expect(await purchasePlan(ACCOUNT, plan())).toEqual({ status: 'error', reason: 'network' });
    mockPurchases.purchasePackage.mockRejectedValueOnce({ code: 35 });
    expect(await purchasePlan(ACCOUNT, plan())).toEqual({ status: 'error', reason: 'network' });
  });

  it('produit indisponible', async () => {
    mockPurchases.purchasePackage.mockRejectedValueOnce({ code: '5', message: 'The product is not available for purchase.' });
    expect(await purchasePlan(ACCOUNT, plan())).toEqual({ status: 'error', reason: 'unavailable' });
  });

  it('autres erreurs du store classées', () => {
    expect(classifyPurchaseError({ code: '3' })).toBe('not-allowed');
    expect(classifyPurchaseError({ code: '20' })).toBe('pending');
    expect(classifyPurchaseError({ code: '6' })).toBe('already-owned');
    expect(classifyPurchaseError({ code: '2' })).toBe('store');
    expect(classifyPurchaseError(new Error('boom'))).toBe('unknown');
    expect(classifyPurchaseError(undefined)).toBe('unknown');
  });
});

describe('restauration et état client', () => {
  it('restaure un abonnement actif', async () => {
    expect(await restorePlan(ACCOUNT)).toEqual({ status: 'restored' });
    expect(mockPurchases.restorePurchases).toHaveBeenCalledTimes(1);
  });

  it('rien à restaurer', async () => {
    mockPurchases.restorePurchases.mockResolvedValueOnce({ customerInfo: customerInfo(false) });
    expect(await restorePlan(ACCOUNT)).toEqual({ status: 'nothing' });
  });

  it('erreur réseau pendant la restauration', async () => {
    mockPurchases.restorePurchases.mockRejectedValueOnce({ code: '10' });
    expect(await restorePlan(ACCOUNT)).toEqual({ status: 'error', reason: 'network' });
  });

  it('état client : entitlement et lien de gestion du store', async () => {
    expect(await getCustomerState(ACCOUNT)).toEqual({
      entitled: true,
      managementUrl: APPLE_MANAGE_URL,
      activeProductIds: ['captivia_premium_annual'],
    });
    mockPurchases.getCustomerInfo.mockRejectedValueOnce({ code: '10' });
    expect(await getCustomerState(ACCOUNT)).toBeNull();
  });
});

describe('attente de l’activation côté backend', () => {
  function clock() {
    let t = 0;
    return {
      now: () => t,
      sleep: jest.fn(async (ms: number) => {
        t += ms;
      }),
    };
  }

  it('relit le profil jusqu’à isPremium (webhook en retard)', async () => {
    const c = clock();
    const answers = [false, false, true];
    const check = jest.fn(async () => answers.shift() ?? true);
    expect(await waitForBackendPremium(check, { timeoutMs: 30_000, ...c })).toBe('active');
    expect(check).toHaveBeenCalledTimes(3);
  });

  it('immédiat si le backend est déjà à jour', async () => {
    const c = clock();
    expect(await waitForBackendPremium(async () => true, c)).toBe('active');
    expect(c.sleep).not.toHaveBeenCalled();
  });

  it('délai borné : « Activation en cours » à l’échéance, sans dépasser le délai', async () => {
    const c = clock();
    const check = jest.fn(async () => false);
    expect(await waitForBackendPremium(check, { timeoutMs: 30_000, ...c })).toBe('pending');
    expect(c.now()).toBe(30_000);
    expect(check.mock.calls.length).toBeGreaterThan(3);
    expect(check.mock.calls.length).toBeLessThan(15);
  });

  it('une erreur de lecture compte comme « pas encore »', async () => {
    const c = clock();
    const check = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(true);
    expect(await waitForBackendPremium(check, c)).toBe('active');
    expect(check).toHaveBeenCalledTimes(2);
  });
});
