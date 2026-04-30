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

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => AccessRequestItem, (item) => item.accessRequest, {
    cascade: true,
    eager: false,
  })
  items: AccessRequestItem[];
}
