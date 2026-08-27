"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Users, UserPlus, FileSearch, TrendingUp, Clock, AlertTriangle,
  CheckCircle2, MapPin, Activity, Plus, RefreshCcw, Briefcase, Info,
  MoreHorizontal, TrendingDown, Calendar, Wallet, Download, Maximize2, X, Filter, ChevronDown
} from "lucide-react";
import { fetchDashboardStats } from "@/modules/dashboard/Actions/dashboard.actions";
import { fetchAreaActivityAction } from "@/modules/dashboard/Actions/area-activity.actions";
import Link from "next/link";
import { ComposedChart, Bar, Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

const PERU_GEOJSON_URL = "https://raw.githubusercontent.com/juaneladio/peru-geojson/master/peru_departamental_simple.geojson";
const WORLD_TOPOJSON_URL = "https://unpkg.com/world-atlas@2.0.2/countries-50m.json";
const lineColors = ['#c39254', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

// ==========================================
// COMPONENTE: CUSTOM DROPDOWN (Dorado IIMP)
// ==========================================
const DashboardDropdown = ({ value, options, onChange, disabled = false, className = "" }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o: any) => o.value === value) || options[0];

  return (
    <div className={`relative min-w-[170px] ${className}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-9 px-3 border border-slate-200 rounded-lg text-[13px] font-bold transition-all flex items-center justify-between outline-none ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : isOpen ? 'border-[#C5A059] ring-2 ring-[#C5A059]/20 bg-white text-slate-800' : 'bg-white text-slate-600 hover:border-[#C5A059] hover:bg-[#fdfaf5]'}`}
      >
        <span className="truncate pr-2">{selectedOption?.label}</span>
        <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#C5A059]' : 'text-slate-400'}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-100 rounded-xl shadow-[0_15px_40px_-10px_rgba(0,0,0,0.15)] z-[100] py-1 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 scrollbar-thin scrollbar-thumb-slate-200">
          {options.map((opt: any) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              className={`w-full text-left px-3 py-2 text-[13px] font-semibold transition-colors outline-none ${
                value === opt.value
                  ? "bg-[#C5A059]/10 text-[#C5A059] border-l-2 border-[#C5A059]"
                  : "text-slate-600 hover:bg-[#fdfaf5] hover:text-[#C5A059] border-l-2 border-transparent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ✅ AQUÍ ESTÁ EL ARREGLO: Se llama DashboardWorkspace en lugar de DashboardClient
export function DashboardWorkspace({ currentUser }: { currentUser: any }) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // LÓGICA DE ROLES PARA FILTRO DE ÁREAS
  const userRole = currentUser?.role?.slug || "";
  const isAdmin = ["SUPER_ADMIN", "SYSTEM_ADMIN", "GERENCIA_GENERAL", "AUDITOR"].includes(userRole);
  
  const OpcionesAreas = isAdmin ? [
    { value: "Todos", label: "Todas las áreas" },
    { value: "Asociados", label: "Atención al Asociado" },
    { value: "Logistica", label: "Logística" },
    { value: "Comite", label: "Comité Evaluador" },
    { value: "Legal", label: "Asesoría Legal" },
    { value: "Comunicaciones", label: "Comunicaciones" }
  ] : [
    { value: userRole === "LOGISTICA" ? "Logistica" : userRole === "COMITE_EVALUADOR" ? "Comite" : "Asociados", label: "Mi Área Asignada" }
  ];

  // ESTADOS
  const [chartArea, setChartArea] = useState(OpcionesAreas[0].value);
  const [chartPeriod, setChartPeriod] = useState("Últimos 30 días");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [chartStatus, setChartStatus] = useState("Todos");
  const [chartAggregation, setChartAggregation] = useState("Diario");
  const [selectedResponsable, setSelectedResponsable] = useState<number | null>(null);

  const [areaData, setAreaData] = useState<{ responsables: any[], dailyActivity: any[] }>({ responsables: [], dailyActivity: [] });
  const [isLoadingArea, setIsLoadingArea] = useState(true);

  // MAPA
  const [geoMode, setGeoMode] = useState<"PERU" | "INTL">("PERU");
  const [peruGeoData, setPeruGeoData] = useState<any>(null);
  const [worldGeoData, setWorldGeoData] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState("");
  const [tooltip, setTooltip] = useState<{ x: number, y: number, name: string, count: number, percentage: number } | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch(PERU_GEOJSON_URL).then(res => res.json()).then(setPeruGeoData);
    fetch(WORLD_TOPOJSON_URL).then(res => res.json()).then(topo => { setWorldGeoData(topojson.feature(topo as any, (topo as any).objects.countries)); });
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const res = await fetchDashboardStats();
    if (res.success) setData(res.data);
    setIsLoading(false);
    setCurrentTime(new Date().toLocaleDateString("es-PE", { day: '2-digit', month: 'short', year: 'numeric' }));
  };

  useEffect(() => {
    const loadAreaActivity = async () => {
      if (chartPeriod === "Personalizado" && (!dateFrom || !dateTo)) return;

      setIsLoadingArea(true);
      const res = await fetchAreaActivityAction({
        areaFilter: chartArea,
        periodFilter: chartPeriod,
        aggregation: chartAggregation,
        dateFrom,
        dateTo
      });
      
      if (res.success && res.data) {
        setAreaData(res.data);
        if (res.data.responsables.length > 0 && selectedResponsable === null) {
           setSelectedResponsable(res.data.responsables[0].id);
        }
      }
      setIsLoadingArea(false);
    };
    if (mounted) loadAreaActivity();
  }, [chartArea, chartPeriod, dateFrom, dateTo, chartAggregation, mounted]);

  const OpcionesPeriodo = [
    { value: "Hoy", label: "Hoy" },
    { value: "Últimos 7 días", label: "Últimos 7 días" },
    { value: "Últimos 30 días", label: "Últimos 30 días" },
    { value: "Este mes", label: "Este mes" },
    { value: "Histórico", label: "Todo el historial" },
    { value: "Personalizado", label: "Entre fechas..." }
  ];

  const OpcionesEstado = [
    { value: "Todos", label: "Todos los estados" },
    { value: "Aprobados", label: "Solo Aprobados" },
    { value: "Observados", label: "Solo Observados" },
    { value: "Revisados", label: "Solo Revisados" },
    { value: "Rechazados", label: "Solo Rechazados" },
    { value: "Subsanados", label: "Solo Subsanados" },
  ];

  const OpcionesResponsable = [
    { value: "Todos", label: "Todos los responsables" },
    ...areaData.responsables.map(r => ({ value: r.id, label: r.name }))
  ];

  const handleExportMapCSV = () => {
    if (!data) return;
    const currentData = geoMode === "PERU" ? data.distribution.geoPeru : data.distribution.geoIntl;
    if (!currentData || currentData.length === 0) return alert("No hay datos geográficos para exportar.");
    let csv = "Region_Pais,Cantidad_Asociados\n";
    currentData.forEach((row: any) => { csv += `"${row.name}",${row.count}\n`; });
    downloadCSV(csv, `Reporte_Geografico_${geoMode}_IIMP.csv`);
  };

  const handleExportChartCSV = () => {
    let csv = "Fecha,Aprobados,Observados,Revisados,Rechazados,Subsanados\n";
    areaData.dailyActivity.forEach((row: any) => {
        csv += `"${row.date}",${row.aprobados},${row.observados},${row.revisados},${row.rechazados},${row.subsanados}\n`;
    });
    downloadCSV(csv, `Actividad_Area_${chartArea}_IIMP.csv`);
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

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.trim().split(' ');
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
  };

  if (isLoading || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] space-y-4">
        <div className="animate-spin w-12 h-12 border-4 border-[#c39254] border-t-transparent rounded-full"></div>
        <p className="text-slate-500 font-bold animate-pulse">Sincronizando inteligencia de datos...</p>
      </div>
    );
  }

  const { kpis, recentActivity, requiresAttention, distribution } = data;
  const currentDistribution = geoMode === "PERU" ? distribution.geoPeru : distribution.geoIntl;
  const totalGeoCount = currentDistribution.reduce((acc: number, curr: any) => acc + curr.count, 0);
  const maxGeoCount = currentDistribution.length > 0 ? Math.max(...currentDistribution.map((i: any) => i.count)) : 1;
  const mapWidth = 800; const mapHeight = 600;
  const activeGeoData = geoMode === "PERU" ? peruGeoData : worldGeoData;
  let pathGenerator: d3.GeoPath<any, d3.GeoPermissibleObjects> | null = null;
  if (activeGeoData) { const projection = d3.geoMercator().fitSize([mapWidth, mapHeight], activeGeoData); pathGenerator = d3.geoPath().projection(projection); }
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
                onMouseMove={(e) => { if (tooltip) setTooltip((prev: any) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null); }}
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

  const CustomActivityTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + (entry.name !== 'Tendencia' ? entry.value : 0), 0);
      return (
        <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-200 min-w-[200px] z-50">
          <p className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-2">{label}</p>
          <p className="text-sm font-black text-slate-700 mb-3">{total} expedientes procesados</p>
          {payload.map((entry: any, index: number) => {
            if (entry.name === 'Tendencia') return null;
            return (
                <div key={index} className="flex items-center justify-between gap-4 text-xs mt-1.5">
                    <span className="flex items-center gap-2 text-slate-600 font-medium">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                        {entry.name}:
                    </span>
                    <span className="font-bold text-slate-800">{entry.value}</span>
                </div>
            );
          })}
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

      {/* ========================================================= */}
      {/* SECCIÓN: ACTIVIDAD Y GESTIÓN DEL ÁREA                       */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        
        {/* ✅ NUEVOS FILTROS DORADOS Y ROL-BASED */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
            <h3 className="text-[16px] font-black text-slate-800">Actividad y gestión del área</h3>
            <p className="text-[12px] font-medium text-slate-500 mt-0.5">Seguimiento de expedientes procesados por responsable</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 mb-1 ml-1">Área</span>
              <DashboardDropdown options={OpcionesAreas} value={chartArea} onChange={setChartArea} disabled={!isAdmin} />
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 mb-1 ml-1">Responsable</span>
              <DashboardDropdown options={OpcionesResponsable} value={selectedResponsable || "Todos"} onChange={(v:any) => setSelectedResponsable(v === "Todos" ? null : v)} />
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 mb-1 ml-1">Periodo</span>
              <DashboardDropdown options={OpcionesPeriodo} value={chartPeriod} onChange={setChartPeriod} />
            </div>

            {/* Selector de Fechas (Aparece si selecciona Personalizado) */}
            {chartPeriod === "Personalizado" && (
                <div className="flex gap-2 animate-in fade-in slide-in-from-left-2">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 mb-1 ml-1">Desde</span>
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:border-[#C5A059] outline-none transition-all" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 mb-1 ml-1">Hasta</span>
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:border-[#C5A059] outline-none transition-all" />
                    </div>
                </div>
            )}

            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 mb-1 ml-1">Estado</span>
              <DashboardDropdown options={OpcionesEstado} value={chartStatus} onChange={setChartStatus} />
            </div>

            <div className="w-px h-10 bg-slate-200 mx-2 hidden xl:block mt-3"></div>
            
            <div className="flex items-end gap-3 mt-4 xl:mt-0 self-end">
              <button onClick={handleExportChartCSV} className="h-9 px-4 flex items-center gap-2 bg-[#c39254] text-white font-bold text-sm rounded-lg hover:bg-[#a67c46] transition-colors shadow-md">
                <Download size={14} strokeWidth={2.5} /> Descargar
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row flex-1">
          {/* Lado Izquierdo: Lista de Responsables */}
          <div className="w-full xl:w-72 border-r border-slate-100 flex flex-col bg-[#fdfdfd] shrink-0">
            <div className="p-4 space-y-3 overflow-y-auto max-h-[500px] scrollbar-thin scrollbar-thumb-slate-200 relative">
              {isLoadingArea && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex justify-center pt-10 z-10">
                   <div className="animate-spin w-8 h-8 border-4 border-[#c39254] border-t-transparent rounded-full"></div>
                </div>
              )}

              {areaData.responsables.length === 0 && !isLoadingArea && (
                 <p className="text-center text-sm font-bold text-slate-400 mt-10">No hay actividad en este periodo.</p>
              )}

              {areaData.responsables.map((user) => {
                const isSelected = selectedResponsable === user.id;
                return (
                  <div 
                     key={user.id} 
                     onClick={() => setSelectedResponsable(isSelected ? null : user.id)}
                    className={`relative p-3 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col gap-2 ${
                      isSelected 
                         ? 'border-[#c39254] bg-[#fffbf2] shadow-sm' 
                         : 'border-slate-100 bg-white hover:border-[#c39254]/50 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center font-black text-xs">
                            {getInitials(user.name)}
                          </div>
                        )}
                        <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${user.status === 'online' ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-extrabold text-slate-800 truncate leading-tight">{user.name}</h4>
                        <p className="text-[10px] font-semibold text-slate-500 truncate">{user.area}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-end justify-between mt-1">
                      <div>
                         <span className="text-lg font-black text-slate-800 leading-none">{user.total}</span>
                         <span className="text-[10px] font-bold text-slate-400 ml-1">expedientes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold flex items-center ${user.growth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {user.growth >= 0 ? <TrendingUp size={12} className="mr-0.5" /> : <TrendingDown size={12} className="mr-0.5" />}
                          {Math.abs(user.growth)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lado Derecho: Gráfica Principal */}
          <div className="flex-1 p-6 relative flex flex-col min-h-[450px]">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <span>Expedientes procesados</span>
                <Info size={14} className="text-slate-400" />
              </div>
              <div className="flex items-center gap-3">
                
                {/* ✅ SELECTORES DE AGRUPACIÓN (Diario/Semanal/Mensual/Anual) */}
                <div className="flex bg-slate-100 rounded-lg p-0.5 shadow-inner">
                  <button onClick={() => setChartAggregation("Diario")} className={`px-4 py-1.5 text-[11px] font-black rounded-md transition-all ${chartAggregation === "Diario" ? "bg-white text-[#C5A059] shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>Diario</button>
                  <button onClick={() => setChartAggregation("Semanal")} className={`px-4 py-1.5 text-[11px] font-black rounded-md transition-all ${chartAggregation === "Semanal" ? "bg-white text-[#C5A059] shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>Semanal</button>
                  <button onClick={() => setChartAggregation("Mensual")} className={`px-4 py-1.5 text-[11px] font-black rounded-md transition-all ${chartAggregation === "Mensual" ? "bg-white text-[#C5A059] shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>Mensual</button>
                  <button onClick={() => setChartAggregation("Anual")} className={`px-4 py-1.5 text-[11px] font-black rounded-md transition-all ${chartAggregation === "Anual" ? "bg-white text-[#C5A059] shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>Anual</button>
                </div>
              </div>
            </div>
            
            <div className="flex-1 w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={areaData.dailyActivity} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                  <RechartsTooltip content={<CustomActivityTooltip />} cursor={{ fill: '#f8f9fa' }} />
                  
                  <Legend 
                     verticalAlign="bottom" height={36}
                     content={() => (
                       <div className="flex flex-wrap items-center justify-between w-full pt-4 mt-4 border-t border-slate-100 text-[11px] font-bold text-slate-600">
                          <div className="flex items-center gap-4">
                             <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#10b981]"></div> Aprobados</span>
                             <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#f59e0b]"></div> Observados</span>
                             <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#3b82f6]"></div> Revisados</span>
                             <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#ef4444]"></div> Rechazados</span>
                             <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#eab308]"></div> Subsanados</span>
                          </div>
                       </div>
                     )}
                  />

                  {/* ✅ FILTROS DE ESTADO CONDICIONALES EN LA GRÁFICA */}
                  {(chartStatus === "Todos" || chartStatus === "Aprobados") && <Bar dataKey="aprobados" stackId="a" fill="#10b981" name="Aprobados" maxBarSize={30} />}
                  {(chartStatus === "Todos" || chartStatus === "Observados") && <Bar dataKey="observados" stackId="a" fill="#f59e0b" name="Observados" maxBarSize={30} />}
                  {(chartStatus === "Todos" || chartStatus === "Revisados") && <Bar dataKey="revisados" stackId="a" fill="#3b82f6" name="Revisados" maxBarSize={30} />}
                  {(chartStatus === "Todos" || chartStatus === "Rechazados") && <Bar dataKey="rechazados" stackId="a" fill="#ef4444" name="Rechazados" maxBarSize={30} />}
                  {(chartStatus === "Todos" || chartStatus === "Subsanados") && <Bar dataKey="subsanados" stackId="a" fill="#eab308" name="Subsanados" maxBarSize={30} radius={[4, 4, 0, 0]} />}

                  {areaData.responsables.map((r, i) => {
                     if (selectedResponsable === null || selectedResponsable === r.id) {
                         const color = lineColors[i % lineColors.length];
                         return <Line key={r.id} type="monotone" dataKey={`user${r.id}`} name={r.name} stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />;
                     }
                     return null;
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
      
      {/* ... Mapas y Resto de tu código (se mantiene intacto) ... */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col relative overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
              <MapPin size={18} className="text-[#c39254]"/> Distribución Geográfica Global
            </h3>
            <button onClick={() => setIsMapExpanded(true)} className="text-sm font-bold text-[#c39254] hover:underline flex items-center gap-1">
              Ver detalle <Maximize2 size={14} />
            </button>
          </div>
          <div className="p-6 flex flex-col md:flex-row gap-6">
            <div className="flex-1 h-[250px] bg-[#f8f9fa] rounded-xl overflow-hidden border border-slate-100 relative">
               {!activeGeoData ? <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">Cargando mapa...</div> : renderMapSVG(false)}
            </div>
            <div className="w-full md:w-64 flex flex-col justify-between">
              <div className="flex bg-slate-100 rounded-lg p-1 shadow-inner mb-4 w-max mx-auto md:mx-0">
                <button onClick={() => setGeoMode("PERU")} className={`text-[11px] font-black px-6 py-1.5 rounded-md transition-all ${geoMode === "PERU" ? "bg-white text-[#7f561e] shadow-sm" : "text-slate-400"}`}>PERÚ</button>
                <button onClick={() => setGeoMode("INTL")} className={`text-[11px] font-black px-6 py-1.5 rounded-md transition-all ${geoMode === "INTL" ? "bg-white text-[#7f561e] shadow-sm" : "text-slate-400"}`}>INTL</button>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[180px] space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                {currentDistribution.length > 0 ? (
                  currentDistribution.slice(0, 5).map((loc: any, idx: number) => {
                    const truePercentage = totalGeoCount > 0 ? Math.round((loc.count / totalGeoCount) * 100) : 0;
                    const visualWidth = maxGeoCount > 0 ? Math.round((loc.count / maxGeoCount) * 100) : 0;
                    return (
                      <div key={idx} className="w-full">
                        <div className="flex justify-between items-end text-[12px] font-bold text-slate-700 mb-1">
                          <span className="truncate pr-2 capitalize">{loc.name.toLowerCase()} <span className="text-slate-400 text-[10px] ml-1">({loc.count})</span></span>
                          <span className="text-[#7f561e]">{truePercentage}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-gradient-to-r from-[#dca45c] to-[#7f561e] h-1.5 rounded-full" style={{ width: `${visualWidth}%` }}></div>
                        </div>
                      </div>
                    );
                  })
                ) : <div className="text-slate-400 text-sm py-4 font-medium">No hay datos.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

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