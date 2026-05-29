"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, TrendingUp, Newspaper, Lightbulb } from "lucide-react";
import Image from "next/image";

const articulos = [
  {
    categoria: "Tendencias",
    icon: TrendingUp,
    titulo: "Por que 2026 es el año de la IA en los negocios locales",
    extracto: "Los negocios que adoptan IA crecen 3x mas rapido que los que no. Te explicamos por que y como empezar.",
    fecha: "Mayo 2026",
    img: "/images/blog/era-digital-1.jpg",
  },
  {
    categoria: "Caso Real",
    icon: Lightbulb,
    titulo: "Como un concesionario recupero 15.000 EUR al mes con un bot",
    extracto: "Historia real de automatizacion: de perder leads cada noche a captarlos las 24 horas.",
    fecha: "Mayo 2026",
    img: "/images/blog/era-digital-2.jpg",
  },
  {
    categoria: "Noticias IA",
    icon: Newspaper,
    titulo: "Los 5 sectores que mas pagan por automatizacion en 2026",
    extracto: "Concesionarios, clinicas, inmobiliarias... descubre donde esta el dinero de la nueva era digital.",
    fecha: "Mayo 2026",
    img: "/images/blog/era-digital-3.jpg",
  },
];

export default function EraDigital() {
  return (
    <section id="era-digital" className="py-32 relative bg-gradient-to-b from-transparent via-yellow-950/5 to-transparent">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <div className="text-yellow-500 text-sm tracking-[0.3em] uppercase mb-4">La nueva era digital</div>
          <h2 className="text-4xl lg:text-6xl font-bold mb-6">
            El futuro de tu negocio,<br /><span className="text-gold-gradient italic">explicado.</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Noticias, casos reales y tendencias sobre como la IA esta transformando los negocios. 
            Aprende, aplica, crece.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {articulos.map((a, i) => (
            <motion.article
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              whileHover={{ y: -8 }}
              className="group relative bg-gradient-to-br from-white/5 to-transparent border border-white/10 hover:border-yellow-600/40 rounded-3xl overflow-hidden transition-all duration-300 cursor-pointer"
            >
              <div className="relative h-48 overflow-hidden">
                <Image 
                  src={a.img} 
                  alt={a.titulo} 
                  fill 
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
              </div>
              <div className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-yellow-500 text-xs tracking-widest uppercase">{a.categoria}</div>
                  <ArrowUpRight className="w-5 h-5 text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="text-xl font-bold mb-3 leading-snug">{a.titulo}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">{a.extracto}</p>
                <div className="text-gray-500 text-xs">{a.fecha}</div>
              </div>
            </motion.article>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <p className="text-gray-500 text-sm">
            Proximamente: mas articulos, reportes y guias sobre la nueva era digital.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
