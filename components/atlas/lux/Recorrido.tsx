"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BlurReveal } from "./motion";

/* Conector con punto que viaja (la "transición" del dinero de un paso al siguiente). */
function Flow({ vertical = false }: { vertical?: boolean }) {
  const reduce = useReducedMotion();
  if (vertical) {
    return (
      <div className="relative mx-auto my-1 h-8 w-px bg-atlas-line md:hidden">
        {!reduce && (
          <motion.span
            className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-atlas-goldsoft"
            animate={{ top: ["0%", "100%"], opacity: [0, 1, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>
    );
  }
  return (
    <div className="relative hidden h-px flex-1 self-center bg-atlas-line md:block">
      {!reduce && (
        <motion.span
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-atlas-goldsoft"
          animate={{ left: ["0%", "100%"], opacity: [0, 1, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}

function Node({
  icon,
  step,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col items-center rounded-2xl border border-atlas-line bg-atlas-panel/40 p-6 text-center md:w-[210px] md:flex-none">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-atlas-line bg-atlas-bg/50 text-atlas-goldsoft">
        {icon}
      </div>
      <span className="kicker text-[9.5px] text-atlas-gold">{step}</span>
      <h3 className="mt-1.5 text-[16px] font-medium text-atlas-ink">{title}</h3>
      <p className="mt-1.5 text-[13px] font-light leading-snug text-atlas-muted">{desc}</p>
      {children}
    </div>
  );
}

/* --- iconos --- */
const IWallet = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
    <rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M16 14h2" strokeLinecap="round" />
  </svg>
);
const ISwap = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M4 8h13l-3-3M20 16H7l3 3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IPie = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
    <circle cx="12" cy="12" r="8" /><path d="M12 4v8l6 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ITrend = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M4 17l5-5 3 3 8-8M15 4h6v6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RESPALDO = [
  { v: "$1M", k: "Fondeo gestionado" },
  { v: "60%", k: "Win rate (trayectoria)" },
  { v: "Multi-activo", k: "Diversificación real" },
  { v: "Largo plazo", k: "Horizonte de gestión" },
];

export default function Recorrido() {
  return (
    <section id="sistema" className="relative border-t border-atlas-line/50 py-28 md:py-40">
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <BlurReveal className="mb-14 md:mb-16">
          <p className="kicker mb-6 text-[11px] text-atlas-gold">Respaldo y recorrido</p>
          <h2 className="max-w-2xl text-[clamp(2rem,4.4vw,3.4rem)] font-normal leading-[1.08] text-atlas-ink">
            Dónde trabaja tu capital.
          </h2>
          <p className="mt-5 max-w-xl text-[16px] font-light leading-relaxed text-atlas-muted">
            Detrás de Atlas hay experiencia real gestionando capital —incluida una cuenta de fondeo de
            un millón con un 60% de aciertos— y un método que diversifica cada euro con disciplina.
          </p>
        </BlurReveal>

        {/* Respaldo / trayectoria */}
        <BlurReveal>
          <div className="mb-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-atlas-line bg-atlas-line md:mb-20 md:grid-cols-4">
            {RESPALDO.map((r) => (
              <div key={r.k} className="bg-atlas-bg px-5 py-6 text-center">
                <div className="display-num text-[clamp(1.6rem,3vw,2.4rem)] text-atlas-goldsoft">{r.v}</div>
                <div className="mt-1.5 text-[12px] font-light text-atlas-muted">{r.k}</div>
              </div>
            ))}
          </div>
        </BlurReveal>

        {/* Mapa del recorrido del dinero */}
        <BlurReveal delay={0.1}>
          <div className="flex flex-col items-stretch md:flex-row md:items-stretch">
            <Node icon={IWallet} step="01" title="Depositas" desc="Tu capital entra al fondo gestionado, en tu modalidad." />
            <Flow vertical /><Flow />
            <Node icon={ISwap} step="02" title="Entra al sistema" desc="Se asigna a cripto o directo al broker, según la oportunidad." />
            <Flow vertical /><Flow />
            <Node icon={IPie} step="03" title="Se diversifica" desc="Repartido entre varias clases de activo bajo un único control de riesgo.">
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {["Acciones", "Fondeos", "ETF"].map((t) => (
                  <span key={t} className="rounded-full border border-atlas-gold/30 px-2.5 py-0.5 text-[11px] text-atlas-goldsoft">{t}</span>
                ))}
              </div>
            </Node>
            <Flow vertical /><Flow />
            <Node icon={ITrend} step="04" title="Crece a largo plazo" desc="Compone con paciencia; las caídas se limitan por diseño." />
          </div>
        </BlurReveal>

        <BlurReveal delay={0.2}>
          <p className="mt-10 text-[11.5px] font-light leading-relaxed text-atlas-muted/70">
            Cifras de trayectoria aportadas por el gestor, a título ilustrativo. Los resultados pasados no
            garantizan resultados futuros; los rendimientos son objetivos, no garantías. No es
            asesoramiento de inversión.
          </p>
        </BlurReveal>
      </div>
    </section>
  );
}
