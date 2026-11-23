"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- the existing shared drawer payload is intentionally untyped. */

import { useState } from "react";
import { Download, FolderDown, Pencil, ShieldCheck, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { buildAssociateCode } from "@/modules/shared/Utils/associateCode";
import { SmartCaseCard } from "@/modules/shared/Components/SmartCaseCard/SmartCaseCard";
import { SmartCaseRow } from "@/modules/shared/Components/SmartCaseCard/SmartCaseRow";
import { InspectionDrawer } from "@/modules/shared/Components/InspectionDrawer/InspectionDrawer";
import type { DrawerData } from "@/modules/shared/Components/InspectionDrawer/types";
import { DownloadAllDocumentsModal } from "@/modules/afiliaciones/expedientes/Components/DownloadAllDocumentsModal";
import { AsociadosMapper } from "../Mappers/AsociadosMapper";
import { AsociadoDetailContent } from "./AsociadoDetailContent";
import { AdminAssociateDataDialog, isStudentAssociate } from "../Components/AdminAssociateDataDialog";
import { AssociateInfoButton } from "../Components/AssociateInfoButton";
import { AssociateAccessDialog } from "../Components/AssociateAccessDialog";
import { AsociadosFilterBar } from "../Components/AsociadosFilterBar";
import { AsociadosPagination } from "../Components/AsociadosPagination";

interface AsociadosWorkspaceProps {
  initialData: any[];
  total: number;
  currentPage: number;
  query: string;
  membershipType: string;
  sort: string;
  canResetSandboxPayments: boolean;
  canReadMemberships: boolean;
  canUpdateAssociateData: boolean;
}

function buildExportParams(query: string, membershipType: string, sort: string): URLSearchParams {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (membershipType && membershipType !== "ALL") params.set("type", membershipType);
  if (sort) params.set("sort", sort);
  return params;
}

function downloadBlob(blob: Blob, fallbackName: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fallbackName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function AsociadosWorkspace({
  initialData,
  total,
  currentPage,
  query,
  membershipType,
  sort,
  canResetSandboxPayments,
  canReadMemberships,
  canUpdateAssociateData,
}: AsociadosWorkspaceProps) {
  const [viewMode] = useState<"grid" | "list">("grid");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editUser, setEditUser] = useState<any>(null);
  const [accessTarget, setAccessTarget] = useState<{ personId: number; applicationId?: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isDownloadingDocuments, setIsDownloadingDocuments] = useState(false);
  const [downloadDocumentsProgress, setDownloadDocumentsProgress] = useState(0);
  const [showDownloadAllModal, setShowDownloadAllModal] = useState(false);

  const handleGenerateCode = (user: any) => {
    const personId = Number(user?.person?.id ?? (user?.source === "SIE_HISTORICAL" ? user?.id : 0));
    const code = buildAssociateCode(personId);
    if (!code) {
      toast.error("No se pudo generar el código.", { description: "El asociado no tiene un identificador de persona válido." });
      return;
    }
    void navigator.clipboard?.writeText(code).catch(() => undefined);
    toast.success(`Código generado: ${code}`, { description: "Se copió al portapapeles." });
  };

  const startProgress = (setter: React.Dispatch<React.SetStateAction<number>>) => {
    setter(1);
    const interval = setInterval(() => {
      setter((previous) =>
        previous >= 90 ? 90 : Math.min(90, previous + Math.max(1, Math.round((90 - previous) * 0.08))),
      );
    }, 450);

    return () => {
      clearInterval(interval);
      setter(100);
      setTimeout(() => setter(0), 1200);
    };
  };

  const exportProgressLabel = (progress: number) => {
    const value = Math.round(progress);
    if (value >= 100) return "¡Padrón listo!";
    if (value >= 75) return `Ya falta poco... ${value}%`;
    if (value >= 40) return `Generando tu padrón... ${value}%`;
    return `Preparando tu padrón... ${value}%`;
  };

  const documentsProgressLabel = (progress: number) => {
    const value = Math.round(progress);
    if (value >= 100) return "¡Documentos listos!";
    if (value >= 75) return `Ya falta poco... ${value}%`;
    if (value >= 40) return `Comprimiendo documentos... ${value}%`;
    return `Preparando tus documentos... ${value}%`;
  };

  const handleExportPadron = async () => {
    setIsExporting(true);
    const stopProgress = startProgress(setExportProgress);
    try {
      const params = buildExportParams(query, membershipType, sort);
      const response = await fetch(`/api/afiliaciones/asociados/export?${params.toString()}`);
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        alert(result?.message || "No se pudo exportar el padrón.");
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      downloadBlob(blob, filenameMatch?.[1] || "Padron_Asociados.xlsx");
    } catch (error) {
      console.error(error);
      alert("Error de conexión al exportar.");
    } finally {
      stopProgress();
      setIsExporting(false);
    }
  };

  const handleDownloadAllDocuments = async () => {
    setIsDownloadingDocuments(true);
    const stopProgress = startProgress(setDownloadDocumentsProgress);
    try {
      const params = buildExportParams(query, membershipType, sort);
      const response = await fetch(
        `/api/afiliaciones/asociados/export/documents?${params.toString()}`,
      );
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        alert(result?.message || "No se pudieron descargar los documentos.");
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      downloadBlob(blob, filenameMatch?.[1] || "Asociados_Documentos.zip");
      setShowDownloadAllModal(false);
    } catch (error) {
      console.error(error);
      alert("Error de conexión al descargar documentos.");
    } finally {
      stopProgress();
      setIsDownloadingDocuments(false);
    }
  };

  const drawerData = (): DrawerData<any> | null => {
    if (!selectedUser) return null;
    return {
      caseId: selectedUser.id,
      header: AsociadosMapper.toCardData(selectedUser),
      availableTabs: [
        { id: "resumen", label: "Resumen", hasNotification: false },
        { id: "informacion", label: "Información", hasNotification: false },
        { id: "membresia-pagos", label: "Membresía y Pagos", hasNotification: false },
        { id: "cuenta", label: "Cuenta", hasNotification: false },
        { id: "carnet", label: "Carnet virtual", hasNotification: false },
        { id: "historial", label: "Historial", hasNotification: false },
      ],
      defaultTabId: "resumen",
      payload: selectedUser,
    };
  };

  return (
    <div className="relative flex min-h-[calc(100vh-8rem)] flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative z-20 mb-5 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#C5A059]/10 text-[#9A6A1F]">
                <UsersRound size={16} strokeWidth={2} />
              </span>
              <h1 className="text-xl font-semibold tracking-tight text-slate-800 sm:text-2xl">
                Directorio de Asociados
              </h1>
            </div>
            <p className="mt-1.5 text-xs font-medium text-slate-500 sm:text-sm">
              Personas con membresía institucional y proceso de afiliación completado.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={handleExportPadron}
              disabled={isExporting}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-xs font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={14} strokeWidth={2.5} />
              {isExporting ? exportProgressLabel(exportProgress) : "Exportar padrón"}
            </button>
            <button
              onClick={() => setShowDownloadAllModal(true)}
              disabled={isDownloadingDocuments}
              title="Descargar en ZIP los asociados filtrados y sus documentos"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-4 text-xs font-bold text-sky-700 shadow-sm transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FolderDown size={14} strokeWidth={2.5} />
              {isDownloadingDocuments
                ? documentsProgressLabel(downloadDocumentsProgress)
                : "Descargar todo"}
            </button>
          </div>
        </div>
        <AsociadosFilterBar
          total={total}
          currentQuery={query}
          currentType={membershipType}
          currentSort={sort}
        />
      </div>

      <div className="relative z-10 min-h-[300px]">
        {initialData.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
              <ShieldCheck className="h-8 w-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">No hay asociados</h3>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              No se encontraron miembros que coincidan con los filtros aplicados.
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {initialData.map((user) => (
              <SmartCaseCard
                key={user.id}
                data={AsociadosMapper.toCardData(user)}
                onClick={() => setSelectedUser(user)}
                onEdit={canUpdateAssociateData ? () => setEditUser(user) : undefined}
                onGenerateCode={!user.institutionalCode && Number(user.person?.id) > 0 ? () => handleGenerateCode(user) : undefined}
                onManageAccess={canUpdateAssociateData ? () => {
                  const applications = user.person?.applications ?? user.applications ?? [];
                  const completed = Array.isArray(applications) ? applications.find((application: any) => application.status === "COMPLETED") : null;
                  setAccessTarget({ personId: Number(user.person?.id), applicationId: completed?.id ? Number(completed.id) : undefined });
                } : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            {initialData.map((user) => (
              <SmartCaseRow
                key={user.id}
                data={AsociadosMapper.toCardData(user)}
                onClick={() => setSelectedUser(user)}
              />
            ))}
          </div>
        )}
      </div>

      {total > 0 && <AsociadosPagination total={total} currentPage={currentPage} />}

      <InspectionDrawer
        isOpen={Boolean(selectedUser)}
        onClose={() => setSelectedUser(null)}
        showHistoryButton={false}
        headerActions={selectedUser ? (
          <>
            {canUpdateAssociateData && (
              <button
                type="button"
                onClick={() => setEditUser(selectedUser)}
                title="Editar datos"
                aria-label="Editar datos"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E6C982] bg-[#FFF8E8] text-[#936B2E] shadow-sm transition-all hover:bg-[#F7ECD7] hover:text-[#7F561E]"
              >
                <Pencil size={15} strokeWidth={2.5} />
              </button>
            )}
            <AssociateInfoButton isHistorical={selectedUser.source === "SIE_HISTORICAL"} />
          </>
        ) : undefined}
        data={drawerData()}
        renderContent={(tab, payload, selectTab) => (
          <AsociadoDetailContent
            key={payload.id}
            tab={tab}
            user={payload}
            canResetSandboxPayments={canResetSandboxPayments}
            canReadMemberships={canReadMemberships}
            onSelectTab={selectTab}
          />
        )}
      />

      {editUser && (
        <AdminAssociateDataDialog
          user={editUser}
          isStudent={isStudentAssociate(editUser)}
          open
          onClose={() => setEditUser(null)}
        />
      )}

      {accessTarget && accessTarget.personId > 0 && (
        <AssociateAccessDialog
          personId={accessTarget.personId}
          applicationId={accessTarget.applicationId}
          open
          onClose={() => setAccessTarget(null)}
        />
      )}

      <DownloadAllDocumentsModal
        open={showDownloadAllModal}
        totalResults={total}
        isDownloading={isDownloadingDocuments}
        progressLabel={documentsProgressLabel(downloadDocumentsProgress)}
        title="Descargar padrón y documentos"
        subjectLabel="asociados"
        excelFileName="Asociados.xlsx"
        onClose={() => {
          if (!isDownloadingDocuments) setShowDownloadAllModal(false);
        }}
        onConfirm={handleDownloadAllDocuments}
      />
    </div>
  );
}
