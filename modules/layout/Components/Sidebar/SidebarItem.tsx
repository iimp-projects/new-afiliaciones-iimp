"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Dot } from "lucide-react";
import type { NavigationNode } from "@/modules/navigation/Models/NavigationNode";
import { DynamicIcon } from "../../Utils/DynamicIcon";

interface SidebarItemProps {
    item: NavigationNode;
    isNested?: boolean;
    isCollapsed?: boolean;
    onMobileClick?: () => void;
}

export function SidebarItem({ item, isNested = false, isCollapsed = false, onMobileClick }: SidebarItemProps) {
    const pathname = usePathname();
    const hasChildren = item.children && item.children.length > 0;
    
    // ==========================================
    // 1. RENDERIZADO DE GRUPOS (Ej. MENÚ PRINCIPAL)
    // ==========================================
   if (item.type === "group" || (!item.href && hasChildren && !isNested)) {
        
        // 🛑 PROTECCIÓN VISUAL: Si el grupo llega vacío, no renderizamos absolutamente nada.
        if (!item.children || item.children.length === 0) {
            return null;
        }

        return (
            <div className="mb-6 mt-4">
                {!isCollapsed ? (
                    <p className="px-4 mb-3 text-[11px] font-extrabold text-slate-400/80 uppercase tracking-widest whitespace-nowrap overflow-hidden">
                        {item.title}
                    </p>
                ) : (
                    <hr className="my-5 border-slate-200 mx-4" />
                )}
                
                <div className="flex flex-col gap-1.5 px-2">
                    {item.children?.map((child) => (
                        <SidebarItem key={child.id} item={child} isNested={false} isCollapsed={isCollapsed} onMobileClick={onMobileClick} />
                    ))}
                </div>
            </div>
        );
    }

    // Lógica estricta de ruta activa
    const isActive = pathname === item.href || (hasChildren && item.children?.some(child => pathname.startsWith(child.href || "")));
    const [isOpen, setIsOpen] = useState(isActive);

    useEffect(() => {
        if (isActive && !isCollapsed) setIsOpen(true);
        if (isCollapsed) setIsOpen(false);
    }, [isActive, isCollapsed]);

    // ==========================================
    // 2. RENDERIZADO DE MENÚS DESPLEGABLES
    // ==========================================
    if (hasChildren) {
        return (
            <div className="flex flex-col mb-1.5">
                <button
                    onClick={() => !isCollapsed && setIsOpen(!isOpen)}
                    title={isCollapsed ? item.title : undefined}
                    className={`flex items-center justify-between w-full px-4 py-3 rounded-2xl transition-all duration-300 outline-none ${
                        isActive 
                        ? "bg-[#c39254]/10 text-[#a3722a] font-bold" 
                        // MEJORA: Hover dorado suave y texto oscuro para que resalte
                        : "text-slate-500 hover:bg-[#c39254]/10 hover:text-[#a3722a] font-medium"
                    } ${isCollapsed ? "justify-center px-0 w-12 h-12 mx-auto rounded-xl" : ""}`}
                >
                    <div className="flex items-center gap-3">
                        <DynamicIcon 
                            name={item.icon} 
                            size={20} 
                            strokeWidth={isActive ? 2.5 : 2} 
                            className={isActive ? "text-[#a3722a]" : "text-slate-400"} 
                        />
                        {!isCollapsed && <span className="text-[14px] tracking-wide whitespace-nowrap">{item.title}</span>}
                    </div>
                    {!isCollapsed && <ChevronDown size={16} strokeWidth={2.5} className={`transition-transform duration-300 ${isOpen ? "rotate-180 text-[#a3722a]" : "text-slate-300"}`} />}
                </button>
                
                {!isCollapsed && (
                    <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100 mt-1.5" : "grid-rows-[0fr] opacity-0"}`}>
                        <div className="overflow-hidden">
                            <div className="pl-4 ml-6 border-l-2 border-slate-100 flex flex-col gap-1 py-1">
                                {item.children!.map((child) => (
                                    <SidebarItem key={child.id} item={child} isNested={true} isCollapsed={isCollapsed} onMobileClick={onMobileClick} />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ==========================================
    // 3. RENDERIZADO DE ENLACE DIRECTO (LA PASTILLA)
    // ==========================================
    return (
        <Link
            href={item.href || "#"}
            onClick={onMobileClick}
            title={isCollapsed ? item.title : undefined}
            className={`group flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300 outline-none mb-1.5 ${
                isActive
                ? "bg-gradient-to-r from-[#dca45c] to-[#c39254] text-white font-bold shadow-md shadow-[#c39254]/30" 
                // MEJORA: Hover dorado suave para que notes claramente cuando pasas el mouse
                : "text-slate-500 hover:bg-[#c39254]/10 hover:text-[#a3722a] font-medium"
            } ${isNested ? "py-2.5 text-[13px]" : "text-[14px]"} ${isCollapsed ? "justify-center px-0 w-12 h-12 mx-auto rounded-xl" : ""}`}
        >
            <div className="flex items-center gap-3">
                {item.icon ? (
                    <DynamicIcon 
                        name={item.icon} 
                        size={isNested ? 18 : 20} 
                        strokeWidth={isActive ? 2.5 : 2} 
                        className={isActive ? "text-white" : "text-slate-400 group-hover:text-[#a3722a] transition-colors"} 
                    />
                ) : (
                    <Dot size={20} strokeWidth={3} className={isActive ? "text-white" : "text-slate-300 group-hover:text-[#a3722a]"} />
                )}
                {!isCollapsed && <span className="tracking-wide whitespace-nowrap">{item.title}</span>}
            </div>

            {!isCollapsed && isActive && !isNested && (
                <ChevronRight size={16} strokeWidth={3} className="text-white/80 animate-in fade-in slide-in-from-left-2" />
            )}

            {!isCollapsed && item.badge && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${isActive ? "bg-white text-[#c39254]" : "bg-[#c39254] text-white shadow-sm"}`}>
                    {item.badge}
                </span>
            )}
        </Link>
    );
}