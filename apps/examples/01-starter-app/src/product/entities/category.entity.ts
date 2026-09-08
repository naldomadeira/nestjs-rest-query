import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  type Relation,
} from 'typeorm';
import { Product } from './product.entity';

@Entity()
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  /** Valor dobrado de `name` — ver `Product.name_folded`. */
  @Column({ select: false })
  name_folded: string;

  /** Ver `Product.category` para o porquê do `Relation<T>`. */
  @OneToMany(() => Product, (product) => product.category)
  products: Relation<Product>[];
}
