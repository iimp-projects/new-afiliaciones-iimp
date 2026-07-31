

export interface BreadcrumbResult {
    title: string;
    href: string;
}

export interface IBreadcrumbResolver {
    /**
     * Resuelve un segmento dinámico de la URL.
     * Ejemplo: param = "APP-2026-0001" -> { title: "Postulación APP...", href: "..." }
     */
    resolve(param: string): Promise<BreadcrumbResult | null>;
}