import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { promises as fsp } from 'fs';
import { EInvoiceEingangService } from './e-invoice-eingang.service';
import {
  IncomingInvoice,
  IncomingInvoiceFormat,
  IncomingInvoiceStatus,
} from './entities/incoming-invoice.entity';

// Datei-I/O nur per Spy stummschalten (NICHT das ganze fs-Modul mocken – das
// wuerde den TypeORM-Glob-Loader beim Import zerlegen).

const UBL_MIN = `<?xml version="1.0"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>RE-9</cbc:ID>
  <cbc:IssueDate>2026-07-10</cbc:IssueDate>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyLegalEntity><cbc:RegistrationName>Muster Lieferant</cbc:RegistrationName></cac:PartyLegalEntity>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount currencyID="EUR">50.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">59.50</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">59.50</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</ubl:Invoice>`;

function makeRepo() {
  return {
    create: jest.fn((x: Partial<IncomingInvoice>) => x),
    save: jest.fn(async (x: Partial<IncomingInvoice>) => ({ id: 'new-id', ...x })),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  };
}

describe('EInvoiceEingangService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: EInvoiceEingangService;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(fsp, 'mkdir').mockResolvedValue(undefined as never);
    jest.spyOn(fsp, 'writeFile').mockResolvedValue(undefined as never);
    repo = makeRepo();
    service = new EInvoiceEingangService(repo as never);
  });

  describe('verarbeiteUpload', () => {
    it('liest ein UBL-XML aus -> Status GELESEN, Felder gemappt, Original archiviert', async () => {
      repo.findOne.mockResolvedValue(null); // keine Dublette
      const res = await service.verarbeiteUpload('t1', 'u1', {
        originalname: 'rechnung.xml',
        buffer: Buffer.from(UBL_MIN, 'utf8'),
      });
      expect(res.status).toBe(IncomingInvoiceStatus.GELESEN);
      expect(res.format).toBe(IncomingInvoiceFormat.UBL);
      expect(res.tenantId).toBe('t1');
      expect(res.rechnungsnummer).toBe('RE-9');
      expect(res.verkaeuferName).toBe('Muster Lieferant');
      expect(Number(res.bruttoBetrag)).toBe(59.5);
      expect(res.parseFehler).toBeNull();
      // Original wird IMMER archiviert (GoBD).
      expect((fsp.writeFile as jest.Mock)).toHaveBeenCalledTimes(1);
    });

    it('nicht lesbares XML -> Status NICHT_LESBAR, aber trotzdem archiviert', async () => {
      repo.findOne.mockResolvedValue(null);
      const res = await service.verarbeiteUpload('t1', 'u1', {
        originalname: 'kaputt.xml',
        buffer: Buffer.from('<foo>kein invoice</foo>', 'utf8'),
      });
      expect(res.status).toBe(IncomingInvoiceStatus.NICHT_LESBAR);
      expect(res.format).toBe(IncomingInvoiceFormat.UNBEKANNT);
      expect(res.parseFehler).toContain('archiviert');
      expect((fsp.writeFile as jest.Mock)).toHaveBeenCalledTimes(1);
    });

    it('weder XML noch PDF (Magic-Byte) -> 400, nichts geschrieben', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.verarbeiteUpload('t1', 'u1', { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]) }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect((fsp.writeFile as jest.Mock)).not.toHaveBeenCalled();
    });

    it('leere/fehlende Datei -> 400', async () => {
      await expect(service.verarbeiteUpload('t1', 'u1', undefined)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        service.verarbeiteUpload('t1', 'u1', { buffer: Buffer.alloc(0) }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('Dublette (gleicher Hash im selben Tenant) -> 409, nichts geschrieben', async () => {
      repo.findOne.mockResolvedValue({ id: 'existing' } as IncomingInvoice);
      await expect(
        service.verarbeiteUpload('t1', 'u1', { buffer: Buffer.from(UBL_MIN, 'utf8') }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect((fsp.writeFile as jest.Mock)).not.toHaveBeenCalled();
    });

    it('Dedup-Lookup ist tenant-gescoped', async () => {
      repo.findOne.mockResolvedValue(null);
      await service.verarbeiteUpload('t1', 'u1', { buffer: Buffer.from(UBL_MIN, 'utf8') });
      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 't1' }) }),
      );
    });
  });

  describe('findOne (Mandantentrennung)', () => {
    it('lädt nur den eigenen Beleg (tenant-scoped)', async () => {
      repo.findOne.mockResolvedValue({ id: 'x', tenantId: 't1' } as IncomingInvoice);
      await service.findOne('t1', 'x');
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'x', tenantId: 't1' } });
    });

    it('fremder/unbekannter Beleg -> 404', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('t1', 'fremd')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('paginiert tenant-scoped, neueste zuerst', async () => {
      repo.findAndCount.mockResolvedValue([[{ id: 'a' }], 1]);
      const res = await service.findAll('t1', { page: 1, limit: 20 });
      expect(res).toEqual({ data: [{ id: 'a' }], total: 1, page: 1, limit: 20 });
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 't1' },
          order: { createdAt: 'DESC' },
        }),
      );
    });
  });
});
