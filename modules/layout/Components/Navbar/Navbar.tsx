"use client";

import { useState } from "react";
import { Bell, Mail, Menu, ChevronRight } from "lucide-react";
import type { CurrentUserDTO } from "@/modules/auth/context/types";

interface NavbarProps {
    user: CurrentUserDTO;
    onToggleSidebar: () => void;
}

export function Navbar({ user, onToggleSidebar }: NavbarProps) {
    const [activeLang, setActiveLang] = useState<"ES" | "EN" | "QU">("ES");

    // URLs de banderas optimizadas (CDN rápida)
    const flags = {
        ES: "https://flagcdn.com/w40/pe.png", 
        EN: "https://flagcdn.com/w40/us.png", 
        // QU: "https://upload.wikimedia.org/wikipedia/commons/b/b6/Wiphala.svg"
    };

    return (
        <header className="h-20 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 shadow-sm">
            
            <div className="flex items-center gap-2 sm:gap-4">
                <button 
                    onClick={onToggleSidebar}
                    className="p-2 text-slate-500 hover:text-[#7f561e] hover:bg-[#c39254]/10 rounded-xl transition-colors"
                >
                    <Menu size={24} strokeWidth={2.5} />
                </button>

                <div className="hidden md:flex items-center text-sm font-medium">
                    <span className="text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">
                        Dashboard
                    </span>
                    <ChevronRight size={16} className="mx-2 text-slate-300" strokeWidth={2.5} />
                    <span className="font-extrabold text-slate-800 tracking-wide">
                        Resumen
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-5">
                
                {/* Selector de Idiomas Premium con Banderas */}
                <div className="hidden sm:flex items-center gap-1 bg-slate-50/80 border border-slate-200 rounded-full p-1 shadow-inner">
                    {(Object.keys(flags) as Array<keyof typeof flags>).map((lang) => (
                        <button
                            key={lang}
                            onClick={() => setActiveLang(lang)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-[#c39254]/50 ${
                                activeLang === lang
                                ? "bg-white shadow-[0_2px_10px_-2px_rgba(0,0,0,0.1)] border border-slate-100 text-[#7f561e]"
                                : "hover:bg-slate-200/50 text-slate-400 hover:text-slate-600"
                            }`}
                        >
                            <img 
                                src={flags[lang]} 
                                alt={lang} 
                                className={`w-4 h-4 rounded-full object-cover shadow-sm transition-opacity ${
                                    activeLang === lang ? 'ring-2 ring-white opacity-100' : 'opacity-60'
                                }`} 
                            />
                            <span className={`text-[11px] font-extrabold ${activeLang === lang ? 'text-slate-800' : 'text-slate-500'}`}>
                                {lang}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="h-6 w-px bg-slate-200 hidden sm:block mx-1"></div>

                {/* Notificaciones y Mensajes */}
                <div className="flex items-center gap-1">
                    <button className="relative p-2.5 text-slate-400 hover:text-[#c39254] hover:bg-orange-50 rounded-full transition-colors">
                        <Bell size={20} strokeWidth={2.2} />
                        <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 border border-white rounded-full"></span>
                    </button>
                    <button className="relative p-2.5 text-slate-400 hover:text-[#c39254] hover:bg-orange-50 rounded-full transition-colors">
                        <Mail size={20} strokeWidth={2.2} />
                    </button>
                </div>

                <div className="h-8 w-px bg-slate-200 hidden sm:block mx-1"></div>

                {/* Perfil del Usuario */}
                <button className="flex items-center gap-3 p-1 rounded-xl hover:bg-slate-50 transition-colors group text-left">
                    <div className="flex-col items-end hidden md:flex">
                        <span className="text-[13px] font-extrabold text-slate-700 leading-tight uppercase tracking-wide">
                            {user.person.firstName} {user.person.paternalLastName}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 group-hover:text-[#c39254] transition-colors">
                            {user.role.slug.replace(/_/g, ' ')}
                        </span>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 shrink-0 group-hover:border-[#c39254] group-hover:text-[#7f561e] transition-all">
                        <span className="text-sm font-black tracking-wider">
                            {user.person.firstName.charAt(0)}{user.person.paternalLastName.charAt(0)}
                        </span>
                    </div>
                </button>
            </div>
        </header>
    );
}