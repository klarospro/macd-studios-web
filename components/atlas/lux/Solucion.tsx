import { BlurReveal, Words } from "./motion";

const IShield = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6l7-3z" strokeLinejoin="round" />
    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ILayers = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M12 3l9 5-9 5-9-5 9-5z" strokeLinejoin="round" />
    <path d="M3 13l9 5 9-5M3 16l9 5 9-5" strokeLinejoin="round" strokeLinecap="round" opacity="0.6" />
  </svg>
);
const IPulse = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M3 12h4l2-6 4 12 2-6h6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PILARES = [
  {
    icon: IShield,
    t: "Riesgo primero",
    d: "El límite de caída y el tamaño de cada posición se calculan antes de abrir. El sistema se frena solo antes de que el daño crezca —la preservación es la regla, no la excepción.",
  },
  {
    icon: ILayers,
    t: "Multi-activo, un solo control",
    d: "Cripto, forex, índices y mercados de predicción operan bajo una única capa de riesgo. Diversificación real, no silos sueltos que se ignoran entre sí.",
  },
  {
    icon: IPulse,
    t: "24/7 y auditado",
    d: "Vigila el capital de forma continua y deja rastro de cada decisión en un registro inalterable. Lo que no se mide, no se mejora —ni se puede rendir cuentas.",
  },
];

export default function Solucion() {
  return (
    <section id="solucion" className="relative border-t border-atlas-line/50 py-28 md:py-40">
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <BlurReveal className="mb-16 md:mb-20">
          <p className="kicker mb-6 text-[11px] text-atlas-gold">La solución</p>
          <h2 className="max-w-3xl text-[clamp(2rem,4.6vw,3.6rem)] font-normal leading-[1.06] text-atlas-ink">
            <Words text="Un sistema. Una capa de **riesgo**. Sin descanso." stagger={0.08} />
          </h2>
          <p className="mt-6 max-w-xl text-[16px] font-light leading-relaxed text-atlas-muted">
            ATLAS convierte la disciplina en software: varios motores de inversión operando bajo un
            único control de riesgo, con ejecución automática y auditoría de cada movimiento.
          </p>
        </BlurReveal>

        <div className="grid gap-5 md:grid-cols-3">
          {PILARES.map((p, i) => (
            <BlurReveal key={p.t} delay={i * 0.1}>
              <div className="group flex h-full flex-col rounded-2xl border border-atlas-line bg-atlas-panel/40 p-7 transition-all duration-500 hover:-translate-y-1 hover:border-atlas-gold/35">
                <div className="mb-6 grid h-14 w-14 place-items-center rounded-xl border border-atlas-line bg-atlas-bg/50 text-atlas-goldsoft transition-colors duration-500 group-hover:text-atlas-gold">
                  {p.icon}
                </div>
                <h3 className="text-[clamp(1.25rem,2.2vw,1.55rem)] font-normal text-atlas-ink">{p.t}</h3>
                <p className="mt-3 text-[14.5px] font-light leading-relaxed text-atlas-muted">{p.d}</p>
              </div>
            </BlurReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
