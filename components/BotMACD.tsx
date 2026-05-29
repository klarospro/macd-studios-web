"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageCircle, ExternalLink } from "lucide-react";

type Mensaje = { tipo: "bot" | "user"; texto: string; opciones?: string[]; };
type Paso = "saludo" | "negocio" | "problema" | "plan" | "final";

export default function BotMACD() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [paso, setPaso] = useState<Paso>("saludo");
  const [escribiendo, setEscribiendo] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => {
      addBotMessage("Hola! Soy el asistente de MACD STUDIOS. En 30 segundos te digo como podemos automatizar tu negocio. Que tipo de negocio tienes?", ["Clinica/Salud", "Restaurante", "Inmobiliaria", "Otro"]);
    }, 800);
  }, []);

  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }); }, [mensajes, escribiendo]);

  const addBotMessage = (texto: string, opciones?: string[]) => {
    setEscribiendo(true);
    setTimeout(() => { setEscribiendo(false); setMensajes(prev => [...prev, { tipo: "bot", texto, opciones }]); }, 1100);
  };

  const addUserMessage = (texto: string) => { setMensajes(prev => [...prev, { tipo: "user", texto }]); };

  const handleOpcion = (opcion: string) => {
    addUserMessage(opcion);
    switch (paso) {
      case "saludo":
        setPaso("problema");
        addBotMessage("Genial! Cual es tu mayor dolor ahora mismo?", ["Pierdo clientes fuera de horario", "Gestiono todo a mano", "No tengo presencia online", "Quiero vender mas"]);
        break;
      case "problema":
        setPaso("plan");
        addBotMessage("Te entiendo perfectamente. Eso lo resolvemos con automatizacion IA. Que presupuesto manejas para empezar?", ["Lo minimo posible", "Algo equilibrado", "Quiero lo mejor"]);
        break;
      case "plan":
        setPaso("final");
        let recomendacion = "";
        if (opcion.includes("minimo")) recomendacion = "Plan ESENCIAL (0 EUR inicial + 290/mes)";
        else if (opcion.includes("equilibrado")) recomendacion = "Plan PROFESIONAL (700 EUR + 390/mes) - el mas popular";
        else recomendacion = "Plan PREMIUM (1.500 EUR + 590/mes) - dominacion total";
        addBotMessage(`Perfecto. Para tu caso te recomiendo el ${recomendacion}.\n\nMoises, nuestro fundador, te puede dar todos los detalles y un presupuesto personalizado AHORA mismo por Telegram. Le escribes?`, ["Si, hablar con Moises"]);
        break;
      case "final":
        window.open("https://t.me/macdstudios", "_blank");
        break;
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
            Descubre tu plan<br /><span className="text-gold-gradient italic">en 30 segundos.</span>
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
                  En linea
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
