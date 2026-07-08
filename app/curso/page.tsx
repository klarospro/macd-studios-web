import { Metadata } from 'next'
import LeadForm from './LeadForm'

export const metadata: Metadata = {
  title: 'Aprende a montar tu tienda con IA — @camiysanti x MACD Studios',
  description: 'El sistema exacto que usamos para automatizar nuestra tienda con IA. Shopify + n8n + Claude. Factura mientras duermes.'
}

export default function CursoPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
        <p className="text-[#D4AF37] text-sm font-semibold tracking-widest uppercase mb-4">
          @camiysanti × MACD Studios
        </p>
        <h1 className="font-display text-4xl md:text-5xl leading-tight mb-6">
          La tienda que trabaja<br />
          <span className="text-[#D4AF37]">mientras tú duermes</span>
        </h1>
        <p className="text-zinc-400 text-lg leading-relaxed max-w-xl mx-auto">
          El sistema exacto que usamos: Shopify conectado con IA que crea el contenido,
          gestiona pedidos y analiza qué vende — todo automático.
        </p>
      </section>

      {/* Lo que incluye */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { emoji: '🤖', title: 'IA que crea contenido', desc: 'Captions, scripts y prompts de imagen generados solos para cada producto' },
            { emoji: '📦', title: 'Pedidos automáticos', desc: 'Cada venta se reenvía sola al proveedor. Sin tocar nada.' },
            { emoji: '📊', title: 'Análisis diario', desc: 'El agente Santi detecta qué vende y te dice qué escalar' }
          ].map(item => (
            <div key={item.title} className="bg-[#111] border border-[#222] rounded-xl p-5">
              <div className="text-3xl mb-3">{item.emoji}</div>
              <h3 className="font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Lo que obtienes */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <div className="bg-[#111] border border-[#D4AF37]/20 rounded-2xl p-8">
          <h2 className="font-display text-2xl text-[#D4AF37] mb-6">El curso incluye</h2>
          <ul className="space-y-3">
            {[
              'Arquitectura completa del sistema paso a paso',
              'Los 6 workflows de n8n listos para importar',
              'Los agentes IA (Camí + Santi) configurados',
              'Schema de Supabase listo para pegar',
              'Panel de aprobación de contenido',
              'Landing de captación de leads',
              'Soporte directo vía WhatsApp',
              'Actualizaciones de por vida'
            ].map(item => (
              <li key={item} className="flex items-start gap-3 text-zinc-300 text-sm">
                <span className="text-[#D4AF37] mt-0.5 shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Prueba social */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <div className="bg-[#0d0d0d] border border-[#222] rounded-xl p-6">
          <p className="text-zinc-400 text-sm leading-relaxed italic">
            "El sistema que ves funcionar en @camiysanti — la tienda, el contenido, los pedidos —
            es exactamente lo que te enseñamos a replicar. El sistema funcionando ES la prueba de venta."
          </p>
          <p className="text-[#D4AF37] text-sm font-semibold mt-3">— MACD Studios</p>
        </div>
      </section>

      {/* Formulario de captación */}
      <section className="max-w-md mx-auto px-6 pb-24">
        <div className="bg-[#111] border border-[#D4AF37]/30 rounded-2xl p-8">
          <h2 className="font-display text-2xl text-center mb-2">Quiero aprender</h2>
          <p className="text-zinc-500 text-sm text-center mb-6">
            Te mandamos todos los detalles por email
          </p>
          <LeadForm source="curso" product="curso" />
        </div>
      </section>

      {/* Footer mínimo */}
      <footer className="border-t border-[#1a1a1a] py-6 text-center text-zinc-700 text-xs">
        © 2026 MACD Studios · macdestudios.com
      </footer>
    </main>
  )
}
