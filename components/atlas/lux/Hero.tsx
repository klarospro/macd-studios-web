"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CinemaImage, Words } from "./motion";

const MOUNTAINS = "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=2000&q=70";

export default function Hero() {
  const reduce = useReducedMotion();
  const fade = (delay: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 16, filter: reduce ? "none" : "blur(8px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: 1.2, delay, ease: [0.19, 1, 0.22, 1] as const },
  });

  return (
    <section id="top" className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden">
      <CinemaImage
        src={MOUNTAINS}
        priority
        overlay={
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-atlas-bg via-atlas-bg/55 to-atlas-bg/70" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,transparent_30%,rgba(10,10,11,0.85))]" />
          </>
        }
      />

      {/* Marca superior */}
      <motion.div {...fade(0.1)} className="absolute left-0 right-0 top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-8 sm:px-10">
          <span className="text-[15px] font-medium tracking-[0.42em] text-atlas-ink">ATLAS</span>
          <span className="kicker hidden text-[10.5px] text-atlas-muted sm:block">Firma de inversión privada</span>
        </div>
      </motion.div>

      {/* Contenido */}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24 sm:px-10 md:pb-32">
        <motion.p {...fade(0.35)} className="kicker mb-7 flex items-center gap-4 text-[11px] text-atlas-gold">
          <span className="h-px w-10 bg-atlas-gold/60" />
          Patrimonio · Estrategia · Largo plazo
        </motion.p>

        <h1 className="max-w-4xl text-[clamp(3rem,8vw,6.5rem)] font-normal leading-[0.95] text-atlas-ink">
          <Words text="Capital con visión de **siglo**." stagger={0.11} />
        </h1>

        <motion.p {...fade(1.1)} className="mt-8 max-w-xl text-[18px] font-light leading-relaxed text-atlas-muted sm:text-[19px]">
          Una firma que gestiona patrimonio con precisión y disciplina —con la preservación del
          capital como primera doctrina.
        </motion.p>

        <motion.div {...fade(1.3)} className="mt-11 flex flex-wrap items-center gap-4">
          <a
            href="#cta"
            className="group relative overflow-hidden rounded-full bg-atlas-goldsoft px-8 py-3.5 text-[14px] font-semibold tracking-wide text-atlas-bg transition-transform duration-500 hover:scale-[1.03]"
          >
            Solicitar dossier
          </a>
          <a
            href="#manifiesto"
            className="text-[14px] font-medium tracking-wide text-atlas-ink/80 underline-offset-8 transition-colors duration-500 hover:text-atlas-ink hover:underline"
          >
            Conocer la firma
          </a>
        </motion.div>
      </div>

      {/* Indicador de scroll */}
      <motion.div
        aria-hidden
        {...fade(1.6)}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
      >
        <motion.div
          animate={reduce ? {} : { y: [0, 8, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="h-10 w-px bg-gradient-to-b from-atlas-gold/70 to-transparent"
        />
      </motion.div>
    </section>
  );
}
