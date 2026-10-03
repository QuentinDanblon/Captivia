'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import type { PluginListenerHandle } from '@capacitor/core';
import { useAuth } from '@/contexts/AuthContext';
import { appRoute, mapWebUrlToAppRoute } from '@/lib/deep-links';
import { clearLocalReminders, reminderAnimalId, syncLocalReminders, type ReminderTexts, type SyncOptions } from '@/lib/local-reminders';
import { IS_MOBILE_BUILD, animalDetailPath, isNative } from '@/lib/platform';
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

function runSync(state: BridgeState, prompt: SyncOptions['prompt']) {
  const { token, userId, texts } = state;
  if (!token || !userId) return;
  void syncLocalReminders({ token, userId, texts, prompt }).catch(() => undefined);
}

/** L'URL de lancement (Universal Link à froid) n'est traitée qu'une fois par exécution de l'app. */
let launchUrlHandled = false;

/**
 * Pont avec le système, monté une seule fois (layout racine), actif seulement dans l'app native :
 * - Universal Links / App Links (`appUrlOpen`) → route de l'app (W6-09) ;
 * - rappels locaux (W6-06) : synchronisés après la connexion (invité compris) et à chaque retour
 *   au premier plan ; annulés à la déconnexion ; un rappel touché ouvre la fiche de l'animal ;
 * - bouton retour Android.
 */
export function NativeBridgeEffects() {
  const router = useRouter();
  const locale = useLocale();
  const { user, token, isLoading } = useAuth();
  const texts = useReminderTexts();
  const userId = user?.id ?? null;

  const state = useRef<BridgeState | null>(null);
  useEffect(() => {
    state.current = { push: (route) => router.push(route), locale, token, userId, texts };
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
          if (isActive && state.current) runSync(state.current, false);
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

    return () => {
      disposed = true;
      for (const handle of handles) void handle.remove();
    };
  }, []);

  // Session : synchronise à la connexion, annule à la déconnexion. La permission n'est proposée
  // qu'après une connexion faite pendant cette exécution (jamais au lancement à froid).
  const previousUserId = useRef<string | null>(null);
  const sawSignedOut = useRef(false);
  useEffect(() => {
    if (!isNative() || isLoading) return;
    const previous = previousUserId.current;
    previousUserId.current = userId;
    if (!userId) {
      sawSignedOut.current = true;
      if (previous) void clearLocalReminders();
      return;
    }
    if (userId === previous || !state.current) return;
    runSync(state.current, sawSignedOut.current ? 'once' : false);
  }, [isLoading, userId]);

  return null;
}

/** Monté dans le layout racine ; rien sur le web (hors export mobile). */
export function NativeBridge() {
  return IS_MOBILE_BUILD ? <NativeBridgeEffects /> : null;
}

export default NativeBridge;
