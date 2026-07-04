import { BlurReveal } from "./motion";

const PRINCIPIOS = [
  { n: "I", t: "Preservación del capital", d: "No perder es la primera forma de ganar. Límites de caída que se respetan sin excepción alguna." },
  { n: "II", t: "Crecimiento estratégico", d: "Crecer con método, no con azar. Cada posición se dimensiona por convicción y riesgo medido." },
  { n: "III", t: "Visión global", d: "El mundo entero como universo de inversión. Diversificación real entre mercados y clases de activo." },
  { n: "IV", t: "Ejecución disciplinada", d: "La estrategia solo vale si se cumple. Ejecución sistemática, sin emoción y sin atajos." },
];

export default function Fortalezas() {
  return (
    <section id="fortalezas" className="relative py-28 md:py-40">
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <BlurReveal className="mb-16 md:mb-24">
          <p className="kicker mb-6 text-[11px] text-atlas-gold">Principios</p>
          <h2 className="max-w-2xl text-[clamp(2rem,4.4vw,3.4rem)] font-normal leading-[1.08] text-atlas-ink">
            Cuatro doctrinas que gobiernan cada decisión.
          </h2>
        </BlurReveal>

        <div>
          {PRINCIPIOS.map((p, i) => (
            <BlurReveal key={p.n} delay={i * 0.08}>
              <div className="grid grid-cols-[3rem_1fr] items-start gap-6 border-t border-atlas-line py-10 md:grid-cols-[7rem_1fr] md:gap-12 md:py-12">
                <span className="display-num text-[clamp(1.8rem,3vw,2.6rem)] text-atlas-gold/70">{p.n}</span>
                <div className="flex flex-col gap-3 md:flex-row md:items-baseline md:justify-between md:gap-16">
                  <h3 className="text-[clamp(1.4rem,2.6vw,2rem)] font-normal leading-tight text-atlas-ink md:w-[38%] md:flex-none">
                    {p.t}
                  </h3>
                  <p className="max-w-md text-[15.5px] font-light leading-relaxed text-atlas-muted">{p.d}</p>
                </div>
              </div>
            </BlurReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
