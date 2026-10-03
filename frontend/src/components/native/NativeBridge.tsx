'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import type { PluginListenerHandle } from '@capacitor/core';
import { useAuth } from '@/contexts/AuthContext';
import { CARE_SCHEDULED_EVENT } from '@/lib/care-events';
import { appRoute, mapWebUrlToAppRoute } from '@/lib/deep-links';
import {
  areLocalRemindersEnabled,
  clearLocalReminders,
  getReminderPermission,
  markReminderPermissionAsked,
  reminderAnimalId,
  requestReminderPermission,
  syncLocalReminders,
  wasReminderPermissionAsked,
  type ReminderTexts,
  type SyncResult,
} from '@/lib/local-reminders';
import { forgetNativePushSession, pushNotificationRoute, syncNativePush } from '@/lib/native-push';
import { IS_MOBILE_BUILD, animalDetailPath, isNative } from '@/lib/platform';
import { syncPurchasesUser } from '@/lib/purchases';
import { NotificationPrimer } from './NotificationPrimer';
import { useReminderTexts } from './useReminderTexts';

/**
 * Bouton retour Android : ferme d'abord une fenêtre modale ouverte (Échap, comme au clavier), sinon
 * revient dans l'historique, sinon quitte l'app (comportement attendu par Android).
 */
export function handleBackButton(
  canGoBack: boolean,
  { exitApp, doc = document, history = window.history }: { exitApp: () => void; doc?: Document; history?: History },
): 'dismiss' | 'back' | 'exit' {
  if (doc.querySelector('[role="dialog"], [role="alertdialog"]')) {
    const target = doc.activeElement ?? doc.body;
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
    return 'dismiss';
  }
  if (canGoBack) {
    history.back();
    return 'back';
  }
  exitApp();
  return 'exit';
}

interface BridgeState {
  push: (route: string) => void;
  locale: string;
  token: string | null;
  userId: string | null;
  texts: ReminderTexts;
}

/** Délai de regroupement des créations de soins (ajout d'un animal = plusieurs routines). */
const CARE_SCHEDULED_DEBOUNCE_MS = 400;

/**
 * Rappels locaux puis push natif (W6-07) : le jeton FCM est enregistré avec la couverture locale
 * qui vient d'être programmée, retiré si les rappels sont coupés ou la permission retirée.
 */
async function syncDevice(state: BridgeState): Promise<SyncResult | null> {
  const { token, userId, texts, locale } = state;
  if (!token || !userId) return null;
  try {
    const result = await syncLocalReminders({ token, userId, texts, prompt: false });
    await syncNativePush(result, { authToken: token, locale }).catch(() => undefined);
    return result;
  } catch {
    return null;
  }
}

/** La permission mérite-t-elle d'être proposée (jamais refusée, jamais proposée, rappels actifs) ? */
async function mayOfferPermission(): Promise<boolean> {
  if ((await getReminderPermission()) !== 'prompt') return false;
  if (await wasReminderPermissionAsked()) return false;
  return areLocalRemindersEnabled();
}

/** L'URL de lancement (Universal Link à froid) n'est traitée qu'une fois par exécution de l'app. */
let launchUrlHandled = false;

/**
 * Pont avec le système, monté une seule fois (layout racine), actif seulement dans l'app native :
 * - Universal Links / App Links (`appUrlOpen`) → route de l'app (W6-09) ;
 * - rappels locaux (W6-06) et push natif (W6-07) : synchronisés après la connexion (invité compris),
 *   à chaque retour au premier plan et après la création d'un soin ; annulés à la déconnexion ; une
 *   notification touchée (locale ou distante) ouvre la fiche de l'animal ;
 * - permission des notifications : jamais au lancement ; proposée avec une explication préalable
 *   au premier soin créé ou juste après une connexion s'il y a des soins à rappeler (une fois) ;
 * - achats intégrés (W6-08) : compte connecté → RevenueCat `configure` / `logIn` (appUserID = id du
 *   compte) ; invité ou déconnexion → `logOut` ;
 * - bouton retour Android.
 */
