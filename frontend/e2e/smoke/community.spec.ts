import path from 'node:path';
import {
  COMMUNITY_MEDIA_PREFIX,
  communityPost,
  expect,
  fixture,
  runAxe,
  signIn,
  signInAsGuest,
  test,
  type MockAnimal,
  type MockApi,
} from '../support/test';

/**
 * Communauté (phase 2, interface) face à l'API simulée : ouverture conditionnelle, fil →
 * publication → réponse → signalement, création d'une publication photo, états d'un invité.
 */

const QUESTION_ID = '30000000-0000-4000-8000-000000000001';
const PHOTO_ID = '30000000-0000-4000-8000-000000000002';
const HOSTILE = 'Mue difficile ? <script>alert(1)</script> voir https://promo.example/gecko';

function seed(api: MockApi) {
  api.community.enabled = true;
  api.community.posts = [
    communityPost({
      id: QUESTION_ID,
      type: 'QUESTION',
      body: `${HOSTILE}\nMon gecko léopard garde des lambeaux de peau aux doigts depuis 3 jours.`,
      speciesCategory: 'REPTILE',
      author: { handle: 'gecko.lea', avatarUrl: null },
      animal: { name: 'Pixel', species: 'Gecko léopard', scientificName: 'Eublepharis macularius' },
      likeCount: 4,
      commentCount: 0,
    }),
    communityPost({
      id: PHOTO_ID,
      type: 'PHOTO',
      body: 'Sieste au soleil après le bain.',
      speciesCategory: 'MAMMAL',
      author: { handle: 'moka_le_chat', avatarUrl: null },
      media: [{ id: 'm1', url: `${COMMUNITY_MEDIA_PREFIX}m1.webp`, width: 480, height: 320 }],
      likeCount: 12,
      commentCount: 3,
      createdAt: new Date(Date.now() - 26 * 3600_000).toISOString(),
    }),
  ];
}

async function expectNoSeriousA11y(page: import('@playwright/test').Page) {
  const violations = await runAxe(page);
  const blocking = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(blocking, 'violations axe sérieuses ou critiques').toEqual([]);
}

