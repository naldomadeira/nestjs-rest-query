import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { Module } from '../../modules/entities/module.entity';
import { AccessRequest } from './access-request.entity';

@Entity('access_request_items')
export class AccessRequestItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'access_request_id', type: 'integer' })
  accessRequestId: number;

  @Column({ name: 'company_id', type: 'integer' })
  companyId: number;

  @Column({ name: 'module_id', type: 'integer' })
  moduleId: number;

  @Column({ name: 'status', type: 'varchar', length: 30, default: 'pending' })
  status: string;

  @Column({ name: 'evaluated_by', type: 'varchar', length: 255, nullable: true })
  evaluatedBy: string | null;

  @Column({ name: 'evaluated_at', type: 'timestamp', nullable: true })
  evaluatedAt: Date | null;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => AccessRequest, (request) => request.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'access_request_id' })
  accessRequest: AccessRequest;

  @ManyToOne(() => Company, { eager: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => Module, { eager: false })
  @JoinColumn({ name: 'module_id' })
  module: Module;
}
