import { GUARDS_METADATA } from '@nestjs/common/constants';
import { OrderTimeController } from './order-time.controller';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { REQUIRES_FEATURE_KEY } from '../common/decorators/requires-feature.decorator';

/**
 * Guard-Verdrahtung des Auftragszeiten-Moduls (Gate-Konsistenz, Pro-only):
 * Der ganze Controller haengt am `PlanFeatureGuard` und traegt auf Klassen-Ebene
 * `@RequiresFeature('zeiterfassung')` – damit ist auch die Lohn-CSV
 * `GET /order-times/export` fuer Tarife ohne das Feature gesperrt (403
 * PLAN_FEATURE_MISSING). Reflection-Test ohne Nest-Bootstrap; faellt der Guard
 * oder das Feature-Gate kuenftig weg, schlaegt dieser Test an.
 */
describe('OrderTimeController – Plan-Feature-Gate (zeiterfassung, Pro)', () => {
  const classGuards = (): unknown[] => Reflect.getMetadata(GUARDS_METADATA, OrderTimeController) ?? [];

  it('haengt am PlanFeatureGuard (Guard-Kette)', () => {
    expect(classGuards()).toContain(PlanFeatureGuard);
  });

  it('traegt @RequiresFeature("zeiterfassung") auf Klassen-Ebene', () => {
    expect(Reflect.getMetadata(REQUIRES_FEATURE_KEY, OrderTimeController)).toBe('zeiterfassung');
  });
});
