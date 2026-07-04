import { BlurReveal } from "./motion";

const METODO = [
  { n: "01", t: "Selección", d: "Estrategias con ventaja demostrable —trend following, mercados de predicción—, nunca corazonadas." },
  { n: "02", t: "Dimensionamiento", d: "El riesgo define el tamaño de cada posición, no la ambición ni la convicción del momento." },
  { n: "03", t: "Ejecución", d: "Sistemática y sin intervención emocional. La regla se cumple igual en euforia que en pánico." },
  { n: "04", t: "Vigilancia", d: "Cada posición auditada, con un freno automático que detiene el sistema antes de que el daño crezca." },
];

export default function Enfoque() {
  return (
    <section id="enfoque" className="relative border-t border-atlas-line/50 py-28 md:py-40">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 sm:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <BlurReveal>
            <p className="kicker mb-6 text-[11px] text-atlas-gold">Enfoque de inversión</p>
            <h2 className="text-[clamp(2rem,4.2vw,3.2rem)] font-normal leading-[1.06] text-atlas-ink">
              Un método, repetido con <span className="italic text-atlas-gold">precisión</span>.
            </h2>
            <p className="mt-6 max-w-sm text-[16px] font-light leading-relaxed text-atlas-muted">
              Varios motores de inversión operando bajo una única capa de riesgo. Ninguno decide solo;
              todos responden a la misma doctrina.
            </p>
          </BlurReveal>
        </div>

        <div>
          {METODO.map((m, i) => (
            <BlurReveal key={m.n} delay={i * 0.07}>
              <div className="flex items-start gap-6 border-t border-atlas-line py-9 md:gap-10 md:py-10">
                <span className="fig pt-1 text-[13px] text-atlas-gold/70">{m.n}</span>
                <div>
                  <h3 className="text-[clamp(1.3rem,2.4vw,1.8rem)] font-normal text-atlas-ink">{m.t}</h3>
                  <p className="mt-3 max-w-lg text-[15.5px] font-light leading-relaxed text-atlas-muted">{m.d}</p>
                </div>
              </div>
            </BlurReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
