/**
 * Achats intégrés (W6-08, partie app) : abonnement Premium via RevenueCat
 * (`@revenuecat/purchases-capacitor`), App Store et Google Play uniquement. Voir docs/PAYMENTS.md.
 *
 * - Sans effet sur le web : chaque fonction vérifie `isNative()` et le plugin est importé à la
 *   demande (absent du bundle web).
 * - Identité : `appUserID` = `User.id` Captivia, pour un compte (jamais un invité). `configure` à
 *   la connexion, `logIn` si un autre compte se connecte, `logOut` à la déconnexion.
 * - Clés publiques par plateforme : `NEXT_PUBLIC_REVENUECAT_IOS_KEY`, `NEXT_PUBLIC_REVENUECAT_ANDROID_KEY`.
 *   Clé absente : l'achat est désactivé (`purchasesAvailability() === 'missing-key'`).
 * - Prix et durées : lus dans l'offering courante (packages mensuel et annuel), jamais codés en dur.
 * - Le backend reste la source de vérité : après un achat ou une restauration, l'app attend que
 *   `GET /auth/me` renvoie `isPremium: true` (webhook RevenueCat), avec un délai borné
 *   (`waitForBackendPremium`). L'entitlement vu par le SDK n'ouvre jamais le Premium à lui seul.
 */
import type { CustomerInfo, PurchasesOfferings, PurchasesPackage, PurchasesPlugin } from '@revenuecat/purchases-capacitor';
import { getPlatform, isNative } from './platform';

/** Entitlement qui ouvre le Premium : identique à `REVENUECAT_ENTITLEMENT_ID` côté backend. */
export const DEFAULT_ENTITLEMENT_ID = 'premium';

export function entitlementId(): string {
  return (process.env.NEXT_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? '').trim() || DEFAULT_ENTITLEMENT_ID;
}

/** Pages de gestion des abonnements des stores (mêmes URL que `manageUrlFor` côté backend). */
export const APPLE_MANAGE_URL = 'https://apps.apple.com/account/subscriptions';
export const GOOGLE_MANAGE_URL = 'https://play.google.com/store/account/subscriptions';

export type StorePlatform = 'ios' | 'android';

/** Plateforme de l'app native, ou null sur le web. */
export function storePlatform(): StorePlatform | null {
  if (!isNative()) return null;
  const platform = getPlatform();
  return platform === 'ios' || platform === 'android' ? platform : null;
}

/**
 * Clé publique RevenueCat de la plateforme (`appl_…` / `goog_…`). Accès statique aux variables :
 * Next.js les inline au build.
 */
export function revenueCatApiKey(platform: StorePlatform | null = storePlatform()): string | null {
  const raw =
    platform === 'ios'
      ? process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY
      : platform === 'android'
        ? process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY
        : undefined;
  const key = (raw ?? '').trim();
  return key ? key : null;
}

/** `web` : aucun achat ; `missing-key` : app native sans clé RevenueCat (achat désactivé) ; `ready`. */
export type PurchasesAvailability = 'web' | 'missing-key' | 'ready';

export function purchasesAvailability(): PurchasesAvailability {
  const platform = storePlatform();
  if (!platform) return 'web';
  return revenueCatApiKey(platform) ? 'ready' : 'missing-key';
}

/** Page « Gérer mon abonnement » du store de cet appareil (repli si l'API n'en fournit pas). */
export function storeManageUrl(platform: StorePlatform | null = storePlatform()): string | null {
  if (platform === 'ios') return APPLE_MANAGE_URL;
  if (platform === 'android') return GOOGLE_MANAGE_URL;
  return null;
}

// ---------------------------------------------------------------------------
// Plugin et session RevenueCat
// ---------------------------------------------------------------------------

let pluginPromise: Promise<PurchasesPlugin> | null = null;

/** Chargé à la demande : le bundle web n'embarque pas le plugin. */
function loadPurchases(): Promise<PurchasesPlugin> {
  if (!pluginPromise) {
    pluginPromise = import('@revenuecat/purchases-capacitor').then((m) => m.Purchases);
    pluginPromise.catch(() => {
      pluginPromise = null;
    });
  }
  return pluginPromise;
}

/** Utilisateur RevenueCat courant (`User.id` Captivia), null si aucun compte n'est identifié. */
let currentAppUserId: string | null = null;
let sdkConfigured = false;
let queue: Promise<unknown> = Promise.resolve();

