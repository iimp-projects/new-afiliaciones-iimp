import { contextService } from "@/modules/auth/context/service";
import { MyEndorsementsView } from "@/modules/afiliaciones/endorsements/Views/MyEndorsementsView";

export const dynamic = "force-dynamic";

export default async function MyEndorsementsPage() {
  await contextService.requireAffiliate();
  return <MyEndorsementsView />;
}
