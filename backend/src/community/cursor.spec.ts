import { afterCursor, decodeCursor, encodeCursor, paginate } from './cursor';

const ID = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

describe('curseur des fils', () => {
  it('encode puis décode (createdAt, id)', () => {
    const value = { createdAt: new Date('2026-10-03T10:00:00.123Z'), id: ID };
    expect(decodeCursor(encodeCursor(value))).toEqual(value);
    expect(decodeCursor(undefined)).toBeNull();
  });

  it.each([
    'nope',
    Buffer.from('2026-10-03|x').toString('base64url'),
    Buffer.from('bad|' + ID).toString('base64url'),
  ])('refuse un curseur invalide %p (400)', (raw) => {
    expect(() => decodeCursor(raw)).toThrow('Invalid cursor');
  });

  it('construit la condition « après » selon le sens du tri', () => {
    const c = { createdAt: new Date('2026-10-03T10:00:00Z'), id: ID };
    expect(afterCursor(null)).toEqual({});
    expect(afterCursor(c)).toEqual({
      OR: [
        { createdAt: { lt: c.createdAt } },
        { createdAt: c.createdAt, id: { lt: ID } },
      ],
    });
    expect(JSON.stringify(afterCursor(c, 'asc'))).toContain('"gt"');
  });

  it('paginate découpe la page et donne le curseur suivant', () => {
    const rows = [1, 2, 3].map((n) => ({
      id: ID,
      createdAt: new Date(2026, 0, n),
    }));
    expect(paginate(rows, 3).nextCursor).toBeNull();
    const page = paginate(rows, 2);
    expect(page.items).toHaveLength(2);
    expect(decodeCursor(page.nextCursor!)?.createdAt).toEqual(
      rows[1].createdAt,
    );
  });
});
