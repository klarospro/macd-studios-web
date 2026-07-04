import { BlurReveal, CinemaImage, CountUp } from "./motion";

const EARTH = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1800&q=65";

export default function Metricas() {
  return (
    <section className="relative overflow-hidden py-32 md:py-44">
      <CinemaImage
        src={EARTH}
        className="opacity-[0.18]"
        overlay={<div className="absolute inset-0 bg-gradient-to-b from-atlas-bg via-atlas-bg/80 to-atlas-bg" />}
      />
      <div className="relative mx-auto max-w-6xl px-6 sm:px-10">
        <BlurReveal className="mb-16 text-center">
          <p className="kicker mb-6 text-[11px] text-atlas-gold">La doctrina, en cifras</p>
          <h2 className="mx-auto max-w-2xl text-[clamp(1.8rem,4vw,3rem)] font-normal leading-[1.12] text-atlas-ink">
            La disciplina no se declara. Se mide.
          </h2>
        </BlurReveal>

        <div className="grid grid-cols-2 gap-y-14 md:grid-cols-4 md:gap-y-0">
          {[
            { num: <CountUp to={1} suffix="%" />, label: "Riesgo máximo por operación" },
            { num: <CountUp to={10} suffix="%" />, label: "Límite de caída total" },
            { num: <span className="fig">24/7</span>, label: "Vigilancia del capital" },
            { num: <CountUp to={100} suffix="%" />, label: "Operaciones bajo control de riesgo" },
          ].map((m, i) => (
            <BlurReveal key={i} delay={i * 0.14} className="border-atlas-line px-2 text-center md:border-l md:first:border-l-0">
              <div className="display-num text-[clamp(3rem,6vw,4.6rem)] text-atlas-ink">{m.num}</div>
              <div className="mx-auto mt-4 max-w-[15ch] text-[13px] font-light leading-snug text-atlas-muted">{m.label}</div>
            </BlurReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
