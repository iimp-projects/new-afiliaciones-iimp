"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { MoreVertical, Shield, Activity, Lock, Unlock, Edit, Trash2, LogOut, KeyRound, AlertTriangle, X } from "lucide-react";
import { toggleUserStatusAction, deleteUserAction, revokeUserSessionsAction, bulkBlockUsersAction, bulkUnblockUsersAction, bulkRevokeSessionsAction, bulkDeleteUsersAction } from "../Actions/user.actions";
import { EditUserModal } from "./EditUserModal";
import { ChangePasswordModal } from "./ChangePasswordModal";

function getProfileLabel(type?: string) {
  switch (type) {
    case "SYSTEM_ADMIN": return "Administrador Base";
    case "VALIDATOR": return "Revisor de Área";
    case "AFFILIATE": return "Asociado";
    case "APPLICANT": return "Postulante";
    default: return type || "—";
  }
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-black uppercase tracking-widest shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Activo
      </span>
    );
  }
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-[10px] font-black uppercase tracking-widest shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pendiente
      </span>
    );
  }
  if (status === "BLOCKED") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-[10px] font-black uppercase tracking-widest shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Bloqueado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest shadow-sm">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactivo
    </span>
  );
}

function UserAvatar({ user }: { user: any }) {
  const [imgError, setImgError] = useState(false);
  const initials = `${user.person.firstName.charAt(0)}${user.person.paternalLastName.charAt(0)}`;

  return (
    <div className="w-11 h-11 rounded-full bg-[#fdfaf5] border border-[#E8D09E] flex items-center justify-center text-[#C5A059] font-black text-sm shrink-0 shadow-sm overflow-hidden">
      {user.image && !imgError ? (
        <img src={user.image} alt={user.person.firstName} className="w-full h-full object-cover" onError={() => setImgError(true)} />
      ) : (
        initials
      )}
    </div>
  );
}

export function RowActionsMenu({
  user,
  onEdit,
  onChangePassword,
  onToggleStatus,
  onRevokeSessions,
  onDelete,
}: {
  user: any;
  onEdit: () => void;
  onChangePassword: () => void;
  onToggleStatus: () => void;
  onRevokeSessions: () => void;
  onDelete: () => void;
}) {
  const isActive = user.status === "ACTIVE";

  return (
    <div className="w-56 bg-white border border-slate-100 rounded-xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.2)] py-1.5 text-left">
      <button onClick={onEdit} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-50 hover:text-[#C5A059] transition-colors outline-none">
        <Edit size={15} /> Editar Datos
      </button>
      <button onClick={onChangePassword} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-bold text-amber-600 hover:bg-amber-50 transition-colors outline-none">
        <KeyRound size={15} /> Cambiar Contraseña
      </button>
      <div className="h-px bg-slate-100 my-1 mx-2"></div>
      <button onClick={onToggleStatus} className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-bold transition-colors outline-none ${isActive ? "text-slate-600 hover:bg-amber-50 hover:text-amber-600" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-600"}`}>
        {isActive ? <><Lock size={15} /> Bloquear Acceso</> : <><Unlock size={15} /> Desbloquear Acceso</>}
      </button>
      {isActive && (
        <button onClick={onRevokeSessions} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-colors outline-none">
          <LogOut size={15} /> Cerrar Sesiones
        </button>
      )}
      <div className="h-px bg-slate-100 my-1 mx-2"></div>
      <button onClick={onDelete} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-bold text-red-600 hover:bg-red-50 transition-colors outline-none">
        <Trash2 size={15} /> Eliminar Usuario
      </button>
    </div>
  );
}

const MENU_MARGIN = 8;

function RowActions({ user, onEdit, onChangePassword, onConfirmAction }: { user: any; onEdit: (u: any) => void; onChangePassword: (u: any) => void; onConfirmAction: (actionData: any) => void }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => setIsMenuOpen(false);

  // Posiciona el menú fuera del layout (portal) usando coordenadas del viewport,
  // abriendo hacia arriba cuando no hay espacio suficiente abajo.
  useEffect(() => {
    if (!isMenuOpen) return;

    const place = () => {
      const btn = buttonRef.current;
      const menu = menuRef.current;
      if (!btn || !menu) return;

      const rect = btn.getBoundingClientRect();
      const menuWidth = menu.offsetWidth || 224;
      const menuHeight = menu.offsetHeight || 280;

      const openUp = rect.bottom + menuHeight + MENU_MARGIN > window.innerHeight;
      const top = openUp ? rect.top - menuHeight - 4 : rect.bottom + 4;
      let left = rect.right - menuWidth;
      left = Math.max(MENU_MARGIN, Math.min(left, window.innerWidth - menuWidth - MENU_MARGIN));

      setCoords({ top, left });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [isMenuOpen]);

  // Cierra al hacer click fuera del botón o del menú.
  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      closeMenu();
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isMenuOpen]);

  const handleToggleStatus = () => {
    closeMenu();
    const isActivating = user.status !== "ACTIVE";
    onConfirmAction({
      title: isActivating ? "Desbloquear Usuario" : "Bloquear Usuario",
      message: `¿Estás seguro de que deseas ${isActivating ? "habilitar" : "restringir"} el acceso al usuario ${user.person.firstName}?`,
      confirmText: isActivating ? "Sí, Desbloquear" : "Sí, Bloquear",
      isDanger: !isActivating,
      action: async () => await toggleUserStatusAction(user.id, user.status),
    });
  };

  const handleDelete = () => {
    closeMenu();
    onConfirmAction({
      title: "Eliminar Usuario",
      message: `¿Estás completamente seguro de eliminar permanentemente al usuario ${user.person.firstName}? Esta acción es irreversible.`,
      confirmText: "Eliminar Permanente",
      isDanger: true,
      action: async () => await deleteUserAction(user.id),
    });
  };

  const handleRevokeSessions = () => {
    closeMenu();
    onConfirmAction({
      title: "Cerrar Sesiones",
      message: `¿Deseas cerrar remotamente todas las sesiones abiertas de ${user.person.firstName}? Tendrá que volver a iniciar sesión.`,
      confirmText: "Cerrar Sesiones",
      isDanger: false,
      action: async () => await revokeUserSessionsAction(user.id),
    });
  };

  return (
    <div className="inline-flex justify-end w-full">
      <button
        ref={buttonRef}
        className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all outline-none"
        onClick={() => setIsMenuOpen((open) => !open)}
        title="Acciones"
        aria-label="Acciones"
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
      >
        <MoreVertical size={18} />
      </button>

      {isMenuOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              visibility: coords ? "visible" : "hidden",
            }}
            className="z-[200]"
            role="menu"
          >
            <RowActionsMenu
              user={user}
              onEdit={() => { closeMenu(); onEdit(user); }}
              onChangePassword={() => { closeMenu(); onChangePassword(user); }}
              onToggleStatus={handleToggleStatus}
              onRevokeSessions={handleRevokeSessions}
              onDelete={handleDelete}
            />
          </div>,
          document.body
        )}
    </div>
  );
}

