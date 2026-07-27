"use client";

import Link from "next/link";
import { useForgotPassword } from "../hooks/useForgotPassword";

export function ForgotPasswordForm() {
  const { email, setEmail, isLoading, state, handleSubmit } =
    useForgotPassword();

  if (state.success) {
    return (
      <div className="bg-[#f0faeb] border border-[#a2e584] rounded-2xl p-6 text-center animate-fade-in">
        <div className="w-16 h-16 bg-[#a2e584]/20 text-[#2d7a0c] rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
        </div>
        <h3 className="text-lg font-bold text-[#1f5a04] mb-2">
          ¡Solicitud enviada!
        </h3>
        <p className="text-sm text-[#2d7a0c]/80 mb-6">
          {state.message} a <strong>{email}</strong>.
        </p>
        <Link
          href={`/reset-password?email=${encodeURIComponent(email)}`}
          className="w-full py-3.5 rounded-xl text-white font-bold text-base bg-gradient-to-r from-primary to-primary-container shadow-md flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all"
        >
          Ya tengo mi código, continuar
          <svg
            className="w-5 h-5 ml-1"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            ></path>
          </svg>
        </Link>
        <div className="mt-4">
          <Link
            href="/login"
            className="text-sm font-bold text-secondary hover:text-primary transition-colors"
          >
            Volver al Inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {state.message && !state.success && (
        <div className="p-3 text-sm font-medium text-red-700 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-xl flex items-center gap-3">
          <svg
            className="w-5 h-5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          {state.message}
        </div>
      )}
      <div className="space-y-1.5">
        <label
          className="text-sm font-bold text-on-surface-variant ml-1"
          htmlFor="email"
        >
          Correo Electrónico
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary group-focus-within:text-primary transition-colors">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              ></path>
            </svg>
          </div>
          <input
            className="w-full pl-11 pr-4 py-3.5 bg-surface hover:bg-surface-container-highest border border-secondary/20 rounded-xl text-base text-on-surface focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200"
            id="email"
            type="email"
            placeholder="Ej. max@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        {state.errors?.email && (
          <p className="text-xs text-red-500 mt-1">{state.errors.email[0]}</p>
        )}
      </div>
      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 rounded-xl text-white font-bold text-base tracking-wide transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed bg-gradient-to-r from-primary via-[#a3722a] to-primary-container shadow-[0_8px_20px_-6px_rgba(127,86,30,0.5)] hover:shadow-[0_12px_25px_-6px_rgba(127,86,30,0.6)] hover:-translate-y-0.5"
        >
          {isLoading ? "Enviando enlace..." : "Enviar enlace de recuperación"}
        </button>
      </div>
      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-bold text-secondary hover:text-primary transition-colors"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    </form>
  );
}
