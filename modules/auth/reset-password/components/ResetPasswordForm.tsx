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
            <div className="bg-[#f0faeb] border border-[#a2e584] rounded-2xl p-6 text-center animate-fade-in">
                 <h3 className="text-lg font-bold text-[#1f5a04] mb-2">¡Contraseña Actualizada!</h3>
                 <p className="text-sm text-[#2d7a0c]/80 mb-6">Serás redirigido al inicio de sesión.</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {state.message && (
                <div className="p-3 text-sm font-medium text-red-700 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-xl">
                    {state.message}
                </div>
            )}
            <div className="space-y-1.5 pb-2">
                <label className="text-sm font-bold text-on-surface-variant ml-1">Código de Verificación (6 dígitos)</label>
                <input
                    className="w-full px-4 py-3 bg-surface border border-secondary/20 rounded-xl text-2xl tracking-[0.5em] text-center font-bold text-primary focus:outline-none focus:border-primary focus:ring-4"
                    type="text" maxLength={6} placeholder="123456"
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    required disabled={isLoading}
                />
            </div>
            
            <div className="space-y-1.5">
                <label className="text-sm font-bold text-on-surface-variant ml-1">Nueva Contraseña</label>
                <input
                    className="w-full pl-4 pr-12 py-3.5 bg-surface border border-secondary/20 rounded-xl text-base text-on-surface focus:outline-none focus:border-primary"
                    type={showPassword ? "text" : "password"}
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    required disabled={isLoading}
                />
                {state.errors?.password && <p className="text-xs text-red-500 mt-1">{state.errors.password[0]}</p>}
            </div>

            <div className="space-y-1.5 pb-2">
                <label className="text-sm font-bold text-on-surface-variant ml-1">Confirmar Contraseña</label>
                <input
                    className="w-full pl-4 pr-12 py-3.5 bg-surface border border-secondary/20 rounded-xl text-base text-on-surface focus:outline-none focus:border-primary"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    required disabled={isLoading}
                />
            </div>

            <button type="submit" disabled={isLoading || code.length < 6} className="w-full py-4 rounded-xl text-white font-bold text-base bg-gradient-to-r from-primary to-primary-container shadow-md">
                {isLoading ? "Validando..." : "Confirmar Cambio"}
            </button>
            <div className="mt-6 text-center">
                <Link href="/login" className="text-sm font-bold text-secondary hover:text-primary">Cancelar y volver al inicio</Link>
            </div>
        </form>
    );
}