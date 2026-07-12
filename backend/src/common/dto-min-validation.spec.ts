import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { InvoiceItemDto } from '../invoices/dto/invoice.dto';
import { OrderItemDto } from '../orders/dto/order.dto';
import { StockMovementDto } from '../shop/dto/shop.dto';
import { MovementType } from '../shop/entities/stock-movement.entity';

/**
 * Tests fuer die @Min(0)-Absicherung (K1/K4): Mengen und Preise in Positions-
 * und Bewegungs-DTOs duerfen nicht negativ sein; 0 bleibt erlaubt.
 */

async function invalidProps(dto: object): Promise<string[]> {
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

describe('DTO @Min(0) - Mengen/Preise duerfen nicht negativ sein (K1/K4)', () => {
  it('InvoiceItemDto: negative menge/einzelpreis werden abgelehnt', async () => {
    const props = await invalidProps(
      plainToInstance(InvoiceItemDto, { beschreibung: 'x', menge: -1, einzelpreis: -1 }),
    );
    expect(props).toContain('menge');
    expect(props).toContain('einzelpreis');
  });

  it('InvoiceItemDto: 0 ist erlaubt', async () => {
    const errors = await validate(
      plainToInstance(InvoiceItemDto, { beschreibung: 'x', menge: 0, einzelpreis: 0 }),
    );
    expect(errors).toHaveLength(0);
  });

  it('OrderItemDto: negative menge/einzelpreis werden abgelehnt', async () => {
    const props = await invalidProps(
      plainToInstance(OrderItemDto, { beschreibung: 'x', menge: -2, einzelpreis: -3 }),
    );
    expect(props).toContain('menge');
    expect(props).toContain('einzelpreis');
  });

  it('StockMovementDto: negative menge wird abgelehnt', async () => {
    const props = await invalidProps(
      plainToInstance(StockMovementDto, { typ: MovementType.ZUGANG, menge: -1 }),
    );
    expect(props).toContain('menge');
  });

  it('StockMovementDto: menge 0 ist erlaubt', async () => {
    const errors = await validate(
      plainToInstance(StockMovementDto, { typ: MovementType.ZUGANG, menge: 0 }),
    );
    expect(errors).toHaveLength(0);
  });
});
