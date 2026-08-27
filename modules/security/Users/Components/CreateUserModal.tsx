"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner"; // ✅ IMPORTAMOS SONNER DIRECTO
import { X, Save, AlertCircle, Camera, ChevronDown, Check, Info } from "lucide-react";
import { createUserAction } from "../Actions/user.actions";

interface CreateUserModalProps {
  onClose: () => void;
  onSuccess: () => void;
  roles: { id: number; name: string }[];
}

export function CreateUserModal({ onClose, onSuccess, roles }: CreateUserModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsRoleOpen(false);
      }
    };
    if (isRoleOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isRoleOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});
    setGlobalError(null);
    
    const formData = new FormData(e.currentTarget);
    const photoFile = formData.get("photo") as File;
    let finalImageUrl = "";

    if (photoFile && photoFile.size > 0) {
      try {
        const uploadData = new FormData();
        uploadData.append("file", photoFile);
        uploadData.append("folder", "users/avatars");

        const uploadRes = await fetch("/api/afiliaciones/postulacion/upload", { 
          method: "POST", 
          body: uploadData 
        });
        const uploadResult = await uploadRes.json();
        
        if (uploadResult.success) {
          finalImageUrl = uploadResult.data.url;
        } else {
          // ✅ TOAST DE ERROR CON CONTEXTO
          toast.error("Fallo al subir la fotografía", { 
              description: uploadResult.message || "Revisa tus credenciales de S3." 
          });
          setIsLoading(false); 
          return;
        }
      } catch (err) {
        // ✅ TOAST DE ERROR CON CONTEXTO
        toast.error("Error de conexión", { 
            description: "Ocurrió un error al contactar con el servidor de archivos." 
        });
        setIsLoading(false); 
        return;
      }
    }

    formData.delete("photo");
    if (finalImageUrl) formData.append("imageUrl", finalImageUrl);
    formData.append("userType", "VALIDATOR"); 

    const result = await createUserAction(null, formData);
    if (!result.success) {
      if (result.errors) setErrors(result.errors);
      if (result.message) {
          // ✅ TOAST DE ERROR GLOBAL CON CONTEXTO
          toast.error("No se pudo registrar el usuario", { 
              description: result.message 
          }); 
      }
      setIsLoading(false);
    } else {
      setIsLoading(false);
      // ✅ TOAST DE ÉXITO CON CONTEXTO (El toque premium)
      toast.success("¡Usuario Registrado!", { 
          description: "El usuario ha sido creado y se le asignó la contraseña por defecto." 
      });
      onSuccess();
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) setImagePreview(URL.createObjectURL(file));
  };

  const inputClass = (field: string) => `w-full h-12 px-4 rounded-xl border focus:outline-none focus:ring-4 text-sm font-semibold transition-all duration-200 ${
    errors[field] 
      ? "border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50" 
      : "border-slate-200 focus:border-[#C5A059] focus:ring-[#C5A059]/10 bg-slate-50 focus:bg-white hover:border-slate-300"
  }`;

  const selectedRoleName = selectedRole ? roles.find(r => r.id === selectedRole)?.name : "Seleccione un rol...";

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-[24px] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center shrink-0 bg-slate-50/50">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Registrar Nuevo Usuario</h2>
            <p className="text-xs font-medium text-slate-500 mt-1">Otorga acceso a la intranet institucional.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
            <X size={22} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-200">
          {globalError && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-bold text-sm flex items-start gap-3 animate-in slide-in-from-top-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              {globalError}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200/60 text-amber-800 text-xs font-medium p-4 rounded-xl mb-8 flex gap-3">
             <Info className="shrink-0 text-amber-600" size={18} />
             <p><strong>Atención:</strong> Al registrar al usuario, se le asignará la contraseña temporal por defecto <code className="bg-amber-100 px-1.5 py-0.5 rounded font-bold ml-1 text-amber-900">Cambiar123!</code>.</p>
          </div>

          <form id="createUserForm" onSubmit={handleSubmit} className="space-y-6" encType="multipart/form-data">
            
            <div className="flex flex-col items-center mb-8">
                <div className="relative w-28 h-28 mb-3 group cursor-pointer">
                    <div className={`w-full h-full rounded-full border-2 border-dashed transition-all duration-300 flex items-center justify-center overflow-hidden ${imagePreview ? 'border-[#C5A059] shadow-md' : 'border-slate-300 bg-slate-50 group-hover:border-[#C5A059] group-hover:bg-[#C5A059]/5'}`}>
                        {imagePreview ? (
                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                            <Camera className="text-slate-300 w-10 h-10 group-hover:text-[#C5A059] transition-colors" strokeWidth={1.5} />
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                           <Camera className="text-white w-8 h-8" />
                        </div>
                    </div>
                    <input 
                        type="file" 
                        name="photo" 
                        accept="image/*" 
                        onChange={handleImageChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        title="Subir foto de perfil"
                    />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Foto de Perfil (Opcional)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 block ml-1">Tipo Doc.</label>
                <div className="relative">
                  <select name="documentType" className={`${inputClass("documentType")} appearance-none pr-10 cursor-pointer`}>
                    <option value="DNI">DNI</option>
                    <option value="CE">Carné de Extranjería</option>
                    <option value="PASSPORT">Pasaporte</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
                {errors.documentType && <span className="text-red-500 text-xs mt-1 block font-bold">{errors.documentType[0]}</span>}
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 block ml-1">Nro. Documento</label>
                <input name="documentNumber" type="text" maxLength={15} className={inputClass("documentNumber")} placeholder="Ej. 12345678" />
                {errors.documentNumber && <span className="text-red-500 text-xs mt-1 block font-bold">{errors.documentNumber[0]}</span>}
              </div>

              <div className="md:col-span-2">
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 block ml-1">Nombres</label>
                <input name="firstName" type="text" className={inputClass("firstName")} placeholder="Ej. Juan Carlos" />
                {errors.firstName && <span className="text-red-500 text-xs mt-1 block font-bold">{errors.firstName[0]}</span>}
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 block ml-1">Apellido Paterno</label>
                <input name="paternalLastName" type="text" className={inputClass("paternalLastName")} placeholder="Ej. Pérez" />
                {errors.paternalLastName && <span className="text-red-500 text-xs mt-1 block font-bold">{errors.paternalLastName[0]}</span>}
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 block ml-1">Apellido Materno</label>
                <input name="maternalLastName" type="text" className={inputClass("maternalLastName")} placeholder="Ej. Gómez (Opcional)" />
                {errors.maternalLastName && <span className="text-red-500 text-xs mt-1 block font-bold">{errors.maternalLastName[0]}</span>}
              </div>

              <div className="md:col-span-2 border-t border-slate-100 pt-6 mt-2">
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 block ml-1">Correo Electrónico</label>
                <input name="email" type="email" className={inputClass("email")} placeholder="usuario@iimp.org.pe" />
                {errors.email && <span className="text-red-500 text-xs mt-1 block font-bold">{errors.email[0]}</span>}
              </div>

              <div className="md:col-span-2" ref={dropdownRef}>
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 block ml-1">Rol en el Sistema</label>
                <input type="hidden" name="roleId" value={selectedRole || ""} />
                
                <div className="relative">
                  <button 
                    type="button"
                    onClick={() => setIsRoleOpen(!isRoleOpen)}
                    className={`w-full h-12 px-4 rounded-xl border flex items-center justify-between text-sm font-semibold transition-all duration-200 outline-none ${isRoleOpen ? 'border-[#C5A059] ring-4 ring-[#C5A059]/10 bg-white' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white text-slate-800'}`}
                  >
                    <span className={selectedRole ? 'text-slate-800' : 'text-slate-400'}>{selectedRoleName}</span>
                    <ChevronDown size={18} className={`text-slate-400 transition-transform duration-300 ${isRoleOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isRoleOpen && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-[0_15px_40px_-10px_rgba(0,0,0,0.1)] py-2 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                      {roles.map(r => (
                        <div 
                          key={r.id}
                          onClick={() => { setSelectedRole(r.id); setIsRoleOpen(false); }}
                          className="flex items-center justify-between px-4 py-3 hover:bg-[#C5A059]/10 cursor-pointer transition-colors group"
                        >
                          <span className={`text-sm font-semibold ${selectedRole === r.id ? 'text-[#a3722a]' : 'text-slate-600 group-hover:text-[#a3722a]'}`}>
                            {r.name}
                          </span>
                          {selectedRole === r.id && <Check size={16} strokeWidth={3} className="text-[#a3722a]" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {errors.roleId && <span className="text-red-500 text-xs mt-1 block font-bold">{errors.roleId[0]}</span>}
              </div>

            </div>
          </form>
        </div>

        <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} disabled={isLoading} className="px-6 h-12 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition-colors disabled:opacity-50 text-sm">
            Cancelar
          </button>
          <button type="submit" form="createUserForm" disabled={isLoading} className="flex items-center gap-2 bg-[#C5A059] text-white px-8 h-12 rounded-xl font-bold shadow-md hover:shadow-lg hover:bg-[#a67c3b] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-70 disabled:hover:translate-y-0 text-sm">
            {isLoading ? "Guardando..." : <><Save size={18} strokeWidth={2.5} /> Confirmar Registro</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}