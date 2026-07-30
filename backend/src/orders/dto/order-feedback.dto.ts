import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Maximale Laenge des optionalen Kunden-Freitexts. */
export const FEEDBACK_KOMMENTAR_MAX = 1000;

/**
 * OEFFENTLICHES Kunden-Feedback zur Uebergabe-Mappe (login-frei, ueber den
 * Mappe-Token). Nur eine Sterne-Bewertung (1..5) + optionaler Freitext. Bewusst
 * KEINE Kunden-/Auftrags-Referenz im Body: der Auftrag ergibt sich AUSSCHLIESSLICH
 * aus dem Token (kein Setzen fremder Ziele moeglich).
 */
export class CreateOrderFeedbackDto {
  @IsInt()
  @Min(1)
  @Max(5)
  sterne: number;

  @IsOptional()
  @IsString()
  @MaxLength(FEEDBACK_KOMMENTAR_MAX)
  kommentar?: string;
}
