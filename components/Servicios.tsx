"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

const servicios = [
  { img: "/images/servicios/servicio-dashboard.jpg", titulo: "CRM a medida", desc: "Clientes, ventas, seguimientos y facturas en un panel hecho para tu forma de trabajar, no al revés." },
  { img: "/images/servicios/servicio-notif.jpg", titulo: "Automatizaciones", desc: "Recordatorios, informes, pedidos a proveedores, facturas por foto: lo repetitivo lo hace el sistema solo." },
  { img: "/images/servicios/servicio-bot.jpg", titulo: "Bot IA 24/7", desc: "Un asistente con inteligencia artificial que atiende, cualifica y reserva en WhatsApp y Telegram a cualquier hora." },
  { img: "/images/servicios/servicio-web.jpg", titulo: "Web premium", desc: "Webs rápidas y cuidadas que convierten visitas en clientes y se conectan con tu CRM." },
  { img: "/images/servicios/servicio-citas.jpg", titulo: "Citas y reservas", desc: "Agenda online con recordatorios automáticos para que nadie se olvide de su cita." },
  { img: "/images/servicios/servicio-marketing.jpg", titulo: "Marketing y redes", desc: "Gestión de redes y campañas que traen clientes reales, medidas de principio a fin." },
];

const sectores = [
  { nombre: "Hostelería", desc: "TPV, carta QR y pagos", href: "#trabajos" },
  { nombre: "Clínicas", desc: "Citas y recordatorios", href: "https://aurora-dental-demo-yr9e.vercel.app" },
  { nombre: "Inmobiliarias", desc: "Leads cualificados", href: "https://vista-inmobiliaria-demo-5w7y.vercel.app" },
  { nombre: "Eventos y comunidades", desc: "Inscripciones y avisos", href: "https://vidanuevareus.com" },
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
          <div className="text-yellow-500 text-sm tracking-[0.3em] uppercase mb-4">Qué hacemos</div>
          <h2 className="text-4xl lg:text-6xl font-bold mb-6">
            Todo lo que tu negocio<br /><span className="text-gold-gradient italic">necesita para crecer.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servicios.map((s, i) => (
            <motion.div
              key={s.titulo}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8 }}
              className="group relative bg-gradient-to-br from-white/5 to-transparent border border-white/10 hover:border-yellow-600/40 rounded-3xl overflow-hidden transition-all duration-300"
            >
              <div className="relative h-48 overflow-hidden">
                <Image src={s.img} alt={s.titulo} fill sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
              </div>
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-3">{s.titulo}</h3>
                <p className="text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16"
        >
          <div className="text-center text-gray-400 mb-6">Soluciones por sector (pruébalas):</div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {sectores.map((s) => {
              const externo = s.href.startsWith("http");
              return (
                <a
                  key={s.nombre}
                  href={s.href}
                  {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group flex items-center justify-between gap-3 bg-white/5 border border-white/10 hover:border-yellow-600/40 rounded-2xl px-5 py-4 transition-colors"
                >
                  <div>
                    <div className="font-bold">{s.nombre}</div>
                    <div className="text-sm text-gray-500">{s.desc}</div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-yellow-500 shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
