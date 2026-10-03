import { expect, signIn, test, type MockAgendaItem } from '../support/test';

/** Outils du compte : agenda des soins, abonnement, magasin (lot 4). */
test.describe('Outils du compte', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('agenda : frise des soins, filtres et abonnement calendrier', async ({ page, api }) => {
    const today = new Date();
    const day = (offset: number, hour: number) =>
      new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset, hour, 0).toISOString();
    const key = (offset: number) => day(offset, 12).slice(0, 10);
    api.agenda = [
      { id: 'a1', date: day(1, 20), day: key(1), allDay: false, type: 'routine', animalId: 'animal-e2e-1', animalName: 'Kaa', title: 'Nourrissage', detail: '1 rat moyen', status: 'pending', sourceId: 'r1' },
      { id: 'a2', date: day(3, 14), day: key(3), allDay: false, type: 'vet_appointment', animalId: 'animal-e2e-1', animalName: 'Kaa', title: 'Bilan annuel', detail: null, status: 'pending', sourceId: 'v1' },
    ] satisfies MockAgendaItem[];

    await page.goto('/agenda');
    await expect(page.getByRole('heading', { level: 1, name: 'Agenda des soins' })).toBeVisible();

    const timeline = page.getByRole('list', { name: 'Soins à venir par jour' });
    await expect(timeline.getByRole('listitem')).toHaveCount(2);
    await expect(timeline).toContainText('Nourrissage');
    await expect(timeline).toContainText('Rendez-vous vétérinaire');

    // Filtre par type : seule la visite reste.
    await page.getByLabel('Type de soin').selectOption('vet_appointment');
    await expect(timeline.getByRole('listitem')).toHaveCount(1);
    await expect(timeline).not.toContainText('Nourrissage');

    // Période : 7 jours relance l'appel avec la nouvelle borne.
    await page.getByRole('button', { name: '7 jours' }).click();
    await expect(page.getByRole('button', { name: '7 jours' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => api.callsTo('GET', '/users/me/agenda').length).toBeGreaterThanOrEqual(2);

    // Abonnement calendrier : aucun lien tant qu'il n'est pas créé.
    const subscription = page.getByRole('region', { name: 'Dans votre calendrier' });
    await expect(subscription.getByText('Aucun lien')).toBeVisible();
    await expect(subscription.getByRole('button', { name: 'Créer mon lien et le copier' })).toBeVisible();
  });

  test('abonnement : deux formules honnêtes, aucun prix ni bouton d’achat sur le web', async ({ page, api }) => {
    await page.goto('/parametres/abonnement');
    await expect(page.getByRole('heading', { level: 1, name: 'Un carnet pour chacun de vos animaux' })).toBeVisible();

    const free = page.getByRole('article', { name: 'Gratuit' });
    const premium = page.getByRole('article', { name: /Premium/ });
    await expect(free.getByText('Votre formule', { exact: true })).toBeVisible();
    await expect(premium.getByText('Votre formule', { exact: true })).toHaveCount(0);
    await expect(premium.getByText('Abonnement mensuel ou annuel')).toBeVisible();
    await expect(premium.getByText('Tarif affiché dans l’app avant tout achat.')).toBeVisible();
    // Le tarif vient des stores : aucun montant d'abonnement codé en dur, aucun achat sur le site.
    await expect(premium).not.toContainText(/\d+[,.]\d{2}\s?€|€\s?\d/);
    await expect(page.getByRole('button', { name: /s['’]abonner|acheter|payer|restaurer/i })).toHaveCount(0);
    // L'abonnement se prend dans l'app : fiches des stores (marqueur tant qu'elles ne sont pas publiées).
    const stores = premium.getByRole('list', { name: 'Télécharger l’application' });
    await expect(stores).toContainText('App Store');
    await expect(stores).toContainText('Google Play');

    // Comparatif : 1 animal en gratuit, illimité en Premium.
    const table = page.getByRole('table');
    await expect(table.getByRole('row', { name: /Animaux suivis/ })).toContainText('1');
    await expect(table.getByRole('row', { name: /Animaux suivis/ })).toContainText('Illimité');
    expect(api.callsTo('GET', '/users/me/subscription')).toHaveLength(1);
  });

  test('magasin : sans boutique partenaire, un état vide sans mention d’affiliation', async ({ page }) => {
    await page.goto('/magasin');
    await expect(page.getByRole('heading', { level: 1, name: 'Boutiques partenaires' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Aucune boutique partenaire pour le moment' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Parcourir les fiches espèces' })).toBeVisible();
    await expect(page.getByRole('main')).not.toContainText('Liens d\'affiliation');
    await expect(page.getByRole('link', { name: 'Voir le site' })).toHaveCount(0);
  });
});
