"use client";

import { useTransition } from "react";
import { Shield, UserX, UserCheck, Trash2, Edit } from "lucide-react";
import { toggleUserStatusAction, deleteUserAction } from "../Actions/user.actions";

export function UsersTable({ users }: { users: any[] }) {
  const [isPending, startTransition] = useTransition();

  // Acción Descriptiva para Bloquear/Desbloquear
  const handleToggleStatus = (userId: number, userName: string, currentStatus: string) => {
    const actionText = currentStatus === "ACTIVE" ? "bloquear (inactivar)" : "desbloquear (activar)";
    const confirmMessage = `¿Estás seguro de que deseas ${actionText} el acceso al usuario ${userName}?\n\nSi lo bloqueas, el usuario no podrá iniciar sesión en la Intranet.`;
    
    if (window.confirm(confirmMessage)) {
      startTransition(async () => {
        await toggleUserStatusAction(userId, currentStatus);
      });
    }
  };

  // Acción Descriptiva para Eliminar
  const handleDelete = (userId: number, userName: string) => {
    const confirmMessage = `¿Estás completamente seguro de eliminar permanentemente al usuario ${userName}?\n\nEsta acción revocará todos sus accesos.`;
    
    if (window.confirm(confirmMessage)) {
      startTransition(async () => {
        await deleteUserAction(userId);
      });
    }
  };

  if (users.length === 0) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
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
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-white">
            <th className="px-6 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
              Usuario
            </th>
            <th className="px-6 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
              Documento
            </th>
            <th className="px-6 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
              Rol en Sistema
            </th>
            <th className="px-6 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
              Estado
            </th>
            <th className="px-6 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest text-right">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-slate-50/60 transition-colors group">
              
              {/* COLUMNA 1: USUARIO (Avatar + Nombre + Correo) */}
              <td className="px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-[#FFFDF8] border border-[#E8D09E] text-[#C5A059] flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                    {user.person.firstName.charAt(0)}{user.person.paternalLastName.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-extrabold text-slate-800 text-[14px]">
                      {user.person.firstName} {user.person.paternalLastName} {user.person.maternalLastName || ""}
                    </span>
                    <span className="text-xs font-medium text-slate-500 mt-0.5">
                      {user.email}
                    </span>
                  </div>
                </div>
              </td>

              {/* COLUMNA 2: DOCUMENTO */}
              <td className="px-6 py-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-[#C5A059] uppercase tracking-wider mb-0.5">
                    {user.person.documentType}
                  </span>
                  <span className="font-bold text-slate-700 text-[13px]">
                    {user.person.documentNumber}
                  </span>
                </div>
              </td>

              {/* COLUMNA 3: ROL */}
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <Shield size={16} strokeWidth={2.5} className="text-[#C5A059]" />
                  <span className="font-bold text-slate-700 text-[13px]">
                    {user.role?.name || "Sin Rol"}
                  </span>
                </div>
              </td>

              {/* COLUMNA 4: ESTADO (Badges estilizados como en la imagen) */}
              <td className="px-6 py-4">
                {user.status === "ACTIVE" ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-black uppercase tracking-widest shadow-sm">
                    Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-[10px] font-black uppercase tracking-widest shadow-sm">
                    Inactivo
                  </span>
                )}
              </td>

              {/* COLUMNA 5: ACCIONES */}
              <td className="px-6 py-4">
                <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-50 md:group-hover:opacity-100 transition-opacity">
                  
                  {/* Botón Bloquear/Desbloquear */}
                  <button
                    onClick={() => handleToggleStatus(user.id, user.person.firstName, user.status)}
                    disabled={isPending}
                    title={user.status === "ACTIVE" ? "Bloquear Usuario (Inactivar)" : "Desbloquear Usuario (Activar)"}
                    className={`p-2 rounded-xl transition-all duration-300 disabled:opacity-50 border shadow-sm ${
                      user.status === "ACTIVE" 
                        ? "bg-white border-gray-200 text-slate-400 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50" 
                        : "bg-white border-gray-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50"
                    }`}
                  >
                    {user.status === "ACTIVE" ? <UserX size={16} strokeWidth={2.5} /> : <UserCheck size={16} strokeWidth={2.5} />}
                  </button>

                  {/* Botón Editar */}
                  <button
                    disabled={isPending}
                    title="Editar Usuario"
                    className="p-2 bg-white border border-gray-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-xl transition-all duration-300 shadow-sm disabled:opacity-50"
                  >
                    <Edit size={16} strokeWidth={2.5} />
                  </button>

                  {/* Botón Eliminar */}
                  <button
                    onClick={() => handleDelete(user.id, user.person.firstName)}
                    disabled={isPending}
                    title="Eliminar Usuario Permanentemente"
                    className="p-2 bg-white border border-gray-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-xl transition-all duration-300 shadow-sm disabled:opacity-50"
                  >
                    <Trash2 size={16} strokeWidth={2.5} />
                  </button>

                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}