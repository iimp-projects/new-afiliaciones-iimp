import { contextService } from "@/modules/auth/context/service";
import { AssociateIntegrationsView } from "@/modules/afiliaciones/associates-integration/Views/AssociateIntegrationsView";
export const metadata={title:"Integraciones de Asociados | Intranet IIMP"};
export default async function Page(){await contextService.requireRole(["SUPER_ADMIN"]);return <AssociateIntegrationsView/>}
