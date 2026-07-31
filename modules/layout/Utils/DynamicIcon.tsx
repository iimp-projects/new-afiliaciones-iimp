"use client";

import * as Icons from "lucide-react";

interface DynamicIconProps {
    name?: string;
    size?: number;
    className?: string;
    strokeWidth?: number;
}

export function DynamicIcon({ name, size = 20, className = "", strokeWidth = 2 }: DynamicIconProps) {
    if (!name) return null;

    // Buscamos el componente dinámicamente en el paquete de Lucide
    const IconComponent = (Icons as unknown as Record<string, Icons.LucideIcon>)[name];

    if (!IconComponent) {
        return <Icons.Folder size={size} className={className} strokeWidth={strokeWidth} />;
    }

    return <IconComponent size={size} className={className} strokeWidth={strokeWidth} />;
}