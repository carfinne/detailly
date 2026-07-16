'use client';

// E-Rechnungs-Eingang (Empfang + Lesen empfangener E-Rechnungen, §14 UStG).
// KERN – kein Tarif-Gate. Nutzt ausschliesslich die neuen Endpunkte:
//   - POST /invoices/eingang           (multipart, Feld "datei": XML oder PDF)
//   - GET  /invoices/eingang           (paginiert)
//   - GET  /invoices/eingang/:id/original (Roh-Download)
// Beträge werden NUR angezeigt, nie automatisch verbucht (Review-before-book).

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { eur, datum } from '@/lib/format';
import type { IncomingInvoice, IncomingInvoiceStatus, Paginated } from '@/lib/types';
import {
  PageHeader,
  Loading,
  ErrorBox,
  Empty,
  Badge,
  useToast,
} from '@/components/ui';
import { Icon, ICON_PATHS } from '@/lib/icons';
import { useT } from '@/lib/i18n';

const STATUS_BADGE: Record<IncomingInvoiceStatus, string> = {
  gelesen: 'badge-positive',
  teilweise: 'badge-caution',
  nicht_lesbar: 'badge-danger',
};

const PAGE_SIZE = 25;

export default function EingangsrechnungenPage() {
  const t = useT();
  const toast = useToast();
  const [items, setItems] = useState<IncomingInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Paginated<IncomingInvoice>>(
        `/invoices/eingang?page=${p}&limit=${PAGE_SIZE}`,
      );
      setItems(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('eingang.error.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load(1);
  }, [load]);

  const onFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setError('');
      try {
        const form = new FormData();
        form.append('datei', file);
        const beleg = await api.postForm<IncomingInvoice>('/invoices/eingang', form);
        const key =
          beleg.status === 'gelesen'
            ? 'eingang.toast.gelesen'
            : beleg.status === 'teilweise'
              ? 'eingang.toast.teilweise'
              : 'eingang.toast.nichtLesbar';
        toast(t(key), { variant: beleg.status === 'gelesen' ? 'positive' : 'copper' });
        await load(1);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : t('eingang.error.upload'));
      } finally {
        setUploading(false);
        if (fileInput.current) fileInput.current.value = '';
      }
    },
    [load, t, toast],
  );

  const uploadButton = (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".xml,application/xml,text/xml,.pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <button
        type="button"
        className="btn-primary"
        disabled={uploading}
        onClick={() => fileInput.current?.click()}
      >
        {uploading ? t('eingang.uploading') : t('eingang.upload')}
      </button>
    </>
  );

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ICON_PATHS.inbox}
        title={t('eingang.title')}
        subtitle={t('eingang.subtitle')}
        action={uploadButton}
      />

      {error && <ErrorBox message={error} />}

      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty text={t('eingang.empty')} action={uploadButton} />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-800/40">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-700 text-left text-chrome-400">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('eingang.col.seller')}</th>
                  <th className="px-4 py-3 font-medium">{t('eingang.col.number')}</th>
                  <th className="px-4 py-3 font-medium">{t('eingang.col.date')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('eingang.col.gross')}</th>
                  <th className="px-4 py-3 font-medium">{t('eingang.col.status')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-ink-800 last:border-0 hover:bg-ink-750/40">
                    <td className="px-4 py-3">
                      <Link href={`/eingangsrechnungen/detail?id=${it.id}`} className="font-medium text-chrome-50 hover:text-copper-300">
                        {it.verkaeuferName || t('eingang.unknownSeller')}
                      </Link>
                      {it.originalDateiname && (
                        <div className="text-xs text-chrome-500">{it.originalDateiname}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-chrome-200">{it.rechnungsnummer || '–'}</td>
                    <td className="px-4 py-3 text-chrome-200">{it.rechnungsdatum ? datum(it.rechnungsdatum) : '–'}</td>
                    <td className="px-4 py-3 text-right text-chrome-100">
                      {it.bruttoBetrag != null ? eur(it.bruttoBetrag) : '–'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_BADGE[it.status]}>{t(`eingang.status.${it.status}`)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                className="btn-ghost"
                disabled={page <= 1}
                onClick={() => load(page - 1)}
              >
                <Icon className="h-4 w-4 rotate-180">{ICON_PATHS.arrow}</Icon>
              </button>
              <span className="text-sm text-chrome-400">
                {t('eingang.page')} {page} / {pages}
              </span>
              <button
                type="button"
                className="btn-ghost"
                disabled={page >= pages}
                onClick={() => load(page + 1)}
              >
                <Icon className="h-4 w-4">{ICON_PATHS.arrow}</Icon>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
