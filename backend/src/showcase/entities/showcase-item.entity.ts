import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { timestampColumnType } from '../../common/database.types';

/**
 * Gewerk eines Schaufenster-Eintrags. BEWUSST varchar + Code-Konstante (kein
 * Postgres-`enum`, vgl. geraetemarkt/kassenbuch/dellenkalkulation): neue Werte
 * erfordern dann keinen Enum-Reseed. @IsIn im DTO validiert die erlaubten Werte.
 */
export type ShowcaseGewerk = 'folie' | 'aufbereitung' | 'ppf';
export const SHOWCASE_GEWERKE: readonly ShowcaseGewerk[] = ['folie', 'aufbereitung', 'ppf'];

/**
 * Ein oeffentlich zeigbarer Vorher/Nachher-Referenz-Eintrag ("Schaufenster").
 *
 * Voll mandantengetrennt (tenantId + tenant-scope.ts). Die beiden Bilder liegen
 * als EIGENE Kopien unter private-uploads/schaufenster/<tenantId>/ (nicht
 * statisch gemountet) – die Auslieferung erfolgt ausschliesslich ueber den
 * token-scoped, traversal-sicheren PublicShowcaseController, und NUR fuer
 * veroeffentlichte Eintraege. Damit ist das Schaufenster vom Lebenszyklus der
 * Auftrags-/Inspektions-Fotos entkoppelt (ein geloeschter Auftrag laesst das
 * Schaufenster unberuehrt).
 *
 * RECHT (Bildveroeffentlichung): `veroeffentlicht=true` ist NUR zulaessig, wenn
 * der Betrieb `kundeEinverstaendnis` bestaetigt hat (schriftliches Einverstaendnis
 * des Kunden liegt vor). Zeitpunkt + Wortlaut der Bestaetigung werden als Nachweis
 * gespeichert (einverstaendnisAm / einverstaendnisHinweis). Ohne Bestaetigung
 * wirft der Service 400 (siehe ShowcaseService.setPublish).
 */
@Entity('showcase_items')
@Index(['tenantId', 'reihenfolge'])
export class ShowcaseItem {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column() tenantId: string;

  @Column() titel: string;
  @Column({ type: 'text', nullable: true }) beschreibung: string;

  /** 'folie' | 'aufbereitung' | 'ppf' – varchar + @IsIn (kein DB-Enum). */
  @Column({ default: 'aufbereitung' }) gewerk: ShowcaseGewerk;

  /**
   * Logische Pfade der eigenen Bild-Kopien (NICHT web-abrufbar):
   * "/private-uploads/schaufenster/<tenantId>/<uuid>.webp". Die Auslieferung
   * nutzt NUR den basename und loest streng unter dem Tenant-Ordner auf.
   */
  @Column() vorherPfad: string;
  @Column() nachherPfad: string;

  @Column({ default: false }) veroeffentlicht: boolean;

  /**
   * Geheimes, nicht-erratbares Token (randomBytes(24) hex). Erst beim ersten
   * Veroeffentlichen gesetzt; der oeffentliche Einzel-Link + der Bild-Endpunkt
   * scopen hierauf. Unique (mehrere NULL bleiben distinct).
   */
  @Index({ unique: true }) @Column({ nullable: true }) shareToken: string;

  @Column({ type: 'int', nullable: true }) reihenfolge: number;

  // --- Consent (Bildveroeffentlichung) ---
  /** Betrieb hat bestaetigt: schriftliches Einverstaendnis des Kunden liegt vor. */
  @Column({ default: false }) kundeEinverstaendnis: boolean;
  /** Zeitpunkt der Bestaetigung (Nachweis). */
  @Column({ type: timestampColumnType(), nullable: true }) einverstaendnisAm: Date;
  /** Wortlaut der bestaetigten Consent-Erklaerung (Nachweis, Klartext). */
  @Column({ type: 'text', nullable: true }) einverstaendnisHinweis: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
