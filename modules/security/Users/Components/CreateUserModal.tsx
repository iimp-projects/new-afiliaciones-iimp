"use client";

import { useState } from "react";
import { X, Save, AlertCircle } from "lucide-react";
import { createUserAction } from "../Actions/user.actions";

interface CreateUserModalProps {
  onClose: () => void;
  roles: { id: number; name: string }[];
}

export function CreateUserModal({ onClose, roles }: CreateUserModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});
    setGlobalError(null);

    const formData = new FormData(e.currentTarget);
    
    // Forzamos UserType a SYSTEM_ADMIN o VALIDATOR seg n tu negocio (aqu  lo mando oculto)
    formData.append("userType", "VALIDATOR"); 

    const result = await createUserAction(null, formData);

    if (!result.success) {
      if (result.errors) setErrors(result.errors);
      if (result.message) setGlobalError(result.message);
      setIsLoading(false);
    } else {
      setIsLoading(false);
      onClose(); // Cierra el modal exitosamente
    }
  };

  const inputClass = (field: string) => `w-full h-11 px-3 rounded-xl border focus:outline-none focus:ring-2 text-sm font-medium transition-colors ${
    errors[field] 
      ? "border-red-400 focus:ring-red-200 bg-red-50" 
      : "border-slate-300 focus:border-[#C5A059] focus:ring-[#C5A059]/20 bg-slate-50 hover:bg-white"
  }`;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
        
        {/* HEADER */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-black text-slate-800">Registrar Nuevo Usuario</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-200">
          {globalError && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-bold text-sm flex items-start gap-3">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              {globalError}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium p-4 rounded-xl mb-6">
            <strong>Nota:</strong> Al registrar al usuario, se le asignar  la contrase a temporal por defecto <code>Cambiar123!</code>.
          </div>

          <form id="createUserForm" onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Documento */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">Tipo Doc.</label>
                <select name="documentType" className={inputClass("documentType")}>
                  <option value="DNI">DNI</option>
                  <option value="CE">Carn  de Extranjer a</option>
                  <option value="PASSPORT">Pasaporte</option>
                </select>
                {errors.documentType && <span className="text-red-500 text-xs mt-1 block font-bold">{errors.documentType[0]}</span>}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">Nro. Documento</label>
                <input name="documentNumber" type="text" maxLength={15} className={inputClass("documentNumber")} placeholder="Ej. 12345678" />
                {errors.documentNumber && <span className="text-red-500 text-xs mt-1 block font-bold">{errors.documentNumber[0]}</span>}
              </div>

              {/* Nombres */}
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">Nombres</label>
                <input name="firstName" type="text" className={inputClass("firstName")} placeholder="Ej. Juan Carlos" />
                {errors.firstName && <span className="text-red-500 text-xs mt-1 block font-bold">{errors.firstName[0]}</span>}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">Ape. Paterno</label>
                <input name="paternalLastName" type="text" className={inputClass("paternalLastName")} />
                {errors.paternalLastName && <span className="text-red-500 text-xs mt-1 block font-bold">{errors.paternalLastName[0]}</span>}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">Ape. Materno</label>
                <input name="maternalLastName" type="text" className={inputClass("maternalLastName")} />
                {errors.maternalLastName && <span className="text-red-500 text-xs mt-1 block font-bold">{errors.maternalLastName[0]}</span>}
              </div>

              {/* Cuenta */}
              <div className="md:col-span-2 border-t border-slate-100 pt-5 mt-2">
                <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">Correo Electr nico</label>
                <input name="email" type="email" className={inputClass("email")} placeholder="usuario@iimp.org.pe" />
                {errors.email && <span className="text-red-500 text-xs mt-1 block font-bold">{errors.email[0]}</span>}
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">Rol en el Sistema</label>
                <select name="roleId" className={inputClass("roleId")} defaultValue="">
                  <option value="" disabled>Seleccione un rol...</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                {errors.roleId && <span className="text-red-500 text-xs mt-1 block font-bold">{errors.roleId[0]}</span>}
              </div>
            </div>
          </form>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} disabled={isLoading} className="px-5 h-11 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button 
            type="submit" 
            form="createUserForm" 
            disabled={isLoading}
            className="flex items-center gap-2 bg-[#C5A059] text-white px-6 h-11 rounded-xl font-bold shadow-md hover:bg-[#a67c3b] transition-colors disabled:opacity-70"
          >
            {isLoading ? "Guardando..." : <><Save size={18} /> Confirmar Registro</>}
          </button>
        </div>

      </div>
    </div>
  );
}