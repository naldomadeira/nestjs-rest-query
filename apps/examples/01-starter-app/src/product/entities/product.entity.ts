import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Category } from './category.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  /**
   * Valor dobrado de `name`: `normalize('NFC').toLowerCase()`.
   *
   * O nome da coluna não é livre: o adapter do TypeORM reconhece a coluna
   * dobrada pelo sufixo `_folded` sobre o path do campo que ela apoia. Chamar
   * de `nameFolded` faria o schema derivado da entidade divergir do schema
   * declarado e a execução falharia com `SOURCE_CONFIGURATION_INVALID`.
   *
   * `ilike` e `search` comparam esta coluna literalmente, em vez de dependerem
   * da collation do banco. É o que faz a mesma query devolver o mesmo conjunto
   * em PostgreSQL, MySQL e SQL Server. `select: false` a mantém fora do SELECT
   * padrão; o schema lógico a declara `internal`, então ela nunca chega ao JSON.
   */
  @Column({ select: false })
  name_folded: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  /**
   * `Relation<T>` é o invólucro que o próprio TypeORM publica para o ciclo
   * `Product` <-> `Category`: sob ESM, `emitDecoratorMetadata` avaliaria a
   * classe ainda em TDZ e a inicialização estouraria com
   * "Cannot access 'Category' before initialization". Como `Relation` é um
   * alias de tipo, o metadado emitido vira `Object` e o alvo real da relação
   * continua vindo da arrow — que só é chamada depois de tudo carregado.
   */
  @ManyToOne(() => Category, (category) => category.products, {
    eager: true,
    // `categoryId` é `NOT NULL`; sem `nullable: false` aqui a metadata da
    // relação diria o contrário e divergiria do schema declarado.
    nullable: false,
  })
  category: Relation<Category>;

  @Column({ nullable: false })
  categoryId: number;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
