import { badRequest } from './community.errors';

/**
 * Curseur opaque des fils (ordre `createdAt DESC, id DESC`, ou ASC pour les commentaires) :
 * base64url de « <ISO date>|<id> ». Stable même si des contenus sont publiés entre deux pages.
 */
export interface CursorValue {
  createdAt: Date;
  id: string;
}

export function encodeCursor(value: CursorValue): string {
  return Buffer.from(
    `${value.createdAt.toISOString()}|${value.id}`,
    'utf8',
  ).toString('base64url');
}

export function decodeCursor(raw: string | undefined): CursorValue | null {
  if (!raw) return null;
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  const sep = decoded.indexOf('|');
  const date = new Date(decoded.slice(0, sep));
  const id = decoded.slice(sep + 1);
  if (
    sep <= 0 ||
    Number.isNaN(date.getTime()) ||
    !/^[0-9a-f-]{36}$/i.test(id)
  ) {
    throw badRequest('INVALID_CURSOR', 'Invalid cursor');
  }
  return { createdAt: date, id };
}

/** Condition Prisma « après le curseur » pour un tri (createdAt, id) décroissant ou croissant. */
export function afterCursor(
  cursor: CursorValue | null,
  direction: 'desc' | 'asc' = 'desc',
) {
  if (!cursor) return {};
  const op = direction === 'desc' ? 'lt' : 'gt';
  return {
    OR: [
      { createdAt: { [op]: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { [op]: cursor.id } },
    ],
  };
}

/** Découpe une page lue avec `take: limit + 1` et calcule le curseur suivant. */
export function paginate<T extends { createdAt: Date; id: string }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
  };
}
