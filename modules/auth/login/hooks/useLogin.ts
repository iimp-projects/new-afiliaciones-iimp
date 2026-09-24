"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { checkLockStatus } from "../action"; // Importamos la nueva función
import { resolveCredentialsLogin } from "../submit-login";

export function useLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const submittingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError("");
    setIsLoading(true);

    const result = await resolveCredentialsLogin(
      { email, password },
      {
        checkLockStatus,
        signIn: (options) =>
          signIn("credentials", {
            email: options.email,
            password: options.password,
            redirect: false,
          }),
      },
    );

    if (result.keepLoading) {
      // Éxito: mantenemos el estado de carga hasta que la navegación
      // saque al usuario de /login. No restaurar isLoading aquí.
      router.replace("/intranet");
      return;
    }

    setError(result.errorMessage ?? "");
    setIsLoading(false);
    submittingRef.current = false;
  };

  const handleSocialLogin = (provider: string) => {
    console.log(`Iniciando sesión social con: ${provider}`);
  };

  // NUEVO: Función para cerrar la alerta
  const clearError = () => setError(""); 

  return {
    email, setEmail,
    password, setPassword,
    error, setError, clearError, // <-- Exportamos clearError
    isLoading,
    showPassword, setShowPassword,
    handleSubmit, handleSocialLogin,
  };
}
