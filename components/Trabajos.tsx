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
      </div>
    </section>
  );
}
