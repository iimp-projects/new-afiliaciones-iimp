"use client";

import { useState } from "react";
import { Search, Plus, Filter, KeyRound, MoreVertical, Edit, ShieldCheck, Users } from "lucide-react";

export function RolesView({ initialRoles, total }: { initialRoles: any[], total: number }) {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Roles y Permisos</h1>
          <p className="text-sm font-medium text-slate-500 mt-1.5">Define los niveles de acceso y privilegios del sistema.</p>
        </div>
        <button className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#C5A059] to-[#9E7832] text-white px-5 h-11 rounded-xl font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm">
          <Plus size={18} strokeWidth={2.5} /> Nuevo Rol
        </button>
      </div>

      {/* FILTROS TIPO PASTILLA */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-center gap-4">
        <div className="relative w-full lg:flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar rol por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] transition-all"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative">
            <span className="absolute -top-2 left-3 bg-white px-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado</span>
            <select className="h-12 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:outline-none focus:border-[#C5A059] appearance-none pr-10">
              <option>Todos los estados</option>
              <option>Activos</option>
              <option>Inactivos</option>
            </select>
          </div>
          <button className="h-12 px-5 flex items-center gap-2 border border-slate-200 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-50 transition-colors">
            <Filter size={16} strokeWidth={2.5} /> Filtros Avanzados
          </button>
        </div>
      </div>

      {/* METADATOS */}
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
          <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-pulse"></span>
          {total} roles encontrados
        </div>
      </div>

      {/* GRID DE ROLES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {initialRoles.map((role) => (
          <article key={role.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 relative flex flex-col hover:shadow-md transition-all duration-300 group">
            <div className={`absolute top-0 left-0 w-full h-1.5 rounded-t-2xl ${role.isActive ? 'bg-[#C5A059]' : 'bg-slate-300'}`}></div>
            
            <div className="flex items-start justify-between mt-1 mb-5 relative">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl w-max ${role.isActive ? 'bg-[#FFFDF8] text-[#C5A059] border border-[#E8D09E]' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                <KeyRound size={14} strokeWidth={2.5} />
                <span className="text-[10px] font-black uppercase tracking-wider">{role.slug}</span>
              </div>
              <button className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
                <MoreVertical size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex flex-col min-w-0 mb-4 flex-grow">
              <h3 className="text-[15px] font-extrabold text-slate-800 leading-tight truncate">{role.name}</h3>
              <p className="text-[11px] font-medium text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                {role.description || "Sin descripción asignada."}
              </p>
            </div>
            
            <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                <Users size={14} className="text-[#C5A059]" /> {role._count?.users || 0} Usuarios
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                <ShieldCheck size={14} className="text-[#C5A059]" /> {role._count?.rolePermissions || 0} Permisos
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}