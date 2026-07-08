import { BlurReveal } from "./motion";

const RETOS = [
  {
    n: "01",
    t: "Emoción sobre método",
    d: "Las decisiones se toman en euforia o en pánico. La disciplina se rompe justo cuando más importa: en la caída.",
  },
  {
    n: "02",
    t: "Riesgo sin límites que se respeten",
    d: "Sin un tope de pérdida innegociable, una mala racha deja de ser un bache y se convierte en una pérdida permanente de capital.",
  },
  {
    n: "03",
    t: "Cero trazabilidad",
    d: "Sin auditoría de cada operación es imposible saber qué funciona, corregir con datos o rendir cuentas a quien confía su dinero.",
  },
];

export default function Problema() {
  return (
    <section id="problema" className="relative border-t border-atlas-line/50 py-28 md:py-40">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 sm:px-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        {/* Columna izquierda: enunciado (sticky en desktop). */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <BlurReveal>
            <p className="kicker mb-6 text-[11px] text-atlas-gold">El reto</p>
            <h2 className="text-[clamp(2rem,4.2vw,3.2rem)] font-normal leading-[1.06] text-atlas-ink">
              Gestionar capital a mano no <span className="italic text-atlas-gold">escala</span>. Y el
              miedo no avisa.
            </h2>
            <p className="mt-6 max-w-sm text-[16px] font-light leading-relaxed text-atlas-muted">
              La mayor parte del capital se gestiona con emoción, sin límites de pérdida que se cumplan
              y sin una única fuente de verdad. Cuando el mercado gira, se improvisa —y improvisar con
              dinero cuesta caro.
            </p>
          </BlurReveal>
        </div>

        {/* Columna derecha: los tres dolores. */}
        <div>
          {RETOS.map((r, i) => (
            <BlurReveal key={r.n} delay={i * 0.08}>
              <div className="group flex items-start gap-6 border-t border-atlas-line py-9 md:gap-10 md:py-10">
                <span className="fig pt-1 text-[13px] text-atlas-muted/60 transition-colors duration-500 group-hover:text-atlas-gold">
                  {r.n}
                </span>
                <div>
                  <h3 className="text-[clamp(1.3rem,2.4vw,1.8rem)] font-normal text-atlas-ink">{r.t}</h3>
                  <p className="mt-3 max-w-lg text-[15.5px] font-light leading-relaxed text-atlas-muted">{r.d}</p>
                </div>
              </div>
            </BlurReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
