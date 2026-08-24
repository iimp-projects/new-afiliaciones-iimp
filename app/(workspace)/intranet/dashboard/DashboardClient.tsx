"use client";
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Users, UserPlus, FileSearch, TrendingUp, Clock, AlertTriangle,
  CheckCircle2, MapPin, Activity, Plus, RefreshCcw, Briefcase,
  MoreHorizontal, TrendingDown, Calendar, Wallet, Download, Maximize2, X, Filter, BarChart3
} from "lucide-react";
import { fetchDashboardStats } from "@/modules/dashboard/Actions/dashboard.actions";
import Link from "next/link";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

// ==========================================
// CONFIGURACIÓN DE MAPAS D3.JS
// ==========================================
const PERU_GEOJSON_URL = "https://raw.githubusercontent.com/juaneladio/peru-geojson/master/peru_departamental_simple.geojson";
const WORLD_TOPOJSON_URL = "https://unpkg.com/world-atlas@2.0.2/countries-50m.json";

export function DashboardClient({ currentUser }: { currentUser: any }) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // ESTADOS DE FILTROS DEL GRÁFICO PRINCIPAL
  const [chartPeriod, setChartPeriod] = useState("6M"); // 6M, 1Y
  const [chartCategory, setChartCategory] = useState("ALL"); // ALL, PROF, EST

  // MAPA ESTADOS
  const [geoMode, setGeoMode] = useState<"PERU" | "INTL">("PERU");
  const [peruGeoData, setPeruGeoData] = useState<any>(null);
  const [worldGeoData, setWorldGeoData] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState("");

  // ESTADOS DE INTERACTIVIDAD (Tooltip y Modal)
  const [tooltip, setTooltip] = useState<{ x: number, y: number, name: string, count: number, percentage: number } | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch(PERU_GEOJSON_URL).then(res => res.json()).then(setPeruGeoData);
    fetch(WORLD_TOPOJSON_URL).then(res => res.json()).then(topo => {
      setWorldGeoData(topojson.feature(topo as any, (topo as any).objects.countries));
    });
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const res = await fetchDashboardStats();
    if (res.success) setData(res.data);
    setIsLoading(false);
    setCurrentTime(new Date().toLocaleDateString("es-PE", { day: '2-digit', month: 'short', year: 'numeric' }));
  };

  const handleExportMapCSV = () => {
    if (!data) return;
    const currentData = geoMode === "PERU" ? data.distribution.geoPeru : data.distribution.geoIntl;
    if (!currentData || currentData.length === 0) return alert("No hay datos geográficos para exportar.");
    let csv = "Region_Pais,Cantidad_Asociados\n";
    currentData.forEach((row: any) => { csv += `"${row.name}",${row.count}\n`; });
    downloadCSV(csv, `Reporte_Geografico_${geoMode}_IIMP.csv`);
  };

  const handleExportChartCSV = () => {
    if (!data) return;
    let csv = "Mes,Recibidos_Total,Profesionales,Estudiantes,Aprobados\n";
    data.monthlyTrend.forEach((row: any) => { 
        csv += `"${row.name}",${row.recibidos},${row.profesionales},${row.estudiantes},${row.aprobados}\n`; 
    });
    downloadCSV(csv, `Evolucion_Afiliaciones_IIMP.csv`);
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
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
        <p className="text-slate-500 font-bold animate-pulse">Sincronizando mapas e inteligencia de datos...</p>
      </div>
    );
  }

  const { kpis, recentActivity, requiresAttention, distribution, monthlyTrend } = data;

  // LOGICA DEL GRÁFICO (Filtrado de meses)
  const currentMonthIdx = new Date().getMonth();
  let chartDataFiltered = monthlyTrend;
  if (chartPeriod === "6M") {
     const startIdx = currentMonthIdx >= 5 ? currentMonthIdx - 5 : 0;
     chartDataFiltered = monthlyTrend.slice(startIdx, currentMonthIdx + 1);
  } else {
     chartDataFiltered = monthlyTrend.slice(0, currentMonthIdx + 1); // 1Y (Año actual hasta hoy)
  }

  // MAPA
  const currentDistribution = geoMode === "PERU" ? distribution.geoPeru : distribution.geoIntl;
  const totalGeoCount = currentDistribution.reduce((acc: number, curr: any) => acc + curr.count, 0);
  const maxGeoCount = currentDistribution.length > 0 ? Math.max(...currentDistribution.map((i: any) => i.count)) : 1;

  const mapWidth = 800;
  const mapHeight = 600;
  const activeGeoData = geoMode === "PERU" ? peruGeoData : worldGeoData;
  let pathGenerator: d3.GeoPath<any, d3.GeoPermissibleObjects> | null = null;
  if (activeGeoData) {
    const projection = d3.geoMercator().fitSize([mapWidth, mapHeight], activeGeoData);
    pathGenerator = d3.geoPath().projection(projection);
  }
  const colorScale = d3.scaleLinear<string>().domain([1, maxGeoCount]).range(["#e8d09e", "#4a2d00"]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  const renderMapSVG = (isExpanded: boolean = false) => (
    <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="w-full h-full object-contain drop-shadow-sm">
      <g>
        {activeGeoData?.features.map((geo: any, i: number) => {
          
          const normalize = (str: string) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() : "";
          const geoName = normalize(geoMode === "PERU" ? geo.properties.NOMBDEP : geo.properties.name);

          const foundRegion = currentDistribution.find((d: any) => {
            const dName = normalize(d.name);
            if (geoMode === "INTL") {
              if (dName === "ESTADOS UNIDOS" && geoName.includes("UNITED STATES")) return true;
              if (dName === "ESPANA" && geoName === "SPAIN") return true;
              if (dName === "REINO UNIDO" && geoName === "UNITED KINGDOM") return true;
              if (dName === "ALEMANIA" && geoName === "GERMANY") return true;
              if (dName === "BRASIL" && geoName === "BRAZIL") return true;
            }
            return dName === geoName || geoName.includes(dName);
          });

          const fillColor = foundRegion ? colorScale(foundRegion.count) : "#f1f5f9";
          const percentage = foundRegion && totalGeoCount > 0 ? Math.round((foundRegion.count / totalGeoCount) * 100) : 0;
          
          let centroidX = 0, centroidY = 0;
          if (isExpanded && pathGenerator) {
             const centroid = pathGenerator.centroid(geo);
             if (centroid && !isNaN(centroid[0])) {
               centroidX = centroid[0]; centroidY = centroid[1];
             }
          }

          return (
            <g key={`geo-group-${i}`}>
              <path
                d={pathGenerator!(geo) || ""}
                fill={fillColor}
                stroke="#ffffff"
                strokeWidth={geoMode === "PERU" ? (isExpanded ? 1.5 : 1) : 0.5}
                className="transition-all duration-300 outline-none hover:brightness-90 hover:stroke-[#c39254] hover:stroke-[2px] cursor-pointer"
                onMouseEnter={(e) => {
                  if (foundRegion) setTooltip({ x: e.clientX, y: e.clientY, name: geoName, count: foundRegion.count, percentage });
                  else setTooltip({ x: e.clientX, y: e.clientY, name: geoName, count: 0, percentage: 0 });
                }}
                onMouseMove={(e) => { if (tooltip) setTooltip(prev => ({ ...prev!, x: e.clientX, y: e.clientY })); }}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => !isExpanded && setIsMapExpanded(true)}
              />
              {isExpanded && centroidX > 0 && (geoMode === "PERU" || foundRegion) && (
                <text
                  x={centroidX} y={centroidY} textAnchor="middle" paintOrder="stroke"
                  stroke="#ffffff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  className={`pointer-events-none ${geoMode === "PERU" ? 'text-[9px]' : 'text-[12px]'} font-extrabold transition-all`}
                  fill={foundRegion ? "#1a1c1c" : "#94a3b8"}
                >
                  {geoMode === "PERU" ? geoName : geoName.substring(0, 15)}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );

  // Custom Tooltip para Recharts
  const CustomRechartsTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 text-white p-4 rounded-xl shadow-xl border border-slate-700">
          <p className="font-bold text-slate-300 mb-2 border-b border-slate-600 pb-1">{label} 2026</p>
          {payload.map((entry: any, index: number) => (
             <div key={index} className="flex items-center justify-between gap-4 text-sm mt-1">
                <span className="flex items-center gap-1.5">
                   <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
                   {entry.name}:
                </span>
                <span className="font-black text-[#e8d09e]">{entry.value}</span>
             </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* MODAL DE MAPA */}
      {mounted && isMapExpanded && createPortal(
        <div className="fixed inset-0 z-[99999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[1400px] h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 relative">
             <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
               <div>
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <MapPin className="text-[#c39254]" /> Mapa Geográfico Detallado
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Explora la distribución de tus afiliados a nivel {geoMode === "PERU" ? "nacional" : "mundial"}.</p>
               </div>
               <div className="flex items-center gap-4">
                 <button onClick={handleExportMapCSV} className="px-4 py-2 bg-white text-slate-600 border border-slate-200 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm">
                    <Download size={16} /> Exportar CSV
                 </button>
                 <button onClick={() => setIsMapExpanded(false)} className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 hover:text-red-700 transition-colors"><X size={24} /></button>
               </div>
             </div>

             <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#f8f9fa] relative">
                <div className="absolute top-6 left-1/2 lg:left-[calc(50%-160px)] -translate-x-1/2 z-10 flex bg-white rounded-xl p-1.5 shadow-lg border border-slate-100">
                  <button onClick={() => setGeoMode("PERU")} className={`text-sm font-black px-8 py-2 rounded-lg transition-all ${geoMode === "PERU" ? "bg-[#c39254] text-white shadow-md" : "text-slate-500 hover:text-slate-800"}`}>PERÚ</button>
                  <button onClick={() => setGeoMode("INTL")} className={`text-sm font-black px-8 py-2 rounded-lg transition-all ${geoMode === "INTL" ? "bg-[#c39254] text-white shadow-md" : "text-slate-500 hover:text-slate-800"}`}>INTL</button>
                </div>

                <div className="flex-1 p-8 flex items-center justify-center overflow-hidden">
                   {!activeGeoData ? <div className="animate-spin w-12 h-12 border-4 border-[#c39254] border-t-transparent rounded-full"></div> : renderMapSVG(true)}
                </div>

                <div className="w-full lg:w-96 bg-white border-l border-slate-200 p-6 flex flex-col shrink-0">
                   <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Top Regiones</h3>
                   <div className="flex-1 overflow-y-auto space-y-5 pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                    {currentDistribution.length > 0 ? (
                      currentDistribution.map((loc: any, idx: number) => {
                        const truePercentage = totalGeoCount > 0 ? Math.round((loc.count / totalGeoCount) * 100) : 0;
                        const visualWidth = maxGeoCount > 0 ? Math.round((loc.count / maxGeoCount) * 100) : 0;
                        return (
                          <div key={idx} className="w-full">
                            <div className="flex justify-between items-end mb-1.5">
                              <span className="text-sm font-bold text-slate-700 capitalize truncate">{loc.name.toLowerCase()} <span className="text-slate-400 font-medium text-xs ml-1">({loc.count})</span></span>
                              <span className="text-sm font-black text-[#7f561e]">{truePercentage}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div className="bg-gradient-to-r from-[#dca45c] to-[#7f561e] h-2 rounded-full" style={{ width: `${visualWidth}%` }}></div>
                            </div>
                          </div>
                        );
                      })
                    ) : <div className="text-center text-slate-400 text-sm py-4">No hay datos registrados.</div>}
                  </div>
                </div>
             </div>
          </div>
        </div>,
        document.body
      )}

      {/* TOOLTIP DEL MAPA */}
      {mounted && tooltip && createPortal(
        <div className="fixed z-[999999] bg-slate-800 text-white px-4 py-2.5 rounded-xl shadow-2xl pointer-events-none transform -translate-x-1/2 -translate-y-[130%]" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{tooltip.name}</div>
          <div className="flex items-center gap-3">
             <div className="text-[16px] font-bold text-[#e8d09e]">{tooltip.count} <span className="text-xs font-medium text-slate-300">asociados</span></div>
             <div className="px-2 py-0.5 bg-slate-700 rounded text-xs font-bold">{tooltip.percentage}%</div>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>,
        document.body
      )}

      {/* HEADER NORMAL */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-[22px] font-black text-slate-800 tracking-tight">
             {greeting}, {currentUser?.person.firstName}! 
           </h1>
          <p className="text-[13px] font-medium text-slate-500 mt-1">Métricas y estado general de la plataforma de afiliaciones.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-[12px] font-bold text-slate-600">
            <Calendar size={16} className="text-[#c39254]" /> Actualizado el {currentTime}
          </div>
          <button onClick={loadData} className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-[#c39254] hover:bg-slate-50 rounded-md transition-all shadow-sm">
            <RefreshCcw size={16} />
          </button>
          <Link href="/intranet/expedientes" className="px-5 py-2.5 bg-gradient-to-r from-[#7f561e] to-[#c39254] hover:brightness-110 text-white text-[13px] font-bold rounded-md shadow-md transition-all flex items-center gap-2">
            <Plus size={16} strokeWidth={3} /> Nuevo Expediente
          </Link>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <VelzonKpiCard title="ASOCIADOS ACTIVOS" value={kpis.totalAssociates.toLocaleString()} trend="+12.5 %" trendUp={true} linkText="Ver lista completa" icon={Users} colorClass="text-[#c39254] bg-[#c39254]/10" />
        <VelzonKpiCard title="NUEVAS AFILIACIONES" value={kpis.newAffiliations.toLocaleString()} trend="-2.1 %" trendUp={false} linkText="Ver todas las solicitudes" icon={UserPlus} colorClass="text-[#7f561e] bg-[#7f561e]/10" />
        <VelzonKpiCard title="EXPEDIENTES PENDIENTES" value={kpis.pendingAppsCount.toLocaleString()} trend="+5.8 %" trendUp={true} linkText="Ver detalles de evaluación" icon={FileSearch} colorClass="text-amber-500 bg-amber-50" />
        <VelzonKpiCard title="TASA DE APROBACIÓN" value={`${kpis.approvalRate}%`} trend="+1.2 %" trendUp={true} linkText="Historial de aprobaciones" icon={Wallet} colorClass="text-slate-600 bg-slate-100" />
      </div>

      {/* MAIN GRID (GRÁFICO AVANZADO Y MAPA) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 
        {/* GRÁFICO COMPUESTO AVANZADO (Tendencia Mensual) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-wrap gap-4 justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-3">
                <BarChart3 className="text-[#c39254]" size={20} />
                <div>
                    <h3 className="text-[15px] font-bold text-slate-800">Evolución de Afiliaciones</h3>
                    <p className="text-[11px] font-medium text-slate-500">Tendencia mensual de ingresos y aprobaciones</p>
                </div>
            </div>
                         
            <div className="flex items-center gap-3">
              {/* Filtro Categoría */}
              <select 
                value={chartCategory} onChange={(e) => setChartCategory(e.target.value)}
                className="h-8 px-2 rounded-md border border-slate-200 text-[11px] font-bold text-slate-600 bg-white focus:outline-none focus:border-[#c39254] cursor-pointer shadow-sm"
              >
                <option value="ALL">Todas las categorías</option>
                <option value="PROF">Profesionales</option>
                <option value="EST">Estudiantes</option>
              </select>

              {/* Filtro Tiempo tipo Pastilla */}
              <div className="flex bg-slate-200/50 rounded p-0.5 shadow-inner">
                <button onClick={() => setChartPeriod("6M")} className={`px-4 py-1 text-[11px] font-black rounded transition-all ${chartPeriod === "6M" ? "bg-white text-[#7f561e] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>6M</button>
                <button onClick={() => setChartPeriod("1Y")} className={`px-4 py-1 text-[11px] font-black rounded transition-all ${chartPeriod === "1Y" ? "bg-white text-[#7f561e] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>1Y</button>
              </div>

              {/* Exportar */}
              <button onClick={handleExportChartCSV} className="p-1.5 bg-white text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-sm" title="Exportar datos del gráfico">
                <Download size={14} />
              </button>
            </div>
          </div>
                     
          {/* Dashboard Summary Numbers inside the chart */}
          <div className="px-6 pt-5 pb-2 flex gap-8">
              <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Recibidos</p>
                  <p className="text-2xl font-black text-slate-800">{chartDataFiltered.reduce((a:any, b:any) => a + b.recibidos, 0)}</p>
              </div>
              <div className="w-px bg-slate-100"></div>
              <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Aprobados</p>
                  <p className="text-2xl font-black text-[#15a3a4]">{chartDataFiltered.reduce((a:any, b:any) => a + b.aprobados, 0)}</p>
              </div>
          </div>

          <div className="p-6 pt-0 flex-1 relative min-h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartDataFiltered} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaeaea" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                <YAxis yAxisId="left" domain={[0, 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} />
                <RechartsTooltip content={<CustomRechartsTooltip />} cursor={{ fill: '#f8f9fa' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#64748b', paddingTop: '20px' }} />
                                 
                {/* Barras Apiladas (Condicionales según el filtro) */}
                {(chartCategory === "ALL" || chartCategory === "PROF") && (
                   <Bar yAxisId="left" dataKey="profesionales" name="Asoc. Activos" stackId="a" fill="#c39254" barSize={30} radius={chartCategory === "PROF" ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                )}
                {(chartCategory === "ALL" || chartCategory === "EST") && (
                   <Bar yAxisId="left" dataKey="estudiantes" name="Estudiantes" stackId="a" fill="#e8d09e" barSize={30} radius={[4, 4, 0, 0]} />
                )}
                                 
                {/* Línea de Rendimiento (Aprobados) */}
                <Line yAxisId="left" type="monotone" dataKey="aprobados" name="Aprobados" stroke="#15a3a4" strokeWidth={3} dot={{ r: 4, fill: '#15a3a4', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, fill: '#15a3a4' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* MAPA COROPLÉTICO PEQUEÑO */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col relative overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
              <MapPin size={18} className="text-[#c39254]"/> Distribución Geográfica
            </h3>
          </div>
                     
          <div className="p-6 flex-1 flex flex-col">
            <div 
               onClick={() => setIsMapExpanded(true)}
              className="w-full h-[350px] bg-[#f8f9fa] rounded-xl mb-6 overflow-hidden border border-slate-100 relative shadow-inner group cursor-pointer shrink-0"
            >
               <div className="absolute inset-0 bg-[#c39254]/10 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  <span className="bg-white text-[#7f561e] font-bold text-xs px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
                    <Maximize2 size={16} /> Abrir Mapa Interactivo
                  </span>
               </div>
               {!activeGeoData ? <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium text-sm">Cargando mapa...</div> : renderMapSVG(false)}
            </div>

            <div className="flex justify-center items-center mb-6">
               <div className="flex bg-slate-100 rounded-lg p-1 shadow-inner">
                  <button onClick={() => setGeoMode("PERU")} className={`text-[11px] font-black px-6 py-1.5 rounded-md transition-all ${geoMode === "PERU" ? "bg-white text-[#7f561e] shadow-sm" : "text-slate-400"}`}>PERÚ</button>
                  <button onClick={() => setGeoMode("INTL")} className={`text-[11px] font-black px-6 py-1.5 rounded-md transition-all ${geoMode === "INTL" ? "bg-white text-[#7f561e] shadow-sm" : "text-slate-400"}`}>INTL</button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-32 space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-200">
              {currentDistribution.length > 0 ? (
                currentDistribution.slice(0, 3).map((loc: any, idx: number) => {
                  const truePercentage = totalGeoCount > 0 ? Math.round((loc.count / totalGeoCount) * 100) : 0;
                  const visualWidth = maxGeoCount > 0 ? Math.round((loc.count / maxGeoCount) * 100) : 0;

                  return (
                    <div key={idx} className="w-full">
                      <div className="flex justify-between items-end text-[12px] font-bold text-slate-700 mb-1.5">
                        <span className="truncate pr-2 capitalize">{loc.name.toLowerCase()} <span className="text-slate-400 font-medium text-[10px] ml-1">({loc.count})</span></span>
                        <span className="text-[#7f561e]">{truePercentage}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-gradient-to-r from-[#dca45c] to-[#7f561e] h-1.5 rounded-full transition-all duration-1000" style={{ width: `${visualWidth}%` }}></div>
                      </div>
                    </div>
                  );
                })
              ) : <div className="text-center text-slate-400 text-sm py-4 font-medium">No hay datos registrados.</div>}
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
            ) : <p className="pl-4 text-[12px] font-medium text-slate-400">No hay actividad reciente.</p>}
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
            ) : <div className="text-center text-slate-400 text-sm py-8 font-medium">Aún no hay perfiles registrados.</div>}
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