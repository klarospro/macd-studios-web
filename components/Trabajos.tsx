"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ExternalLink, ArrowUpRight, Star } from "lucide-react";

const trabajos = [
  {
    nombre: "Aurora Dental",
    sector: "Clinica Dental",
    desc: "Web premium con bot que agenda citas 24/7 y reduce no-shows. Calculadora de perdidas integrada.",
    url: "https://aurora-dental-demo-yr9e.vercel.app",
    img: "/images/trabajos/aurora-dental.webp",
  },
  {
    nombre: "Pizza Studio",
    sector: "Restaurante",
    desc: "Sistema de pedidos por WhatsApp con bot italiano. Captura el 85% de pedidos perdidos fuera de horario.",
    url: "https://pizza-studio-demo.vercel.app",
    img: "/images/trabajos/pizza-studio.webp",
  },
  {
    nombre: "Vista Inmobiliaria",
    sector: "Inmobiliaria",
    desc: "Bot que cualifica leads en 3 minutos. Solo compradores reales llegan a los agentes. Premium total.",
    url: "https://vista-inmobiliaria-demo-5w7y.vercel.app",
    img: "/images/trabajos/vista-inmobiliaria.webp",
  },
  {
    nombre: "Vida Nueva Reus",
    sector: "Congresos y eventos",
    desc: "Web automatizada para una comunidad con eventos y congresos propios, con toda la informacion e inscripciones centralizadas.",
    url: "https://vidanuevareus.com",
    img: "/images/trabajos/vida-nueva-reus.webp",
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
          <div className="inline-flex items-center gap-2 mt-6 bg-white/5 border border-yellow-600/20 rounded-full px-5 py-2.5">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
              ))}
            </div>
            <span className="text-sm text-gray-300">100% de clientes satisfechos con el resultado entregado</span>
          </div>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
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
              whileTap={{ scale: 0.97 }}
              className="group relative bg-gradient-to-br from-white/5 to-transparent border border-white/10 hover:border-yellow-600/40 rounded-3xl overflow-hidden transition-all duration-300"
            >
              <div className="relative h-56 overflow-hidden">
                <Image
                  src={t.img}
                  alt={`Captura de pantalla del sitio web ${t.nombre}`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover object-top group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <motion.div
                  whileHover={{ scale: 1.15, rotate: 8 }}
                  className="absolute top-4 right-4 w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-yellow-500 transition-colors"
                >
                  <ArrowUpRight className="w-5 h-5 text-white group-hover:text-black transition-colors" />
                </motion.div>
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
            <motion.a
              href="https://group360iniciativas.com"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/40 hover:border-yellow-500/70 text-yellow-400 font-medium px-6 py-3 rounded-2xl transition-colors duration-200 shrink-0"
            >
              Ver sitio en vivo
              <ExternalLink className="w-4 h-4" />
            </motion.a>
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

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-8 bg-gradient-to-br from-white/5 to-transparent border border-yellow-600/30 hover:border-yellow-500/60 rounded-3xl overflow-hidden transition-all duration-300"
        >
          <div className="bg-gradient-to-br from-zinc-900 to-yellow-900/20 px-8 py-10 border-b border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="text-yellow-500 text-xs tracking-widest uppercase mb-2">
                Producto propio · Sistema de trading automatizado
              </div>
              <h3 className="text-4xl lg:text-5xl font-bold">ATLAS CAPITAL</h3>
              <p className="text-gray-300 mt-2 text-lg">Gestion de capital automatizada, 24/7, multi-mercado</p>
            </div>
            <motion.a
              href="https://atlas-capital-ai.vercel.app/atlas"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/40 hover:border-yellow-500/70 text-yellow-400 font-medium px-6 py-3 rounded-2xl transition-colors duration-200 shrink-0"
            >
              Ver sitio en vivo
              <ExternalLink className="w-4 h-4" />
            </motion.a>
          </div>

          <div className="p-8 lg:p-10 grid md:grid-cols-2 gap-10">
            <div>
              <div className="text-yellow-500 text-xs tracking-widest uppercase mb-4">Lo que construimos</div>
              <ul className="space-y-3">
                {[
                  "Motor de trading automatizado multi-activo (cripto, forex, indices, prediction markets)",
                  "Control de riesgo unificado con cierre automatico de posiciones",
                  "Monitoreo continuo 24/7 con registro de auditoria inmutable",
                  "Dashboard propio de seguimiento del sistema",
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
                <div className="text-yellow-500 text-xs tracking-widest uppercase mb-3">Resultado (backtest)</div>
                <p className="text-white leading-relaxed">
                  Rentabilidad anualizada de{" "}
                  <span className="text-yellow-400 font-semibold">+14.8%</span> con un drawdown
                  maximo de -11.2% en el periodo evaluado.
                </p>
                <p className="text-gray-500 text-xs mt-2">
                  Cifras basadas en backtesting, no constituyen garantia de rendimiento futuro.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { valor: "24/7", label: "monitoreo automatizado" },
                  { valor: "4 mercados", label: "cripto · forex · indices · prediction" },
                  { valor: "+14.8%", label: "anualizado (backtest)" },
                  { valor: "-11.2%", label: "drawdown maximo" },
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
