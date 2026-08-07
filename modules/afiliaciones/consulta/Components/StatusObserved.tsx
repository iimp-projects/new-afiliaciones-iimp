"use client";

import React, { useState } from "react";
import { ApplicationStatusData } from "../Models/ApplicationStatus";

interface Props {
  data: ApplicationStatusData;
  onUploadSuccess?: () => void;
}

export const StatusObserved: React.FC<Props> = ({ data, onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Columna Izquierda: Detalle de Observaciones + Dropzone */}
      <div className="md:col-span-2 space-y-6">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
            <span>⚠️</span> Observaciones del Comité
          </div>
          <ul className="text-xs text-slate-700 space-y-2 list-disc pl-4">
            {data.observations && data.observations.length > 0 ? (
              data.observations.map((obs, idx) => <li key={idx}>{obs}</li>)
            ) : (
              <li>Por favor, revise los documentos adjuntos de su postulación e intente subirlos nuevamente legibles.</li>
            )}
          </ul>
        </div>

        {/* Dropzone Subsanación */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 block">
            Actualizar Documentación
          </label>
          <div className="border-2 border-dashed border-slate-200 hover:border-amber-500 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-amber-50/10 transition-colors cursor-pointer relative">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="w-10 h-10 bg-amber-100/60 rounded-full flex items-center justify-center mx-auto mb-2 text-amber-800">
              ☁️
            </div>
            <p className="text-xs font-medium text-slate-700">
              {selectedFile ? selectedFile.name : "Seleccionar archivo o arrastrar aquí PDF, JPG"}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">(Max 5MB)</p>
          </div>
        </div>

        <button
          disabled={!selectedFile}
          onClick={onUploadSuccess}
          className="w-full h-11 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-xl transition-colors disabled:opacity-40"
        >
          Corregir Información
        </button>
      </div>

      {/* Columna Derecha: Tarjeta de Detalles del Trámite */}
      <div className="space-y-4">
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
          <h5 className="text-xs font-bold text-slate-800">Detalles del Trámite</h5>
          <div>
            <span className="text-[10px] uppercase text-slate-400 block font-semibold">N° de Expediente</span>
            <span className="text-xs font-bold text-slate-700">{data.applicationCode}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-400 block font-semibold">Plazo de Subsanación</span>
            <span className="text-xs font-bold text-red-600 flex items-center gap-1">
              ⏳ Vence en {data.expirationDate || "5 días"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};