import { localDayKey } from '../dates';

/**
 * Date vue depuis un fuseau à décalage fixe (`offsetMinutes` = local − UTC) : les accesseurs
 * « locaux » lus par localDayKey suivent ce fuseau, `toISOString` reste en UTC.
 */
const inZone = (iso: string, offsetMinutes: number): Date => {
  const utc = new Date(iso);
  const local = new Date(utc.getTime() + offsetMinutes * 60_000);
  return Object.assign(Object.create(Date.prototype) as Date, {
    getFullYear: () => local.getUTCFullYear(),
    getMonth: () => local.getUTCMonth(),
    getDate: () => local.getUTCDate(),
    toISOString: () => utc.toISOString(),
  });
};

/** Revue frontend, constat 13 : la date du jour par défaut est le jour LOCAL, pas le jour UTC. */
describe('localDayKey', () => {
  it('Paris (UTC+2), 00 h 30 : déjà le lendemain alors que toISOString donne la veille', () => {
    const d = inZone('2026-10-01T22:30:00.000Z', 120);
    expect(d.toISOString().slice(0, 10)).toBe('2026-10-01');
    expect(localDayKey(d)).toBe('2026-10-02');
  });

  it('Paris (UTC+2), 23 h 59 : toujours le jour même', () => {
    expect(localDayKey(inZone('2026-10-02T21:59:00.000Z', 120))).toBe('2026-10-02');
  });

  it('New York (UTC−4), 22 h : encore la veille alors que toISOString donne le lendemain', () => {
    const d = inZone('2026-10-02T02:00:00.000Z', -240);
    expect(d.toISOString().slice(0, 10)).toBe('2026-10-02');
    expect(localDayKey(d)).toBe('2026-10-01');
  });

  it('fuseau de la machine : une seconde avant / après minuit local', () => {
    expect(localDayKey(new Date(2026, 9, 1, 23, 59, 59))).toBe('2026-10-01');
    expect(localDayKey(new Date(2026, 9, 2, 0, 0, 1))).toBe('2026-10-02');
  });

  it('formate mois et jour sur deux chiffres', () => {
    expect(localDayKey(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });
});
