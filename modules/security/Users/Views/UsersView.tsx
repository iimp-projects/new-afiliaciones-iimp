"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Filter, Download } from "lucide-react";
import { UsersGrid } from "../Components/UsersGrid";
import { CreateUserModal } from "../Components/CreateUserModal";

interface UsersViewProps {
  initialUsers: any[];
  total: number;
  currentPage: number;
  query: string;
  roles: { id: number; name: string }[];
}

export function UsersView({ initialUsers, total, currentPage, query, roles }: UsersViewProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState(query);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/intranet/seguridad/usuarios?q=${encodeURIComponent(searchTerm)}&page=1`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* HEADER IDÉNTICO A EXPEDIENTES */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            Usuarios del Sistema
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1.5">
            Gestiona, evalúa y resuelve los accesos al sistema.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white border border-emerald-200 text-emerald-600 px-4 h-11 rounded-xl font-bold shadow-sm hover:bg-emerald-50 transition-all text-sm">
            <Download size={16} strokeWidth={2.5} /> Exportar Excel
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#C5A059] to-[#9E7832] text-white px-5 h-11 rounded-xl font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm"
          >
            <Plus size={18} strokeWidth={2.5} /> Nuevo Usuario
          </button>
        </div>
      </div>

      {/* ÁREA DE FILTROS TIPO PASTILLA */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-center gap-4">
        <form onSubmit={handleSearch} className="relative w-full lg:flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por DNI, Nombre o Correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] transition-all"
          />
        </form>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Dropdown Estado Ficticio (Visual) */}
          <div className="relative">
            <span className="absolute -top-2 left-3 bg-white px-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado</span>
            <select className="h-12 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:outline-none focus:border-[#C5A059] appearance-none pr-10">
              <option>Todos los estados</option>
              <option>Activos</option>
              <option>Bloqueados</option>
            </select>
          </div>

          {/* Dropdown Roles Ficticio (Visual) */}
          <div className="relative">
            <span className="absolute -top-2 left-3 bg-white px-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">Rol</span>
            <select className="h-12 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:outline-none focus:border-[#C5A059] appearance-none pr-10">
              <option>Todos los roles</option>
              {roles.map(r => <option key={r.id}>{r.name}</option>)}
            </select>
          </div>

          <button className="h-12 px-5 flex items-center gap-2 border border-slate-200 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-50 transition-colors">
            <Filter size={16} strokeWidth={2.5} /> Filtros Avanzados
          </button>
        </div>
      </div>

      {/* METADATOS Y ORDENAMIENTO */}
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
          <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-pulse"></span>
          {total} usuarios encontrados
        </div>
        <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
          <span>↓↑ ORDENAR:</span>
          <select className="bg-transparent font-black text-slate-700 outline-none cursor-pointer border-none">
            <option>Más recientes</option>
            <option>Más antiguos</option>
          </select>
        </div>
      </div>

      {/* GRID DE TARJETAS (Reemplaza a la tabla) */}
      <UsersGrid users={initialUsers} />

      {/* PAGINATION */}
      <div className="bg-white px-6 py-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center text-sm font-bold text-slate-500 mt-4">
        <span>Página {currentPage}</span>
        <div className="flex gap-2">
          <button 
            disabled={currentPage <= 1}
            onClick={() => router.push(`/intranet/seguridad/usuarios?q=${query}&page=${currentPage - 1}`)}
            className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Anterior
          </button>
          <button 
            disabled={currentPage * 10 >= total}
            onClick={() => router.push(`/intranet/seguridad/usuarios?q=${query}&page=${currentPage + 1}`)}
            className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <CreateUserModal onClose={() => setIsModalOpen(false)} roles={roles} />
      )}
    </div>
  );
}