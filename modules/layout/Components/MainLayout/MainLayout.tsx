"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "../Sidebar/Sidebar";
import { Navbar } from "../Navbar/Navbar";
import type { NavigationNode } from "@/modules/navigation/Models/NavigationNode";
import type { CurrentUserDTO } from "@/modules/auth/context/types";

interface MainLayoutProps {
    children: ReactNode;
    navigationTree: NavigationNode[];
    user: CurrentUserDTO;
}

export function MainLayout({ children, navigationTree, user }: MainLayoutProps) {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    // Nuevo estado para el colapso en escritorio
    const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

    return (
        <div className="flex h-screen w-full bg-[#F4F5F7] overflow-hidden antialiased font-sans text-slate-800">
            
            <Sidebar 
                navigationTree={navigationTree} 
                isMobileOpen={isMobileSidebarOpen}
                isCollapsed={isDesktopCollapsed}
                onCloseMobile={() => setIsMobileSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative transition-all duration-300">
                
                <Navbar 
                    user={user} 
                    onToggleSidebar={() => {
                        // En mobile abre el menú superpuesto, en desktop lo colapsa
                        if (window.innerWidth < 1024) {
                            setIsMobileSidebarOpen(true);
                        } else {
                            setIsDesktopCollapsed(!isDesktopCollapsed);
                        }
                    }} 
                />

                <main className="flex-1 overflow-y-auto p-4 sm:p-8 relative z-0 scrollbar-thin scrollbar-thumb-slate-200">
                    <div className="max-w-[1600px] mx-auto w-full h-full flex flex-col">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}