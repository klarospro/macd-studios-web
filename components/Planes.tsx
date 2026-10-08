"use client";

import { motion } from "framer-motion";
import { Check, MessageCircle } from "lucide-react";
import { whatsappConTexto } from "@/lib/contacto";

const planes = [
  {
    nombre: "Esencial",
    subtitulo: "Empieza a automatizar",
    ideal: "Para tener presencia online y captar contactos.",
    destacado: false,
    features: [
      "Web profesional, rápida y adaptada al móvil",
      "Bot web que capta contactos",
      "Botón directo a WhatsApp y Telegram",
      "Formulario inteligente",
      "Hosting y dominio incluidos",
      "SEO básico",
      "Revisión mensual",
    ],
  },
  {
    nombre: "Profesional",
    subtitulo: "Tu negocio en piloto automático",
    ideal: "Para dejar de hacer a mano lo que se repite cada día.",
    destacado: true,
    features: [
      "Todo lo del Esencial +",
      "CRM a medida con tus clientes y ventas",
      "Automatizaciones: recordatorios, informes, facturas",
      "Bot de WhatsApp o Telegram 24/7 con IA",
      "Citas y reservas con calendario",
      "Panel de gestión y reportes",
      "Soporte prioritario por WhatsApp",
    ],
  },
  {
    nombre: "Sistema completo",
    subtitulo: "Todo tu negocio en un sistema",
    ideal: "Para negocios que quieren llevarlo todo desde un mismo sitio.",
    destacado: false,
    features: [
      "Todo lo del Profesional +",
      "Sistema de gestión a medida (TPV, stock, caja, facturación)",
      "IA que lee facturas y propone pedidos",
      "Pagos online y desde el móvil",
      "Web multi-idioma de nivel premium",
      "Redes sociales y campañas",
      "Consultoría mensual y soporte 24/7",
    ],
  },
];

export default function Planes() {
  return (
    <section id="planes" className="py-32 relative bg-gradient-to-b from-transparent via-yellow-950/5 to-transparent">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <div className="text-yellow-500 text-sm tracking-[0.3em] uppercase mb-4">Presupuesto a medida</div>
          <h2 className="text-4xl lg:text-6xl font-bold mb-6">
            Pagas por lo que<br /><span className="text-gold-gradient italic">tu negocio necesita.</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Cada negocio es distinto. Nos cuentas qué necesitas y te preparamos un presupuesto a medida, sin compromiso.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 items-start">
          {planes.map((p, i) => (
            <motion.div
              key={p.nombre}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className={`relative rounded-3xl p-8 ${p.destacado ? "bg-gradient-to-br from-yellow-600/20 to-transparent border-2 border-yellow-600/50 border-gold-glow lg:scale-105" : "bg-white/5 border border-white/10"}`}
            >
              {p.destacado && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gold-gradient text-black text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full">
                  Recomendado
                </div>
              )}

              <div className="text-yellow-500 text-xs tracking-widest uppercase mb-2">{p.subtitulo}</div>
              <h3 className="text-3xl font-bold mb-3">{p.nombre}</h3>
              <p className="text-gray-400 mb-6">{p.ideal}</p>

              <motion.a
                href={whatsappConTexto(`Hola Moisés, vengo de la web de MACD Studios. Me interesa el plan ${p.nombre} y quiero un presupuesto.`)}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.93 }}
                className={`flex items-center justify-center gap-2 w-full py-3 rounded-full font-bold mb-8 ${p.destacado ? "bg-gold-gradient text-black" : "bg-white/10 text-white hover:bg-white/20"}`}
              >
                <MessageCircle className="w-4 h-4" />
                Pedir presupuesto
              </motion.a>

              <ul className="space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-gray-300">
                    <Check className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-gray-500 text-sm mt-12">
          ¿Necesitas otra cosa? También hacemos desarrollos a medida desde cero. Cuéntanos tu idea.
        </p>
      </div>
    </section>
  );
}
