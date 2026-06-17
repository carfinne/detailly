import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { enumColumnType, jsonColumnType, timestampColumnType } from '../../common/database.types';

export enum TenantStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TRIAL = 'trial',
}

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  street: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  postalCode: string;

  @Column({ default: 'DE' })
  country: string;

  @Column({ nullable: true })
  franchiseId: string;

  @Column({ type: enumColumnType(), enum: TenantStatus, default: TenantStatus.TRIAL })
  status: TenantStatus;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ nullable: true, select: false })
  sevdeskApiToken: string;

  @Column({ type: jsonColumnType(), nullable: true })
  businessHours: object;

  @Column({ type: jsonColumnType(), nullable: true })
  settings: object;

  @Column({ nullable: true, type: timestampColumnType() })
  trialEndsAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
