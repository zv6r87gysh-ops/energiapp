import EnergyApp from "@/components/energy-app";
import { sections } from "@/lib/demo";
import { notFound } from "next/navigation";
export function generateStaticParams() {
  return sections
    .filter((s) => s.id !== "oversikt")
    .map((s) => ({ section: s.id }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.some((s) => s.id === section)) notFound();
  return <EnergyApp section={section} />;
}
