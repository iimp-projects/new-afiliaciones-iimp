import { ConsultaView } from "@/modules/afiliaciones/consulta/Views/ConsultaView";

interface ConsultaPageProps {
  searchParams: Promise<{ payment_callback?: string | string[] }>;
}

export default async function ConsultaPage({ searchParams }: ConsultaPageProps) {
  const params = await searchParams;
  const paymentCallback = Array.isArray(params.payment_callback)
    ? params.payment_callback[0]
    : params.payment_callback;

  return <ConsultaView initialPaymentCallback={paymentCallback} />;
}
