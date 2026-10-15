import { requireAuth } from "@/modules/auth/context";
import { ChangePasswordView } from "@/modules/auth/password-change/views/ChangePasswordView";

export default async function ChangePasswordPage() {
  // Solo permite continuar al flujo de cambio; redirige si no hay sesión válida.
  await requireAuth({ allowPasswordChange: true });

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-surface-container-lowest font-sans">
      <section className="w-full flex flex-col items-center py-12">
        <div className="bg-surface p-3 rounded-2xl shadow-sm border border-secondary/10 mb-6">
          <img src="/images/logo-iimp.png" alt="Logo IIMP" className="h-10 w-auto object-contain" />
        </div>
        <ChangePasswordView />
      </section>
    </main>
  );
}
