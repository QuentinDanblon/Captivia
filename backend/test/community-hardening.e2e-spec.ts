import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { existsSync, mkdtempSync, rmSync } from 'fs';
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
  GuestCreationRateLimitGuard,
  RateLimitGuard,
} from '../src/common/guards/rate-limit.guard';
import { MailService } from '../src/mail/mail.service';
import { MaintenanceService } from '../src/maintenance/maintenance.service';
import { CommunityMediaService } from '../src/community/media/community-media.service';
import { COMMUNITY_RULES_VERSION } from '../src/community/community.constants';
import {
  bodyOf,
  AuthBody,
  CommunityPostBody,
  ErrorBody,
  IdBody,
  Page,
  UrlBody,
} from './utils/http';

jest.setTimeout(180000);

const sharp = sharpModule as unknown as typeof sharpModule.default;
const PASSWORD = 'Hardening123!xx';
const DAY_MS = 24 * 60 * 60 * 1000;

interface Account {
  email: string;
  token: string;
  userId: string;
  handle?: string;
}

/** Courriel capturé via l'espion sur `MailService.send`. */
interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Élément (partiel) de `GET /community/me/reports` et de la file de modération. */
interface ReportItem {
  targetId: string;
  resolvedAt: string | null;
}

/** JPEG 64 × 64 avec EXIF (appareil + GPS). */
function exifJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: { r: 1, g: 2, b: 3 },
    },
  })
    .jpeg()
    .withExif({
      IFD0: { Make: 'LeakyCam' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '48/1 51/1 2400/100' },
    })
    .toBuffer();
}

/**
 * Non-régression de la revue de sécurité du backend communauté (cas A à N du relecteur) :
 * bombe de décompression, masquage automatique par comptes jetables, contournement de la
 * suspension, téléversement lu avant le contrôle d'accès, limites par compte contournables par
 * concurrence, images de contenus masqués, information des auteurs de signalements (DSA
 * art. 16(5)) et relances, recours concurrents, pseudos réservés et pseudos libérés.
 */
