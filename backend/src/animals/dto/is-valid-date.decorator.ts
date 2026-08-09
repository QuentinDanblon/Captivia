import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Validateur custom : vérifie que la valeur est une date RÉELLE, pas seulement
 * un format ISO valide.
 *
 * `@IsDateString()` accepte des dates impossibles comme '2026-13-45' (format
 * valide, valeur absurde). Ce validateur contrôle que :
 *  - `new Date(value)` ne produit pas une date invalide (NaN) ;
 *  - les composantes sont cohérentes : mois 1-12, jour valide pour le mois
 *    (certains parseurs normalisent silencieusement '2026-02-30' en mars).
 */
export function IsValidDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string' || value.length === 0) {
            return false;
          }
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) {
            return false;
          }
          // Composantes ISO (accepte '2026-01-15' et '2026-01-15T10:00:00.000Z')
          const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
          if (!match) {
            return false;
          }
          const year = Number(match[1]);
          const month = Number(match[2]);
          const day = Number(match[3]);
          if (month < 1 || month > 12) {
            return false;
          }
          const daysInMonth = new Date(year, month, 0).getDate();
          return day >= 1 && day <= daysInMonth;
        },
        defaultMessage: () =>
          'must be a real calendar date (month 1-12, valid day for the month)',
      },
    });
  };
}
