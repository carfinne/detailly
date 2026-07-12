import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid') id: string;
  // Index: Produkt-/Lagerlisten filtern immer auf tenantId (Mandantentrennung).
  @Index() @Column() tenantId: string;
  @Column() name: string;
  @Column({ nullable: true }) sku: string;
  @Column({ nullable: true }) kategorie: string;
  // Folierer-Welle 2: strukturierte Folien-Attribute (alle nullable/additiv, damit
  // bestehende Produkte/Nicht-Folien unberuehrt bleiben). Identitaet einer Folien-
  // vorlage = (hersteller, serie, finish, breiteCm), siehe importFolienVorlagen.
  @Column({ nullable: true }) hersteller: string;
  @Column({ nullable: true }) serie: string;
  @Column({ nullable: true }) farbcode: string;
  @Column({ nullable: true }) finish: string; // z. B. Gloss/Matt/Satin/Metallic/Struktur
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true }) breiteCm: number; // Rollenbreite in cm
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
