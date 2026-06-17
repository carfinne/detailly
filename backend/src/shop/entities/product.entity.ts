import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column() name: string;
  @Column({ nullable: true }) sku: string;
  @Column({ nullable: true }) kategorie: string;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) einkaufspreis: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) verkaufspreis: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) bestand: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) mindestbestand: number;
  @Column({ default: 'Stueck' }) einheit: string;
  @Column({ default: false }) istVermietbar: boolean;
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true }) mietpreisProTag: number;
  @Column({ default: true }) aktiv: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
