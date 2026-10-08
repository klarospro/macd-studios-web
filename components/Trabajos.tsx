"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ExternalLink, ArrowUpRight } from "lucide-react";

const trabajos = [
  {
    nombre: "Vida Nueva Reus",
    sector: "Congresos y eventos",
    tipo: "Cliente",
    desc: "Web automatizada para una comunidad con eventos y congresos propios, con toda la información e inscripciones centralizadas.",
    url: "https://vidanuevareus.com",
    img: "/images/trabajos/vida-nueva-reus.webp",
  },
  {
    nombre: "Aurora Dental",
    sector: "Clínica dental",
    tipo: "Demo",
    desc: "Web premium con bot que agenda citas 24/7 y reduce no-shows. Calculadora de pérdidas integrada.",
    url: "https://aurora-dental-demo-yr9e.vercel.app",
    img: "/images/trabajos/aurora-dental.webp",
  },
  {
    nombre: "Pizza Studio",
    sector: "Restaurante",
    tipo: "Demo",
    desc: "Sistema de pedidos por WhatsApp con bot italiano. Captura el 85% de pedidos perdidos fuera de horario.",
    url: "https://pizza-studio-demo.vercel.app",
    img: "/images/trabajos/pizza-studio.webp",
  },
  {
    nombre: "Vista Inmobiliaria",
    sector: "Inmobiliaria",
    tipo: "Demo",
    desc: "Bot que cualifica leads en 3 minutos para que solo los compradores reales lleguen a los agentes.",
    url: "https://vista-inmobiliaria-demo-5w7y.vercel.app",
    img: "/images/trabajos/vista-inmobiliaria.webp",
  },
];

type Caso = {
  etiqueta: string;
  nombre: string;
  subtitulo: string;
  logo?: string;
  url?: string;
  estado?: string;
  construido: string[];
  resultado: ReactNode;
  stats: { valor: string; label: string }[];
};

