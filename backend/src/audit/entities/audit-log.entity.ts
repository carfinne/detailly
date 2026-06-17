import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { jsonColumnType } from '../../common/database.types';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  tenantId: string;

  @Column({ nullable: true })
  userId: string;

  @Column()
  action: string;

  @Column()
  entityType: string;

  @Column({ nullable: true })
  entityId: string;

  @Column({ type: jsonColumnType(), nullable: true })
  payload: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
