import { DynamicQueryDto } from '@api/dtos';
import { QueryBuilderService } from '@core/query-builder.v3.service';
import { RULES_PRESETS } from '../fixtures/rules';
import { fakeSource } from '../fixtures/fake-adapter';

/**
 * A DTO exportada pela raiz tem de servir ao método exportado pela raiz.
 *
 * Parece óbvio, e não era: `QueryBuilderService.execute` recebe
 * `QueryInputLike`, que declara `[key: string]: unknown` para poder recusar
 * parâmetro desconhecido, e TypeScript não dá index signature implícita a
 * classes. A `DynamicQueryDto` é uma classe — então, sem a assinatura
 * explícita, o uso documentado no README não compilava e todo consumidor
 * precisaria de um cast, contra o gate "nenhum cast no uso público
 * documentado" da §23.
 *
 * Quem encontrou isso foi o exemplo `01-starter-app` ao ser compilado com
 * `strict`. Este teste existe para que a próxima regressão seja pega aqui, sem
 * depender de alguém rodar os exemplos.
 */
describe('DynamicQueryDto no uso público', () => {
  it('é aceita por execute() sem cast', async () => {
    const service = new QueryBuilderService({});
    const query = new DynamicQueryDto();
    query.page = '1';
    query.perPage = '2';

    // O ponto do teste é compilar: nenhum `as`, nenhum `unknown` no caminho.
    // A asserção existe só para provar que a chamada rodou de ponta a ponta.
    const result = await service.execute(
      fakeSource(),
      query,
      RULES_PRESETS['user.default']
    );

    expect(result.data).toEqual([{ id: 1, name: 'Ada' }]);
  });

  it('aceita os parâmetros da gramática com os tipos que o HTTP entrega', () => {
    // Todos chegam como string do query string, menos `filter`, que o parser
    // de `extended` entrega como objeto aninhado.
    const query = new DynamicQueryDto();
    query.sort = '-price,name';
    query.fields = 'id,name';
    query.includes = 'category';
    query.search = 'ação';
    query.paginate = 'false';
    query.filter = { price: { gte: '10.50' } };

    expect(query.filter).toEqual({ price: { gte: '10.50' } });
  });
});
