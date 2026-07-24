"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [isSuccess, setIsSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        // Aquí irá la lógica de tu API (ej. fetch('/api/auth/recuperar', ...))
        // Simulamos un retraso de red de 2 segundos para la animación
        setTimeout(() => {
            setIsLoading(false);
            // Simulamos que el correo se envió con éxito
            setIsSuccess(true);
        }, 2000);
    };

    return (
        <main className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-surface font-sans antialiased">
            
            {/* Lado Izquierdo: Hero Section (Mantenemos la coherencia visual con el Login) */}
            <section className="hidden md:flex md:w-[55%] h-full flex-col justify-center items-center relative overflow-hidden bg-primary">
                <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#4a2d00] via-primary to-primary-container opacity-95"></div>
                <div className="absolute inset-0 z-0 opacity-20 mix-blend-overlay bg-cover bg-center" style={{ backgroundImage: "url('/images/minero.jpg')" }}></div>
                
                <div className="relative z-10 w-full max-w-2xl px-10">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold tracking-widest uppercase mb-3 backdrop-blur-sm">
                        <span className="w-2 h-2 rounded-full bg-[#f3bd7a] animate-pulse"></span>
                        Portal Oficial IIMP
                    </span>

                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-3 leading-[1.1] tracking-tight text-white drop-shadow-md">
                        Protegemos tu <br/><span className="text-[#f3bd7a]">Seguridad Digital</span>
                    </h1>
                    
                    <p className="text-base md:text-lg mb-5 text-white/80 font-medium max-w-lg leading-relaxed">
                        Si has perdido el acceso a tu cuenta, te ayudaremos a recuperarlo de forma rápida y segura para que sigas conectado con la comunidad minera.
                    </p>

                    <div className="flex items-center gap-6 text-sm font-semibold text-white/90 mt-8">
                        <div className="flex -space-x-3">
                            <div className="w-10 h-10 rounded-full border-2 border-primary bg-primary-container flex items-center justify-center text-xs">I</div>
                            <div className="w-10 h-10 rounded-full border-2 border-primary bg-surface-tint flex items-center justify-center text-xs">I</div>
                            <div className="w-10 h-10 rounded-full border-2 border-primary bg-white text-primary flex items-center justify-center text-xs">M</div>
                            <div className="w-10 h-10 rounded-full border-2 border-primary bg-[#e4e2e0] text-secondary flex items-center justify-center text-xs">P</div>
                        </div>
                        <p>+10,000 profesionales <br/>confían en nosotros</p>
                    </div>

                    <div className="mt-8">
                        <a href="mailto:liset.otoya@iimp.org.pe" className="text-sm font-semibold text-[#f3bd7a] hover:underline flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                            ¿Tienes problemas para acceder? Escríbenos
                        </a>
                    </div>
                </div>
            </section>

            {/* Lado Derecho: Tarjeta de Recuperación */}
            <section className="w-full md:w-[45%] h-full flex flex-col justify-center items-center relative overflow-hidden bg-surface-container-lowest">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4"></div>

                <div className="w-full max-w-[420px] px-6 relative z-10">
                    
                    <div className="text-center mb-8 flex flex-col items-center">
                        <div className="bg-surface p-3 rounded-2xl shadow-sm border border-secondary/10 mb-4">
                            <img src="/images/logo-iimp.png" alt="Logo IIMP" className="h-10 w-auto object-contain" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-[#4a2d00] to-primary">
                            Recuperar Contraseña
                        </h2>
                        <p className="text-sm font-medium text-secondary/80">
                            Ingresa tu correo electrónico registrado y te enviaremos las instrucciones.
                        </p>
                    </div>

                    {/* Estado de Éxito: Se muestra cuando el correo se envía correctamente */}
                    {isSuccess ? (
                        <div className="bg-[#f0faeb] border border-[#a2e584] rounded-2xl p-6 text-center animate-fade-in">
                            <div className="w-16 h-16 bg-[#a2e584]/20 text-[#2d7a0c] rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                            <h3 className="text-lg font-bold text-[#1f5a04] mb-2">¡Correo enviado!</h3>
                            <p className="text-sm text-[#2d7a0c]/80 mb-6">
                                Hemos enviado un enlace de recuperación a <strong>{email}</strong>. Por favor revisa tu bandeja de entrada y la carpeta de spam.
                            </p>
                            <Link href="/login" className="w-full py-3.5 rounded-xl font-bold text-primary bg-white border border-primary/20 hover:bg-surface transition-all flex items-center justify-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                                Volver al Inicio de Sesión
                            </Link>
                        </div>
                    ) : (
                        /* Estado Normal: Formulario de solicitud */
                        <form onSubmit={handleSubmit} className="space-y-5">
                            
                            {error && (
                                <div className="p-3 text-sm font-medium text-red-700 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-xl flex items-center gap-3">
                                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    {error}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-on-surface-variant ml-1" htmlFor="email">
                                    Correo Electrónico
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary group-focus-within:text-primary transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                    </div>
                                    <input
                                        className="w-full pl-11 pr-4 py-3.5 bg-surface hover:bg-surface-container-highest border border-secondary/20 rounded-xl text-base text-on-surface focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200"
                                        id="email"
                                        type="email"
                                        placeholder="Ej. juan.perez@email.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-4 rounded-xl text-white font-bold text-base tracking-wide transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed
                                               bg-gradient-to-r from-primary via-[#a3722a] to-primary-container
                                               shadow-[0_8px_20px_-6px_rgba(127,86,30,0.5)] 
                                               hover:shadow-[0_12px_25px_-6px_rgba(127,86,30,0.6)] hover:-translate-y-0.5"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center gap-2">
                                            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            Enviando enlace...
                                        </span>
                                    ) : (
                                        <>
                                            <span>Enviar enlace de recuperación</span>
                                            <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Enlace para volver atrás */}
                            <div className="mt-6 text-center">
                                <Link href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-secondary hover:text-primary transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                                    Volver al inicio de sesión
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </section>
        </main>
    );
}