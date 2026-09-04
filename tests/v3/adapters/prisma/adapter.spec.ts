import { QueryBuilderService } from '@core/query-builder.v3.service';
import { buildQueryPlan } from '@core/query-plan';
import type { QuerySchema, SchemaRegistry } from '@core/schema';
import { RULES_PRESETS } from '../../fixtures/rules';
import { CORPUS_SCHEMAS } from '../../fixtures/schemas';
import {
  PrismaAdapter,
  createPrismaManifest,
  prismaSource,
  type PrismaDelegate,
  type PrismaManifest,
} from '@infra/adapters/prisma';

const rules = RULES_PRESETS['user.default'];

function manifest(registry: SchemaRegistry = CORPUS_SCHEMAS): PrismaManifest {
  return createPrismaManifest({
    provider: 'postgresql',
    registry,
    models: {
      user: { delegate: 'user' },
      company: { delegate: 'company' },
      post: { delegate: 'post' },
      tag: { delegate: 'tag' },
    },
  });
}

function delegate(rows: readonly object[] = []): PrismaDelegate {
  return {
    findMany: jest.fn().mockResolvedValue(rows),
    count: jest.fn().mockResolvedValue(rows.length),
  };
}

describe('PrismaAdapter', () => {
  it('cria source discriminada a partir de manifesto manual validado', async () => {
    const userDelegate = delegate();
    const source = prismaSource({
      client: { user: userDelegate },
      model: 'user',
      manifest: manifest(),
    });

    expect(source.kind).toBe('prisma');
    await expect(source.adapter.describe(source.input)).resolves.toEqual(
      CORPUS_SCHEMAS.get('user')
    );
  });

  it('recusa model ausente do manifesto antes de consultar o client', () => {
    expect(() =>
      prismaSource({
        client: {},
        model: 'missing',
        manifest: manifest(),
      })
    ).toThrow('Prisma model missing is not present in the manifest');
  });

  it('compila where, search, select, orderBy e paginação sem mode insensitive', () => {
    const adapter = new PrismaAdapter();
    const plan = buildQueryPlan(
      {
        filter: { 'company.name': { ilike: 'ACME' } },
        search: 'Ada',
        includes: 'company',
        fields: 'id,name,company.name',
        sort: '-name',
        page: '2',
        perPage: '3',
      },
      rules
    );

    const compiled = adapter.compile(plan, {
      client: { user: delegate() },
      delegate: delegate(),
      model: 'user',
      manifest: manifest(),
    });

    expect(JSON.stringify(compiled.data)).not.toContain('"mode"');
    expect(compiled.data).toEqual({
      where: {
        AND: [
          { company: { is: { name_folded: { contains: 'acme' } } } },
          {
            OR: [
              { name_folded: { contains: 'ada' } },
              { email_folded: { contains: 'ada' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        company: { select: { id: true, name: true } },
      },
      orderBy: [{ name: 'desc' }, { id: 'asc' }],
      skip: 3,
      take: 3,
    });
    expect(compiled.count).toEqual({
      where: compiled.data.where,
    });
  });

  it('usa some e none para relações many', () => {
    const adapter = new PrismaAdapter();
    const deepRules = RULES_PRESETS['user.deep'];
    const somePlan = buildQueryPlan(
      { filter: { 'posts.title': { eq: 'COBOL' } } },
      deepRules
    );
    const nonePlan = buildQueryPlan(
      { filter: { posts: { isNull: 'true' } } },
      deepRules
    );
    const source = {
      client: { user: delegate() },
      delegate: delegate(),
      model: 'user',
      manifest: manifest(),
    };

    expect(adapter.compile(somePlan, source).data.where).toEqual({
      AND: [{ posts: { some: { title: { equals: 'COBOL' } } } }],
    });
    expect(adapter.compile(nonePlan, source).data.where).toEqual({
      AND: [{ posts: { none: {} } }],
    });
  });

  it('executa findMany e count a partir do mesmo where customizavel', async () => {
    const userDelegate = delegate([{ id: 1, name: 'Ada' }]);
    const source = prismaSource({
      client: { user: userDelegate },
      model: 'user',
      manifest: manifest(),
    });
    const service = new QueryBuilderService({});

    const result = await service.execute(source, {}, rules, {
      customize: (native) => {
        native.args.where = native.args.where
          ? { AND: [native.args.where, { active: true }] }
          : { active: true };
      },
    });

    expect(userDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { active: true },
      })
    );
    expect(userDelegate.count).toHaveBeenCalledWith({
      where: { active: true },
    });
    expect(result.data).toEqual([{ id: 1, name: 'Ada' }]);
    expect(result.total).toBe(1);
  });
});
