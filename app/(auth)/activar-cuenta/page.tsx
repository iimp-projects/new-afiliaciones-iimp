import { ActivationView } from "@/modules/auth/account-activation/ActivationView";
import { accountActivationService } from "@/modules/auth/account-activation/service";

interface ActivateAccountPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

export default async function ActivateAccountPage({ searchParams }: ActivateAccountPageProps) {
  const token = (await searchParams).token;
  const rawToken = typeof token === "string" ? token : "";
  const activation = rawToken ? await accountActivationService.getActivationDetails(rawToken) : null;
  return <ActivationView token={activation ? rawToken : null} email={activation?.email ?? null} />;
}