export function NativeBridgeEffects() {
  const router = useRouter();
  const locale = useLocale();
  const { user, token, isLoading } = useAuth();
  const texts = useReminderTexts();
  const userId = user?.id ?? null;
  const isGuest = user?.isGuest === true;
  const [primerOpen, setPrimerOpen] = useState(false);
  const [primerBusy, setPrimerBusy] = useState(false);

  const state = useRef<BridgeState | null>(null);
  useEffect(() => {
    state.current = { push: (route) => router.push(route), locale, token, userId, texts };
  });

  const offerPermission = useRef(async () => {
    if (await mayOfferPermission()) setPrimerOpen(true);
  });

  // Écouteurs natifs : enregistrés une fois, lisent l'état courant via la ref.
  useEffect(() => {
    if (!isNative()) return;
    let disposed = false;
    const handles: PluginListenerHandle[] = [];
    const keep = (handle: PluginListenerHandle) => {
      if (disposed) void handle.remove();
      else handles.push(handle);
    };
    const openUrl = (url: string) => {
      const current = state.current;
      if (!current) return;
      const route = mapWebUrlToAppRoute(url, { locale: current.locale });
      if (route) current.push(route);
    };

    void (async () => {
      const [{ App }, { LocalNotifications }] = await Promise.all([
        import('@capacitor/app'),
        import('@capacitor/local-notifications'),
      ]);
      if (disposed) return;
      keep(await App.addListener('appUrlOpen', ({ url }) => openUrl(url)));
      keep(
        await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive && state.current) void syncDevice(state.current);
        }),
      );
      keep(
        await App.addListener('backButton', ({ canGoBack }) => {
          handleBackButton(canGoBack, { exitApp: () => void App.exitApp() });
        }),
      );
      keep(
        await LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
          const animalId = reminderAnimalId(notification.extra);
          const current = state.current;
          if (animalId && current) current.push(appRoute(current.locale, animalDetailPath(animalId)));
        }),
      );
      if (!launchUrlHandled) {
        launchUrlHandled = true;
        const launch = await App.getLaunchUrl();
        if (launch?.url && !disposed) openUrl(launch.url);
      }
    })().catch(() => {
      // Plugin absent (projet natif non synchronisé) : l'app reste utilisable sans ces intégrations.
    });

    // Push natif (W6-07), à part : sans Firebase configuré dans le projet natif, le plugin peut
    // échouer sans priver l'app des autres intégrations.
    void (async () => {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      if (disposed) return;
      keep(
        await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
          const path = pushNotificationRoute(notification.data);
          const current = state.current;
          if (path && current) current.push(appRoute(current.locale, path));
        }),
      );
    })().catch(() => undefined);

    // Soin créé dans l'app : rappels reprogrammés si autorisés, sinon proposition (une fois).
    let careTimer: ReturnType<typeof setTimeout> | undefined;
    const onCareScheduled = () => {
      clearTimeout(careTimer);
      careTimer = setTimeout(() => {
        void (async () => {
          const current = state.current;
          if (!current?.userId) return;
          if ((await getReminderPermission()) === 'granted') await syncDevice(current);
          else await offerPermission.current();
        })().catch(() => undefined);
      }, CARE_SCHEDULED_DEBOUNCE_MS);
    };
    window.addEventListener(CARE_SCHEDULED_EVENT, onCareScheduled);

    return () => {
      disposed = true;
      clearTimeout(careTimer);
      window.removeEventListener(CARE_SCHEDULED_EVENT, onCareScheduled);
      for (const handle of handles) void handle.remove();
    };
  }, []);

  // Session : synchronise à la connexion, annule à la déconnexion. Après une connexion faite
  // pendant cette exécution (jamais au lancement à froid), la permission est proposée avec une
  // explication s'il y a des soins à rappeler.
  const previousUserId = useRef<string | null>(null);
  const sawSignedOut = useRef(false);
  useEffect(() => {
    if (!isNative() || isLoading) return;
    const previous = previousUserId.current;
    previousUserId.current = userId;
    if (!userId) {
      sawSignedOut.current = true;
      forgetNativePushSession();
      if (previous) void clearLocalReminders();
      return;
    }
    if (userId === previous || !state.current) return;
    const afterSignIn = sawSignedOut.current;
    void syncDevice(state.current).then((result) => {
      if (afterSignIn && result?.outcome === 'no-permission' && (result.planned ?? 0) > 0) {
        return offerPermission.current();
      }
    });
  }, [isLoading, userId]);

  // Achats intégrés : identité RevenueCat alignée sur la session (jamais pour un invité).
  useEffect(() => {
    if (!isNative() || isLoading) return;
    void syncPurchasesUser(userId ? { id: userId, isGuest } : null).catch(() => undefined);
  }, [isLoading, userId, isGuest]);

  const acceptPrimer = async () => {
    setPrimerBusy(true);
    try {
      if ((await requestReminderPermission()) === 'granted' && state.current) await syncDevice(state.current);
    } finally {
      setPrimerBusy(false);
      setPrimerOpen(false);
    }
  };

  const laterPrimer = () => {
    setPrimerOpen(false);
    void markReminderPermissionAsked();
  };

  return <NotificationPrimer open={primerOpen} busy={primerBusy} onAccept={() => void acceptPrimer()} onLater={laterPrimer} />;
}

/** Monté dans le layout racine ; rien sur le web (hors export mobile). */
export function NativeBridge() {
  return IS_MOBILE_BUILD ? <NativeBridgeEffects /> : null;
}

export default NativeBridge;
