import { Reveal } from "./Reveal";

const MOTORES = [
  { t: "Trend following", d: "Estrategia institucional sobre índices, materias primas y cripto. Sigue tendencias, corta pérdidas.", tag: "Institucional" },
  { t: "Mercados de predicción", d: "Ventaja estadística en eventos con precio mal calibrado. Edge medible, apuesta acotada.", tag: "Estadístico" },
  { t: "Diversificación por diseño", d: "Motores poco correlacionados: cuando uno sufre, otro compensa. El edge está en la cartera.", tag: "Cartera" },
];

export default function Solucion() {
  return (
    <section id="solucion" className="relative overflow-hidden border-t border-atlas-line/40 py-24 md:py-32">
      <div aria-hidden className="pointer-events-none absolute right-[-10%] top-[10%] h-[420px] w-[420px] rounded-full bg-atlas-blue/8 blur-[120px]" />
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <Reveal>
            <p className="mb-4 font-mono text-[12px] uppercase tracking-[0.22em] text-atlas-teal">La solución</p>
            <h2 className="text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-[1.08] text-atlas-ink">
              Varios motores. Una sola capa de riesgo.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-[16.5px] leading-relaxed text-atlas-muted">
              No apostamos todo a una idea. Combinamos estrategias distintas y, por encima de todas,
              una <span className="text-atlas-ink">capa de riesgo común</span> que decide cuánto se arriesga en cada
              momento —por cuenta y por cartera. Ningún motor puede saltarse esa capa.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {MOTORES.map((m, i) => (
            <Reveal key={m.t} delay={i * 0.08}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-atlas-line bg-atlas-panel/40 p-6 transition-colors hover:border-atlas-teal/40">
                <span className="mb-5 inline-block rounded-full border border-atlas-line bg-atlas-bg2 px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-atlas-muted">{m.tag}</span>
                <h3 className="text-xl font-semibold text-atlas-ink">{m.t}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-atlas-muted">{m.d}</p>
                <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-atlas-teal/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
