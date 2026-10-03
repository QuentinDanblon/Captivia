import { Transform } from 'class-transformer';
import { normalizeEmail } from '../auth.constants';

/**
 * Normalise un champ email (trim + minuscules) AVANT validation.
 * Les valeurs non-string sont laissées telles quelles pour que @IsEmail les rejette.
 */
export function NormalizeEmail(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  );
}
