import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  BarcodeParamDto,
  FOOD_QUERY_MAX_LENGTH,
  FoodSearchDto,
  FoodSpeciesParamDto,
} from './food-search.dto';

const errorsFor = <T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
) => validateSync(plainToInstance(cls, plain));

describe('BarcodeParamDto (^\\d{8,14}$)', () => {
  it.each(['12345678', '3017620422003', '12345678901234'])(
    'accepte %s',
    (barcode) => {
      expect(errorsFor(BarcodeParamDto, { barcode })).toHaveLength(0);
    },
  );

  it.each([
    '1234567',
    '123456789012345',
    '12345abc',
    '../etc/passwd',
    '1234 5678',
    '12345678\n',
    '',
  ])('refuse %p', (barcode) => {
    const errors = errorsFor(BarcodeParamDto, { barcode });
    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0].constraints ?? {})).toContain(
      'barcode must be 8 to 14 digits',
    );
  });

  it('refuse un barcode absent', () => {
    expect(errorsFor(BarcodeParamDto, {}).length).toBeGreaterThan(0);
  });
});

describe('FoodSearchDto (longueur des requêtes)', () => {
  it('accepte une recherche valide', () => {
    expect(
      errorsFor(FoodSearchDto, { q: 'dog food', pageSize: '20' }),
    ).toHaveLength(0);
  });

  it(`refuse q > ${FOOD_QUERY_MAX_LENGTH} caractères, vide ou absent`, () => {
    expect(
      errorsFor(FoodSearchDto, { q: 'a'.repeat(FOOD_QUERY_MAX_LENGTH) }),
    ).toHaveLength(0);
    expect(
      errorsFor(FoodSearchDto, { q: 'a'.repeat(FOOD_QUERY_MAX_LENGTH + 1) })
        .length,
    ).toBeGreaterThan(0);
    expect(errorsFor(FoodSearchDto, { q: '' }).length).toBeGreaterThan(0);
    expect(errorsFor(FoodSearchDto, {}).length).toBeGreaterThan(0);
  });

  it('borne category, species, page et pageSize', () => {
    const long = 'a'.repeat(FOOD_QUERY_MAX_LENGTH + 1);
    expect(
      errorsFor(FoodSearchDto, { q: 'x', category: long }).length,
    ).toBeGreaterThan(0);
    expect(
      errorsFor(FoodSearchDto, { q: 'x', species: long }).length,
    ).toBeGreaterThan(0);
    expect(
      errorsFor(FoodSearchDto, { q: 'x', page: '0' }).length,
    ).toBeGreaterThan(0);
    expect(
      errorsFor(FoodSearchDto, { q: 'x', pageSize: '101' }).length,
    ).toBeGreaterThan(0);
  });
});

describe('FoodSpeciesParamDto', () => {
  it('borne le nom d’espèce interpolé dans la recherche', () => {
    expect(
      errorsFor(FoodSpeciesParamDto, { species: 'Boa constrictor' }),
    ).toHaveLength(0);
    expect(
      errorsFor(FoodSpeciesParamDto, { species: 'a'.repeat(101) }).length,
    ).toBeGreaterThan(0);
  });
});
