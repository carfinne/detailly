import { PublicCalendarController } from './public-calendar.controller';

/**
 * D2 (Sicherheitsaudit Welle 1): Der oeffentliche iCal-Feed war frueher
 * @SkipThrottle (= unbegrenzt) und damit ein Token-Bruteforce-/DoS-Vektor.
 * Jetzt gilt @Throttle({ default: { limit: 60, ttl: 60000 } }).
 *
 * Getestet ueber die von @nestjs/throttler gesetzte Reflect-Metadata (kein
 * Nest-Bootstrap noetig). Die Metadata-Keys folgen dem Schema
 * `<PREFIX><name>` mit name='default' (siehe throttler.decorator/-constants):
 *   THROTTLER:LIMIT  -> Limit,  THROTTLER:TTL -> ttl,  THROTTLER:SKIP -> SkipThrottle.
 */
describe('PublicCalendarController – Throttle-Verdrahtung (D2)', () => {
  const handler = PublicCalendarController.prototype.ics;

  it('setzt ein endliches Limit von 60 Requests pro Minute', () => {
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(60);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60000);
  });

  it('ist NICHT mehr per SkipThrottle vom Rate-Limit ausgenommen', () => {
    expect(Reflect.getMetadata('THROTTLER:SKIPdefault', handler)).toBeUndefined();
  });
});
