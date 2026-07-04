import { BlurReveal, CinemaImage, Words } from "./motion";

const DESERT = "https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=1800&q=65";

export default function Manifiesto() {
  return (
    <section id="manifiesto" className="relative overflow-hidden py-36 md:py-52">
      <CinemaImage
        src={DESERT}
        className="opacity-[0.12]"
        overlay={<div className="absolute inset-0 bg-gradient-to-b from-atlas-bg via-atlas-bg/70 to-atlas-bg" />}
      />
      <div className="relative mx-auto max-w-4xl px-6 text-center sm:px-10">
        <BlurReveal>
          <p className="kicker mb-9 text-[11px] text-atlas-gold">Manifiesto</p>
        </BlurReveal>

        <h2 className="mx-auto max-w-3xl text-[clamp(2rem,4.6vw,3.6rem)] font-normal leading-[1.15] text-atlas-ink">
          <Words text="El capital serio no persigue el ruido del mercado. Busca **permanencia**." stagger={0.075} />
        </h2>

        <BlurReveal delay={0.2} className="mx-auto mt-10 max-w-xl">
          <p className="text-[17px] font-light leading-loose text-atlas-muted">
            Gestionamos patrimonio con la paciencia de quien piensa en décadas, no en titulares. Cada
            decisión responde a una doctrina: preservar primero, crecer con disciplina, mirar el mundo entero.
          </p>
        </BlurReveal>
      </div>
    </section>
  );
}
