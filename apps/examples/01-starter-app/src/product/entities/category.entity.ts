import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Product } from './product.entity';

@Entity()
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  /** Valor dobrado de `name` — ver `Product.nameFolded`. */
  @Column({ select: false })
  nameFolded: string;

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];
}
