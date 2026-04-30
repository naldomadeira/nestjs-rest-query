import { EntityPaths } from './entity-paths.type';

export interface RulesConfig<T = any> {
  filters?: EntityPaths<T>[];
  sorts?: EntityPaths<T>[];
  /**
   * Campos permitidos para selecao com ?fields=.
   *
   * **Atencao:** quando `fields` e definido, tambem restringe os campos de sort.
   * Um campo presente em `sorts` mas ausente de `fields` sera rejeitado se
   * `fields` estiver configurado. Para evitar isso, mantenha `fields` e `sorts`
   * em sincronia, ou omita `fields` se nao quiser restricao de selecao.
   */
  fields?: EntityPaths<T>[];
  includes?: EntityPaths<T>[];
  /**
   * Campos permitidos para busca textual com ?search=.
   */
  search?: EntityPaths<T>[];
  /**
   * Alias da entidade no QueryBuilder (ex: `FROM users u` → alias: 'u').
   * @default 'root'
   */
  alias?: string;
}
