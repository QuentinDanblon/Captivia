import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import sharpModule = require('sharp');
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import {
  AuthRateLimitGuard,
  RateLimitGuard,
} from '../src/common/guards/rate-limit.guard';
import { MailService } from '../src/mail/mail.service';
import { MaintenanceService } from '../src/maintenance/maintenance.service';
import { COMMUNITY_RULES_VERSION } from '../src/community/community.constants';

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any */
// (supertest renvoie des corps `any` ; fichier de test.)

jest.setTimeout(120000);

const sharp = sharpModule as unknown as typeof sharpModule.default;
const PASSWORD = 'CommunityTest123!';
const SPECIES_ID = 5221172; // gecko léopard (reptile)
const DAY_MS = 24 * 60 * 60 * 1000;
const GPS_LATITUDE = Buffer.from([
  48, 0, 0, 0, 1, 0, 0, 0, 51, 0, 0, 0, 1, 0, 0, 0,
]);
const SECRET = 'TOPSECRET-HEALTH';

interface Account {
  email: string;
  token: string;
  userId: string;
}

/** JPEG 2400 × 1200 avec EXIF (appareil + coordonnées GPS). */
function gpsJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 2400,
      height: 1200,
      channels: 3,
      background: { r: 30, g: 140, b: 60 },
    },
  })
    .jpeg()
    .withExif({
      IFD0: { Make: 'LeakyCam' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '48/1 51/1 2400/100',
        GPSLongitudeRef: 'E',
        GPSLongitude: '2/1 21/1 0/1',
      },
    })
    .toBuffer();
}

/**
 * Communauté (phase 1, backend) : activation, accès (invité / non vérifié), pseudo, médias
 * (signature, EXIF, redimensionnement), publications, commentaires, j'aime, signalements et seuil,
 * actions opérateur notifiées, recours, blocage, limites, liens, RGPD (export, suppression,
 * orphelins) et absence de fuite (e-mail, carnet de santé).
 */
