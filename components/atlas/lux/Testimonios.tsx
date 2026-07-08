import { BlurReveal } from './motion'

const TESTIMONIOS = [
  {
    quote:
      'Lo que me convenció no fue una promesa de rentabilidad, sino la obsesión por no perder. Ver el freno de riesgo actuar solo, sin drama, me dio la tranquilidad que buscaba.',
    name: 'Inversor privado',
    detail: 'Patrimonio familiar · desde 2025',
  },
  {
    quote:
      'Vengo del mundo institucional y valoro la disciplina. Aquí cada posición tiene un porqué medido y cada regla se cumple igual en calma que en pánico. Es raro encontrar esa consistencia.',
    name: 'Ex-gestor de fondos',
    detail: 'Accionista · cartera diversificada',
  },
  {
    quote:
      'Quería un sistema, no un gurú. Me dieron transparencia total: veo la metodología aplicada a mis fondos en un panel, sin cajas negras. Eso vale más que cualquier discurso.',
    name: 'Empresario tecnológico',
    detail: 'Inversor · ahorro a largo plazo',
  },
]

export default function Testimonios() {
  return (
    <section id="testimonios" className="relative border-t border-atlas-line/50 py-28 md:py-40">
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <BlurReveal className="mb-16 md:mb-20">
          <p className="kicker mb-6 text-[11px] text-atlas-gold">En sus palabras</p>
          <h2 className="max-w-2xl text-[clamp(2rem,4.4vw,3.4rem)] font-normal leading-[1.08] text-atlas-ink">
            La confianza se construye en cómo se cuida el capital.
          </h2>
        </BlurReveal>

        <div className="grid gap-5 md:grid-cols-3">
          {TESTIMONIOS.map((t, i) => (
            <BlurReveal key={i} delay={i * 0.1}>
              <figure className="flex h-full flex-col rounded-2xl border border-atlas-line bg-atlas-panel/40 p-7 transition-colors duration-500 hover:border-atlas-gold/35">
                <svg viewBox="0 0 24 24" aria-hidden className="mb-5 h-7 w-7 flex-none text-atlas-gold/60" fill="currentColor">
                  <path d="M9.5 6C6.5 7.5 5 10 5 13v5h6v-6H8c0-2 1-3.5 3-4.5L9.5 6Zm9 0c-3 1.5-4.5 4-4.5 7v5h6v-6h-3c0-2 1-3.5 3-4.5L18.5 6Z" />
                </svg>
                <blockquote className="flex-1 text-[15.5px] font-light leading-relaxed text-atlas-ink/90">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-6 border-t border-atlas-line/60 pt-4">
                  <div className="text-[14px] font-medium text-atlas-ink">{t.name}</div>
                  <div className="mt-0.5 text-[12.5px] font-light text-atlas-muted">{t.detail}</div>
                </figcaption>
              </figure>
            </BlurReveal>
          ))}
        </div>

        <BlurReveal delay={0.2}>
          <p className="mt-8 text-[11.5px] font-light text-atlas-muted/70">
            Testimonios ilustrativos, anonimizados y de presentación de marca. No constituyen evidencia
            de resultados ni recomendación de inversión.
          </p>
        </BlurReveal>
      </div>
    </section>
  )
}
