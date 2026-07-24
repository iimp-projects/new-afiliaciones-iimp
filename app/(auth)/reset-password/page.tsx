"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function VerifyCodePage() {
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (newPassword !== confirmPassword) {
            setError("Las contraseñas no coinciden.");
            return;
        }

        setIsLoading(true);
        // Lógica de NextAuth / API para validar código y cambiar contraseña...
        
        setTimeout(() => {
            setIsLoading(false);
            // Si todo sale bien, lo mandamos al login
            router.push("/login");
        }, 2000);
    };

    return (
        /* Contenedor Principal Fijo */
        <main className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-surface font-sans antialiased">
            
            {/* Lado Izquierdo: Hero Section (Adaptado al contexto de confirmación) */}
            <section className="hidden md:flex md:w-[55%] h-full flex-col justify-center items-center relative overflow-hidden bg-primary">
                <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#4a2d00] via-primary to-primary-container opacity-95"></div>
                <div className="absolute inset-0 z-0 opacity-20 mix-blend-overlay bg-cover bg-center" style={{ backgroundImage: "url('/images/minero.jpg')" }}></div>
                
                <div className="relative z-10 w-full max-w-2xl px-10">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold tracking-widest uppercase mb-3 backdrop-blur-sm">
                        <span className="w-2 h-2 rounded-full bg-[#a2e584] animate-pulse"></span>
                        Verificación Segura
                    </span>

                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-3 leading-[1.1] tracking-tight text-white drop-shadow-md">
                        Ya casi estás <br/><span className="text-[#f3bd7a]">de vuelta</span>
                    </h1>
                    
                    <p className="text-base md:text-lg mb-5 text-white/80 font-medium max-w-lg leading-relaxed">
                        Introduce el código de seguridad que hemos enviado a tu bandeja de entrada para establecer tu nueva contraseña y retomar el acceso a tu cuenta.
                    </p>

                    <div className="mt-8 p-5 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm max-w-sm">
                        <p className="text-sm font-semibold mb-2 text-[#f3bd7a]">
                            <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Tip de seguridad
                        </p>
                        <p className="text-sm text-white/80 leading-relaxed">
                            No compartas tu código de 6 dígitos con nadie. El equipo del IIMP nunca te solicitará tu código por teléfono ni por redes sociales.
                        </p>
                    </div>
                </div>
            </section>

            {/* Lado Derecho: Tarjeta de Verificación */}
            <section className="w-full md:w-[45%] h-full flex flex-col justify-center items-center relative overflow-hidden bg-surface-container-lowest">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4"></div>

                <div className="w-full max-w-[420px] px-6 relative z-10">
                    
                    <div className="text-center mb-8 flex flex-col items-center">
                        <div className="bg-surface p-3 rounded-2xl shadow-sm border border-secondary/10 mb-4">
                            <img src="/images/logo-iimp.png" alt="Logo IIMP" className="h-10 w-auto object-contain" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-[#4a2d00] to-primary">
                            Crear Nueva Contraseña
                        </h2>
                        <p className="text-sm font-medium text-secondary/80">
                            Ingresa el código enviado a tu correo y digita tu nueva contraseña de acceso.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        
                        {error && (
                            <div className="p-3 text-sm font-medium text-red-700 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-xl flex items-center gap-3">
                                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                {error}
                            </div>
                        )}

                        {/* Código de Verificación (Estilo especial) */}
                        <div className="space-y-1.5 pb-2">
                            <label className="text-sm font-bold text-on-surface-variant ml-1" htmlFor="code">
                                Código de Verificación (6 dígitos)
                            </label>
                            <input
                                className="w-full px-4 py-3 bg-surface hover:bg-surface-container-highest border border-secondary/20 rounded-xl text-2xl tracking-[0.5em] text-center font-bold text-primary focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200 placeholder:tracking-normal placeholder:font-medium placeholder:text-base placeholder:text-secondary/50"
                                id="code"
                                type="text"
                                maxLength={6}
                                placeholder="Ej. 123456"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} // Solo permite números
                                required
                                disabled={isLoading}
                            />
                        </div>

                        {/* Nueva Contraseña */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-on-surface-variant ml-1" htmlFor="newPassword">
                                Nueva Contraseña
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary group-focus-within:text-primary transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                </div>
                                <input
                                    className="w-full pl-11 pr-12 py-3.5 bg-surface hover:bg-surface-container-highest border border-secondary/20 rounded-xl text-base text-on-surface focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200"
                                    id="newPassword"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Mínimo 8 caracteres"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors focus:outline-none p-1"
                                >
                                    {showPassword ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Confirmar Contraseña */}
                        <div className="space-y-1.5 pb-2">
                            <label className="text-sm font-bold text-on-surface-variant ml-1" htmlFor="confirmPassword">
                                Confirmar Contraseña
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary group-focus-within:text-primary transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                                </div>
                                <input
                                    className="w-full pl-11 pr-12 py-3.5 bg-surface hover:bg-surface-container-highest border border-secondary/20 rounded-xl text-base text-on-surface focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200"
                                    id="confirmPassword"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Repite la contraseña"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        {/* Botón Principal */}
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isLoading || code.length < 6}
                                className="w-full py-4 rounded-xl text-white font-bold text-base tracking-wide transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed
                                           bg-gradient-to-r from-primary via-[#a3722a] to-primary-container
                                           shadow-[0_8px_20px_-6px_rgba(127,86,30,0.5)] 
                                           hover:shadow-[0_12px_25px_-6px_rgba(127,86,30,0.6)] hover:-translate-y-0.5"
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Validando y guardando...
                                    </span>
                                ) : (
                                    <>
                                        <span>Confirmar Cambio</span>
                                        <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                    </>
                                )}
                            </button>
                        </div>
                        
                        {/* Enlace para cancelar */}
                        <div className="mt-6 text-center">
                            <Link href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-secondary hover:text-primary transition-colors">
                                Cancelar y volver al inicio
                            </Link>
                        </div>
                    </form>
                </div>
            </section>
        </main>
    );
}