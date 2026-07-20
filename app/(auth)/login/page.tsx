import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Iniciar sesión | IIMP",
  description: "Accede al portal administrativo del IIMP",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-4 sm:p-8 bg-background">
      <div className="w-full max-w-[400px] flex-col flex gap-8">
        <div className="flex flex-col items-center space-y-3 text-center">
          {/* Logo Placeholder */}
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-900 shadow-sm">
            <span className="text-xl font-bold tracking-tighter text-white">IIMP</span>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Bienvenido de nuevo
            </h1>
            <p className="text-sm text-zinc-500">
              Ingresa tus credenciales para acceder a tu cuenta
            </p>
          </div>
        </div>
        
        <LoginForm />
      </div>
    </main>
  );
}