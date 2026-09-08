import { defineQuerySchema } from '@core/schema';
import type { QuerySchemaInput } from '@core/schema';
import { RestQueryError } from '@core/errors';

const base: QuerySchemaInput = {
  model: 'user',
  primaryKey: ['id'],
  fields: [
    { path: 'id', kind: 'integer', nullable: false, primaryKey: true },
    {
      path: 'name',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      foldedField: 'name_folded',
    },
    {
      path: 'name_folded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
  ],
  relations: [
    { path: 'company', target: 'company', cardinality: 'one', nullable: true },
  ],
};

describe('defineQuerySchema', () => {
  it('congela campos e relações em mapas somente leitura', () => {
    const schema = defineQuerySchema(base);
    expect(schema.fields.get('name')?.kind).toBe('string');
    expect(schema.relations.get('company')?.cardinality).toBe('one');
    expect(Object.isFrozen(schema)).toBe(true);
  });

  it('rejeita PK que não existe entre os campos', () => {
    expect(() =>
      defineQuerySchema({ ...base, primaryKey: ['missing'] })
    ).toThrow(RestQueryError);
  });

  it('rejeita PK vazia', () => {
    expect(() => defineQuerySchema({ ...base, primaryKey: [] })).toThrow(
      /primary key/i
    );
  });

  it('rejeita PK nulável', () => {
    expect(() =>
      defineQuerySchema({
        ...base,
        fields: [
          { path: 'id', kind: 'integer', nullable: true, primaryKey: true },
        ],
      })
    ).toThrow(/primary key/i);
  });

  it('rejeita foldedField que não existe', () => {
    expect(() =>
      defineQuerySchema({
        ...base,
        fields: [
          { path: 'id', kind: 'integer', nullable: false, primaryKey: true },
          {
            path: 'name',
            kind: 'string',
            nullable: false,
            primaryKey: false,
            foldedField: 'nope',
          },
        ],
      })
    ).toThrow(/nope/);
  });

  it('rejeita foldedField que não é interno', () => {
    expect(() =>
      defineQuerySchema({
        ...base,
        fields: [
          { path: 'id', kind: 'integer', nullable: false, primaryKey: true },
          {
            path: 'name',
            kind: 'string',
            nullable: false,
            primaryKey: false,
            foldedField: 'name_folded',
          },
          {
            path: 'name_folded',
            kind: 'string',
            nullable: false,
            primaryKey: false,
          },
        ],
      })
    ).toThrow(/internal/i);
  });

  it('rejeita nome de campo colidindo com nome de relação', () => {
    expect(() =>
      defineQuerySchema({
        ...base,
        fields: [
          ...base.fields,
          {
            path: 'company',
            kind: 'string',
            nullable: true,
            primaryKey: false,
          },
        ],
      })
    ).toThrow(/company/);
  });

  it('rejeita enum sem enumValues', () => {
    expect(() =>
      defineQuerySchema({
        ...base,
        fields: [
          ...base.fields,
          {
            path: 'status',
            kind: 'enum',
            nullable: false,
            primaryKey: false,
          },
        ],
      })
    ).toThrow(/enumValues/);
  });

  it('rejeita path duplicado', () => {
    expect(() =>
      defineQuerySchema({ ...base, fields: [...base.fields, base.fields[0]] })
    ).toThrow(/duplicate/i);
  });

  it('marca campos internos como não expostos', () => {
    expect(defineQuerySchema(base).fields.get('name_folded')?.internal).toBe(
      true
    );
  });

  it('preserva a ordem de declaração dos campos', () => {
    expect([...defineQuerySchema(base).fields.keys()]).toEqual([
      'id',
      'name',
      'name_folded',
    ]);
  });
});
