import { Reveal } from "./Reveal";

const RUTAS = [
  {
    t: "Capital",
    who: "Para quien quiere que su capital trabaje",
    d: "Aportas capital; el sistema lo gestiona bajo reglas de riesgo estrictas. Recibes reportes y auditoría de cada decisión.",
    points: ["Gestión 100% reglada", "Reportes y auditoría", "Preservación primero"],
  },
  {
    t: "Producto",
    who: "Para traders e inversores autónomos",
    d: "Usas la plantilla maestra en tu propia cuenta y broker. La misma disciplina de riesgo, en tus manos.",
    points: ["Conectas tu cuenta", "Tu capital, tu control", "Modelo SaaS"],
    featured: true,
  },
  {
    t: "Accionista",
    who: "Para quien cree en el proyecto",
    d: "Participas en el crecimiento de Atlas como empresa, no solo en una operación. Construyes el motor con nosotros.",
    points: ["Participación en Atlas", "Visión a largo plazo", "Crecimiento del producto"],
  },
];

export default function Rutas() {
  return (
    <section id="rutas" className="relative border-t border-atlas-line/40 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <p className="mb-4 font-mono text-[12px] uppercase tracking-[0.22em] text-atlas-teal">Rutas de socio</p>
          <h2 className="max-w-3xl text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-[1.08] text-atlas-ink">
            Tres formas de construir esto juntos.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {RUTAS.map((r, i) => (
            <Reveal key={r.t} delay={i * 0.08}>
              <div
                className={`flex h-full flex-col rounded-2xl border p-7 ${
                  r.featured
                    ? "border-atlas-teal/50 bg-gradient-to-b from-atlas-teal/[0.08] to-atlas-panel/40 shadow-[0_0_50px_-15px] shadow-atlas-teal/40"
                    : "border-atlas-line bg-atlas-panel/40"
                }`}
              >
                {r.featured && (
                  <span className="mb-4 w-fit rounded-full bg-atlas-teal px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-wide text-atlas-bg">
                    Más demandado
                  </span>
                )}
                <h3 className="text-2xl font-semibold text-atlas-ink">{r.t}</h3>
                <p className="mt-1 text-[13.5px] text-atlas-muted">{r.who}</p>
                <p className="mt-4 text-[14.5px] leading-relaxed text-atlas-muted">{r.d}</p>
                <ul className="mt-6 space-y-2.5">
                  {r.points.map((p) => (
                    <li key={p} className="flex items-center gap-2.5 text-[14px] text-atlas-ink">
                      <svg viewBox="0 0 20 20" className="h-4 w-4 flex-none text-atlas-teal" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {p}
                    </li>
                  ))}
                </ul>
                <a
                  href="#cta"
                  className={`mt-7 rounded-full px-5 py-2.5 text-center text-[14px] font-semibold transition-transform hover:scale-[1.02] ${
                    r.featured ? "bg-gradient-to-r from-atlas-teal to-atlas-blue text-atlas-bg" : "border border-atlas-line text-atlas-ink hover:border-atlas-teal/50"
                  }`}
                >
                  Me interesa
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
