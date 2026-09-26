import type { Metadata } from "next";
import Image from "next/image";
import { Clock, MessageSquareWarning, Search } from "lucide-react";
import BotMACD from "@/components/BotMACD";
import OfertasSignup from "@/components/OfertasSignup";
import Footer from "@/components/Footer";

// Landing de destino para anuncios: un mensaje, una acción (pedir la auditoría) y la prueba en
// vivo (hablar con Max). Sin menú para no dispersar la atención.
export const metadata: Metadata = {
  title: "Auditoría gratis: cuántos clientes pierdes por contestar tarde",
  description:
    "Te decimos en 48 horas cuántos contactos se te escapan por responder tarde y cómo atenderlos al momento, 24/7. Gratis y sin compromiso.",
  alternates: { canonical: "/auditoria" },
};

const PUNTOS = [
  {
    icon: Clock,
    title: "Tu tiempo real de respuesta",
    text: "Medimos cuánto tardas en contestar por WhatsApp, web y redes, a distintas horas del día.",
  },
  {
    icon: MessageSquareWarning,
    title: "Dónde se te escapan",
    text: "Qué mensajes quedan sin respuesta, qué preguntas se repiten y en qué momento el cliente se va.",
  },
  {
    icon: Search,
    title: "Qué automatizar primero",
    text: "Un plan concreto para atender al momento, 24/7, sin contratar a nadie más.",
  },
];

export default function AuditoriaPage() {
  return (
    <main className="bg-black text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-yellow-600/10 via-transparent to-black" />
        <div className="relative max-w-3xl mx-auto px-6 pt-16 pb-20 text-center">
          <Image src="/images/logo.png" alt="MACD Studios" width={200} height={64} className="h-14 w-auto mx-auto object-contain" priority />
          <h1 className="mt-10 text-4xl md:text-6xl font-bold leading-tight">
            Cada mensaje que contestas tarde es un cliente que se va{" "}
            <span className="text-gold-gradient italic">con tu competencia</span>
          </h1>
          <p className="mt-6 text-lg text-gray-300">
            Pide tu <strong className="text-white">auditoría gratis</strong>: en 48 horas te decimos cuántos contactos se te
            escapan y cómo atenderlos al momento, a cualquier hora.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#auditoria"
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold px-8 py-4 rounded-xl transition-colors"
            >
              Quiero mi auditoría gratis
            </a>
            <a
              href="#max"
              className="border border-yellow-600/40 hover:border-yellow-500 text-yellow-500 font-semibold px-8 py-4 rounded-xl transition-colors"
            >
              Prueba a Max ahora
            </a>
          </div>
          <p className="mt-4 text-xs text-zinc-500">Sin compromiso · Respuesta en 48 h</p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-8">
        <h2 className="text-center text-sm uppercase tracking-widest text-yellow-500 mb-8">Qué incluye la auditoría</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {PUNTOS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <Icon className="w-6 h-6 text-yellow-500" />
              <h3 className="mt-4 font-semibold text-lg">{title}</h3>
              <p className="mt-2 text-sm text-gray-400 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <div id="max">
        <BotMACD />
      </div>
      <OfertasSignup />
      <Footer />
    </main>
  );
}
