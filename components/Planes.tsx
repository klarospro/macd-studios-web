"use client";

import { motion } from "framer-motion";
import { Check, Send } from "lucide-react";

const planes = [
  {
    nombre: "Esencial",
    subtitulo: "Empieza a automatizar",
    inicial: "0",
    cuotas: "",
    mensual: "290",
    destacado: false,
    features: [
      "Web profesional responsive",
      "Bot web que capta leads",
      "Boton directo a WhatsApp/Telegram",
      "Formulario inteligente",
      "Hosting + dominio incluidos",
      "SEO basico",
      "1 revision mensual",
      "Soporte por email",
    ],
  },
  {
    nombre: "Profesional",
    subtitulo: "Tu negocio en piloto automatico",
    inicial: "700",
    cuotas: "o 3 cuotas de 240 EUR",
    mensual: "390",
    destacado: true,
    features: [
      "Todo lo del Esencial +",
      "Bot WhatsApp/Telegram 24/7 con IA",
      "Sistema de citas con calendario",
      "Dashboard de gestion",
      "Notificaciones automaticas",
      "Recordatorios (menos no-shows)",
      "Integracion Google Calendar",
      "CRM basico + reportes",
      "Soporte prioritario WhatsApp",
    ],
  },
  {
    nombre: "Premium",
    subtitulo: "Dominacion total",
    inicial: "1.500",
    cuotas: "o 3 cuotas de 500 EUR",
    mensual: "590",
    destacado: false,
    features: [
      "Todo lo del Profesional +",
      "Web cinematografica nivel premium",
      "Bot IA que cierra ventas",
      "Gestion redes sociales (12 posts/mes)",
      "Campanas Meta/Google Ads",
      "Programa de fidelizacion",
      "Multi-idioma",
      "CRM avanzado",
      "2h consultoria/mes + soporte 24/7",
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
          <div className="text-yellow-500 text-sm tracking-[0.3em] uppercase mb-4">Planes</div>
          <h2 className="text-4xl lg:text-6xl font-bold mb-6">
            Invierte en tu<br /><span className="text-gold-gradient italic">crecimiento.</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Sin sorpresas. Eliges el plan, nosotros lo construimos. Garantia incluida.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 items-start">
          {planes.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className={`relative rounded-3xl p-8 ${p.destacado ? "bg-gradient-to-br from-yellow-600/20 to-transparent border-2 border-yellow-600/50 border-gold-glow lg:scale-105" : "bg-white/5 border border-white/10"}`}
            >
              {p.destacado && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gold-gradient text-black text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full">
                  Mas popular
                </div>
              )}

              <div className="text-yellow-500 text-xs tracking-widest uppercase mb-2">{p.subtitulo}</div>
              <h3 className="text-3xl font-bold mb-6">{p.nombre}</h3>

              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-gray-400 text-sm">Inicial</span>
                  <span className="text-3xl font-bold text-gold-gradient">{p.inicial} EUR</span>
                </div>
                {p.cuotas && <div className="text-xs text-gray-500 mt-1">{p.cuotas}</div>}
                <div className="flex items-baseline gap-2 mt-3">
                  <span className="text-4xl font-bold">{p.mensual} EUR</span>
                  <span className="text-gray-400">/mes</span>
                </div>
              </div>

              <a
                href="https://t.me/macdstudios"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 w-full py-3 rounded-full font-bold mb-8 transition-all ${p.destacado ? "bg-gold-gradient text-black hover:scale-105" : "bg-white/10 text-white hover:bg-white/20"}`}
              >
                <Send className="w-4 h-4" />
                Empezar ahora
              </a>

              <ul className="space-y-3">
                {p.features.map((f, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-gray-300">
                    <Check className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-gray-500 text-sm mt-12">
          Servicios adicionales: gestion de redes desde 200 EUR/mes · campanas 15% sobre inversion · llamadas IA +100 EUR/mes
        </p>
      </div>
    </section>
  );
}
