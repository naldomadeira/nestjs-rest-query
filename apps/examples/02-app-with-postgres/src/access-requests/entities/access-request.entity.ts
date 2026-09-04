import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AccessRequestItem } from './access-request-item.entity';

@Entity('access_requests')
export class AccessRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({
    name: 'overall_status',
    type: 'varchar',
    length: 30,
    default: 'pending',
  })
  overallStatus: string;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * `nullable: false` não é decoração: o adapter deriva o schema da metadata,
   * e o schema declarado tem de bater com ele campo a campo. `user_id` é
   * `NOT NULL` no banco, então a relação também precisa dizer isso.
   *
   * `Relation<T>` evita o TDZ do ciclo entre entidades sob ESM — ver
   * `AccessRequestItem.accessRequest`.
   */
  @ManyToOne(() => User, { eager: false, nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @OneToMany(() => AccessRequestItem, (item) => item.accessRequest, {
    cascade: true,
    eager: false,
  })
  items: Relation<AccessRequestItem>[];
}
