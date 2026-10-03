import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './utils/create-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { bodyOf, AuthBody } from './utils/http';

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

/** Forme (partielle) de la réponse de l'agenda et du flux calendrier consultée par ces tests. */
interface AgendaItem {
  date: string;
  day: string;
  type: string;
  sourceId: string;
  animalId: string;
  animalName: string;
  title: string;
  detail?: string;
  status: string;
}
interface AgendaBody {
  from: string;
  to: string;
  truncated: boolean;
  items: AgendaItem[];
  feedPath: string;
  token: string;
  active: boolean;
}

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
    userIds.push(bodyOf<AuthBody>(res).user.id);
    return {
      token: bodyOf<AuthBody>(res).accessToken,
      id: bodyOf<AuthBody>(res).user.id,
    };
  };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const get = (path: string, t = tokenA) => request(url).get(path).set(auth(t));

  beforeAll(async () => {
    ({ app, url } = await createTestApp());
    prisma = app.get(PrismaService);

    ({ token: tokenA, id: userA } = await register('a'));
    ({ token: tokenB, id: userB } = await register('b'));
    // Ces scénarios raisonnent en jours et heures UTC : fuseau UTC (le défaut est Europe/Paris,
    // couvert plus bas). Sinon, entre 22 h et minuit UTC, « aujourd'hui » diffère d'un jour.
    await prisma.user.updateMany({
      where: { id: { in: [userA, userB] } },
      data: { timezone: 'UTC' },
    });

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
      const { items } = bodyOf<AgendaBody>(res);
      expect(bodyOf<AgendaBody>(res).from).toBe(dayOffset(0));
      expect(bodyOf<AgendaBody>(res).to).toBe(dayOffset(12));
      expect(bodyOf<AgendaBody>(res).truncated).toBe(false);

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
      const r = bodyOf<AgendaBody>(res).items.find(
        (i: { sourceId: string }) => i.sourceId === rexRoutineId,
      );
      expect(r!.status).toBe('done');
    });

    it("applique des valeurs par défaut (30 jours à partir d'aujourd'hui)", async () => {
      const res = await get('/users/me/agenda').expect(200);
      expect(bodyOf<AgendaBody>(res).from).toBe(dayOffset(0));
      expect(bodyOf<AgendaBody>(res).to).toBe(dayOffset(29));
    });

    it("ne renvoie JAMAIS les données d'un autre utilisateur (isolation stricte)", async () => {
      const a = await get(
        `/users/me/agenda?from=${dayOffset(0)}&to=${dayOffset(12)}`,
        tokenA,
      ).expect(200);
      expect(JSON.stringify(a.body)).not.toMatch(/SECRET|Secret/);
      expect(
        bodyOf<AgendaBody>(a).items.every((i: { animalId: string }) =>
          [rexId, miloId].includes(i.animalId),
        ),
      ).toBe(true);

      const b = await get(
        `/users/me/agenda?from=${dayOffset(0)}&to=${dayOffset(12)}`,
        tokenB,
      ).expect(200);
      expect(bodyOf<AgendaBody>(b).items.length).toBeGreaterThan(0);
      expect(
        bodyOf<AgendaBody>(b).items.every(
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
      ['from=2026-01-01&to=2027-01-02', '367 jours'],
      ['from=2026-01-01&to=2026-01-02&foo=1', 'paramètre inconnu'],
    ])('rejette les bornes invalides : %s (%s)', async (qs) => {
      await get(`/users/me/agenda?${qs}`).expect(400);
    });

    it.each([
      ['2026-01-01', '2026-04-02'],
      ['2028-01-01', '2028-12-31'],
    ])('accepte une période de 92 à 366 jours : %s → %s', async (from, to) => {
      await get(`/users/me/agenda?from=${from}&to=${to}`).expect(200);
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
      feedToken = bodyOf<AgendaBody>(res).token;
      expect(feedToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(bodyOf<AgendaBody>(res).feedPath).toBe(
        `/users/me/agenda.ics?token=${feedToken}`,
      );
      expect(bodyOf<AgendaBody>(res).active).toBe(true);

      const stored = await prisma.user.findUnique({
        where: { id: userA },
        select: { calendarToken: true },
      });
      expect(stored?.calendarToken).toMatch(/^[0-9a-f]{64}$/);
      expect(stored?.calendarToken).not.toContain(feedToken);

      expect(
        (await get('/users/me/agenda/calendar-token').expect(200)).body,
      ).toEqual({ active: true });

      const ics = await request(url)
        .get(bodyOf<AgendaBody>(res).feedPath)
        .expect(200);
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
      const ics = await request(url)
        .get(bodyOf<AgendaBody>(resB).feedPath)
        .expect(200);
      expect(ics.text).toContain('Secret');
      expect(ics.text).not.toMatch(/Rex|Milo|Dr Martin/);
    });

    it("régénérer invalide l'ancien lien", async () => {
      const res = await request(url)
        .post('/users/me/agenda/calendar-token')
        .set(auth(tokenA))
        .expect(201);
      expect(bodyOf<AgendaBody>(res).token).not.toBe(feedToken);
      await request(url)
        .get(`/users/me/agenda.ics?token=${feedToken}`)
        .expect(401);
      await request(url).get(bodyOf<AgendaBody>(res).feedPath).expect(200);
      feedToken = bodyOf<AgendaBody>(res).token;
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

  /** Heure murale « HH:mm » et jour « YYYY-MM-DD » d'un instant à Paris (Intl, indépendant du code testé). */
  const paris = (iso: string) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date(iso));
    const get = (t: string) => parts.find((p) => p.type === t)?.value;
    return {
      day: `${get('year')}-${get('month')}-${get('day')}`,
      time: `${get('hour')}:${get('minute')}`,
    };
  };
  /** VEVENT du flux ICS → { summary, start (ISO) } (DTSTART UTC uniquement). */
  const icsEvents = (ics: string) =>
    ics
      .replace(/\r\n /g, '')
      .split('BEGIN:VEVENT')
      .slice(1)
      .map((block) => {
        const summary = /\r\nSUMMARY:([^\r\n]*)/.exec(block)?.[1] ?? '';
        const m =
          /\r\nDTSTART:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/.exec(
            block,
          );
        return {
          summary,
          start: m
            ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z`
            : null,
        };
      });

  describe('fuseau horaire : heures locales de l’utilisateur (constat 4)', () => {
    let tokenP: string;
    let userP: string;
    let matinId: string;
    let soirId: string;

    beforeAll(async () => {
      ({ token: tokenP, id: userP } = await register('paris'));
      // Fuseau par défaut d'un nouveau compte : Europe/Paris.
      const u = await prisma.user.findUniqueOrThrow({ where: { id: userP } });
      expect(u.timezone).toBe('Europe/Paris');
      const animal = await prisma.animal.create({
        data: { userId: userP, speciesId: SPECIES_ID, name: 'Rex' },
      });
      const createdAt = new Date('2026-01-01T12:00:00Z');
      matinId = (
        await prisma.routine.create({
          data: {
            animalId: animal.id,
            name: 'Matin',
            type: 'nourrissage',
            frequency: 'daily',
            schedule: { time: '08:00', recurrence: 'daily' },
            createdAt,
          },
        })
      ).id;
      soirId = (
        await prisma.routine.create({
          data: {
            animalId: animal.id,
            name: 'Soir',
            type: 'uvb',
            frequency: 'daily',
            schedule: { time: '23:30', recurrence: 'daily' },
            createdAt,
          },
        })
      ).id;
    });

    const itemsOf = async (from: string, to: string, sourceId: string) =>
      bodyOf<AgendaBody>(
        await get(`/users/me/agenda?from=${from}&to=${to}`, tokenP).expect(200),
      ).items.filter((i) => i.sourceId === sourceId);

    it('« 08:00 » à Paris = 06:00Z en été et 07:00Z en hiver ; « 23:30 » reste sur le jour J local', async () => {
      expect(await itemsOf('2026-07-15', '2026-07-15', matinId)).toEqual([
        expect.objectContaining({
          date: '2026-07-15T06:00:00.000Z',
          day: '2026-07-15',
        }),
      ]);
      expect(await itemsOf('2026-01-15', '2026-01-15', matinId)).toEqual([
        expect.objectContaining({
          date: '2026-01-15T07:00:00.000Z',
          day: '2026-01-15',
        }),
      ]);
      // 23:30 à Paris = 21:30Z (été) / 22:30Z (hiver) : même jour local, jamais le lendemain.
      expect(await itemsOf('2026-07-15', '2026-07-15', soirId)).toEqual([
        expect.objectContaining({
          date: '2026-07-15T21:30:00.000Z',
          day: '2026-07-15',
        }),
      ]);
      expect(await itemsOf('2026-01-15', '2026-01-15', soirId)).toEqual([
        expect.objectContaining({
          date: '2026-01-15T22:30:00.000Z',
          day: '2026-01-15',
        }),
      ]);
    });

    it('semaine du passage à l’heure d’été (dimanche 29 mars 2026) : toujours 08:00 heure de Paris', async () => {
      const items = await itemsOf('2026-03-26', '2026-04-01', matinId);
      expect(items.map((i) => i.date)).toEqual([
        '2026-03-26T07:00:00.000Z',
        '2026-03-27T07:00:00.000Z',
        '2026-03-28T07:00:00.000Z',
        '2026-03-29T06:00:00.000Z',
        '2026-03-30T06:00:00.000Z',
        '2026-03-31T06:00:00.000Z',
        '2026-04-01T06:00:00.000Z',
      ]);
      for (const i of items)
        expect(paris(i.date)).toEqual({ day: i.day, time: '08:00' });
      // Et le passage à l'heure d'hiver (25 octobre 2026).
      const autumn = await itemsOf('2026-10-24', '2026-10-26', soirId);
      expect(autumn.map((i) => i.date)).toEqual([
        '2026-10-24T21:30:00.000Z',
        '2026-10-25T22:30:00.000Z',
        '2026-10-26T22:30:00.000Z',
      ]);
    });

    it('rappels générés (scheduler) et agenda alignés : mêmes instants, statut repris', async () => {
      const tomorrow = paris(
        new Date(Date.now() + 86_400_000).toISOString(),
      ).day;
      const events = (
        await get(
          `/users/me/notification-events?date=${tomorrow}`,
          tokenP,
        ).expect(200)
      ).body as { id: string; routineId?: string; scheduledAt: string }[];
      const agenda = [
        ...(await itemsOf(tomorrow, tomorrow, matinId)),
        ...(await itemsOf(tomorrow, tomorrow, soirId)),
      ];
      expect(agenda).toHaveLength(2);
      expect(new Set(events.map((e) => e.scheduledAt))).toEqual(
        new Set(agenda.map((i) => i.date)),
      );
      for (const e of events) expect(paris(e.scheduledAt).day).toBe(tomorrow);

      const matin = events.find((e) => e.routineId === matinId)!;
      await request(url)
        .patch(`/users/me/notification-events/${matin.id}`)
        .set(auth(tokenP))
        .send({ status: 'skipped' })
        .expect(200);
      const after = await get(
        `/users/me/agenda?from=${tomorrow}&to=${tomorrow}`,
        tokenP,
      ).expect(200);
      expect(
        (
          bodyOf<AgendaBody>(after).items as {
            sourceId: string;
            status: string;
          }[]
        ).find((i) => i.sourceId === matinId)?.status,
      ).toBe('skipped');
    });

    it('flux ICS : DTSTART en UTC correspondant à 08:00 heure de Paris', async () => {
      const res = await request(url)
        .post('/users/me/agenda/calendar-token')
        .set(auth(tokenP))
        .expect(201);
      const ics = (
        await request(url).get(bodyOf<AgendaBody>(res).feedPath).expect(200)
      ).text;
      const matins = icsEvents(ics).filter((e) =>
        e.summary.startsWith('Matin - Rex'),
      );
      expect(matins.length).toBeGreaterThanOrEqual(90);
      for (const e of matins) expect(paris(e.start!).time).toBe('08:00');
      const soirs = icsEvents(ics).filter((e) =>
        e.summary.startsWith('Soir - Rex'),
      );
      for (const e of soirs) expect(paris(e.start!).time).toBe('23:30');
    });
  });

  describe('les routines fréquentes n’évincent plus les autres sources (constat 5)', () => {
    let tokenQ: string;
    let userQ: string;

    beforeAll(async () => {
      ({ token: tokenQ, id: userQ } = await register('buffer'));
      await prisma.user.update({
        where: { id: userQ },
        data: { timezone: 'UTC' },
      });
      const animal = await prisma.animal.create({
        data: { userId: userQ, speciesId: SPECIES_ID, name: 'Brume' },
      });
      // 5 routines horaires : 5 × 24 × 92 = 11 040 occurrences (> 2 500 et > l'ancien tampon de 10 000).
      for (let i = 0; i < 5; i++) {
        await prisma.routine.create({
          data: {
            animalId: animal.id,
            name: `Brumisation ${i}`,
            type: 'entretien',
            frequency: 'hourly',
            schedule: { time: '00:00', recurrence: 'hourly', intervalHours: 1 },
            createdAt: new Date('2026-01-01T00:00:00Z'),
          },
        });
      }
      await prisma.vetAppointment.create({
        data: {
          animalId: animal.id,
          vetName: 'Dr Proche',
          date: at(dayOffset(1), '09:00'),
        },
      });
      await prisma.vetAppointment.create({
        data: {
          animalId: animal.id,
          vetName: 'Dr Lointain',
          date: at(dayOffset(80), '15:00'),
        },
      });
      await prisma.vaccination.create({
        data: {
          animalId: animal.id,
          name: 'Vaccin-Lointain',
          date: at(dayOffset(-300), '00:00'),
          nextDueDate: at(dayOffset(70), '00:00'),
        },
      });
      await prisma.medication.create({
        data: {
          animalId: animal.id,
          name: 'Medoc-Quotidien',
          dose: '1',
          frequency: 'daily',
          startDate: at(dayOffset(0), '00:00'),
          endDate: at(dayOffset(91), '00:00'),
        },
      });
    });

    it('JSON sur 92 jours : RDV, vaccin et médicament présents malgré 11 040 occurrences de routines', async () => {
      const res = await get(
        `/users/me/agenda?from=${dayOffset(0)}&to=${dayOffset(91)}`,
        tokenQ,
      ).expect(200);
      const items = bodyOf<AgendaBody>(res).items as {
        type: string;
        title: string;
        date: string;
      }[];
      expect(bodyOf<AgendaBody>(res).truncated).toBe(true);
      expect(items.length).toBeLessThanOrEqual(2500);
      const titles = new Set(items.map((i) => i.title));
      expect(titles.has('Dr Proche')).toBe(true);
      expect(titles.has('Dr Lointain')).toBe(true);
      expect(titles.has('Vaccin-Lointain')).toBe(true);
      expect(items.filter((i) => i.type === 'medication')).toHaveLength(92);
      expect(items.filter((i) => i.type === 'routine').length).toBeGreaterThan(
        0,
      );
      // Toujours trié par date.
      const dates = items.map((i) => i.date);
      expect([...dates].sort()).toEqual(dates);
    });

    it('flux ICS : RDV (proche et lointain) et vaccin présents', async () => {
      const res = await request(url)
        .post('/users/me/agenda/calendar-token')
        .set(auth(tokenQ))
        .expect(201);
      const ics = (
        await request(url).get(bodyOf<AgendaBody>(res).feedPath).expect(200)
      ).text;
      const summaries = icsEvents(ics).map((e) => e.summary);
      expect(summaries.some((s) => s.includes('Dr Proche'))).toBe(true);
      expect(summaries.some((s) => s.includes('Dr Lointain'))).toBe(true);
      expect(summaries.some((s) => s.includes('Vaccin-Lointain'))).toBe(true);
    });
  });
});
