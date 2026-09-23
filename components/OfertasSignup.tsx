"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Gift } from "lucide-react";
import Honeypot from "@/components/Honeypot";
import { HONEYPOT_FIELD } from "@/lib/antiSpam";

export default function OfertasSignup() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !email.trim()) return;
    setStatus("loading");

    const honeypot = new FormData(formRef.current ?? undefined).get(HONEYPOT_FIELD);

    const res = await fetch("/api/offer-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email, telefono, [HONEYPOT_FIELD]: honeypot }),
    });

    setStatus(res.ok ? "done" : "error");
  }

  return (
    <section className="py-24 relative">
      <div className="max-w-2xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-br from-white/5 to-transparent border border-yellow-600/20 rounded-3xl p-8 md:p-10 text-center"
        >
          <Gift className="w-10 h-10 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-3xl lg:text-4xl font-bold mb-3">
            ¿Quieres ser parte de <span className="text-gold-gradient italic">MACD?</span>
          </h2>
          <p className="text-gray-400 max-w-md mx-auto mb-8">
            Diseña tu presupuesto, cuéntanos tu proyecto y regístrate — te llevas un bono de descuento para tu primer proyecto.
          </p>

          {status === "done" ? (
            <p className="text-yellow-500 font-semibold">
              ¡Listo! Te avisamos en cuanto salga algo nuevo.
            </p>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm mx-auto">
              <Honeypot />
              <input
                type="text"
                placeholder="Tu nombre"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="bg-[#0d0d0d] border border-[#333] rounded-lg px-4 py-3 text-white text-sm placeholder-zinc-700 focus:outline-none focus:border-yellow-500/50"
              />
              <input
                type="email"
                placeholder="Tu email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#0d0d0d] border border-[#333] rounded-lg px-4 py-3 text-white text-sm placeholder-zinc-700 focus:outline-none focus:border-yellow-500/50"
              />
              <input
                type="tel"
                placeholder="Tu WhatsApp (opcional)"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="bg-[#0d0d0d] border border-[#333] rounded-lg px-4 py-3 text-white text-sm placeholder-zinc-700 focus:outline-none focus:border-yellow-500/50"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="bg-gold-gradient text-black font-bold py-3 rounded-lg hover:scale-[1.02] transition-transform disabled:opacity-50"
              >
                {status === "loading" ? "Enviando..." : "Quiero mi bono de descuento"}
              </button>
              {status === "error" && (
                <p className="text-red-400 text-xs text-center">Algo falló. Intenta de nuevo.</p>
              )}
              <p className="text-zinc-700 text-xs text-center">Sin spam. Cancela cuando quieras.</p>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}
