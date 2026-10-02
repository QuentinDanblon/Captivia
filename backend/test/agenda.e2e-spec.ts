import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './utils/create-app';
import { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(60000);

const TERMS = { acceptTerms: true, ageConfirmed: true };
const SPECIES_ID = 5221172;

const dayOffset = (n: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const at = (day: string, hhmm = '08:00'): Date =>
  new Date(`${day}T${hhmm}:00.000Z`);

describe('Agenda des soins E2E', () => {
  let app: INestApplication;
  let url: string;
  let prisma: PrismaService;
  const userIds: string[] = [];

  let tokenA: string;
  let tokenB: string;
  let userA: string;
  let userB: string;
  let rexId: string;
  let miloId: string;
  let secretAnimalId: string;
  let rexRoutineId: string;

  const register = async (tag: string) => {
    const res = await request(url)
      .post('/auth/register')
      .send({
        email: `agenda-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e5)}@captivia.local`,
        password: 'password123',
        ...TERMS,
      })
      .expect(201);
    userIds.push(res.body.user.id);
    return {
      token: res.body.accessToken as string,
      id: res.body.user.id as string,
    };
  };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const get = (path: string, t = tokenA) => request(url).get(path).set(auth(t));

  beforeAll(async () => {
    ({ app, url } = await createTestApp({ offlineGbif: true }));
    prisma = app.get(PrismaService);

    ({ token: tokenA, id: userA } = await register('a'));
    ({ token: tokenB, id: userB } = await register('b'));

    const rex = await prisma.animal.create({
      data: { userId: userA, speciesId: SPECIES_ID, name: 'Rex' },
    });
    const milo = await prisma.animal.create({
      data: { userId: userA, speciesId: SPECIES_ID, name: 'Milo' },
    });
    const secret = await prisma.animal.create({
      data: { userId: userB, speciesId: SPECIES_ID, name: 'Secret' },
    });
    rexId = rex.id;
    miloId = milo.id;
    secretAnimalId = secret.id;

    // Routine quotidienne à 07:30 UTC pour Rex ; routine à une date unique pour Milo.
    const routine = await prisma.routine.create({
      data: {
        animalId: rexId,
        name: 'Nourrir, matin; "soir"',
        type: 'nourrissage',
        frequency: 'daily',
        schedule: { time: '07:30', recurrence: 'daily' },
      },
    });
    rexRoutineId = routine.id;
    await prisma.routine.create({
      data: {
        animalId: miloId,
        type: 'uvb',
        frequency: 'once',
        schedule: { time: '12:00', recurrence: 'once', date: dayOffset(5) },
      },
    });
    // Routine inactive : ne doit jamais apparaître.
    await prisma.routine.create({
      data: {
        animalId: rexId,
        name: 'Inactive',
        type: 'entretien',
        frequency: 'daily',
        schedule: { time: '09:00' },
        active: false,
      },
    });

    await prisma.medication.create({
      data: {
        animalId: rexId,
        name: 'Amoxicilline',
        dose: '2',
        unit: 'ml',
        frequency: 'daily',
        startDate: at(dayOffset(-2), '00:00'),
        endDate: at(dayOffset(2), '00:00'),
        notes: 'Avec repas',
      },
    });
    // Médicament terminé : hors période.
    await prisma.medication.create({
      data: {
        animalId: rexId,
        name: 'Terminé',
        dose: '1',
        frequency: 'daily',
        startDate: at(dayOffset(-30), '00:00'),
        endDate: at(dayOffset(-10), '00:00'),
      },
    });
    await prisma.vaccination.create({
      data: {
        animalId: miloId,
        name: 'Rage',
        date: at(dayOffset(-300), '00:00'),
        nextDueDate: at(dayOffset(10), '00:00'),
      },
    });
    await prisma.vetAppointment.create({
      data: {
        animalId: rexId,
        vetName: 'Dr Martin',
        reason: 'Contrôle annuel',
        location: 'Lyon',
        date: at(dayOffset(3), '14:00'),
      },
    });
    await prisma.vetAppointment.create({
      data: {
        animalId: rexId,
        vetName: 'Dr Annulé',
        date: at(dayOffset(4), '10:00'),
        status: 'cancelled',
      },
    });

    // Données d'un autre utilisateur : ne doivent jamais fuiter.
    await prisma.routine.create({
      data: {
        animalId: secretAnimalId,
        name: 'ROUTINE-SECRETE',
        type: 'nourrissage',
        frequency: 'daily',
        schedule: { time: '06:00' },
      },
    });
    await prisma.vetAppointment.create({
      data: {
        animalId: secretAnimalId,
        vetName: 'VETO-SECRET',
        date: at(dayOffset(3), '09:00'),
      },
    });
  });

  afterAll(async () => {
    for (const id of userIds) {
      await prisma.animal.deleteMany({ where: { userId: id } });
      await prisma.user.deleteMany({ where: { id } });
    }
    if (app) await app.close();
  });

  describe('GET /users/me/agenda', () => {
    it('exige une authentification', async () => {
      await request(url).get('/users/me/agenda').expect(401);
    });

    it('agrège routines, médicaments, vaccins et RDV, triés par date', async () => {
      const res = await get(
        `/users/me/agenda?from=${dayOffset(0)}&to=${dayOffset(12)}`,
      ).expect(200);
      const { items } = res.body;
      expect(res.body.from).toBe(dayOffset(0));
      expect(res.body.to).toBe(dayOffset(12));
      expect(res.body.truncated).toBe(false);

      const types = new Set(items.map((i: { type: string }) => i.type));
      expect(types).toEqual(
        new Set(['routine', 'medication', 'vaccination', 'vet_appointment']),
      );

      const dates: string[] = items.map((i: { date: string }) => i.date);
      expect([...dates].sort()).toEqual(dates);

      for (const i of items) {
        expect(i).toEqual(
          expect.objectContaining({
            date: expect.any(String),
            type: expect.any(String),
            animalId: expect.any(String),
            animalName: expect.any(String),
            title: expect.any(String),
            status: expect.any(String),
          }),
        );
      }

      // Routine quotidienne : 13 jours (aujourd'hui inclus) à 07:30 UTC.
      const rexRoutine = items.filter(
        (i: { sourceId: string }) => i.sourceId === rexRoutineId,
      );
      expect(rexRoutine).toHaveLength(13);
      expect(rexRoutine[0]).toEqual(
        expect.objectContaining({
          date: at(dayOffset(0), '07:30').toISOString(),
          title: 'Nourrir, matin; "soir"',
          animalName: 'Rex',
          status: 'pending',
        }),
      );
      expect(items.some((i: { title: string }) => i.title === 'Inactive')).toBe(
        false,
      );

      // Routine à date unique, titre par défaut localisé (fr).
      const uvb = items.find(
        (i: { animalName: string; type: string }) =>
          i.animalName === 'Milo' && i.type === 'routine',
      );
      expect(uvb).toEqual(
        expect.objectContaining({
          day: dayOffset(5),
          title: 'UVB / éclairage',
        }),
      );

      // Médicament : du jour -2 au jour +2 → seuls aujourd'hui, +1, +2 dans la fenêtre.
      const meds = items.filter(
        (i: { type: string }) => i.type === 'medication',
      );
      expect(meds.map((m: { day: string }) => m.day)).toEqual([
        dayOffset(0),
        dayOffset(1),
        dayOffset(2),
      ]);
      expect(meds[0].title).toBe('Amoxicilline (2 ml)');
      expect(meds[0].detail).toBe('Avec repas');
      expect(
        items.some((i: { title: string }) => i.title.startsWith('Terminé')),
      ).toBe(false);

      // Vaccin : journée entière à la prochaine échéance.
      const vac = items.find((i: { type: string }) => i.type === 'vaccination');
      expect(vac).toEqual(
        expect.objectContaining({
          allDay: true,
          day: dayOffset(10),
          title: 'Rage',
          animalName: 'Milo',
        }),
      );

      // RDV : programmé (pending) et annulé (cancelled).
      const appts = items.filter(
        (i: { type: string }) => i.type === 'vet_appointment',
      );
      expect(
        appts.map((a: { title: string; status: string }) => [
          a.title,
          a.status,
        ]),
      ).toEqual([
        ['Dr Martin', 'pending'],
        ['Dr Annulé', 'cancelled'],
      ]);
      expect(appts[0].detail).toBe('Contrôle annuel - Lyon');
    });

    it('reprend le statut des événements de rappel déjà traités', async () => {
      const when = at(dayOffset(1), '07:30');
      await prisma.notificationEvent.create({
        data: {
          userId: userA,
          type: 'nourrissage',
          label: 'x',
          scheduledAt: when,
          status: 'done',
          routineId: rexRoutineId,
          animalId: rexId,
          sourceKey: `routine:${rexRoutineId}`,
        },
      });
      const res = await get(
        `/users/me/agenda?from=${dayOffset(1)}&to=${dayOffset(1)}`,
      ).expect(200);
      const r = res.body.items.find(
        (i: { sourceId: string }) => i.sourceId === rexRoutineId,
      );
      expect(r.status).toBe('done');
    });

    it("applique des valeurs par défaut (30 jours à partir d'aujourd'hui)", async () => {
      const res = await get('/users/me/agenda').expect(200);
      expect(res.body.from).toBe(dayOffset(0));
      expect(res.body.to).toBe(dayOffset(29));
    });

    it("ne renvoie JAMAIS les données d'un autre utilisateur (isolation stricte)", async () => {
      const a = await get(
        `/users/me/agenda?from=${dayOffset(0)}&to=${dayOffset(12)}`,
        tokenA,
      ).expect(200);
      expect(JSON.stringify(a.body)).not.toMatch(/SECRET|Secret/);
      expect(
        a.body.items.every((i: { animalId: string }) =>
          [rexId, miloId].includes(i.animalId),
        ),
      ).toBe(true);

      const b = await get(
        `/users/me/agenda?from=${dayOffset(0)}&to=${dayOffset(12)}`,
        tokenB,
      ).expect(200);
      expect(b.body.items.length).toBeGreaterThan(0);
      expect(
        b.body.items.every(
          (i: { animalId: string }) => i.animalId === secretAnimalId,
        ),
      ).toBe(true);
      expect(JSON.stringify(b.body)).not.toMatch(
        /Rex|Milo|Dr Martin|Amoxicilline/,
      );
    });

    it.each([
      ['from=2026-02-31&to=2026-03-02', 'date inexistante'],
      ['from=demain', 'format invalide'],
      ['from=2026-10-10&to=2026-10-01', 'to < from'],
      ['from=2026-01-01&to=2026-04-03', '93 jours'],
      ['from=2026-01-01&to=2026-01-02&foo=1', 'paramètre inconnu'],
    ])('rejette les bornes invalides : %s (%s)', async (qs) => {
      await get(`/users/me/agenda?${qs}`).expect(400);
    });

    it('accepte exactement 92 jours', async () => {
      await get('/users/me/agenda?from=2026-01-01&to=2026-04-02').expect(200);
    });
  });

  describe('jeton de flux iCalendar', () => {
    let feedToken: string;

    it('exige une authentification pour gérer le jeton', async () => {
      await request(url).get('/users/me/agenda/calendar-token').expect(401);
      await request(url).post('/users/me/agenda/calendar-token').expect(401);
      await request(url).delete('/users/me/agenda/calendar-token').expect(401);
    });

    it('refuse le flux sans jeton, avec un jeton invalide ou avant toute génération', async () => {
      await request(url).get('/users/me/agenda.ics').expect(401);
      await request(url)
        .get('/users/me/agenda.ics?token=nimportequoi')
        .expect(401);
      await request(url)
        .get(`/users/me/agenda.ics?token=${'a'.repeat(43)}`)
        .expect(401);
      const status = await get('/users/me/agenda/calendar-token').expect(200);
      expect(status.body).toEqual({ active: false });
    });

    it('génère un jeton, ne stocke que son hachage, et sert le flux sans JWT', async () => {
      const res = await request(url)
        .post('/users/me/agenda/calendar-token')
        .set(auth(tokenA))
        .expect(201);
      feedToken = res.body.token;
      expect(feedToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(res.body.feedPath).toBe(`/users/me/agenda.ics?token=${feedToken}`);
      expect(res.body.active).toBe(true);

      const stored = await prisma.user.findUnique({
        where: { id: userA },
        select: { calendarToken: true },
      });
      expect(stored?.calendarToken).toMatch(/^[0-9a-f]{64}$/);
      expect(stored?.calendarToken).not.toContain(feedToken);

      expect(
        (await get('/users/me/agenda/calendar-token').expect(200)).body,
      ).toEqual({ active: true });

      const ics = await request(url).get(res.body.feedPath).expect(200);
      expect(ics.headers['content-type']).toMatch(
        /^text\/calendar; charset=utf-8/,
      );
      expect(ics.headers['cache-control']).toContain('private');
      const body: string = ics.text;
      expect(body.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
      expect(body.endsWith('END:VCALENDAR\r\n')).toBe(true);
      expect(body).toContain('VERSION:2.0');
      expect(body).toContain('DTSTART:');
      // Échappement : virgule et point-virgule du nom de routine, guillemets conservés.
      expect(body).toContain('Nourrir\\, matin\\; "soir"');
      expect(body).toContain(
        'SUMMARY:Rendez-vous vétérinaire: Dr Martin - Rex',
      );
      expect(body).toContain('STATUS:CANCELLED');
      for (const l of body.split('\r\n'))
        expect(Buffer.byteLength(l, 'utf8')).toBeLessThanOrEqual(75);
      // Aucune donnée d'un autre utilisateur.
      expect(body).not.toMatch(/SECRET|Secret/);
    });

    it("un jeton ne donne accès qu'à SON agenda", async () => {
      const resB = await request(url)
        .post('/users/me/agenda/calendar-token')
        .set(auth(tokenB))
        .expect(201);
      const ics = await request(url).get(resB.body.feedPath).expect(200);
      expect(ics.text).toContain('Secret');
      expect(ics.text).not.toMatch(/Rex|Milo|Dr Martin/);
    });

    it("régénérer invalide l'ancien lien", async () => {
      const res = await request(url)
        .post('/users/me/agenda/calendar-token')
        .set(auth(tokenA))
        .expect(201);
      expect(res.body.token).not.toBe(feedToken);
      await request(url)
        .get(`/users/me/agenda.ics?token=${feedToken}`)
        .expect(401);
      await request(url).get(res.body.feedPath).expect(200);
      feedToken = res.body.token;
    });

    it('révoquer désactive le flux', async () => {
      const res = await request(url)
        .delete('/users/me/agenda/calendar-token')
        .set(auth(tokenA))
        .expect(200);
      expect(res.body).toEqual({ active: false });
      await request(url)
        .get(`/users/me/agenda.ics?token=${feedToken}`)
        .expect(401);
      expect(
        (await get('/users/me/agenda/calendar-token').expect(200)).body,
      ).toEqual({ active: false });
    });
  });

  it('le jeton est supprimé avec le compte', async () => {
    const { token, id } = await register('del');
    await request(url)
      .post('/users/me/agenda/calendar-token')
      .set(auth(token))
      .expect(201);
    await prisma.user.delete({ where: { id } });
    userIds.splice(userIds.indexOf(id), 1);
    expect(await prisma.user.count({ where: { id } })).toBe(0);
  });
});
