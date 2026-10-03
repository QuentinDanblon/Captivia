import { expect, fixture, signIn, test, type MockAgendaItem, type MockAnimal } from '../support/test';

/** Jour local `YYYY-MM-DD` décalé de `offset` jours, et instant ISO à `hour` heures ce jour-là. */
const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const at = (offset: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

/** Ajout d'un animal par le parcours en étapes : espèce, puis nom et naissance. */
async function addKaa(page: import('@playwright/test').Page) {
  await page.locator('#animal-species').fill('boa');
  await page.getByRole('button', { name: /Boa constrictor/ }).click();
  await page.getByRole('button', { name: 'Suivant' }).click();
  await expect(page.getByRole('heading', { name: "Comment s'appelle-t-il ?" })).toBeVisible();
  await page.locator('#animal-name').fill('Kaa');
  await page.getByText('Mâle', { exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
}

test.describe('Mes animaux', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('aujourd’hui sans animal : le parcours du premier animal', async ({ page }) => {
    await page.goto('/mes-animaux');

    await expect(page.getByRole('heading', { level: 1, name: "Aujourd'hui" })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Son carnet, prêt en trois étapes' })).toBeVisible();
    const steps = page.getByRole('list', { name: 'Ajouter votre animal' });
    await expect(steps.getByRole('listitem')).toHaveCount(3);
    await expect(steps.locator('[aria-current="step"]')).toContainText('Espèce');
    await expect(page.getByText('Étape 1 sur 3')).toBeVisible();
  });

  test('aujourd’hui : soins du jour, alertes, frise, carte, conseil et offre', async ({ page, api }) => {
    api.animals = [{ ...fixture<MockAnimal>('animal'), speciesName: 'Boa constrictor' }];
    api.collections = {
      measurements: [{ id: 'w1', weightKg: 2.34, heightCm: null, measuredAt: at(-41, 10), notes: null }],
      vaccinations: [
        { id: 'v1', name: 'Vermifuge', date: at(-200, 10), nextDueDate: `${day(-3)}T00:00:00.000Z`, batchNumber: null, vetName: null, notes: null },
      ],
    };
    const base = { animalId: 'animal-e2e-1', animalName: 'Kaa', detail: null, sourceId: 's' };
    api.agenda = [
      { ...base, id: 'a1', date: at(-1, 19), day: day(-1), allDay: false, type: 'routine', title: 'Brumisation', status: 'pending' },
      { ...base, id: 'a2', date: at(0, 23), day: day(0), allDay: false, type: 'routine', title: 'Nourrissage', status: 'pending' },
      { ...base, id: 'a3', date: at(3, 14), day: day(3), allDay: false, type: 'vet_appointment', title: 'Dr Martin', status: 'pending' },
    ] satisfies MockAgendaItem[];
    await page.goto('/mes-animaux');

    await expect(page.getByRole('heading', { level: 1, name: "Aujourd'hui" })).toBeVisible();
    // Agenda des 8 prochains jours, via l'API agenda existante.
    await expect.poll(() => api.callsTo('GET', '/users/me/agenda').length).toBeGreaterThan(0);
    const [agendaCall] = api.callsTo('GET', '/users/me/agenda');
    expect(agendaCall.query.get('from')).toBe(day(0));
    expect(agendaCall.query.get('to')).toBe(day(7));

    // Pastilles chiffrées : le nombre est le message.
    const pill = (label: string) => page.locator('span[data-tone]').filter({ hasText: label }).first();
    await expect(pill("soin aujourd'hui")).toHaveText(/^1\s*soin aujourd'hui$/);
    await expect(pill('en retard')).toHaveText(/^1\s*en retard$/);
    await expect(pill('rendez-vous cette semaine')).toHaveText(/^1\s*rendez-vous cette semaine$/);

    // Alertes graduées : rappel dépassé (urgent, role=alert) avant la pesée ancienne.
    const urgent = page.getByRole('alert').filter({ hasText: 'Rappel de vaccin dépassé : Vermifuge' });
    await expect(urgent).toBeVisible();
    await expect(urgent.getByRole('link', { name: 'Voir la fiche de Kaa' })).toHaveAttribute('href', /\/mes-animaux\/animal-e2e-1$/);
    await expect(page.getByText('Dernière pesée de Kaa il y a 41 jours')).toBeVisible();

    // Frise des 7 prochains jours : un élément par soin, statut écrit.
    const timeline = page.getByRole('list', { name: "Soins d'aujourd'hui et des 7 prochains jours" });
    await expect(timeline.getByRole('listitem')).toHaveCount(3);
    await expect(timeline.getByRole('listitem').first()).toContainText('En retard');
    await expect(page.getByRole('link', { name: "Tout l'agenda" })).toHaveAttribute('href', /\/agenda$/);

    // Carte de l'animal : lien étiré vers la fiche, dernière pesée en grammes.
    const card = page.locator('article').filter({ has: page.getByRole('link', { name: 'Kaa' }) });
    await expect(card).toContainText('Boa constrictor');
    await expect(card).toContainText(/2\s340\sg/);
    await expect(card.getByRole('link', { name: 'Kaa' })).toHaveAttribute('href', /\/mes-animaux\/animal-e2e-1$/);

    // Conseil tiré de la fiche espèce, et offre : 2e animal verrouillé vers Premium.
    await expect(page.locator('aside').filter({ hasText: 'Bon à savoir' })).toContainText('Hygiène du terrarium');
    await expect(page.getByText('Ajouter un deuxième animal')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Découvrir Premium' })).toHaveAttribute('href', /\/parametres\/abonnement$/);
    await expect(page.getByRole('button', { name: 'Ajouter un animal' })).toHaveCount(0);
  });

  test('liste : animal existant, limite gratuite et lien vers le détail', async ({ page, api }) => {
    api.animals = [{ ...fixture<MockAnimal>('animal'), speciesName: 'Boa constrictor' }];
    await page.goto('/mes-animaux/liste');

    await expect(page.getByRole('heading', { level: 1, name: 'Mes animaux' })).toBeVisible();
    // Carte en <article> : lien étiré sur le nom, lien « carnet » frère (pas de lien imbriqué).
    const card = page.locator('article').filter({ has: page.getByRole('link', { name: 'Kaa' }) });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Boa constrictor');
    await expect(card.getByRole('link', { name: 'Carnet de santé' })).toHaveAttribute(
      'href',
      /\/mes-animaux\/animal-e2e-1\/carnet$/,
    );
    await expect(card.locator('a a, a button')).toHaveCount(0);
    // Compte gratuit : un seul animal ; l'ajout est remplacé par l'emplacement verrouillé (Premium).
    await expect(page.getByRole('button', { name: /Ajouter un animal/ })).toHaveCount(0);
    await expect(page.getByText('Ajouter un deuxième animal')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Découvrir Premium' })).toHaveAttribute('href', /\/parametres\/abonnement$/);

    await card.getByRole('heading', { name: 'Kaa' }).click();
    await expect(page).toHaveURL(/\/mes-animaux\/animal-e2e-1$/);
  });

  test('ajout d’un animal : étapes, envoi à l’API puis affichage sur le tableau de bord', async ({ page, api }) => {
    await page.goto('/mes-animaux');
    await expect(page.getByRole('heading', { level: 2, name: 'Son carnet, prêt en trois étapes' })).toBeVisible();

    await addKaa(page);

    await expect(page.getByText('Kaa a été ajouté')).toBeVisible();
    await expect(page.getByRole('link', { name: /Kaa/ }).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Son carnet, prêt en trois étapes' })).toBeHidden();

    const [call] = api.callsTo('POST', '/users/me/animals');
    expect(call.body).toMatchObject({ name: 'Kaa', speciesId: 2435099, sex: 'male' });
    expect(call.headers['authorization']).toMatch(/^Bearer /);
  });

  test('ajout sans espèce choisie : impossible de continuer, aucun envoi', async ({ page, api }) => {
    await page.goto('/mes-animaux');

    // Texte saisi mais aucune espèce sélectionnée dans la liste de suggestions.
    await page.locator('#animal-species').fill('boa');
    await expect(page.getByRole('button', { name: /Boa constrictor/ })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Suivant' })).toBeDisabled();
    await expect(page.locator('#animal-name')).toHaveCount(0);
    expect(api.callsTo('POST', '/users/me/animals')).toHaveLength(0);
  });

  test('détail d’un animal : fiche chargée avec les données de l’espèce', async ({ page, api }) => {
    api.animals = [fixture<MockAnimal>('animal')];
    await page.goto('/mes-animaux/animal-e2e-1');

    await expect(page.getByRole('heading', { level: 1, name: 'Kaa' })).toBeVisible();
    expect(api.callsTo('GET', '/users/me/animals/animal-e2e-1')).not.toHaveLength(0);
    expect(api.callsTo('GET', '/species/2435099')).not.toHaveLength(0);
    // Bandeau de synthèse sous l'en-tête, visible sans défiler.
    const summary = page.getByRole('region', { name: 'En bref' });
    await expect(summary).toBeInViewport();
    await expect(summary).toContainText('Prochain rendez-vous');
  });

  test('détail : ajout d’une pesée depuis la barre d’actions (mobile) ou la section', async ({ page, api }) => {
    api.animals = [fixture<MockAnimal>('animal')];
    await page.goto('/mes-animaux/animal-e2e-1');
    await expect(page.getByRole('heading', { level: 1, name: 'Kaa' })).toBeVisible();

    const bar = page.getByRole('toolbar', { name: 'Actions pour Kaa' });
    const mobile = (page.viewportSize()?.width ?? 1280) < 1024;
    if (mobile) {
      await expect(bar).toBeInViewport();
      await bar.getByRole('button', { name: 'Peser' }).click();
    } else {
      await expect(bar).toBeHidden();
      await page.getByRole('region', { name: 'Poids & mesures' }).getByRole('button', { name: 'Ajouter une mesure' }).click();
    }
    await expect(page.getByRole('dialog', { name: 'Ajouter une mesure' })).toBeVisible();
  });

  test('détail d’un animal inexistant : message « introuvable »', async ({ page }) => {
    await page.goto('/mes-animaux/inconnu');

    await expect(page.getByText("Erreur lors du chargement des données de l'animal")).toBeVisible();
    await expect(page.getByRole('link', { name: 'Retour à mes animaux' })).toBeVisible();
  });
});
