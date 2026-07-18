import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PLATTFORM_ROLLEN } from '../users/entities/user.entity';
import { DataIncident } from './entities/data-incident.entity';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import {
  IncidentSignalTyp,
  meldefristDeadline,
  meldefristRestMs,
  meldefristUeberfaellig,
} from './incident.constants';

/** Vorfall inkl. abgeleiteter 72h-Fristfelder fuers Frontend. */
export interface IncidentView extends DataIncident {
  frist: {
    deadline: string;
    restMs: number;
    ueberfaellig: boolean;
  };
}

/** Vorbelegung je Auto-Signaltyp (Beschreibung/Kategorien/Schweregrad). */
const SIGNAL_DEFAULTS: Record<
  IncidentSignalTyp,
  { schweregrad: 'mittel' | 'hoch'; kategorien: string[]; titel: string }
> = {
  export_spike: {
    schweregrad: 'hoch',
    kategorien: ['kontaktdaten', 'fahrzeugdaten', 'rechnungsdaten'],
    titel: 'Auffaellig viele Datenexporte',
  },
  login_bruteforce: {
    schweregrad: 'mittel',
    kategorien: ['zugangsdaten'],
    titel: 'Gehaeufte fehlgeschlagene Anmeldungen (moegliche Brute-Force)',
  },
  forbidden_spike: {
    schweregrad: 'mittel',
    kategorien: ['zugriffsversuche'],
    titel: 'Gehaeufte unberechtigte Zugriffsversuche (403)',
  },
};

/**
 * Datenpannen-Register (Art. 33/34 DSGVO). Strikt mandantengetrennt:
 *  - Betriebs-Rollen (OWNER) sehen NUR Vorfaelle des eigenen `tenantId`.
 *  - Plattform-Rollen sehen NUR plattformweite Vorfaelle (`tenantId IS NULL`).
 * Es findet KEIN automatischer Versand statt: Meldungen an Aufsichtsbehoerde/
 * Verantwortlichen/Betroffene werden vom Menschen ausserhalb der App verschickt;
 * das Register dokumentiert nur Zeitpunkte + haelt eine Melde-VORLAGE bereit.
 */
