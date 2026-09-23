import type { ReactNode } from "react";
import { contextService } from "@/modules/auth/context/service";
export default async function AssociatePortalLayout({ children }: { children: ReactNode }) { await contextService.requireAffiliate(); return children; }
