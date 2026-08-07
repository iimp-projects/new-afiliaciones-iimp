"use client";

import Link from "next/link";
import { useResetPassword } from "../hooks/useResetPassword";

export function ResetPasswordForm() {
    const { 
        code, setCode, 
        newPassword, setNewPassword, 
        confirmPassword, setConfirmPassword, 
        showPassword, setShowPassword, 
        isLoading, state, handleSubmit 
    } = useResetPassword();

    if (state.success) {
        return (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center animate-fade-in">
                 <h3 className="text-lg font-bold text-emerald-800 mb-2">¡Contraseña Actualizada!</h3>
                 <p className="text-sm text-emerald-700/80 mb-6">Serás redirigido al inicio de sesión.</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {state.message && (
                <div className="p-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    {state.message}
                </div>
            )}
            
            {/* CÓDIGO DE VERIFICACIÓN */}
            <div className="space-y-1.5">
                <label className="block text-sm font-bold text-on-surface-variant mb-2 ml-1">
                    Código de Verificación (6 dígitos)
                </label>
                <input
                    className="w-full h-14 bg-surface border border-outline-variant rounded-xl text-2xl tracking-[0.5em] text-center font-bold text-primary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:tracking-normal placeholder:font-medium placeholder:text-base placeholder:text-secondary/50"
                    type="text" maxLength={6} placeholder="123456"
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    required disabled={isLoading}
                />
            </div>
            
            {/* NUEVA CONTRASEÑA */}
            <div className="space-y-1.5">
                <label className="block text-sm font-bold text-on-surface-variant mb-2 ml-1">
                    Nueva Contraseña
                </label>
                <div className="relative group">
                    <input
                        className="w-full h-12 pl-4 pr-12 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium placeholder-secondary/50"
                        type={showPassword ? "text" : "password"}
                        placeholder="Mínimo 8 caracteres"
                        value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                        required disabled={isLoading}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-secondary hover:text-primary transition-colors focus:outline-none rounded-lg cursor-pointer"
                        title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                    >
                        {showPassword ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        )}
                    </button>
                </div>
                {state.errors?.password && <p className="text-xs text-red-500 mt-1">{state.errors.password[0]}</p>}
            </div>

            {/* CONFIRMAR CONTRASEÑA */}
            <div className="space-y-1.5 pb-2">
                <label className="block text-sm font-bold text-on-surface-variant mb-2 ml-1">
                    Confirmar Contraseña
                </label>
                <div className="relative group">
                    <input
                        className="w-full h-12 pl-4 pr-12 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium placeholder-secondary/50"
                        type={showPassword ? "text" : "password"}
                        placeholder="Repite la contraseña"
                        value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                        required disabled={isLoading}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-secondary hover:text-primary transition-colors focus:outline-none rounded-lg cursor-pointer"
                        title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                    >
                        {showPassword ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        )}
                    </button>
                </div>
            </div>

            <div className="pt-2">
                <button 
                    type="submit" 
                    disabled={isLoading} 
                    className="w-full h-12 rounded-xl text-on-primary bg-primary font-bold text-sm tracking-wide hover:brightness-90 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                    {isLoading ? "Validando..." : "Confirmar Cambio"}
                </button>
            </div>
            
            <div className="mt-6 text-center">
                <Link href="/login" className="text-sm font-bold text-secondary hover:text-primary transition-colors">
                    Cancelar y volver al inicio
                </Link>
            </div>
        </form>
    );
}