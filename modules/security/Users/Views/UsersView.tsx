"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, Download } from "lucide-react";
// ❌ ¡Asegúrate de NO importar { Toaster } de sonner aquí!
import { UsersGrid } from "../Components/UsersGrid";
import { CreateUserModal } from "../Components/CreateUserModal";
import { UsersFilterBar } from "../Components/UsersFilterBar";
import { UsersPagination } from "../Components/UsersPagination";

interface UsersViewProps {
  roles: { id: number; name: string }[];
}

export function UsersView({ roles }: UsersViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 12, totalPages: 1 });
  
  const [filters, setFilters] = useState({
    search: "",
    status: "ALL",
    role: "ALL",
    sort: "desc"
  });

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: meta.page.toString(),
        pageSize: meta.pageSize.toString(),
      });
      
      if (filters.search) queryParams.append("search", filters.search);
      if (filters.status !== "ALL") queryParams.append("status", filters.status);
      if (filters.role !== "ALL") queryParams.append("roleId", filters.role);
      if (filters.sort) queryParams.append("sort", filters.sort);

      const response = await fetch(`/api/security/users?${queryParams.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setUsers(result.data);
        setMeta(result.meta);
      }
    } catch (error) {
      console.error("Ocurrió un error al cargar la lista.");
    } finally {
      setIsLoading(false);
    }
  }, [filters, meta.page, meta.pageSize]);

  useEffect(() => {
    const timeoutId = setTimeout(() => { fetchUsers(); }, 500);
    return () => clearTimeout(timeoutId);
  }, [fetchUsers]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setMeta((prev) => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({ search: "", status: "ALL", role: "ALL", sort: "desc" });
    setMeta((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div className="flex flex-col relative animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[calc(100vh-8rem)] pb-4">
      
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-5 flex flex-col relative z-20">
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-none">
              Usuarios del Sistema
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1.5">
              Gestiona, evalúa y resuelve los accesos al sistema.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center justify-center gap-1.5 px-4 h-9 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold transition-all shadow-sm focus:outline-none">
              <Download size={14} strokeWidth={2.5} /> Exportar Excel
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-4 h-9 bg-[#C5A059] text-white hover:bg-[#a67c3b] rounded-lg text-xs font-bold transition-all shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#C5A059]/50"
            >
              <Plus size={14} strokeWidth={2.5} /> Nuevo Usuario
            </button>
          </div>
        </div>
        
        <UsersFilterBar 
          roles={roles} 
          filters={filters} 
          onFilterChange={handleFilterChange} 
          onClearFilters={handleClearFilters}
          total={meta.total} 
        />
      </div>

      <div className="relative z-10 min-h-[300px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin w-8 h-8 border-4 border-[#C5A059] border-t-transparent rounded-full"></div>
              <span className="text-sm font-bold text-slate-500">Actualizando usuarios...</span>
            </div>
          </div>
        ) : (
          <UsersGrid 
            users={users} 
            roles={roles} 
            onActionSuccess={fetchUsers} 
            // ❌ Ya no pasamos props basura de showToast
          />
        )}
      </div>

      <div className="flex-1"></div>

      {users.length > 0 && (
        <UsersPagination 
          meta={meta} 
          onPageChange={(page) => setMeta((prev) => ({ ...prev, page }))} 
        />
      )}

      {isModalOpen && (
        <CreateUserModal 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={() => { setIsModalOpen(false); fetchUsers(); }} 
          roles={roles} 
        />
      )}
    </div>
  );
}