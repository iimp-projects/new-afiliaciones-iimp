import { contextService } from "@/modules/auth/context/service";
import { AssociateHomeView } from "@/modules/afiliaciones/portal/Views/AssociatePortalViews";
export default async function AssociatePortalHomePage() { return <AssociateHomeView user={await contextService.requireAffiliate()} />; }
