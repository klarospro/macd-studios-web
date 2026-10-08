"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, ExternalLink } from "lucide-react";

import { TELEGRAM_URL, whatsappConTexto } from "@/lib/contacto";

type Mensaje = { tipo: "bot" | "user"; texto: string; opciones?: string[]; };
type Paso = "saludo" | "problema" | "necesidad" | "final";

// Qué plan encaja con cada necesidad. Sin precios: el presupuesto lo hace Moisés.
function recomendar(necesidad: string): string {
  if (necesidad.startsWith("Web")) return "Esencial";
  if (necesidad.startsWith("Sistema")) return "Sistema completo";
  return "Profesional";
}

export default function BotMACD() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [paso, setPaso] = useState<Paso>("saludo");
  const [escribiendo, setEscribiendo] = useState(false);
  const respuestas = useRef<{ negocio?: string; problema?: string; necesidad?: string; plan?: string }>({});
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }); }, [mensajes, escribiendo]);

  const addBotMessage = (texto: string, opciones?: string[]) => {
    setEscribiendo(true);
    setTimeout(() => { setEscribiendo(false); setMensajes(prev => [...prev, { tipo: "bot", texto, opciones }]); }, 1100);
  };

  useEffect(() => {
    setTimeout(() => {
      addBotMessage("¡Hola! Soy el asistente de MACD Studios. En 30 segundos te digo cómo podemos ayudarte. ¿Qué tipo de negocio tienes?", ["Restaurante / bar", "Clínica / salud", "Inmobiliaria", "Otro"]);
    }, 800);
  }, []);

  const addUserMessage = (texto: string) => { setMensajes(prev => [...prev, { tipo: "user", texto }]); };

  const handleOpcion = (opcion: string) => {
    addUserMessage(opcion);
    switch (paso) {
      case "saludo":
        respuestas.current.negocio = opcion;
        setPaso("problema");
        addBotMessage("¡Genial! ¿Qué es lo que más te frena ahora mismo?", ["Pierdo clientes fuera de horario", "Gestiono todo a mano", "No tengo presencia online", "Quiero vender más"]);
        break;
      case "problema":
        respuestas.current.problema = opcion;
        setPaso("necesidad");
        addBotMessage("Te entiendo. Eso tiene solución. ¿Qué te gustaría tener primero?", ["Web y presencia online", "CRM y automatizaciones", "Bot que atienda 24/7", "Sistema completo para el negocio"]);
        break;
      case "necesidad": {
        respuestas.current.necesidad = opcion;
        const plan = recomendar(opcion);
        respuestas.current.plan = plan;
        setPaso("final");
        addBotMessage(`Para tu caso encaja el plan ${plan}.

Moisés, nuestro fundador, te prepara un presupuesto a medida y sin compromiso. ¿Le escribes?`, ["Sí, por WhatsApp", "Prefiero Telegram"]);
        break;
      }
      case "final": {
        if (opcion.includes("Telegram")) {
          window.open(TELEGRAM_URL, "_blank", "noopener,noreferrer");
          break;
        }
        const r = respuestas.current;
        const texto = `Hola Moisés, vengo de la web de MACD Studios. Tengo un negocio de tipo ${r.negocio}, mi problema es "${r.problema}" y me interesa: ${r.necesidad} (plan ${r.plan}). ¿Me preparas un presupuesto?`;
        window.open(whatsappConTexto(texto), "_blank", "noopener,noreferrer");
        break;
      }
    }
  };

  const ultimoMensaje = mensajes[mensajes.length - 1];

  return (
    <section id="contacto" className="py-32 relative">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="text-yellow-500 text-sm tracking-[0.3em] uppercase mb-4">Hablemos</div>
          <h2 className="text-4xl lg:text-6xl font-bold mb-6">
            Descubre tu solución<br /><span className="text-gold-gradient italic">en 30 segundos.</span>
          </h2>
        </motion.div>

        <div className="bg-gradient-to-br from-white/5 to-transparent border border-yellow-600/20 rounded-3xl overflow-hidden">
          <div className="bg-gradient-to-r from-yellow-700 to-yellow-500 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-black/20 rounded-full flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-black" />
              </div>
              <div>
                <div className="font-bold text-lg text-black">Asistente MACD</div>
                <div className="text-sm text-black/70 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                  En línea
                </div>
              </div>
            </div>
          </div>

          <div ref={chatRef} className="h-96 overflow-y-auto p-6 space-y-4">
            <AnimatePresence>
              {mensajes.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.tipo === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${m.tipo === "user" ? "bg-gold-gradient text-black" : "bg-white/10 text-white border border-white/10"}`}>
                    <p className="whitespace-pre-line text-sm">{m.texto}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {escribiendo && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-white/10 border border-white/10 rounded-2xl px-5 py-3 flex gap-1">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
              </motion.div>
            )}

            {!escribiendo && ultimoMensaje?.opciones && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-2">
                {ultimoMensaje.opciones.map((op, i) => (
                  <button
                    key={i}
                    onClick={() => handleOpcion(op)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${paso === "final" ? "bg-gold-gradient text-black hover:scale-105 inline-flex items-center gap-2" : "bg-white/5 border border-yellow-600/30 text-white hover:bg-yellow-600/10"}`}
                  >
                    {op}
                    {paso === "final" && <ExternalLink className="w-4 h-4" />}
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
