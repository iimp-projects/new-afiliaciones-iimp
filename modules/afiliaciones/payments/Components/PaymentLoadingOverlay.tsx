"use client";

import { ProcessLoadingOverlay } from "@/modules/shared/Components/ProcessLoadingOverlay";

interface Props { title: string; description: string; secondaryText?: string; }

export function PaymentLoadingOverlay({ title, description }: Props) {
  return <ProcessLoadingOverlay open title={title} description={description} variant="payment" />;
}
