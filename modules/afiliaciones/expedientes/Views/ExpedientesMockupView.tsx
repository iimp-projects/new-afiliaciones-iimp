"use client";

import { 
  MoreVertical, 
  CheckCircle2, 
  Clock, 
  XCircle,
  MinusCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FilterX,
  ChevronDown
} from "lucide-react";

// ============================================================================
// DUMMY DATA (Basado exactamente en tu imagen)
// ============================================================================
const DUMMY_EXPEDIENTES = [
  {
    id: "1",
    photo: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=200&fit=crop&crop=faces",
    category: "ASOCIADO ACTIVO",
    categoryColor: "bg-[#e29b38]", // Dorado/Naranja
    name: "Carlos Alfredo Gonzales Mendoza",
    dni: "41000039",
    code: "APP-2026-0045",
    payment: { label: "PAGADO", icon: "check", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    validations: { log: "check", asi: "pending", com: "check", tes: "check" },
    time: "Hace 3 horas",
    assignee: { initial: "A", name: "ANA" }
  },
  {
    id: "2",
    photo: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=200&fit=crop&crop=faces",
    category: "ESTUDIANTE",
    categoryColor: "bg-[#3b82f6]", // Azul
    name: "Katherine Salazar Ramos",
    dni: "41000067",
    code: "APP-2026-0088",
    payment: { label: "PENDIENTE", icon: "clock", color: "text-amber-700 bg-amber-50 border-amber-200" },
    validations: { log: "check", asi: "check", com: "check", tes: "pending" },
    time: "Hace 14 min",
    assignee: { initial: "-", name: "SIN ASIGNAR" }
  },
  {
    id: "3",
    photo: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=200&fit=crop&crop=faces",
    category: "ASOCIADO ACTIVO",
    categoryColor: "bg-[#e29b38]",
    name: "Diego Alonso Vargas Huamán",
    dni: "41000047",
    code: "APP-2026-0102",
    payment: { label: "PAGADO", icon: "check", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    validations: { log: "check", asi: "check", com: "check", tes: "check" },
    time: "Hace 1 día",
    assignee: { initial: "D", name: "DIEGO" }
  },
  {
    id: "4",
    photo: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=200&fit=crop&crop=faces",
    category: "ESTUDIANTE",
    categoryColor: "bg-[#3b82f6]",
    name: "María Fernanda López Rojas",
    dni: "41000092",
    code: "APP-2026-0099",
    payment: { label: "OBSERVADO", icon: "error", color: "text-red-700 bg-red-50 border-red-200" },
    validations: { log: "check", asi: "check", com: "error", tes: "check" },
    time: "Hace 2 días",
    assignee: { initial: "M", name: "MARIA" }
  },
  {
    id: "5",
    photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=200&fit=crop&crop=faces",
    category: "ASOCIADO ACTIVO",
    categoryColor: "bg-[#e29b38]",
    name: "Renato Sebastián Cervantes Díaz",
    dni: "41000115",
    code: "APP-2026-0108",
    payment: { label: "PENDIENTE", icon: "clock", color: "text-amber-700 bg-amber-50 border-amber-200" },
    validations: { log: "check", asi: "pending", com: "check", tes: "dash" },
    time: "Hace 3 días",
    assignee: { initial: "T", name: "TÚ" }
  },
  {
    id: "6",
    photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=200&fit=crop&crop=faces",
    category: "ASOCIADO ACTIVO",
    categoryColor: "bg-[#e29b38]",
    name: "Jorge Luis Quispe Araujo",
    dni: "41000155",
    code: "APP-2026-0110",
    payment: { label: "OBSERVADO", icon: "error", color: "text-red-700 bg-red-50 border-red-200" },
    validations: { log: "check", asi: "error", com: "check", tes: "check" },
    time: "Hace 4 días",
    assignee: { initial: "J", name: "JORGE" }
  },
  {
    id: "7",
    photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=200&fit=crop&crop=faces",
    category: "ESTUDIANTE",
    categoryColor: "bg-[#3b82f6]",
    name: "Camila Antonella Rivas Paredes",
    dni: "41000186",
    code: "APP-2026-0111",
    payment: { label: "PENDIENTE", icon: "clock", color: "text-amber-700 bg-amber-50 border-amber-200" },
    validations: { log: "check", asi: "check", com: "check", tes: "pending" },
    time: "Hace 4 días",
    assignee: { initial: "C", name: "CAMILA" }
  },
  {
    id: "8",
    photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=200&fit=crop&crop=faces",
    category: "ASOCIADO ACTIVO",
    categoryColor: "bg-[#e29b38]",
    name: "Fernando Manuel Rojas Terán",
    dni: "41000210",
    code: "APP-2026-0112",
    payment: { label: "PAGADO", icon: "check", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    validations: { log: "check", asi: "check", com: "check", tes: "check" },
    time: "Hace 5 días",
    assignee: { initial: "F", name: "FERNANDO" }
  },
];

const FILTERS = [
  { label: "Estado", value: "Todos" },
  { label: "Categoría / Modalidad", value: "Todos" },
  { label: "Asignado a", value: "Todos" },
  { label: "Validado por Logística", value: "Todos" },
  { label: "Validado por Asociados", value: "Todos" },
  { label: "Validado por Comunicaciones", value: "Todos" },
  { label: "Ordenar por", value: "Más recientes" },
];

// ============================================================================
// MICRO-COMPONENTES
// ============================================================================
const FilterSelect = ({ label, value }: { label: string, value: string }) => (
  <div className="flex flex-col bg-white border border-slate-200 rounded-xl px-4 py-2 min-w-[160px] shadow-[0_2px_4px_rgba(0,0,0,0.02)] cursor-pointer hover:border-slate-300 transition-colors">
    <span className="text-[11px] font-bold text-slate-800 mb-0.5">{label}</span>
    <div className="flex items-center justify-between text-[13px] font-medium text-slate-500">
      <span>{value}</span>
      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>
);

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "check") return <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm"><CheckCircle2 size={14} className="text-white" strokeWidth={3} /></div>;
  if (status === "pending") return <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-sm"><Clock size={13} className="text-white" strokeWidth={3} /></div>;
  if (status === "error") return <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow-sm"><XCircle size={14} className="text-white" strokeWidth={3} /></div>;
  if (status === "dash") return <div className="w-5 h-5 rounded-full bg-slate-300 flex items-center justify-center shadow-sm"><MinusCircle size={14} className="text-white" strokeWidth={3} /></div>;
  return null;
};

// ============================================================================
// VISTA PRINCIPAL
// ============================================================================
export function ExpedientesMockupView() {
  return (
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col font-sans">
      
      {/* 1. HEADER (Copia fiel de la imagen) */}
      <header className="px-8 pt-8 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Expedientes de Afiliación</h1>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-emerald-600/30 rounded-xl shadow-sm text-[13px] font-bold text-emerald-700 hover:bg-emerald-50 transition-all">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Exportar a Excel
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-emerald-600/30 rounded-xl shadow-sm text-[13px] font-bold text-emerald-700 hover:bg-emerald-50 transition-all">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Exportar a CSV
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#4a6ab0]/30 rounded-xl shadow-sm text-[13px] font-bold text-[#4a6ab0] hover:bg-blue-50 transition-all ml-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            Ajustes de columnas
          </button>
        </div>
      </header>

      {/* 2. BARRA DE FILTROS */}
      <div className="px-8 pb-6 border-b border-slate-200/60 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full">
          {FILTERS.map((f, i) => (
            <FilterSelect key={i} label={f.label} value={f.value} />
          ))}
          <button className="flex flex-col items-center justify-center px-4 py-2 ml-auto text-slate-400 hover:text-slate-700 transition-colors">
            <FilterX size={20} strokeWidth={2} className="mb-1" />
            <span className="text-[11px] font-bold">Limpiar</span>
          </button>
        </div>
      </div>

      {/* 3. GRID DE CARDS (4 COLUMNAS COMO PEDISTE) */}
      <div className="flex-1 px-8 py-8 overflow-y-auto">
        {/* Aquí está el ajuste a 4 columnas: xl:grid-cols-4 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          
          {DUMMY_EXPEDIENTES.map((exp) => (
            <article 
              key={exp.id} 
              className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-slate-200/60 relative flex flex-col hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-slate-300 transition-all duration-300"
            >
              {/* Badge Flotante (Categoría) - Pegado arriba a la izquierda */}
              <div className={`absolute top-4 left-5 px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-widest text-white shadow-sm ${exp.categoryColor}`}>
                {exp.category}
              </div>

              {/* Botón Opciones */}
              <button className="absolute top-4 right-4 text-slate-300 hover:text-slate-600 transition-colors">
                <MoreVertical size={20} strokeWidth={2.5} />
              </button>

              {/* Foto + Identidad (Layout Horizontal) */}
              <div className="flex items-start gap-4 mt-8 mb-5">
                {/* Foto más rectangular y con mejor aspecto */}
                <div className="w-[72px] h-[90px] shrink-0 rounded-xl overflow-hidden shadow-sm border border-slate-100">
                  <img src={exp.photo} alt={exp.name} className="w-full h-full object-cover" />
                </div>
                
                <div className="flex flex-col pt-1">
                  <h3 className="text-[15px] font-black text-slate-800 leading-[1.2] mb-1.5 line-clamp-2">
                    {exp.name}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400 font-mono tracking-wide">
                    DNI • {exp.dni}
                  </p>
                  <p className="text-[11px] font-bold text-[#4a6ab0] font-mono tracking-wide mt-0.5">
                    {exp.code}
                  </p>
                </div>
              </div>

              {/* Estado de Pago */}
              <div className="mb-5">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${exp.payment.color}`}>
                  {exp.payment.icon === "check" && <CheckCircle2 size={14} strokeWidth={3} className="opacity-80" />}
                  {exp.payment.icon === "clock" && <Clock size={14} strokeWidth={3} className="opacity-80" />}
                  {exp.payment.icon === "error" && <XCircle size={14} strokeWidth={3} className="opacity-80" />}
                  {exp.payment.label}
                </span>
              </div>

              <hr className="border-slate-100 mb-4" />

              {/* Validaciones Atómicas */}
              <div className="grid grid-cols-4 gap-2 px-2 mb-5">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-extrabold text-slate-800 tracking-wider">LOG</span>
                  <StatusIcon status={exp.validations.log} />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-extrabold text-slate-800 tracking-wider">ASI</span>
                  <StatusIcon status={exp.validations.asi} />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-extrabold text-slate-800 tracking-wider">COM</span>
                  <StatusIcon status={exp.validations.com} />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-extrabold text-slate-800 tracking-wider">TES</span>
                  <StatusIcon status={exp.validations.tes} />
                </div>
              </div>

              {/* Pie de Card */}
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                <span className="text-[12px] font-bold text-slate-500 flex items-center gap-1.5">
                  <Clock size={14} className="text-slate-400" /> {exp.time}
                </span>
                
                <div className="flex items-center gap-2">
                  {exp.assignee.initial !== "-" && (
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600">
                      {exp.assignee.initial}
                    </div>
                  )}
                  <span className={`text-[11px] font-black tracking-widest uppercase ${exp.assignee.name === 'SIN ASIGNAR' ? 'text-slate-300' : 'text-slate-700'}`}>
                    {exp.assignee.name}
                  </span>
                </div>
              </div>

            </article>
          ))}
          
        </div>
      </div>

      {/* 4. PAGINACIÓN (Fiel a la imagen) */}
      <footer className="px-8 py-5 border-t border-slate-200/80 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-[13px] font-bold text-[#4a6ab0]">
          Mostrando 1 a 10 de 142 expedientes
        </span>
        
        <div className="flex items-center gap-1.5">
          <button className="p-2 text-[#4a6ab0] hover:bg-blue-50 rounded-lg font-black transition-colors"><ChevronsLeft size={16} strokeWidth={3}/></button>
          <button className="px-3 py-1.5 text-[13px] font-bold text-[#4a6ab0] hover:bg-blue-50 rounded-lg transition-colors">Inicio</button>
          <button className="p-2 text-[#4a6ab0] hover:bg-blue-50 rounded-lg font-black transition-colors"><ChevronLeft size={16} strokeWidth={3}/></button>
          
          <div className="flex items-center mx-1 gap-1">
            <button className="w-8 h-8 rounded-lg bg-[#e29b38] text-white text-[13px] font-bold shadow-sm">1</button>
            <button className="w-8 h-8 rounded-lg text-slate-700 text-[13px] font-bold hover:bg-slate-100 transition-colors">2</button>
            <button className="w-8 h-8 rounded-lg text-slate-700 text-[13px] font-bold hover:bg-slate-100 transition-colors">3</button>
            <button className="w-8 h-8 rounded-lg text-slate-700 text-[13px] font-bold hover:bg-slate-100 transition-colors">4</button>
            <button className="w-8 h-8 rounded-lg text-slate-700 text-[13px] font-bold hover:bg-slate-100 transition-colors">5</button>
            <span className="px-1 text-slate-400 font-bold tracking-widest">...</span>
            <button className="w-8 h-8 rounded-lg text-slate-700 text-[13px] font-bold hover:bg-slate-100 transition-colors">15</button>
          </div>

          <button className="p-2 text-[#4a6ab0] hover:bg-blue-50 rounded-lg font-black transition-colors"><ChevronRight size={16} strokeWidth={3}/></button>
          <button className="px-3 py-1.5 text-[13px] font-bold text-[#4a6ab0] hover:bg-blue-50 rounded-lg transition-colors">Final</button>
        </div>

        <div className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-xl bg-white shadow-sm cursor-pointer hover:border-slate-300 transition-colors">
          <span className="text-[13px] font-bold text-slate-700">10 por página</span>
          <ChevronDown size={16} className="text-slate-400" />
        </div>
      </footer>

    </div>
  );
}