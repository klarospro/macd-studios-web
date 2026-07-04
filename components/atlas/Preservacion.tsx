import Image from "next/image";
import { Reveal } from "./Reveal";

const RECUP = [
  { loss: 10, gain: 11.1 },
  { loss: 20, gain: 25 },
  { loss: 30, gain: 42.9 },
  { loss: 50, gain: 100 },
];

export default function Preservacion() {
  return (
    <section id="preservacion" className="relative overflow-hidden border-t border-atlas-line/40 py-24 md:py-32">
      {/* Fondo abstracto (Unsplash, libre uso comercial) bajo un velo oscuro */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=55"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-[0.14]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-atlas-bg via-atlas-bg/85 to-atlas-bg" />
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <p className="mb-4 font-mono text-[12px] uppercase tracking-[0.22em] text-atlas-teal">Preservación de capital</p>
          <h2 className="text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-[1.08] text-atlas-ink">
            Nuestra primera regla no es ganar. Es no perder.
          </h2>
          <p className="mt-6 max-w-lg text-[16.5px] leading-relaxed text-atlas-muted">
            Recuperarse de una caída grande exige una ganancia desproporcionada. Perder un 50% no se arregla
            ganando un 50% —hace falta duplicar. Por eso cortamos pronto: cada activo y la cartera entera
            tienen un tope de caída que dispara una parada automática.
          </p>
        </Reveal>

        <Reveal delay={0.12}>
          <div className="rounded-2xl border border-atlas-line bg-atlas-panel/50 p-6 backdrop-blur-sm sm:p-8">
            <div className="mb-5 flex items-center justify-between text-[12px] font-mono uppercase tracking-wide text-atlas-muted">
              <span>Caída</span><span>Ganancia para recuperar</span>
            </div>
            <div className="space-y-5">
              {RECUP.map((r) => (
                <div key={r.loss}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="tnum text-[15px] font-semibold text-atlas-ink">−{r.loss}%</span>
                    <span className="tnum text-[15px] font-semibold text-atlas-teal">+{r.gain}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-atlas-bg2">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-atlas-teal to-atlas-blue"
                      style={{ width: `${Math.min(r.gain, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 border-t border-atlas-line pt-4 text-[13px] text-atlas-muted">
              La asimetría es matemática, no opinión: <span className="text-atlas-ink">ganancia = pérdida ÷ (1 − pérdida)</span>.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
