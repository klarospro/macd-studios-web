import { Reveal } from "./Reveal";

export default function CTA() {
  return (
    <section id="cta" className="relative overflow-hidden border-t border-atlas-line/40 py-28 md:py-36">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[460px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-atlas-teal/10 blur-[130px]" />
      </div>
      <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
        <Reveal>
          <h2 className="text-[clamp(2rem,4.6vw,3.4rem)] font-semibold leading-[1.05] text-atlas-ink">
            Construyamos capital que{" "}
            <span className="bg-gradient-to-r from-atlas-teal to-atlas-blue bg-clip-text text-transparent">preserve primero.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-atlas-muted">
            Si algo de esto te resuena —como socio de capital, usuario del producto o accionista—
            hablemos. Sin promesas de rentabilidad; sí una forma disciplinada de gestionar riesgo.
          </p>
        </Reveal>
        <Reveal delay={0.18}>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <a
              href="mailto:moiseschirinooficial99@gmail.com?subject=Atlas%20AI%20—%20quiero%20saber%20más"
              className="rounded-full bg-gradient-to-r from-atlas-teal to-atlas-blue px-7 py-3.5 text-[15px] font-semibold text-atlas-bg transition-transform hover:scale-[1.02]"
            >
              Hablar con el equipo
            </a>
            <a
              href="#top"
              className="rounded-full border border-atlas-line bg-atlas-panel/50 px-7 py-3.5 text-[15px] font-semibold text-atlas-ink transition-colors hover:border-atlas-teal/50"
            >
              Volver al inicio
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
