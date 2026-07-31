"use client";

import { WorkspaceHeader } from "../Components/Workspace/WorkspaceHeader";
import { mockSmartCaseCards } from "../Mocks/ExpedientesMockData";
import { AfiliacionCardAdapter } from "../Components/Adapters/AfiliacionCardAdapter";

export function ExpedientesWorkspace() {
    return (
        <div className="flex flex-col h-[calc(100vh-120px)] relative">
            
            <WorkspaceHeader />

            {/* Barra de Comandos (Omnibar) - Se implementará en la siguiente iteración */}
            <div className="w-full h-14 bg-white border border-slate-200 rounded-2xl mb-6 shadow-sm flex items-center px-4 opacity-50">
                <span className="text-sm font-bold text-slate-400">Omnibar (Búsqueda y Vistas) en construcción...</span>
            </div>

            {/* Canvas de Trabajo (Smart Case Cards) */}
            <div className="flex-1 overflow-y-auto pb-8 scrollbar-thin scrollbar-thumb-slate-200 pr-2">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {/* Renderizamos las tarjetas mockeadas */}
                    {mockSmartCaseCards.map((card) => (
                        <AfiliacionCardAdapter key={card.id} data={card} />
                    ))}
                </div>
            </div>

        </div>
    );
}