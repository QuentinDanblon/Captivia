import { expect, fixture, signIn, test, type MockAnimal } from '../support/test';

test.describe('Routines', () => {
  test('ajouter une promenade et la retrouver dans l’agenda', async ({ page, api }) => {
    api.animals = [fixture<MockAnimal>('animal')];
    api.collections.routines = [
      {
        id: 'routine-e2e-initial',
        animalId: 'animal-e2e-1',
        name: 'Nourrissage',
        type: 'nourrissage',
        frequency: 'daily',
        schedule: { time: '08:00', recurrence: 'daily' },
        active: true,
      },
    ];
    await signIn(page);
    await page.goto('/mes-animaux/animal-e2e-1');

    await expect(page.getByRole('heading', { level: 1, name: 'Kaa' })).toBeVisible();
    await page.getByRole('button', { name: 'Ajouter une routine' }).click();
    const dialog = page.getByRole('dialog', { name: 'Ajouter une routine' });
    await expect(dialog).toBeVisible();
    await dialog.locator('#routine-name').fill('Promenade de Kaa');
    await dialog.locator('#routine-type').selectOption('promenade');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    await expect
      .poll(() => api.callsTo('POST', '/users/me/animals/animal-e2e-1/routines').length)
      .toBe(1);
    const [createCall] = api.callsTo('POST', '/users/me/animals/animal-e2e-1/routines');
    expect(createCall.body).toMatchObject({ type: 'promenade', name: 'Promenade de Kaa' });
    await expect(dialog).toBeHidden();

    await page.goto('/agenda');
    const timeline = page.getByRole('list', { name: 'Soins à venir par jour' });
    await expect(timeline).toContainText('Promenade de Kaa');
  });
});
