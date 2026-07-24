"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

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

    console.log("🔍 Iniciando intento de login con:", { email });

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        console.error("❌ Error en autenticación:", res.error);
        setError("Correo o contraseña incorrectos. Por favor, intenta de nuevo.");
      } else {
        console.log("✅ Autenticación exitosa. Redirigiendo al panel...");
        router.push("/intranet");
        router.refresh();
      }
    } catch (err) {
      console.error("💥 Error crítico en el proceso de login:", err);
      setError("Ocurrió un error inesperado al conectar con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    console.log(`🚀 Iniciando sesión social con: ${provider}`);
    // Aquí iría la lógica de signIn(provider)
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    error,
    isLoading,
    showPassword,
    setShowPassword,
    handleSubmit,
    handleSocialLogin,
  };
}