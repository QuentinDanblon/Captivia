import {
  IsIn,
  IsOptional,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

/** Fenêtre autorisée pour le paramètre `date` : ±1 an autour d'aujourd'hui (W0-07). */
export const EVENTS_DATE_WINDOW_DAYS = 366;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Valide une date calendaire YYYY-MM-DD réelle (pas de 2026-02-31) à ±1 an d'aujourd'hui. */
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
  return Math.abs(ts - now.getTime()) <= EVENTS_DATE_WINDOW_DAYS * 86_400_000;
}

function IsDayWithinOneYear(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isDayWithinOneYear',
      target: object.constructor,
      propertyName,
      options: {
        message: 'date must be a valid YYYY-MM-DD within one year of today',
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
