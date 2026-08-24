import React from "react";
import { DynamicIcon } from "@/modules/layout/Utils/DynamicIcon";
import { DrawerStatusIcon, formatStatusName } from "../../../Utils/expedientes.utils";
import type { SmartCaseCardData } from "@/modules/shared/Components/SmartCaseCard/types";

interface ResumenTabProps {
  header?: SmartCaseCardData;
  payload: any;
}

export function ResumenTab({ header, payload }: ResumenTabProps) {
  const validations = header?.atomicValidations || [];
  const completedCount = validations.filter(
    (v: any) => v.status === "check" || v.status === "APPROVED"
  ).length;
  const progressPercentage =
    validations.length > 0 ? Math.round((completedCount / validations.length) * 100) : 0;

  const isStudent = payload.affiliateType === "STUDENT";
  const submittedDate = payload.submittedAt
    ? new Date(payload.submittedAt).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" })
    : "No enviado";

  const payment = payload.payments?.[0];
  const paymentMethod = payment?.gateway
    ? payment.gateway.toLowerCase().replace(/_/g, " ")
    : isStudent
    ? "Beca Pregrado"
    : "Pendiente";
  const invoiceType = payment?.billing?.invoice?.type || (isStudent ? "No aplica" : "Boleta");
  const amount = payment?.totalAmount
    ? `${payment.currency || "PEN"} ${payment.totalAmount}`
    : isStudent
    ? "Gratuito"
    : "S/ 0.00";

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div>
        <h3 className="text-[13px] font-bold text-slate-800 mb-3 flex items-center gap-2">
          Estado del expediente
        </h3>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 sm:space-y-4">
          {validations.map((val: any, idx: number) => (
            <div
              key={idx}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-0 rounded-xl sm:rounded-none bg-slate-50 sm:bg-transparent border border-slate-100 sm:border-none"
            >
              <div className="flex items-center gap-3 sm:w-1/3">
                <DynamicIcon name={val.icon} size={16} className="text-slate-500" />
                <span className="text-[12px] font-bold text-slate-700">{val.label}</span>
              </div>
              <div className="sm:w-1/3 flex sm:justify-start">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${val.statusColorClass}`}
                >
                  <DrawerStatusIcon status={val.status} className="w-3 h-3" />
                  {formatStatusName(val.statusLabel || val.status)}
                </span>
              </div>
              <div className="sm:w-1/3 flex flex-col sm:items-end text-left sm:text-right">
                <span
                  className={`text-[11px] font-black truncate w-full sm:text-right ${
                    val.status === "check" || val.status === "APPROVED"
                      ? "text-[#C5A059]"
                      : val.status === "error" || val.status === "REJECTED"
                      ? "text-red-500"
                      : "text-slate-400"
                  }`}
                >
                  {val.assignee?.name || "Sin asignar"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-[13px] font-bold text-slate-800 mb-3">Progreso general</h3>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-end justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">
              {completedCount} de {validations.length} validaciones completadas
            </span>
            <span className="text-2xl font-black text-slate-800 leading-none">
              {progressPercentage}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-[#C5A059] h-2.5 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-[13px] font-bold text-slate-800 mb-3">Información de solicitud</h3>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
          <dl className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-4 gap-1">
              <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Modalidad
              </dt>
              <dd className="text-sm font-bold text-slate-800">
                {header?.identity.categoryBadge?.label}
              </dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-4 gap-1">
              <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Fecha de envío
              </dt>
              <dd className="text-sm font-bold text-slate-800">{submittedDate}</dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-4 gap-1">
              <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Tipo de pago
              </dt>
              <dd
                className={`text-sm font-bold capitalize ${
                  isStudent ? "text-emerald-600" : "text-slate-800"
                }`}
              >
                {paymentMethod}
              </dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-4 gap-1">
              <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Comprobante
              </dt>
              <dd className="text-sm font-bold text-slate-800 capitalize">
                {invoiceType.toLowerCase()}
              </dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
              <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Monto
              </dt>
              <dd
                className={`text-[15px] font-black ${
                  isStudent ? "text-emerald-600" : "text-[#C5A059]"
                }`}
              >
                {amount}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}