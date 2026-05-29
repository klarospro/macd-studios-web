"use client";

import { motion } from "framer-motion";
import { MessageCircle, PenTool, Rocket, TrendingUp } from "lucide-react";

const pasos = [
  { icon: MessageCircle, num: "01", titulo: "Hablamos", desc: "Nos cuentas tu negocio y tus problemas. Analizamos donde pierdes clientes y dinero." },
  { icon: PenTool, num: "02", titulo: "Disenamos", desc: "Creamos tu web, tu bot y tu sistema a medida. Personalizado para tu sector." },
  { icon: Rocket, num: "03", titulo: "Lanzamos", desc: "En 1-2 semanas todo esta funcionando. Te formamos para que lo manejes facil." },
  { icon: TrendingUp, num: "04", titulo: "Creces", desc: "Tu negocio capta clientes 24/7. Nosotros optimizamos y mejoramos cada mes." },
];

export default function ComoFunciona() {
  return (
    <section className="py-32 relative">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <div className="text-yellow-500 text-sm tracking-[0.3em] uppercase mb-4">Como funciona</div>
          <h2 className="text-4xl lg:text-6xl font-bold mb-6">
            De la idea al resultado<br /><span className="text-gold-gradient italic">en 4 pasos.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {pasos.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative"
            >
              <div className="text-6xl font-bold text-white/5 mb-4" style={{ fontFamily: "var(--font-display)" }}>{p.num}</div>
              <div className="w-14 h-14 rounded-2xl bg-gold-gradient flex items-center justify-center mb-6 -mt-12 relative z-10">
                <p.icon className="w-7 h-7 text-black" />
              </div>
              <h3 className="text-2xl font-bold mb-3">{p.titulo}</h3>
              <p className="text-gray-400 leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
