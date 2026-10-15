"use client";

import { useActionState, useState } from "react";
import { changePasswordAction, type ChangePasswordState } from "../action";

const initialState: ChangePasswordState = { success: false };

export function ChangePasswordView() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  if (state.success) {
    return (
      <div className="w-full max-w-[420px] px-6">
        <h2 className="text-2xl font-bold mb-3 text-center">Contraseña actualizada</h2>
        <p className="text-sm text-secondary/80 text-center mb-6">
          Tu contraseña fue actualizada correctamente. Ya puedes continuar usando el sistema.
        </p>
        <a href="/intranet" className="block w-full py-3 rounded-xl text-white font-bold text-center bg-primary hover:bg-primary-container transition-colors">
          Ir al inicio
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="w-full max-w-[420px] px-6 space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Crea tu nueva contraseña</h2>
        <p className="text-sm font-medium text-secondary/80">
          Por seguridad, debes cambiar tu contraseña histórica antes de continuar.
        </p>
      </div>

      {state.message && (
        <div className="p-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl">
          {state.message}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-bold text-on-surface-variant ml-1" htmlFor="newPassword">
          Nueva contraseña
        </label>
        <input
          className="w-full px-4 py-3 bg-surface border border-secondary/20 rounded-xl text-base"
          id="newPassword"
          name="newPassword"
          type={showPassword ? "text" : "password"}
          placeholder="Mínimo 8 caracteres, una mayúscula y un número"
          required
          disabled={pending}
        />
        {state.errors?.newPassword && (
          <p className="text-xs text-red-600">{state.errors.newPassword.join(", ")}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-bold text-on-surface-variant ml-1" htmlFor="confirmPassword">
          Confirmar contraseña
        </label>
        <input
          className="w-full px-4 py-3 bg-surface border border-secondary/20 rounded-xl text-base"
          id="confirmPassword"
          name="confirmPassword"
          type={showPassword ? "text" : "password"}
          placeholder="Repite la contraseña"
          required
          disabled={pending}
        />
        {state.errors?.confirmPassword && (
          <p className="text-xs text-red-600">{state.errors.confirmPassword.join(", ")}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="text-sm font-bold text-secondary hover:text-primary"
      >
        {showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
      </button>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-4 rounded-xl text-white font-bold bg-gradient-to-r from-primary to-primary-container disabled:opacity-70"
      >
        {pending ? "Guardando..." : "Guardar contraseña"}
      </button>
    </form>
  );
}
