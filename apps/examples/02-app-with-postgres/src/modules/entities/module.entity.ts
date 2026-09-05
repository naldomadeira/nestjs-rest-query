import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { foldText } from 'nestjs-rest-query';

export enum ModuleStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('modules')
export class Module {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  /** Ver `User.firstName_folded` para a convenção de nome. */
  @Column({
    name: 'name_folded',
    type: 'varchar',
    length: 100,
    default: '',
    select: false,
  })
  name_folded: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({
    type: 'enum',
    enum: ModuleStatus,
    default: ModuleStatus.ACTIVE,
  })
  status: ModuleStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  icon: string | null;

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
