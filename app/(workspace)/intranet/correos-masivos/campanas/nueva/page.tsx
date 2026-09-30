import { contextService } from "@/modules/auth/context/service";
import { CampaignForm } from "@/modules/communications/Views/CampaignForm";

export const metadata = { title: "Nueva campaña | Correos Masivos | Intranet IIMP" };

export default async function NuevaCampanaPage() {
  await contextService.requireRole(["SUPER_ADMIN"]);
  return (
    <main className="mx-auto w-full max-w-[1200px] p-6 md:p-8">
      <div className="mb-4">
        <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#C79A3B]">Campaña</p>
        <h1 className="text-2xl font-black tracking-tight text-slate-800">Nueva campaña</h1>
      </div>
      <CampaignForm />
    </main>
  );
}
