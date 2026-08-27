"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner"; // ✅ IMPORTAMOS SONNER
import { MoreVertical, Shield, Mail, Activity, Lock, Unlock, Edit, Trash2, IdCard, LogOut, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toggleUserStatusAction, deleteUserAction, revokeUserSessionsAction } from "../Actions/user.actions"; 
import { EditUserModal } from "./EditUserModal"; 

const getRoleBadgeColor = (slug?: string) => {
  if (!slug) return "text-slate-500 bg-slate-100 border-slate-200";
  switch(slug) {
    case "SUPER_ADMIN": return "text-purple-700 bg-purple-50 border-purple-200";
    case "SYSTEM_ADMIN": return "text-indigo-700 bg-indigo-50 border-indigo-200";
    case "GERENCIA_GENERAL":
    case "SECRETARIA_GENERAL": return "text-blue-700 bg-blue-50 border-blue-200";
    case "COMITE_EVALUADOR": 
    case "VALIDADOR": return "text-cyan-700 bg-cyan-50 border-cyan-200";
    case "LOGISTICA": 
    case "OPERACIONES": return "text-orange-700 bg-orange-50 border-orange-200";
    case "TESORERIA":
    case "CONTABILIDAD":
    case "CAJA": return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "LEGAL": return "text-rose-700 bg-rose-50 border-rose-200";
    case "COMUNICACIONES": 
    case "ATENCION_ASOCIADO": return "text-pink-700 bg-pink-50 border-pink-200";
    case "MESA_PARTES": return "text-amber-700 bg-amber-50 border-amber-200";
    case "ASOCIADO_ACTIVO":
    case "ASOCIADO_ESTUDIANTE": return "text-[#C5A059] bg-[#C5A059]/10 border-[#E8D09E]";
    case "POSTULANTE": return "text-slate-600 bg-slate-100 border-slate-300";
    default: return "text-slate-600 bg-slate-50 border-slate-200";
  }
};