describe('Communauté (E2E)', () => {
  let app: INestApplication;
  let url: string;
  let prisma: PrismaService;
  let send: jest.SpyInstance;
  let mediaDir: string;
  const prevEnv = { ...process.env };
  const tag = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const emails: string[] = [];
  const guestIds: string[] = [];
  const bearer = (a: { token: string }) => ({
    Authorization: `Bearer ${a.token}`,
  });
  const http = () => request(url);
  const handle = (name: string) =>
    `${name}_${tag.replace(/\D/g, '').slice(-6)}`;

  let alice: Account; // membre ancien (> 7 jours), autrice
  let bob: Account; // membre récent
  let carol: Account; // membre ancien
  let unverified: Account;
  let operator: Account;
  let guest: { token: string; userId: string };

  async function register(name: string): Promise<Account> {
    const email = `community-${name}-${tag}@captivia.local`;
    const res = await http()
      .post('/auth/register')
      .send({
        email,
        password: PASSWORD,
        locale: 'fr',
        acceptTerms: true,
        ageConfirmed: true,
      })
      .expect(201);
    emails.push(email);
    return { email, token: res.body.accessToken, userId: res.body.user.id };
  }

  async function verified(name: string, ageDays = 30): Promise<Account> {
    const a = await register(name);
    await prisma.user.update({
      where: { id: a.userId },
      data: {
        emailVerifiedAt: new Date(),
        createdAt: new Date(Date.now() - ageDays * DAY_MS),
      },
    });
    return a;
  }

  function activate(a: Account, h: string) {
    return http().post('/community/profile').set(bearer(a)).send({
      handle: h,
      acceptRules: true,
      rulesVersion: COMMUNITY_RULES_VERSION,
    });
  }

  function upload(
    a: Account,
    data: Buffer,
    filename = 'photo.jpg',
    type = 'image/jpeg',
  ) {
    return http()
      .post('/community/media')
      .set(bearer(a))
      .attach('file', data, { filename, contentType: type });
  }

  async function photoPost(a: Account, body = 'Mon gecko au soleil') {
    const media = await upload(a, await gpsJpeg()).expect(201);
    const res = await http()
      .post('/community/posts')
      .set(bearer(a))
      .send({
        type: 'PHOTO',
        body,
        mediaIds: [media.body.id],
        speciesCategory: 'REPTILE',
      })
      .expect(201);
    return res.body;
  }

  function mailsTo(email: string, subject?: RegExp) {
    return send.mock.calls
      .map((c) => c[0] as { to: string; subject: string; text: string })
      .filter((m) => m.to === email && (!subject || subject.test(m.subject)));
  }

  function keyOf(mediaUrl: string): string {
    return mediaUrl.split('/').pop()!;
  }

  beforeAll(async () => {
    mediaDir = mkdtempSync(path.join(tmpdir(), 'captivia-community-e2e-'));
    process.env.MEDIA_LOCAL_DIR = mediaDir;
    process.env.MEDIA_DRIVER = 'local';
    delete process.env.MEDIA_PUBLIC_BASE_URL;
    process.env.COMMUNITY_ENABLED = 'true';
    process.env.COMMUNITY_POSTS_PER_HOUR = '1000';
    process.env.COMMUNITY_COMMENTS_PER_MINUTE = '1000';
    process.env.COMMUNITY_UPLOADS_PER_HOUR = '1000';
    process.env.COMMUNITY_HIDE_THRESHOLD = '2';
    process.env.COMMUNITY_CONTACT_EMAIL = 'moderation@captivia.example';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideGuard(AuthRateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        exceptionFactory: (errors) =>
          new BadRequestException(
            `Validation failed: ${errors.map((e) => Object.values(e.constraints || {}).join(', ')).join('; ')}`,
          ),
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
    prisma = app.get(PrismaService);
    send = jest
      .spyOn(app.get(MailService), 'send')
      .mockResolvedValue({ sent: true, simulated: true, attempts: 1 });

    alice = await verified('alice');
    bob = await verified('bob', 1);
    carol = await verified('carol');
    unverified = await register('unverified');
    operator = await verified('operator');
    await prisma.user.update({
      where: { id: operator.userId },
      data: { role: 'OPERATOR' },
    });
    const g = await http().post('/auth/guest').send({}).expect(201);
    guest = { token: g.body.accessToken, userId: g.body.user.id };
    guestIds.push(guest.userId);
  });

  afterAll(async () => {
    process.env = { ...prevEnv };
    if (prisma) {
      await prisma.user.deleteMany({
        where: { OR: [{ email: { in: emails } }, { id: { in: guestIds } }] },
      });
    }
    if (app) await app.close();
    rmSync(mediaDir, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------------------
  describe('activation (COMMUNITY_ENABLED)', () => {
    it('désactivé : chaque route répond 404, même sans session', async () => {
      process.env.COMMUNITY_ENABLED = 'false';
      try {
        await http().get('/community/posts').expect(404);
        await http().get('/community/posts').set(bearer(alice)).expect(404);
        await http()
          .post('/community/profile')
          .set(bearer(alice))
          .send({})
          .expect(404);
        await http().post('/community/media').set(bearer(alice)).expect(404);
        await http()
          .get('/community/moderation/queue')
          .set(bearer(operator))
          .expect(404);
        await http()
          .get('/community/media/3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d.webp')
          .expect(404);
      } finally {
        process.env.COMMUNITY_ENABLED = 'true';
      }
      await http().get('/community/posts').expect(401);
    });
  });

  // ---------------------------------------------------------------------------
  describe('accès et profil', () => {
    it('invité : lecture permise, activation refusée (403 GUEST_ACCOUNT)', async () => {
      await http().get('/community/posts').set(bearer(guest)).expect(200);
      const res = await activate(guest as Account, handle('guesty')).expect(
        403,
      );
      expect(res.body.code).toBe('GUEST_ACCOUNT');
      const me = await http()
        .get('/community/profile')
        .set(bearer(guest))
        .expect(200);
      expect(me.body.canPublish).toBe(false);
      expect(me.body.reasons).toContain('GUEST_ACCOUNT');
    });

    it('compte non vérifié : 403 EMAIL_NOT_VERIFIED (activation, publication, upload)', async () => {
      expect(
        (await activate(unverified, handle('unv')).expect(403)).body.code,
      ).toBe('EMAIL_NOT_VERIFIED');
      const post = await http()
        .post('/community/posts')
        .set(bearer(unverified))
        .send({ type: 'QUESTION', body: 'Bonjour ?' })
        .expect(403);
      expect(post.body.code).toBe('EMAIL_NOT_VERIFIED');
      const up = await upload(unverified, await gpsJpeg()).expect(403);
      expect(up.body.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('vérifié sans profil : 403 COMMUNITY_PROFILE_REQUIRED', async () => {
      const res = await http()
        .post('/community/posts')
        .set(bearer(alice))
        .send({ type: 'QUESTION', body: 'Bonjour ?' })
        .expect(403);
      expect(res.body.code).toBe('COMMUNITY_PROFILE_REQUIRED');
    });

    it('activation explicite : règles versionnées obligatoires', async () => {
      await http()
        .post('/community/profile')
        .set(bearer(alice))
        .send({
          handle: handle('alice'),
          acceptRules: false,
          rulesVersion: COMMUNITY_RULES_VERSION,
        })
        .expect(400);
      const wrong = await http()
        .post('/community/profile')
        .set(bearer(alice))
        .send({
          handle: handle('alice'),
          acceptRules: true,
          rulesVersion: '1999-01',
        })
        .expect(400);
      expect(wrong.body.code).toBe('COMMUNITY_RULES_VERSION_MISMATCH');

      const ok = await activate(alice, handle('Alice')).expect(201);
      expect(ok.body).toMatchObject({
        handle: handle('Alice'),
        avatarUrl: null,
        rulesVersion: COMMUNITY_RULES_VERSION,
      });
      expect(ok.body).not.toHaveProperty('email');
      expect(
        (await activate(alice, handle('other')).expect(409)).body.code,
      ).toBe('COMMUNITY_PROFILE_EXISTS');
      const me = await http()
        .get('/community/profile')
        .set(bearer(alice))
        .expect(200);
      expect(me.body).toMatchObject({
        canPublish: true,
        reasons: [],
        ageConfirmationRequired: false,
      });
    });

    it('pseudo unique (insensible à la casse), format et mots réservés', async () => {
      const taken = await activate(bob, handle('alice')).expect(409);
      expect(taken.body.code).toBe('HANDLE_TAKEN');
      expect((await activate(bob, 'Captivia_Team').expect(400)).body.code).toBe(
        'HANDLE_RESERVED',
      );
      expect((await activate(bob, 'a b').expect(400)).body.code).toBe(
        'HANDLE_INVALID',
      );
      expect((await activate(bob, 'x').expect(400)).body.code).toBe(
        'HANDLE_INVALID',
      );
      await activate(bob, handle('bob')).expect(201);
      await activate(carol, handle('carol')).expect(201);
      await activate(operator, handle('opsteam')).expect(201);
    });

    it('âge minimal : un compte sans case d’âge enregistrée doit la confirmer', async () => {
      const legacy = await verified('legacy');
      await prisma.user.update({
        where: { id: legacy.userId },
        data: { termsAcceptedAt: null, termsVersion: null },
      });
      const me = await http()
        .get('/community/profile')
        .set(bearer(legacy))
        .expect(200);
      expect(me.body.ageConfirmationRequired).toBe(true);
      const res = await activate(legacy, handle('legacy')).expect(403);
      expect(res.body.code).toBe('AGE_CONFIRMATION_REQUIRED');
      await http()
        .post('/community/profile')
        .set(bearer(legacy))
        .send({
          handle: handle('legacy'),
          acceptRules: true,
          rulesVersion: COMMUNITY_RULES_VERSION,
          ageConfirmed: true,
        })
        .expect(201);
    });

    it('profil public : pseudo et avatar, jamais l’e-mail ni l’identifiant', async () => {
      const res = await http()
        .get(`/community/users/${handle('alice').toUpperCase()}`)
        .set(bearer(carol))
        .expect(200);
      expect(res.body).toEqual({
        handle: handle('Alice'),
        avatarUrl: null,
        memberSince: expect.any(String),
        postCount: 0,
        isMe: false,
      });
      expect(JSON.stringify(res.body)).not.toContain(alice.email);
      expect(JSON.stringify(res.body)).not.toContain(alice.userId);
    });
  });

  // ---------------------------------------------------------------------------
  describe('médias', () => {
    it('rejette un faux PNG (signature) en 415', async () => {
      const res = await upload(
        alice,
        Buffer.from('<html><body>not an image</body></html>'),
        'evil.png',
        'image/png',
      ).expect(415);
      expect(res.body.code).toBe('MEDIA_UNSUPPORTED_TYPE');
    });

    it('rejette une image trop lourde en 413 (MEDIA_MAX_BYTES)', async () => {
      process.env.MEDIA_MAX_BYTES = '2048';
      try {
        const res = await upload(alice, await gpsJpeg()).expect(413);
        expect(res.body.code).toBe('MEDIA_TOO_LARGE');
      } finally {
        delete process.env.MEDIA_MAX_BYTES;
      }
    });

    it('sans fichier : 400 ; sans profil : 403', async () => {
      await http().post('/community/media').set(bearer(alice)).expect(400);
      const res = await upload(unverified, await gpsJpeg()).expect(403);
      expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('redimensionne à 1 600 px, ré-encode en WebP et supprime EXIF et GPS', async () => {
      const input = await gpsJpeg();
      expect((await sharp(input).metadata()).exif).toBeDefined();
      const res = await upload(alice, input).expect(201);
      expect(res.body).toMatchObject({ width: 1600, height: 800 });
      expect(res.body.url).toMatch(/\/community\/media\/[0-9a-f-]{36}\.webp$/);

      const file = await http()
        .get(`/community/media/${keyOf(res.body.url)}`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(file.headers['content-type']).toBe('image/webp');
      expect(file.headers['cross-origin-resource-policy']).toBe('cross-origin');
      const data = file.body as Buffer;
      const meta = await sharp(data).metadata();
      expect(meta).toMatchObject({ format: 'webp', width: 1600, height: 800 });
      expect(meta.exif).toBeUndefined();
      expect(data.includes('LeakyCam')).toBe(false);
      expect(data.includes(GPS_LATITUDE)).toBe(false);
      expect(data.includes('EXIF')).toBe(false);
    });

    it('clé invalide ou inconnue : 404', async () => {
      await http().get('/community/media/..%2F..%2Fetc%2Fpasswd').expect(404);
      await http()
        .get('/community/media/3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d.webp')
        .expect(404);
    });

    it('avatar : un média téléversé, l’ancien est effacé au remplacement', async () => {
      const first = await upload(bob, await gpsJpeg()).expect(201);
      const p1 = await http()
        .patch('/community/profile')
        .set(bearer(bob))
        .send({ avatarMediaId: first.body.id })
        .expect(200);
      expect(p1.body.avatarUrl).toBe(first.body.url);
      const second = await upload(bob, await gpsJpeg()).expect(201);
      await http()
        .patch('/community/profile')
        .set(bearer(bob))
        .send({ avatarMediaId: second.body.id })
        .expect(200);
      expect(existsSync(path.join(mediaDir, keyOf(first.body.url)))).toBe(
        false,
      );
      expect(existsSync(path.join(mediaDir, keyOf(second.body.url)))).toBe(
        true,
      );
      // Le média d'un autre compte ne peut pas servir d'avatar.
      const foreign = await upload(alice, await gpsJpeg()).expect(201);
      await http()
        .patch('/community/profile')
        .set(bearer(bob))
        .send({ avatarMediaId: foreign.body.id })
        .expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  describe('publications, commentaires, j’aime', () => {
    let photo: any;
    let question: any;
    let animalId: string;

    it('PHOTO : 1 à 4 images, déjà téléversées par l’auteur', async () => {
      const none = await http()
        .post('/community/posts')
        .set(bearer(alice))
        .send({ type: 'PHOTO', body: 'Sans image' })
        .expect(400);
      expect(none.body.code).toBe('COMMUNITY_INVALID_MEDIA');
      const foreign = await upload(bob, await gpsJpeg()).expect(201);
      await http()
        .post('/community/posts')
        .set(bearer(alice))
        .send({ type: 'PHOTO', mediaIds: [foreign.body.id] })
        .expect(400);

      photo = await photoPost(alice);
      expect(photo).toMatchObject({
        type: 'PHOTO',
        status: 'VISIBLE',
        speciesCategory: 'REPTILE',
        author: { handle: handle('Alice'), avatarUrl: null },
        likeCount: 0,
        commentCount: 0,
        isMine: true,
        animal: null,
      });
      expect(photo.media).toHaveLength(1);
      // Une image ne sert qu'une fois.
      await http()
        .post('/community/posts')
        .set(bearer(alice))
        .send({ type: 'PHOTO', mediaIds: [photo.media[0].id] })
        .expect(400);
    });

    it('QUESTION : texte obligatoire, 2 000 caractères au plus', async () => {
      expect(
        (
          await http()
            .post('/community/posts')
            .set(bearer(alice))
            .send({ type: 'QUESTION', body: '   ' })
            .expect(400)
        ).body.code,
      ).toBe('COMMUNITY_BODY_REQUIRED');
      await http()
        .post('/community/posts')
        .set(bearer(alice))
        .send({ type: 'QUESTION', body: 'x'.repeat(2001) })
        .expect(400);
      await http()
        .post('/community/posts')
        .set(bearer(alice))
        .send({ type: 'QUESTION', body: 'Q', speciesCategory: 'DRAGON' })
        .expect(400);
    });

    it('animal lié : nom et espèce seulement, jamais le carnet de santé', async () => {
      const animal = await http()
        .post('/users/me/animals')
        .set(bearer(alice))
        .send({
          speciesId: SPECIES_ID,
          name: 'Pixel',
          notes: `${SECRET} notes`,
        })
        .expect(201);
      animalId = animal.body.id;
      await prisma.animalHealthRecord.create({
        data: {
          animalId,
          type: 'surgery',
          title: `${SECRET} chirurgie`,
          date: new Date(),
        },
      });
      await prisma.vaccination.create({
        data: {
          animalId,
          name: `${SECRET} vaccin`,
          date: new Date(),
          vetName: `${SECRET} vet`,
        },
      });
      await prisma.medication.create({
        data: {
          animalId,
          name: `${SECRET} médicament`,
          dose: '1',
          frequency: 'daily',
          startDate: new Date(),
        },
      });
      const res = await http()
        .post('/community/posts')
        .set(bearer(alice))
        .send({ type: 'QUESTION', body: 'Pixel mue mal, une idée ?', animalId })
        .expect(201);
      question = res.body;
      expect(question.animal).toEqual({
        name: 'Pixel',
        species: expect.any(String),
        scientificName: expect.any(String),
      });
      expect(question.speciesCategory).toBe('REPTILE'); // déduite de l'espèce
      expect(JSON.stringify(question)).not.toContain(SECRET);

      // L'animal d'un autre compte : 404.
      await http()
        .post('/community/posts')
        .set(bearer(bob))
        .send({ type: 'QUESTION', body: 'Le sien ?', animalId })
        .expect(404);
    });

    it('fils : récent, par catégorie, par type, par utilisateur, curseur', async () => {
      const feed = await http()
        .get('/community/posts?limit=50')
        .set(bearer(carol))
        .expect(200);
      const ids = feed.body.items.map((p: any) => p.id);
      expect(ids).toEqual(expect.arrayContaining([photo.id, question.id]));
      expect(ids.indexOf(question.id)).toBeLessThan(ids.indexOf(photo.id)); // plus récent d'abord

      const fish = await http()
        .get('/community/posts?category=FISH')
        .set(bearer(carol))
        .expect(200);
      expect(fish.body.items.map((p: any) => p.id)).not.toContain(photo.id);
      const questions = await http()
        .get('/community/posts?type=QUESTION&limit=50')
        .set(bearer(carol))
        .expect(200);
      expect(
        questions.body.items.every((p: any) => p.type === 'QUESTION'),
      ).toBe(true);

      const p1 = await http()
        .get(`/community/users/${handle('alice')}/posts?limit=1`)
        .set(bearer(carol))
        .expect(200);
      expect(p1.body.items).toHaveLength(1);
      expect(p1.body.nextCursor).toEqual(expect.any(String));
      const p2 = await http()
        .get(
          `/community/users/${handle('alice')}/posts?limit=1&cursor=${p1.body.nextCursor}`,
        )
        .set(bearer(carol))
        .expect(200);
      expect(p2.body.items[0].id).not.toBe(p1.body.items[0].id);
      await http()
        .get('/community/posts?cursor=garbage')
        .set(bearer(carol))
        .expect(400);
    });

    it('commentaires : un niveau de réponse ; « réponse utile » réservée à l’auteur de la question', async () => {
      const c1 = await http()
        .post(`/community/posts/${question.id}/comments`)
        .set(bearer(bob))
        .send({ body: 'Augmente l’hygrométrie.' })
        .expect(201);
      const reply = await http()
        .post(`/community/posts/${question.id}/comments`)
        .set(bearer(carol))
        .send({ body: 'Oui, et une boîte de mue.', parentId: c1.body.id })
        .expect(201);
      const nested = await http()
        .post(`/community/posts/${question.id}/comments`)
        .set(bearer(alice))
        .send({ body: 'Trop profond', parentId: reply.body.id })
        .expect(400);
      expect(nested.body.code).toBe('COMMUNITY_INVALID_PARENT');
      await http()
        .post(`/community/posts/${question.id}/comments`)
        .set(bearer(bob))
        .send({ body: 'x'.repeat(1001) })
        .expect(400);

      const notAuthor = await http()
        .put(`/community/comments/${c1.body.id}/helpful`)
        .set(bearer(bob))
        .expect(403);
      expect(notAuthor.body.code).toBe('COMMUNITY_NOT_POST_AUTHOR');
      await http()
        .put(`/community/comments/${c1.body.id}/helpful`)
        .set(bearer(alice))
        .expect(200);

      const detail = await http()
        .get(`/community/posts/${question.id}`)
        .set(bearer(carol))
        .expect(200);
      expect(detail.body.helpfulCommentId).toBe(c1.body.id);
      expect(detail.body.commentCount).toBe(2);
      expect(detail.body.comments.items).toHaveLength(1);
      expect(detail.body.comments.items[0]).toMatchObject({
        id: c1.body.id,
        isHelpful: true,
        author: { handle: handle('bob') },
        replies: [{ id: reply.body.id, parentId: c1.body.id }],
      });
      // Une photo n'a pas de réponse utile.
      const onPhoto = await http()
        .post(`/community/posts/${photo.id}/comments`)
        .set(bearer(bob))
        .send({ body: 'Superbe' })
        .expect(201);
      expect(
        (
          await http()
            .put(`/community/comments/${onPhoto.body.id}/helpful`)
            .set(bearer(alice))
            .expect(400)
        ).body.code,
      ).toBe('COMMUNITY_NOT_A_QUESTION');
    });

    it('j’aime idempotent', async () => {
      const a = await http()
        .put(`/community/posts/${photo.id}/like`)
        .set(bearer(bob))
        .expect(200);
      const b = await http()
        .put(`/community/posts/${photo.id}/like`)
        .set(bearer(bob))
        .expect(200);
      expect(a.body).toEqual({ liked: true, likeCount: 1 });
      expect(b.body).toEqual({ liked: true, likeCount: 1 });
      await http()
        .put(`/community/posts/${photo.id}/like`)
        .set(bearer(carol))
        .expect(200);
      const seen = await http()
        .get(`/community/posts/${photo.id}`)
        .set(bearer(bob))
        .expect(200);
      expect(seen.body).toMatchObject({ likeCount: 2, likedByMe: true });
      await http()
        .delete(`/community/posts/${photo.id}/like`)
        .set(bearer(bob))
        .expect(200);
      const c = await http()
        .delete(`/community/posts/${photo.id}/like`)
        .set(bearer(bob))
        .expect(200);
      expect(c.body).toEqual({ liked: false, likeCount: 1 });
      // Un invité ne peut pas aimer (compte requis).
      expect(
        (
          await http()
            .put(`/community/posts/${photo.id}/like`)
            .set(bearer(guest))
            .expect(403)
        ).body.code,
      ).toBe('GUEST_ACCOUNT');
    });

    it('aucune fuite d’e-mail ni de donnée de santé dans les réponses publiques', async () => {
      const bodies = [
        (
          await http()
            .get('/community/posts?limit=50')
            .set(bearer(carol))
            .expect(200)
        ).body,
        (
          await http()
            .get(`/community/posts/${question.id}`)
            .set(bearer(carol))
            .expect(200)
        ).body,
        (
          await http()
            .get(`/community/users/${handle('bob')}`)
            .set(bearer(carol))
            .expect(200)
        ).body,
        (
          await http()
            .get(`/community/users/${handle('alice')}/posts`)
            .set(bearer(carol))
            .expect(200)
        ).body,
      ];
      const all = JSON.stringify(bodies);
      for (const a of [alice, bob, carol]) {
        expect(all).not.toContain(a.email);
        expect(all).not.toContain(a.userId);
      }
      expect(all).not.toContain(SECRET);
      expect(all).not.toMatch(
        /"(email|passwordHash|notes|healthRecords|vaccinations|medications)"/,
      );
    });

    it('suppression par l’auteur : publication et fichiers', async () => {
      const post = await photoPost(alice, 'À supprimer');
      const file = path.join(mediaDir, keyOf(post.media[0].url));
      expect(existsSync(file)).toBe(true);
      await http()
        .delete(`/community/posts/${post.id}`)
        .set(bearer(bob))
        .expect(404);
      await http()
        .delete(`/community/posts/${post.id}`)
        .set(bearer(alice))
        .expect(204);
      expect(existsSync(file)).toBe(false);
      expect(
        await prisma.communityMedia.count({
          where: { key: keyOf(post.media[0].url) },
        }),
      ).toBe(0);
      await http()
        .get(`/community/posts/${post.id}`)
        .set(bearer(alice))
        .expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  describe('anti-abus', () => {
    it('limite de publications par heure (429 COMMUNITY_RATE_LIMITED)', async () => {
      const recent = await prisma.communityPost.count({
        where: {
          authorId: carol.userId,
          createdAt: { gt: new Date(Date.now() - 3600_000) },
        },
      });
      process.env.COMMUNITY_POSTS_PER_HOUR = String(recent + 1);
      try {
        await http()
          .post('/community/posts')
          .set(bearer(carol))
          .send({ type: 'QUESTION', body: 'Première' })
          .expect(201);
        const res = await http()
          .post('/community/posts')
          .set(bearer(carol))
          .send({ type: 'QUESTION', body: 'Deuxième' })
          .expect(429);
        expect(res.body.code).toBe('COMMUNITY_RATE_LIMITED');
      } finally {
        process.env.COMMUNITY_POSTS_PER_HOUR = '1000';
      }
    });

    it('limite de commentaires par minute', async () => {
      const target = await http()
        .post('/community/posts')
        .set(bearer(alice))
        .send({ type: 'QUESTION', body: 'Combien de grillons ?' })
        .expect(201);
      process.env.COMMUNITY_COMMENTS_PER_MINUTE = '2';
      const dave = await verified('dave');
      await activate(dave, handle('dave')).expect(201);
      try {
        for (const body of ['Trois', 'Quatre']) {
          await http()
            .post(`/community/posts/${target.body.id}/comments`)
            .set(bearer(dave))
            .send({ body })
            .expect(201);
        }
        const res = await http()
          .post(`/community/posts/${target.body.id}/comments`)
          .set(bearer(dave))
          .send({ body: 'Cinq' })
          .expect(429);
        expect(res.body.code).toBe('COMMUNITY_RATE_LIMITED');
      } finally {
        process.env.COMMUNITY_COMMENTS_PER_MINUTE = '1000';
      }
    });

    it('liens refusés aux comptes de moins de 7 jours, acceptés ensuite', async () => {
      const res = await http()
        .post('/community/posts')
        .set(bearer(bob))
        .send({
          type: 'QUESTION',
          body: 'Promo sur www.reptiles-discount.com !',
        })
        .expect(400);
      expect(res.body.code).toBe('COMMUNITY_LINKS_NOT_ALLOWED');
      const target = await http()
        .post('/community/posts')
        .set(bearer(alice))
        .send({
          type: 'QUESTION',
          body: 'Une fiche fiable sur https://example.org/gecko ?',
        })
        .expect(201);
      const comment = await http()
        .post(`/community/posts/${target.body.id}/comments`)
        .set(bearer(bob))
        .send({ body: 'Voir https://spam.example' })
        .expect(400);
      expect(comment.body.code).toBe('COMMUNITY_LINKS_NOT_ALLOWED');
    });
  });

  // ---------------------------------------------------------------------------
  describe('signalements, masquage automatique, modération', () => {
    let post: any;
    let decisionId: string;

    it('signalement : motif fermé, un par compte, pas sur son propre contenu', async () => {
      post = await photoPost(alice, 'Contenu litigieux');
      await http()
        .post(`/community/posts/${post.id}/report`)
        .set(bearer(bob))
        .send({ reason: 'INSULTS' })
        .expect(400);
      const first = await http()
        .post(`/community/posts/${post.id}/report`)
        .set(bearer(bob))
        .send({ reason: 'SPAM', details: 'Publicité' })
        .expect(200);
      expect(first.body).toEqual({ reported: true, alreadyReported: false });
      const again = await http()
        .post(`/community/posts/${post.id}/report`)
        .set(bearer(bob))
        .send({ reason: 'HATE' })
        .expect(200);
      expect(again.body.alreadyReported).toBe(true);
      const own = await http()
        .post(`/community/posts/${post.id}/report`)
        .set(bearer(alice))
        .send({ reason: 'SPAM' })
        .expect(400);
      expect(own.body.code).toBe('COMMUNITY_CANNOT_REPORT_OWN');
      // Toujours visible : un seul signalement distinct (seuil 2).
      await http()
        .get(`/community/posts/${post.id}`)
        .set(bearer(carol))
        .expect(200);
    });

    it('seuil de signalements distincts atteint : masquage automatique notifié', async () => {
      send.mockClear();
      // N'importe quel compte connecté peut signaler, y compris un invité…
      await http()
        .post(`/community/posts/${post.id}/report`)
        .set(bearer(guest))
        .send({ reason: 'SPAM' })
        .expect(200);
      // … mais ni l'invité ni bob (compte d'un jour) ne comptent dans le seuil : toujours visible,
      // en file opérateur.
      await http()
        .get(`/community/posts/${post.id}`)
        .set(bearer(carol))
        .expect(200);
      expect(mailsTo(alice.email, /modération/)).toHaveLength(0);
      // Deux membres établis (seuil 2) : masquage automatique.
      for (const reporter of [carol, operator]) {
        await http()
          .post(`/community/posts/${post.id}/report`)
          .set(bearer(reporter))
          .send({ reason: 'SPAM' })
          .expect(200);
      }
      await http()
        .get(`/community/posts/${post.id}`)
        .set(bearer(carol))
        .expect(404);
      const feed = await http()
        .get('/community/posts?limit=50')
        .set(bearer(carol))
        .expect(200);
      expect(feed.body.items.map((p: any) => p.id)).not.toContain(post.id);
      const own = await http()
        .get(`/community/posts/${post.id}`)
        .set(bearer(alice))
        .expect(200);
      expect(own.body.status).toBe('HIDDEN_AUTO');

      const mails = mailsTo(alice.email, /modération/);
      expect(mails).toHaveLength(1);
      expect(mails[0].text).toContain('masqué(e) automatiquement');
      expect(mails[0].text).toContain('Motif : Spam ou publicité');
      expect(mails[0].text).toContain('moyen automatisé');
      expect(mails[0].text).toContain(
        'Point de contact : moderation@captivia.example',
      );
      // Lien vers la page frontend de la décision (français : pas de préfixe de locale).
      expect(mails[0].text).toMatch(
        /http:\/\/[^/\s]+\/communaute\/decisions\/[0-9a-f-]{36}/,
      );

      const decisions = await http()
        .get('/community/me/decisions')
        .set(bearer(alice))
        .expect(200);
      const auto = decisions.body.items.find(
        (d: any) => d.targetId === post.id,
      );
      expect(auto).toMatchObject({
        action: 'AUTO_HIDE',
        automated: true,
        reason: 'SPAM',
        canAppeal: true,
        appealStatus: 'NONE',
      });
      expect(auto).not.toHaveProperty('operatorId');
      decisionId = auto.id;
      const log = await prisma.communityModerationAction.findUnique({
        where: { id: decisionId },
      });
      expect(log).toMatchObject({
        automated: true,
        operatorId: null,
        // Tous les signalements ouverts (4), dont 2 de membres établis (seuil).
        reportCount: 4,
      });
      expect(log!.notifiedAt).not.toBeNull();
    });

    it('recours de l’auteur (une fois)', async () => {
      await http()
        .post(`/community/me/decisions/${decisionId}/appeal`)
        .set(bearer(alice))
        .send({ text: 'court' })
        .expect(400);
      await http()
        .post(`/community/me/decisions/${decisionId}/appeal`)
        .set(bearer(bob))
        .send({ text: 'Ce n’est pas ma décision mais je tente.' })
        .expect(404);
      const res = await http()
        .post(`/community/me/decisions/${decisionId}/appeal`)
        .set(bearer(alice))
        .send({ text: 'Ce n’est pas une publicité, c’est mon gecko.' })
        .expect(201);
      expect(res.body).toMatchObject({
        appealStatus: 'PENDING',
        canAppeal: false,
      });
      const twice = await http()
        .post(`/community/me/decisions/${decisionId}/appeal`)
        .set(bearer(alice))
        .send({ text: 'Encore une fois, merci de revoir.' })
        .expect(400);
      expect(twice.body.code).toBe('COMMUNITY_APPEAL_NOT_ALLOWED');
    });

    it('file de modération réservée aux opérateurs', async () => {
      await http()
        .get('/community/moderation/queue')
        .set(bearer(alice))
        .expect(403);
      await http()
        .get('/community/moderation/queue')
        .set(bearer(guest))
        .expect(403);
      const queue = await http()
        .get('/community/moderation/queue')
        .set(bearer(operator))
        .expect(200);
      const item = queue.body.items.find((i: any) => i.targetId === post.id);
      expect(item).toMatchObject({
        targetType: 'POST',
        status: 'HIDDEN_AUTO',
        openReports: 4,
        reasons: { SPAM: 4 },
        authorHandle: handle('Alice'),
      });
      expect(JSON.stringify(queue.body)).not.toContain(alice.email);
      const hidden = await http()
        .get('/community/moderation/hidden')
        .set(bearer(operator))
        .expect(200);
      expect(hidden.body.items.map((i: any) => i.targetId)).toContain(post.id);
      const appeals = await http()
        .get('/community/moderation/appeals')
        .set(bearer(operator))
        .expect(200);
      expect(appeals.body.items.map((a: any) => a.id)).toContain(decisionId);
    });

    it('recours accueilli : contenu rétabli, auteur notifié', async () => {
      send.mockClear();
      await http()
        .post(`/community/moderation/appeals/${decisionId}/resolve`)
        .set(bearer(operator))
        .send({
          outcome: 'MAYBE',
          statement: 'Examen effectué par un modérateur.',
        })
        .expect(400);
      const res = await http()
        .post(`/community/moderation/appeals/${decisionId}/resolve`)
        .set(bearer(operator))
        .send({
          outcome: 'REVERSED',
          statement: 'Photo d’animal conforme aux règles.',
        })
        .expect(200);
      expect(res.body.appealStatus).toBe('REVERSED');
      await http()
        .get(`/community/posts/${post.id}`)
        .set(bearer(carol))
        .expect(200);
      const mails = mailsTo(alice.email, /recours/);
      expect(mails).toHaveLength(1);
      expect(mails[0].text).toContain('la décision est annulée');
      // Rétabli par un humain : de nouveaux signalements ne le masquent plus automatiquement.
      const reviewed = await prisma.communityPost.findUnique({
        where: { id: post.id },
      });
      expect(reviewed!.reviewedAt).not.toBeNull();
    });

    it('masquer / rétablir / supprimer : motif obligatoire, auteur notifié, journal', async () => {
      send.mockClear();
      const missing = await http()
        .post(`/community/moderation/posts/${post.id}/hide`)
        .set(bearer(operator))
        .send({ reason: 'HATE' })
        .expect(400);
      expect(missing.body.message).toContain('statement');
      await http()
        .post(`/community/moderation/posts/${post.id}/hide`)
        .set(bearer(operator))
        .send({ reason: 'HATE', statement: 'Propos haineux dans la légende.' })
        .expect(200);
      await http()
        .get(`/community/posts/${post.id}`)
        .set(bearer(carol))
        .expect(404);
      let mails = mailsTo(alice.email, /modération/);
      expect(mails).toHaveLength(1);
      expect(mails[0].text).toContain('Motif : Discours haineux');
      expect(mails[0].text).toContain(
        'Explication : Propos haineux dans la légende.',
      );
      expect(mails[0].text).toContain('contester cette décision');

      await http()
        .post(`/community/moderation/posts/${post.id}/restore`)
        .set(bearer(operator))
        .send({ statement: 'Erreur de modération, contenu rétabli.' })
        .expect(200);
      await http()
        .get(`/community/posts/${post.id}`)
        .set(bearer(carol))
        .expect(200);
      expect(mailsTo(alice.email, /modération/)).toHaveLength(2);

      // Commentaire : suppression motivée.
      const comment = await http()
        .post(`/community/posts/${post.id}/comments`)
        .set(bearer(bob))
        .send({ body: 'Commentaire déplacé' })
        .expect(201);
      await http()
        .post(`/community/moderation/comments/${comment.body.id}/delete`)
        .set(bearer(operator))
        .send({
          reason: 'HARASSMENT',
          statement: 'Commentaire insultant envers un membre.',
        })
        .expect(200);
      expect(
        await prisma.communityComment.count({ where: { id: comment.body.id } }),
      ).toBe(0);
      mails = mailsTo(bob.email, /modération/);
      expect(mails.at(-1)!.text).toContain(
        'Votre commentaire a été supprimé(e)',
      );

      // Publication : suppression avec ses fichiers.
      const file = path.join(mediaDir, keyOf(post.media[0].url));
      expect(existsSync(file)).toBe(true);
      await http()
        .post(`/community/moderation/posts/${post.id}/delete`)
        .set(bearer(operator))
        .send({
          reason: 'SPAM',
          statement: 'Publicité répétée après avertissement.',
        })
        .expect(200);
      expect(existsSync(file)).toBe(false);
      await http()
        .post(`/community/moderation/unknown/${post.id}/delete`)
        .set(bearer(operator))
        .send({
          reason: 'SPAM',
          statement: 'Publicité répétée après avertissement.',
        })
        .expect(404);

      const log = await http()
        .get('/community/moderation/log?limit=50')
        .set(bearer(operator))
        .expect(200);
      const actions = log.body.items
        .filter((a: any) => a.targetId === post.id)
        .map((a: any) => a.action);
      expect(actions).toEqual(
        expect.arrayContaining(['AUTO_HIDE', 'RESTORE', 'HIDE', 'DELETE']),
      );
    });

    it('classement sans suite : signalements clos, plus de masquage automatique', async () => {
      const target = await photoPost(carol, 'Mon python');
      await http()
        .post(`/community/posts/${target.id}/report`)
        .set(bearer(bob))
        .send({ reason: 'OTHER' })
        .expect(200);
      await http()
        .post(`/community/moderation/posts/${target.id}/dismiss`)
        .set(bearer(operator))
        .send({ statement: 'Signalement non fondé.' })
        .expect(200);
      await http()
        .post(`/community/posts/${target.id}/report`)
        .set(bearer(alice))
        .send({ reason: 'OTHER' })
        .expect(200);
      await http()
        .post(`/community/posts/${target.id}/report`)
        .set(bearer(guest))
        .send({ reason: 'OTHER' })
        .expect(200);
      await http()
        .get(`/community/posts/${target.id}`)
        .set(bearer(bob))
        .expect(200);
    });

    it('suspension de publication par un opérateur', async () => {
      send.mockClear();
      await http()
        .post(`/community/moderation/users/${handle('bob')}/suspend`)
        .set(bearer(operator))
        .send({
          reason: 'SPAM',
          statement: 'Messages publicitaires répétés.',
          days: 3,
        })
        .expect(200);
      const res = await http()
        .post('/community/posts')
        .set(bearer(bob))
        .send({ type: 'QUESTION', body: 'Encore moi' })
        .expect(403);
      expect(res.body.code).toBe('COMMUNITY_SUSPENDED');
      expect(mailsTo(bob.email, /modération/)[0].text).toContain(
        'suspendue pour votre compte',
      );
      const me = await http()
        .get('/community/profile')
        .set(bearer(bob))
        .expect(200);
      expect(me.body.reasons).toContain('COMMUNITY_SUSPENDED');
      await http()
        .post(`/community/moderation/users/${handle('bob')}/unsuspend`)
        .set(bearer(operator))
        .send({ statement: 'Suspension levée après échange.' })
        .expect(200);
      await http()
        .post('/community/posts')
        .set(bearer(bob))
        .send({ type: 'QUESTION', body: 'Merci, je ferai attention.' })
        .expect(201);
    });
  });

  // ---------------------------------------------------------------------------
  describe('blocage', () => {
    it('masque les contenus dans les deux sens', async () => {
      const alicePost = await photoPost(alice, 'Visible avant blocage');
      const carolPost = await http()
        .post('/community/posts')
        .set(bearer(carol))
        .send({ type: 'QUESTION', body: 'Question de Carol' })
        .expect(201);

      await http()
        .put(`/community/blocks/${handle('carol')}`)
        .set(bearer(carol))
        .expect(400);
      await http()
        .put(`/community/blocks/${handle('alice')}`)
        .set(bearer(carol))
        .expect(200);
      await http()
        .put(`/community/blocks/${handle('alice')}`)
        .set(bearer(carol))
        .expect(200); // idempotent
      const blocks = await http()
        .get('/community/blocks')
        .set(bearer(carol))
        .expect(200);
      expect(blocks.body.items.map((b: any) => b.handle)).toEqual([
        handle('Alice'),
      ]);

      const carolFeed = await http()
        .get('/community/posts?limit=50')
        .set(bearer(carol))
        .expect(200);
      expect(carolFeed.body.items.map((p: any) => p.id)).not.toContain(
        alicePost.id,
      );
      const aliceFeed = await http()
        .get('/community/posts?limit=50')
        .set(bearer(alice))
        .expect(200);
      expect(aliceFeed.body.items.map((p: any) => p.id)).not.toContain(
        carolPost.body.id,
      );
      await http()
        .get(`/community/posts/${alicePost.id}`)
        .set(bearer(carol))
        .expect(404);
      await http()
        .get(`/community/posts/${carolPost.body.id}`)
        .set(bearer(alice))
        .expect(404);
      await http()
        .get(`/community/users/${handle('alice')}`)
        .set(bearer(carol))
        .expect(404);
      await http()
        .get(`/community/users/${handle('carol')}`)
        .set(bearer(alice))
        .expect(404);
      await http()
        .post(`/community/posts/${carolPost.body.id}/comments`)
        .set(bearer(alice))
        .send({ body: 'Coucou' })
        .expect(404);
      await http()
        .put(`/community/posts/${carolPost.body.id}/like`)
        .set(bearer(alice))
        .expect(404);

      await http()
        .delete(`/community/blocks/${handle('alice')}`)
        .set(bearer(carol))
        .expect(200);
      await http()
        .get(`/community/posts/${alicePost.id}`)
        .set(bearer(carol))
        .expect(200);
    });
  });

  // ---------------------------------------------------------------------------
  describe('RGPD', () => {
    it('export : publications, commentaires, réactions, signalements émis, blocages, décisions', async () => {
      await http()
        .put(`/community/blocks/${handle('bob')}`)
        .set(bearer(carol))
        .expect(200);
      const carolExport = await http()
        .get('/users/me/export')
        .set(bearer(carol))
        .expect(200);
      expect(carolExport.body.exportVersion).toBe(4);
      const c = carolExport.body.community;
      expect(c.profile).toMatchObject({
        handle: handle('carol'),
        rulesVersion: COMMUNITY_RULES_VERSION,
      });
      expect(c.posts.length).toBeGreaterThan(0);
      expect(c.comments.length).toBeGreaterThan(0);
      expect(c.reactions).toHaveLength(1);
      expect(c.blocks.map((b: any) => b.handle)).toEqual([handle('bob')]);

      const bobExport = await http()
        .get('/users/me/export')
        .set(bearer(bob))
        .expect(200);
      expect(bobExport.body.community.reportsFiled.length).toBeGreaterThan(0);
      expect(bobExport.body.community.reportsFiled[0]).toMatchObject({
        reason: expect.any(String),
      });
      expect(
        bobExport.body.community.moderationDecisions.map((d: any) => d.action),
      ).toEqual(expect.arrayContaining(['SUSPEND', 'UNSUSPEND', 'DELETE']));
      expect(bobExport.body.community.profile.avatarUrl).toEqual(
        expect.any(String),
      );
    });

    it('quitter la communauté : profil, contenus et images supprimés', async () => {
      const erin = await verified('erin');
      await activate(erin, handle('erin')).expect(201);
      const post = await photoPost(erin, 'Je pars bientôt');
      const file = path.join(mediaDir, keyOf(post.media[0].url));
      await http().delete('/community/profile').set(bearer(erin)).expect(204);
      expect(existsSync(file)).toBe(false);
      expect(
        await prisma.communityPost.count({ where: { authorId: erin.userId } }),
      ).toBe(0);
      const me = await http()
        .get('/community/profile')
        .set(bearer(erin))
        .expect(200);
      expect(me.body.profile).toBeNull();
      await http()
        .get(`/community/users/${handle('erin')}`)
        .set(bearer(carol))
        .expect(404);
    });

    it('suppression du compte : contenus et fichiers effacés, journal anonymisé', async () => {
      const keys = (
        await prisma.communityMedia.findMany({
          where: { ownerId: alice.userId },
          select: { key: true },
        })
      ).map((m) => m.key);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.some((k) => existsSync(path.join(mediaDir, k)))).toBe(true);
      const decisionsBefore = await prisma.communityModerationAction.count({
        where: { subjectId: alice.userId },
      });
      expect(decisionsBefore).toBeGreaterThan(0);

      await http()
        .delete('/users/me')
        .set(bearer(alice))
        .send({ password: PASSWORD })
        .expect(204);

      for (const k of keys)
        expect(existsSync(path.join(mediaDir, k))).toBe(false);
      expect(
        await prisma.communityMedia.count({ where: { key: { in: keys } } }),
      ).toBe(0);
      expect(
        await prisma.communityPost.count({ where: { authorId: alice.userId } }),
      ).toBe(0);
      expect(
        await prisma.communityProfile.count({
          where: { userId: alice.userId },
        }),
      ).toBe(0);
      expect(
        await prisma.communityReport.count({
          where: { reporterId: alice.userId },
        }),
      ).toBe(0);
      expect(
        await prisma.communityBlock.count({
          where: {
            OR: [{ blockerId: alice.userId }, { blockedId: alice.userId }],
          },
        }),
      ).toBe(0);
      // Journal conservé (DSA), sans lien vers le compte supprimé.
      expect(
        await prisma.communityModerationAction.count({
          where: { subjectId: alice.userId },
        }),
      ).toBe(0);
      expect(
        await prisma.communityModerationAction.count({
          where: { action: 'AUTO_HIDE', subjectId: null },
        }),
      ).toBeGreaterThan(0);
      await http()
        .get(`/community/users/${handle('alice')}`)
        .set(bearer(carol))
        .expect(404);
    });

    it('maintenance : les images orphelines (jamais rattachées) sont purgées, fichier compris', async () => {
      const orphan = await upload(carol, await gpsJpeg()).expect(201);
      const fresh = await upload(carol, await gpsJpeg()).expect(201);
      await prisma.communityMedia.update({
        where: { id: orphan.body.id },
        data: { createdAt: new Date(Date.now() - 2 * DAY_MS) },
      });
      const res = await app.get(MaintenanceService).runOnce();
      expect(res.locked).toBe(true);
      expect(res.deleted.communityMedia).toBeGreaterThanOrEqual(1);
      expect(existsSync(path.join(mediaDir, keyOf(orphan.body.url)))).toBe(
        false,
      );
      expect(
        await prisma.communityMedia.count({ where: { id: orphan.body.id } }),
      ).toBe(0);
      // Téléversée il y a moins de 24 h : conservée (publication en cours de rédaction).
      expect(existsSync(path.join(mediaDir, keyOf(fresh.body.url)))).toBe(true);
      // L'avatar de Bob n'est pas orphelin.
      const bobAvatar = await prisma.communityProfile.findUnique({
        where: { userId: bob.userId },
        select: { avatarMediaId: true },
      });
      expect(bobAvatar!.avatarMediaId).not.toBeNull();
      expect(readdirSync(mediaDir).length).toBeGreaterThan(0);
    });
  });
});
