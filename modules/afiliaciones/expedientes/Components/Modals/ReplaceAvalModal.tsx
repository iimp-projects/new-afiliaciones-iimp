/**
 * ReplaceAvalModal.tsx
 * Modal minimalista para reemplazar un aval institucional.
 */

"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Info,
  Mail,
  Phone,
  Search,
  UserCheck,
  UserMinus,
  X,
} from "lucide-react";

interface ReplaceAvalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  applicationId: number | null;
  oldApprovalId?: number | null; // ID único del aval específico a reemplazar
  oldSponsorName?: string;
  oldSponsorCode?: string | null;
  oldSponsorEmail?: string | null;
  oldSponsorPhone?: string | null;
  oldSponsorStatus?: string | null;
}

interface NewSponsorData {
  success?: boolean;
  id: number;
  fullName?: string;
  sponsorCode?: string | null;
  email?: string | null;
}

export function ReplaceAvalModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  applicationId,
  oldApprovalId,
  oldSponsorName,
  oldSponsorCode,
  oldSponsorEmail,
  oldSponsorPhone,
  oldSponsorStatus,
}: ReplaceAvalModalProps) {
  const [documentNumber, setDocumentNumber] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [sponsorData, setSponsorData] = useState<NewSponsorData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDocumentNumber("");
      setSponsorData(null);
      setLocalError(null);
      setIsSearching(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen || !applicationId) return null;

  const handleSearch = async () => {
    if (documentNumber.length !== 8) {
      setLocalError("El DNI debe tener exactamente 8 dígitos.");
      return;
    }

    setLocalError(null);
    setIsSearching(true);
    setSponsorData(null);

    try {
      const response = await fetch(
        `/api/afiliaciones/postulacion/validate-sponsor?documentNumber=${documentNumber}&applicationId=${applicationId}`
      );

      const data = await response.json();

      if (data.success) {
        setSponsorData(data);
      } else {
        setLocalError(
          data.message || "No se encontró un asociado hábil con ese DNI."
        );
      }
    } catch {
      setLocalError("Error al conectar con el servidor.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleReplace = async () => {
    if (!sponsorData) return;

    setIsSubmitting(true);
    setLocalError(null);

    try {
      const response = await fetch("/api/consulta/reemplazar-aval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: applicationId,
          approval_id: oldApprovalId || null, // 👈 Enviamos el ID específico del aval a inactivar
          sponsor_person_id: sponsorData.id,
          sponsor_code: sponsorData.sponsorCode || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        onSuccess(
          "Aval reemplazado exitosamente. Se ha enviado un correo al nuevo patrocinador."
        );
        onClose();
      } else {
        onError(
          result.error || "Error al procesar el reemplazo del aval."
        );
      }
    } catch {
      onError("Error de conexión al procesar el reemplazo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusLabel =
    oldSponsorStatus === "REJECTED" ||
    oldSponsorStatus === "OBSERVED"
      ? "Observado"
      : "Pendiente";

  return createPortal(
    <div
      className="fixed inset-0 z-[9999999] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* CABECERA */}
        <div className="relative shrink-0 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-7 sm:pb-5 sm:pt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 focus:outline-none disabled:opacity-40 sm:right-5 sm:top-5"
            title="Cerrar"
            aria-label="Cerrar"
          >
            <X size={19} strokeWidth={1.8} />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
              <UserCheck size={20} strokeWidth={1.8} />
            </div>

            <div className="min-w-0 pr-8">
              <h2 className="text-[18px] font-black tracking-tight text-slate-800 sm:text-xl">
                Reemplazar Aval Institucional
              </h2>
              <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500 sm:text-xs">
                Busca al nuevo asociado por DNI para reemplazar el aval actual.
              </p>
            </div>
          </div>
        </div>

        {/* CUERPO */}
        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {/* ALERTA DE ANCHO COMPLETO */}
          <div className="mb-5 flex w-full items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/55 px-3.5 py-3">
            <Info
              size={16}
              strokeWidth={1.8}
              className="mt-0.5 shrink-0 text-blue-500"
            />
            <p className="text-[11px] font-medium leading-relaxed text-slate-600">
              Al confirmar, el aval actual será anulado y se enviará
              automáticamente un correo al nuevo aval para solicitar su
              confirmación.
            </p>
          </div>

          {/* COMPARACIÓN */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_34px_minmax(0,1fr)] lg:items-stretch">
            {/* AVAL ACTUAL */}
            <section className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500">
                  <UserMinus size={18} strokeWidth={1.8} />
                </div>

                <div className="min-w-0">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Aval actual
                  </div>

                  <h3
                    className="truncate text-[14px] font-black text-slate-800"
                    title={oldSponsorName}
                  >
                    {oldSponsorName || "Aval anterior"}
                  </h3>
                </div>
              </div>

              <div className="divide-y divide-slate-100 px-4">
                <div className="flex items-center justify-between gap-3 py-3">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Estado
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    {statusLabel}
                  </div>
                </div>

                <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5 py-3">
                  <FileText
                    size={14}
                    strokeWidth={1.7}
                    className="mt-0.5 text-slate-300"
                  />
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Cód. IIMP
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-slate-700">
                      {oldSponsorCode || "No registrado"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5 py-3">
                  <Mail
                    size={14}
                    strokeWidth={1.7}
                    className="mt-0.5 text-slate-300"
                  />
                  <div className="min-w-0">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Correo
                    </div>
                    <div className="mt-0.5 truncate text-[11px] font-medium text-slate-700">
                      {oldSponsorEmail || "No registrado"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5 py-3">
                  <Phone
                    size={14}
                    strokeWidth={1.7}
                    className="mt-0.5 text-slate-300"
                  />
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Teléfono
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-slate-700">
                      {oldSponsorPhone || "No registrado"}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* FLECHA */}
            <div className="hidden items-center justify-center lg:flex">
              <span className="text-2xl font-light text-slate-300" aria-hidden="true">
                →
              </span>
            </div>

            {/* NUEVO AVAL */}
            <section className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500">
                  <UserCheck size={18} strokeWidth={1.8} />
                </div>

                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Nuevo aval
                  </div>
                  <h3 className="text-[14px] font-black text-slate-800">
                    Buscar por DNI
                  </h3>
                </div>
              </div>

              <div className="p-4">
                <label
                  htmlFor="new-sponsor-dni"
                  className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
                >
                  DNI del nuevo aval <span className="text-red-400">*</span>
                </label>

                <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <input
                    id="new-sponsor-dni"
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={documentNumber}
                    onChange={(e) => {
                      setDocumentNumber(
                        e.target.value.replace(/\D/g, "")
                      );
                      setSponsorData(null);
                      setLocalError(null);
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        documentNumber.length === 8 &&
                        !isSearching
                      ) {
                        handleSearch();
                      }
                    }}
                    placeholder="Ingrese 8 dígitos"
                    className="h-11 min-w-0 flex-1 px-3.5 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-300"
                    autoComplete="off"
                  />

                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={
                      isSearching || documentNumber.length !== 8
                    }
                    className="flex h-11 w-12 shrink-0 items-center justify-center bg-slate-900 text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                    title="Buscar asociado"
                    aria-label="Buscar asociado"
                  >
                    {isSearching ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                    ) : (
                      <Search size={18} strokeWidth={2} />
                    )}
                  </button>
                </div>

                {localError && (
                  <div className="mt-3 flex items-start gap-2 text-[10px] font-medium leading-relaxed text-red-500">
                    <AlertTriangle
                      size={14}
                      strokeWidth={1.8}
                      className="mt-0.5 shrink-0"
                    />
                    <span>{localError}</span>
                  </div>
                )}

                {sponsorData ? (
                  <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/35 p-3.5">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2
                        size={15}
                        strokeWidth={1.9}
                        className="text-emerald-500"
                      />
                      Asociado hábil encontrado
                    </div>

                    <div className="mt-3 space-y-2.5">
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Nombre completo
                        </div>
                        <div className="mt-0.5 text-[11px] font-semibold text-slate-800">
                          {sponsorData.fullName || "No registrado"}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            Cód. IIMP
                          </div>
                          <div className="mt-0.5 text-[11px] font-medium text-slate-700">
                            {sponsorData.sponsorCode || "No registrado"}
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            Correo
                          </div>
                          <div className="mt-0.5 truncate text-[11px] font-medium text-slate-700">
                            {sponsorData.email || "No registrado"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex min-h-[132px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-5 text-center">
                    <div>
                      <UserCheck
                        size={25}
                        strokeWidth={1.5}
                        className="mx-auto mb-2 text-slate-300"
                      />
                      <p className="text-[11px] font-semibold text-slate-500">
                        Busca un asociado por DNI
                      </p>
                      <p className="mt-1 text-[10px] font-medium text-slate-400">
                        La información del nuevo aval aparecerá aquí.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-7">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-10 rounded-xl border border-slate-200 px-5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleReplace}
            disabled={isSubmitting || !sponsorData}
            className="h-10 rounded-xl bg-[#C5A059] px-6 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-[#b58f48] focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isSubmitting ? "Procesando..." : "Confirmar y Notificar"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}