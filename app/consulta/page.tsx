import { ConsultaView } from "@/modules/afiliaciones/consulta/Views/ConsultaView";

interface ConsultaPageProps {
  searchParams: Promise<{ payment_restore?: string | string[] }>;
}

export default async function ConsultaPage({ searchParams }: ConsultaPageProps) {
  const params = await searchParams;
  const paymentCallback = Array.isArray(params.payment_restore)
    ? params.payment_restore[0]
    : params.payment_restore;

  return <ConsultaView initialPaymentCallback={paymentCallback} />;
}
