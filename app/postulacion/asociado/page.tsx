import ApplicationView from "@/modules/afiliaciones/postulacion/Views/ApplicationView";
import { MembershipType } from "@/modules/afiliaciones/postulacion/Types/MembershipType";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ trackingCode?: string }>;
}) {
  // Capturamos el código de seguimiento directamente desde la URL
  const resolvedParams = await searchParams;

  return (
    <ApplicationView
      membershipType={MembershipType.ACTIVE}
      trackingCode={resolvedParams.trackingCode} // <-- ¡Se lo pasamos al Orquestador!
    />
  );
}