"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SmartCaseCard } from "@/modules/shared/Components/SmartCaseCard/SmartCaseCard";
import type { SmartCaseCardData } from "@/modules/shared/Components/SmartCaseCard/types";

export function AfiliacionCardAdapter({ data }: { data: SmartCaseCardData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleOpenDrawer = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("case", data.trackingCode);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return <SmartCaseCard data={data} onClick={handleOpenDrawer} />;
}