@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    @InjectRepository(DataIncident) private readonly repo: Repository<DataIncident>,
  ) {}

  // ---------------------------------------------------------------------------
  // Tenant-Scope
  // ---------------------------------------------------------------------------

  /** Plattform-Rollen -> plattformweite Vorfaelle (tenantId NULL), sonst eigener Betrieb. */
  private scope(user: AuthUser): { tenantId: string } | { tenantId: ReturnType<typeof IsNull> } {
    if ((PLATTFORM_ROLLEN as string[]).includes(user.role)) {
      return { tenantId: IsNull() };
    }
    return { tenantId: user.tenantId };
  }

  private toView(inc: DataIncident, now: Date = new Date()): IncidentView {
    return {
      ...inc,
      frist: {
        deadline: meldefristDeadline(inc.kenntnisAm).toISOString(),
        restMs: meldefristRestMs(inc.kenntnisAm, now),
        ueberfaellig: meldefristUeberfaellig(inc.kenntnisAm, now),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Lesen
  // ---------------------------------------------------------------------------

  async list(user: AuthUser): Promise<IncidentView[]> {
    const rows = await this.repo.find({
      where: this.scope(user),
      order: { createdAt: 'DESC' },
      take: 500,
    });
    const now = new Date();
    return rows.map((r) => this.toView(r, now));
  }

  async getOne(user: AuthUser, id: string): Promise<IncidentView> {
    const inc = await this.repo.findOne({ where: { id, ...this.scope(user) } });
    if (!inc) throw new NotFoundException('Vorfall nicht gefunden');
    return this.toView(inc);
  }

  // ---------------------------------------------------------------------------
  // Schreiben (manuell durch den Betrieb)
  // ---------------------------------------------------------------------------

  async create(user: AuthUser, dto: CreateIncidentDto): Promise<IncidentView> {
    // Plattform-Rollen legen plattformweite Vorfaelle an (tenantId NULL).
    const tenantId = (PLATTFORM_ROLLEN as string[]).includes(user.role) ? null : user.tenantId;
    const inc = this.repo.create({
      tenantId,
      quelle: dto.quelle ?? 'manuell',
      signalTyp: null,
      status: 'erkannt',
      schweregrad: dto.schweregrad ?? 'mittel',
      kenntnisAm: dto.kenntnisAm ? new Date(dto.kenntnisAm) : new Date(),
      betroffeneDatenkategorien: dto.betroffeneDatenkategorien ?? null,
      betroffenePersonenAnzahl: dto.betroffenePersonenAnzahl ?? null,
      betroffeneDatensaetzeAnzahl: dto.betroffeneDatensaetzeAnzahl ?? null,
      beschreibung: dto.beschreibung,
      wahrscheinlicheFolgen: dto.wahrscheinlicheFolgen ?? null,
      getroffeneMassnahmen: dto.getroffeneMassnahmen ?? null,
      risikoBewertung: dto.risikoBewertung ?? null,
      bearbeiterUserId: user.id,
    });
    const saved = await this.repo.save(inc);
    return this.toView(saved);
  }

  async update(user: AuthUser, id: string, dto: UpdateIncidentDto): Promise<IncidentView> {
    const inc = await this.repo.findOne({ where: { id, ...this.scope(user) } });
    if (!inc) throw new NotFoundException('Vorfall nicht gefunden');

    if (dto.status !== undefined) inc.status = dto.status;
    if (dto.schweregrad !== undefined) inc.schweregrad = dto.schweregrad;
    if (dto.betroffeneDatenkategorien !== undefined)
      inc.betroffeneDatenkategorien = dto.betroffeneDatenkategorien;
    if (dto.betroffenePersonenAnzahl !== undefined)
      inc.betroffenePersonenAnzahl = dto.betroffenePersonenAnzahl;
    if (dto.betroffeneDatensaetzeAnzahl !== undefined)
      inc.betroffeneDatensaetzeAnzahl = dto.betroffeneDatensaetzeAnzahl;
    if (dto.beschreibung !== undefined) inc.beschreibung = dto.beschreibung;
    if (dto.wahrscheinlicheFolgen !== undefined) inc.wahrscheinlicheFolgen = dto.wahrscheinlicheFolgen;
    if (dto.getroffeneMassnahmen !== undefined) inc.getroffeneMassnahmen = dto.getroffeneMassnahmen;
    if (dto.risikoBewertung !== undefined) inc.risikoBewertung = dto.risikoBewertung;

    // Eskalations-Checkliste: Boolean -> Zeitstempel (setzen wenn true & leer,
    // loeschen wenn false). Der tatsaechliche Versand passiert ausserhalb der App.
    const now = new Date();
    inc.verantwortlicherInformiertAm = this.applyToggle(
      inc.verantwortlicherInformiertAm,
      dto.verantwortlicherInformiert,
      now,
    );
    inc.aufsichtsbehoerdeGemeldetAm = this.applyToggle(
      inc.aufsichtsbehoerdeGemeldetAm,
      dto.aufsichtsbehoerdeGemeldet,
      now,
    );
    inc.betroffeneInformiertAm = this.applyToggle(
      inc.betroffeneInformiertAm,
      dto.betroffeneInformiert,
      now,
    );

    const saved = await this.repo.save(inc);
    return this.toView(saved);
  }

  private applyToggle(current: Date | null, flag: boolean | undefined, now: Date): Date | null {
    if (flag === undefined) return current;
    if (flag) return current ?? now; // idempotent: bereits gesetzten Zeitpunkt behalten
    return null;
  }

  // ---------------------------------------------------------------------------
  // Melde-VORLAGE (Art. 33) – generiert Text, versendet NICHTS.
  // ---------------------------------------------------------------------------

  async generateMeldungEntwurf(user: AuthUser, id: string): Promise<{ entwurf: string }> {
    const inc = await this.repo.findOne({ where: { id, ...this.scope(user) } });
    if (!inc) throw new NotFoundException('Vorfall nicht gefunden');
    const entwurf = this.buildMeldungText(inc);
    inc.meldungEntwurf = entwurf;
    await this.repo.save(inc);
    return { entwurf };
  }

  /** Baut den Art.-33-Meldetext (deutsch) aus den Vorfalldaten. Reine Funktion. */
  private buildMeldungText(inc: DataIncident): string {
    const deadline = meldefristDeadline(inc.kenntnisAm);
    const fmt = (d: Date | null): string => (d ? d.toLocaleString('de-DE') : '—');
    const kat = (inc.betroffeneDatenkategorien ?? []).join(', ') || '—';
    return [
      'MELDUNG EINER VERLETZUNG DES SCHUTZES PERSONENBEZOGENER DATEN (Art. 33 DSGVO)',
      '— ENTWURF, bitte vor dem Versand pruefen und ergaenzen —',
      '',
      `Kenntniszeitpunkt: ${fmt(inc.kenntnisAm)}`,
      `Meldefrist (72 Std.): bis ${fmt(deadline)}`,
      `Schweregrad (Einschaetzung): ${inc.schweregrad}`,
      '',
      '1. Art der Verletzung:',
      inc.beschreibung ?? '(bitte beschreiben)',
      '',
      '2. Kategorien betroffener Daten:',
      kat,
      '',
      '3. Ungefaehre Zahl der betroffenen Personen bzw. Datensaetze:',
      `Personen: ${inc.betroffenePersonenAnzahl ?? 'unbekannt'} / Datensaetze: ${
        inc.betroffeneDatensaetzeAnzahl ?? 'unbekannt'
      }`,
      '',
      '4. Wahrscheinliche Folgen der Verletzung:',
      inc.wahrscheinlicheFolgen ?? '(bitte einschaetzen)',
      '',
      '5. Ergriffene bzw. vorgeschlagene Massnahmen:',
      inc.getroffeneMassnahmen ?? '(bitte ergaenzen)',
      '',
      '6. Kontakt fuer Rueckfragen (Datenschutz-Ansprechpartner):',
      '(bitte eintragen)',
      '',
      'Hinweis: Dieser Entwurf wird von Detailly NICHT automatisch versendet. Die',
      'Meldung an die zustaendige Aufsichtsbehoerde erfolgt durch den Verantwortlichen.',
    ].join('\n');
  }

  // ---------------------------------------------------------------------------
  // Auto-Erkennung (vom IncidentDetectionService aufgerufen) – mit De-Duplizierung
  // ---------------------------------------------------------------------------

  /**
   * Legt einen Auto-Vorfall an ODER aktualisiert den bereits OFFENEN Vorfall
   * gleichen (tenantId, signalTyp) – so entsteht bei anhaltendem Signal KEIN Spam.
   * Gibt zurueck, ob ein NEUER Vorfall erzeugt wurde (fuer Logging/Tests).
   */
  async upsertAutoIncident(params: {
    tenantId: string;
    signalTyp: IncidentSignalTyp;
    beobachtet: number;
    detail: string;
    now?: Date;
  }): Promise<{ created: boolean; incident: DataIncident }> {
    const now = params.now ?? new Date();
    const def = SIGNAL_DEFAULTS[params.signalTyp];

    // De-dup: es darf je (tenantId, signalTyp) nur EINEN offenen Auto-Vorfall geben.
    // 'erkannt' und 'in_pruefung' gelten als offen; danach ist der Fall in Arbeit.
    const offen = await this.repo.findOne({
      where: [
        { tenantId: params.tenantId, signalTyp: params.signalTyp, status: 'erkannt' },
        { tenantId: params.tenantId, signalTyp: params.signalTyp, status: 'in_pruefung' },
      ],
      order: { createdAt: 'DESC' },
    });

    if (offen) {
      // WICHTIG: Sobald ein Mensch den Vorfall in 'in_pruefung' genommen hat,
      // duerfen die editierbaren Felder NICHT mehr ueberschrieben werden –
      // beschreibung/betroffeneDatensaetzeAnzahl pflegt dann der OWNER (Ermittlungs-
      // notizen). Nur solange der Vorfall noch rein maschinell ('erkannt') ist,
      // wird der beobachtete Roh-Count fortgeschrieben. Der De-Dup-Treffer selbst
      // verhindert in BEIDEN Faellen einen Duplikat-Vorfall.
      if (offen.status === 'erkannt') {
        offen.betroffeneDatensaetzeAnzahl = params.beobachtet;
        offen.beschreibung = `${def.titel}: ${params.detail}`;
        await this.repo.save(offen);
      }
      return { created: false, incident: offen };
    }

    const inc = this.repo.create({
      tenantId: params.tenantId,
      quelle: 'auto_signal',
      signalTyp: params.signalTyp,
      status: 'erkannt',
      schweregrad: def.schweregrad,
      kenntnisAm: now,
      betroffeneDatenkategorien: def.kategorien,
      betroffeneDatensaetzeAnzahl: params.beobachtet,
      beschreibung: `${def.titel}: ${params.detail}`,
      risikoBewertung:
        'Automatisch aus dem Audit-Stream erkannt. Bitte pruefen, ob eine ' +
        'meldepflichtige Verletzung (Art. 33 DSGVO) vorliegt.',
    });
    const saved = await this.repo.save(inc);
    this.logger.warn(
      `Auto-Vorfall angelegt (tenant=${params.tenantId}, signal=${params.signalTyp}, n=${params.beobachtet}).`,
    );
    return { created: true, incident: saved };
  }
}
