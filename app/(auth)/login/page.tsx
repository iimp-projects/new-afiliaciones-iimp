"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react"; // Asegúrate de tener esto instalado

export default function LoginPage() {
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
      // Llamamos a la API de NextAuth
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false, // Lo manejamos nosotros manualmente
      });

      if (res?.error) {
        console.error("❌ Error en autenticación:", res.error);
        setError(
          "Correo o contraseña incorrectos. Por favor, intenta de nuevo.",
        );
      } else {
        console.log("✅ Autenticación exitosa. Redirigiendo al panel...");
        // Aquí puedes redirigir según el rol o flujo que desees
        router.push("/intranet");
        router.refresh(); // Refresca para cargar la sesión
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

  return (
    /* Contenedor Principal Fijo */
    <main className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-surface font-sans antialiased">
      {/* =========================================
                LADO IZQUIERDO: HERO SECTION
            ========================================= */}
      <section className="hidden md:flex md:w-[55%] h-full flex-col justify-center items-center relative overflow-hidden bg-primary">
        {/* Capa de fondo usando variable primaria */}
        <div className="absolute inset-0 z-0 bg-primary opacity-95"></div>
        {/* Textura sutil */}
        <div
          className="absolute inset-0 z-0 opacity-20 mix-blend-overlay bg-cover bg-center"
          style={{ backgroundImage: "url('/images/minero.jpg')" }}
        ></div>

        <div className="relative z-10 w-full max-w-2xl px-10">
          {/* Badge */}
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-[4px] bg-white/10 border border-white/20 text-xs font-bold tracking-widest uppercase mb-4 text-white backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            Portal Oficial IIMP
          </span>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 leading-[1.1] tracking-tight text-white drop-shadow-md">
            Impulsando la <br />
            <span className="text-white/80">Minería del Futuro</span>
          </h1>

          <p className="text-base md:text-lg mb-8 text-white/80 font-medium max-w-lg leading-relaxed">
            Accede a nuestra red global, eventos exclusivos y herramientas
            diseñadas para los líderes del sector.
          </p>

          {/* Avatares */}
          <div className="flex items-center gap-6 text-sm font-semibold text-white/90 mb-8">
            <div className="flex -space-x-3">
              <div className="w-10 h-10 rounded-full border-2 border-primary bg-primary-container text-on-primary-container flex items-center justify-center text-xs font-bold">
                I
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-primary bg-surface-variant text-on-surface-variant flex items-center justify-center text-xs font-bold">
                I
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-primary bg-white text-primary flex items-center justify-center text-xs font-bold">
                M
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-primary bg-secondary text-on-secondary flex items-center justify-center text-xs font-bold">
                P
              </div>
            </div>
            <p>
              +10,000 profesionales <br />
              conectados
            </p>
          </div>

          {/* Botones */}
          <div className="flex gap-4 mb-8">
            <button className="flex items-center gap-2 bg-surface text-primary px-6 h-12 rounded-xl font-bold hover:bg-surface-container-highest transition-colors shadow-sm">
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
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                ></path>
              </svg>
              Iniciar Afiliación
            </button>
            <button className="flex items-center gap-2 border-2 border-white/30 text-white px-6 h-12 rounded-xl font-bold hover:bg-white/10 transition-colors">
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                ></path>
              </svg>
              Consultar Estado
            </button>
          </div>

          <div className="mt-8">
            <a
              href="mailto:liset.otoya@iimp.org.pe"
              className="text-sm font-semibold text-white hover:underline flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                ></path>
              </svg>
              ¿Necesitas ayuda? Escríbenos aquí
            </a>
          </div>
        </div>
      </section>

      {/* =========================================
                LADO DERECHO: LOGIN FORM
            ========================================= */}
      <section className="w-full md:w-[45%] h-full flex flex-col justify-center items-center relative overflow-hidden bg-surface-container-lowest">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-container/20 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4"></div>

        <div className="w-full max-w-[420px] px-6 relative z-10">
          {/* Header del Formulario */}
          <div className="text-center mb-8 flex flex-col items-center">
            <div className="bg-surface p-4 rounded-2xl border border-outline-variant mb-4 shadow-sm">
              <img
                src="/images/logo-iimp.png"
                alt="Logo IIMP"
                className="h-12 w-auto object-contain"
              />
            </div>
            <h2 className="text-3xl font-extrabold mb-2 text-on-surface tracking-tight">
              Intranet de Asociados
            </h2>
            <p className="text-sm font-medium text-secondary">
              Ingresa tus credenciales para acceder a tu panel
            </p>
          </div>

          {error && (
            <div className="p-3 mb-5 text-sm font-medium text-error bg-error-container border border-error/20 rounded-xl flex items-center gap-3">
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
              {error}
            </div>
          )}

          {/* Formulario Estructurado */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Input Email */}
            <div>
              <label
                className="block text-sm font-bold text-on-surface-variant mb-2 ml-1"
                htmlFor="email"
              >
                Correo Electrónico / DNI
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
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    ></path>
                  </svg>
                </div>
                {/* Clases unificadas: h-12, border-outline, bg-surface */}
                <input
                  className="w-full h-12 pl-11 pr-4 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium placeholder-secondary/50"
                  id="email"
                  type="text"
                  placeholder="Ej. juan.perez@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Input Contraseña */}
            <div>
              <label
                className="block text-sm font-bold text-on-surface-variant mb-2 ml-1"
                htmlFor="contrasena"
              >
                Contraseña
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
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    ></path>
                  </svg>
                </div>
                <input
                  className="w-full h-12 pl-11 pr-12 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium placeholder-secondary/50"
                  id="contrasena"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-secondary hover:text-primary transition-colors focus:outline-none rounded-lg"
                >
                  {showPassword ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      ></path>
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      ></path>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      ></path>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Recordarme & Recuperar Contraseña */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input
                    className="peer appearance-none w-5 h-5 border-2 border-outline-variant rounded-[4px] cursor-pointer checked:bg-primary checked:border-primary transition-all"
                    type="checkbox"
                  />
                  <svg
                    className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    ></path>
                  </svg>
                </div>
                <span className="text-sm font-semibold text-secondary group-hover:text-on-surface transition-colors">
                  Recordarme
                </span>
              </label>
              <Link
                href="/recuperar-password"
                className="text-sm font-bold text-primary hover:text-primary/80 transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {/* Botón Ingresar */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 rounded-xl text-on-primary bg-primary font-bold text-sm tracking-wide hover:brightness-90 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-5 w-5 text-on-primary"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Validando...
                  </span>
                ) : (
                  <>
                    Ingresar a la Plataforma
                    <svg
                      className="w-4 h-4 ml-1"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      ></path>
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Separador de Redes Sociales */}
          <div className="my-6 relative flex items-center">
            <div className="flex-grow border-t border-outline-variant"></div>
            <span className="flex-shrink-0 mx-4 text-xs font-bold text-secondary uppercase tracking-wider">
              o continuar con
            </span>
            <div className="flex-grow border-t border-outline-variant"></div>
          </div>

          {/* Botones Sociales Estandarizados */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleSocialLogin("google")}
              className="flex items-center justify-center gap-2 h-12 px-4 rounded-xl border border-outline-variant bg-surface hover:bg-surface-container-highest transition-all duration-200 text-sm font-bold text-on-surface shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google
            </button>
            <button
              onClick={() => handleSocialLogin("linkedin")}
              className="flex items-center justify-center gap-2 h-12 px-4 rounded-xl border border-outline-variant bg-surface hover:bg-surface-container-highest transition-all duration-200 text-sm font-bold text-on-surface shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                color="#0A66C2"
              >
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              LinkedIn
            </button>
          </div>

          <p className="mt-8 text-center text-sm font-medium text-secondary">
            ¿No tienes una cuenta?{" "}
            <Link
              href="/postulacion"
              className="font-bold text-primary hover:underline underline-offset-4 transition-all"
            >
              Afíliate aquí
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
