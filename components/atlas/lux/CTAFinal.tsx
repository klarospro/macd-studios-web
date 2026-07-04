import { BlurReveal, CinemaImage, Words } from "./motion";

const GOLD = "https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1800&q=60";
const MAIL = "mailto:moiseschirinooficial99@gmail.com";

const ACCIONES = [
  { t: "Agendar una llamada", d: "Una conversación privada, sin compromiso.", href: `${MAIL}?subject=ATLAS%20—%20Agendar%20llamada` },
  { t: "Solicitar el dossier", d: "El documento completo de la firma.", href: `${MAIL}?subject=ATLAS%20—%20Solicitar%20dossier`, featured: true },
  { t: "Hablar con un advisor", d: "Resolvemos sus preguntas directamente.", href: `${MAIL}?subject=ATLAS%20—%20Hablar%20con%20advisor` },
];

export default function CTAFinal() {
  return (
    <section id="cta" className="relative overflow-hidden py-32 md:py-44">
      <CinemaImage
        src={GOLD}
        className="opacity-[0.10]"
        overlay={<div className="absolute inset-0 bg-gradient-to-b from-atlas-bg via-atlas-bg/80 to-atlas-bg" />}
      />
      <div className="relative mx-auto max-w-5xl px-6 text-center sm:px-10">
        <BlurReveal>
          <p className="kicker mb-7 text-[11px] text-atlas-gold">El siguiente paso</p>
        </BlurReveal>
        <h2 className="mx-auto max-w-3xl text-[clamp(2.2rem,5vw,4rem)] font-normal leading-[1.05] text-atlas-ink">
          <Words text="Conversemos sobre su **patrimonio**." stagger={0.1} />
        </h2>
        <BlurReveal delay={0.2} className="mx-auto mt-7 max-w-xl">
          <p className="text-[17px] font-light leading-relaxed text-atlas-muted">
            El primer paso es una conversación. Sin promesas de rentabilidad; sí una forma seria y
            disciplinada de gestionar capital.
          </p>
        </BlurReveal>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {ACCIONES.map((a, i) => (
            <BlurReveal key={a.t} delay={0.1 + i * 0.1}>
              <a
                href={a.href}
                className={`group flex h-full flex-col rounded-2xl border p-7 text-left transition-all duration-500 hover:-translate-y-1 ${
                  a.featured
                    ? "border-atlas-gold/50 bg-gradient-to-b from-atlas-gold/[0.10] to-transparent"
                    : "border-atlas-line bg-atlas-panel/40 hover:border-atlas-gold/40"
                }`}
              >
                <span className="text-[clamp(1.15rem,2vw,1.4rem)] font-normal text-atlas-ink">{a.t}</span>
                <span className="mt-2 text-[14px] font-light leading-relaxed text-atlas-muted">{a.d}</span>
                <span className="mt-6 inline-flex items-center gap-2 text-[13px] font-medium tracking-wide text-atlas-goldsoft">
                  Continuar
                  <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </a>
            </BlurReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
