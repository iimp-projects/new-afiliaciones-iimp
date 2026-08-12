"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { MoreVertical, CheckCircle2, XCircle, Shield, Mail, Activity, Lock, Unlock, Edit, Trash2 } from "lucide-react";
import { toggleUserStatusAction, deleteUserAction } from "../Actions/user.actions";

// ==========================================
// 1. SUB-COMPONENTE: TARJETA INDIVIDUAL
// ==========================================
function UserCard({ user }: { user: any }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false);
    };
    if (isMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  // Acciones con alertas descriptivas
  const handleToggleStatus = () => {
    setIsMenuOpen(false);
    const actionText = user.status === "ACTIVE" ? "bloquear (inactivar)" : "desbloquear (activar)";
    const confirmMessage = `¿Estás seguro de que deseas ${actionText} el acceso al usuario ${user.person.firstName}?\n\nSi lo bloqueas, el usuario no podrá iniciar sesión en la Intranet.`;
    
    if (window.confirm(confirmMessage)) {
      startTransition(async () => {
        await toggleUserStatusAction(user.id, user.status);
      });
    }
  };

  const handleDelete = () => {
    setIsMenuOpen(false);
    const confirmMessage = `¿Estás completamente seguro de eliminar permanentemente al usuario ${user.person.firstName}?\n\nEsta acción revocará todos sus accesos de forma irreversible.`;
    
    if (window.confirm(confirmMessage)) {
      startTransition(async () => {
        await deleteUserAction(user.id);
      });
    }
  };

  const isActive = user.status === "ACTIVE";
  const topColor = isActive ? "bg-emerald-500" : "bg-red-500";
  const badgeColor = isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";
  const StatusIcon = isActive ? CheckCircle2 : XCircle;

  return (
    <article className={`bg-white rounded-2xl p-5 shadow-sm border border-slate-200 relative flex flex-col hover:shadow-md transition-all duration-300 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Borde superior de color */}
      <div className={`absolute top-0 left-0 w-full h-1.5 rounded-t-2xl ${topColor}`}></div>
      
      {/* CABECERA DE TARJETA */}
      <div className="flex items-start justify-between mt-1 mb-5 relative">
        <div className={`flex flex-col px-3 py-1.5 rounded-xl w-max ${badgeColor}`}>
          <div className="flex items-center gap-1.5">
            <StatusIcon size={14} strokeWidth={2.5} />
            <span className="text-[11px] font-black uppercase tracking-wider">{isActive ? "Activo" : "Bloqueado"}</span>
          </div>
          <span className="text-[10px] font-semibold mt-0.5 opacity-80 pl-5">
            {isActive ? "Acceso permitido" : "Acceso restringido"}
          </span>
        </div>

        {/* MENÚ 3 PUNTITOS */}
        <div ref={menuRef} className="absolute -top-1 -right-2 z-50">
          <button className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <MoreVertical size={20} strokeWidth={2.5} />
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-100 rounded-xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.2)] py-1.5 z-[100] animate-in fade-in zoom-in-95">
              <button onClick={() => setIsMenuOpen(false)} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors">
                <Edit size={16} /> Editar Usuario
              </button>
              <button onClick={handleToggleStatus} className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm font-bold transition-colors ${isActive ? "text-slate-600 hover:bg-amber-50 hover:text-amber-600" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-600"}`}>
                {isActive ? <><Lock size={16} /> Bloquear Acceso</> : <><Unlock size={16} /> Desbloquear Acceso</>}
              </button>
              <div className="h-px bg-slate-100 my-1 mx-2"></div>
              <button onClick={handleDelete} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 size={16} /> Eliminar Permanente
              </button>
            </div>
          )}
        </div>
      </div>

      {/* IDENTIDAD DEL USUARIO */}
      <div className="flex items-center gap-4 mb-5">
        <div className="w-[50px] h-[50px] shrink-0 rounded-full bg-[#FFFDF8] border border-[#E8D09E] flex items-center justify-center text-[#C5A059] font-black text-lg shadow-sm">
          {user.person.firstName.charAt(0)}{user.person.paternalLastName.charAt(0)}
        </div>
        <div className="flex flex-col min-w-0">
          <h3 className="text-[13px] font-extrabold text-slate-800 leading-tight capitalize truncate" title={`${user.person.firstName} ${user.person.paternalLastName}`}>
            {user.person.firstName.toLowerCase()} {user.person.paternalLastName.toLowerCase()}
          </h3>
          <p className="text-[11px] font-semibold text-slate-500 mt-1 truncate">{user.role?.name || "Sin Rol"}</p>
          <p className="text-[10px] font-bold text-slate-400 font-mono mt-0.5">{user.person.documentType} {user.person.documentNumber}</p>
        </div>
      </div>

      {/* LISTA DE DATOS */}
      <div className="flex flex-col gap-3 mb-4 flex-grow">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 w-[80px] shrink-0">
            <Mail size={14} className="text-slate-500 shrink-0" />
            <span className="text-[11px] font-bold text-slate-700 leading-none">Correo</span>
          </div>
          <span className="text-[10px] font-medium text-slate-500 truncate text-right" title={user.email}>{user.email}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 w-[80px] shrink-0">
            <Shield size={14} className="text-slate-500 shrink-0" />
            <span className="text-[11px] font-bold text-slate-700 leading-none">Tipo</span>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 whitespace-nowrap">
            {user.type === "SYSTEM_ADMIN" ? "Administrador" : user.type === "VALIDATOR" ? "Revisor" : user.type}
          </span>
        </div>
      </div>
      
      {/* FOOTER */}
      <div className="flex items-center gap-1.5 pt-3 border-t border-slate-100 text-[10px] font-medium text-slate-500 mt-auto">
        <Activity size={12} className="text-slate-400" /> Registrado: {new Date(user.createdAt).toLocaleDateString('es-PE')}
      </div>
    </article>
  );
}

// ==========================================
// 2. COMPONENTE PRINCIPAL (GRID)
// ==========================================
export function UsersGrid({ users }: { users: any[] }) {
  if (users.length === 0) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-slate-200 shadow-sm h-64">
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
    /* 
      AQUÍ ESTÁ LA MAGIA:
      - md:grid-cols-2 (Tablets)
      - lg:grid-cols-3 (Laptops)
      - xl:grid-cols-4 (Monitores grandes y Desktop)
    */
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {users.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  );
}