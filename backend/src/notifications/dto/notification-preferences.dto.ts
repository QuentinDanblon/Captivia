import { Transform, plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateNested,
  registerDecorator,
  validateSync,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/** Heure HH:mm sur 24 h (W0-07 : "-100000000:00" et autres valeurs hors bornes sont refusés). */
export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Date calendaire YYYY-MM-DD. */
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Récurrences connues (frontend `RecurrenceKind`). */
export const RECURRENCES = [
  'hourly',
  'daily',
  'every_2_days',
  'every_3_days',
  'weekly',
  'monthly',
  'once',
] as const;

/** Plafonds défensifs sur les objets libres (clés = libellés de types choisis par l'utilisateur). */
export const MAX_NOTIFICATION_TYPES = 50;
export const MAX_TYPE_KEY_LENGTH = 60;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isSafeTypeKey(key: string): boolean {
  return (
    key.length >= 1 &&
    key.length <= MAX_TYPE_KEY_LENGTH &&
    !FORBIDDEN_KEYS.has(key)
  );
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Planning d'un type de rappel : { time, recurrence, date?, weekDay?, dayOfMonth?, intervalHours? }. */
export class TypeScheduleDto {
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'time must be a valid HH:mm (00:00-23:59)' })
  time?: string;

  @IsOptional()
  @IsIn(RECURRENCES)
  recurrence?: (typeof RECURRENCES)[number];

  @IsOptional()
  @Matches(DATE_REGEX, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  intervalHours?: number;
}

/** Fenêtre globale de notification : { start: "08:00", end: "22:00" }. */
export class ScheduleWindowDto {
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'start must be a valid HH:mm (00:00-23:59)' })
  start?: string;

  @IsOptional()
  @Matches(TIME_REGEX, { message: 'end must be a valid HH:mm (00:00-23:59)' })
  end?: string;
}

const TYPE_SCHEDULE_KEYS = [
  'time',
  'recurrence',
  'date',
  'weekDay',
  'dayOfMonth',
  'intervalHours',
] as const;

/** Ne garde que les propriétés connues d'un objet (les valeurs invalides restent pour être refusées). */
function pick(value: unknown, keys: readonly string[]): unknown {
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (
      Object.prototype.hasOwnProperty.call(value, k) &&
      value[k] !== undefined
    ) {
      out[k] = value[k];
    }
  }
  return out;
}

/** `types` : { "<libellé>": boolean }, au plus 50 entrées, clés de 1 à 60 caractères. */
function IsNotificationTypes(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isNotificationTypes',
      target: object.constructor,
      propertyName,
      options: {
        message: `types must be an object of { label: boolean } (max ${MAX_NOTIFICATION_TYPES} entries, keys 1-${MAX_TYPE_KEY_LENGTH} chars)`,
        ...options,
      },
      validator: {
        validate(value: unknown) {
          if (!isPlainObject(value)) return false;
          const entries = Object.entries(value);
          if (entries.length > MAX_NOTIFICATION_TYPES) return false;
          return entries.every(
            ([k, v]) => isSafeTypeKey(k) && typeof v === 'boolean',
          );
        },
      },
    });
  };
}

/** `typeSchedules` : { "<libellé>": TypeScheduleDto }, mêmes plafonds, valeurs validées une à une. */
function IsTypeSchedules(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isTypeSchedules',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          if (!isPlainObject(value)) return false;
          const entries = Object.entries(value);
          if (entries.length > MAX_NOTIFICATION_TYPES) return false;
          return entries.every(([k, v]) => {
            if (!isSafeTypeKey(k) || !isPlainObject(v)) return false;
            const dto = plainToInstance(TypeScheduleDto, v);
            return (
              validateSync(dto, { whitelist: true, forbidNonWhitelisted: true })
                .length === 0
            );
          });
        },
        defaultMessage(args?: ValidationArguments) {
          return `${args?.property ?? 'typeSchedules'} must map each type (max ${MAX_NOTIFICATION_TYPES}, keys 1-${MAX_TYPE_KEY_LENGTH} chars) to { time: HH:mm, recurrence: ${RECURRENCES.join('|')}, date?: YYYY-MM-DD, weekDay?: 0-6, dayOfMonth?: 1-31, intervalHours?: 1-24 }`;
        },
      },
    });
  };
}

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsIn(['push', 'email', 'both'])
  deliveryChannel?: 'push' | 'email' | 'both';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  snooze?: number;

  @IsOptional()
  @IsObject()
  @IsNotificationTypes()
  types?: Record<string, boolean>;

  @IsOptional()
  @IsObject()
  @Transform(({ value }: { value: unknown }) => {
    if (!isPlainObject(value)) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = pick(v, TYPE_SCHEDULE_KEYS);
    }
    return out;
  })
  @IsTypeSchedules()
  typeSchedules?: Record<string, TypeScheduleDto>;

  @IsOptional()
  @IsObject()
  @Transform(({ value }: { value: unknown }) =>
    isPlainObject(value)
      ? plainToInstance(ScheduleWindowDto, pick(value, ['start', 'end']))
      : value,
  )
  @ValidateNested()
  schedule?: ScheduleWindowDto;
}
