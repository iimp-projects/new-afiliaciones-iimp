import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import BenefitDetailHero from "@/components/benefits/BenefitDetailHero";

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

  return <BenefitDetailHero benefit={benefit} />;
}