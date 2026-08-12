"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Users, UserPlus, FileSearch, TrendingUp, Clock, AlertTriangle, 
  CheckCircle2, Activity, Plus, RefreshCcw, Briefcase,
  MoreHorizontal, TrendingDown, Calendar, Wallet, Download, Map as MapIcon
} from "lucide-react";
import { fetchDashboardStats } from "@/modules/dashboard/Actions/dashboard.actions";
import Link from "next/link";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

// ==========================================
// CONFIGURACIÓN DE MAPAS
// ==========================================
const PERU_GEOJSON_URL = "https://raw.githubusercontent.com/juaneladio/peru-geojson/master/peru_departamental_simple.geojson";
const WORLD_TOPOJSON_URL = "https://unpkg.com/world-atlas@2.0.2/countries-50m.json";

export function DashboardClient({ currentUser }: { currentUser: any }) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estados para los mapas
  const [geoMode, setGeoMode] = useState<"PERU" | "INTL">("PERU");
  const [peruGeoData, setPeruGeoData] = useState<any>(null);
  const [worldGeoData, setWorldGeoData] = useState<any>(null);
  
  // Tooltip interactivo del mapa
  const [tooltip, setTooltip] = useState<{ x: number, y: number, name: string, count: number } | null>(null);
  const [currentTime, setCurrentTime] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    const res = await fetchDashboardStats();
    if (res.success) setData(res.data);
    setIsLoading(false);
    
    const now = new Date();
    setCurrentTime(now.toLocaleDateString("es-PE", { day: '2-digit', month: 'short', year: 'numeric' }));
  };

  useEffect(() => {
    // Cargamos los datos vectoriales para los mapas
    fetch(PERU_GEOJSON_URL).then(res => res.json()).then(setPeruGeoData);
    fetch(WORLD_TOPOJSON_URL).then(res => res.json()).then(topo => {
      setWorldGeoData(topojson.feature(topo as any, (topo as any).objects.countries));
    });
    loadData();
  }, []);

  const handleExportCSV = () => {
    if (!data) return;
    const currentData = geoMode === "PERU" ? data.distribution.geoPeru : data.distribution.geoIntl;
    if (!currentData || currentData.length === 0) return alert("No hay datos geográficos para exportar.");

    let csv = "Region/Pais,Cantidad_Asociados\n";
    currentData.forEach((row: any) => { csv += `"${row.name}",${row.count}\n`; });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Reporte_Geografico_${geoMode}_IIMP.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatStatusName = (status: string) => {
    const statusMap: Record<string, string> = {
      DRAFT: "Borrador", PENDING: "Pendiente", UNDER_EVALUACION: "En Evaluación",
      OBSERVED: "Observado", RESOLVED: "Subsanado", READY_FOR_PAYMENT: "Apto para Pago",
      COMPLETED: "Completado", REJECTED: "Rechazado", APPROVED: "Aprobado",
    };
    return statusMap[status?.toUpperCase().trim()] || status;
  };

  if (isLoading || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] space-y-4">
        <div className="animate-spin w-12 h-12 border-4 border-[#c39254] border-t-transparent rounded-full"></div>
        <p className="text-slate-500 font-bold animate-pulse">Sincronizando y renderizando mapas...</p>
      </div>
    );
  }

  const { kpis, flow, recentActivity, requiresAttention, distribution } = data;
  
  // Data actual para el mapa y las barras
  const currentDistribution = geoMode === "PERU" ? distribution.geoPeru : distribution.geoIntl;
  const totalGeoCount = currentDistribution.reduce((acc: number, curr: any) => acc + curr.count, 0);
  const maxGeoCount = currentDistribution.length > 0 ? Math.max(...currentDistribution.map((i: any) => i.count)) : 1;

  // Generador D3 para el Mapa (Auto-encuadre perfecto)
  const width = 800;
  const height = 500;
  const activeGeoData = geoMode === "PERU" ? peruGeoData : worldGeoData;
  let pathGenerator: d3.GeoPath<any, d3.GeoPermissibleObjects> | null = null;
  
  if (activeGeoData) {
    const projection = d3.geoMercator().fitSize([width, height], activeGeoData);
    pathGenerator = d3.geoPath().projection(projection);
  }

  // Escala de colores (Del gris claro al dorado oscuro IIMP)
  const colorScale = d3.scaleLinear<string>()
    .domain([0, maxGeoCount])
    .range(["#f1f5f9", "#7f561e"]); // Slate-100 to IIMP Primary

  const chartData = [
    { name: "Nuevos", expedientes: (flow.DRAFT || 0) + (flow.PENDING || 0) },
    { name: "Evaluación", expedientes: flow.UNDER_EVALUACION || 0 },
    { name: "Observados", expedientes: flow.OBSERVED || 0 },
    { name: "Aptos/Pago", expedientes: flow.READY_FOR_PAYMENT || 0 },
    { name: "Completados", expedientes: flow.COMPLETED || 0 },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* 1. HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-[22px] font-black text-slate-800 tracking-tight">
             {greeting}, {currentUser?.person.firstName}!
           </h1>
          <p className="text-[13px] font-medium text-slate-500 mt-1">
            Métricas y estado general de la plataforma de afiliaciones.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-[12px] font-bold text-slate-600">
            <Calendar size={16} className="text-[#c39254]" />
            Actualizado el {currentTime}
          </div>
          <button onClick={loadData} className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-[#c39254] hover:bg-slate-50 rounded-md transition-all shadow-sm">
            <RefreshCcw size={16} />
          </button>
          <Link href="/intranet/expedientes" className="px-5 py-2.5 bg-gradient-to-r from-[#7f561e] to-[#c39254] hover:brightness-110 text-white text-[13px] font-bold rounded-md shadow-md transition-all flex items-center gap-2">
            <Plus size={16} strokeWidth={3} /> Nuevo Expediente
          </Link>
        </div>
      </div>

      {/* 2. KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <VelzonKpiCard 
          title="ASOCIADOS ACTIVOS" value={kpis.totalAssociates.toLocaleString()} 
          trend="+12.5 %" trendUp={true} linkText="Ver lista completa" icon={Users} 
          colorClass="text-[#c39254] bg-[#c39254]/10" 
        />
        <VelzonKpiCard 
          title="NUEVAS AFILIACIONES" value={kpis.newAffiliations.toLocaleString()} 
          trend="-2.1 %" trendUp={false} linkText="Ver todas las solicitudes" icon={UserPlus} 
          colorClass="text-[#7f561e] bg-[#7f561e]/10" 
        />
        <VelzonKpiCard 
          title="EXPEDIENTES PENDIENTES" value={kpis.pendingAppsCount.toLocaleString()} 
          trend="+5.8 %" trendUp={true} linkText="Ver detalles de evaluación" icon={FileSearch} 
          colorClass="text-amber-500 bg-amber-50" 
        />
        <VelzonKpiCard 
          title="TASA DE APROBACIÓN" value={`${kpis.approvalRate}%`} 
          trend="+1.2 %" trendUp={true} linkText="Historial de aprobaciones" icon={Wallet} 
          colorClass="text-slate-600 bg-slate-100" 
        />
      </div>

      {/* 3. MAIN GRID (Gráficos interactivos y MAPA COROPLÉTICO) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRÁFICO RECHARTS */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-[15px] font-bold text-slate-800">Flujo de Evaluación</h3>
            <div className="flex bg-slate-200/50 rounded p-0.5">
              <button className="px-3 py-1 text-[11px] font-bold text-slate-500 rounded">1M</button>
              <button className="px-3 py-1 text-[11px] font-bold bg-white text-[#7f561e] shadow-sm rounded">6M</button>
              <button className="px-3 py-1 text-[11px] font-bold text-slate-500 rounded">1Y</button>
            </div>
          </div>
          
          <div className="p-6 flex-1 relative min-h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorExpedientes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c39254" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#c39254" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaeaea" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                  itemStyle={{ color: '#7f561e' }}
                />
                <Area type="monotone" dataKey="expedientes" stroke="#c39254" strokeWidth={3} fillOpacity={1} fill="url(#colorExpedientes)" activeDot={{ r: 6, fill: '#7f561e', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* MAPA COROPLÉTICO INTERACTIVO (D3.JS NATIVO) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col relative overflow-visible">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
              <MapIcon size={18} className="text-[#c39254]"/> Distribución Geográfica
            </h3>
            <button onClick={handleExportCSV} className="px-3 py-1.5 bg-white text-slate-600 border border-slate-200 text-[11px] font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-sm">
              <Download size={14} /> Exportar
            </button>
          </div>
          
          <div className="p-6 flex-1 flex flex-col">
            
            {/* Contenedor del Mapa D3 */}
            <div className="w-full h-64 bg-[#f8f9fa] rounded-xl mb-6 overflow-hidden border border-slate-100 relative shadow-inner">
               {!activeGeoData ? (
                 <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium text-sm">Cargando mapa...</div>
               ) : (
                 <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full object-contain">
                   <g>
                      {activeGeoData.features.map((geo: any, i: number) => {
                        // Extraemos el nombre dependiendo si es Perú o el Mundo
                        const geoName = (geoMode === "PERU" ? geo.properties.NOMBDEP : geo.properties.name)?.toUpperCase() || "";
                        // Buscamos si tenemos afiliados en esa región
                        const foundRegion = currentDistribution.find((d: any) => d.name === geoName || geoName.includes(d.name));
                        // Aplicamos el color basado en la cantidad (Coropleta)
                        const fillColor = foundRegion ? colorScale(foundRegion.count) : "#e2e8f0";

                        return (
                          <path
                            key={`geo-${i}`}
                            d={pathGenerator!(geo) || ""}
                            fill={fillColor}
                            stroke="#ffffff"
                            strokeWidth={geoMode === "PERU" ? 1.5 : 0.5}
                            className="transition-all duration-300 outline-none cursor-pointer hover:brightness-90"
                            onMouseEnter={(e) => {
                              if (foundRegion) {
                                setTooltip({ x: e.clientX, y: e.clientY, name: geoName, count: foundRegion.count });
                              }
                            }}
                            onMouseMove={(e) => {
                               if (tooltip) setTooltip(prev => ({ ...prev!, x: e.clientX, y: e.clientY }));
                            }}
                            onMouseLeave={() => setTooltip(null)}
                          />
                        );
                      })}
                   </g>
                 </svg>
               )}
            </div>

            {/* Tooltip HTML Flotante para el Mapa */}
            {tooltip && (
              <div 
                className="fixed z-[100] bg-slate-800 text-white px-4 py-2 rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-[120%]"
                style={{ left: tooltip.x, top: tooltip.y }}
              >
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-300">{tooltip.name}</div>
                <div className="text-[14px] font-bold text-[#e8d09e]">{tooltip.count} asociados</div>
                {/* Triangulito del Tooltip */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
              </div>
            )}

            <div className="flex justify-center items-center mb-6">
               <div className="flex bg-slate-100 rounded-lg p-1 shadow-inner">
                  <button onClick={() => setGeoMode("PERU")} className={`text-[11px] font-black px-8 py-2 rounded-md transition-all ${geoMode === "PERU" ? "bg-white text-[#7f561e] shadow-sm" : "text-slate-400"}`}>PERÚ</button>
                  <button onClick={() => setGeoMode("INTL")} className={`text-[11px] font-black px-8 py-2 rounded-md transition-all ${geoMode === "INTL" ? "bg-white text-[#7f561e] shadow-sm" : "text-slate-400"}`}>INTL</button>
               </div>
            </div>

            {/* Listado de progreso Matemáticamente Correcto */}
            <div className="flex-1 overflow-y-auto max-h-48 space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-200">
              {currentDistribution.length > 0 ? (
                // Mostramos top 6 para no saturar
                currentDistribution.slice(0, 6).map((loc: any, idx: number) => {
                  // Porcentaje Real del total
                  const truePercentage = totalGeoCount > 0 ? Math.round((loc.count / totalGeoCount) * 100) : 0;
                  // Porcentaje Visual relativo al mayor para que las barras se vean bien
                  const visualWidth = maxGeoCount > 0 ? Math.round((loc.count / maxGeoCount) * 100) : 0;
                  
                  return (
                    <div key={idx} className="w-full">
                      <div className="flex justify-between text-[12px] font-bold text-slate-700 mb-1.5">
                        <span className="truncate pr-2 capitalize">{loc.name.toLowerCase()} <span className="text-slate-400 font-medium ml-1">({loc.count})</span></span>
                        <span className="text-[#7f561e]">{truePercentage}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-gradient-to-r from-[#dca45c] to-[#7f561e] h-2 rounded-full transition-all duration-1000" style={{ width: `${visualWidth}%` }}></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-slate-400 text-sm py-4 font-medium">No hay datos registrados en esta vista.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. SECCIÓN INFERIOR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
             <h3 className="text-[15px] font-bold text-slate-800">Actividad Reciente</h3>
             <MoreHorizontal size={18} className="text-slate-400 cursor-pointer hover:text-[#c39254]" />
          </div>
          <div className="relative border-l-2 border-slate-100 ml-3 space-y-6">
            {recentActivity.length > 0 ? (
              recentActivity.map((act: any, idx: number) => {
                const isSuccess = act.newStatus === "APPROVED" || act.newStatus === "COMPLETED";
                const color = isSuccess ? "bg-emerald-500" : act.newStatus === "OBSERVED" ? "bg-amber-500" : "bg-[#c39254]";
                return (
                  <div key={idx} className="relative pl-5">
                    <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-[3px] border-white shadow-sm ${color}`}></div>
                    <p className="text-[13px] font-bold text-slate-800">{formatStatusName(act.newStatus)}</p>
                    <p className="text-[12px] text-slate-500 mt-0.5 truncate">
                      Exp. <span className="text-[#c39254] font-bold">{act.application.applicationCode}</span> - {act.application.person?.firstName}
                    </p>
                    <span className="text-[10px] font-bold text-slate-400 mt-1 block">
                      {new Date(act.createdAt).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="pl-4 text-[12px] font-medium text-slate-400">No hay actividad reciente.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
             <h3 className="text-[15px] font-bold text-slate-800">Requiere Atención</h3>
             <span className="bg-red-50 text-red-600 text-[10px] font-black px-2.5 py-1 rounded-md border border-red-100">{requiresAttention.length} urgentes</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {requiresAttention.length > 0 ? (
              <ul className="space-y-3">
                {requiresAttention.map((task: any, idx: number) => (
                  <li key={idx} className="p-3 border border-slate-100 hover:border-[#c39254]/50 hover:bg-[#fffdf8] rounded-xl transition-all flex justify-between items-center group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100 group-hover:bg-[#c39254]/10 group-hover:border-[#c39254]/30 transition-colors">
                         <AlertTriangle size={14} className="text-amber-500 group-hover:text-[#7f561e]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-700 truncate group-hover:text-[#7f561e] transition-colors">{task.application.applicationCode}</p>
                        <p className="text-[11px] font-medium text-slate-500 truncate">Área: {task.department.name}</p>
                      </div>
                    </div>
                    <Link href="/intranet/expedientes" className="text-[11px] font-bold text-[#7f561e] bg-[#c39254]/10 hover:bg-[#c39254]/20 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                      Revisar
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center p-8 text-slate-400 text-sm font-medium">
                <CheckCircle2 size={32} className="mx-auto mb-3 text-emerald-400 opacity-50" />
                No hay tareas pendientes en tu área.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
           <div className="flex justify-between items-center mb-6">
             <h3 className="text-[15px] font-bold text-slate-800">Perfil Profesional</h3>
             <MoreHorizontal size={18} className="text-slate-400 cursor-pointer hover:text-[#c39254]" />
          </div>
          <div className="space-y-5">
            {distribution.specialties.length > 0 ? (
              distribution.specialties.map((spec: any, idx: number) => {
                const total = distribution.specialties.reduce((acc: number, curr: any) => acc + curr.count, 0);
                const pct = ((spec.count / total) * 100).toFixed(1);
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                       <Briefcase size={14} className="text-[#c39254]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-[12px] font-bold text-slate-700 mb-1">
                         <span className="truncate pr-2">{spec.name}</span>
                         <span className="text-[#7f561e]">{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-gradient-to-r from-[#dca45c] to-[#7f561e] h-1.5 rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-slate-400 text-sm py-8 font-medium">Aún no hay perfiles registrados.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function VelzonKpiCard({ title, value, trend, trendUp, linkText, icon: Icon, colorClass }: any) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_-15px_rgba(127,86,30,0.2)] group">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{title}</h4>
        <span className={`text-[11px] font-bold flex items-center gap-1 ${trendUp ? 'text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md' : 'text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md'}`}>
          {trendUp ? <TrendingUp size={12} strokeWidth={3} /> : <TrendingDown size={12} strokeWidth={3} />}
          {trend}
        </span>
      </div>
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-800 mb-1 tracking-tight group-hover:text-[#7f561e] transition-colors">{value}</h2>
          <p className="text-[11px] font-bold text-slate-400 hover:text-[#c39254] underline decoration-slate-200 hover:decoration-[#c39254] underline-offset-4 cursor-pointer transition-colors">
            {linkText}
          </p>
        </div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border border-transparent shadow-sm ${colorClass}`}>
          <Icon size={24} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}