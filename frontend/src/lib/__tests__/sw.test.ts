/**
 * Service worker Web Push (public/sw.js) : exécuté dans un contexte simulé.
 * Vérifie l'affichage de la notification et l'URL localisée ouverte au clic.
 */
import fs from 'fs';
import path from 'path';

type Listener = (event: unknown) => void;

const SW_SOURCE = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'public', 'sw.js'), 'utf8');

function loadServiceWorker() {
  const listeners: Record<string, Listener> = {};
  const showNotification = jest.fn().mockResolvedValue(undefined);
  const openWindow = jest.fn().mockResolvedValue(undefined);
  const matchAll = jest.fn().mockResolvedValue([]);
  const self = {
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = fn;
    },
    registration: { showNotification },
    clients: { openWindow, matchAll, claim: jest.fn() },
    skipWaiting: jest.fn(),
  };
  new Function('self', SW_SOURCE)(self);
  return { listeners, showNotification, openWindow, matchAll };
}

const pushEvent = (payload: unknown) => {
  const waits: Promise<unknown>[] = [];
  return {
    event: {
      data: { json: () => payload, text: () => String(payload) },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    },
    waits,
  };
};

const clickEvent = (data: Record<string, unknown>) => {
  const waits: Promise<unknown>[] = [];
  return {
    event: {
      notification: { close: jest.fn(), data },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    },
    waits,
  };
};

describe('sw.js', () => {
  it('push : affiche la notification avec titre, corps, icône et tag de l’événement', async () => {
    const sw = loadServiceWorker();
    const { event, waits } = pushEvent({
      title: 'Nourrir Rex',
      body: 'Rex',
      data: { eventId: 'ev1', locale: 'fr' },
    });

    sw.listeners.push(event);
    await Promise.all(waits);

    expect(sw.showNotification).toHaveBeenCalledWith(
      'Nourrir Rex',
      expect.objectContaining({
        body: 'Rex',
        icon: '/icons/icon-192.png',
        tag: 'ev1',
        data: { eventId: 'ev1', locale: 'fr' },
      }),
    );
  });

  it('push : valeurs par défaut si la charge utile est vide', async () => {
    const sw = loadServiceWorker();
    const { event, waits } = pushEvent({});
    sw.listeners.push(event);
    await Promise.all(waits);
    expect(sw.showNotification).toHaveBeenCalledWith(
      'Captivia',
      expect.objectContaining({ body: 'Notification' }),
    );
  });

  it('click : ouvre la fiche de l’animal avec le préfixe de locale', async () => {
    const sw = loadServiceWorker();
    const { event, waits } = clickEvent({ animalId: 'an 1', locale: 'pt' });

    sw.listeners.notificationclick(event);
    await Promise.all(waits);

    expect(event.notification.close).toHaveBeenCalled();
    expect(sw.openWindow).toHaveBeenCalledWith('/pt/mes-animaux/an%201');
  });

  it('click : liste des animaux sans animalId, sans préfixe si la locale est absente ou invalide', async () => {
    const sw = loadServiceWorker();

    const a = clickEvent({ locale: 'fr' });
    sw.listeners.notificationclick(a.event);
    await Promise.all(a.waits);
    expect(sw.openWindow).toHaveBeenLastCalledWith('/fr/mes-animaux');

    const b = clickEvent({});
    sw.listeners.notificationclick(b.event);
    await Promise.all(b.waits);
    expect(sw.openWindow).toHaveBeenLastCalledWith('/mes-animaux');

    const c = clickEvent({ locale: '../evil', animalId: 'x' });
    sw.listeners.notificationclick(c.event);
    await Promise.all(c.waits);
    expect(sw.openWindow).toHaveBeenLastCalledWith('/mes-animaux/x');
  });

  it('click : réutilise un onglet ouvert (focus + navigate) au lieu d’en ouvrir un nouveau', async () => {
    const sw = loadServiceWorker();
    const client = {
      focus: jest.fn().mockResolvedValue(undefined),
      navigate: jest.fn().mockResolvedValue(undefined),
    };
    sw.matchAll.mockResolvedValue([client]);
    const { event, waits } = clickEvent({ animalId: 'a1', locale: 'en' });

    sw.listeners.notificationclick(event);
    await Promise.all(waits);

    expect(client.focus).toHaveBeenCalled();
    expect(client.navigate).toHaveBeenCalledWith('/en/mes-animaux/a1');
    expect(sw.openWindow).not.toHaveBeenCalled();
  });
});
