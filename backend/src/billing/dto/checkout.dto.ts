import { IsIn, IsOptional, IsUUID } from 'class-validator';

/** Eingabe fuer den Checkout-Start. tenantId kommt NIE vom Client (immer aus dem JWT). */
export class CreateCheckoutDto {
  @IsUUID()
  planId: string;

  /** Zahlweise: monatlich (Default) oder jaehrlich. */
  @IsOptional()
  @IsIn(['month', 'year'])
  interval?: 'month' | 'year';
}