/** Les changements d'identité s'enchaînent (connexion puis déconnexion rapides, double montage). */
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/** Réinitialise l'état du module (tests). */
export function resetPurchasesForTests(): void {
  pluginPromise = null;
  currentAppUserId = null;
  sdkConfigured = false;
  queue = Promise.resolve();
}

export interface PurchasesUser {
  id: string;
  isGuest?: boolean;
}

/**
 * Identifie le compte auprès de RevenueCat (`appUserID = user.id`). Invité, web ou clé absente :
 * rien n'est fait. Idempotent. Ne lève jamais.
 * @returns vrai si le SDK est prêt pour ce compte.
 */
export async function configurePurchases(user: PurchasesUser | null | undefined): Promise<boolean> {
  if (!user || user.isGuest || !user.id) return false;
  const apiKey = revenueCatApiKey();
  if (!apiKey) return false;
  return serial(async () => {
    if (currentAppUserId === user.id) return true;
    const Purchases = await loadPurchases();
    if (!sdkConfigured) {
      // `configure` une seule fois par exécution native ; une WebView rechargée retrouve un SDK déjà configuré.
      const configured = await Purchases.isConfigured()
        .then((r) => r.isConfigured)
        .catch(() => false);
      sdkConfigured = true;
      if (!configured) {
        await Purchases.configure({ apiKey, appUserID: user.id });
        currentAppUserId = user.id;
        return true;
      }
    }
    await Purchases.logIn({ appUserID: user.id });
    currentAppUserId = user.id;
    return true;
  }).catch(() => {
    sdkConfigured = false;
    return false;
  });
}

/** Déconnexion : RevenueCat repasse sur un utilisateur anonyme. Sans effet si aucun compte n'était identifié. */
export async function logOutPurchases(): Promise<void> {
  if (!isNative()) return;
  await serial(async () => {
    if (!currentAppUserId) return;
    currentAppUserId = null;
    const Purchases = await loadPurchases();
    await Purchases.logOut();
  }).catch(() => undefined);
}

/** Suit la session : compte → `configure` / `logIn` ; invité ou déconnecté → `logOut`. */
export function syncPurchasesUser(user: PurchasesUser | null | undefined): Promise<unknown> {
  if (!isNative()) return Promise.resolve(false);
  return user && !user.isGuest ? configurePurchases(user) : logOutPurchases();
}

// ---------------------------------------------------------------------------
// Offering : formules mensuelle et annuelle
// ---------------------------------------------------------------------------

export type PeriodUnit = 'day' | 'week' | 'month' | 'year';

export interface StorePeriod {
  unit: PeriodUnit;
  count: number;
}

const ISO_UNITS: Record<string, PeriodUnit> = { D: 'day', W: 'week', M: 'month', Y: 'year' };

/** Durée ISO 8601 du store (`P1M`, `P1Y`, `P3M`, `P1W`, `P7D`) ; null si illisible. */
export function parseStorePeriod(iso: string | null | undefined): StorePeriod | null {
  const m = /^P(\d+)([DWMY])$/.exec((iso ?? '').trim().toUpperCase());
  if (!m) return null;
  const count = Number(m[1]);
  if (!Number.isFinite(count) || count < 1) return null;
  if (m[2] === 'D' && count % 7 === 0) return { unit: 'week', count: count / 7 };
  return { unit: ISO_UNITS[m[2]], count };
}

/** Unité d'une offre d'introduction (`DAY`, `WEEK`, `MONTH`, `YEAR`). */
function introUnit(raw: string | null | undefined): PeriodUnit | null {
  const unit = (raw ?? '').toLowerCase();
  return unit === 'day' || unit === 'week' || unit === 'month' || unit === 'year' ? unit : null;
}

export interface PlanIntro {
  /** 0 pour un essai gratuit. */
  price: number;
  priceString: string;
  /** Période facturée pendant l'offre (ex. 1 mois). */
  period: StorePeriod;
  /** Nombre de périodes à ce tarif. */
  cycles: number;
}

/** Formule affichée par le paywall, entièrement décrite par le store. */
export interface PaywallPlan {
  /** Identifiant du package RevenueCat (`$rc_monthly`, `$rc_annual`). */
  id: string;
  kind: 'monthly' | 'annual' | 'other';
  productId: string;
  /** Prix localisé fourni par le store (« 4,99 € »). */
  priceString: string;
  /** Durée d'une période d'abonnement ; null si le store ne la donne pas (formule alors écartée). */
  period: StorePeriod;
  intro: PlanIntro | null;
  /** Package à passer à l'achat (opaque pour l'interface). */
  pkg: PurchasesPackage;
}

