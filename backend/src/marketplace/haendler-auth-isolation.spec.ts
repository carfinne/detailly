import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  UserRole,
  TENANT_ROLLEN,
  PLATTFORM_ROLLEN,
  HAENDLER_ROLLEN,
} from '../users/entities/user.entity';
import { MarketplaceController } from './marketplace.controller';
import { HaendlerPortalAuthController } from './haendler-portal-auth.controller';
import { OrdersController } from '../orders/orders.controller';
import { CustomersController } from '../customers/customers.controller';
import { InvoicesController } from '../invoices/invoices.controller';
import { SupportController } from '../support/support.controller';

/**
 * Der Isolations-Kern von PR2: ein HAENDLER-Prinzipal (tenantId=null, dealerId
 * gesetzt) darf NIRGENDS an Tenant-/Plattform-Daten. Die Tests lesen die ECHTEN
 * @Roles-Metadaten der Controller und pruefen den RolesGuard – die eigentliche
 * Verteidigungslinie (SubscriptionGuard/PlanFeatureGuard lassen tenantId=null
 * dokumentiert durch).
 */
const guard = new RolesGuard(new Reflector());

/** Baut einen ExecutionContext-Stub fuer einen Handler + eine Rolle. */
const ctx = (handler: any, controller: any, role: string): any => ({
  getHandler: () => handler,
  getClass: () => controller,
  switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
});

// ---------------------------------------------------------------------------
// (c) HAENDLER ist WEDER Tenant- NOCH Plattform-Rolle (Validierungsgrenze)
// ---------------------------------------------------------------------------
describe('Rollen-Mengen · HAENDLER-Abgrenzung', () => {
  it('HAENDLER_ROLLEN enthaelt genau die Haendler-Rolle', () => {
    expect(HAENDLER_ROLLEN).toEqual([UserRole.HAENDLER]);
  });

  it('HAENDLER ist NICHT in TENANT_ROLLEN (Kunde kann die Rolle nicht vergeben)', () => {
    expect(TENANT_ROLLEN).not.toContain(UserRole.HAENDLER);
  });

  it('HAENDLER ist NICHT in PLATTFORM_ROLLEN', () => {
    expect(PLATTFORM_ROLLEN).not.toContain(UserRole.HAENDLER);
  });

  it('Tenant- und Plattform-Mengen ueberschneiden sich nicht mit HAENDLER_ROLLEN', () => {
    const alle = [...TENANT_ROLLEN, ...PLATTFORM_ROLLEN];
    expect(alle).not.toContain(UserRole.HAENDLER);
  });
});

// ---------------------------------------------------------------------------
// (a) HAENDLER bekommt von einem repraesentativen Satz Tenant-Controller 403
// ---------------------------------------------------------------------------
describe('Isolation · HAENDLER an Tenant-Controllern -> 403', () => {
  // Repraesentative, @Roles-geschuetzte Handler je Tenant-Controller.
  const faelle: Array<[string, any, any]> = [
    ['orders.create', (OrdersController.prototype as any).create, OrdersController],
    ['customers.create', (CustomersController.prototype as any).create, CustomersController],
    ['invoices.export', (InvoicesController.prototype as any).export, InvoicesController],
    // Buy-Side-Marktplatz: jetzt klassenweit @Roles(...TENANT_ROLLEN).
    ['marketplace.catalog', (MarketplaceController.prototype as any).catalog, MarketplaceController],
    ['marketplace.createOrders', (MarketplaceController.prototype as any).createOrders, MarketplaceController],
    ['marketplace.klick', (MarketplaceController.prototype as any).klick, MarketplaceController],
    // PR4: Katalog-API-Erweiterung (Kategorie-Baum + Produkt-Detail) erbt die Schranke.
    ['marketplace.categories', (MarketplaceController.prototype as any).categories, MarketplaceController],
    ['marketplace.productDetail', (MarketplaceController.prototype as any).productDetail, MarketplaceController],
    // PR3: Buy-Side-Datei-Streams erben die klassenweite Tenant-Schranke.
    ['marketplace.bild', (MarketplaceController.prototype as any).bild, MarketplaceController],
    ['marketplace.sdb', (MarketplaceController.prototype as any).sdb, MarketplaceController],
    // Kunden-Support: klassenweit @Roles(...TENANT_ROLLEN) (Cross-Tenant-Leak-Fix).
    ['support.list', (SupportController.prototype as any).list, SupportController],
    ['support.create', (SupportController.prototype as any).create, SupportController],
    ['support.reply', (SupportController.prototype as any).reply, SupportController],
  ];

  it.each(faelle)('%s ist fuer HAENDLER gesperrt', (_name, handler, controller) => {
    expect(guard.canActivate(ctx(handler, controller, UserRole.HAENDLER))).toBe(false);
  });

  it('dieselben Handler bleiben fuer eine Betriebs-Rolle (OWNER) offen', () => {
    for (const [, handler, controller] of faelle) {
      expect(guard.canActivate(ctx(handler, controller, UserRole.OWNER))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Umkehrung: das authentifizierte Haendler-Portal ist NUR fuer HAENDLER
// ---------------------------------------------------------------------------
describe('Isolation · Haendler-Portal nur fuer HAENDLER', () => {
  const proto = HaendlerPortalAuthController.prototype as any;
  const handlers = [
    proto.overview,
    proto.createProduct,
    proto.updateProduct,
    proto.setOrderStatus,
    // PR3: Upload-/Stream-Routen sind ebenfalls nur fuer HAENDLER.
    proto.uploadBilder,
    proto.deleteBild,
    proto.uploadSdb,
    proto.bild,
    proto.sdb,
  ];

  it('HAENDLER darf auf alle Portal-Routen', () => {
    for (const h of handlers) {
      expect(guard.canActivate(ctx(h, HaendlerPortalAuthController, UserRole.HAENDLER))).toBe(true);
    }
  });

  it.each([
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.TECHNICIAN,
    UserRole.RECEPTIONIST,
    UserRole.PLATFORM_ANALYST,
    UserRole.PLATFORM_SUPPORT,
  ])('Nicht-Haendler-Rolle %s kommt NICHT ins Haendler-Portal', (role) => {
    expect(guard.canActivate(ctx(proto.overview, HaendlerPortalAuthController, role))).toBe(false);
  });
});
