import { contextService } from "@/modules/auth/context/service";
import { MasterDataView } from "@/modules/master-data/Components/MasterDataView";

export const metadata = { title: "Datos Maestros | Intranet IIMP" };

export default async function MasterDataPage() {
  await contextService.requirePermission("read", "catalogs");
  return <MasterDataView />;
}
