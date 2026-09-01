"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Save, KeyRound, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { changeUserPasswordAction } from "../Actions/user.actions";

interface ChangePasswordModalProps {
  user: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function ChangePasswordModal({ user, onClose, onSuccess }: ChangePasswordModalProps) {
  const [mounted, setMounted] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setIsLoading(true);
    const result = await changeUserPasswordAction(user.id, newPassword);

    if (result.success) {
      toast.success("¡Contraseña Actualizada!", {
        description: `Se cambió la clave de ${user.person.firstName} exitosamente.`
      });
      onSuccess();
    } else {
      setError(result.message);
      setIsLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-[24px] w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        
        {/* HEADER */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <KeyRound size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Cambiar Contraseña</h2>
              <p className="text-xs font-medium text-slate-500 mt-0.5">Usuario: {user.person.firstName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* BODY */}
        <form id="changePasswordForm" onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 font-bold text-xs flex items-center gap-2">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <div>
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 block ml-1">Nueva Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-11 pl-4 pr-10 rounded-xl border border-slate-200 focus:outline-none focus:border-[#C5A059] focus:ring-4 focus:ring-[#C5A059]/10 bg-slate-50 focus:bg-white text-sm font-semibold transition-all"
                placeholder="Mínimo 8 caracteres"
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#C5A059]">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 block ml-1">Confirmar Contraseña</label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:outline-none focus:border-[#C5A059] focus:ring-4 focus:ring-[#C5A059]/10 bg-slate-50 focus:bg-white text-sm font-semibold transition-all"
              placeholder="Repite la contraseña"
              required
            />
          </div>
        </form>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} disabled={isLoading} className="px-5 h-11 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition-colors disabled:opacity-50 text-sm">
            Cancelar
          </button>
          <button type="submit" form="changePasswordForm" disabled={isLoading} className="flex items-center gap-2 bg-[#C5A059] text-white px-6 h-11 rounded-xl font-bold shadow-md hover:shadow-lg hover:bg-[#a67c3b] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-70 disabled:hover:translate-y-0 text-sm">
            {isLoading ? "Guardando..." : <><Save size={16} strokeWidth={2.5} /> Guardar Cambios</>}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}