"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Mail, Menu, ChevronRight, AlertCircle, User, Settings, LogOut } from "lucide-react";
import type { CurrentUserDTO } from "@/modules/auth/context/types";
import { logoutAction } from "@/modules/auth/logout/logoutAction"; // Importamos la acción para cerrar sesión

interface NavbarProps {
    user: CurrentUserDTO;
    onToggleSidebar: () => void;
}

export function Navbar({ user, onToggleSidebar }: NavbarProps) {
    const [activeLang, setActiveLang] = useState<"ES" | "EN" | "QU">("ES");
    
    // Estados para los popovers
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    
    const notifRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);

    // URLs de banderas optimizadas (CDN rápida)
    const flags = {
        ES: "https://flagcdn.com/w40/pe.png",
        EN: "https://flagcdn.com/w40/us.png",
    };

    // Cierra los paneles flotantes si haces clic afuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setIsNotifOpen(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Mock de Notificaciones
    const mockNotifications = [
        {
            id: 1,
            expediente: "APP-2026-0089",
            area: "Logística",
            reviewer: "Rosa León",
            message: "Se requiere adjuntar nuevamente el DNI (reverso ilegible).",
            time: "Hace 10 min",
            unread: true
        },
        {
            id: 2,
            expediente: "APP-2026-0042",
            area: "Comité Evaluador",
            reviewer: "Marco Torres",
            message: "Falta sustentar los últimos 3 años de experiencia en el sector.",
            time: "Hace 2 horas",
            unread: true
        }
    ];

    return (
        <header className="h-20 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 shadow-sm relative">
            
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
                
                {/* Selector de Idiomas Premium */}
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
                                src={flags[lang as keyof typeof flags]} 
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
                <div className="flex items-center gap-2">
                    
                    {/* CAMPANITA CON DROPDOWN PREMIUM */}
                    <div className="relative" ref={notifRef}>
                        <button 
                            onClick={() => setIsNotifOpen(!isNotifOpen)}
                            className={`relative p-2.5 rounded-full transition-colors ${
                                isNotifOpen 
                                ? "text-[#c39254] bg-orange-50" 
                                : "text-slate-400 hover:text-[#c39254] hover:bg-orange-50"
                            }`}
                        >
                            <Bell size={20} strokeWidth={2.2} />
                            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 border border-white rounded-full animate-pulse"></span>
                        </button>

                        {/* POPOVER DE OBSERVACIONES */}
                        {isNotifOpen && (
                            <div className="absolute right-0 top-full mt-2 w-[320px] sm:w-[380px] bg-white border border-slate-100 rounded-2xl shadow-[0_15px_50px_-10px_rgba(0,0,0,0.15)] z-[100] animate-in fade-in slide-in-from-top-4 origin-top-right">
                                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 rounded-t-2xl">
                                    <div>
                                        <h3 className="text-[14px] font-black text-slate-800">Observaciones Pendientes</h3>
                                        <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Tienes {mockNotifications.length} por revisar</p>
                                    </div>
                                    <button className="text-[11px] font-bold text-[#c39254] hover:text-[#a3722a] transition-colors">
                                        Marcar leídas
                                    </button>
                                </div>

                                <div className="max-h-[340px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                                    {mockNotifications.map((notif) => (
                                        <div key={notif.id} className="p-4 border-b border-slate-50 hover:bg-[#fffdf8] transition-colors cursor-pointer group flex gap-4 items-start">
                                            <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shrink-0 group-hover:bg-red-100 transition-colors mt-0.5">
                                                <AlertCircle size={18} className="text-red-500" strokeWidth={2.5} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1.5">
                                                    <h4 className="text-[12px] font-extrabold text-slate-800 group-hover:text-[#c39254] transition-colors truncate">
                                                        Exp. {notif.expediente}
                                                    </h4>
                                                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap ml-2">
                                                        {notif.time}
                                                    </span>
                                                </div>
                                                <p className="text-[12px] font-medium text-slate-600 leading-snug line-clamp-2 mb-2">
                                                    {notif.message}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-400">
                                                    <span className="px-2 py-0.5 bg-slate-100 rounded-md text-slate-600">{notif.area}</span>
                                                    <span>• Rev. por {notif.reviewer}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-3 border-t border-slate-100 text-center bg-slate-50/80 rounded-b-2xl">
                                    <button className="text-[12px] font-bold text-slate-500 hover:text-[#c39254] transition-colors">
                                        Ver todas las notificaciones
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <button className="relative p-2.5 text-slate-400 hover:text-[#c39254] hover:bg-orange-50 rounded-full transition-colors">
                        <Mail size={20} strokeWidth={2.2} />
                    </button>
                </div>

                <div className="h-8 w-px bg-slate-200 hidden sm:block mx-1"></div>

                {/* Perfil del Usuario y Dropdown */}
                <div className="relative" ref={profileRef}>
                    <button 
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className={`flex items-center gap-3 p-1.5 pl-2 rounded-xl transition-colors group text-left outline-none ${
                            isProfileOpen ? "bg-[#c39254]/10" : "hover:bg-slate-50"
                        }`}
                    >
                        <div className="flex-col items-end hidden md:flex">
                            <span className="text-[13px] font-extrabold text-slate-700 leading-tight uppercase tracking-wide">
                                {user.person.firstName} {user.person.paternalLastName}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 group-hover:text-[#c39254] transition-colors">
                                {user.role.slug.replace(/_/g, ' ')}
                            </span>
                        </div>
                        <div className={`h-10 w-10 rounded-full border shadow-sm flex items-center justify-center shrink-0 transition-all ${
                            isProfileOpen 
                            ? "bg-[#C5A059] border-[#C5A059] text-white" 
                            : "bg-slate-100 border-slate-200 text-slate-600 group-hover:border-[#c39254] group-hover:text-[#7f561e]"
                        }`}>
                            <span className="text-sm font-black tracking-wider">
                                {user.person.firstName.charAt(0)}{user.person.paternalLastName.charAt(0)}
                            </span>
                        </div>
                    </button>

                    {/* POPOVER DEL MENÚ DE PERFIL */}
                    {isProfileOpen && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-100 rounded-2xl shadow-[0_15px_50px_-10px_rgba(0,0,0,0.15)] z-[100] animate-in fade-in slide-in-from-top-4 origin-top-right overflow-hidden">
                            {/* Cabecera del popover */}
                            <div className="p-4 border-b border-slate-100 bg-slate-50/80">
                                <p className="text-[13px] font-extrabold text-slate-800 leading-tight truncate">
                                    {user.person.firstName} {user.person.paternalLastName}
                                </p>
                                <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate" title={user.email}>
                                    {user.email}
                                </p>
                            </div>
                            
                            {/* Opciones del menú */}
                            <div className="p-2 space-y-1">
                                <button className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] font-bold text-slate-600 hover:text-[#c39254] hover:bg-orange-50 rounded-xl transition-colors">
                                    <User size={16} strokeWidth={2.5} />
                                    Ver perfil
                                </button>
                                <button className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] font-bold text-slate-600 hover:text-[#c39254] hover:bg-orange-50 rounded-xl transition-colors">
                                    <Settings size={16} strokeWidth={2.5} />
                                    Cambiar contraseña
                                </button>
                            </div>
                            
                            {/* Botón de Cerrar Sesión integrado al Popover */}
                            <div className="p-2 border-t border-slate-100">
                                <button 
                                    onClick={() => logoutAction()}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                >
                                    <LogOut size={16} strokeWidth={2.5} />
                                    Cerrar sesión
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}