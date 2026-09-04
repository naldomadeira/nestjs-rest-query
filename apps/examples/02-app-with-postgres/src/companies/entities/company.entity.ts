import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { foldText } from 'nestjs-rest-query';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', unique: true })
  @Generated('uuid')
  uuid: string;

  @Column({ type: 'varchar', length: 18, unique: true })
  cnpj: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  /** Ver `User.firstName_folded` para a convenção de nome. */
  @Column({
    name: 'name_folded',
    type: 'varchar',
    length: 255,
    default: '',
    select: false,
  })
  name_folded: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  foldSearchableColumns(): void {
    this.name_folded = foldText(this.name ?? '');
  }
}
