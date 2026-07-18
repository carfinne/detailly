import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateTenantSettingsDto } from './update-tenant-settings.dto';
import { STATUS_MAIL_BETREFF_MAX, STATUS_MAIL_TEXT_MAX } from '../../common/status-mail-vorlagen';

/**
 * DTO-Validierung der Status-Mail-Vorlagen (Welle 3-A). Prueft: gueltige Vorlagen
 * gehen durch, verschachtelte @MaxLength/@IsString greifen, forbidNonWhitelisted-
 * Verhalten (unbekannte Keys werden abgelehnt, whitelist:true streift sie).
 */
async function validateDto(payload: unknown, opts?: { whitelist?: boolean; forbid?: boolean }) {
  const dto = plainToInstance(UpdateTenantSettingsDto, payload);
  return validate(dto, {
    whitelist: opts?.whitelist ?? false,
    forbidNonWhitelisted: opts?.forbid ?? false,
  });
}

describe('UpdateTenantSettingsDto - statusMailVorlagen', () => {
  it('gueltige Vorlage (Betreff + Text) -> keine Fehler', async () => {
    const errors = await validateDto({
      statusMailVorlagen: {
        bestaetigt: { betreff: 'Auftrag {auftragsnummer} bestätigt', text: 'Hallo, {betrieb}' },
        abholbereit: { text: '{fahrzeug} ist {status}' },
      },
    });
    expect(errors).toHaveLength(0);
  });

  it('leere Objekte/Teil-Update sind erlaubt', async () => {
    const errors = await validateDto({ statusMailVorlagen: { in_arbeit: {} } });
    expect(errors).toHaveLength(0);
  });

  it('zu langer Betreff -> Fehler (@MaxLength)', async () => {
    const errors = await validateDto({
      statusMailVorlagen: { bestaetigt: { betreff: 'x'.repeat(STATUS_MAIL_BETREFF_MAX + 1) } },
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('zu langer Text -> Fehler (@MaxLength)', async () => {
    const errors = await validateDto({
      statusMailVorlagen: { abholbereit: { text: 'y'.repeat(STATUS_MAIL_TEXT_MAX + 1) } },
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('Nicht-String-Betreff -> Fehler (@IsString)', async () => {
    const errors = await validateDto({
      statusMailVorlagen: { bestaetigt: { betreff: 123 as unknown as string } },
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('forbidNonWhitelisted: unbekannter Sub-Key im Status wird abgelehnt', async () => {
    const errors = await validateDto(
      { statusMailVorlagen: { bestaetigt: { fremd: 'x' } } },
      { whitelist: true, forbid: true },
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('Grenzwerte exakt (MaxLength) -> erlaubt', async () => {
    const errors = await validateDto({
      statusMailVorlagen: {
        bestaetigt: { betreff: 'x'.repeat(STATUS_MAIL_BETREFF_MAX), text: 'y'.repeat(STATUS_MAIL_TEXT_MAX) },
      },
    });
    expect(errors).toHaveLength(0);
  });
});
