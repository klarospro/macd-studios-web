"use client";

import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";

const HeroCanvas = dynamic(() => import("./HeroCanvas"), { ssr: false });

export default function AtlasHero() {
  const reduce = useReducedMotion();
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <section id="top" className="relative grain-fine overflow-hidden">
      {/* Atmósfera */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-10%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-atlas-teal/10 blur-[130px]" />
        <div className="absolute right-[-5%] top-[30%] h-[380px] w-[380px] rounded-full bg-atlas-blue/10 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.5] [background-image:linear-gradient(to_right,#1e2c3f_1px,transparent_1px),linear-gradient(to_bottom,#1e2c3f_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_75%)]" />
      </div>

      <div className="mx-auto grid min-h-[100svh] max-w-6xl items-center gap-8 px-5 pb-16 pt-28 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-4">
        <div className="relative z-10">
          <motion.p {...rise(0)} className="mb-6 inline-flex items-center gap-2 rounded-full border border-atlas-line bg-atlas-panel/60 px-3.5 py-1.5 text-[12px] font-medium tracking-wide text-atlas-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-atlas-teal shadow-[0_0_10px_2px] shadow-atlas-teal/60" />
            Gestión automatizada de capital · MACD Studios
          </motion.p>

          <motion.h1 {...rise(0.08)} className="text-[clamp(2.3rem,5.4vw,4rem)] font-semibold leading-[1.03] text-atlas-ink">
            Gestión de capital automatizada,{" "}
            <span className="bg-gradient-to-r from-atlas-teal to-atlas-blue bg-clip-text text-transparent">con la preservación como primera regla.</span>
          </motion.h1>

          <motion.p {...rise(0.16)} className="mt-6 max-w-xl text-[17px] leading-relaxed text-atlas-muted">
            Varios motores de trading operando bajo una única capa de riesgo. Primero no perder; después crecer.
            Cada operación pasa un control de riesgo antes de existir.
          </motion.p>

          <motion.div {...rise(0.24)} className="mt-9 flex flex-wrap items-center gap-3">
            <a href="#rutas" className="rounded-full bg-gradient-to-r from-atlas-teal to-atlas-blue px-6 py-3 text-[15px] font-semibold text-atlas-bg transition-transform hover:scale-[1.02]">
              Rutas de socio
            </a>
            <a href="#sistema" className="rounded-full border border-atlas-line bg-atlas-panel/50 px-6 py-3 text-[15px] font-semibold text-atlas-ink transition-colors hover:border-atlas-teal/50">
              Cómo funciona
            </a>
          </motion.div>

          <motion.div {...rise(0.34)} className="mt-11 grid max-w-lg grid-cols-3 gap-5 border-t border-atlas-line pt-6">
            {[
              { k: "1%", v: "riesgo máx. por operación" },
              { k: "10%", v: "drawdown → parada total" },
              { k: "24/7", v: "vigilancia automática" },
            ].map((s) => (
              <div key={s.k}>
                <div className="tnum text-2xl font-semibold text-atlas-ink">{s.k}</div>
                <div className="mt-1 text-[12.5px] leading-snug text-atlas-muted">{s.v}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* 3D */}
        <motion.div
          initial={{ opacity: 0, scale: reduce ? 1 : 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto h-[320px] w-full max-w-[520px] sm:h-[440px] lg:h-[560px]"
        >
          <div aria-hidden className="absolute inset-0 rounded-full bg-atlas-teal/10 blur-[90px]" />
          <HeroCanvas />
        </motion.div>
      </div>

      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-atlas-bg" />
    </section>
  );
}
