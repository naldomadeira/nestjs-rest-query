import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
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
   * `ilike` e `search` comparam esta coluna literalmente, em vez de dependerem
   * da collation do banco. É o que faz a mesma query devolver o mesmo conjunto
   * em PostgreSQL, MySQL e SQL Server. `select: false` a mantém fora do SELECT
   * padrão; o schema lógico a declara `internal`, então ela nunca chega ao JSON.
   */
  @Column({ select: false })
  nameFolded: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @ManyToOne(() => Category, (category) => category.products, { eager: true })
  category: Category;

  @Column({ nullable: false })
  categoryId: number;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