function toPlan(pkg: PurchasesPackage | null | undefined): PaywallPlan | null {
  if (!pkg?.product) return null;
  const period = parseStorePeriod(pkg.product.subscriptionPeriod);
  if (!period || !pkg.product.priceString) return null;
  const intro = pkg.product.introPrice;
  const unit = introUnit(intro?.periodUnit);
  const type = String(pkg.packageType);
  return {
    id: pkg.identifier,
    kind: type === 'MONTHLY' ? 'monthly' : type === 'ANNUAL' ? 'annual' : 'other',
    productId: pkg.product.identifier,
    priceString: pkg.product.priceString,
    period,
    intro:
      intro && unit && intro.periodNumberOfUnits > 0
        ? {
            price: intro.price,
            priceString: intro.priceString,
            period: { unit, count: intro.periodNumberOfUnits },
            cycles: Math.max(1, intro.cycles || 1),
          }
        : null,
    pkg,
  };
}

/**
 * Formules de l'offering courante : mensuelle puis annuelle (packages `$rc_monthly` / `$rc_annual`) ;
 * sinon les abonnements disponibles dont le store donne la durée.
 */
export function plansFromOfferings(offerings: PurchasesOfferings | null | undefined): PaywallPlan[] {
  const offering = offerings?.current;
  if (!offering) return [];
  const preferred = [offering.monthly, offering.annual].map(toPlan).filter((p): p is PaywallPlan => p !== null);
  if (preferred.length > 0) return preferred;
  return (offering.availablePackages ?? []).map(toPlan).filter((p): p is PaywallPlan => p !== null);
}

// ---------------------------------------------------------------------------
// Erreurs du SDK
// ---------------------------------------------------------------------------

export type PurchaseErrorReason =
  | 'network'
  | 'unavailable'
  | 'not-allowed'
  | 'pending'
  | 'already-owned'
  | 'store'
  | 'not-configured'
  | 'unknown';

/**
 * Codes `PURCHASES_ERROR_CODE` du SDK (chaînes) ; repris ici pour ne pas importer le plugin
 * dans le bundle web.
 */
const ERROR_CODES: Record<string, PurchaseErrorReason | 'cancelled'> = {
  '1': 'cancelled', // PURCHASE_CANCELLED_ERROR
  '2': 'store', // STORE_PROBLEM_ERROR
  '3': 'not-allowed', // PURCHASE_NOT_ALLOWED_ERROR
  '4': 'store', // PURCHASE_INVALID_ERROR
  '5': 'unavailable', // PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR
  '6': 'already-owned', // PRODUCT_ALREADY_PURCHASED_ERROR
  '7': 'already-owned', // RECEIPT_ALREADY_IN_USE_ERROR
  '10': 'network', // NETWORK_ERROR
  '18': 'unavailable', // INELIGIBLE_ERROR
  '20': 'pending', // PAYMENT_PENDING_ERROR
  '23': 'unavailable', // CONFIGURATION_ERROR (produits absents de l'offering, store mal relié)
  '35': 'network', // OFFLINE_CONNECTION_ERROR
};

/** Classe une erreur du SDK (achat, restauration, offerings). */
export function classifyPurchaseError(error: unknown): PurchaseErrorReason | 'cancelled' {
  if (error instanceof PurchasesNotReadyError) return 'not-configured';
  const e = (error ?? {}) as { code?: unknown; userCancelled?: unknown; data?: { userCancelled?: unknown } };
  if (e.userCancelled === true || e.data?.userCancelled === true) return 'cancelled';
  const code = e.code === undefined || e.code === null ? '' : String(e.code);
  return ERROR_CODES[code] ?? 'unknown';
}

/** Achat demandé alors que le SDK n'est pas prêt (web, invité, clé absente, configuration échouée). */
export class PurchasesNotReadyError extends Error {
  constructor() {
    super('Purchases not configured');
    this.name = 'PurchasesNotReadyError';
  }
}

async function readyPlugin(user: PurchasesUser | null | undefined): Promise<PurchasesPlugin> {
  if (!(await configurePurchases(user))) throw new PurchasesNotReadyError();
  return loadPurchases();
}

function isEntitled(info: CustomerInfo | null | undefined): boolean {
  return Boolean(info?.entitlements?.active?.[entitlementId()]);
}

// ---------------------------------------------------------------------------
// Paywall : chargement, achat, restauration, état client
// ---------------------------------------------------------------------------

export type PaywallLoad =
  | { status: 'web' }
  | { status: 'missing-key' }
  | { status: 'guest' }
  | { status: 'error'; reason: PurchaseErrorReason }
  | { status: 'ready'; plans: PaywallPlan[] };

