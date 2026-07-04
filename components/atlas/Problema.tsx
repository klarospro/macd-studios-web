import { Reveal } from "./Reveal";

const PUNTOS = [
  { t: "La emoción cobra su precio", d: "El miedo cierra ganadoras antes de tiempo; la avaricia mantiene perdedoras. El mercado castiga ambas." },
  { t: "Inconsistencia humana", d: "Una regla que solo se cumple “cuando me acuerdo” no es una regla. La disciplina manual se erosiona bajo presión." },
  { t: "El mercado no duerme", d: "Las oportunidades y los riesgos no esperan a tu horario. Vigilar 24/7 a mano es imposible." },
];

export default function Problema() {
  return (
    <section id="problema" className="relative border-t border-atlas-line/40 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <p className="mb-4 font-mono text-[12px] uppercase tracking-[0.22em] text-atlas-teal">El problema</p>
          <h2 className="max-w-3xl text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-[1.08] text-atlas-ink">
            Gestionar capital a mano no escala. Y la emoción cuesta dinero.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {PUNTOS.map((p, i) => (
            <Reveal key={p.t} delay={i * 0.08}>
              <div className="h-full rounded-2xl border border-atlas-line bg-atlas-panel/40 p-6">
                <div className="mb-4 h-9 w-9 rounded-lg border border-atlas-line bg-atlas-bg2 [background:radial-gradient(circle_at_30%_30%,rgba(45,212,191,0.25),transparent_70%)]" />
                <h3 className="text-lg font-semibold text-atlas-ink">{p.t}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-atlas-muted">{p.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