test.describe('Communauté', () => {
  test('volet fermé côté serveur (404) : « Bientôt », sans lien mort', async ({ page, api }) => {
    await signIn(page);
    api.animals = [fixture<MockAnimal>('animal')];
    await page.goto('/mes-animaux');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => api.callsTo('GET', '/community/rules').length).toBeGreaterThan(0);
    await expect(page.getByRole('link', { name: /Communauté/ })).toHaveCount(0);
    await expect(page.locator('[data-soon]').first()).toContainText('Bientôt');

    // Accès direct : annonce, aucune page vide ni erreur.
    await page.goto('/communaute');
    await expect(page.getByRole('heading', { level: 1, name: 'La communauté ouvre bientôt' })).toBeVisible();
    await expectNoSeriousA11y(page);
  });

  test('fil → publication → réponse → signalement', async ({ page, api }) => {
    await signIn(page);
    seed(api);
    await page.goto('/mes-animaux');
    // L'API répond : la destination devient un lien.
    const tab = page.getByRole('link', { name: 'Communauté' }).filter({ visible: true });
    await expect(tab).toHaveCount(1);
    await tab.click();

    await expect(page).toHaveURL(/\/communaute$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Communauté' })).toBeVisible();
    const feed = page.getByRole('list', { name: 'Publications récentes' });
    await expect(feed.getByRole('article')).toHaveCount(2);
    // Texte brut : la balise reste du texte, l'adresse n'est pas un lien.
    await expect(feed).toContainText('<script>alert(1)</script>');
    await expect(feed.locator('a[href*="promo.example"]')).toHaveCount(0);
    // Photo d'un membre, servie par l'origine des médias autorisée (aucune violation CSP).
    await expect(feed.getByRole('img', { name: /Sieste au soleil/ })).toBeVisible();
    await expectNoSeriousA11y(page);

    // Filtre « Questions » : reflété dans l'URL.
    await page.getByRole('button', { name: 'Questions' }).click();
    await expect(page).toHaveURL(/type=questions/);
    await expect(feed.getByRole('article')).toHaveCount(1);

    // Détail.
    await feed.getByRole('link', { name: /ouvrir la publication/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/communaute/publication/${QUESTION_ID}$`));
    await expect(page.getByRole('heading', { level: 1, name: /@gecko\.lea/ })).toBeVisible();
    await expect(page.getByText('Pixel', { exact: true })).toBeVisible();
    await expectNoSeriousA11y(page);

    // Réponse.
    await page.getByLabel('Votre réponse à la question').fill('Un bain tiède de 10 minutes aide souvent. Si ça persiste, vétérinaire.');
    await page.getByRole('button', { name: 'Répondre', exact: true }).click();
    const replies = page.getByRole('region', { name: /réponse à la question/ });
    await expect(replies).toContainText('Un bain tiède de 10 minutes');
    const posted = api.callsTo('POST', `/community/posts/${QUESTION_ID}/comments`);
    expect(posted).toHaveLength(1);
    expect(posted[0].body).toEqual({ body: 'Un bain tiède de 10 minutes aide souvent. Si ça persiste, vétérinaire.' });

    // « J'aime ».
    const like = page.getByRole('button', { name: /J'aime/ });
    await like.click();
    await expect(like).toHaveAttribute('aria-pressed', 'true');

    // Signalement : modale, liste fermée des motifs.
    await page.getByRole('button', { name: 'Signaler cette publication' }).click();
    const dialog = page.getByRole('dialog', { name: 'Signaler cette publication' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Envoyer le signalement' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Choisissez le motif le plus proche.');
    await dialog.getByRole('radio', { name: /Conseil dangereux/ }).check();
    await dialog.getByLabel('Précisions (facultatif)').fill('Recommande de retirer la peau à la pince.');
    await expectNoSeriousA11y(page);
    await dialog.getByRole('button', { name: 'Envoyer le signalement' }).click();
    await expect(dialog.getByRole('status')).toContainText('Signalement envoyé');
    const reports = api.callsTo('POST', `/community/posts/${QUESTION_ID}/report`);
    expect(reports).toHaveLength(1);
    expect(reports[0].body).toEqual({ reason: 'DANGEROUS_ADVICE', details: 'Recommande de retirer la peau à la pince.' });
    await dialog.getByRole('button', { name: 'Fermer' }).first().click();
    await expect(dialog).toBeHidden();
  });

  test('publication photo : compression, envoi, animal lié (nom et espèce seulement)', async ({ page, api }) => {
    await signIn(page);
    seed(api);
    api.animals = [fixture<MockAnimal>('animal')];
    await page.goto('/communaute/nouvelle');
    await expect(page.getByRole('heading', { level: 1, name: 'Nouvelle publication' })).toBeVisible();

    // Photo obligatoire pour une publication photo.
    await page.getByRole('button', { name: 'Publier', exact: true }).click();
    await expect(page.getByText('Ajoutez au moins une photo')).toBeVisible();

    const photo = path.join(__dirname, '..', '..', 'public', 'images', 'animals', 'bearded-dragon-480.webp');
    await page.locator('input[type="file"]').setInputFiles(photo);
    await expect(page.getByRole('img', { name: 'Aperçu de la photo 1' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Légende' }).fill('Kaa a mué cette nuit.');
    await page.getByLabel('Montrer un de mes animaux').selectOption({ index: 1 });
    await expect(page.getByText('Son carnet de santé, ses soins et ses rendez-vous restent privés.')).toBeVisible();
    await expectNoSeriousA11y(page);

    await page.getByRole('button', { name: 'Publier', exact: true }).click();
    await expect(page).toHaveURL(/\/communaute\/publication\/10000000-/);
    await expect(page.getByText('Kaa a mué cette nuit.')).toBeVisible();

    const uploads = api.callsTo('POST', '/community/media');
    expect(uploads).toHaveLength(1);
    // Multipart, champ « file », photo ré-encodée en JPEG par le navigateur.
    expect(String(uploads[0].headers['content-type'])).toContain('multipart/form-data');
    expect(String(uploads[0].body)).toContain('name="file"; filename="photo.jpg"');
    expect(String(uploads[0].body)).toContain('Content-Type: image/jpeg');
    const created = api.callsTo('POST', '/community/posts')[0].body as Record<string, unknown>;
    expect(created).toMatchObject({ type: 'PHOTO', body: 'Kaa a mué cette nuit.', animalId: 'animal-e2e-1' });
    expect(created.mediaIds).toHaveLength(1);
  });

  test('photo HEIC illisible : refus clair, rien n’est envoyé', async ({ page, api }) => {
    await signIn(page);
    seed(api);
    await page.goto('/communaute/nouvelle');
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.alloc(64)]);
    await page.locator('input[type="file"]').setInputFiles({ name: 'IMG_4242.HEIC', mimeType: 'image/heic', buffer: heic });
    await expect(page.getByText(/IMG_4242\.HEIC : ce format HEIC ne peut pas être lu/)).toBeVisible();
    expect(api.callsTo('POST', '/community/media')).toHaveLength(0);
  });

  test('invité : lecture du fil, invitation à créer un compte pour publier', async ({ page, api }) => {
    await signInAsGuest(page);
    seed(api);
    await page.goto('/communaute');
    await expect(page.getByRole('heading', { level: 1, name: 'Communauté' })).toBeVisible();
    await expect(page.getByText('Un compte pour participer').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Créer mon compte' }).first()).toHaveAttribute('href', '/sauvegarder');
    // Pas de « j'aime » cliquable en invité.
    await expect(page.getByRole('button', { name: /J'aime/ })).toHaveCount(0);

    await page.goto('/communaute/nouvelle');
    await expect(page.getByText('Un compte pour participer')).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });

  test('sans session : invitation à créer un compte', async ({ page, api }) => {
    api.community.enabled = true;
    await page.goto('/communaute');
    await expect(page.getByRole('heading', { level: 1, name: 'Des passionnés vous attendent' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Créer un compte gratuit' })).toHaveAttribute('href', '/register');
  });

  test('profil public, profil communauté et règles : accessibles', async ({ page, api }) => {
    await signIn(page);
    seed(api);
    await page.goto('/communaute/u/gecko.lea');
    await expect(page.getByRole('heading', { level: 1, name: '@gecko.lea' })).toBeVisible();
    await expectNoSeriousA11y(page);
    await page.goto('/communaute/profil');
    await expect(page.getByRole('heading', { level: 1, name: 'Mon profil communauté' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Identité publique' })).toBeVisible();
    await expectNoSeriousA11y(page);
    await page.goto('/communaute/decisions');
    await expect(page.getByRole('heading', { level: 1, name: 'Décisions et signalements' })).toBeVisible();
    // « Mes signalements » : route absente (404) tolérée, la section n'apparaît pas.
    await expect.poll(() => api.callsTo('GET', '/community/me/reports').length).toBeGreaterThan(0);
    await expect(page.getByRole('heading', { name: 'Mes signalements' })).toHaveCount(0);
    // Route présente : statut et décision prise.
    api.community.reports = [
      {
        id: 'r1',
        targetType: 'POST',
        targetId: PHOTO_ID,
        reason: 'SPAM',
        status: 'ACTIONED',
        createdAt: '2026-10-01T09:00:00.000Z',
        resolvedAt: '2026-10-02T09:00:00.000Z',
        decision: { action: 'HIDE', contentRemoved: true, reason: 'SPAM', decidedAt: '2026-10-02T09:00:00.000Z' },
      },
    ];
    await page.reload();
    const reports = page.getByRole('region', { name: 'Mes signalements' });
    await expect(reports).toContainText('Mesure prise');
    await expect(reports).toContainText('Contenu retiré');
    await page.goto('/communaute/regles');
    await expect(page.getByRole('heading', { level: 1, name: 'Règles de la communauté' })).toBeVisible();
    await expectNoSeriousA11y(page);
  });

  test.describe('sombre', () => {
    test.use({ colorScheme: 'dark' });
    test('fil et détail (sombre) : aucune violation sérieuse', async ({ page, api }) => {
      await signIn(page);
      seed(api);
      await page.goto('/communaute');
      await expect(page.getByRole('list', { name: 'Publications récentes' }).getByRole('article')).toHaveCount(2);
      await expectNoSeriousA11y(page);
      await page.goto(`/communaute/publication/${PHOTO_ID}`);
      await expect(page.getByRole('heading', { level: 1, name: /@moka_le_chat/ })).toBeVisible();
      await expectNoSeriousA11y(page);
    });
  });
});
