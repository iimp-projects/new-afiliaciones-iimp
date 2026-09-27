import { contextService } from "@/modules/auth/context/service";
import { InternalProfileView } from "@/modules/profile/Components/InternalProfileView";

export default async function InternalProfilePage() {
  await contextService.requireAdministrativeUser();
  return <InternalProfileView />;
}
