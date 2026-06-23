'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { eur, datum } from '@/lib/format';
import {
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_COLOR,
  ACCESS_LABEL,
  ACCESS_COLOR,
} from '@/lib/labels';
import type { Plan, TenantSubscriptionOverview, SubscriptionStatus } from '@/lib/types';
import { PageHeader, SectionCard, Loading, ErrorBox, Empty, Badge, Modal } from '@/components/ui';

const STATUS_OPTIONS = Object.keys(SUBSCRIPTION_STATUS_LABEL) as SubscriptionStatus[];
const LEER_TARIF = { slug: '', name: '', beschreibung: '', preisMonatlich: '', istAktiv: true };

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-850 px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-chrome-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-chrome-50">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-chrome-500">{hint}</p>}
    </div>
  );
}

export default function AbosPage() {
  const [overview, setOverview] = useState<TenantSubscriptionOverview[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Abo verwalten
  const [manage, setManage] = useState<TenantSubscriptionOverview | null>(null);
  const [form, setForm] = useState({ planId: '', status: 'active' as SubscriptionStatus, cancelAtPeriodEnd: false, notiz: '' });
  const [saving, setSaving] = useState(false);

  // Tarif anlegen/bearbeiten
  const [planModal, setPlanModal] = useState(false);
  const [planEdit, setPlanEdit] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState(LEER_TARIF);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, pl] = await Promise.all([
        api.get<TenantSubscriptionOverview[]>('/subscriptions/overview'),
        api.get<Plan[]>('/subscriptions/plans?includeInactive=true'),
      ]);
      setOverview(ov);
      setPlans(pl);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // --- Kennzahlen ---
  const aktiveAbos = overview.filter((o) => o.subscription && o.subscription.access.access !== 'blocked').length;
  const mrr = overview.reduce((sum, o) => {
    const s = o.subscription;
    if (s && s.status === 'active' && s.plan) return sum + Number(s.plan.preisMonatlich);
    return sum;
  }, 0);

  // --- Abo verwalten ---
  function openManage(entry: TenantSubscriptionOverview) {
    const s = entry.subscription;
    setForm({
      planId: s?.planId ?? plans.find((p) => p.istAktiv)?.id ?? '',
      status: (s?.status ?? 'active') as SubscriptionStatus,
      cancelAtPeriodEnd: s?.cancelAtPeriodEnd ?? false,
      notiz: s?.notiz ?? '',
    });
    setManage(entry);
  }

  async function saveSubscription(e: React.FormEvent) {
    e.preventDefault();
    if (!manage) return;
    if (!form.planId) {
      setError('Bitte einen Tarif auswaehlen.');
      return;
    }
    setSaving(true);
    try {
      const hasSub = !!manage.subscription;
      const path = `/subscriptions/tenant/${manage.tenantId}`;
      if (hasSub) {
        await api.patch(path, { planId: form.planId, status: form.status, cancelAtPeriodEnd: form.cancelAtPeriodEnd, notiz: form.notiz });
      } else {
        await api.put(path, { planId: form.planId, status: form.status, notiz: form.notiz });
      }
      setManage(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  async function quickAction(entry: TenantSubscriptionOverview, body: Record<string, unknown>, extend = false) {
    setError('');
    try {
      const path = `/subscriptions/tenant/${entry.tenantId}${extend ? '/extend' : ''}`;
      await (extend ? api.post(path, body) : api.patch(path, body));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aktion fehlgeschlagen');
    }
  }

  // --- Tarif anlegen/bearbeiten ---
  function openNewPlan() {
    setPlanEdit(null);
    setPlanForm(LEER_TARIF);
    setPlanModal(true);
  }
  function openEditPlan(p: Plan) {
    setPlanEdit(p);
    setPlanForm({ slug: p.slug, name: p.name, beschreibung: p.beschreibung ?? '', preisMonatlich: String(p.preisMonatlich), istAktiv: p.istAktiv });
    setPlanModal(true);
  }
  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        slug: planForm.slug,
        name: planForm.name,
        beschreibung: planForm.beschreibung || undefined,
        preisMonatlich: Number(planForm.preisMonatlich),
        istAktiv: planForm.istAktiv,
      };
      if (planEdit) await api.patch(`/subscriptions/plans/${planEdit.id}`, payload);
      else await api.post('/subscriptions/plans', payload);
      setPlanModal(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tarif speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Abos & Tarife"
        subtitle="SaaS-Verwaltung: Betriebe, ihre Abos und die angebotenen Tarife"
        action={
          <button className="btn-ghost" onClick={openNewPlan}>
            Neuer Tarif
          </button>
        }
      />

      {error && <ErrorBox message={error} />}

      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          {/* Kennzahlen */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile label="Betriebe" value={String(overview.length)} />
            <StatTile label="Aktive Abos" value={String(aktiveAbos)} hint={`von ${overview.length} Betrieben`} />
            <StatTile label="Monatl. Umsatz (MRR)" value={eur(mrr)} hint="Summe aktiver Abos" />
          </div>

          {/* Betriebe & Abos */}
          <SectionCard title="Betriebe & Abos" subtitle="Tarif zuweisen, verlaengern oder sperren">
            {overview.length === 0 ? (
              <Empty text="Keine Betriebe vorhanden." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Betrieb</th>
                      <th>Tarif</th>
                      <th>Status</th>
                      <th>Zugriff</th>
                      <th>Laufzeit bis</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.map((o) => {
                      const s = o.subscription;
                      return (
                        <tr key={o.tenantId}>
                          <td className="font-medium">
                            {o.tenantName}
                            <span className="ml-1 text-xs text-chrome-600">/{o.tenantSlug}</span>
                          </td>
                          <td>{s?.plan?.name ?? <span className="text-chrome-600">–</span>}</td>
                          <td>
                            {s ? (
                              <Badge className={SUBSCRIPTION_STATUS_COLOR[s.status]}>
                                {SUBSCRIPTION_STATUS_LABEL[s.status]}
                              </Badge>
                            ) : (
                              <Badge className="badge-neutral">Kein Abo</Badge>
                            )}
                          </td>
                          <td>
                            {s ? (
                              <Badge className={ACCESS_COLOR[s.access.access]}>{ACCESS_LABEL[s.access.access]}</Badge>
                            ) : (
                              <span className="text-chrome-600">–</span>
                            )}
                          </td>
                          <td className="text-chrome-300">{s?.currentPeriodEnd ? datum(s.currentPeriodEnd) : '–'}</td>
                          <td className="text-right">
                            <div className="flex justify-end gap-3 whitespace-nowrap">
                              {s && (
                                <button className="text-copper hover:underline" onClick={() => quickAction(o, { months: 1 }, true)}>
                                  +1 Monat
                                </button>
                              )}
                              {s && s.status !== 'suspended' && (
                                <button className="text-red-400 hover:underline" onClick={() => quickAction(o, { status: 'suspended' })}>
                                  Sperren
                                </button>
                              )}
                              {s && s.status === 'suspended' && (
                                <button className="text-emerald-300 hover:underline" onClick={() => quickAction(o, { status: 'active' })}>
                                  Reaktivieren
                                </button>
                              )}
                              <button className="text-chrome-200 hover:underline" onClick={() => openManage(o)}>
                                Verwalten
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Tarife */}
          <SectionCard title="Tarife" subtitle="Angebotene Preisstufen" action={<button className="btn-ghost" onClick={openNewPlan}>Neuer Tarif</button>}>
            {plans.length === 0 ? (
              <Empty text="Noch keine Tarife angelegt." action={<button className="btn-primary" onClick={openNewPlan}>Tarif anlegen</button>} />
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tarif</th>
                      <th>Preis / Monat</th>
                      <th>Module</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium">
                          {p.name}
                          <span className="ml-1 text-xs text-chrome-600">/{p.slug}</span>
                        </td>
                        <td>{eur(p.preisMonatlich)}</td>
                        <td className="text-chrome-400">{p.features?.length ?? 0} Module</td>
                        <td>
                          {p.istAktiv ? (
                            <Badge className="badge-positive">Aktiv</Badge>
                          ) : (
                            <Badge className="badge-neutral">Inaktiv</Badge>
                          )}
                        </td>
                        <td className="text-right">
                          <button className="text-chrome-200 hover:underline" onClick={() => openEditPlan(p)}>
                            Bearbeiten
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* Modal: Abo verwalten */}
      <Modal open={!!manage} onClose={() => setManage(null)} title={manage ? `Abo – ${manage.tenantName}` : 'Abo'}>
        <form onSubmit={saveSubscription} className="space-y-4">
          <div>
            <label className="label">Tarif</label>
            <select className="input" value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })} required>
              <option value="" disabled>
                Tarif auswaehlen…
              </option>
              {plans.filter((p) => p.istAktiv || p.id === form.planId).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} – {eur(p.preisMonatlich)}/Monat
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as SubscriptionStatus })}>
              {STATUS_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {SUBSCRIPTION_STATUS_LABEL[st]}
                </option>
              ))}
            </select>
          </div>
          {manage?.subscription && (
            <label className="flex items-center gap-2 text-sm text-chrome-300">
              <input
                type="checkbox"
                checked={form.cancelAtPeriodEnd}
                onChange={(e) => setForm({ ...form, cancelAtPeriodEnd: e.target.checked })}
              />
              Zum Laufzeitende kuendigen (Zugang bleibt bis dahin)
            </label>
          )}
          <div>
            <label className="label">Notiz (intern)</label>
            <textarea className="input" rows={2} value={form.notiz} onChange={(e) => setForm({ ...form, notiz: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setManage(null)}>
              Abbrechen
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Speichern…' : manage?.subscription ? 'Aenderungen speichern' : 'Abo anlegen'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Tarif anlegen/bearbeiten */}
      <Modal open={planModal} onClose={() => setPlanModal(false)} title={planEdit ? `Tarif – ${planEdit.name}` : 'Neuer Tarif'}>
        <form onSubmit={savePlan} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Name</label>
              <input className="input" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} required />
            </div>
            <div>
              <label className="label">Slug (technisch)</label>
              <input className="input" value={planForm.slug} onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })} required disabled={!!planEdit} />
            </div>
          </div>
          <div>
            <label className="label">Preis / Monat (EUR)</label>
            <input type="number" min={0} step="0.01" className="input" value={planForm.preisMonatlich} onChange={(e) => setPlanForm({ ...planForm, preisMonatlich: e.target.value })} required />
          </div>
          <div>
            <label className="label">Beschreibung</label>
            <textarea className="input" rows={2} value={planForm.beschreibung} onChange={(e) => setPlanForm({ ...planForm, beschreibung: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-chrome-300">
            <input type="checkbox" checked={planForm.istAktiv} onChange={(e) => setPlanForm({ ...planForm, istAktiv: e.target.checked })} />
            Tarif wird aktiv angeboten
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setPlanModal(false)}>
              Abbrechen
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
