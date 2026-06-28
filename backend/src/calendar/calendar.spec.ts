import { CalendarService } from './calendar.service';

/** Reine ICS-Erzeugung (RFC 5545) – ohne DB. */
describe('CalendarService · buildIcs', () => {
  const svc = new CalendarService({} as any, {} as any);

  const appt = (over: Record<string, unknown> = {}): any => ({
    id: 'a1',
    titel: 'Aufbereitung; Golf, schwarz',
    start: new Date(Date.UTC(2026, 5, 28, 8, 0, 0)),
    ende: new Date(Date.UTC(2026, 5, 28, 9, 30, 0)),
    status: 'bestaetigt',
    notiz: 'Zeile1\nZeile2',
    ...over,
  });

  it('gerüst: VCALENDAR + VEVENT + UID', () => {
    const ics = svc.buildIcs('Muster GmbH', [appt()]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('UID:a1@detailly');
  });

  it('Datum als UTC YYYYMMDDTHHMMSSZ', () => {
    const ics = svc.buildIcs('X', [appt()]);
    expect(ics).toContain('DTSTART:20260628T080000Z');
    expect(ics).toContain('DTEND:20260628T093000Z');
  });

  it('escaped Komma/Semikolon im Titel und Zeilenumbruch in der Notiz', () => {
    const ics = svc.buildIcs('X', [appt()]);
    expect(ics).toContain('SUMMARY:Aufbereitung\\; Golf\\, schwarz');
    expect(ics).toContain('DESCRIPTION:Zeile1\\nZeile2');
  });

  it.each([
    ['bestaetigt', 'CONFIRMED'],
    ['abgeschlossen', 'CONFIRMED'],
    ['abgesagt', 'CANCELLED'],
    ['geplant', 'TENTATIVE'],
  ])('Status %s -> %s', (status, erwartet) => {
    const ics = svc.buildIcs('X', [appt({ status })]);
    expect(ics).toContain(`STATUS:${erwartet}`);
  });

  it('nutzt CRLF-Zeilenenden', () => {
    const ics = svc.buildIcs('X', [appt()]);
    expect(ics).toContain('\r\n');
    expect(ics.endsWith('\r\n')).toBe(true);
  });

  it('ohne Termine trotzdem gültiges, leeres VCALENDAR', () => {
    const ics = svc.buildIcs('Leer', []);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });
});
