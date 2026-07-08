"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BlurReveal } from "./motion";

/* ----------------------- Ilustraciones SVG animadas ----------------------- */

// Ahorro → monedas que se apilan y crecen (capital que trabaja).
function IconAhorro() {
  const reduce = useReducedMotion();
  const coin = (cy: number, delay: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 8 },
    animate: reduce ? { opacity: 1 } : { opacity: 1, y: [8, 0, 8] },
    transition: { duration: 2.6, delay, repeat: Infinity, ease: "easeInOut" as const },
    cy,
  });
  return (
    <svg viewBox="0 0 64 64" className="h-11 w-11" fill="none" aria-hidden>
      {[
        { cy: 44, d: 0 },
        { cy: 34, d: 0.35 },
        { cy: 24, d: 0.7 },
      ].map((c, i) => {
        const p = coin(c.cy, c.d);
        return (
          <motion.ellipse
            key={i}
            cx={32}
            cy={p.cy}
            rx={16}
            ry={5.2}
            stroke="#2dd4bf"
            strokeWidth={2}
            fill="#2dd4bf"
            fillOpacity={0.12}
            initial={p.initial}
            animate={p.animate}
            transition={p.transition}
          />
        );
      })}
      <motion.path
        d="M32 20 L32 10 M27 14 L32 9 L37 14"
        stroke="#7fe9dd"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ opacity: 0.4 }}
        animate={reduce ? { opacity: 1 } : { opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </svg>
  );
}

// Accionista → anillo partido 50/50 que se dibuja.
function IconAccionista() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 64 64" className="h-11 w-11" fill="none" aria-hidden>
      <motion.path
        d="M32 12 A20 20 0 0 1 32 52"
        stroke="#2dd4bf"
        strokeWidth={4}
        strokeLinecap="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, repeat: reduce ? 0 : Infinity, repeatType: "reverse", repeatDelay: 1.2, ease: "easeInOut" }}
      />
      <motion.path
        d="M32 12 A20 20 0 0 0 32 52"
        stroke="#7fe9dd"
        strokeWidth={4}
        strokeOpacity={0.45}
        strokeLinecap="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, repeat: reduce ? 0 : Infinity, repeatType: "reverse", repeatDelay: 1.2, ease: "easeInOut" }}
      />
      <line x1="32" y1="10" x2="32" y2="54" stroke="#0a0e14" strokeWidth={3} />
      <text x="20" y="36" fill="#eef4f3" fontSize="9" fontFamily="var(--font-mono)">50</text>
      <text x="37" y="36" fill="#9aa8b6" fontSize="9" fontFamily="var(--font-mono)">50</text>
    </svg>
  );
}

