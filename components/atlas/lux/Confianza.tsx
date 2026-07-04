import { BlurReveal, CinemaImage, Words } from "./motion";

const CITY = "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=2000&q=70";

export default function Confianza() {
  return (
    <section id="confianza" className="relative flex min-h-[90svh] items-center overflow-hidden">
      <CinemaImage
        src={CITY}
        className="opacity-[0.4]"
        overlay={
          <>
            <div className="absolute inset-0 bg-gradient-to-b from-atlas-bg via-atlas-bg/55 to-atlas-bg" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(10,10,11,0.75))]" />
          </>
        }
      />
      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center sm:px-10">
        <BlurReveal>
          <p className="kicker mb-8 text-[11px] text-atlas-gold">Confianza</p>
        </BlurReveal>
        <h2 className="text-[clamp(2.2rem,5vw,4rem)] font-normal leading-[1.08] text-atlas-ink">
          <Words text="La confianza no se pide. Se **construye**, decisión a decisión." stagger={0.08} />
        </h2>
        <BlurReveal delay={0.25} className="mx-auto mt-9 max-w-lg">
          <p className="text-[17px] font-light leading-loose text-atlas-muted">
            Transparencia total sobre cada operación. Reglas que no cambian con el estado de ánimo del
            mercado. El capital de nuestros socios se trata como propio: se cuida antes de arriesgarse.
          </p>
        </BlurReveal>
      </div>
    </section>
  );
}
