"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { checkLockStatus } from "../action"; // Importamos la nueva función

export function useLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // 1. Verificamos si la cuenta YA está bloqueada antes de tocar NextAuth
      const preCheck = await checkLockStatus(email);
      if (preCheck.locked) {
        setError(preCheck.message!);
        setIsLoading(false);
        return;
      }

      // 2. Intentamos iniciar sesión
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        // 3. Si falló, verificamos si ESTE último intento acaba de bloquear la cuenta
        const postCheck = await checkLockStatus(email);
        if (postCheck.locked) {
          setError(postCheck.message!);
        } else {
          setError("Correo o contraseña incorrectos. Por favor, intenta de nuevo.");
        }
      } else {
        router.push("/intranet");
        router.refresh();
      }
    } catch (err) {
      setError("Ocurrió un error inesperado al conectar con el servidor.");
    } finally {
      setIsLoading(false);
    }
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