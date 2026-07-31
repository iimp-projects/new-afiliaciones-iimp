"use client";

import { X, LogOut } from "lucide-react";
import type { NavigationNode } from "@/modules/navigation/Models/NavigationNode";
import { SidebarItem } from "./SidebarItem";
import { signOut } from "next-auth/react";

interface SidebarProps {
    navigationTree: NavigationNode[];
    isMobileOpen: boolean;
    isCollapsed: boolean;
    onCloseMobile: () => void;
}

export function Sidebar({ navigationTree, isMobileOpen, isCollapsed, onCloseMobile }: SidebarProps) {
    
    return (
        <>
            {/* Mobile Backdrop Overlay */}
            {isMobileOpen && (
                <div 
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
                    onClick={onCloseMobile}
                />
            )}

            {/* Sidebar Contenedor Principal */}
            <aside 
                className={`fixed lg:static inset-y-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col h-screen transform transition-all duration-300 ease-in-out lg:translate-x-0 ${
                    isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
                } ${isCollapsed ? "w-20" : "w-72"}`}
            >
                {/* Header del Sidebar (Logo IIMP centrado y ancho completo) */}
                <div className="h-20 flex items-center justify-center px-4 border-b border-slate-100 shrink-0 relative overflow-hidden">
                    <img 
                        src={isCollapsed ? "/images/logo-iimp.png" : "/images/logo-iimp.png"} 
                        alt="IIMP Logo" 
                        // Logo original (sin invert), con object-contain para no deformarse
                        className={`transition-all duration-300 object-contain ${isCollapsed ? "w-10 h-10 object-left" : "w-full max-h-12"}`}
                    />
                    <button 
                        onClick={onCloseMobile}
                        className="absolute right-4 lg:hidden p-2 text-slate-400 hover:text-slate-800 bg-slate-50 rounded-lg transition-colors"
                    >
                        <X size={20} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Menú de Navegación */}
                <nav className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    {navigationTree.length > 0 ? (
                        navigationTree.map((node) => (
                            <SidebarItem key={node.id} item={node} isCollapsed={isCollapsed} onMobileClick={onCloseMobile} />
                        ))
                    ) : (
                        <div className="text-center p-4 text-slate-400 text-sm font-semibold">
                            Cargando...
                        </div>
                    )}
                </nav>

                {/* Footer del Sidebar (Botón Cerrar Sesión) */}
                <div className={`p-4 border-t border-slate-100 bg-white shrink-0 transition-all duration-300 ${isCollapsed ? "px-2" : "px-4"}`}>
                    <button 
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className={`w-full flex items-center ${isCollapsed ? "justify-center" : "gap-3"} px-3 py-3 rounded-xl transition-all outline-none text-slate-500 hover:bg-red-50 hover:text-red-600 group`}
                        title="Cerrar Sesión"
                    >
                        <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-red-100 flex items-center justify-center text-slate-500 group-hover:text-red-600 transition-colors shrink-0">
                            <LogOut size={18} strokeWidth={2.5} className={isCollapsed ? "" : "ml-1"} />
                        </div>
                        {!isCollapsed && (
                            <span className="text-sm font-bold tracking-wide whitespace-nowrap">Cerrar Sesión</span>
                        )}
                    </button>
                </div>
            </aside>
        </>
    );
}