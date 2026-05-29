"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const servicios = [
  { img: "/images/servicios/servicio-web.jpg", titulo: "Web Premium", desc: "Sitios profesionales que convierten visitantes en clientes. Diseno cinematografico y velocidad extrema." },
  { img: "/images/servicios/servicio-bot.jpg", titulo: "Bot IA 24/7", desc: "Asistente con inteligencia artificial que atiende, cualifica y vende en WhatsApp y Telegram sin descanso." },
  { img: "/images/servicios/servicio-citas.jpg", titulo: "Citas y Reservas", desc: "Sistema de agenda con calendario que reduce no-shows un 70% con recordatorios automaticos." },
  { img: "/images/servicios/servicio-dashboard.jpg", titulo: "Dashboard", desc: "Panel de control donde gestionas clientes, citas, ventas y metricas en tiempo real." },
  { img: "/images/servicios/servicio-notif.jpg", titulo: "Notificaciones", desc: "Recordatorios automaticos por email y WhatsApp. Tus clientes nunca olvidan su cita." },
  { img: "/images/servicios/servicio-marketing.jpg", titulo: "Marketing y Redes", desc: "Gestion de redes sociales y campanas publicitarias que atraen clientes reales." },
];

export default function Servicios() {
  return (
    <section id="servicios" className="py-32 relative">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <div className="text-yellow-500 text-sm tracking-[0.3em] uppercase mb-4">Que hacemos</div>
          <h2 className="text-4xl lg:text-6xl font-bold mb-6">
            Todo lo que tu negocio<br /><span className="text-gold-gradient italic">necesita para crecer.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servicios.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8 }}
              className="group relative bg-gradient-to-br from-white/5 to-transparent border border-white/10 hover:border-yellow-600/40 rounded-3xl overflow-hidden transition-all duration-300"
            >
              <div className="relative h-48 overflow-hidden">
                <Image src={s.img} alt={s.titulo} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
              </div>
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-3">{s.titulo}</h3>
                <p className="text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
