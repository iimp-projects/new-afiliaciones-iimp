"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Plus, Search, Upload, Users } from "lucide-react";
import type { EmailOverview } from "../Models/EmailCampaign";
import type { CampaignListItem } from "../Models/Campaign";
import type { RecipientDetail, RecipientListItem, RecipientListOption } from "../Models/Recipient";
import { ImportRecipientsWizard } from "./ImportRecipientsWizard";
import { fetchRecipientDetailAction } from "../Actions/recipient.actions";
import { formatDateTimeEsPe } from "@/modules/shared/Utils/formatDateTime";

const campaignStatus: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-slate-100 text-slate-600" },
  READY: { label: "Lista", className: "bg-blue-100 text-blue-700" },
  SENDING: { label: "Enviando", className: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "Completada", className: "bg-emerald-100 text-emerald-700" },
  PARTIAL: { label: "Parcial", className: "bg-orange-100 text-orange-700" },
  CANCELLED: { label: "Cancelada", className: "bg-red-100 text-red-700" },
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No disponible";
  return formatDateTimeEsPe(date);
}

export function CorreosMasivosView({
  overview,
  campaigns,
  recipients,
  lists,
}: {
  overview: EmailOverview;
  campaigns: CampaignListItem[];
  recipients: RecipientListItem[];
  lists: RecipientListOption[];
}) {
  const [tab, setTab] = useState<"resumen" | "campanas" | "destinatarios">("resumen");
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [listFilter, setListFilter] = useState<string>("all");
  const [selected, setSelected] = useState<RecipientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const filteredRecipients = recipients.filter((recipient) => {
    if (listFilter !== "all" && !recipient.lists.includes(listFilter)) return false;
    if (search) {
      const haystack = `${recipient.name ?? ""} ${recipient.company ?? ""} ${recipient.email}`.toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setSelected(await fetchRecipientDetailAction(id));
    setDetailLoading(false);
  };

  const cards: Array<[string, number, string]> = [
    ["Campañas", overview.campaigns, "text-slate-800"],
    ["Destinatarios", overview.recipients, "text-slate-800"],
    ["Enviados", overview.sent, "text-emerald-600"],
    ["Pendientes", overview.pending, "text-amber-600"],
    ["Errores", overview.errors, "text-red-600"],
  ];

  return (
    <main className="mx-auto w-full max-w-[1600px] p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#C79A3B]">Comunicaciones</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-800">Correos Masivos</h1>
          <p className="text-sm text-slate-500">Gestión de campañas, destinatarios y envíos de correo.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/intranet/correos-masivos/campanas/nueva" className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#C5A059] px-5 text-sm font-black text-white shadow-md transition-colors hover:bg-[#b28d4c]">
            <Plus size={17} /> Nueva campaña
          </Link>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#C5A059] bg-white px-5 text-sm font-black text-[#7f561e] shadow-sm transition-colors hover:bg-[#fdfaf5]"
          >
            <Upload size={17} /> Importar destinatarios
          </button>
        </div>
      </header>

      <div className="mt-6 flex w-fit rounded-xl bg-slate-100 p-1">
        <button onClick={() => setTab("resumen")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "resumen" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>
          Resumen
        </button>
        <button onClick={() => setTab("campanas")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "campanas" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>
          Campañas
        </button>
        <button onClick={() => setTab("destinatarios")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "destinatarios" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>
          Destinatarios
        </button>
      </div>

      {tab === "resumen" && (
        <>
          <section className="mb-5 mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {cards.map(([label, value, color]) => (
              <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
                <p className={`mt-2 text-3xl font-black ${color}`}>{value}</p>
              </article>
            ))}
          </section>

          <section className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <header className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
              <Mail size={17} className="text-[#C5A059]" />
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">Campañas recientes</h2>
            </header>
            {overview.recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
                <Mail size={28} className="text-slate-300" />
                <p className="text-sm font-semibold text-slate-500">No existen campañas de correo registradas.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {overview.recent.map((campaign) => {
                  const presentation = campaignStatus[campaign.status] ?? campaignStatus.DRAFT;
                  return (
                    <li key={campaign.id} className="flex items-center justify-between gap-4 px-6 py-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800">{campaign.name}</p>
                        <p className="truncate text-xs text-slate-500">{campaign.subject}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${presentation.className}`}>{presentation.label}</span>
                        <span className="text-xs font-medium text-slate-400">{formatDate(campaign.createdAt)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {tab === "campanas" && (
        <section className="mt-6 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <header className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
            <Mail size={17} className="text-[#C5A059]" />
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">Campañas</h2>
          </header>
          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
              <Mail size={28} className="text-slate-300" />
              <p className="text-sm font-semibold text-slate-500">No existen campañas registradas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Campaña</th>
                    <th className="px-4 py-2">Estado</th>
                    <th className="px-4 py-2">Destinatarios</th>
                    <th className="px-4 py-2">Creada</th>
                    <th className="px-4 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campaigns.map((campaign) => {
                    const presentation = campaignStatus[campaign.status] ?? campaignStatus.DRAFT;
                    return (
                      <tr key={campaign.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-800">{campaign.name}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${presentation.className}`}>{presentation.label}</span></td>
                        <td className="px-4 py-3 text-slate-600">{campaign.recipientCount}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(campaign.createdAt)}</td>
                        <td className="px-4 py-3"><Link href={`/intranet/correos-masivos/campanas/${campaign.id}`} className="font-bold text-[#C5A059] hover:underline">Abrir</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "destinatarios" && (
        <section className="mt-6 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-4">
            <Users size={17} className="text-[#C5A059]" />
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">Destinatarios</h2>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nombre, empresa, correo" className="h-9 w-64 rounded-lg border border-slate-200 pl-8 pr-3 text-xs outline-none focus:border-[#C5A059]" />
              </div>
              <select value={listFilter} onChange={(event) => setListFilter(event.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-xs font-semibold">
                <option value="all">Todas las listas</option>
                {lists.map((list) => <option key={list.id} value={list.name}>{list.name}</option>)}
              </select>
            </div>
          </header>

          {filteredRecipients.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
              <Users size={28} className="text-slate-300" />
              <p className="text-sm font-semibold text-slate-500">No existen destinatarios registrados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Nombre</th>
                    <th className="px-4 py-2">Empresa</th>
                    <th className="px-4 py-2">Correo</th>
                    <th className="px-4 py-2">Listas</th>
                    <th className="px-4 py-2">Fecha de registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecipients.map((recipient) => (
                    <tr key={recipient.id} onClick={() => void openDetail(recipient.id)} className="cursor-pointer hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-700">{recipient.name || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{recipient.company || "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{recipient.email}</td>
                      <td className="px-4 py-3 text-slate-500">{recipient.lists.join(", ") || "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(recipient.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {selected && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800">Detalle del destinatario</h3>
              <button onClick={() => setSelected(null)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">✕</button>
            </div>
            {detailLoading ? (
              <p className="mt-6 text-sm text-slate-500">Cargando…</p>
            ) : (
              <dl className="mt-5 space-y-3 text-sm">
                <div><dt className="text-xs font-bold uppercase text-slate-400">Nombre</dt><dd className="font-semibold text-slate-800">{selected.name || "—"}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-slate-400">Email</dt><dd className="font-semibold text-slate-800">{selected.email}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-slate-400">Empresa</dt><dd className="font-semibold text-slate-800">{selected.company || "—"}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-slate-400">Cargo</dt><dd className="font-semibold text-slate-800">{selected.position || "—"}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-slate-400">RUC</dt><dd className="font-semibold text-slate-800">{selected.ruc || "—"}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-slate-400">Teléfono</dt><dd className="font-semibold text-slate-800">{selected.phone || "—"}</dd></div>
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-400">Listas</dt>
                  <dd className="space-y-2">
                    {selected.lists.length === 0 ? <span className="text-slate-500">—</span> : selected.lists.map((list) => (
                      <div key={list.listName} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <p className="font-semibold text-slate-700">{list.listName}</p>
                        {typeof list.metadata === "object" && list.metadata !== null && (
                          <pre className="mt-1 overflow-x-auto text-[10px] text-slate-500">{JSON.stringify(list.metadata, null, 2)}</pre>
                        )}
                      </div>
                    ))}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      )}

      {importOpen && <ImportRecipientsWizard onClose={() => setImportOpen(false)} onImported={() => window.location.reload()} />}
    </main>
  );
}
