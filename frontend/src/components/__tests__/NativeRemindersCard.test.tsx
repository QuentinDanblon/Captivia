import { act, fireEvent, render, screen } from '@testing-library/react';

const status = { enabled: true, permission: 'prompt' as 'granted' | 'denied' | 'prompt', count: 0 };
const mockSetEnabled = jest.fn(async (enabled: boolean) => {
  status.enabled = enabled;
  if (!enabled) status.count = 0;
});
const mockSync = jest.fn(async () => {
  status.permission = 'granted';
  status.count = 3;
  return { outcome: 'scheduled', count: 3, source: 'network' };
});
jest.mock('@/lib/local-reminders', () => ({
  areLocalRemindersEnabled: async () => status.enabled,
  getReminderPermission: async () => status.permission,
  countScheduledReminders: async () => status.count,
  setLocalRemindersEnabled: (enabled: boolean) => mockSetEnabled(enabled),
  syncLocalReminders: (...args: unknown[]) => mockSync(...(args as [])),
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' }, token: 'jwt' }) }));
const mockSyncPush = jest.fn(async () => undefined);
const mockUnregisterPush = jest.fn(async () => undefined);
jest.mock('@/lib/native-push', () => ({
  syncNativePush: (...args: unknown[]) => mockSyncPush(...(args as [])),
  unregisterNativePush: (...args: unknown[]) => mockUnregisterPush(...(args as [])),
}));

import { NativeRemindersCard } from '../native/NativeRemindersCard';

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

beforeEach(() => {
  Object.assign(status, { enabled: true, permission: 'prompt', count: 0 });
  jest.clearAllMocks();
});

describe('NativeRemindersCard', () => {
  it('activer : demande la permission (action explicite) et programme les rappels', async () => {
    render(<NativeRemindersCard />);
    await flush();
    expect(screen.getByText('nativeReminders.offText')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'nativeReminders.enable' }));
    await flush();
    expect(mockSetEnabled).toHaveBeenCalledWith(true);
    expect(mockSync).toHaveBeenCalledWith(expect.objectContaining({ token: 'jwt', userId: 'u1', prompt: 'always' }));
    expect(screen.getByText('nativeReminders.onText')).toBeInTheDocument();
    expect(screen.getByText('notifications.pushOn')).toBeInTheDocument();
    // W6-07 : le téléphone est aussi enregistré pour le push natif.
    expect(mockSyncPush).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'scheduled' }), {
      authToken: 'jwt',
      locale: 'fr',
    });
  });

  it('couper : annule tout et ne programme plus rien', async () => {
    Object.assign(status, { enabled: true, permission: 'granted', count: 5 });
    render(<NativeRemindersCard />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'nativeReminders.disable' }));
    await flush();
    expect(mockSetEnabled).toHaveBeenCalledWith(false);
    expect(mockSync).not.toHaveBeenCalled();
    // W6-07 : plus de push distant non plus.
    expect(mockUnregisterPush).toHaveBeenCalledWith('jwt');
    expect(screen.getByRole('button', { name: 'nativeReminders.enable' })).toBeInTheDocument();
  });

  it('notifications bloquées dans les réglages : explication, aucun bouton', async () => {
    status.permission = 'denied';
    render(<NativeRemindersCard />);
    await flush();
    expect(screen.getByText('nativeReminders.blocked')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('agenda injoignable : message d’erreur', async () => {
    mockSync.mockResolvedValueOnce({ outcome: 'unavailable', count: 0, source: null });
    render(<NativeRemindersCard />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'nativeReminders.enable' }));
    await flush();
    expect(screen.getByRole('alert')).toHaveTextContent('nativeReminders.syncError');
  });
});
