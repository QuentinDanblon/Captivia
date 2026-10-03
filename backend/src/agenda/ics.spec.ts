import { buildIcs, escapeIcsText, foldLine, formatUtcDateTime } from './ics';
import { agendaLabels } from './agenda.labels';
import { resolveAgendaRange, MAX_AGENDA_DAYS } from './agenda.service';
import type { AgendaItem } from './agenda.types';

const item = (over: Partial<AgendaItem> = {}): AgendaItem => ({
  id: 'routine:abc:2026-10-03T08:00:00.000Z',
  date: '2026-10-03T08:00:00.000Z',
  day: '2026-10-03',
  allDay: false,
  type: 'routine',
  animalId: 'a1',
  animalName: 'Rex',
  title: 'Nourrissage',
  detail: null,
  status: 'pending',
  sourceId: 'abc',
  ...over,
});

describe('escapeIcsText (RFC 5545 §3.3.11)', () => {
  it('échappe antislash, point-virgule, virgule et sauts de ligne', () => {
    expect(escapeIcsText('a\\b;c,d\ne\r\nf\rg')).toBe(
      'a\\\\b\\;c\\,d\\ne\\nf\\ng',
    );
  });

  it('supprime les caractères de contrôle', () => {
    expect(escapeIcsText('a\u0000b\u0007c\u007Fd')).toBe('abcd');
  });
});

describe('foldLine (RFC 5545 §3.1)', () => {
  it('ne touche pas une ligne courte', () => {
    expect(foldLine('SUMMARY:court')).toBe('SUMMARY:court');
  });

  it('plie à 75 octets maximum avec suite commençant par une espace', () => {
    const folded = foldLine(`DESCRIPTION:${'x'.repeat(200)}`).split('\r\n');
    expect(folded.length).toBeGreaterThan(2);
    for (const l of folded)
      expect(Buffer.byteLength(l, 'utf8')).toBeLessThanOrEqual(75);
    for (const l of folded.slice(1)) expect(l.startsWith(' ')).toBe(true);
    expect(folded.map((l, i) => (i === 0 ? l : l.slice(1))).join('')).toBe(
      `DESCRIPTION:${'x'.repeat(200)}`,
    );
  });

  it('ne coupe jamais un caractère multi-octets', () => {
    const text = `SUMMARY:${'é'.repeat(80)}${'🐍'.repeat(30)}`;
    const folded = foldLine(text).split('\r\n');
    for (const l of folded)
      expect(Buffer.byteLength(l, 'utf8')).toBeLessThanOrEqual(75);
    const unfolded = folded.map((l, i) => (i === 0 ? l : l.slice(1))).join('');
    expect(unfolded).toBe(text);
    expect(unfolded).not.toContain('�');
  });
});

describe('buildIcs', () => {
  const now = new Date('2026-10-02T12:00:00Z');
  const labels = agendaLabels('fr');

  it('produit un VCALENDAR conforme (CRLF, propriétés obligatoires)', () => {
    const ics = buildIcs([item()], { labels, now });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:')).toBe(
      true,
    );
    expect(ics.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(ics).toContain(
      'UID:routine:abc:2026-10-03T08:00:00.000Z@captivia\r\n',
    );
    expect(ics).toContain('DTSTAMP:20261002T120000Z\r\n');
    expect(ics).toContain('DTSTART:20261003T080000Z\r\n');
    expect(ics).toContain('DTEND:20261003T083000Z\r\n');
    expect(ics).toContain('SUMMARY:Nourrissage - Rex\r\n');
  });

  it("échappe les champs texte venant de l'utilisateur et ne permet pas d'injecter des propriétés", () => {
    const ics = buildIcs(
      [
        item({
          animalName: 'Rex; le, "grand"',
          title: 'Soin\r\nEND:VEVENT\r\nBEGIN:VEVENT',
          detail: 'ligne1\nligne2, avec\\antislash',
        }),
      ],
      { labels, now },
    );
    expect(ics).toContain(
      'SUMMARY:Soin\\nEND:VEVENT\\nBEGIN:VEVENT - Rex\\; le\\, "grand"\r\n',
    );
    expect(ics).toContain(
      'DESCRIPTION:ligne1\\nligne2\\, avec\\\\antislash\\nRex\\; le\\, "grand" (Routine)\r\n',
    );
    expect(ics.match(/^BEGIN:VEVENT\r$/gm)).toHaveLength(1);
    expect(ics.match(/^END:VEVENT\r$/gm)).toHaveLength(1);
  });

  it('émet une journée entière pour un rappel de vaccin', () => {
    const ics = buildIcs(
      [
        item({
          type: 'vaccination',
          allDay: true,
          date: '2026-12-31T00:00:00.000Z',
          day: '2026-12-31',
          title: 'Rage',
        }),
      ],
      { labels, now },
    );
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231\r\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20270101\r\n');
    expect(ics).toContain('SUMMARY:Rappel de vaccin: Rage - Rex\r\n');
  });

  it('marque les rendez-vous annulés CANCELLED et formate les dates UTC', () => {
    const ics = buildIcs(
      [item({ type: 'vet_appointment', status: 'cancelled' })],
      { labels, now },
    );
    expect(ics).toContain('STATUS:CANCELLED\r\n');
    expect(ics).toContain('DTEND:20261003T090000Z\r\n');
    expect(formatUtcDateTime(new Date('2026-01-02T03:04:05Z'))).toBe(
      '20260102T030405Z',
    );
  });

  it('plie les lignes longues à 75 octets', () => {
    const ics = buildIcs([item({ detail: 'z'.repeat(300) })], { labels, now });
    for (const l of ics.split('\r\n'))
      expect(Buffer.byteLength(l, 'utf8')).toBeLessThanOrEqual(75);
  });
});

describe('resolveAgendaRange', () => {
  it("utilise aujourd'hui + 30 jours par défaut", () => {
    const r = resolveAgendaRange(undefined, undefined, '2026-10-02');
    expect(r.fromDay).toBe('2026-10-02');
    expect(r.toDay).toBe('2026-10-31');
  });

  it('accepte exactement 92 jours inclus', () => {
    expect(
      resolveAgendaRange('2026-10-01', '2026-12-31', '2026-10-02').toDay,
    ).toBe('2026-12-31');
    expect(MAX_AGENDA_DAYS).toBe(92);
  });

  it.each([
    ['2026-10-01', '2027-01-01'], // 93 jours
    ['2026-10-05', '2026-10-01'], // to < from
    ['2026-02-31', '2026-03-01'], // date inexistante
    ['hier', '2026-03-01'], // format
    ['2026-10-01', '2026-13-01'], // mois invalide
  ])('rejette %s → %s', (from, to) => {
    expect(() => resolveAgendaRange(from, to, '2026-10-02')).toThrow();
  });
});
