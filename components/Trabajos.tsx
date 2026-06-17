"use client";

import { motion } from "framer-motion";
import { ExternalLink, ArrowUpRight } from "lucide-react";

const trabajos = [
  {
    nombre: "Aurora Dental",
    sector: "Clinica Dental",
    desc: "Web premium con bot que agenda citas 24/7 y reduce no-shows. Calculadora de perdidas integrada.",
    url: "https://aurora-dental-demo-yr9e.vercel.app",
    color: "from-sky-500 to-cyan-400",
    emoji: "🦷",
  },
  {
    nombre: "Pizza Studio",
    sector: "Restaurante",
    desc: "Sistema de pedidos por WhatsApp con bot italiano. Captura el 85% de pedidos perdidos fuera de horario.",
    url: "https://pizza-studio-demo.vercel.app",
    color: "from-red-500 to-amber-400",
    emoji: "🍕",
  },
  {
    nombre: "Vista Inmobiliaria",
    sector: "Inmobiliaria",
    desc: "Bot que cualifica leads en 3 minutos. Solo compradores reales llegan a los agentes. Premium total.",
    url: "https://vista-inmobiliaria-demo-5w7y.vercel.app",
    color: "from-slate-600 to-amber-600",
    emoji: "🏛️",
  },
];

export default function Trabajos() {
  return (
    <section id="trabajos" className="py-32 relative bg-gradient-to-b from-transparent via-yellow-950/5 to-transparent">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <div className="text-yellow-500 text-sm tracking-[0.3em] uppercase mb-4">Nuestros trabajos</div>
          <h2 className="text-4xl lg:text-6xl font-bold mb-6">
            Casos reales,<br /><span className="text-gold-gradient italic">resultados reales.</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Cada proyecto es navegable. Pruebalos en vivo, habla con los bots, siente la experiencia.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {trabajos.map((t, i) => (
            <motion.a
              key={i}
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              whileHover={{ y: -10 }}
              className="group relative bg-gradient-to-br from-white/5 to-transparent border border-white/10 hover:border-yellow-600/40 rounded-3xl overflow-hidden transition-all duration-300"
            >
              <div className={`relative h-56 bg-gradient-to-br ${t.color} flex items-center justify-center overflow-hidden`}>
                <div className="text-8xl group-hover:scale-110 transition-transform duration-500">{t.emoji}</div>
                <div className="absolute top-4 right-4 w-10 h-10 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-black/50 transition-colors">
                  <ArrowUpRight className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="p-8">
                <div className="text-yellow-500 text-xs tracking-widest uppercase mb-2">{t.sector}</div>
                <h3 className="text-2xl font-bold mb-3">{t.nombre}</h3>
                <p className="text-gray-400 mb-4 leading-relaxed">{t.desc}</p>
                <div className="inline-flex items-center gap-2 text-yellow-500 font-medium">
                  Ver en vivo
                  <ExternalLink className="w-4 h-4" />
                </div>
              </div>
            </motion.a>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-12 bg-gradient-to-br from-white/5 to-transparent border border-yellow-600/30 hover:border-yellow-500/60 rounded-3xl overflow-hidden transition-all duration-300"
        >
          <div className="bg-gradient-to-br from-yellow-900/30 to-zinc-900 px-8 py-10 border-b border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="text-yellow-500 text-xs tracking-widest uppercase mb-2">
                Caso de estudio · Automatización completa
              </div>
              <h3 className="text-4xl lg:text-5xl font-bold">GROUP 360</h3>
              <p className="text-gray-300 mt-2 text-lg">De cero a sistema completo en 7 días</p>
            </div>
            <a
              href="https://group360iniciativas.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/40 hover:border-yellow-500/70 text-yellow-400 font-medium px-6 py-3 rounded-2xl transition-all duration-200 shrink-0"
            >
              Ver sitio en vivo
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="p-8 lg:p-10 grid md:grid-cols-2 gap-10">
            <div>
              <div className="text-yellow-500 text-xs tracking-widest uppercase mb-4">Lo que construimos</div>
              <ul className="space-y-3">
                {[
                  "Bot de WhatsApp con IA atendiendo 24/7",
                  "Panel de control por Telegram con 9 comandos",
                  "Dashboard de inversores con calculadora ROI",
                  "12 páginas web + 16 endpoints + gestión de alquileres",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-yellow-500 mt-0.5 shrink-0">→</span>
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-6">
              <div>
                <div className="text-yellow-500 text-xs tracking-widest uppercase mb-3">Resultado</div>
                <p className="text-white leading-relaxed">
                  Contrato cerrado por{" "}
                  <span className="text-yellow-400 font-semibold">3.000€ de instalación + 250€/mes recurrente</span>
                  , en la misma semana de la entrega.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { valor: "7 días", label: "de desarrollo" },
                  { valor: "40 commits", label: "en total" },
                  { valor: "~5.800 líneas", label: "de código" },
                  { valor: "<25€/mes", label: "coste operativo" },
                ].map((s, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="text-yellow-400 font-bold text-lg">{s.valor}</div>
                    <div className="text-gray-500 text-sm mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
