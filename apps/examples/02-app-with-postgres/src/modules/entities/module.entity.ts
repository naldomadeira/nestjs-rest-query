import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({
    type: 'enum',
    enum: ModuleStatus,
    default: ModuleStatus.ACTIVE,
  })
  status: ModuleStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  icon: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
