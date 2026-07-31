"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SmartCaseRow } from "@/modules/shared/Components/SmartCaseCard/SmartCaseRow";
import type { SmartCaseCardData } from "@/modules/shared/Components/SmartCaseCard/types";

export function AfiliacionRowAdapter({ data }: { data: SmartCaseCardData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleOpenDrawer = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("case", data.trackingCode);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return <SmartCaseRow data={data} onClick={handleOpenDrawer} />;
}