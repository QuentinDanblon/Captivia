import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { IdBody, bodyOf, httpServer } from './utils/http';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { CacheModule } from '../src/cache/cache.module';
import { TestCacheModule } from './test-cache.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Boot NestJS + Prisma peut prendre du temps sur Windows
jest.setTimeout(60000);

const PASSWORD = 'ModuleC123!';

/** Email jetable unique. */
function makeEmail(tag: string): string {
  return `module-c-${tag}-${Date.now()}-${Math.floor(Math.random() * 1000)}@captivia.local`;
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

/** Forme (partielle) de l'export du carnet (`/carnet/export`) consultée par ces tests. */
interface VaccinationEvent {
  id: string;
  type: string;
  label: string;
}

interface CarnetExport {
  animal: { photos: unknown };
  sections: {
    healthRecords: { title: string }[];
    measurements: { weightKg: number }[];
    vaccinations: { name: string }[];
    medications: { name: string }[];
    vetAppointments: { vetName: string }[];
    routines: { type: string }[];
    actionLogs: { type: string }[];
  };
}

describe('Module C E2E — carnet de santé enrichi (mesures, vaccinations, export)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  const createdEmails: string[] = [];

  /** Crée un compte jetable directement en base et signe un JWT valide. */
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

  function registerPremium(
    email: string,
  ): Promise<{ email: string; token: string; userId: string }> {
    return createUser(email, true);
  }

  async function createAnimal(token: string, name: string): Promise<string> {
    const res = await request(httpServer(app))
      .post('/users/me/animals')
      .set('Authorization', `Bearer ${token}`)
      .send({ speciesId: 5221172, name, sex: 'male' })
      .expect(201);
    return bodyOf<IdBody>(res).id;
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
    // Nettoyage : suppression des comptes jetables (cascade animaux, mesures,
    // vaccins, events, préférences…).
    if (prisma && createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    if (app) await app.close();
  });

  // ============================================================
  // 1. CRUD mesures poids/taille (Premium)
  // ============================================================
  describe('1. CRUD measurements', () => {
    let token: string;
    let animalId: string;
    let measurementId: string;

    it('POST → 201 (weightKg seul)', async () => {
      const acc = await registerPremium(makeEmail('meas-crud'));
      token = acc.token;
      animalId = await createAnimal(token, 'Meas Gecko');

      const res = await request(httpServer(app))
        .post(`/users/me/animals/${animalId}/measurements`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          weightKg: 12.5,
          measuredAt: todayStr(),
          notes: 'pesée mensuelle',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('weightKg', 12.5);
      expect(res.body).toHaveProperty('heightCm', null);
      expect(res.body).toHaveProperty('notes', 'pesée mensuelle');
      measurementId = bodyOf<IdBody>(res).id;
    });

    it('POST → 201 (heightCm seul, sans poids)', async () => {
      const res = await request(httpServer(app))
        .post(`/users/me/animals/${animalId}/measurements`)
        .set('Authorization', `Bearer ${token}`)
        .send({ heightCm: 40, measuredAt: todayStr() })
        .expect(201);
      expect(res.body).toHaveProperty('heightCm', 40);
      expect(res.body).toHaveProperty('weightKg', null);
    });

    it('POST sans poids ni taille → 400', () => {
      return request(httpServer(app))
        .post(`/users/me/animals/${animalId}/measurements`)
        .set('Authorization', `Bearer ${token}`)
        .send({ measuredAt: todayStr() })
        .expect(400);
    });

    it('GET → 200, tri par measuredAt desc', async () => {
      // Mesure plus ancienne
      await request(httpServer(app))
        .post(`/users/me/animals/${animalId}/measurements`)
        .set('Authorization', `Bearer ${token}`)
        .send({ weightKg: 10, measuredAt: dayOffsetStr(-30) })
        .expect(201);

      const res = await request(httpServer(app))
        .get(`/users/me/animals/${animalId}/measurements`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(bodyOf<unknown[]>(res).length).toBeGreaterThanOrEqual(3);
      const dates = bodyOf<{ measuredAt: string }[]>(res).map((m) =>
        new Date(m.measuredAt).getTime(),
      );
      const sorted = [...dates].sort((a, b) => b - a);
      expect(dates).toEqual(sorted);
    });

    it('PATCH → 200 (poids + notes)', async () => {
      const res = await request(httpServer(app))
        .patch(`/users/me/animals/${animalId}/measurements/${measurementId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ weightKg: 13.2, notes: 'corrigé' })
        .expect(200);
      expect(res.body).toHaveProperty('weightKg', 13.2);
      expect(res.body).toHaveProperty('notes', 'corrigé');
    });

    it('DELETE → 200 puis GET → disparu', async () => {
      await request(httpServer(app))
        .delete(`/users/me/animals/${animalId}/measurements/${measurementId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const res = await request(httpServer(app))
        .get(`/users/me/animals/${animalId}/measurements`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(
        bodyOf<{ id: string }[]>(res).some((m) => m.id === measurementId),
      ).toBe(false);
    });

    it('DELETE id inexistant → 404', () => {
      return request(httpServer(app))
        .delete(
          `/users/me/animals/${animalId}/measurements/${crypto.randomUUID()}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // ============================================================
  // 2. CRUD vaccinations (Premium)
  // ============================================================
  describe('2. CRUD vaccinations', () => {
    let token: string;
    let animalId: string;
    let vaccinationId: string;

    it('POST → 201 (avec rappel futur)', async () => {
      const acc = await registerPremium(makeEmail('vac-crud'));
      token = acc.token;
      animalId = await createAnimal(token, 'Vac Gecko');

      const res = await request(httpServer(app))
        .post(`/users/me/animals/${animalId}/vaccinations`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Rage',
          date: todayStr(),
          nextDueDate: dayOffsetStr(365),
          batchNumber: 'LOT-2026-01',
          vetName: 'Dr Martin',
          notes: 'vaccin annuel',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name', 'Rage');
      expect(res.body).toHaveProperty('batchNumber', 'LOT-2026-01');
      expect(res.body).toHaveProperty('vetName', 'Dr Martin');
      vaccinationId = bodyOf<IdBody>(res).id;
    });

    it('POST → 201 (sans rappel)', async () => {
      const res = await request(httpServer(app))
        .post(`/users/me/animals/${animalId}/vaccinations`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tétanos', date: dayOffsetStr(-100) })
        .expect(201);
      expect(res.body).toHaveProperty('name', 'Tétanos');
      expect(res.body).toHaveProperty('nextDueDate', null);
    });

    it('GET → 200, tri par date desc', async () => {
      const res = await request(httpServer(app))
        .get(`/users/me/animals/${animalId}/vaccinations`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(bodyOf<unknown[]>(res).length).toBeGreaterThanOrEqual(2);
      const dates = bodyOf<{ date: string }[]>(res).map((v) =>
        new Date(v.date).getTime(),
      );
      const sorted = [...dates].sort((a, b) => b - a);
      expect(dates).toEqual(sorted);
    });

    it('PATCH → 200 (name + vetName)', async () => {
      const res = await request(httpServer(app))
        .patch(`/users/me/animals/${animalId}/vaccinations/${vaccinationId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Rage (rappel)', vetName: 'Dr Petit' })
        .expect(200);
      expect(res.body).toHaveProperty('name', 'Rage (rappel)');
      expect(res.body).toHaveProperty('vetName', 'Dr Petit');
    });

    it('PATCH champs vidés (null) → rappel, lot et notes effacés', async () => {
      const res = await request(httpServer(app))
        .patch(`/users/me/animals/${animalId}/vaccinations/${vaccinationId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ nextDueDate: null, batchNumber: null, notes: null })
        .expect(200);
      expect(res.body).toHaveProperty('nextDueDate', null);
      expect(res.body).toHaveProperty('batchNumber', null);
      expect(res.body).toHaveProperty('notes', null);
    });

    it('DELETE → 200 puis GET → disparu', async () => {
      await request(httpServer(app))
        .delete(`/users/me/animals/${animalId}/vaccinations/${vaccinationId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const res = await request(httpServer(app))
        .get(`/users/me/animals/${animalId}/vaccinations`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(
        bodyOf<{ id: string }[]>(res).some((v) => v.id === vaccinationId),
      ).toBe(false);
    });

    it('DELETE id inexistant → 404', () => {
      return request(httpServer(app))
        .delete(
          `/users/me/animals/${animalId}/vaccinations/${crypto.randomUUID()}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // ============================================================
  // 3. Validation DTOs (400)
  // ============================================================
  describe('3. Validation DTOs', () => {
    let token: string;
    let animalId: string;

    it('POST measurement poids ou taille à 0 → 400', async () => {
      const acc = await registerPremium(makeEmail('val-zero'));
      const zeroAnimalId = await createAnimal(acc.token, 'Zero');
      for (const body of [{ weightKg: 0 }, { heightCm: 0 }]) {
        await request(httpServer(app))
          .post(`/users/me/animals/${zeroAnimalId}/measurements`)
          .set('Authorization', `Bearer ${acc.token}`)
          .send({ measuredAt: todayStr(), ...body })
          .expect(400);
      }
    });

    it('POST measurement poids négatif → 400', async () => {
      const acc = await registerPremium(makeEmail('dto-meas'));
      token = acc.token;
      animalId = await createAnimal(token, 'Dto Gecko');

      await request(httpServer(app))
        .post(`/users/me/animals/${animalId}/measurements`)
        .set('Authorization', `Bearer ${token}`)
        .send({ weightKg: -1, measuredAt: todayStr() })
        .expect(400);
    });

    it('POST measurement poids > 10000 → 400', () => {
      return request(httpServer(app))
        .post(`/users/me/animals/${animalId}/measurements`)
        .set('Authorization', `Bearer ${token}`)
        .send({ weightKg: 15000, measuredAt: todayStr() })
        .expect(400);
    });

    it('POST measurement date impossible → 400', () => {
      return request(httpServer(app))
        .post(`/users/me/animals/${animalId}/measurements`)
        .set('Authorization', `Bearer ${token}`)
        .send({ weightKg: 1, measuredAt: '2026-13-45' })
        .expect(400);
    });

    it('POST measurement notes > 500 → 400', () => {
      return request(httpServer(app))
        .post(`/users/me/animals/${animalId}/measurements`)
        .set('Authorization', `Bearer ${token}`)
        .send({ weightKg: 1, measuredAt: todayStr(), notes: 'x'.repeat(501) })
        .expect(400);
    });

    it('POST vaccination name vide (espaces) → 400', () => {
      return request(httpServer(app))
        .post(`/users/me/animals/${animalId}/vaccinations`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '   ', date: todayStr() })
        .expect(400);
    });

    it('POST vaccination name > 100 → 400', () => {
      return request(httpServer(app))
        .post(`/users/me/animals/${animalId}/vaccinations`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'x'.repeat(101), date: todayStr() })
        .expect(400);
    });

    it('POST vaccination date impossible → 400', () => {
      return request(httpServer(app))
        .post(`/users/me/animals/${animalId}/vaccinations`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Rage', date: '2026-02-30' })
        .expect(400);
    });

    it('POST vaccination nextDueDate impossible → 400', () => {
      return request(httpServer(app))
        .post(`/users/me/animals/${animalId}/vaccinations`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Rage', date: todayStr(), nextDueDate: '2026-13-01' })
        .expect(400);
    });

    it('POST vaccination nextDueDate < date → 400 (vérifié dans le service)', () => {
      return request(httpServer(app))
        .post(`/users/me/animals/${animalId}/vaccinations`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Rage',
          date: todayStr(),
          nextDueDate: dayOffsetStr(-30),
        })
        .expect(400);
    });

    it('POST vaccination batchNumber > 100 → 400', () => {
      return request(httpServer(app))
        .post(`/users/me/animals/${animalId}/vaccinations`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Rage', date: todayStr(), batchNumber: 'x'.repeat(101) })
        .expect(400);
    });
  });

  // ============================================================
  // 4. Guards — ownership (D-16 : plus de Premium requis pour le carnet)
  // ============================================================
  describe('4. Guards ownership (carnet sans Premium, D-16)', () => {
    let premiumToken: string;
    let animalId: string;
    let freeToken: string;

    it('D-16 : compte gratuit → measurements, vaccinations et export de SON animal accessibles', async () => {
      const acc = await registerPremium(makeEmail('owner-c'));
      premiumToken = acc.token;
      animalId = await createAnimal(premiumToken, 'Guard C Gecko');

      const free = await createUser(makeEmail('free-c'), false);
      freeToken = free.token;
      const freeAnimalId = await createAnimal(freeToken, 'Free C Gecko');

      await request(httpServer(app))
        .get(`/users/me/animals/${freeAnimalId}/measurements`)
        .set('Authorization', `Bearer ${freeToken}`)
        .expect(200);
      await request(httpServer(app))
        .post(`/users/me/animals/${freeAnimalId}/measurements`)
        .set('Authorization', `Bearer ${freeToken}`)
        .send({ weightKg: 1, measuredAt: todayStr() })
        .expect(201);
      await request(httpServer(app))
        .get(`/users/me/animals/${freeAnimalId}/vaccinations`)
        .set('Authorization', `Bearer ${freeToken}`)
        .expect(200);
      await request(httpServer(app))
        .post(`/users/me/animals/${freeAnimalId}/vaccinations`)
        .set('Authorization', `Bearer ${freeToken}`)
        .send({ name: 'Rage', date: todayStr() })
        .expect(201);
      await request(httpServer(app))
        .get(`/users/me/animals/${freeAnimalId}/carnet/export`)
        .set('Authorization', `Bearer ${freeToken}`)
        .expect(200);
    });

    it('compte gratuit → 403 sur le carnet d’un animal d’autrui (ownership)', async () => {
      await request(httpServer(app))
        .get(`/users/me/animals/${animalId}/measurements`)
        .set('Authorization', `Bearer ${freeToken}`)
        .expect(403);
      await request(httpServer(app))
        .get(`/users/me/animals/${animalId}/carnet/export`)
        .set('Authorization', `Bearer ${freeToken}`)
        .expect(403);
    });

    it('sans token → 401', () => {
      return request(httpServer(app))
        .get(`/users/me/animals/${animalId}/measurements`)
        .expect(401);
    });

    it('animal d’autrui (autre compte premium) → 403', async () => {
      const other = await registerPremium(makeEmail('other-c'));
      await request(httpServer(app))
        .get(`/users/me/animals/${animalId}/measurements`)
        .set('Authorization', `Bearer ${other.token}`)
        .expect(403);
      await request(httpServer(app))
        .post(`/users/me/animals/${animalId}/vaccinations`)
        .set('Authorization', `Bearer ${other.token}`)
        .send({ name: 'Rage', date: todayStr() })
        .expect(403);
      await request(httpServer(app))
        .get(`/users/me/animals/${animalId}/carnet/export`)
        .set('Authorization', `Bearer ${other.token}`)
        .expect(403);
    });

    it('animal inexistant → 404', () => {
      return request(httpServer(app))
        .get(`/users/me/animals/${crypto.randomUUID()}/measurements`)
        .set('Authorization', `Bearer ${premiumToken}`)
        .expect(404);
    });
  });

  // ============================================================
  // 5. Pipeline events — rappel vaccin (nextDueDate == aujourd'hui)
  // ============================================================
  describe('5. Pipeline events rappel vaccin', () => {
    let token: string;
    let animalId: string;
    let vaccinationId: string;
    let eventId: string;

    it('vaccination avec nextDueDate = aujourd’hui → event type vaccination', async () => {
      const acc = await registerPremium(makeEmail('vac-events'));
      token = acc.token;
      animalId = await createAnimal(token, 'Vac Events Gecko');

      const vac = await request(httpServer(app))
        .post(`/users/me/animals/${animalId}/vaccinations`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Rage',
          date: dayOffsetStr(-365),
          nextDueDate: todayStr(),
        })
        .expect(201);
      vaccinationId = bodyOf<IdBody>(vac).id;

      const res = await request(httpServer(app))
        .get(`/users/me/notification-events?date=${todayStr()}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const vacEvents = bodyOf<VaccinationEvent[]>(res).filter(
        (e) => e.type === 'vaccination',
      );
      expect(vacEvents.length).toBe(1);
      expect(vacEvents[0]).toMatchObject({
        vaccinationId,
        status: 'pending',
        pointsAwarded: 0,
      });
      expect(vacEvents[0].label).toBe('Rappel de vaccin : Rage');
      eventId = vacEvents[0].id;
    });

    it('anti-doublon : nouvelle requête sans refresh → toujours 1 event', async () => {
      const res = await request(httpServer(app))
        .get(`/users/me/notification-events?date=${todayStr()}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const vacEvents = bodyOf<{ type: string }[]>(res).filter(
        (e) => e.type === 'vaccination',
      );
      expect(vacEvents.length).toBe(1);
    });

    it('PATCH event vaccination done → pointsAwarded 0, grade.points 0', async () => {
      const res = await request(httpServer(app))
        .patch(`/users/me/notification-events/${eventId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'done' })
        .expect(200);
      const marked = bodyOf<{ event: object; grade: object }>(res);
      expect(marked.event).toHaveProperty('status', 'done');
      expect(marked.event).toHaveProperty('pointsAwarded', 0);
      expect(marked.grade).toHaveProperty('points', 0);
    });

    it('vaccination sans nextDueDate ou future → pas d’event (refresh)', async () => {
      // Vaccin sans rappel
      await request(httpServer(app))
        .post(`/users/me/animals/${animalId}/vaccinations`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tétanos', date: todayStr() })
        .expect(201);
      // Vaccin avec rappel dans le futur
      await request(httpServer(app))
        .post(`/users/me/animals/${animalId}/vaccinations`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Hépatite',
          date: todayStr(),
          nextDueDate: dayOffsetStr(30),
        })
        .expect(201);

      // Le vaccin Rage (rappel aujourd'hui) est supprimé : plus aucun rappel dû aujourd'hui
      await request(httpServer(app))
        .delete(`/users/me/animals/${animalId}/vaccinations/${vaccinationId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const res = await request(httpServer(app))
        .get(`/users/me/notification-events?date=${todayStr()}&refresh=1`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      // W0-07 : refresh ne supprime que les événements `pending` ; l'événement déjà
      // traité (done, ci-dessus) est conservé et ne doit pas être recréé.
      const vacEvents = bodyOf<{ type: string; status: string }[]>(res).filter(
        (e) => e.type === 'vaccination' && e.status === 'pending',
      );
      expect(vacEvents.length).toBe(0);
    });
  });

  // ============================================================
  // 6. Export du carnet complet
  // ============================================================
  describe('6. Export carnet', () => {
    let token: string;
    let animalId: string;

    it('GET export → 200, sections complètes + Content-Disposition', async () => {
      const acc = await registerPremium(makeEmail('export'));
      token = acc.token;
      animalId = await createAnimal(token, 'Export Gecko');

      // Remplir chaque section
      await request(httpServer(app))
        .post(`/users/me/animals/${animalId}/health-records`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'vaccine', title: 'Vaccin rage', date: todayStr() })
        .expect(201);
      await request(httpServer(app))
        .post(`/users/me/animals/${animalId}/measurements`)
        .set('Authorization', `Bearer ${token}`)
        .send({ weightKg: 12.5, heightCm: 40, measuredAt: todayStr() })
        .expect(201);
      await request(httpServer(app))
        .post(`/users/me/animals/${animalId}/vaccinations`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Rage', date: todayStr() })
        .expect(201);
      await request(httpServer(app))
        .post(`/users/me/animals/${animalId}/medications`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Calcium',
          dose: '1',
          frequency: 'daily',
          startDate: todayStr(),
        })
        .expect(201);
      await request(httpServer(app))
        .post(`/users/me/animals/${animalId}/vet-appointments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ vetName: 'Dr Martin', date: dayOffsetStr(10) })
        .expect(201);
      await request(httpServer(app))
        .post(`/users/me/animals/${animalId}/routines`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'nourrissage',
          frequency: 'daily',
          schedule: { time: '08:00', recurrence: 'daily' },
        })
        .expect(201);
      await request(httpServer(app))
        .post(`/users/me/animals/${animalId}/history`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'nettoyage', note: 'nettoyage du terrarium' })
        .expect(201);

      const res = await request(httpServer(app))
        .get(`/users/me/animals/${animalId}/carnet/export`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Content-Disposition attachment filename=carnet-<slug>.json
      const disposition = res.headers['content-disposition'];
      expect(disposition).toContain('attachment');
      expect(disposition).toContain('filename="carnet-export-gecko.json"');

      expect(res.body).toHaveProperty('exportedAt');
      const exported = bodyOf<CarnetExport>(res);
      expect(exported.animal).toHaveProperty('name', 'Export Gecko');
      expect(Array.isArray(exported.animal.photos)).toBe(true);

      const sections = exported.sections;
      expect(sections).toHaveProperty('healthRecords');
      expect(sections).toHaveProperty('measurements');
      expect(sections).toHaveProperty('vaccinations');
      expect(sections).toHaveProperty('medications');
      expect(sections).toHaveProperty('vetAppointments');
      expect(sections).toHaveProperty('routines');
      expect(sections).toHaveProperty('actionLogs');

      expect(sections.healthRecords.length).toBe(1);
      expect(sections.healthRecords[0].title).toBe('Vaccin rage');
      expect(sections.measurements.length).toBe(1);
      expect(sections.measurements[0].weightKg).toBe(12.5);
      expect(sections.vaccinations.length).toBe(1);
      expect(sections.vaccinations[0].name).toBe('Rage');
      expect(sections.medications.length).toBe(1);
      expect(sections.medications[0].name).toBe('Calcium');
      expect(sections.vetAppointments.length).toBe(1);
      expect(sections.vetAppointments[0].vetName).toBe('Dr Martin');
      expect(sections.routines.length).toBe(1);
      expect(sections.routines[0].type).toBe('nourrissage');
      expect(sections.actionLogs.length).toBe(1);
      expect(sections.actionLogs[0].type).toBe('nettoyage');
    });

    it('export animal d’autrui → 403', async () => {
      const other = await registerPremium(makeEmail('export-other'));
      await request(httpServer(app))
        .get(`/users/me/animals/${animalId}/carnet/export`)
        .set('Authorization', `Bearer ${other.token}`)
        .expect(403);
    });
  });
});