const casos: Caso[] = [
  {
    etiqueta: "Caso de estudio · Restaurant OS · Hostelería",
    nombre: "SANTO CALI",
    subtitulo: "Bar-club en Reus: todo el local en un solo sistema",
    logo: "/images/trabajos/santo-cali-logo.svg",
    estado: "En instalación · octubre 2026",
    construido: [
      "TPV en tablets y pantalla de barra que sigue funcionando aunque se caiga internet",
      "Carta QR en 3 idiomas con pago desde la mesa",
      "Asistente de WhatsApp con IA para reservas y dudas de clientes",
      "Gerente por Telegram: facturas por foto y pedidos a proveedores",
      "CRM de clientes, stock, caja y facturación encadenada (VeriFactu)",
    ],
    resultado: (
      <>
        Un sistema a medida que sustituye{" "}
        <span className="text-yellow-400 font-semibold">TPV, carta, reservas y gestión de compras</span>. Primer local
        con MACD Restaurant OS.
      </>
    ),
    stats: [
      { valor: "Sin internet", label: "el local sigue vendiendo" },
      { valor: "3 idiomas", label: "carta QR ES · CA · EN" },
      { valor: "24/7", label: "asistente de WhatsApp" },
      { valor: "VeriFactu", label: "facturación preparada" },
    ],
  },
  {
    etiqueta: "Caso de estudio · Automatización completa",
    nombre: "GROUP 360",
    subtitulo: "De cero a sistema completo en 7 días",
    url: "https://group360iniciativas.com",
    construido: [
      "Bot de WhatsApp con IA atendiendo 24/7",
      "Panel de control por Telegram con 9 comandos",
      "Dashboard de inversores con calculadora ROI",
      "12 páginas web + 16 endpoints + gestión de alquileres",
    ],
    resultado: (
      <>
        De cero a <span className="text-yellow-400 font-semibold">sistema completo en producción</span> en una semana:
        web, bot, panel de control y gestión de alquileres.
      </>
    ),
    stats: [
      { valor: "7 días", label: "de desarrollo" },
      { valor: "40 commits", label: "en total" },
      { valor: "~5.800 líneas", label: "de código" },
      { valor: "24/7", label: "bot de WhatsApp atendiendo" },
    ],
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
          <div className="text-yellow-500 text-sm tracking-[0.3em] uppercase mb-4">Proyectos</div>
          <h2 className="text-4xl lg:text-6xl font-bold mb-6">
            Negocios reales,<br /><span className="text-gold-gradient italic">sistemas funcionando.</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Primero, lo que hemos construido para clientes. Después, demos que puedes probar en vivo.
          </p>
        </motion.div>

        {casos.map((c, i) => (
          <motion.div
            key={c.nombre}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className={`${i === 0 ? "" : "mt-8"} bg-gradient-to-br from-white/5 to-transparent border border-yellow-600/30 hover:border-yellow-500/60 rounded-3xl overflow-hidden transition-all duration-300`}
          >
            <div
              className={`${i % 2 === 0 ? "bg-gradient-to-br from-yellow-900/30 to-zinc-900" : "bg-gradient-to-br from-zinc-900 to-yellow-900/20"} px-8 py-10 border-b border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-6`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                {c.logo && (
                  <div className="relative w-36 h-24 shrink-0 bg-black/60 border border-white/10 rounded-2xl">
                    <Image src={c.logo} alt={`Logo de ${c.nombre}`} fill sizes="144px" className="object-contain p-2" />
                  </div>
                )}
                <div>
                  <div className="text-yellow-500 text-xs tracking-widest uppercase mb-2">{c.etiqueta}</div>
                  <h3 className="text-4xl lg:text-5xl font-bold">{c.nombre}</h3>
                  <p className="text-gray-300 mt-2 text-lg">{c.subtitulo}</p>
                </div>
              </div>
              {c.url ? (
                <motion.a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-flex items-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/40 hover:border-yellow-500/70 text-yellow-400 font-medium px-6 py-3 rounded-2xl transition-colors duration-200 shrink-0"
                >
                  Ver sitio en vivo
                  <ExternalLink className="w-4 h-4" />
                </motion.a>
              ) : (
                c.estado && (
                  <div className="inline-flex items-center gap-2 bg-white/5 border border-white/15 text-gray-300 text-sm font-medium px-5 py-3 rounded-2xl shrink-0 self-start md:self-auto">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                    {c.estado}
                  </div>
                )
              )}
            </div>

            <div className="p-8 lg:p-10 grid md:grid-cols-2 gap-10">
              <div>
                <div className="text-yellow-500 text-xs tracking-widest uppercase mb-4">Lo que construimos</div>
                <ul className="space-y-3">
                  {c.construido.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="text-yellow-500 mt-0.5 shrink-0">→</span>
                      <span className="text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="text-yellow-500 text-xs tracking-widest uppercase mb-3">Resultado</div>
                  <p className="text-white leading-relaxed">{c.resultado}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {c.stats.map((s) => (
                    <div key={s.valor} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <div className="text-yellow-400 font-bold text-lg">{s.valor}</div>
                      <div className="text-gray-500 text-sm mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        <div className="text-yellow-500 text-xs tracking-widest uppercase mt-20 mb-8 text-center">Más proyectos y demos</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {trabajos.map((t, i) => (
            <motion.a
              key={t.nombre}
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
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-yellow-500 text-xs tracking-widest uppercase">{t.sector}</span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${t.tipo === "Cliente" ? "bg-yellow-500 text-black" : "bg-white/10 text-gray-300"}`}
                  >
                    {t.tipo}
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-3">{t.nombre}</h3>
                <p className="text-gray-400 mb-4 leading-relaxed">{t.desc}</p>
                <div className="inline-flex items-center gap-2 text-yellow-500 font-medium">
                  {t.tipo === "Demo" ? "Probar la demo" : "Ver en vivo"}
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
