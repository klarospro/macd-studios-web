import { Fragment } from "react";
import { Reveal } from "./Reveal";

const PASOS = [
  { n: "01", t: "Señal", d: "Un motor detecta una oportunidad y propone una operación." },
  { n: "02", t: "Risk Gate", d: "Control obligatorio: sizing, drawdown, exposición, breakers. Aprueba o rechaza.", key: true },
  { n: "03", t: "Ejecución", d: "Solo lo aprobado llega al broker. En demo hoy; con límites en real." },
  { n: "04", t: "Auditoría", d: "Todo queda registrado —incluidos los rechazos— en un log inalterable." },
];

export default function Sistema() {
  return (
    <section id="sistema" className="relative border-t border-atlas-line/40 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <p className="mb-4 font-mono text-[12px] uppercase tracking-[0.22em] text-atlas-teal">Cómo funciona</p>
          <h2 className="max-w-3xl text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-[1.08] text-atlas-ink">
            Ninguna operación existe sin pasar el control de riesgo.
          </h2>
        </Reveal>

        <div className="mt-14 flex flex-col gap-3 md:flex-row md:items-stretch">
          {PASOS.map((p, i) => (
            <Fragment key={p.n}>
              <Reveal delay={i * 0.1} className="md:flex-1">
                <div
                  className={`relative h-full rounded-2xl border p-6 ${
                    p.key
                      ? "border-atlas-teal/50 bg-atlas-teal/[0.06] shadow-[0_0_40px_-12px] shadow-atlas-teal/40"
                      : "border-atlas-line bg-atlas-panel/40"
                  }`}
                >
                  <div className={`font-mono text-[12px] ${p.key ? "text-atlas-teal" : "text-atlas-muted"}`}>{p.n}</div>
                  <h3 className="mt-3 text-lg font-semibold text-atlas-ink">{p.t}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-atlas-muted">{p.d}</p>
                  {p.key && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg border border-atlas-line bg-atlas-bg2/70 px-3 py-2 text-[12.5px] text-atlas-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-atlas-blue" />
                      Rechazo → registrado en auditoría
                    </div>
                  )}
                </div>
              </Reveal>
              {i < PASOS.length - 1 && (
                <div aria-hidden className="flex items-center justify-center text-atlas-teal/60">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 rotate-90 md:rotate-0" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
