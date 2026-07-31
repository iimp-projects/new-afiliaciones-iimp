import { contextService } from "@/modules/auth/context/service";

export default async function intranetDashboardPage() {
    const user = await contextService.getCurrentUser();

    return (
        <div className="space-y-6">
            {/* Banner Corporativo IIMP */}
            <div className="bg-gradient-to-r from-[#7f561e] via-[#c39254] to-[#7f561e] rounded-3xl p-8 text-white shadow-xl">
                <span className="bg-white/20 text-white text-xs font-extrabold px-3.5 py-1.5 rounded-full uppercase tracking-widest backdrop-blur-md">
                    intranet Institucional IIMP
                </span>
                <h1 className="text-3xl sm:text-4xl font-black mt-4 mb-2 tracking-tight">
                    ¡Bienvenido, {user?.person.firstName} {user?.person.paternalLastName}!
                </h1>
                <p className="text-white/90 font-medium text-sm sm:text-base max-w-2xl leading-relaxed">
                    Has ingresado exitosamente al espacio de trabajo unificado. Tu rol actual es <strong className="text-white uppercase font-bold">{user?.role.slug.replace(/_/g, " ")}</strong>.
                </p>
            </div>

            {/* Grid de Estado del intranet */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                        Rol del Sistema
                    </h3>
                    <p className="text-lg font-black text-slate-800">
                        {user?.role.slug}
                    </p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                        Motor de Permisos O(1)
                    </h3>
                    <p className="text-lg font-black text-[#7f561e]">
                        {user?.permissions.has("manage:all") ? "Acceso Total (Super Admin)" : `${user?.permissions.size} privilegios activos`}
                    </p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                        Estado de la Sesión
                    </h3>
                    <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        {user?.status}
                    </span>
                </div>
            </div>
        </div>
    );
}