import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrderTimeController } from './order-time.controller';
import { UserRole } from '../users/entities/user.entity';

/**
 * Rollen-Verdrahtung der Auftragszeiten. NEUES Modell (Ownership statt reinem
 * Rollen-Gate): Erfassen, Ansehen, Auswaehlen, die Uebersicht sowie das
 * Aendern/Loeschen sind auf Controller-Ebene fuer jede Rolle offen – die
 * feingranulare Regel (Leitung darf alle, Mitarbeiter nur EIGENE Buchungen; keine
 * Aenderung bei abgerechnetem Auftrag) erzwingt der Service. NUR die Lohn-CSV
 * (`export`, enthaelt Loehne) bleibt hart auf die Leitung beschraenkt.
 *
 * Liest die ECHTEN @Roles-Metadaten der Methoden – faellt kuenftig ein Gate weg
 * oder kommt eines dazu, schlaegt dieser Test an.
 */
function ctxFor(handler: any, role: string): any {
  return {
    getHandler: () => handler,
    getClass: () => OrderTimeController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  };
}

describe('OrderTimeController · RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const proto = OrderTimeController.prototype as any;

  const alleRollen = [
    UserRole.TECHNICIAN,
    UserRole.RECEPTIONIST,
    UserRole.MANAGER,
    UserRole.OWNER,
    UserRole.PLATFORM_ADMIN,
  ];

  it.each([['create'], ['update'], ['remove'], ['list'], ['bookableOrders'], ['uebersicht']])(
    '%s traegt kein @Roles-Gate – offen fuer jede Rolle (Ownership erzwingt der Service)',
    (method) => {
      for (const role of alleRollen) {
        expect(guard.canActivate(ctxFor(proto[method], role))).toBe(true);
      }
    },
  );

  it('export (Lohn-CSV) bleibt Leitung-only', () => {
    expect(guard.canActivate(ctxFor(proto.export, UserRole.TECHNICIAN))).toBe(false);
    expect(guard.canActivate(ctxFor(proto.export, UserRole.RECEPTIONIST))).toBe(false);
    expect(guard.canActivate(ctxFor(proto.export, UserRole.MANAGER))).toBe(true);
    expect(guard.canActivate(ctxFor(proto.export, UserRole.OWNER))).toBe(true);
    expect(guard.canActivate(ctxFor(proto.export, UserRole.PLATFORM_ADMIN))).toBe(true);
  });
});
