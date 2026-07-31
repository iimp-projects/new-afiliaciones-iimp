"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { InspectionDrawer } from "@/modules/shared/Components/InspectionDrawer/InspectionDrawer";
import { mockDrawerData, mockSmartCaseCards } from "../../Mocks/ExpedientesMockData";
import { useKeyboardDrawerNavigation } from "../../Hooks/useKeyboardDrawerNavigation";
import { useTheaterMode } from "@/modules/shared/Components/InspectionDrawer/TheaterModeContext";

const ResumenTabContent = () => (
  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
    <div className="bg-white p-6 rounded-2xl border border-slate-200">
      <h3 className="text-sm font-black text-slate-800 mb-4">Línea de Tiempo del Expediente</h3>
      <div className="pl-4 border-l-2 border-slate-100 space-y-6">
        <div className="relative">
          <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-white" />
          <p className="text-sm font-bold text-slate-700">DNI Validado por RENIEC</p>
          <span className="text-xs font-medium text-slate-400">Hace 2 días</span>
        </div>
        <div className="relative">
          <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-4 ring-white animate-pulse" />
          <p className="text-sm font-bold text-slate-700">Tesorería rechazó el voucher</p>
          <span className="text-xs font-medium text-slate-400">Ana de Tesorería • Hoy, 10:30 AM</span>
          <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-medium text-red-800">
            "El código de operación no coincide con Niubiz. Solicitar nuevo documento al postulante."
          </div>
        </div>
      </div>
    </div>
  </div>
);

const PagosTabContent = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl bg-white animate-in fade-in">
      <span className="text-slate-400 font-bold">Visor de PDF del Voucher de Pago (Simulado)</span>
      <p className="text-xs text-slate-400 mt-2">Usa el ícono de expandir arriba para el Modo Teatro</p>
    </div>
  );
};

export function AfiliacionDrawerAdapter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCaseCode = searchParams.get("case");

  const fakeExpedientesList = mockSmartCaseCards.map(c => ({ applicationCode: c.trackingCode } as any));
  useKeyboardDrawerNavigation(fakeExpedientesList);

  const closeDrawer = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete("case");
    router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
  };

  const jumpToOffset = (offset: number) => {
    const currentIndex = fakeExpedientesList.findIndex(e => e.applicationCode === activeCaseCode);
    if (currentIndex === -1) return;
    const target = fakeExpedientesList[currentIndex + offset];
    if (target) {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set("case", target.applicationCode);
      router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
    }
  };

  if (!activeCaseCode) return null;

  const dataToInject = {
    ...mockDrawerData,
    header: mockSmartCaseCards.find(c => c.trackingCode === activeCaseCode) || mockSmartCaseCards[0]
  };

  const renderTabContent = (tabId: string, payload: any) => {
    switch (tabId) {
      case "summary": return <ResumenTabContent />;
      case "payments": return <PagosTabContent />;
      default: return <div className="p-6 text-center text-slate-400">Contenido en construcción: {tabId}</div>;
    }
  };

  return <InspectionDrawer isOpen={!!activeCaseCode} onClose={closeDrawer} onNext={() => jumpToOffset(1)} onPrev={() => jumpToOffset(-1)} data={dataToInject} renderContent={renderTabContent} />;
}