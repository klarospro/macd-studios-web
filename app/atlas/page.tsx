import type { Metadata } from "next";
import AtlasNav from "@/components/atlas/AtlasNav";
import AtlasHero from "@/components/atlas/AtlasHero";
import Problema from "@/components/atlas/Problema";
import Solucion from "@/components/atlas/Solucion";
import Sistema from "@/components/atlas/Sistema";
import Preservacion from "@/components/atlas/Preservacion";
import Rutas from "@/components/atlas/Rutas";
import CTA from "@/components/atlas/CTA";
import AtlasFooter from "@/components/atlas/AtlasFooter";

export const metadata: Metadata = {
  title: "Atlas AI — Gestión de capital automatizada | MACD Studios",
  description:
    "Varios motores de trading bajo una única capa de riesgo. La preservación de capital como primera regla. Un proyecto de MACD Studios.",
};

export default function AtlasPage() {
  return (
    <div className="atlas min-h-screen antialiased">
      <AtlasNav />
      <main>
        <AtlasHero />
        <Problema />
        <Solucion />
        <Sistema />
        <Preservacion />
        <Rutas />
        <CTA />
      </main>
      <AtlasFooter />
    </div>
  );
}
