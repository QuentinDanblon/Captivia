import {
  IsIn,
  IsOptional,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

/**
 * Fenêtre autorisée pour le paramètre `date` : de J-1 (tolérance de fuseau) à J+366.
 * Le passé est borné à la veille : générer des événements antidatés permettrait de les passer
 * à « fait » pour farmer des points.
 */
export const EVENTS_DATE_PAST_DAYS = 1;
export const EVENTS_DATE_WINDOW_DAYS = 366;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Valide une date calendaire YYYY-MM-DD réelle (pas de 2026-02-31) dans [J-1 ; J+366] (UTC). */
export function isDayWithinOneYear(
  value: unknown,
  now: Date = new Date(),
): boolean {
  if (typeof value !== 'string') return false;
  const m = ISO_DAY.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ts = Date.UTC(y, mo - 1, d);
  const dt = new Date(ts);
  if (
    Number.isNaN(ts) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    return false;
  }
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return (
    ts >= todayUtc - EVENTS_DATE_PAST_DAYS * 86_400_000 &&
    ts <= todayUtc + EVENTS_DATE_WINDOW_DAYS * 86_400_000
  );
}

function IsDayWithinOneYear(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isDayWithinOneYear',
      target: object.constructor,
      propertyName,
      options: {
        message: 'date must be a valid YYYY-MM-DD between yesterday and one year ahead',
        ...options,
      },
      validator: { validate: (value: unknown) => isDayWithinOneYear(value) },
    });
  };
}

/** Query de GET /users/me/notification-events. */
export class NotificationEventsQueryDto {
  @IsOptional()
  @IsDayWithinOneYear()
  date?: string;

  @IsOptional()
  @IsIn(['1', 'true', '0', 'false'])
  refresh?: string;
}

/** Corps de PATCH /users/me/notification-events/:id. */
export class SetEventStatusDto {
  @IsIn(['done', 'skipped'], { message: 'status must be done or skipped' })
  status: 'done' | 'skipped';
}
