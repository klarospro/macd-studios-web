"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Words } from "./motion";

// El 3D solo en cliente y solo cuando hace falta (WebGL no es SSR-safe).
const HeroCanvas = dynamic(() => import("./HeroCanvas"), { ssr: false });

export default function Hero() {
  const reduce = useReducedMotion();
  // Vídeo diferido: se monta en el primer hueco de inactividad para no competir con
  // el primer pintado (LCP = titular). No se monta con movimiento reducido.
  const [showVideo, setShowVideo] = useState(false);
  useEffect(() => {
    if (reduce) return;
    const supportsIdle = typeof window.requestIdleCallback === "function";
    let idleId = 0;
    let timeoutId = 0;
    if (supportsIdle) idleId = window.requestIdleCallback(() => setShowVideo(true));
    else timeoutId = window.setTimeout(() => setShowVideo(true), 900);
    return () => {
      if (supportsIdle) window.cancelIdleCallback(idleId);
      else clearTimeout(timeoutId);
    };
  }, [reduce]);

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 16, filter: reduce ? "none" : "blur(8px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: 1.2, delay, ease: [0.19, 1, 0.22, 1] as const },
  });

  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden bg-atlas-bg"
    >
      {/* ---------- Capas de fondo ---------- */}
      {/* Vídeo cinematográfico, oscuro y graduado en verde (textura, no protagonista). */}
      {showVideo && (
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-[0.32] [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/atlas-mark-soft.png"
          aria-hidden
        >
          <source src="/videos/planeta.mp4" type="video/mp4" />
        </video>
      )}
      {/* Aurora de marca + rejilla de datos. */}
      <div aria-hidden className="aurora pointer-events-none absolute inset-0" />
      <div aria-hidden className="tech-grid pointer-events-none absolute inset-0 opacity-70" />

      {/* Forma 3D: centrada-derecha en desktop, detrás del texto en móvil. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center md:left-auto md:right-[-6%] md:w-[62%] md:justify-end"
      >
        <div className="h-[92vw] max-h-[680px] w-[92vw] max-w-[680px] opacity-90">
          <HeroCanvas />
        </div>
      </div>

      {/* Degradados de encuadre (legibilidad del texto). */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-atlas-bg via-atlas-bg/45 to-atlas-bg/70" />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_90%,transparent_35%,rgba(10,14,20,0.9))]" />

      {/* ---------- Marca superior ---------- */}
      <motion.div {...fade(0.1)} className="absolute left-0 right-0 top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-7 sm:px-10">
          <div className="flex items-center gap-3">
            <Image src="/atlas-mark-soft.png" alt="" width={44} height={40} priority className="h-8 w-auto" />
            <span className="text-[15px] font-medium tracking-[0.4em] text-atlas-ink">ATLAS</span>
          </div>
          <span className="kicker hidden text-[10.5px] text-atlas-muted sm:block">Sistema de gestión de capital</span>
        </div>
      </motion.div>

      {/* ---------- Contenido ---------- */}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24 sm:px-10 md:pb-32">
        <motion.p {...fade(0.35)} className="kicker mb-7 flex items-center gap-4 text-[11px] text-atlas-gold">
          <span className="h-px w-10 bg-atlas-gold/60" />
          Preservación · Disciplina · 24/7
        </motion.p>

        <h1 className="max-w-4xl text-[clamp(3rem,8vw,6.5rem)] font-normal leading-[0.95] text-atlas-ink">
          <Words text="Capital con visión de **siglo**." stagger={0.11} />
        </h1>

        <motion.p {...fade(1.1)} className="mt-8 max-w-xl text-[18px] font-light leading-relaxed text-atlas-muted sm:text-[19px]">
          Una firma que gestiona patrimonio con precisión y disciplina —operado por un sistema que
          vigila el riesgo sin descanso, con la preservación del capital como primera doctrina.
        </motion.p>

        <motion.div {...fade(1.3)} className="mt-11 flex flex-wrap items-center gap-4">
          <Link
            href="/atlas/solicitud"
            className="group relative overflow-hidden rounded-full bg-atlas-goldsoft px-8 py-3.5 text-[14px] font-semibold tracking-wide text-atlas-bg shadow-[0_0_0_0_rgba(45,212,191,0)] transition-all duration-500 hover:scale-[1.03] hover:shadow-[0_10px_40px_-8px_rgba(45,212,191,0.45)]"
          >
            Solicitar acceso
          </Link>
          <a
            href="#sistema"
            className="text-[14px] font-medium tracking-wide text-atlas-ink/80 underline-offset-8 transition-colors duration-500 hover:text-atlas-ink hover:underline"
          >
            Ver cómo funciona
          </a>
        </motion.div>
      </div>

      {/* ---------- Indicador de scroll ---------- */}
      <motion.div aria-hidden {...fade(1.6)} className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
        <motion.div
          animate={reduce ? {} : { y: [0, 8, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="h-10 w-px bg-gradient-to-b from-atlas-gold/70 to-transparent"
        />
      </motion.div>
    </section>
  );
}