// Plantilla → un sistema (tarjeta) que se replica.
function IconPlantilla() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 64 64" className="h-11 w-11" fill="none" aria-hidden>
      <motion.rect
        x={22} y={14} width={26} height={30} rx={4}
        stroke="#2dd4bf" strokeWidth={2} fill="#2dd4bf" fillOpacity={0.06}
        initial={{ x: 22, y: 14, opacity: 0.5 }}
        animate={reduce ? { opacity: 0.5 } : { x: [22, 26, 22], y: [14, 10, 14], opacity: [0.5, 0.25, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <rect x={16} y={20} width={26} height={30} rx={4} stroke="#7fe9dd" strokeWidth={2} fill="#0d1420" />
      {[27, 33, 39].map((y) => (
        <line key={y} x1={21} y1={y} x2={37} y2={y} stroke="#2dd4bf" strokeWidth={1.6} strokeLinecap="round" strokeOpacity={0.7} />
      ))}
    </svg>
  );
}

/* ------------------------------- Datos ------------------------------------ */

const MODALIDADES = [
  {
    icon: <IconAhorro />,
    name: "Ahorro",
    tagline: "Pon tu capital a trabajar, sin complicarte.",
    bullets: [
      "Depósito con objetivo estable de rendimiento",
      "Bajo mantenimiento — nosotros gestionamos",
      "Informe mensual por correo",
    ],
    para: "Quien quiere rentabilizar su dinero de forma sencilla.",
    recibe: "Informe mensual + acceso de solo lectura.",
  },
  {
    icon: <IconAccionista />,
    name: "Accionista · 50/50",
    tagline: "Comparte el crecimiento —y los resultados— al 50%.",
    bullets: [
      "Aportas capital al fondo gestionado",
      "Repartes los beneficios netos al 50/50",
      "Sin comisión fija: ganamos si ganas",
    ],
    para: "Quien busca más recorrido y vinculación con la firma.",
    recibe: "Dashboard de rendimiento en tiempo real.",
    featured: true,
  },
  {
    icon: <IconPlantilla />,
    name: "Plantilla",
    tagline: "Llévate el sistema y opéralo tú.",
    bullets: [
      "Compra única / licencia del sistema",
      "La metodología y sus conexiones",
      "Autonomía total, sin gestión de terceros",
    ],
    para: "Quien quiere la herramienta, no que le gestionen.",
    recibe: "Licencia + panel personalizado.",
  },
];

/* ------------------------------- Sección ---------------------------------- */

export default function Modalidades() {
  return (
    <section id="rutas" className="relative border-t border-atlas-line/50 py-28 md:py-40">
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <BlurReveal className="mb-16 md:mb-20">
          <p className="kicker mb-6 text-[11px] text-atlas-gold">Modalidades</p>
          <h2 className="max-w-2xl text-[clamp(2rem,4.4vw,3.4rem)] font-normal leading-[1.08] text-atlas-ink">
            Tres formas de participar.
          </h2>
          <p className="mt-5 max-w-lg text-[16px] font-light leading-relaxed text-atlas-muted">
            Desde poner tu ahorro a trabajar hasta llevarte el sistema entero. Elige según tu nivel de
            implicación.
          </p>
        </BlurReveal>

        <div className="grid gap-5 md:grid-cols-3">
          {MODALIDADES.map((m, i) => (
            <BlurReveal key={m.name} delay={i * 0.1}>
              <div
                className={`flex h-full flex-col rounded-2xl border p-7 transition-all duration-500 hover:-translate-y-1 ${
                  m.featured
                    ? "border-atlas-gold/50 bg-gradient-to-b from-atlas-gold/[0.08] to-transparent"
                    : "border-atlas-line bg-atlas-panel/40 hover:border-atlas-gold/35"
                }`}
              >
                <div className="mb-6 grid h-14 w-14 place-items-center rounded-xl border border-atlas-line bg-atlas-bg/50">
                  {m.icon}
                </div>
                <h3 className="text-[clamp(1.3rem,2.2vw,1.6rem)] font-normal text-atlas-ink">{m.name}</h3>
                <p className="mt-2 text-[14.5px] font-light leading-relaxed text-atlas-muted">{m.tagline}</p>

                <ul className="mt-6 space-y-2.5">
                  {m.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-[13.5px] font-light leading-snug text-atlas-ink/85">
                      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 flex-none text-atlas-goldsoft" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {b}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 space-y-2 border-t border-atlas-line/60 pt-5 text-[12.5px] font-light text-atlas-muted">
                  <p><span className="text-atlas-muted/70">Para quién:</span> {m.para}</p>
                  <p><span className="text-atlas-muted/70">Recibe:</span> {m.recibe}</p>
                </div>
              </div>
            </BlurReveal>
          ))}
        </div>

        <BlurReveal delay={0.2}>
          <p className="mt-8 text-[11.5px] font-light leading-relaxed text-atlas-muted/70">
            Los rendimientos son objetivos, no garantías. Nada en esta página constituye oferta ni
            asesoramiento financiero; toda operativa se valida primero en entornos de prueba.
          </p>
        </BlurReveal>
      </div>
    </section>
  );
}