function UserCard({ user, onEdit, onConfirmAction }: { user: any, onEdit: (u: any) => void, onConfirmAction: (actionData: any) => void }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false);
    };
    if (isMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const handleToggleStatus = () => {
    setIsMenuOpen(false);
    const isActivating = user.status !== "ACTIVE";
    onConfirmAction({
      title: isActivating ? "Desbloquear Usuario" : "Bloquear Usuario",
      message: `¿Estás seguro de que deseas ${isActivating ? "habilitar" : "restringir"} el acceso al usuario ${user.person.firstName}?`,
      confirmText: isActivating ? "Sí, Desbloquear" : "Sí, Bloquear",
      isDanger: !isActivating,
      action: async () => await toggleUserStatusAction(user.id, user.status)
    });
  };

  const handleDelete = () => {
    setIsMenuOpen(false);
    onConfirmAction({
      title: "Eliminar Usuario",
      message: `¿Estás completamente seguro de eliminar permanentemente al usuario ${user.person.firstName}? Esta acción es irreversible.`,
      confirmText: "Eliminar Permanente",
      isDanger: true,
      action: async () => await deleteUserAction(user.id)
    });
  };

  const handleRevokeSessions = () => {
    setIsMenuOpen(false);
    onConfirmAction({
      title: "Cerrar Sesiones",
      message: `¿Deseas cerrar remotamente todas las sesiones abiertas de ${user.person.firstName}? Tendrá que volver a iniciar sesión.`,
      confirmText: "Cerrar Sesiones",
      isDanger: false,
      action: async () => await revokeUserSessionsAction(user.id)
    });
  };

  const isActive = user.status === "ACTIVE";

  return (
    <article className={`group bg-white border border-slate-200 hover:border-[#C5A059]/50 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-4 relative ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
      
      <div ref={menuRef} className="absolute top-3 right-3 z-50">
        <button 
          className="p-1.5 text-slate-300 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all outline-none" 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <MoreVertical size={18} />
        </button>
        
        {isMenuOpen && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-100 rounded-xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.2)] py-1.5 z-[100] animate-in fade-in zoom-in-95">
            <button onClick={() => { setIsMenuOpen(false); onEdit(user); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-50 hover:text-[#C5A059] transition-colors outline-none">
              <Edit size={15} /> Editar Datos
            </button>
            
            <button onClick={handleToggleStatus} className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-bold transition-colors outline-none ${isActive ? "text-slate-600 hover:bg-amber-50 hover:text-amber-600" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-600"}`}>
              {isActive ? <><Lock size={15} /> Bloquear Acceso</> : <><Unlock size={15} /> Desbloquear Acceso</>}
            </button>

            {isActive && (
              <button onClick={handleRevokeSessions} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-colors outline-none">
                <LogOut size={15} /> Cerrar Sesiones
              </button>
            )}

            <div className="h-px bg-slate-100 my-1 mx-2"></div>
            
            <button onClick={handleDelete} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-bold text-red-600 hover:bg-red-50 transition-colors outline-none">
              <Trash2 size={15} /> Eliminar Usuario
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3 items-center pr-6">
        <div className="w-12 h-12 shrink-0 rounded-full bg-[#fdfaf5] border border-[#E8D09E] flex items-center justify-center text-[#C5A059] font-black text-sm shadow-sm overflow-hidden relative">
          {user.image && !imgError ? (
              <img src={user.image} alt={user.person.firstName} className="w-full h-full object-cover" onError={() => setImgError(true)} />
          ) : (
              `${user.person.firstName.charAt(0)}${user.person.paternalLastName.charAt(0)}`
          )}
        </div>
        <div className="flex flex-col min-w-0 gap-1.5">
          <div className="flex items-center gap-2">
             <span className="font-extrabold text-slate-800 truncate text-sm capitalize" title={`${user.person.firstName} ${user.person.paternalLastName}`}>
                {user.person.firstName.toLowerCase()} {user.person.paternalLastName.toLowerCase()}
             </span>
             <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`} title={isActive ? 'Activo' : 'Bloqueado'}></span>
          </div>
          <span className={`text-[9px] px-2 py-0.5 rounded-md font-extrabold tracking-widest truncate w-max uppercase border ${getRoleBadgeColor(user.role?.slug)}`}>
            {user.role?.name || "Sin Rol"}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 p-3.5 bg-slate-50/70 border border-slate-100 rounded-xl mt-1 flex-grow">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <IdCard size={13} className="text-slate-400 shrink-0" />
          <span className="text-[11px] font-bold text-slate-500 w-12 shrink-0">Doc:</span>
          <span className="text-[11px] font-black text-slate-700 font-mono tracking-wide truncate">{user.person.documentType} {user.person.documentNumber}</span>
        </div>
        <div className="flex items-center gap-2.5 overflow-hidden">
          <Mail size={13} className="text-slate-400 shrink-0" />
          <span className="text-[11px] font-bold text-slate-500 w-12 shrink-0">Correo:</span>
          <span className="text-[11px] font-semibold text-slate-700 truncate" title={user.email}>{user.email}</span>
        </div>
        <div className="flex items-center gap-2.5 overflow-hidden">
          <Shield size={13} className="text-slate-400 shrink-0" />
          <span className="text-[11px] font-bold text-slate-500 w-12 shrink-0">Perfil:</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-white border border-slate-200 text-slate-600 whitespace-nowrap shadow-sm">
            {user.type === "SYSTEM_ADMIN" ? "Administrador Base" : user.type === "VALIDATOR" ? "Revisor de Área" : user.type}
          </span>
        </div>
      </div>
      
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-400">
         <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
             <Activity size={12} className="text-slate-300" /> Registrado: {new Date(user.createdAt).toLocaleDateString('es-PE')}
         </span>
      </div>
    </article>
  );
}

// ❌ Quitamos el showToast de los props, usamos sonner nativo
export function UsersGrid({ users, roles, onActionSuccess }: { users: any[], roles: { id: number; name: string }[], onActionSuccess: () => void }) {
  const [editingUser, setEditingUser] = useState<any | null>(null);
  
  const [confirmDialog, setConfirmDialog] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const executeConfirmAction = async () => {
    setIsProcessing(true);
    try {
      const res = await confirmDialog.action();
      if (res.success) {
        toast.success(res.message); // ✅ TOAST SONNER DIRECTO
        onActionSuccess(); 
      } else {
        toast.error(res.message); // ✅ TOAST SONNER DIRECTO
      }
    } catch (e) {
      toast.error("Ocurrió un error inesperado.");
    } finally {
      setIsProcessing(false);
      setConfirmDialog(null);
    }
  };

  if (users.length === 0) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-slate-200 shadow-sm h-64 mt-4">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-bold text-slate-700">No hay usuarios</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-md">
          No se encontraron usuarios que coincidan con la búsqueda actual o el sistema no tiene registros.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {users.map((user) => (
          <UserCard key={user.id} user={user} onEdit={setEditingUser} onConfirmAction={setConfirmDialog} />
        ))}
      </div>

      {editingUser && (
        <EditUserModal 
            user={editingUser} 
            roles={roles} 
            onClose={() => setEditingUser(null)} 
            onSuccess={() => { setEditingUser(null); onActionSuccess(); }}
            // ❌ Sin pasar showToast
        />
      )}

      {confirmDialog && createPortal(
        <div className="fixed inset-0 z-[9999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 sm:p-8 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm ${confirmDialog.isDanger ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                <AlertTriangle size={32} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-black text-slate-800">{confirmDialog.title}</h2>
              <p className="text-sm text-slate-500 mt-2.5 font-medium leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => setConfirmDialog(null)} 
                disabled={isProcessing}
                className="flex-1 py-3 rounded-xl border border-slate-200 bg-white font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                onClick={executeConfirmAction} 
                disabled={isProcessing}
                className={`flex-1 py-3 rounded-xl font-bold text-white shadow-md transition-colors disabled:opacity-50 ${confirmDialog.isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}
              >
                {isProcessing ? "Procesando..." : confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}