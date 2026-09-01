import React, { useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  History,
  IdCard,
  Info,
  Mail,
  MessageSquare,
  Phone,
  RefreshCcw,
  Send,
  ShieldAlert,
  UserMinus,
} from "lucide-react";

interface AvalesTabProps {
  payload: any;
  onReplaceAval?: (avalId: number) => void;
  onSendMessage?: (avalId: number, message: string) => void;
  onResendEmail?: (avalId: number, email: string) => void; // <-- AHORA RECIBE EL EMAIL AQUÍ
}

// ============================================================================
// CAMPO COPIABLE — VISUAL NEUTRO
// ============================================================================
const CopyableField = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string | null;
  icon: any;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value || value === "No registrado") return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
        <Icon size={12} strokeWidth={1.8} className="text-slate-300" />
        <span>{label}</span>
      </div>
      <div className="mt-1 flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 break-all text-[12px] font-medium text-slate-700">
          {value || "No registrado"}
        </span>
        {value && value !== "No registrado" && (
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 text-slate-300 transition-colors hover:text-slate-600 focus:outline-none"
            title={`Copiar ${label}`}
            aria-label={`Copiar ${label}`}
          >
            {copied ? (
              <Check size={13} strokeWidth={2.5} className="text-emerald-500" />
            ) : (
              <Copy size={13} strokeWidth={1.8} />
            )}
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// COMENTARIOS
// ============================================================================
const CommentsPanel = ({
  messages,
  onSend,
  readOnly = false,
}: {
  messages: any[];
  onSend?: (txt: string) => void;
  readOnly?: boolean;
}) => {
  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    onSend?.(text);
    setInputText("");
  };

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3.5 py-2.5">
        <MessageSquare size={13} className="text-slate-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Comentarios
        </span>
        {readOnly && (
          <span className="ml-auto text-[9px] font-medium text-slate-400">
            Solo lectura
          </span>
        )}
      </div>

      {messages.length > 0 && (
        <div className="flex max-h-[190px] flex-col gap-2.5 overflow-y-auto bg-slate-50/40 p-3">
          {messages.map((msg, idx) => {
            const isMe = msg.sender === "ADMIN";

            return (
              <div
                key={idx}
                className={`flex flex-col ${
                  isMe ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[90%] rounded-xl px-3 py-2 text-[11px] ${
                    isMe
                      ? "rounded-br-sm bg-slate-800 text-white"
                      : "rounded-bl-sm border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {!isMe && (
                    <span className="mb-0.5 block text-[9px] font-semibold text-slate-400">
                      {msg.authorName || "Postulante"}
                    </span>
                  )}

                  <p className="leading-relaxed">{msg.text}</p>

                  <div
                    className={`mt-1 flex items-center justify-end gap-1 text-[8px] ${
                      isMe ? "text-white/55" : "text-slate-400"
                    }`}
                  >
                    {msg.time}
                    {isMe && <CheckCheck size={11} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!readOnly && (
        <div className="flex items-center gap-2 border-t border-slate-100 p-2.5">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="Escribir un descargo..."
            className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-[11px] font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
          />
          <button
            type="button"
            onClick={handleSend}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white transition-colors hover:bg-slate-700 focus:outline-none"
            aria-label="Enviar comentario"
            title="Enviar comentario"
          >
            <Send size={13} className="ml-0.5" />
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// TAB DE AVALES — DISEÑO NORMALIZADO
// ============================================================================
export function AvalesTab({
  payload,
  onReplaceAval,
  onSendMessage,
  onResendEmail, // <-- DESESTRUCTURADO AQUÍ
}: AvalesTabProps) {
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const allAvales = payload?.approvals || [];
  const activeAvales = allAvales.filter((a: any) => a.status !== "INACTIVE");
  const historyAvales = allAvales.filter((a: any) => a.status === "INACTIVE");

  if (!activeAvales || activeAvales.length === 0) {
    return (
      <div className="mt-4 flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white">
        <ShieldAlert size={34} className="mb-3 text-slate-300" />
        <h3 className="text-sm font-bold text-slate-700">Sin avales</h3>
        <p className="mt-1 text-xs text-slate-500">
          Este expediente no requiere avales o no han sido registrados.
        </p>
      </div>
    );
  }

  const totalAvales = activeAvales.length;
  const aprobados = activeAvales.filter(
    (a: any) => a.status === "APPROVED",
  ).length;
  const pendientes = activeAvales.filter(
    (a: any) => a.status === "PENDING",
  ).length;
  const observados = activeAvales.filter(
    (a: any) => a.status === "REJECTED" || a.status === "OBSERVED",
  ).length;

  const avalesFiltrados = activeAvales.filter((aval: any) => {
    if (filterStatus === "ALL" || filterStatus === "REPLACED") return true;
    if (filterStatus === "REJECTED") {
      return aval.status === "REJECTED" || aval.status === "OBSERVED";
    }
    return aval.status === filterStatus;
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="space-y-4 pb-8 animate-in fade-in duration-300">
      {/* Encabezado y resumen con el nuevo Tab "Reemplazados" */}
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-[13px] font-black uppercase tracking-wide text-slate-800">
              Respaldo institucional
            </h3>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Revisa los avales institucionales asociados a esta solicitud.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-semibold text-slate-500">
            <button
              type="button"
              onClick={() => setFilterStatus("ALL")}
              className={`flex items-center gap-1.5 transition-colors ${
                filterStatus === "ALL"
                  ? "text-slate-800"
                  : "text-slate-400 hover:text-slate-700"
              }`}
            >
              <span className="text-xs font-bold text-slate-700">
                {totalAvales}
              </span>
              Avales solicitados
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus("APPROVED")}
              className={`flex items-center gap-1.5 transition-colors ${
                filterStatus === "APPROVED"
                  ? "text-emerald-700"
                  : "text-slate-400 hover:text-slate-700"
              }`}
            >
              <CheckCircle2 size={13} className={filterStatus === "APPROVED" ? "text-emerald-600" : "text-emerald-400"} />
              <span>{aprobados}</span>
              Aprobados
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus("PENDING")}
              className={`flex items-center gap-1.5 transition-colors ${
                filterStatus === "PENDING"
                  ? "text-amber-700"
                  : "text-slate-400 hover:text-slate-700"
              }`}
            >
              <Clock size={13} className={filterStatus === "PENDING" ? "text-amber-600" : "text-amber-400"} />
              <span>{pendientes}</span>
              Pendientes
            </button>

            {observados > 0 && (
              <button
                type="button"
                onClick={() => setFilterStatus("REJECTED")}
                className={`flex items-center gap-1.5 transition-colors ${
                  filterStatus === "REJECTED"
                    ? "text-red-700"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                <AlertTriangle size={13} className={filterStatus === "REJECTED" ? "text-red-500" : "text-red-400"} />
                <span>{observados}</span>
                Observados
              </button>
            )}

            {historyAvales.length > 0 && (
              <>
                <div className="hidden h-3 w-px bg-slate-200 sm:block"></div>
                <button
                  type="button"
                  onClick={() => setFilterStatus("REPLACED")}
                  className={`flex items-center gap-1.5 transition-colors ${
                    filterStatus === "REPLACED"
                      ? "text-slate-800 font-bold"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  <History size={13} className={filterStatus === "REPLACED" ? "text-slate-600" : ""} />
                  <span>{historyAvales.length}</span>
                  Reemplazados
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {filterStatus !== "REPLACED" && (
        <div className="flex items-start gap-2.5 px-1 pt-0.5">
          <Info
            size={14}
            strokeWidth={1.8}
            className="mt-0.5 shrink-0 text-blue-400"
          />
          <p className="text-[10px] leading-relaxed text-slate-400">
            Para continuar con la evaluación, todos los avales institucionales
            solicitados deben encontrarse en estado{" "}
            <strong className="font-semibold text-slate-500">Aprobado</strong>.
          </p>
        </div>
      )}

      {filterStatus === "REPLACED" ? (
        // =========================================================
        // VISTA DE HISTORIAL DE AVALES REEMPLAZADOS
        // =========================================================
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 animate-in fade-in duration-300">
          {historyAvales.map((aval: any) => {
            const person = aval.sponsorPerson;
            const fullName =
              `${person?.firstName || ""} ${person?.paternalLastName || ""} ${person?.maternalLastName || ""}`.trim() ||
              "No registrado";

            const initials =
              `${person?.firstName?.charAt(0) || ""}${person?.paternalLastName?.charAt(0) || ""}`.toUpperCase() ||
              "NN";

            const dateStr = formatDate(aval.updatedAt || aval.createdAt);

            const docValue = person?.documentNumber || aval.sponsorCode || null;
            let emailValue = null;
            if (person?.user?.email) emailValue = person.user.email;
            else if (person?.contacts?.find((c: any) => c.email)) emailValue = person.contacts.find((c: any) => c.email).email;
            else if (person?.email) emailValue = person.email;

            const phoneValue = person?.contacts?.find((c: any) => c.phoneType === "MOBILE" || c.phoneType === "WORK")?.phoneNumber || person?.phone || null;

            return (
              <article
                key={aval.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 shadow-sm opacity-90 transition-opacity hover:opacity-100"
              >
                {/* Cabecera */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[11px] font-black text-slate-400">
                      {initials}
                    </div>

                    <div className="min-w-0 pt-0.5">
                      <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Aval descartado
                      </div>
                      <h3 className="text-[13px] font-black leading-snug text-slate-600 line-clamp-1" title={fullName}>
                        {fullName}
                      </h3>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="flex items-center justify-end gap-1.5 text-[10px] font-semibold text-slate-500">
                      <UserMinus size={13} strokeWidth={1.9} className="text-slate-400" />
                      <span>Reemplazado</span>
                    </div>
                    <div className="mt-1 text-[9px] font-medium text-slate-400">
                      {dateStr ? `El ${dateStr}` : ""}
                    </div>
                  </div>
                </div>

                {/* Datos de contacto */}
                <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-y border-slate-200/60 py-3">
                  <CopyableField label="N° Documento" value={docValue} icon={IdCard} />
                  <CopyableField label="Tel / Celular" value={phoneValue} icon={Phone} />
                  <div className="col-span-2">
                    <CopyableField label="Correo electrónico" value={emailValue} icon={Mail} />
                  </div>
                </div>

                {/* Motivo */}
                <div className="mt-3 border-l-2 border-slate-300 pl-3">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Motivo del reemplazo
                  </div>
                  <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500 italic line-clamp-2" title={aval.rejectionReason || "Reemplazado por nuevo aval"}>
                    “{aval.rejectionReason || "Reemplazado por nuevo aval"}”
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        // =========================================================
        // VISTA DE AVALES ACTIVOS
        // =========================================================
        avalesFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10">
            <ShieldAlert size={30} className="mb-3 text-slate-300" />
            <p className="text-sm font-bold text-slate-600">No hay resultados</p>
            <p className="mt-1 text-xs text-slate-400">
              No se encontraron avales con el estado seleccionado.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 animate-in fade-in duration-300">
            {avalesFiltrados.map((aval: any, index: number) => {
              const person = aval.sponsorPerson;
              const rawStatus = aval.status;
              const isApproved = rawStatus === "APPROVED";
              const isRejected = rawStatus === "REJECTED" || rawStatus === "OBSERVED";
              const isPending = rawStatus === "PENDING";

              const draftEndorsement =
                index === 0
                  ? payload?.draftData?.endorsements?.firstEndorsement
                  : payload?.draftData?.endorsements?.secondEndorsement;

              const fullName =
                `${person?.firstName || ""} ${person?.paternalLastName || ""} ${person?.maternalLastName || ""}`.trim() ||
                draftEndorsement?.sponsorFullName ||
                "No registrado";

              const initials =
                `${person?.firstName?.charAt(0) || ""}${person?.paternalLastName?.charAt(0) || ""}`.toUpperCase() ||
                "NN";

              const phoneValue =
                person?.contacts?.find(
                  (c: any) => c.phoneType === "MOBILE" || c.phoneType === "WORK",
                )?.phoneNumber ||
                draftEndorsement?.sponsorPhone ||
                draftEndorsement?.phone ||
                null;

              const emailValue =
                person?.contacts?.[0]?.email ||
                person?.user?.email ||
                draftEndorsement?.sponsorEmail ||
                draftEndorsement?.email ||
                null;

              const docValue =
                person?.documentNumber ||
                draftEndorsement?.sponsorDocumentNumber ||
                null;

              const roleText =
                person?.employmentInfos?.[0]?.positionName ||
                "Asociado Activo IIMP";

              const dateStr = formatDate(aval.transactionDate || aval.createdAt);
              const timeStr = formatTime(aval.transactionDate || aval.createdAt);
              const chatMessages = Array.isArray(aval.chatMessages)
                ? aval.chatMessages
                : [];

              const statusLabel = isApproved
                ? "Aprobado"
                : isRejected
                  ? "Observado"
                  : "Pendiente";

              const statusIcon = isApproved ? (
                <CheckCircle2
                  size={13}
                  strokeWidth={1.9}
                  className="text-emerald-500"
                />
              ) : isRejected ? (
                <AlertTriangle
                  size={13}
                  strokeWidth={1.9}
                  className="text-red-400"
                />
              ) : (
                <Clock size={13} strokeWidth={1.9} className="text-amber-500" />
              );

              return (
                <article
                  key={aval.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md flex flex-col"
                >
                  {/* Cabecera */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-black text-slate-500">
                        {initials}
                      </div>

                      <div className="min-w-0 pt-0.5">
                        <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Aval N° {index + 1}
                        </div>

                        <div className="flex items-start gap-1.5">
                          <h3 className="text-[13px] font-black leading-snug text-slate-800">
                            {fullName}
                          </h3>

                          {person?.id && (
                            <a
                              href={`/intranet/asociados/${person.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-0.5 shrink-0 text-slate-400 transition-colors hover:text-slate-700"
                              title="Ver perfil del asociado"
                              aria-label="Ver perfil del asociado"
                            >
                              <ExternalLink size={13} strokeWidth={1.9} />
                            </a>
                          )}
                        </div>

                        <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-500">
                          {roleText}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="flex items-center justify-end gap-1.5 text-[10px] font-semibold text-slate-600">
                        {statusIcon}
                        <span>{statusLabel}</span>
                      </div>

                      <div className="mt-1 text-[9px] font-medium text-slate-400">
                        {isPending
                          ? `Desde ${dateStr}`
                          : `${dateStr || ""}${timeStr ? ` · ${timeStr}` : ""}`}
                      </div>
                    </div>
                  </div>

                  {/* Datos de contacto */}
                  <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-y border-slate-100 py-3 flex-grow">
                    <CopyableField
                      label="N° Documento"
                      value={docValue}
                      icon={IdCard}
                    />
                    <CopyableField
                      label="Tel / Celular"
                      value={phoneValue}
                      icon={Phone}
                    />
                    <div className="col-span-2">
                      <CopyableField
                        label="Correo electrónico"
                        value={emailValue}
                        icon={Mail}
                      />
                    </div>
                  </div>

                  {/* Motivo de observación */}
                  {isRejected && aval.rejectionReason && (
                    <div className="mt-3 border-l-2 border-red-300 pl-3">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Motivo
                      </div>
                      <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-600">
                        {aval.rejectionReason}
                      </p>
                    </div>
                  )}

                  {/* NUEVO: Bloque de Historial de Reenvíos (Solo si existen) */}
                  {Array.isArray(aval.resendHistory) && aval.resendHistory.length > 0 && (
                    <div className="mt-4 bg-blue-50/50 border border-blue-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-blue-500">
                          Historial de recordatorios ({aval.resendHistory.length})
                        </span>
                      </div>
                      <div className="max-h-24 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-blue-200 pr-1">
                        {aval.resendHistory.map((record: any, i: number) => (
                          <div key={i} className="flex justify-between items-center text-[10px] text-slate-500 bg-white border border-blue-50/50 px-2.5 py-1.5 rounded-lg shadow-sm">
                            <span className="truncate pr-2">Por: <strong className="text-slate-700">{record.actor}</strong></span>
                            <span className="shrink-0 text-blue-400 font-medium">
                              {new Date(record.date).toLocaleString('es-PE', { 
                                day: '2-digit', month: '2-digit', year: 'numeric', 
                                hour: '2-digit', minute: '2-digit' 
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comentarios */}
                  {chatMessages.length > 0 && (
                    <CommentsPanel
                      messages={chatMessages}
                      onSend={(msg) => onSendMessage?.(aval.id, msg)}
                    />
                  )}

                  {/* NUEVO: Acciones del Aval (Reemplazo / Reenvío) alineadas abajo */}
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-4 border-t border-slate-100 pt-3">
                    
                    {/* Botón Reenviar Correo (Solo si está PENDIENTE) */}
                   {isPending && (
                      <button
                        type="button"
                        onClick={() => onResendEmail?.(aval.id, emailValue || "No registrado")} // <-- AHORA MANDA EL CORREO EXACTO DE LA TARJETA
                        className="flex items-center gap-1.5 text-[10px] font-bold text-blue-500 transition-colors hover:text-blue-700 focus:outline-none"
                      >
                        <Mail size={13} strokeWidth={2} />
                        Reenviar invitación
                      </button>
                    )}

                    {/* Botón Reemplazar */}
                    {(isRejected || isPending) && (
                      <button
                        type="button"
                        onClick={() => onReplaceAval?.(aval.id)}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-red-500 transition-colors hover:text-red-700 focus:outline-none"
                      >
                        <RefreshCcw size={13} strokeWidth={2} />
                        Solicitar reemplazo
                      </button>
                    )}
                  </div>

                </article>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}