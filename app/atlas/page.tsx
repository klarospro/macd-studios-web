import type { Metadata } from "next";
import LuxNav from "@/components/atlas/lux/LuxNav";
import Hero from "@/components/atlas/lux/Hero";
import Problema from "@/components/atlas/lux/Problema";
import Solucion from "@/components/atlas/lux/Solucion";
import Manifiesto from "@/components/atlas/lux/Manifiesto";
import Enfoque from "@/components/atlas/lux/Enfoque";
import Recorrido from "@/components/atlas/lux/Recorrido";
import Metricas from "@/components/atlas/lux/Metricas";
import Historial from "@/components/atlas/lux/Historial";
import Modalidades from "@/components/atlas/lux/Modalidades";
import Testimonios from "@/components/atlas/lux/Testimonios";
import CTAFinal from "@/components/atlas/lux/CTAFinal";
import { CinematicFooter } from "@/components/ui/motion-footer";

export const metadata: Metadata = {
  title: "ATLAS — Gestión automatizada de capital | Sistema 24/7",
  description:
    "ATLAS gestiona patrimonio con un sistema disciplinado: preservación del capital, riesgo controlado y ejecución automática 24/7. Un proyecto de MACD Studios.",
};

export default function AtlasPage() {
  return (
    <div className="atlas min-h-screen antialiased">
      <LuxNav />
      <main className="relative z-10 bg-atlas-bg">
        {/* Zona de impacto */}
        <Hero />

        {/* Narrativa del dossier: reto → solución */}
        <Problema />
        <Solucion />

        {/* Interludio cinematográfico (gravedad para el inversor) */}
        <Manifiesto />

        {/* Cómo funciona el sistema: método + recorrido del capital */}
        <Enfoque />
        <Recorrido />

        {/* Preservación de capital: cifras + zona de datos (curva de equity) */}
        <Metricas />
        <Historial />

        {/* Rutas de socio: capital / accionista / producto */}
        <Modalidades />

        {/* Prueba social + cierre */}
        <Testimonios />
        <CTAFinal />
      </main>

      {/* Footer cinematográfico (curtain reveal + GSAP). Se revela por debajo del
          contenido al llegar al final. Reemplaza al LuxFooter estático. */}
      <CinematicFooter />
    </div>
  );
}
