import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Boot NestJS + Prisma peut prendre du temps sur Windows
jest.setTimeout(60000);

const PASSWORD = 'ModuleA123!';

/** Email jetable unique. */
function makeEmail(tag: string): string {
  return `module-a-${tag}-${Date.now()}-${Math.floor(Math.random() * 1000)}@captivia.local`;
}

/** Date UTC du jour en YYYY-MM-DD. */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Date UTC décalée de N jours en YYYY-MM-DD. */
function dayOffsetStr(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

describe('Module A E2E — médicaments & RDV vétérinaires', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  const createdEmails: string[] = [];

  /**
   * Crée un compte jetable directement en base (isPremium selon le besoin) et
   * signe un JWT valide ({ sub, email } — le guard recharge l'utilisateur depuis
   * la DB à chaque requête). Évite /auth/register + /auth/login : le rate limit
   * auth (10/60s par IP) est partagé entre les suites e2e.
   */
  async function createUser(
    email: string,
    isPremium: boolean,
  ): Promise<{ email: string; token: string; userId: string }> {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, locale: 'fr', isPremium },
    });
    createdEmails.push(email);
    const token = jwtService.sign({ sub: user.id, email: user.email });
    return { email, token, userId: user.id };
  }

  /** Crée un compte jetable PREMIUM et retourne token + userId. */
  function registerPremium(email: string): Promise<{ email: string; token: string; userId: string }> {
    return createUser(email, true);
  }

  /** Crée un animal pour le compte et retourne son id. */
  async function createAnimal(token: string, name: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/users/me/animals')
      .set('Authorization', `Bearer ${token}`)
      .send({ speciesId: 5221172, name, sex: 'male' })
      .expect(201);
    return res.body.id as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    // Nettoyage : suppression des comptes jetables (cascade animaux, médicaments,
    // RDV, events, préférences).
    if (prisma && createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    if (app) await app.close();
  });

  // ============================================================
  // 1. CRUD médicaments (Premium)
  // ============================================================
  describe('1. CRUD medications', () => {
    let token: string;
    let animalId: string;
    let medicationId: string;

    it('POST → 201, active par défaut true', async () => {
      const acc = await registerPremium(makeEmail('med-crud'));
      token = acc.token;
      animalId = await createAnimal(token, 'Med Gecko');

      const res = await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/medications`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Vitamine D3',
          dose: '1',
          unit: 'goutte',
          frequency: 'daily',
          startDate: todayStr(),
          endDate: dayOffsetStr(30),
          notes: 'le matin',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('active', true);
      expect(res.body).toHaveProperty('name', 'Vitamine D3');
      expect(res.body).toHaveProperty('frequency', 'daily');
      medicationId = res.body.id;
    });

    it('POST every_x_hours avec intervalHours → 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/medications`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Antibiotique',
          dose: '0.5',
          unit: 'ml',
          frequency: 'every_x_hours',
          intervalHours: 8,
          startDate: todayStr(),
        })
        .expect(201);
      expect(res.body).toHaveProperty('intervalHours', 8);
    });

    it('GET → 200, tri par startDate desc', async () => {
      // Deux médicaments avec des startDate différentes
      await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/medications`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Ancien',
          dose: '1',
          frequency: 'daily',
          startDate: dayOffsetStr(-10),
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/users/me/animals/${animalId}/medications`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
      const dates = res.body.map((m: { startDate: string }) => new Date(m.startDate).getTime());
      const sorted = [...dates].sort((a, b) => b - a);
      expect(dates).toEqual(sorted);
    });

    it('PATCH → 200 (dose + active:false pour arrêter)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/me/animals/${animalId}/medications/${medicationId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ dose: '2', active: false })
        .expect(200);

      expect(res.body).toHaveProperty('dose', '2');
      expect(res.body).toHaveProperty('active', false);
    });

    it('DELETE → 200 puis GET → disparu', async () => {
      await request(app.getHttpServer())
        .delete(`/users/me/animals/${animalId}/medications/${medicationId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/users/me/animals/${animalId}/medications`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.some((m: { id: string }) => m.id === medicationId)).toBe(false);
    });

    it('DELETE id inexistant → 404', () => {
      return request(app.getHttpServer())
        .delete(`/users/me/animals/${animalId}/medications/${crypto.randomUUID()}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // ============================================================
  // 2. CRUD RDV vétérinaires (Premium)
  // ============================================================
  describe('2. CRUD vet-appointments', () => {
    let token: string;
    let animalId: string;
    let appointmentId: string;

    it('POST → 201, reminderDays par défaut [7,1]', async () => {
      const acc = await registerPremium(makeEmail('vet-crud'));
      token = acc.token;
      animalId = await createAnimal(token, 'Vet Gecko');

      const res = await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/vet-appointments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          vetName: 'Dr Martin',
          reason: 'Contrôle annuel',
          date: dayOffsetStr(10),
          location: 'Clinique du Lac',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('status', 'scheduled');
      expect(res.body.reminderDays).toEqual([7, 1]);
      appointmentId = res.body.id;
    });

    it('POST reminderDays personnalisés → 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/vet-appointments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          vetName: 'Dr Petit',
          date: dayOffsetStr(5),
          reminderDays: [2, 0],
        })
        .expect(201);
      expect(res.body.reminderDays).toEqual([2, 0]);
    });

    it('GET → 200, tri par date desc', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/me/animals/${animalId}/vet-appointments`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      const dates = res.body.map((a: { date: string }) => new Date(a.date).getTime());
      const sorted = [...dates].sort((a, b) => b - a);
      expect(dates).toEqual(sorted);
    });

    it('PATCH status → 200 (scheduled → done)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/me/animals/${animalId}/vet-appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'done' })
        .expect(200);
      expect(res.body).toHaveProperty('status', 'done');
    });

    it('PATCH status invalide → 400', () => {
      return request(app.getHttpServer())
        .patch(`/users/me/animals/${animalId}/vet-appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'nope' })
        .expect(400);
    });

    it('DELETE → 200', async () => {
      await request(app.getHttpServer())
        .delete(`/users/me/animals/${animalId}/vet-appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/users/me/animals/${animalId}/vet-appointments`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.some((a: { id: string }) => a.id === appointmentId)).toBe(false);
    });
  });

  // ============================================================
  // 3. Validation DTOs (400)
  // ============================================================
  describe('3. Validation DTOs', () => {
    let token: string;
    let animalId: string;

    it('POST medication frequency invalide → 400', async () => {
      const acc = await registerPremium(makeEmail('dto-med'));
      token = acc.token;
      animalId = await createAnimal(token, 'Dto Gecko');

      await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/medications`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'X', dose: '1', frequency: 'hourly', startDate: todayStr() })
        .expect(400);
    });

    it('POST medication startDate impossible → 400', () => {
      return request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/medications`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'X', dose: '1', frequency: 'daily', startDate: '2026-13-45' })
        .expect(400);
    });

    it('POST medication name vide → 400', () => {
      return request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/medications`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '   ', dose: '1', frequency: 'daily', startDate: todayStr() })
        .expect(400);
    });

    it('POST medication intervalHours > 24 → 400', () => {
      return request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/medications`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'X',
          dose: '1',
          frequency: 'every_x_hours',
          intervalHours: 48,
          startDate: todayStr(),
        })
        .expect(400);
    });

    it('POST vet-appointment date impossible → 400', () => {
      return request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/vet-appointments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ vetName: 'Dr X', date: '2026-02-30' })
        .expect(400);
    });

    it('POST vet-appointment reminderDays hors bornes → 400', () => {
      return request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/vet-appointments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ vetName: 'Dr X', date: todayStr(), reminderDays: [31] })
        .expect(400);
    });

    it('POST vet-appointment vetName vide → 400', () => {
      return request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/vet-appointments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ vetName: '', date: todayStr() })
        .expect(400);
    });
  });

  // ============================================================
  // 4. Guards — premium requis + ownership
  // ============================================================
  describe('4. Guards premium & ownership', () => {
    let premiumToken: string;
    let animalId: string;
    let freeToken: string;

    it('compte non-premium → 403 sur medications et vet-appointments', async () => {
      const acc = await registerPremium(makeEmail('owner'));
      premiumToken = acc.token;
      animalId = await createAnimal(premiumToken, 'Guard Gecko');

      const free = await createUser(makeEmail('free'), false);
      freeToken = free.token;

      await request(app.getHttpServer())
        .get(`/users/me/animals/${animalId}/medications`)
        .set('Authorization', `Bearer ${freeToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/medications`)
        .set('Authorization', `Bearer ${freeToken}`)
        .send({ name: 'X', dose: '1', frequency: 'daily', startDate: todayStr() })
        .expect(403);
      await request(app.getHttpServer())
        .get(`/users/me/animals/${animalId}/vet-appointments`)
        .set('Authorization', `Bearer ${freeToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/vet-appointments`)
        .set('Authorization', `Bearer ${freeToken}`)
        .send({ vetName: 'Dr X', date: todayStr() })
        .expect(403);
    });

    it('sans token → 401', () => {
      return request(app.getHttpServer())
        .get(`/users/me/animals/${animalId}/medications`)
        .expect(401);
    });

    it('animal d’autrui (autre compte premium) → 403', async () => {
      const other = await registerPremium(makeEmail('other'));
      await request(app.getHttpServer())
        .get(`/users/me/animals/${animalId}/medications`)
        .set('Authorization', `Bearer ${other.token}`)
        .expect(403);
      await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/vet-appointments`)
        .set('Authorization', `Bearer ${other.token}`)
        .send({ vetName: 'Dr X', date: todayStr() })
        .expect(403);
    });

    it('animal inexistant → 404', () => {
      return request(app.getHttpServer())
        .get(`/users/me/animals/${crypto.randomUUID()}/medications`)
        .set('Authorization', `Bearer ${premiumToken}`)
        .expect(404);
    });
  });

  // ============================================================
  // 5. Pipeline events — medication + RDV → events, done sans points
  // ============================================================
  describe('5. Pipeline events module A', () => {
    let token: string;
    let userId: string;
    let animalId: string;
    let medicationId: string;
    let medEventId: string;

    it('medication active + RDV (jour même + rappel J-1) → events générés', async () => {
      const acc = await registerPremium(makeEmail('events'));
      token = acc.token;
      userId = acc.userId;
      animalId = await createAnimal(token, 'Events Gecko');

      // Médicament actif démarré aujourd'hui
      const med = await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/medications`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Calcium', dose: '2ml', frequency: 'weekly', startDate: todayStr() })
        .expect(201);
      medicationId = med.body.id;

      // RDV aujourd'hui (événement du jour) + RDV demain avec rappel J-1
      await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/vet-appointments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ vetName: 'Dr Jour', date: todayStr(), reminderDays: [1] })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/vet-appointments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ vetName: 'Dr Demain', date: dayOffsetStr(1), reminderDays: [1] })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/users/me/notification-events?date=${todayStr()}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const medEvents = res.body.filter(
        (e: { type: string; medicationId?: string }) => e.type === 'medication',
      );
      expect(medEvents.length).toBe(1);
      expect(medEvents[0]).toMatchObject({
        medicationId,
        status: 'pending',
        pointsAwarded: 0,
      });
      expect(medEvents[0].label).toContain('Calcium');
      medEventId = medEvents[0].id;

      const vetEvents = res.body.filter(
        (e: { type: string; appointmentId?: string }) => e.type === 'vet_appointment',
      );
      // 🏥 RDV Dr Jour (jour même) + 🔔 Dr Demain (J-1)
      expect(vetEvents.length).toBe(2);
      const labels = vetEvents.map((e: { label: string }) => e.label);
      expect(labels.some((l: string) => l.includes('🏥 RDV Dr Jour'))).toBe(true);
      expect(labels.some((l: string) => l.includes('🔔 Dr Demain (J-1)'))).toBe(true);
      for (const ev of vetEvents) {
        expect(ev).toMatchObject({ status: 'pending', pointsAwarded: 0 });
      }
    });

    it('PATCH event medication done → pointsAwarded 0, grade.points 0', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/me/notification-events/${medEventId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'done' })
        .expect(200);

      expect(res.body.event).toHaveProperty('status', 'done');
      expect(res.body.event).toHaveProperty('pointsAwarded', 0);
      expect(res.body.grade).toHaveProperty('points', 0);
    });

    it('médicament désactivé ou futur → plus d’event (refresh)', async () => {
      // Médicament futur : ne doit jamais générer d'event
      await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/medications`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Futur', dose: '1', frequency: 'daily', startDate: dayOffsetStr(5) })
        .expect(201);

      // Désactive le médicament actif
      await request(app.getHttpServer())
        .patch(`/users/me/animals/${animalId}/medications/${medicationId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ active: false })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/users/me/notification-events?date=${todayStr()}&refresh=1`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // W0-07 : refresh ne supprime que les événements `pending` ; l'événement déjà
      // traité (done, ci-dessus) est conservé et ne doit pas être recréé.
      const medEvents = res.body.filter(
        (e: { type: string; status: string }) =>
          e.type === 'medication' && e.status === 'pending',
      );
      expect(medEvents.length).toBe(0);
    });

    it('RDV annulé → plus d’event (refresh)', async () => {
      const appt = await request(app.getHttpServer())
        .post(`/users/me/animals/${animalId}/vet-appointments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ vetName: 'Dr Annulé', date: dayOffsetStr(2), reminderDays: [2] })
        .expect(201);

      const before = await request(app.getHttpServer())
        .get(`/users/me/notification-events?date=${todayStr()}&refresh=1`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const reminderBefore = before.body.filter(
        (e: { type: string; label: string }) =>
          e.type === 'vet_appointment' && e.label.includes('Dr Annulé'),
      );
      expect(reminderBefore.length).toBe(1);

      // Annulation du RDV (le rappel J-2 d'hier existe déjà, mais le refresh
      // régénère : plus rien pour ce RDV)
      await request(app.getHttpServer())
        .patch(`/users/me/animals/${animalId}/vet-appointments/${appt.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'cancelled' })
        .expect(200);

      const after = await request(app.getHttpServer())
        .get(`/users/me/notification-events?date=${todayStr()}&refresh=1`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const reminderAfter = after.body.filter(
        (e: { type: string; label: string }) =>
          e.type === 'vet_appointment' && e.label.includes('Dr Annulé'),
      );
      expect(reminderAfter.length).toBe(0);
    });

    it('events medication/vet ne donnent jamais de points (grade intact)', async () => {
      const grade = await request(app.getHttpServer())
        .get('/users/me/grade')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(grade.body.points).toBe(0);
    });
  });
});
