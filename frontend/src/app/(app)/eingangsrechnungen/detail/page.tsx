'use client';

// Detail einer empfangenen E-Rechnung: strukturierte Kopf-/Summen-Felder +
// Roh-Download des archivierten Originals. KERN – kein Tarif-Gate.
// Beträge werden NUR angezeigt, nie automatisch verbucht (Review-before-book).
// Query-Param-Route (?id=) statt dynamischem Segment – Konvention der App unter
// `output: export` (vgl. kunden/detail, auftraege/detail).

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ApiError, downloadAuthed } from '@/lib/api';
import { eur, datum } from '@/lib/format';
import type { IncomingInvoice, IncomingInvoiceStatus } from '@/lib/types';
import {
  PageHeader,
  Loading,
  ErrorBox,
  Badge,
  SectionCard,
  Row,
  useToast,
} from '@/components/ui';
import { ICON_PATHS } from '@/lib/icons';
import { useT } from '@/lib/i18n';

const STATUS_BADGE: Record<IncomingInvoiceStatus, string> = {
  gelesen: 'badge-positive',
  teilweise: 'badge-caution',
  nicht_lesbar: 'badge-danger',
};

function EingangsrechnungDetail() {
  const t = useT();
  const toast = useToast();
  const id = useSearchParams().get('id') ?? '';
  const [beleg, setBeleg] = useState<IncomingInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError(t('eingang.error.load'));
      return;
    }
    let aktiv = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get<IncomingInvoice>(`/invoices/eingang/${id}`);
        if (aktiv) setBeleg(res);
      } catch (e) {
        if (aktiv) setError(e instanceof ApiError ? e.message : t('eingang.error.load'));
      } finally {
        if (aktiv) setLoading(false);
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [id, t]);

  const onDownload = useCallback(async () => {
    if (!id) return;
    setDownloading(true);
    try {
      await downloadAuthed(`/invoices/eingang/${id}/original`, 'eingangsrechnung');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('eingang.error.download'), { variant: 'copper' });
    } finally {
      setDownloading(false);
    }
  }, [id, t, toast]);

  const back = (
    <Link href="/eingangsrechnungen" className="btn-ghost">
      {t('eingang.back')}
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader icon={ICON_PATHS.inbox} title={t('eingang.detail.title')} action={back} />
        <Loading />
      </div>
    );
  }

  if (error || !beleg) {
    return (
      <div className="space-y-6">
        <PageHeader icon={ICON_PATHS.inbox} title={t('eingang.detail.title')} action={back} />
        <ErrorBox message={error || t('eingang.error.load')} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ICON_PATHS.inbox}
        title={beleg.verkaeuferName || t('eingang.unknownSeller')}
        subtitle={beleg.rechnungsnummer ? `${t('eingang.col.number')}: ${beleg.rechnungsnummer}` : undefined}
        action={
          <div className="flex items-center gap-2">
            <button type="button" className="btn-primary" disabled={downloading} onClick={onDownload}>
              {downloading ? t('eingang.downloading') : t('eingang.download')}
            </button>
            {back}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge className={STATUS_BADGE[beleg.status]}>{t(`eingang.status.${beleg.status}`)}</Badge>
        <Badge className="badge-neutral">{t(`eingang.format.${beleg.format}`)}</Badge>
      </div>

      {beleg.parseFehler && <ErrorBox message={beleg.parseFehler} />}

      <div className="grid gap-6 md:grid-cols-2">
        <SectionCard title={t('eingang.section.invoice')}>
          <Row label={t('eingang.col.number')} value={beleg.rechnungsnummer || '–'} />
          <Row label={t('eingang.field.date')} value={beleg.rechnungsdatum ? datum(beleg.rechnungsdatum) : '–'} />
          <Row label={t('eingang.field.due')} value={beleg.faelligkeitsdatum ? datum(beleg.faelligkeitsdatum) : '–'} />
          <Row label={t('eingang.field.delivery')} value={beleg.leistungsdatum ? datum(beleg.leistungsdatum) : '–'} />
          <Row label={t('eingang.field.leitweg')} value={beleg.leitwegId || '–'} />
        </SectionCard>

        <SectionCard title={t('eingang.section.amounts')}>
          <Row label={t('eingang.field.net')} value={beleg.nettoBetrag != null ? eur(beleg.nettoBetrag) : '–'} />
          <Row label={t('eingang.field.vat')} value={beleg.mwstBetrag != null ? eur(beleg.mwstBetrag) : '–'} />
          <Row label={t('eingang.field.gross')} value={beleg.bruttoBetrag != null ? eur(beleg.bruttoBetrag) : '–'} />
          <Row label={t('eingang.field.currency')} value={beleg.waehrung || 'EUR'} />
        </SectionCard>

        <SectionCard title={t('eingang.section.seller')}>
          <Row label={t('eingang.field.sellerName')} value={beleg.verkaeuferName || '–'} />
          <Row label={t('eingang.field.address')} value={beleg.verkaeuferAnschrift || '–'} />
          <Row label={t('eingang.field.vatId')} value={beleg.verkaeuferUstId || '–'} />
          <Row label={t('eingang.field.taxNumber')} value={beleg.verkaeuferSteuernummer || '–'} />
        </SectionCard>

        <SectionCard title={t('eingang.section.payment')}>
          <Row label={t('eingang.field.iban')} value={beleg.iban || '–'} />
          <Row label={t('eingang.field.bic')} value={beleg.bic || '–'} />
        </SectionCard>
      </div>

      <p className="text-xs text-chrome-500">{t('eingang.archiveHint')}</p>
    </div>
  );
}

export default function EingangsrechnungDetailPage() {
  return (
    <Suspense fallback={<Loading />}>
      <EingangsrechnungDetail />
    </Suspense>
  );
}
