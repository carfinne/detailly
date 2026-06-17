import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { enumColumnType } from '../../common/database.types';

export enum MovementType {
  ZUGANG = 'zugang',
  ABGANG = 'abgang',
  INVENTUR = 'inventur',
}

@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column() productId: string;
  @Column({ type: enumColumnType(), enum: MovementType }) typ: MovementType;
  /** Veraenderung der Menge (Zugang positiv, Abgang negativ, Inventur = neuer Bestand). */
  @Column({ type: 'decimal', precision: 10, scale: 2 }) menge: number;
  @Column({ nullable: true }) grund: string;
  @Column({ nullable: true }) userId: string;
  @CreateDateColumn() createdAt: Date;
}
