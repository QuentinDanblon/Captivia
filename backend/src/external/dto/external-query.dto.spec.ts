import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  EXTERNAL_QUERY_MAX_LENGTH,
  ExternalQueryDto,
  ExternalScientificNameDto,
  ExternalSearchQDto,
  ExternalTaxonQueryDto,
  ExternalTitleDto,
} from './external-query.dto';
import { PubMedSearchDto } from '../../health-content/dto/health-query.dto';
import { SpeciesPlusSearchDto } from '../../legislation/dto/legislation.dto';

const validate = <T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
) => {
  const dto = plainToInstance(cls, plain);
  return { dto, errors: validateSync(dto) };
};

describe('DTO des API externes (longueur des requêtes)', () => {
  const tooLong = 'a'.repeat(EXTERNAL_QUERY_MAX_LENGTH + 1);

  it.each([
    [ExternalSearchQDto, 'q'],
    [ExternalQueryDto, 'query'],
    [ExternalTitleDto, 'title'],
  ] as const)('%p borne « %s » (1..200, espaces retirés)', (cls, field) => {
    expect(validate(cls as never, { [field]: 'Boa constrictor' }).errors).toHaveLength(0);
    expect(validate(cls as never, { [field]: tooLong }).errors.length).toBeGreaterThan(0);
    expect(validate(cls as never, { [field]: '   ' }).errors.length).toBeGreaterThan(0);
    expect(validate(cls as never, {}).errors.length).toBeGreaterThan(0);
  });

  it('ExternalScientificNameDto : 2..100 caractères', () => {
    expect(validate(ExternalScientificNameDto, { scientificName: 'Boa constrictor' }).errors).toHaveLength(0);
    expect(validate(ExternalScientificNameDto, { scientificName: 'B' }).errors.length).toBeGreaterThan(0);
    expect(validate(ExternalScientificNameDto, { scientificName: 'a'.repeat(101) }).errors.length).toBeGreaterThan(0);
  });

  it('ExternalTaxonQueryDto : taxonId entier positif, limit 1..100 (20 par défaut)', () => {
    const ok = validate(ExternalTaxonQueryDto, { taxonId: '42' });
    expect(ok.errors).toHaveLength(0);
    expect(ok.dto.taxonId).toBe(42);
    expect(ok.dto.limit).toBe(20);
    for (const taxonId of ['abc', '0', '-3', '1.5', '99999999999']) {
      expect(validate(ExternalTaxonQueryDto, { taxonId }).errors.length).toBeGreaterThan(0);
    }
    expect(validate(ExternalTaxonQueryDto, { taxonId: '1', limit: '101' }).errors.length).toBeGreaterThan(0);
  });

  it('PubMedSearchDto : q 2..200, limit 1..20', () => {
    expect(validate(PubMedSearchDto, { q: 'boa constrictor', limit: '5' }).errors).toHaveLength(0);
    expect(validate(PubMedSearchDto, { q: 'a' }).errors.length).toBeGreaterThan(0);
    expect(validate(PubMedSearchDto, { q: tooLong }).errors.length).toBeGreaterThan(0);
    expect(validate(PubMedSearchDto, { q: 'boa', limit: '21' }).errors.length).toBeGreaterThan(0);
    expect(validate(PubMedSearchDto, {}).errors.length).toBeGreaterThan(0);
  });

  it('SpeciesPlusSearchDto : name 2..150', () => {
    expect(validate(SpeciesPlusSearchDto, { name: 'Boa constrictor' }).errors).toHaveLength(0);
    expect(validate(SpeciesPlusSearchDto, { name: 'B' }).errors.length).toBeGreaterThan(0);
    expect(validate(SpeciesPlusSearchDto, { name: 'a'.repeat(151) }).errors.length).toBeGreaterThan(0);
  });
});
