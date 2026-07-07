import { SetMetadata } from '@nestjs/common';

/** Metadata-Key, unter dem der geforderte Feature-Key abgelegt wird. */
export const REQUIRES_FEATURE_KEY = 'requiresFeature';

/**
 * Deklariert, dass ein Controller (Klassen-Ebene) oder ein einzelner Endpunkt
 * (Methoden-Ebene) nur nutzbar ist, wenn der Tarif des Betriebs den Feature-Key
 * enthaelt (z. B. `@RequiresFeature('shop')`). Durchgesetzt vom
 * `PlanFeatureGuard` (403 mit `code: 'PLAN_FEATURE_MISSING'`);
 * Methoden-Metadata ueberschreibt Klassen-Metadata.
 */
export const RequiresFeature = (feature: string) => SetMetadata(REQUIRES_FEATURE_KEY, feature);
