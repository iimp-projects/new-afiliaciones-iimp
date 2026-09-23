import { contextService } from "@/modules/auth/context/service";
import { MembershipView } from "@/modules/afiliaciones/portal/Views/AssociatePortalViews";
export default async function MembershipPage() { return <MembershipView user={await contextService.requireAffiliate()} />; }
