import type { Metadata } from "next";
import LuxNav from "@/components/atlas/lux/LuxNav";
import Hero from "@/components/atlas/lux/Hero";
import Manifiesto from "@/components/atlas/lux/Manifiesto";
import Fortalezas from "@/components/atlas/lux/Fortalezas";
import Metricas from "@/components/atlas/lux/Metricas";
import Enfoque from "@/components/atlas/lux/Enfoque";
import Confianza from "@/components/atlas/lux/Confianza";
import CTAFinal from "@/components/atlas/lux/CTAFinal";
import LuxFooter from "@/components/atlas/lux/LuxFooter";

export const metadata: Metadata = {
  title: "ATLAS — Firma de inversión privada | Gestión de patrimonio",
  description:
    "ATLAS gestiona patrimonio con precisión, disciplina y visión global. La preservación del capital como primera doctrina. Un proyecto de MACD Studios.",
};

export default function AtlasPage() {
  return (
    <div className="atlas min-h-screen antialiased">
      <LuxNav />
      <main>
        <Hero />
        <Manifiesto />
        <Fortalezas />
        <Metricas />
        <Enfoque />
        <Confianza />
        <CTAFinal />
      </main>
      <LuxFooter />
    </div>
  );
}
