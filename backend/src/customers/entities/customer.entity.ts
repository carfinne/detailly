import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { enumColumnType } from '../../common/database.types';

export enum CustomerType { PRIVATE = 'private', BUSINESS = 'business' }

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column({ type: enumColumnType(), enum: CustomerType, default: CustomerType.PRIVATE }) type: CustomerType;
  @Column({ nullable: true }) firstName: string;
  @Column({ nullable: true }) lastName: string;
  @Column({ nullable: true }) companyName: string;
  @Column({ nullable: true }) vatNumber: string;
  @Column({ nullable: true }) email: string;
  @Column({ nullable: true }) phone: string;
  @Column({ nullable: true }) mobile: string;
  @Column({ nullable: true }) street: string;
  @Column({ nullable: true }) city: string;
  @Column({ nullable: true }) postalCode: string;
  @Column({ default: 'DE' }) country: string;
  @Column({ nullable: true }) sevdeskContactId: string;
  @Column({ type: 'text', nullable: true }) notes: string;
  @Column({ default: true }) isActive: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
