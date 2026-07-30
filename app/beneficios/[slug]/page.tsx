import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import NetworkingHero from "@/components/benefits/NetworkingHero";

interface BenefitPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function BenefitDetailPage({ params }: BenefitPageProps) {
  const { slug } = await params;

  const benefit = await prisma.benefit.findUnique({
    where: { slug },
  });

  if (!benefit) {
    notFound();
  }

  // Si es networking carga la landing especial
  if (slug === "networking-alto-nivel") {
    return <NetworkingHero benefit={benefit} />;
  }

  // Fallback temporal para las otras páginas mientras las diseñamos
  return <NetworkingHero benefit={benefit} />;
}