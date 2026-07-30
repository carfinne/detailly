import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { encryptedStringTransformer } from '../../common/crypto/encrypted-column';

/**
 * PRIVATES Kunden-Feedback zur Uebergabe-Mappe (Welle 2-C). Der Endkunde gibt
 * ueber seinen (login-freien) Mappe-Token eine Sterne-Bewertung + optionalen
 * Freitext ab; das Feedback landet AUSSCHLIESSLICH beim Betrieb (erscheint in der
 * App), es geht NICHTS nach aussen. Kein Review-Gating: der oeffentliche
 * Bewertungs-Link (settings.bewertung.googleUrl) bleibt fuer JEDE Rueckmeldung
 * erreichbar (siehe orders.service.submitFeedbackByToken / Mappe-Frontend).
 *
 * FK-frei (Muster wie showcase_items): nur die logische orderId + tenantId. EIN
 * Feedback je Auftrag (Unique tenantId+orderId) -> ein erneutes Absenden
 * AKTUALISIERT den bestehenden Eintrag (sauberes Doppel-Absenden statt Spam-Zeilen).
 * `sterne` ist ein gebundener Integer (1..5, im DTO validiert) – KEIN DB-Enum.
 * `kommentar` ist verschluesselt (kann personenbezogenen Freitext enthalten,
 * Muster wie order.internerHinweis).
 */
@Entity('order_feedback')
// Listen-Muster WHERE tenantId ... ORDER BY createdAt DESC.
@Index(['tenantId', 'createdAt'])
// Glocke/Zaehler: ungelesenes Feedback je Betrieb.
@Index(['tenantId', 'gelesen'])
// Genau EIN Feedback je Auftrag (Idempotenz beim erneuten Absenden).
@Index(['tenantId', 'orderId'], { unique: true })
export class OrderFeedback {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() tenantId: string;

  /** Auftrag, zu dem das Feedback gehoert (aus dem Mappe-Token aufgeloest). */
  @Column() orderId: string;

  /** Sterne-Bewertung 1..5 (im DTO geklammert). >= 4 gilt als "positiv". */
  @Column({ type: 'int' }) sterne: number;

  /** Optionaler Freitext des Kunden (verschluesselt, kann PII enthalten). */
  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer })
  kommentar: string | null;

  /** Vom Betrieb gelesen? Steuert Glocken-Zaehler + Liste. */
  @Column({ default: false }) gelesen: boolean;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