describe('Communauté : durcissement (revue de sécurité)', () => {
  let app: INestApplication;
  let url: string;
  let prisma: PrismaService;
  let send: jest.SpyInstance;
  let mediaDir: string;
  const prevEnv = { ...process.env };
  const tag = `${Date.now() % 1_000_000}${Math.floor(Math.random() * 1000)}`;
  const emails: string[] = [];
  const guestIds: string[] = [];
  let n = 0;
  const http = () => request(url);
  const bearer = (a: { token: string }) => ({
    Authorization: `Bearer ${a.token}`,
  });

  async function register(name: string, locale = 'fr'): Promise<Account> {
    const email = `hardening-${name}-${tag}-${n++}@captivia.local`;
    const res = await http()
      .post('/auth/register')
      .send({
        email,
        password: PASSWORD,
        locale,
        acceptTerms: true,
        ageConfirmed: true,
      })
      .expect(201);
    emails.push(email);
    return {
      email,
      token: bodyOf<AuthBody>(res).accessToken,
      userId: bodyOf<AuthBody>(res).user.id,
    };
  }

  /** Membre vérifié, profil activé ; `ageDays` : ancienneté du compte. */
  async function member(
    name: string,
    opts: { ageDays?: number; locale?: string } = {},
  ): Promise<Account> {
    const a = await register(name, opts.locale);
    await prisma.user.update({
      where: { id: a.userId },
      data: {
        emailVerifiedAt: new Date(),
        createdAt: new Date(Date.now() - (opts.ageDays ?? 30) * DAY_MS),
      },
    });
    const handle = `${name}${tag}${n++}`.slice(0, 30);
    await activate(a, handle).expect(201);
    return { ...a, handle };
  }

  async function operator(name: string): Promise<Account> {
    const op = await member(name);
    await prisma.user.update({
      where: { id: op.userId },
      data: { role: 'OPERATOR' },
    });
    return op;
  }

  async function guest(): Promise<Account> {
    const g = await http().post('/auth/guest').send({}).expect(201);
    guestIds.push(bodyOf<AuthBody>(g).user.id);
    return {
      email: '',
      token: bodyOf<AuthBody>(g).accessToken,
      userId: bodyOf<AuthBody>(g).user.id,
    };
  }

  function activate(a: Account, handle: string) {
    return http().post('/community/profile').set(bearer(a)).send({
      handle,
      acceptRules: true,
      rulesVersion: COMMUNITY_RULES_VERSION,
    });
  }

  function upload(
    a: Account,
    data: Buffer,
    filename = 'x.jpg',
    type = 'image/jpeg',
  ) {
    return http()
      .post('/community/media')
      .set(bearer(a))
      .attach('file', data, { filename, contentType: type });
  }

  async function photoPost(a: Account, body = 'hello') {
    const m = await upload(a, await exifJpeg()).expect(201);
    const p = await http()
      .post('/community/posts')
      .set(bearer(a))
      .send({ type: 'PHOTO', body, mediaIds: [bodyOf<IdBody>(m).id] })
      .expect(201);
    return bodyOf<CommunityPostBody>(p);
  }

  function report(a: Account, postId: string, reason = 'SPAM') {
    return http()
      .post(`/community/posts/${postId}/report`)
      .set(bearer(a))
      .send({ reason });
  }

  const keyOf = (u: string) => u.split('/').pop()!;

  function mailsTo(email: string, subject?: RegExp) {
    return (send.mock.calls as Array<[MailMessage]>)
      .map((c) => c[0])
      .filter((m) => m.to === email && (!subject || subject.test(m.subject)));
  }

  /** Pic de RSS (Mo) au-dessus du niveau de départ pendant `work`. */
  async function peakRssDeltaMb<T>(
    work: () => Promise<T>,
  ): Promise<{ result: T; deltaMb: number }> {
    const start = process.memoryUsage().rss;
    let peak = start;
    const timer = setInterval(() => {
      peak = Math.max(peak, process.memoryUsage().rss);
    }, 5);
    try {
      const result = await work();
      peak = Math.max(peak, process.memoryUsage().rss);
      return { result, deltaMb: (peak - start) / 1e6 };
    } finally {
      clearInterval(timer);
    }
  }

  beforeAll(async () => {
    mediaDir = mkdtempSync(path.join(tmpdir(), 'captivia-hardening-e2e-'));
    process.env.MEDIA_LOCAL_DIR = mediaDir;
    process.env.MEDIA_DRIVER = 'local';
    delete process.env.MEDIA_PUBLIC_BASE_URL;
    delete process.env.MEDIA_MAX_BYTES;
    process.env.COMMUNITY_ENABLED = 'true';
    process.env.COMMUNITY_HIDE_THRESHOLD = '3';
    delete process.env.COMMUNITY_REPORT_MIN_ACCOUNT_AGE_DAYS;
    process.env.COMMUNITY_POSTS_PER_HOUR = '1000';
    process.env.COMMUNITY_COMMENTS_PER_MINUTE = '1000';
    process.env.COMMUNITY_UPLOADS_PER_HOUR = '1000';
    process.env.COMMUNITY_CONTACT_EMAIL = 'moderation@captivia.example';
    process.env.FRONTEND_URL = 'https://app.captivia.example';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideGuard(AuthRateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(GuestCreationRateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
    prisma = app.get(PrismaService);
    send = jest
      .spyOn(app.get(MailService), 'send')
      .mockResolvedValue({ sent: true, simulated: true, attempts: 1 });
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
  // Constat 1 : bombe de décompression
  // ---------------------------------------------------------------------------

  describe('bombe de décompression', () => {
    it('PNG de 10 000 000 × 5 px (146 Ko) : refusé sans décodage, mémoire bornée', async () => {
      const a = await member('bomb');
      const wide = await sharp({
        create: {
          width: 10_000_000,
          height: 5,
          channels: 3,
          background: { r: 0, g: 0, b: 0 },
        },
        limitInputPixels: false,
      })
        .png({ compressionLevel: 9 })
        .toBuffer();
      expect(wide.length).toBeLessThan(200 * 1024);
      const { result, deltaMb } = await peakRssDeltaMb(() =>
        Promise.all(
          Array.from({ length: 4 }, () =>
            upload(a, wide, 'x.png', 'image/png'),
          ),
        ),
      );
      for (const r of result) {
        expect([400, 413]).toContain(r.status);
        expect(bodyOf<ErrorBody>(r).code).toBe('MEDIA_TOO_LARGE');
      }
      // Avant correctif : RSS de 1,4 à 4 Go. Après : quelques Mo.
      expect(deltaMb).toBeLessThan(150);
      expect(
        await prisma.communityMedia.count({ where: { ownerId: a.userId } }),
      ).toBe(0);
    });

    it('dimensions et rapport des côtés bornés avant décodage', async () => {
      const a = await member('dims');
      const tooTall = await sharp({
        create: { width: 400, height: 10_001, channels: 3, background: '#000' },
      })
        .png()
        .toBuffer();
      const r1 = await upload(a, tooTall, 'x.png', 'image/png').expect(413);
      expect(bodyOf<ErrorBody>(r1).code).toBe('MEDIA_TOO_LARGE');
      const strip = await sharp({
        create: { width: 4200, height: 200, channels: 3, background: '#000' },
      })
        .png()
        .toBuffer();
      const r2 = await upload(a, strip, 'x.png', 'image/png').expect(400);
      expect(bodyOf<ErrorBody>(r2).code).toBe('MEDIA_INVALID_IMAGE');
    });
  });

  // ---------------------------------------------------------------------------
  // Constat 2 (cas B, M) : masquage automatique par comptes jetables
  // ---------------------------------------------------------------------------

  describe('seuil de masquage automatique', () => {
    it('B. trois invités ne masquent rien : signalements en file opérateur', async () => {
      const victim = await member('vicb');
      const op = await operator('opb');
      const post = await photoPost(victim);
      for (let i = 0; i < 3; i++) {
        await report(await guest(), post.id).expect(200);
      }
      // Ni des comptes récents (1 jour), même vérifiés avec un profil.
      for (let i = 0; i < 3; i++) {
        await report(await member(`newb${i}`, { ageDays: 1 }), post.id).expect(
          200,
        );
      }
      let row = await prisma.communityPost.findUnique({
        where: { id: post.id },
      });
      expect(row?.status).toBe('VISIBLE');
      expect(
        await prisma.communityModerationAction.count({
          where: { targetId: post.id },
        }),
      ).toBe(0);
      const queue = await http()
        .get('/community/moderation/queue?limit=50')
        .set(bearer(op))
        .expect(200);
      const item = bodyOf<Page<ReportItem>>(queue).items.find(
        (i) => i.targetId === post.id,
      );
      expect(item).toMatchObject({ status: 'VISIBLE', openReports: 6 });

      // Trois membres établis : masquage automatique.
      for (let i = 0; i < 3; i++) {
        await report(await member(`oldb${i}`), post.id).expect(200);
      }
      row = await prisma.communityPost.findUnique({ where: { id: post.id } });
      expect(row?.status).toBe('HIDDEN_AUTO');
    });

    it('B. ancienneté exigée réglable (COMMUNITY_REPORT_MIN_ACCOUNT_AGE_DAYS)', async () => {
      process.env.COMMUNITY_REPORT_MIN_ACCOUNT_AGE_DAYS = '0';
      try {
        const victim = await member('vicb2');
        const post = await photoPost(victim);
        for (let i = 0; i < 3; i++) {
          await report(
            await member(`freshb${i}`, { ageDays: 0 }),
            post.id,
          ).expect(200);
        }
        const row = await prisma.communityPost.findUnique({
          where: { id: post.id },
        });
        expect(row?.status).toBe('HIDDEN_AUTO');
      } finally {
        delete process.env.COMMUNITY_REPORT_MIN_ACCOUNT_AGE_DAYS;
      }
    });

    it('M. signalements parallèles au seuil : un seul AUTO_HIDE', async () => {
      const victim = await member('vicm');
      const post = await photoPost(victim);
      const reporters = await Promise.all(
        [0, 1, 2, 3, 4].map((i) => member(`rm${i}`)),
      );
      await Promise.all(reporters.map((r) => report(r, post.id).expect(200)));
      expect(
        await prisma.communityModerationAction.count({
          where: { targetId: post.id, action: 'AUTO_HIDE' },
        }),
      ).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Constat 3 (cas A) : suspension contournée par départ puis réactivation
  // ---------------------------------------------------------------------------

  describe('suspension portée par le compte', () => {
    it('A. quitter la communauté est permis mais ne lève pas la suspension', async () => {
      const op = await operator('opa');
      const bad = await member('bada');
      await http()
        .post(`/community/moderation/users/${bad.handle}/suspend`)
        .set(bearer(op))
        .send({
          reason: 'SPAM',
          statement: 'Spam repeated many times',
          days: 30,
        })
        .expect(200);
      const blocked = await http()
        .post('/community/posts')
        .set(bearer(bad))
        .send({ type: 'QUESTION', body: 'x?' })
        .expect(403);
      expect(bodyOf<ErrorBody>(blocked).code).toBe('COMMUNITY_SUSPENDED');

      // Droit de partir : toujours permis pendant une suspension.
      await http().delete('/community/profile').set(bearer(bad)).expect(204);
      const me = await http()
        .get('/community/profile')
        .set(bearer(bad))
        .expect(200);
      expect(bodyOf<{ reasons: string[] }>(me).reasons).toContain(
        'COMMUNITY_SUSPENDED',
      );
      // Sans profil, la fin de suspension est exposée à la racine (le client ne la lit plus dans
      // le message d'erreur) : c'est la date portée par le compte.
      const account = await prisma.user.findUnique({
        where: { id: bad.userId },
        select: { communitySuspendedUntil: true },
      });
      expect(bodyOf<{ profile: unknown }>(me).profile).toBeNull();
      expect(bodyOf<{ suspendedUntil: string }>(me).suspendedUntil).toBe(
        account!.communitySuspendedUntil!.toISOString(),
      );
      const again = await activate(bad, bad.handle!).expect(403);
      expect(bodyOf<ErrorBody>(again).code).toBe('COMMUNITY_SUSPENDED');
      const other = await activate(bad, `${bad.handle!}x`).expect(403);
      expect(bodyOf<ErrorBody>(other).code).toBe('COMMUNITY_SUSPENDED');
      expect(
        await prisma.communityProfile.count({ where: { userId: bad.userId } }),
      ).toBe(0);

      // Suspension échue : réactivation possible, avec le même pseudo (réservé à son titulaire).
      await prisma.user.update({
        where: { id: bad.userId },
        data: { communitySuspendedUntil: new Date(Date.now() - 1000) },
      });
      // Échue : plus de date annoncée, même si la colonne du compte n'est pas encore remise à zéro.
      const expired = await http()
        .get('/community/profile')
        .set(bearer(bad))
        .expect(200);
      expect(
        bodyOf<{ suspendedUntil: string | null }>(expired).suspendedUntil,
      ).toBeNull();
      await activate(bad, bad.handle!).expect(201);
      await http()
        .post('/community/posts')
        .set(bearer(bad))
        .send({ type: 'QUESTION', body: 'back again?' })
        .expect(201);
    });

    it('A. levée de la suspension (recours accueilli) : sur le compte et le profil', async () => {
      const op = await operator('opa2');
      const bad = await member('bada2');
      const decision = await http()
        .post(`/community/moderation/users/${bad.handle}/suspend`)
        .set(bearer(op))
        .send({
          reason: 'SPAM',
          statement: 'Spam repeated many times',
          days: 30,
        })
        .expect(200);
      const user = await prisma.user.findUnique({ where: { id: bad.userId } });
      expect(user!.communitySuspendedUntil).not.toBeNull();
      await http()
        .post(`/community/me/decisions/${bodyOf<IdBody>(decision).id}/appeal`)
        .set(bearer(bad))
        .send({ text: 'This was not spam, please review.' })
        .expect(201);
      await http()
        .post(
          `/community/moderation/appeals/${bodyOf<IdBody>(decision).id}/resolve`,
        )
        .set(bearer(op))
        .send({
          outcome: 'REVERSED',
          statement: 'Suspension lifted after review',
        })
        .expect(200);
      const after = await prisma.user.findUnique({
        where: { id: bad.userId },
        select: {
          communitySuspendedUntil: true,
          communityProfile: { select: { suspendedUntil: true } },
        },
      });
      expect(after!.communitySuspendedUntil).toBeNull();
      expect(after!.communityProfile!.suspendedUntil).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Constat 4 (cas G) : corps lu avant le contrôle d'accès
  // ---------------------------------------------------------------------------

  describe('téléversement : contrôle d’accès avant lecture du corps', () => {
    /** Statut HTTP, ou l'erreur réseau si le serveur coupe avant la fin de l'envoi. */
    async function statusOf(req: request.Test): Promise<number | string> {
      try {
        return (await req).status;
      } catch (error) {
        return (error as NodeJS.ErrnoException).code ?? 'ERROR';
      }
    }

    it('G. invité et compte non vérifié : 403 sans que le corps soit lu', async () => {
      const g = await guest();
      const unverified = await register('unvg');
      const uploadSpy = jest.spyOn(app.get(CommunityMediaService), 'upload');
      const small = await exifJpeg();
      const r1 = await upload(g, small).expect(403);
      expect(bodyOf<ErrorBody>(r1).code).toBe('GUEST_ACCOUNT');
      const r2 = await upload(unverified, small).expect(403);
      expect(bodyOf<ErrorBody>(r2).code).toBe('EMAIL_NOT_VERIFIED');

      const big = Buffer.alloc(20 * 1024 * 1024, 1);
      const { result, deltaMb } = await peakRssDeltaMb(() =>
        Promise.all(Array.from({ length: 5 }, () => statusOf(upload(g, big)))),
      );
      for (const status of result) {
        // 403 ; ou connexion coupée par le serveur avant la fin de l'envoi (corps jamais lu).
        expect([403, 'EPIPE', 'ECONNRESET']).toContain(status);
      }
      expect(uploadSpy).not.toHaveBeenCalled();
      // 5 × 20 Mo jamais mis en mémoire côté serveur (le client, lui, garde ses tampons).
      expect(deltaMb).toBeLessThan(150);
      uploadSpy.mockRestore();
    });

    it('plafond multipart aligné sur MEDIA_MAX_BYTES : 413 dès le dépassement', async () => {
      const a = await member('cap');
      process.env.MEDIA_MAX_BYTES = '4096';
      try {
        const big = Buffer.concat([
          Buffer.from([0xff, 0xd8, 0xff]),
          Buffer.alloc(64 * 1024, 7),
        ]);
        const res = await upload(a, big).expect(413);
        expect(bodyOf<ErrorBody>(res).code).toBe('MEDIA_TOO_LARGE');
        // Même un corps qui n'est pas une image : coupé au plafond, avant toute analyse.
        const html = Buffer.alloc(64 * 1024, 0x3c);
        expect(
          bodyOf<ErrorBody>(
            await upload(a, html, 'x.png', 'image/png').expect(413),
          ).code,
        ).toBe('MEDIA_TOO_LARGE');
      } finally {
        delete process.env.MEDIA_MAX_BYTES;
      }
      // Sous le plafond : 201.
      await upload(a, await exifJpeg()).expect(201);
    });
  });

  // ---------------------------------------------------------------------------
  // Constat 5 (cas C, D, D2) : limites par compte et concurrence
  // ---------------------------------------------------------------------------

  describe('limites par compte sous concurrence', () => {
    afterEach(() => {
      process.env.COMMUNITY_POSTS_PER_HOUR = '1000';
      process.env.COMMUNITY_COMMENTS_PER_MINUTE = '1000';
      process.env.COMMUNITY_UPLOADS_PER_HOUR = '1000';
    });

    it('C. 25 commentaires parallèles, limite 5 : exactement 5 créés', async () => {
      const a = await member('rca');
      const b = await member('rcb');
      const post = await photoPost(b);
      process.env.COMMUNITY_COMMENTS_PER_MINUTE = '5';
      const res = await Promise.all(
        Array.from({ length: 25 }, (_, i) =>
          http()
            .post(`/community/posts/${post.id}/comments`)
            .set(bearer(a))
            .send({ body: `c${i}` }),
        ),
      );
      expect(res.filter((r) => r.status === 201)).toHaveLength(5);
      expect(res.filter((r) => r.status === 429)).toHaveLength(20);
      expect(
        await prisma.communityComment.count({ where: { authorId: a.userId } }),
      ).toBe(5);
    });

    it('C. publications parallèles, limite 3 : exactement 3 créées', async () => {
      const a = await member('rpa');
      process.env.COMMUNITY_POSTS_PER_HOUR = '3';
      const res = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          http()
            .post('/community/posts')
            .set(bearer(a))
            .send({ type: 'QUESTION', body: `question ${i}?` }),
        ),
      );
      expect(res.filter((r) => r.status === 201)).toHaveLength(3);
      expect(
        await prisma.communityPost.count({ where: { authorId: a.userId } }),
      ).toBe(3);
    });

    it('D. 12 téléversements parallèles, limite 2 : exactement 2 ; ensuite 429', async () => {
      const a = await member('rua');
      process.env.COMMUNITY_UPLOADS_PER_HOUR = '2';
      const buf = await exifJpeg();
      const res = await Promise.all(
        Array.from({ length: 12 }, () => upload(a, buf)),
      );
      expect(res.filter((r) => r.status === 201)).toHaveLength(2);
      expect(res.filter((r) => r.status === 429)).toHaveLength(10);
      const bogus = Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff]),
        Buffer.alloc(1000),
      ]);
      const fails = await Promise.all(
        Array.from({ length: 5 }, () => upload(a, bogus)),
      );
      expect(fails.map((r) => r.status)).toEqual([429, 429, 429, 429, 429]);
    });

    it('D2. les envois en échec comptent dans la limite', async () => {
      const a = await member('rub');
      process.env.COMMUNITY_UPLOADS_PER_HOUR = '2';
      const bogus = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(2000),
      ]);
      const statuses: number[] = [];
      for (let i = 0; i < 10; i++)
        statuses.push((await upload(a, bogus)).status);
      expect(statuses).toEqual([
        400, 400, 429, 429, 429, 429, 429, 429, 429, 429,
      ]);
      expect(
        await prisma.communityUploadAttempt.count({
          where: { userId: a.userId },
        }),
      ).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Constat 6 (cas E, J, K) : images des contenus masqués ou supprimés
  // ---------------------------------------------------------------------------

  describe('images : contenus masqués, suppression, cache', () => {
    it('E. image d’une publication masquée : 404 publique, visible de l’auteur et des opérateurs', async () => {
      const author = await member('ime');
      const op = await operator('opi');
      const viewer = await member('vie');
      const post = await photoPost(author);
      const key = keyOf(post.media[0].url);

      const visible = await http().get(`/community/media/${key}`).expect(200);
      expect(visible.headers['cache-control']).toBe('public, max-age=86400');
      expect(visible.headers['x-content-type-options']).toBe('nosniff');
      // J. métadonnées supprimées.
      const meta = await sharp(bodyOf<Buffer>(visible)).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.exif).toBeUndefined();

      await http()
        .post(`/community/moderation/posts/${post.id}/hide`)
        .set(bearer(op))
        .send({ reason: 'SPAM', statement: 'Statement of reasons' })
        .expect(200);
      await http().get(`/community/media/${key}`).expect(404);
      await http()
        .get(`/community/media/${key}`)
        .set(bearer(viewer))
        .expect(404);
      await http()
        .get(`/community/media/${key}`)
        .set({ Authorization: 'Bearer not-a-token' })
        .expect(404);
      const own = await http()
        .get(`/community/media/${key}`)
        .set(bearer(author))
        .expect(200);
      expect(own.headers['cache-control']).toBe('private, no-store');
      const byOp = await http()
        .get(`/community/media/${key}`)
        .set(bearer(op))
        .expect(200);
      expect(byOp.headers['cache-control']).toBe('private, no-store');

      // Rétabli : de nouveau publique.
      await http()
        .post(`/community/moderation/posts/${post.id}/restore`)
        .set(bearer(op))
        .send({ statement: 'Restored after review' })
        .expect(200);
      await http().get(`/community/media/${key}`).expect(200);
    });

    it('suppression par un opérateur : fichier effacé du stockage', async () => {
      const author = await member('imd');
      const op = await operator('opd');
      const post = await photoPost(author);
      const key = keyOf(post.media[0].url);
      expect(existsSync(path.join(mediaDir, key))).toBe(true);
      await http()
        .post(`/community/moderation/posts/${post.id}/delete`)
        .set(bearer(op))
        .send({
          reason: 'ILLEGAL_TRADE',
          statement: 'Illegal trade in species',
        })
        .expect(200);
      expect(existsSync(path.join(mediaDir, key))).toBe(false);
      await http().get(`/community/media/${key}`).set(bearer(op)).expect(404);
    });

    it('K. polyglotte JPEG+HTML ré-encodé, SVG refusé, traversée de chemin refusée', async () => {
      const a = await member('pka');
      const poly = Buffer.concat([
        await exifJpeg(),
        Buffer.from('<html><script>alert(1)</script></html>'),
      ]);
      const r = await upload(a, poly).expect(201);
      const m = await http()
        .get(`/community/media/${keyOf(bodyOf<UrlBody>(r).url)}`)
        .expect(200);
      expect(bodyOf<Buffer>(m).includes(Buffer.from('<script>'))).toBe(false);
      const svg = await upload(
        a,
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
        'x.svg',
        'image/svg+xml',
      ).expect(415);
      expect(bodyOf<ErrorBody>(svg).code).toBe('MEDIA_UNSUPPORTED_TYPE');
      await http().get('/community/media/..%2f..%2fpackage.json').expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  // Constat 7 : information des auteurs de signalements, relances, decisionUrl
  // ---------------------------------------------------------------------------

  describe('DSA : notifications des décisions', () => {
    it('GET /community/me/reports : statut et décision ; e-mail au signalant', async () => {
      const author = await member('rpa');
      const op = await operator('rpo');
      const reporter = await member('rpr');
      const g = await guest();
      const post = await photoPost(author);
      const other = await photoPost(author, 'other');
      await report(reporter, post.id, 'HATE').expect(200);
      await report(g, post.id).expect(200);
      await report(reporter, other.id).expect(200);

      let mine = await http()
        .get('/community/me/reports')
        .set(bearer(reporter))
        .expect(200);
      expect(bodyOf<Page<ReportItem>>(mine).items).toHaveLength(2);
      expect(
        bodyOf<Page<ReportItem>>(mine).items.find(
          (i) => i.targetId === post.id,
        ),
      ).toMatchObject({
        targetType: 'POST',
        reason: 'HATE',
        status: 'OPEN',
        decision: null,
      });

      send.mockClear();
      await http()
        .post(`/community/moderation/posts/${post.id}/hide`)
        .set(bearer(op))
        .send({ reason: 'HATE', statement: 'Hateful content removed' })
        .expect(200);
      await http()
        .post(`/community/moderation/posts/${other.id}/dismiss`)
        .set(bearer(op))
        .send({ statement: 'No breach of the rules' })
        .expect(200);

      mine = await http()
        .get('/community/me/reports')
        .set(bearer(reporter))
        .expect(200);
      const hidden = bodyOf<Page<ReportItem>>(mine).items.find(
        (i) => i.targetId === post.id,
      );
      expect(hidden).toMatchObject({
        status: 'ACTIONED',
        decision: { action: 'HIDE', contentRemoved: true, reason: 'HATE' },
      });
      expect(hidden!.resolvedAt).not.toBeNull();
      const kept = bodyOf<Page<ReportItem>>(mine).items.find(
        (i) => i.targetId === other.id,
      );
      expect(kept).toMatchObject({
        status: 'DISMISSED',
        decision: { action: 'DISMISS', contentRemoved: false },
      });
      // Jamais l'exposé des motifs destiné à l'auteur ni son identité.
      expect(JSON.stringify(mine.body)).not.toContain('Hateful content');
      expect(JSON.stringify(mine.body)).not.toContain(author.email);

      const mails = mailsTo(reporter.email, /signalement/);
      expect(mails).toHaveLength(2);
      expect(mails.map((m) => m.text).join('\n')).toContain(
        "l'équipe de modération a masqué ce contenu",
      );
      expect(mails.map((m) => m.text).join('\n')).toContain(
        "n'a pas retenu de manquement",
      );
      const rows = await prisma.communityReport.findMany({
        where: { reporterId: reporter.userId },
      });
      expect(rows.every((r) => r.notifiedAt && r.decisionId)).toBe(true);

      // Un invité suit ses signalements dans l'application.
      const guestReports = await http()
        .get('/community/me/reports')
        .set(bearer(g))
        .expect(200);
      expect(bodyOf<Page<ReportItem>>(guestReports).items[0]).toMatchObject({
        status: 'ACTIONED',
        decision: { action: 'HIDE' },
      });
    });

    it('suppression : les signalants sont notifiés avant que leurs signalements disparaissent', async () => {
      const author = await member('rda');
      const op = await operator('rdo');
      const reporter = await member('rdr');
      const post = await photoPost(author);
      await report(reporter, post.id).expect(200);
      send.mockClear();
      await http()
        .post(`/community/moderation/posts/${post.id}/delete`)
        .set(bearer(op))
        .send({ reason: 'SPAM', statement: 'Spam removed for good' })
        .expect(200);
      const mails = mailsTo(reporter.email, /signalement/);
      expect(mails).toHaveLength(1);
      expect(mails[0].text).toContain('a supprimé ce contenu');
    });

    it('decisionUrl : /communaute/decisions/:id, préfixe de locale hors français', async () => {
      const op = await operator('dlo');
      const fr = await member('dlf');
      const en = await member('dle', { locale: 'en' });
      for (const a of [fr, en]) {
        const post = await photoPost(a);
        await http()
          .post(`/community/moderation/posts/${post.id}/hide`)
          .set(bearer(op))
          .send({ reason: 'SPAM', statement: 'Statement of reasons' })
          .expect(200);
      }
      const [frMail] = mailsTo(fr.email, /modération/);
      expect(frMail.text).toMatch(
        /https:\/\/app\.captivia\.example\/communaute\/decisions\/[0-9a-f-]{36}/,
      );
      const [enMail] = mailsTo(en.email, /moderation/);
      expect(enMail.text).toMatch(
        /https:\/\/app\.captivia\.example\/en\/communaute\/decisions\/[0-9a-f-]{36}/,
      );
    });

    it('envois en échec : relancés par le job de maintenance', async () => {
      const author = await member('rta');
      const op = await operator('rto');
      const reporter = await member('rtr');
      const post = await photoPost(author);
      await report(reporter, post.id).expect(200);
      send.mockResolvedValue({ sent: false, simulated: false, attempts: 3 });
      let decisionId: string;
      try {
        const res = await http()
          .post(`/community/moderation/posts/${post.id}/hide`)
          .set(bearer(op))
          .send({ reason: 'SPAM', statement: 'Statement of reasons' })
          .expect(200);
        decisionId = bodyOf<IdBody>(res).id;
      } finally {
        send.mockResolvedValue({ sent: true, simulated: true, attempts: 1 });
      }
      let action = await prisma.communityModerationAction.findUnique({
        where: { id: decisionId },
      });
      expect(action).toMatchObject({
        notifiedAt: null,
        notificationPending: true,
      });
      let row = await prisma.communityReport.findFirst({
        where: { reporterId: reporter.userId },
      });
      expect(row!.notifiedAt).toBeNull();

      send.mockClear();
      const res = await app.get(MaintenanceService).runOnce();
      expect(res.locked).toBe(true);
      expect(res.retried.decisions).toBeGreaterThanOrEqual(1);
      expect(res.retried.reports).toBeGreaterThanOrEqual(1);
      expect(mailsTo(author.email, /modération/)).toHaveLength(1);
      expect(mailsTo(reporter.email, /signalement/)).toHaveLength(1);
      action = await prisma.communityModerationAction.findUnique({
        where: { id: decisionId },
      });
      expect(action!.notifiedAt).not.toBeNull();
      expect(action!.notificationPending).toBe(false);
      row = await prisma.communityReport.findFirst({
        where: { reporterId: reporter.userId },
      });
      expect(row!.notifiedAt).not.toBeNull();

      // Rien à relancer ensuite.
      send.mockClear();
      await app.get(MaintenanceService).runOnce();
      expect(mailsTo(author.email)).toHaveLength(0);
      expect(mailsTo(reporter.email)).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Constat 8 (cas F, N) : recours concurrents, purge
  // ---------------------------------------------------------------------------

  describe('recours', () => {
    it('F. résolutions concurrentes : un seul rétablissement, un seul e-mail', async () => {
      const op = await operator('opf');
      const au = await member('auf');
      const post = await photoPost(au);
      const hide = await http()
        .post(`/community/moderation/posts/${post.id}/hide`)
        .set(bearer(op))
        .send({ reason: 'SPAM', statement: 'Statement of reasons' })
        .expect(200);
      await http()
        .post(`/community/me/decisions/${bodyOf<IdBody>(hide).id}/appeal`)
        .set(bearer(au))
        .send({ text: 'Please review my post' })
        .expect(201);
      send.mockClear();
      const res = await Promise.all(
        [0, 1, 2, 3].map(() =>
          http()
            .post(
              `/community/moderation/appeals/${bodyOf<IdBody>(hide).id}/resolve`,
            )
            .set(bearer(op))
            .send({ outcome: 'REVERSED', statement: 'Reversed after review' }),
        ),
      );
      expect(res.filter((r) => r.status === 200)).toHaveLength(1);
      expect(res.filter((r) => r.status === 404)).toHaveLength(3);
      expect(
        await prisma.communityModerationAction.count({
          where: { targetId: post.id, action: 'RESTORE' },
        }),
      ).toBe(1);
      expect(mailsTo(au.email)).toHaveLength(1);

      // N. recours parallèles : un seul accepté.
      const hide2 = await http()
        .post(`/community/moderation/posts/${post.id}/hide`)
        .set(bearer(op))
        .send({ reason: 'SPAM', statement: 'Statement of reasons 2' })
        .expect(200);
      const ap = await Promise.all(
        [0, 1, 2].map(() =>
          http()
            .post(`/community/me/decisions/${bodyOf<IdBody>(hide2).id}/appeal`)
            .set(bearer(au))
            .send({ text: 'Please review again' }),
        ),
      );
      expect(ap.filter((r) => r.status === 201)).toHaveLength(1);
      expect(ap.filter((r) => r.status === 400)).toHaveLength(2);
    });

    it('purge du journal : jamais une décision dont le recours est en attente', async () => {
      const au = await member('pga');
      const old = new Date(Date.now() - 400 * DAY_MS);
      const [pending, closed] = await Promise.all(
        (['PENDING', 'UPHELD'] as const).map((appealStatus) =>
          prisma.communityModerationAction.create({
            data: {
              action: 'HIDE',
              targetType: 'POST',
              targetId: '00000000-0000-4000-8000-000000000000',
              subjectId: au.userId,
              statement: 'Old decision',
              appealStatus,
              createdAt: old,
            },
          }),
        ),
      );
      await app.get(MaintenanceService).runOnce();
      expect(
        await prisma.communityModerationAction.findUnique({
          where: { id: pending.id },
        }),
      ).not.toBeNull();
      expect(
        await prisma.communityModerationAction.findUnique({
          where: { id: closed.id },
        }),
      ).toBeNull();
      await prisma.communityModerationAction.deleteMany({
        where: { id: pending.id },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Constats 9 et 10 : pseudos réservés (leet-speak), pseudos libérés
  // ---------------------------------------------------------------------------

  describe('pseudos', () => {
    it.each(['m0derateur', 'adm1n', 'Capt1via_Officiel', 'Captlvia'])(
      'refuse le sosie de mot réservé %s',
      async (h) => {
        const a = await register(`leet${h.length}`);
        await prisma.user.update({
          where: { id: a.userId },
          data: { emailVerifiedAt: new Date() },
        });
        const res = await activate(a, h).expect(400);
        expect(bodyOf<ErrorBody>(res).code).toBe('HANDLE_RESERVED');
      },
    );

    it('H. pseudo libéré réservé 60 jours à son ancien titulaire', async () => {
      const a = await member('hna');
      const b = await member('hnb');
      const old = a.handle!;
      await http()
        .patch('/community/profile')
        .set(bearer(a))
        .send({ handle: `${old.slice(0, 28)}z` })
        .expect(200);
      const take = await http()
        .patch('/community/profile')
        .set(bearer(b))
        .send({ handle: old.toUpperCase() })
        .expect(409);
      expect(bodyOf<ErrorBody>(take).code).toBe('HANDLE_TAKEN');
      const c = await register('hnc');
      await prisma.user.update({
        where: { id: c.userId },
        data: { emailVerifiedAt: new Date() },
      });
      expect(bodyOf<ErrorBody>(await activate(c, old).expect(409)).code).toBe(
        'HANDLE_TAKEN',
      );

      // Son ancien titulaire le reprend.
      await http()
        .patch('/community/profile')
        .set(bearer(a))
        .send({ handle: old })
        .expect(200);
      expect(
        await prisma.communityHandleHold.count({
          where: { handleKey: old.toLowerCase() },
        }),
      ).toBe(0);

      // Départ de la communauté : réservé aussi ; expiré : libre.
      await http().delete('/community/profile').set(bearer(a)).expect(204);
      expect(bodyOf<ErrorBody>(await activate(c, old).expect(409)).code).toBe(
        'HANDLE_TAKEN',
      );
      await prisma.communityHandleHold.update({
        where: { handleKey: old.toLowerCase() },
        data: {
          releasedAt: new Date(Date.now() - 61 * DAY_MS),
          expiresAt: new Date(Date.now() - 1000),
        },
      });
      await activate(c, old).expect(201);
    });

    it('suppression du compte : pseudo réservé, sans lien vers le compte', async () => {
      const a = await member('hda');
      await http()
        .delete('/users/me')
        .set(bearer(a))
        .send({ password: PASSWORD })
        .expect((r) => expect([200, 204]).toContain(r.status));
      const hold = await prisma.communityHandleHold.findUnique({
        where: { handleKey: a.handle!.toLowerCase() },
      });
      expect(hold).toMatchObject({ userId: null });
      const b = await member('hdb');
      const res = await http()
        .patch('/community/profile')
        .set(bearer(b))
        .send({ handle: a.handle })
        .expect(409);
      expect(bodyOf<ErrorBody>(res).code).toBe('HANDLE_TAKEN');
      await prisma.communityHandleHold.deleteMany({
        where: { handleKey: a.handle!.toLowerCase() },
      });
    });
  });
});