/** Prépare le paywall : identité RevenueCat puis offering courante. Ne lève jamais. */
export async function loadPaywall(user: PurchasesUser | null | undefined): Promise<PaywallLoad> {
  const availability = purchasesAvailability();
  if (availability === 'web') return { status: 'web' };
  if (availability === 'missing-key') return { status: 'missing-key' };
  if (!user || user.isGuest) return { status: 'guest' };
  try {
    const Purchases = await readyPlugin(user);
    const offerings = await Purchases.getOfferings();
    return { status: 'ready', plans: plansFromOfferings(offerings) };
  } catch (error) {
    const reason = classifyPurchaseError(error);
    return { status: 'error', reason: reason === 'cancelled' ? 'unknown' : reason };
  }
}

export type StoreOutcome =
  /** Le store a encaissé (ou restauré) ; `entitled` : entitlement actif selon le SDK (indicatif). */
  | { status: 'purchased'; entitled: boolean }
  | { status: 'cancelled' }
  | { status: 'error'; reason: PurchaseErrorReason };

/** Achète une formule. Une annulation n'est pas une erreur. Ne lève jamais. */
export async function purchasePlan(user: PurchasesUser | null | undefined, plan: PaywallPlan): Promise<StoreOutcome> {
  try {
    const Purchases = await readyPlugin(user);
    const result = await Purchases.purchasePackage({ aPackage: plan.pkg });
    return { status: 'purchased', entitled: isEntitled(result?.customerInfo) };
  } catch (error) {
    const reason = classifyPurchaseError(error);
    return reason === 'cancelled' ? { status: 'cancelled' } : { status: 'error', reason };
  }
}

export type RestoreOutcome =
  | { status: 'restored' }
  /** Le compte store n'a aucun abonnement Premium actif. */
  | { status: 'nothing' }
  | { status: 'error'; reason: PurchaseErrorReason };

/** « Restaurer mes achats » : rattache au compte les achats du compte store. Ne lève jamais. */
export async function restorePlan(user: PurchasesUser | null | undefined): Promise<RestoreOutcome> {
  try {
    const Purchases = await readyPlugin(user);
    const { customerInfo } = await Purchases.restorePurchases();
    return isEntitled(customerInfo) ? { status: 'restored' } : { status: 'nothing' };
  } catch (error) {
    const reason = classifyPurchaseError(error);
    return { status: 'error', reason: reason === 'cancelled' ? 'unknown' : reason };
  }
}

export interface CustomerState {
  /** Entitlement actif selon le store (indicatif : le backend décide). */
  entitled: boolean;
  /** Page de gestion fournie par le store, si connue. */
  managementUrl: string | null;
  activeProductIds: string[];
}

/** État client RevenueCat ; null sur le web, sans clé, pour un invité ou en cas d'erreur. */
export async function getCustomerState(user: PurchasesUser | null | undefined): Promise<CustomerState | null> {
  try {
    const Purchases = await readyPlugin(user);
    const { customerInfo } = await Purchases.getCustomerInfo();
    return {
      entitled: isEntitled(customerInfo),
      managementUrl: customerInfo?.managementURL ?? null,
      activeProductIds: customerInfo?.activeSubscriptions ?? [],
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Activation côté backend
// ---------------------------------------------------------------------------

/** Délai d'attente du webhook après un achat : au-delà, « Activation en cours… ». */
export const ACTIVATION_TIMEOUT_MS = 30_000;
const POLL_DELAYS_MS = [1_000, 1_500, 2_500, 4_000, 6_000];

export interface WaitOptions {
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Relit le profil (`GET /auth/me`, via `isPremium`) jusqu'à voir le Premium actif côté backend,
 * dans la limite de `timeoutMs`. Une erreur de lecture compte comme « pas encore ».
 * @returns `active` dès que le backend confirme, sinon `pending` à l'échéance.
 */
export async function waitForBackendPremium(
  isPremiumOnBackend: () => Promise<boolean>,
  { timeoutMs = ACTIVATION_TIMEOUT_MS, sleep = defaultSleep, now = Date.now }: WaitOptions = {},
): Promise<'active' | 'pending'> {
  const deadline = now() + timeoutMs;
  for (let attempt = 0; ; attempt++) {
    const premium = await isPremiumOnBackend().catch(() => false);
    if (premium) return 'active';
    const remaining = deadline - now();
    if (remaining <= 0) return 'pending';
    await sleep(Math.min(POLL_DELAYS_MS[Math.min(attempt, POLL_DELAYS_MS.length - 1)], remaining));
  }
}