export function UsersTable({ users, roles, onActionSuccess }: { users: any[]; roles: { id: number; name: string }[]; onActionSuccess: () => void }) {
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [changingPasswordUser, setChangingPasswordUser] = useState<any | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const allVisibleSelected = users.length > 0 && users.every((user) => selectedIds.has(user.id));
  const someSelected = selectedIds.size > 0 && !allVisibleSelected;
  const selectedCount = selectedIds.size;

  const toggleRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(users.map((user) => user.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const executeConfirmAction = async () => {
    setIsProcessing(true);
    try {
      const res = await confirmDialog.action();
      if (res.success) {
        toast.success(res.message);
        clearSelection();
        onActionSuccess();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Ocurrió un error inesperado.");
    } finally {
      setIsProcessing(false);
      setConfirmDialog(null);
    }
  };

  const plural = (n: number) => (n === 1 ? "" : "s");

  const requestBulk = (payload: { title: string; message: string; confirmText: string; isDanger: boolean; action: () => Promise<any> }) => {
    setConfirmDialog(payload);
  };

  const confirmBulkBlock = () => requestBulk({
    title: "Bloquear usuarios",
    message: `Se bloqueará el acceso de ${selectedCount} usuario${plural(selectedCount)} seleccionado${plural(selectedCount)}. Estos usuarios no podrán iniciar sesión hasta que sean desbloqueados.`,
    confirmText: "Bloquear usuarios",
    isDanger: true,
    action: async () => await bulkBlockUsersAction([...selectedIds]),
  });

  const confirmBulkUnblock = () => requestBulk({
    title: "Desbloquear usuarios",
    message: `Se habilitará nuevamente el acceso de ${selectedCount} usuario${plural(selectedCount)} seleccionado${plural(selectedCount)}.`,
    confirmText: "Desbloquear usuarios",
    isDanger: false,
    action: async () => await bulkUnblockUsersAction([...selectedIds]),
  });

  const confirmBulkRevoke = () => requestBulk({
    title: "Cerrar sesiones activas",
    message: `Se cerrarán las sesiones activas de ${selectedCount} usuario${plural(selectedCount)}. Deberán volver a iniciar sesión.`,
    confirmText: "Cerrar sesiones",
    isDanger: false,
    action: async () => await bulkRevokeSessionsAction([...selectedIds]),
  });

  const confirmBulkDelete = () => requestBulk({
    title: "Eliminar usuarios",
    message: `Esta acción eliminará ${selectedCount} usuario${plural(selectedCount)} seleccionado${plural(selectedCount)}. Verifica la selección antes de continuar.`,
    confirmText: "Eliminar usuarios",
    isDanger: true,
    action: async () => await bulkDeleteUsersAction([...selectedIds]),
  });

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
      {selectedCount > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <span className="text-sm font-bold text-slate-700">
            {selectedCount} usuario{plural(selectedCount)} seleccionado{plural(selectedCount)}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button onClick={confirmBulkBlock} className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-bold transition-colors">
              <Lock size={14} /> Bloquear
            </button>
            <button onClick={confirmBulkUnblock} className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors">
              <Unlock size={14} /> Desbloquear
            </button>
            <button onClick={confirmBulkRevoke} className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors">
              <LogOut size={14} /> Cerrar sesiones
            </button>
            <button onClick={confirmBulkDelete} className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition-colors">
              <Trash2 size={14} /> Eliminar
            </button>
            <button onClick={clearSelection} className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 text-xs font-bold transition-colors">
              <X size={14} /> Deseleccionar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1120px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="w-10 px-3 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    aria-label="Seleccionar todos los usuarios visibles"
                    className="h-4 w-4 cursor-pointer accent-[#C5A059]"
                  />
                </th>
                <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Usuario</th>
                <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Documento</th>
                <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Correo</th>
                <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Rol / Perfil</th>
                <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</th>
                <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha de Registro</th>
                <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-[#fdfaf5]/60 transition-colors group">
                  <td className="px-3 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(user.id)}
                      onChange={() => toggleRow(user.id)}
                      aria-label={`Seleccionar usuario ${user.person.firstName} ${user.person.paternalLastName}`}
                      className="h-4 w-4 cursor-pointer accent-[#C5A059]"
                    />
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={user} />
                      <span className="font-bold text-slate-800 text-[13px] capitalize" title={`${user.person.firstName} ${user.person.paternalLastName} ${user.person.maternalLastName || ""}`.trim()}>
                        {user.person.firstName} {user.person.paternalLastName} {user.person.maternalLastName || ""}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-[#C5A059] uppercase tracking-wider mb-0.5">{user.person.documentType}</span>
                      <span className="font-bold text-slate-700 text-[13px] font-mono">{user.person.documentNumber}</span>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <span className="text-[13px] font-semibold text-slate-600 truncate block max-w-[220px]" title={user.email}>{user.email}</span>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="text-[13px] font-semibold text-slate-700">{user.role?.name || "Sin Rol"}</span>
                      <span className="text-[11px] font-medium text-slate-400">{getProfileLabel(user.type)}</span>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <StatusBadge status={user.status} />
                  </td>

                  <td className="px-4 py-4">
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 whitespace-nowrap">
                      <Activity size={13} className="text-slate-300" />
                      {new Date(user.createdAt).toLocaleDateString("es-PE")}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <RowActions user={user} onEdit={setEditingUser} onChangePassword={setChangingPasswordUser} onConfirmAction={setConfirmDialog} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          roles={roles}
          onClose={() => setEditingUser(null)}
          onSuccess={() => { setEditingUser(null); onActionSuccess(); }}
        />
      )}

      {changingPasswordUser && (
        <ChangePasswordModal
          user={changingPasswordUser}
          onClose={() => setChangingPasswordUser(null)}
          onSuccess={() => { setChangingPasswordUser(null); onActionSuccess(); }}
        />
      )}

      {confirmDialog && createPortal(
        <div className="fixed inset-0 z-[9999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 sm:p-8 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm ${confirmDialog.isDanger ? "bg-red-50 text-red-600 border border-red-100" : "bg-amber-50 text-amber-600 border border-amber-100"}`}>
                <AlertTriangle size={32} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-black text-slate-800">{confirmDialog.title}</h2>
              <p className="text-sm text-slate-500 mt-2.5 font-medium leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setConfirmDialog(null)} disabled={isProcessing} className="flex-1 py-3 rounded-xl border border-slate-200 bg-white font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={executeConfirmAction} disabled={isProcessing} className={`flex-1 py-3 rounded-xl font-bold text-white shadow-md transition-colors disabled:opacity-50 ${confirmDialog.isDanger ? "bg-red-600 hover:bg-red-700" : "bg-amber-500 hover:bg-amber-600"}`}>
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
