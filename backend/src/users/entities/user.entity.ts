import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { enumColumnType, timestampColumnType } from '../../common/database.types';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  FRANCHISE_OWNER = 'franchise_owner',
  MANAGER = 'manager',
  TECHNICIAN = 'technician',
  RECEPTIONIST = 'receptionist',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: enumColumnType(), enum: UserRole, default: UserRole.TECHNICIAN })
  role: UserRole;

  @Column({ nullable: true })
  tenantId: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true, type: timestampColumnType() })
  lastLoginAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
